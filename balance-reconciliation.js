const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {
    calculateMovementBalance,
    compactMovementSeason,
} = require("./balance-reconciliation-logic");

const ALLOWED_ORIGINS = [
    "https://g-games-8a8fc.web.app",
    "https://giriagames.win",
    "https://www.giriagames.win",
    "http://127.0.0.1:5174",
    "http://localhost:5174",
    "http://127.0.0.1:5502",
    "http://localhost:5502",
    "http://127.0.0.1:5503",
    "http://localhost:5503",
];

function isPlainObject(value) {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function getCurrentBalance(userData, season) {
    const seasonData = isPlainObject(userData?.[season]) ? userData[season] : {};
    const balance = seasonData.GCoins;
    return typeof balance === "number" && Number.isFinite(balance) ? balance : 0;
}

function getDisplayName(userData, userId) {
    return userData.nometabela ||
        userData.nomeDeUsuario ||
        userData.email ||
        userId;
}

function groupMovementsByUser(movementSnapshot) {
    const movementsByUser = new Map();

    movementSnapshot.forEach((movementDocument) => {
        const movement = movementDocument.data();
        const userId = typeof movement.userId === "string" ? movement.userId.trim() : "";
        if (!userId) return;

        if (!movementsByUser.has(userId)) {
            movementsByUser.set(userId, []);
        }
        movementsByUser.get(userId).push(movement);
    });

    return movementsByUser;
}

function buildPreviewRows(userSnapshot, movementsByUser, season) {
    const rows = [];

    userSnapshot.forEach((userDocument) => {
        const userData = userDocument.data();
        const hasSeasonData = isPlainObject(userData?.[season]);
        const userMovements = movementsByUser.get(userDocument.id) || [];

        if (!hasSeasonData && userMovements.length === 0) {
            return;
        }

        const currentBalance = getCurrentBalance(userData, season);
        const calculated = calculateMovementBalance(userMovements, season);
        const difference = calculated.balance - currentBalance;

        rows.push({
            userId: userDocument.id,
            name: getDisplayName(userData, userDocument.id),
            currentBalance,
            calculatedBalance: calculated.balance,
            difference,
            movementCount: calculated.movementCount,
        });
    });

    return rows.sort((left, right) => (
        Math.abs(right.difference) - Math.abs(left.difference) ||
        left.name.localeCompare(right.name, "pt")
    ));
}

async function reconcileSingleUser({admin, db, userId, season}) {
    const userRef = db.collection("users").doc(userId);
    const movementsQuery = db.collection("movimentos").where("userId", "==", userId);

    return db.runTransaction(async (transaction) => {
        const userSnapshot = await transaction.get(userRef);
        const movementSnapshot = await transaction.get(movementsQuery);

        if (!userSnapshot.exists) {
            return null;
        }

        const userData = userSnapshot.data();
        const movements = movementSnapshot.docs.map((movementDocument) => movementDocument.data());
        const calculated = calculateMovementBalance(movements, season);
        const currentBalance = getCurrentBalance(userData, season);

        if (currentBalance === calculated.balance) {
            return {
                userId,
                name: getDisplayName(userData, userId),
                currentBalance,
                calculatedBalance: calculated.balance,
                difference: 0,
                movementCount: calculated.movementCount,
                updated: false,
            };
        }

        const seasonData = isPlainObject(userData?.[season]) ? userData[season] : {};
        transaction.set(userRef, {
            [season]: {
                ...seasonData,
                GCoins: calculated.balance,
            },
        }, {merge: true});

        return {
            userId,
            name: getDisplayName(userData, userId),
            currentBalance,
            calculatedBalance: calculated.balance,
            difference: calculated.balance - currentBalance,
            movementCount: calculated.movementCount,
            updated: true,
        };
    });
}

async function reconcileInGroups(options, userIds, groupSize = 10) {
    const results = [];

    for (let index = 0; index < userIds.length; index += groupSize) {
        const group = userIds.slice(index, index + groupSize);
        const groupResults = await Promise.all(group.map((userId) => (
            reconcileSingleUser({...options, userId})
        )));
        results.push(...groupResults.filter(Boolean));
    }

    return results;
}

function buildBalanceReconciliationFunction({admin, db, getLatestSeason}) {
    return onCall({
        invoker: "public",
        cors: ALLOWED_ORIGINS,
        timeoutSeconds: 300,
    }, async (request) => {
        if (!request.auth?.uid) {
            throw new HttpsError("unauthenticated", "É necessário iniciar sessão.");
        }

        const callerSnapshot = await db.collection("users").doc(request.auth.uid).get();
        if (!callerSnapshot.exists || callerSnapshot.data().estatuto !== "ruler") {
            throw new HttpsError(
                "permission-denied",
                "Apenas um ruler pode reconciliar os saldos.",
            );
        }

        const mode = request.data?.mode === "apply" ? "apply" : "preview";
        const season = await getLatestSeason();
        const compactSeason = compactMovementSeason(season);

        if (mode === "apply" && request.data?.confirmation !== season) {
            throw new HttpsError(
                "failed-precondition",
                "É necessária uma pré-visualização válida antes de aplicar.",
            );
        }

        const [userSnapshot, movementSnapshot] = await Promise.all([
            db.collection("users").get(),
            db.collection("movimentos")
                .where("temporada", "in", [season, compactSeason])
                .get(),
        ]);
        const movementsByUser = groupMovementsByUser(movementSnapshot);
        const previewRows = buildPreviewRows(
            userSnapshot,
            movementsByUser,
            season,
        );
        const changedRows = previewRows.filter((row) => row.difference !== 0);

        if (mode === "preview") {
            return {
                success: true,
                mode,
                season,
                totalUsers: previewRows.length,
                changedUsers: changedRows.length,
                rows: changedRows,
            };
        }

        const reconciliationResults = await reconcileInGroups({
            admin,
            db,
            season,
        }, changedRows.map((row) => row.userId));
        const updatedRows = reconciliationResults.filter((row) => row.updated);

        await db.collection("balanceReconciliations").add({
            season,
            seasonKey: compactSeason,
            requestedBy: request.auth.uid,
            updatedUsers: updatedRows.length,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        return {
            success: true,
            mode,
            season,
            totalUsers: reconciliationResults.length,
            changedUsers: updatedRows.length,
            rows: updatedRows,
        };
    });
}

module.exports = {
    buildBalanceReconciliationFunction,
    buildPreviewRows,
    getCurrentBalance,
    groupMovementsByUser,
};
