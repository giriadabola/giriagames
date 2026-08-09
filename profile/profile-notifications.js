import { auth, db } from "../core/firebase.js";
import { doc, getDoc, onSnapshot, serverTimestamp, setDoc } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { MARKET_NOTIFICATIONS_DEFAULTS, MARKET_NOTIFICATIONS_VAPID_PUBLIC_KEY } from "../core/pwa/push-config.js";

const GLOBAL_CONFIG_PATH = ['paineis', 'notificacoesMercado'];
const USER_SETTINGS_FIELD = 'notificacoesMercado';
const NOTIFICATION_OPEN_EVENT = 'profile-notifications:open';

const popup = document.getElementById('notificationsPopup');
const closePopupButton = document.getElementById('closeNotificationsPopupIcon');
const deviceStatus = document.getElementById('notificationsDeviceStatus');
const enableDeviceButton = document.getElementById('enableDeviceNotificationsBtn');
const disableDeviceButton = document.getElementById('disableDeviceNotificationsBtn');
const globalNote = document.getElementById('notificationsGlobalNote');

let activeUserId = null;
let currentSettings = { ...MARKET_NOTIFICATIONS_DEFAULTS };
let currentGlobalConfig = null;
let currentDeviceSubscription = null;
let userSettingsUnsubscribe = null;
let globalConfigUnsubscribe = null;
let areEventsBound = false;

function isIosDevice() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isStandaloneDisplayMode() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

function normalizeUserSettings(rawSettings) {
  return {
    pushEnabled: rawSettings?.pushEnabled === true,
    pushSubscriptions: Array.isArray(rawSettings?.pushSubscriptions) ? rawSettings.pushSubscriptions : []
  };
}

function getNotificationSupportState() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    return {
      supported: false,
      message: 'Este dispositivo/browser não suporta notificações web.'
    };
  }

  if (isIosDevice() && !isStandaloneDisplayMode()) {
    return {
      supported: false,
      message: 'No iPhone/iPad, instala a app no ecrã principal para ativar notificações.'
    };
  }

  return {
    supported: true,
    message: ''
  };
}

