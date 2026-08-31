const crypto = require("crypto");
const {onCall, HttpsError} = require("firebase-functions/v2/https");

const ALLOWED_ORIGINS = [
  "https://giriagames.win",
  "http://127.0.0.1:5174",
  "http://127.0.0.1:5502",
  "http://localhost:5174",
  "http://localhost:5502",
];
const ALLOWED_ROLES = ["gplayer", "ruler", "estafeta"];
const ALLOWED_ACCEPTANCE = ["Yes", "No"];
const ALLOWED_TABLE_STATES = ["Yes", "No"];
const ALLOWED_EXPIRY_DAYS = [1, 3, 7, 14];
const APP_ORIGIN = "https://giriagames.win";
const ACTION_LINK_DOMAIN = "giriagames.win";

function normaliseEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function cleanText(value, maximumLength) {
  return String(value || "").trim().slice(0, maximumLength);
}

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function requireValidEmail(email) {
  const basicEmailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!basicEmailPattern.test(email) || email.length > 254) {
    throw new HttpsError("invalid-argument", "Indica um endereço de e-mail válido.");
  }
}

async function requireRuler(db, request) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "É necessário iniciar sessão.");
  }

  const callerSnapshot = await db.collection("users").doc(request.auth.uid).get();
  if (!callerSnapshot.exists || callerSnapshot.data().estatuto !== "ruler") {
    throw new HttpsError(
        "permission-denied",
        "Apenas um ruler pode criar convites de conta.",
    );
  }
}

async function accountAlreadyHasProfile(admin, db, email) {
  try {
    const authUser = await admin.auth().getUserByEmail(email);
    const profile = await db.collection("users").doc(authUser.uid).get();
    return profile.exists;
  } catch (error) {
    if (error.code === "auth/user-not-found") return false;
    throw error;
  }
}

function buildAccountInvitationFunctions({admin, db, getLatestSeason}) {
  const createAccountInvite = onCall({cors: ALLOWED_ORIGINS}, async (request) => {
    await requireRuler(db, request);

    const data = request.data || {};
    const email = normaliseEmail(data.email);
    const nomeDeUsuario = cleanText(data.nomeDeUsuario, 60);
    const nomeTabela = cleanText(data.nomeTabela, 60);
    const naTabela = cleanText(data.naTabela || "No", 3);
    const arena = cleanText(data.arena, 30);
    const estatuto = cleanText(data.estatuto || "gplayer", 20);
    const aceite = cleanText(data.aceite || "Yes", 3);
    const expiresInDays = Number(data.expiresInDays || 7);

    requireValidEmail(email);
    if (!nomeDeUsuario) {
      throw new HttpsError("invalid-argument", "O nome de utilizador é obrigatório.");
    }
    if (!ALLOWED_ROLES.includes(estatuto) ||
        !ALLOWED_ACCEPTANCE.includes(aceite) ||
        !ALLOWED_TABLE_STATES.includes(naTabela) ||
        !ALLOWED_EXPIRY_DAYS.includes(expiresInDays)) {
      throw new HttpsError("invalid-argument", "Os dados do convite não são válidos.");
    }
    if (await accountAlreadyHasProfile(admin, db, email)) {
      throw new HttpsError("already-exists", "Já existe uma conta completa com este e-mail.");
    }

    const rawToken = crypto.randomBytes(32).toString("base64url");
    const inviteId = hashToken(rawToken);
    const expiresAt = admin.firestore.Timestamp.fromMillis(
        Date.now() + expiresInDays * 24 * 60 * 60 * 1000,
    );

    await db.collection("accountInvites").doc(inviteId).set({
      email,
      nomeDeUsuario,
      nomeTabela,
      naTabela,
      arena,
      estatuto,
      aceite,
      createdBy: request.auth.uid,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      expiresAt,
      usedAt: null,
      usedBy: null,
    });

    try {
      const continueUrl = `${APP_ORIGIN}/aceitar-convite?convite=${encodeURIComponent(rawToken)}`;
      const link = await admin.auth().generateSignInWithEmailLink(email, {
        url: continueUrl,
        handleCodeInApp: true,
        linkDomain: ACTION_LINK_DOMAIN,
      });

      return {
        success: true,
        link,
        expiresAt: expiresAt.toDate().toISOString(),
      };
    } catch (error) {
      await db.collection("accountInvites").doc(inviteId).delete().catch(() => {});
      console.error("Erro ao gerar o link de convite:", error);
      throw new HttpsError(
          "failed-precondition",
          "Não foi possível gerar o link. Confirma o domínio de ligação no Firebase Authentication.",
      );
    }
  });

  const acceptAccountInvite = onCall({cors: ALLOWED_ORIGINS}, async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Confirma primeiro o e-mail através do convite.");
    }

    const authenticatedEmail = normaliseEmail(request.auth.token.email);
    if (!authenticatedEmail || request.auth.token.email_verified !== true) {
      throw new HttpsError("failed-precondition", "O e-mail desta sessão ainda não foi confirmado.");
    }

    const rawToken = cleanText(request.data && request.data.token, 200);
    if (!rawToken) {
      throw new HttpsError("invalid-argument", "O convite não contém um token válido.");
    }

    const inviteRef = db.collection("accountInvites").doc(hashToken(rawToken));
    const userRef = db.collection("users").doc(request.auth.uid);
    const seasonLabel = await getLatestSeason();

    await db.runTransaction(async (transaction) => {
      const [inviteSnapshot, userSnapshot] = await transaction.getAll(inviteRef, userRef);
      if (!inviteSnapshot.exists) {
        throw new HttpsError("not-found", "Este convite não existe ou já não é válido.");
      }

      const invite = inviteSnapshot.data();
      if (invite.usedAt || invite.usedBy) {
        throw new HttpsError("already-exists", "Este convite já foi utilizado.");
      }
      if (!invite.expiresAt || invite.expiresAt.toMillis() <= Date.now()) {
        throw new HttpsError("deadline-exceeded", "Este convite expirou.");
      }
      if (normaliseEmail(invite.email) !== authenticatedEmail) {
        throw new HttpsError("permission-denied", "Este convite pertence a outro endereço de e-mail.");
      }
      if (userSnapshot.exists) {
        throw new HttpsError("already-exists", "Esta conta já tem um perfil criado.");
      }

      transaction.set(userRef, {
        email: authenticatedEmail,
        nomeDeUsuario: invite.nomeDeUsuario,
        nometabela: invite.nomeTabela,
        estatuto: invite.estatuto,
        aceite: invite.aceite,
        [seasonLabel]: {
          uid: request.auth.uid,
          natabela: invite.naTabela,
          arena: invite.arena,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        },
      });
      transaction.update(inviteRef, {
        usedAt: admin.firestore.FieldValue.serverTimestamp(),
        usedBy: request.auth.uid,
      });
    });

    return {success: true};
  });

  return {createAccountInvite, acceptAccountInvite};
}

module.exports = {buildAccountInvitationFunctions};
