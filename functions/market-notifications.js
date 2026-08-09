const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const webpush = require("web-push");

const VAPID_PUBLIC_KEY = "BNQqYP8I9537wDNcLm5Bfzj1-dR7ynWXs064sLLbJ3T6RxaZqVbNvPXX-ryv7I6rgBYET5mZCuwxXpUn7Jsiv9I";
const VAPID_PRIVATE_KEY = "6SGGrihGmcnwfF_Fipd_V5hNc2th1M8Ez0FFGd0E9YU";
const VAPID_SUBJECT = "mailto:admin@giriagames.com";
const NOTIFICATION_TIME_ZONE = "Europe/Lisbon";
const DEFAULT_CONFIG = {
  beforeOpenEnabled: true,
  beforeOpenHours: 2,
  onOpenEnabled: true,
  onCloseEnabled: true,
  predictionsOpenEnabled: false,
  predictionsOpenWeekday: 5,
  predictionsOpenTime: "09:00",
  predictionsCloseEnabled: false,
  predictionsCloseWeekday: 6,
  predictionsCloseTime: "20:00",
  predictionsClosingSoonEnabled: false,
  predictionsClosingSoonWeekday: 6,
  predictionsClosingSoonTime: "20:00",
  predictionsClosingSoonHours: 2,
};
const DISPATCH_WINDOW_MS = 15 * 60 * 1000;
const MARKET_NOTIFICATION_FIELD = "notificacoesMercado";
const ADMIN_ROLES = new Set(["ruler", "estafeta"]);

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

function normalizeUserSettings(rawSettings) {
  return {
    pushEnabled: rawSettings?.pushEnabled === true,
    pushSubscriptions: Array.isArray(rawSettings?.pushSubscriptions) ? rawSettings.pushSubscriptions : [],
  };
}