function base64UrlToUint8Array(base64UrlValue) {
  const padding = '='.repeat((4 - (base64UrlValue.length % 4)) % 4);
  const normalized = (base64UrlValue + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(normalized);
  const output = new Uint8Array(raw.length);

  for (let index = 0; index < raw.length; index += 1) {
    output[index] = raw.charCodeAt(index);
  }

  return output;
}

async function getServiceWorkerRegistration() {
  const registration = await navigator.serviceWorker.register('/sw.js', {
    scope: '/',
    updateViaCache: 'none'
  });

  await registration.update().catch(() => undefined);
  return navigator.serviceWorker.ready;
}

async function getCurrentSubscription() {
  const registration = await getServiceWorkerRegistration();
  return registration.pushManager.getSubscription();
}

function buildStoredSubscription(subscription) {
  const json = subscription.toJSON();

  return {
    endpoint: subscription.endpoint,
    expirationTime: subscription.expirationTime ?? null,
    keys: json.keys || {},
    userAgent: navigator.userAgent,
    standalone: isStandaloneDisplayMode(),
    platform: navigator.platform || 'unknown',
    updatedAtIso: new Date().toISOString()
  };
}

function mergeSubscriptions(existingSubscriptions, nextSubscription) {
  const filtered = existingSubscriptions.filter(
    (subscription) => subscription.endpoint !== nextSubscription.endpoint
  );

  return [...filtered, nextSubscription];
}

function removeSubscriptionByEndpoint(existingSubscriptions, endpoint) {
  return existingSubscriptions.filter((subscription) => subscription.endpoint !== endpoint);
}

function setDeviceStatus(message, tone = '') {
  deviceStatus.textContent = message;
  deviceStatus.className = 'notifications-device-status';

  if (tone) {
    deviceStatus.classList.add(tone);
  }
}

function refreshGlobalTexts() {
  const beforeHours = Number.isInteger(currentGlobalConfig?.beforeOpenHours)
    ? currentGlobalConfig.beforeOpenHours
    : 2;

  const globalRules = [];
  if (currentGlobalConfig?.beforeOpenEnabled) {
    globalRules.push(`${beforeHours}h antes`);
  }
  if (currentGlobalConfig?.onOpenEnabled) {
    globalRules.push('na abertura');
  }
  if (currentGlobalConfig?.onCloseEnabled) {
    globalRules.push('no fecho');
  }

  globalNote.textContent = globalRules.length
    ? `Regras globais ativas: ${globalRules.join(', ')}.`
    : 'O admin tem todas as regras globais desligadas neste momento.';
}

async function upsertCurrentSubscription(subscription) {
  if (!activeUserId) {
    return;
  }

  const userRef = doc(db, 'users', activeUserId);
  const userSnapshot = await getDoc(userRef);
  const userSettings = normalizeUserSettings(userSnapshot.data()?.[USER_SETTINGS_FIELD]);
  const nextSubscription = buildStoredSubscription(subscription);
  const nextSubscriptions = mergeSubscriptions(userSettings.pushSubscriptions, nextSubscription);

  await setDoc(userRef, {
    [USER_SETTINGS_FIELD]: {
      ...userSettings,
      pushEnabled: nextSubscriptions.length > 0,
      pushSubscriptions: nextSubscriptions,
      updatedAt: serverTimestamp()
    }
  }, { merge: true });
}

async function removeCurrentSubscription(subscription) {
  if (!activeUserId || !subscription) {
    return;
  }

  const userRef = doc(db, 'users', activeUserId);
  const userSnapshot = await getDoc(userRef);
  const userSettings = normalizeUserSettings(userSnapshot.data()?.[USER_SETTINGS_FIELD]);
  const nextSubscriptions = removeSubscriptionByEndpoint(
    userSettings.pushSubscriptions,
    subscription.endpoint
  );

  await setDoc(userRef, {
    [USER_SETTINGS_FIELD]: {
      ...userSettings,
      pushEnabled: nextSubscriptions.length > 0,
      pushSubscriptions: nextSubscriptions,
      updatedAt: serverTimestamp()
    }
  }, { merge: true });
}

async function syncDeviceState() {
  const supportState = getNotificationSupportState();

  if (!supportState.supported) {
    enableDeviceButton.disabled = true;
    disableDeviceButton.disabled = true;
    setDeviceStatus(supportState.message, 'is-warn');
    currentDeviceSubscription = null;
    return;
  }

  enableDeviceButton.disabled = false;
  try {
    currentDeviceSubscription = await getCurrentSubscription();
  } catch (error) {
    console.error('Erro ao preparar o service worker das notificações:', error);
    currentDeviceSubscription = null;
    setDeviceStatus('Não foi possível preparar as notificações neste browser.', 'is-error');
    return;
  }

  if (Notification.permission === 'denied') {
    enableDeviceButton.disabled = true;
    disableDeviceButton.disabled = true;
    setDeviceStatus('As notificações foram bloqueadas neste browser/dispositivo.', 'is-error');
    return;
  }

  if (currentDeviceSubscription) {
    disableDeviceButton.disabled = false;
    setDeviceStatus('Este dispositivo está pronto para receber notificações.', 'is-ok');
    return;
  }

  disableDeviceButton.disabled = true;
  setDeviceStatus('Ativa neste dispositivo para começares a receber avisos do mercado.', 'is-warn');
}

async function enableNotificationsForDevice() {
  const supportState = getNotificationSupportState();
  if (!supportState.supported) {
    setDeviceStatus(supportState.message, 'is-warn');
    return;
  }

  enableDeviceButton.disabled = true;
  setDeviceStatus('A ativar notificações neste dispositivo...', 'is-warn');

  try {
    const permission = await Notification.requestPermission();

    if (permission !== 'granted') {
      setDeviceStatus('Permissão não concedida. Sem isso não dá para enviar avisos push.', 'is-error');
      return;
    }

    const registration = await getServiceWorkerRegistration();
    const existingSubscription = await registration.pushManager.getSubscription();
    const subscription = existingSubscription || await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64UrlToUint8Array(MARKET_NOTIFICATIONS_VAPID_PUBLIC_KEY)
    });

    currentDeviceSubscription = subscription;
    await upsertCurrentSubscription(subscription);
    setDeviceStatus('Notificações ativadas com sucesso neste dispositivo.', 'is-ok');
  } catch (error) {
    console.error('Erro ao ativar notificações push:', error);
    setDeviceStatus('Não foi possível ativar as notificações neste dispositivo.', 'is-error');
  } finally {
    await syncDeviceState();
  }
}

async function disableNotificationsForDevice() {
  if (!currentDeviceSubscription) {
    await syncDeviceState();
    return;
  }

  disableDeviceButton.disabled = true;
  setDeviceStatus('A desligar notificações deste dispositivo...', 'is-warn');

  try {
    await currentDeviceSubscription.unsubscribe();
    await removeCurrentSubscription(currentDeviceSubscription);
    currentDeviceSubscription = null;
    setDeviceStatus('Notificações desligadas neste dispositivo.', 'is-ok');
  } catch (error) {
    console.error('Erro ao desligar notificações push:', error);
    setDeviceStatus('Não foi possível desligar as notificações deste dispositivo.', 'is-error');
  } finally {
    await syncDeviceState();
  }
}

function openNotificationsPopup() {
  if (!popup) {
    return;
  }

  popup.style.display = 'flex';
}

function closeNotificationsPopup() {
  if (!popup) {
    return;
  }

  popup.style.display = 'none';
}

function bindEvents() {
  if (areEventsBound) {
    return;
  }

  closePopupButton?.addEventListener('click', closeNotificationsPopup);
  popup?.addEventListener('click', (event) => {
    if (event.target === popup) {
      closeNotificationsPopup();
    }
  });

  enableDeviceButton?.addEventListener('click', enableNotificationsForDevice);
  disableDeviceButton?.addEventListener('click', disableNotificationsForDevice);

  window.addEventListener(NOTIFICATION_OPEN_EVENT, openNotificationsPopup);
  areEventsBound = true;
}

function cleanupListeners() {
  if (typeof userSettingsUnsubscribe === 'function') {
    userSettingsUnsubscribe();
    userSettingsUnsubscribe = null;
  }

  if (typeof globalConfigUnsubscribe === 'function') {
    globalConfigUnsubscribe();
    globalConfigUnsubscribe = null;
  }
}

export async function initProfileNotifications(user) {
  bindEvents();
  cleanupListeners();

  activeUserId = user?.uid || null;

  if (!activeUserId) {
    currentSettings = { ...MARKET_NOTIFICATIONS_DEFAULTS };
    return;
  }

  const userRef = doc(db, 'users', activeUserId);
  const globalRef = doc(db, ...GLOBAL_CONFIG_PATH);

  userSettingsUnsubscribe = onSnapshot(userRef, async (snapshot) => {
    currentSettings = normalizeUserSettings(snapshot.data()?.[USER_SETTINGS_FIELD]);
    await syncDeviceState();
  }, (error) => {
    console.error('Erro ao ler as definições de notificações:', error);
    setDeviceStatus('Não foi possível ler o estado das notificações.', 'is-error');
  });

  globalConfigUnsubscribe = onSnapshot(globalRef, (snapshot) => {
    currentGlobalConfig = snapshot.exists()
      ? snapshot.data()
      : {
          beforeOpenEnabled: true,
          beforeOpenHours: 2,
          onOpenEnabled: true,
          onCloseEnabled: true
        };

    refreshGlobalTexts();
  });
}

export function closeProfileNotificationsPopup() {
  closeNotificationsPopup();
}