function asDate(value) {
  if (!value) {
    return null;
  }

  if (typeof value.toDate === "function") {
    return value.toDate();
  }

  if (value instanceof Date) {
    return value;
  }

  if (typeof value === "number") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  if (typeof value === "string") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  if (typeof value.seconds === "number") {
    const milliseconds = (value.seconds * 1000) + Math.floor((value.nanoseconds || 0) / 1000000);
    const date = new Date(milliseconds);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  if (typeof value._seconds === "number") {
    const milliseconds = (value._seconds * 1000) + Math.floor((value._nanoseconds || 0) / 1000000);
    const date = new Date(milliseconds);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  return null;
}

function isDue(nowMs, targetDate, sentAtValue) {
  if (!targetDate) {
    return false;
  }

  const targetMs = targetDate.getTime();

  if (nowMs < targetMs || nowMs > targetMs + DISPATCH_WINDOW_MS) {
    return false;
  }

  const sentAtDate = asDate(sentAtValue);
  return !sentAtDate || sentAtDate.getTime() < targetMs;
}

function buildDispatchKey(type, hoursBeforeOpen) {
  if (type === "beforeOpen") {
    return `beforeOpen_${hoursBeforeOpen}h`;
  }

  return type;
}

function buildPayload(type, scheduleId, scheduleData, hoursBeforeOpen) {
  const abertura = asDate(scheduleData.abertura);
  const fechamento = asDate(scheduleData.fechamento);
  const targetLabel = scheduleData.observacoes || "a janela de mercado";
  const formatDate = (date) => date ? date.toLocaleString("pt-PT", { timeZone: NOTIFICATION_TIME_ZONE }) : "brevemente";

  if (type === "beforeOpen") {
    return {
      title: "Mercado a abrir em breve",
      body: `${targetLabel} abre às ${formatDate(abertura)}. Aviso enviado ${hoursBeforeOpen}h antes.`,
      tag: `market-${scheduleId}-${buildDispatchKey(type, hoursBeforeOpen)}`,
      url: "./market.html",
    };
  }

  if (type === "onOpen") {
    return {
      title: "Mercado aberto",
      body: `${targetLabel} abriu agora. Fecha às ${formatDate(fechamento)}.`,
      tag: `market-${scheduleId}-onOpen`,
      url: "./market.html",
    };
  }

  return {
    title: "Mercado fechado",
    body: `${targetLabel} fechou agora.`,
    tag: `market-${scheduleId}-onClose`,
    url: "./market.html",
  };
}

function getInterestedUsers(users, type) {
  return users.filter((userEntry) => {
    const settings = userEntry.settings;

    return settings.pushEnabled && settings.pushSubscriptions.length > 0;
  });
}

async function sendPayloadToUser(userEntry, payload) {
  const validSubscriptions = [];
  let delivered = 0;
  const attempted = userEntry.settings.pushSubscriptions.length;

  for (const subscription of userEntry.settings.pushSubscriptions) {
    try {
      await webpush.sendNotification(subscription, JSON.stringify(payload));
      validSubscriptions.push(subscription);
      delivered += 1;
    } catch (error) {
      const statusCode = error?.statusCode || null;
      const isExpired = statusCode === 404 || statusCode === 410;

      if (!isExpired) {
        console.error(`Push error for user ${userEntry.id}:`, error.message || error);
        validSubscriptions.push(subscription);
      }
    }
  }

  if (validSubscriptions.length !== userEntry.settings.pushSubscriptions.length) {
    await userEntry.ref.set({
      [MARKET_NOTIFICATION_FIELD]: {
        ...userEntry.settings,
        pushSubscriptions: validSubscriptions,
        pushEnabled: validSubscriptions.length > 0,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
    }, { merge: true });

    userEntry.settings = {
      ...userEntry.settings,
      pushSubscriptions: validSubscriptions,
      pushEnabled: validSubscriptions.length > 0,
    };
  }

  return {
    delivered,
    attempted,
  };
}

async function sendPayloadToUsers(userEntries, payload) {
  const results = await Promise.all(
    userEntries.map((userEntry) => sendPayloadToUser(userEntry, payload))
  );

  return results.reduce((summary, result) => ({
    delivered: summary.delivered + result.delivered,
    attempted: summary.attempted + result.attempted,
  }), { delivered: 0, attempted: 0 });
}

async function dispatchForEvent(scheduleEntry, users, type, hoursBeforeOpen) {
  const payload = buildPayload(type, scheduleEntry.id, scheduleEntry.data, hoursBeforeOpen);
  const interestedUsers = getInterestedUsers(users, type);

  if (interestedUsers.length === 0) {
    return false;
  }

  const delivery = await sendPayloadToUsers(interestedUsers, payload);
  return delivery.delivered > 0;
}

async function loadEligibleUsers() {
  const db = admin.firestore();
  const usersSnapshot = await db.collection("users").get();

  return usersSnapshot.docs.map((userDoc) => ({
    id: userDoc.id,
    ref: userDoc.ref,
    settings: normalizeUserSettings(userDoc.data()?.[MARKET_NOTIFICATION_FIELD]),
  }));
}

async function ensureAdminAccess(uid) {
  if (!uid) {
    throw new HttpsError("unauthenticated", "Precisas de login para usar esta função.");
  }

  const userSnapshot = await admin.firestore().doc(`users/${uid}`).get();
  const role = userSnapshot.data()?.estatuto || null;

  if (!ADMIN_ROLES.has(role)) {
    throw new HttpsError("permission-denied", "Sem permissões para enviar notificações.");
  }
}

function sanitizeManualMessage(message) {
  if (typeof message !== "string") {
    throw new HttpsError("invalid-argument", "A mensagem tem de ser texto.");
  }

  const trimmed = message.trim().replace(/\s+/g, " ");

  if (!trimmed) {
    throw new HttpsError("invalid-argument", "Escreve uma mensagem antes de enviar.");
  }

  if (trimmed.length > 180) {
    throw new HttpsError("invalid-argument", "A mensagem não pode ultrapassar 180 caracteres.");
  }

  return trimmed;
}

function isValidWeekday(value) {
  return Number.isInteger(value) && value >= 0 && value <= 6;
}

function isValidTime(value) {
  return typeof value === "string" && /^\d{2}:\d{2}$/.test(value);
}

function isValidHoursBefore(value) {
  return Number.isInteger(value) && value > 0 && value <= 48;
}

function getZonedParts(date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: NOTIFICATION_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date).reduce((result, part) => {
    if (part.type !== "literal") {
      result[part.type] = Number.parseInt(part.value, 10);
    }
    return result;
  }, {});

  return parts;
}

function getTimeZoneOffsetMs(date) {
  const parts = getZonedParts(date);
  const zonedAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second
  );

  return zonedAsUtc - date.getTime();
}

function zonedLocalDateToUtc(localDate) {
  let timestamp = localDate.getTime();

  for (let attempt = 0; attempt < 3; attempt += 1) {
    timestamp = localDate.getTime() - getTimeZoneOffsetMs(new Date(timestamp));
  }

  return new Date(timestamp);
}

function getWeekKey(date) {
  const parts = getZonedParts(date);
  const current = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  const day = current.getUTCDay();
  const diffToMonday = (day + 6) % 7;
  current.setUTCDate(current.getUTCDate() - diffToMonday);

  const year = current.getUTCFullYear();
  const month = String(current.getUTCMonth() + 1).padStart(2, "0");
  const dayOfMonth = String(current.getUTCDate()).padStart(2, "0");

  return `${year}-${month}-${dayOfMonth}`;
}

function getWeeklyTriggerDate(now, weekday, timeString) {
  if (!isValidWeekday(weekday) || !isValidTime(timeString)) {
    return null;
  }

  const [hours, minutes] = timeString.split(":").map((value) => Number.parseInt(value, 10));
  const localNow = getZonedParts(now);
  const target = new Date(Date.UTC(localNow.year, localNow.month - 1, localNow.day));
  const diffDays = (weekday - target.getUTCDay() + 7) % 7;

  target.setUTCDate(target.getUTCDate() + diffDays);
  target.setUTCHours(hours, minutes, 0, 0);

  return zonedLocalDateToUtc(target);
}

function getWeeklyTriggerDateWithOffset(now, weekday, timeString, hoursBefore) {
  if (!isValidHoursBefore(hoursBefore)) {
    return null;
  }

  const target = getWeeklyTriggerDate(now, weekday, timeString);

  if (!target) {
    return null;
  }

  return new Date(target.getTime() - (hoursBefore * 60 * 60 * 1000));
}

function isWeeklyNotificationDue(now, weekday, timeString, lastWeekKey) {
  const targetDate = getWeeklyTriggerDate(now, weekday, timeString);

  if (!targetDate) {
    return false;
  }

  const nowMs = now.getTime();
  const targetMs = targetDate.getTime();
  const currentWeekKey = getWeekKey(targetDate);

  return nowMs >= targetMs &&
    nowMs <= targetMs + DISPATCH_WINDOW_MS &&
    lastWeekKey !== currentWeekKey;
}

function isWeeklyOffsetNotificationDue(now, weekday, timeString, hoursBefore, lastWeekKey) {
  const targetDate = getWeeklyTriggerDateWithOffset(now, weekday, timeString, hoursBefore);

  if (!targetDate) {
    return false;
  }

  const nowMs = now.getTime();
  const targetMs = targetDate.getTime();
  const closingTarget = getWeeklyTriggerDate(now, weekday, timeString);
  const currentWeekKey = getWeekKey(closingTarget || targetDate);

  return nowMs >= targetMs &&
    nowMs <= targetMs + DISPATCH_WINDOW_MS &&
    lastWeekKey !== currentWeekKey;
}

function buildWeeklyPredictionPayload(type, weekday, timeString) {
  const whenLabel = `${timeString} de ${["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"][weekday]}`;

  if (type === "predictionsOpen") {
    return {
      title: "Jogos para Prognóstico disponíveis",
      body: `Os jogos para prognóstico já estão disponíveis para palpitar. Regra semanal: ${whenLabel}.`,
      tag: `predictions-open-${weekday}-${timeString}`,
      url: "./1x.html",
    };
  }

  return {
    title: "Prognósticos fechados",
    body: `O período dos prognósticos fechou. Regra semanal: ${whenLabel}.`,
    tag: `predictions-close-${weekday}-${timeString}`,
    url: "./1x.html",
  };
}

function buildPredictionsClosingSoonPayload(weekday, timeString, hoursBefore) {
  const whenLabel = `${timeString} de ${["domingo", "segunda-feira", "terÃ§a-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sÃ¡bado"][weekday]}`;

  return {
    title: "PrognÃ³sticos a fechar em breve",
    body: `Os jogos para prognóstico vão fechar daqui a ${hoursBefore}h. Fecho semanal: ${whenLabel}.`,
    tag: `predictions-closing-soon-${weekday}-${timeString}-${hoursBefore}`,
    url: "./1x.html",
  };
}

exports.processMarketNotifications = onSchedule({
  schedule: "every 1 minutes",
  timeZone: "Europe/Lisbon",
}, async () => {
  const db = admin.firestore();
  const configRef = db.doc("paineis/notificacoesMercado");
  const configSnapshot = await configRef.get();
  const config = configSnapshot.exists ? { ...DEFAULT_CONFIG, ...configSnapshot.data() } : DEFAULT_CONFIG;
  const schedulesSnapshot = await db.collection("paineis").doc("Banca").collection("horarioMercado").get();
  const now = new Date();
  const nowMs = now.getTime();
  const dueEvents = [];

  if (!schedulesSnapshot.empty) {
    schedulesSnapshot.forEach((scheduleDoc) => {
      const data = scheduleDoc.data();
      const abertura = asDate(data.abertura);
      const fechamento = asDate(data.fechamento);
      const sentNotifications = data.sentNotifications || {};

      if (config.beforeOpenEnabled && abertura) {
        const beforeOpenDate = new Date(abertura.getTime() - (config.beforeOpenHours * 60 * 60 * 1000));
        if (isDue(nowMs, beforeOpenDate, sentNotifications[buildDispatchKey("beforeOpen", config.beforeOpenHours)])) {
          dueEvents.push({
            scheduleRef: scheduleDoc.ref,
            id: scheduleDoc.id,
            data,
            type: "beforeOpen",
          });
        }
      }

      if (config.onOpenEnabled && isDue(nowMs, abertura, sentNotifications.onOpen)) {
        dueEvents.push({
          scheduleRef: scheduleDoc.ref,
          id: scheduleDoc.id,
          data,
          type: "onOpen",
        });
      }

      if (config.onCloseEnabled && isDue(nowMs, fechamento, sentNotifications.onClose)) {
        dueEvents.push({
          scheduleRef: scheduleDoc.ref,
          id: scheduleDoc.id,
          data,
          type: "onClose",
        });
      }
    });
  }

  const weeklyLog = config.weeklyDispatchLog || {};
  const dueWeeklyEvents = [];

  if (config.predictionsOpenEnabled &&
    isWeeklyNotificationDue(now, config.predictionsOpenWeekday, config.predictionsOpenTime, weeklyLog.predictionsOpen?.weekKey || null)) {
    dueWeeklyEvents.push({
      type: "predictionsOpen",
      weekday: config.predictionsOpenWeekday,
      timeString: config.predictionsOpenTime,
    });
  }

  if (config.predictionsCloseEnabled &&
    isWeeklyNotificationDue(now, config.predictionsCloseWeekday, config.predictionsCloseTime, weeklyLog.predictionsClose?.weekKey || null)) {
    dueWeeklyEvents.push({
      type: "predictionsClose",
      weekday: config.predictionsCloseWeekday,
      timeString: config.predictionsCloseTime,
    });
  }

  if (config.predictionsClosingSoonEnabled &&
    isWeeklyOffsetNotificationDue(
      now,
      config.predictionsClosingSoonWeekday,
      config.predictionsClosingSoonTime,
      config.predictionsClosingSoonHours,
      weeklyLog.predictionsClosingSoon?.weekKey || null
    )) {
    dueWeeklyEvents.push({
      type: "predictionsClosingSoon",
      weekday: config.predictionsClosingSoonWeekday,
      timeString: config.predictionsClosingSoonTime,
      hoursBefore: config.predictionsClosingSoonHours,
    });
  }

  if (dueEvents.length === 0 && dueWeeklyEvents.length === 0) {
    return null;
  }

  const users = await loadEligibleUsers();

  for (const eventEntry of dueEvents) {
    const didDispatch = await dispatchForEvent(
      eventEntry,
      users,
      eventEntry.type,
      config.beforeOpenHours
    );

    if (!didDispatch) {
      continue;
    }

    const dispatchKey = buildDispatchKey(eventEntry.type, config.beforeOpenHours);
    await eventEntry.scheduleRef.set({
      sentNotifications: {
        [dispatchKey]: admin.firestore.FieldValue.serverTimestamp(),
      },
    }, { merge: true });
  }

  for (const weeklyEvent of dueWeeklyEvents) {
    const interestedUsers = getInterestedUsers(users);

    if (interestedUsers.length === 0) {
      continue;
    }

    const payload = weeklyEvent.type === "predictionsClosingSoon"
      ? buildPredictionsClosingSoonPayload(
        weeklyEvent.weekday,
        weeklyEvent.timeString,
        weeklyEvent.hoursBefore
      )
      : buildWeeklyPredictionPayload(
        weeklyEvent.type,
        weeklyEvent.weekday,
        weeklyEvent.timeString
      );

    const delivery = await sendPayloadToUsers(interestedUsers, payload);

    if (delivery.delivered === 0) {
      continue;
    }

    await configRef.set({
      weeklyDispatchLog: {
        [weeklyEvent.type]: {
          weekKey: getWeekKey(now),
          sentAt: admin.firestore.FieldValue.serverTimestamp(),
        },
      },
    }, { merge: true });
  }

  return null;
});

exports.sendInboxNotification = onCall({
  cors: [
    "https://g-games-8a8fc.web.app",
    "https://giriagames.com",
    "http://127.0.0.1:5502",
    "http://localhost:5502",
    "http://127.0.0.1:5503",
    "http://localhost:5503",
  ],
}, async (request) => {
  await ensureAdminAccess(request.auth?.uid || null);

  const sender = typeof request.data?.sender === "string" ? request.data.sender.trim() : "";
  const emailTitle = typeof request.data?.emailTitle === "string" ? request.data.emailTitle.trim() : "";
  const rawMessage = typeof request.data?.message === "string" ? request.data.message : "";
  const message = sanitizeManualMessage(`${emailTitle}\n${rawMessage}`);

  if (!sender || !emailTitle) {
    throw new HttpsError("invalid-argument", "O remetente e o título são obrigatórios.");
  }
  const targetUserIds = Array.isArray(request.data?.targetUserIds)
    ? [...new Set(request.data.targetUserIds.filter((userId) => typeof userId === "string" && userId.trim()))]
    : [];

  if (targetUserIds.length === 0) {
    throw new HttpsError("invalid-argument", "Seleciona pelo menos um destinat\u00e1rio.");
  }

  const users = await loadEligibleUsers();
  const targetUsers = getInterestedUsers(users)
    .filter((userEntry) => targetUserIds.includes(userEntry.id));

  if (targetUsers.length === 0) {
    return {
      success: true,
      deliveredTo: 0,
      message: "N\u00e3o h\u00e1 dispositivos ativos para receber esta notifica\u00e7\u00e3o.",
    };
  }

  const payload = {
    title: `(${sender}) :: gGames`,
    body: message,
    tag: `inbox-notification-${Date.now()}`,
    url: "./profile.html",
  };

  const delivery = await sendPayloadToUsers(targetUsers, payload);

  return {
    success: true,
    deliveredTo: delivery.delivered,
    message: "Notifica\u00e7\u00e3o enviada com sucesso.",
  };
});

exports.sendManualMarketNotification = onCall({
  cors: [
    "https://g-games-8a8fc.web.app",
    "https://giriagames.com",
    "http://127.0.0.1:5502",
    "http://localhost:5502",
    "http://127.0.0.1:5503",
    "http://localhost:5503",
  ],
}, async (request) => {
  await ensureAdminAccess(request.auth?.uid || null);

  const message = sanitizeManualMessage(request.data?.message);
  const users = await loadEligibleUsers();
  const interestedUsers = getInterestedUsers(users);

  if (interestedUsers.length === 0) {
    return {
      success: true,
      deliveredTo: 0,
      message: "Não há dispositivos ativos para receber esta notificação.",
    };
  }

  const payload = {
    title: "gGames",
    body: message,
    tag: `market-manual-${Date.now()}`,
    url: "./profile.html",
  };

  const delivery = await sendPayloadToUsers(interestedUsers, payload);

  return {
    success: true,
    deliveredTo: delivery.delivered,
    message: "Notificação enviada com sucesso.",
  };
});
