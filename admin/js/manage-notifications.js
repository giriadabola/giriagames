import { auth, db } from './auth-guard.js';
import { collection, doc, onSnapshot, serverTimestamp, setDoc } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { sendManualMarketNotification } from './manual-market-notification-service.js';

const CONFIG_DOC_PATH = ['paineis', 'notificacoesMercado'];
const USER_SETTINGS_FIELD = 'notificacoesMercado';

const beforeOpenEnabledInput = document.getElementById('beforeOpenEnabled');
const beforeOpenHoursInput = document.getElementById('beforeOpenHours');
const onOpenEnabledInput = document.getElementById('onOpenEnabled');
const onCloseEnabledInput = document.getElementById('onCloseEnabled');
const predictionsOpenEnabledInput = document.getElementById('predictionsOpenEnabled');
const predictionsOpenWeekdayInput = document.getElementById('predictionsOpenWeekday');
const predictionsOpenTimeInput = document.getElementById('predictionsOpenTime');
const predictionsCloseEnabledInput = document.getElementById('predictionsCloseEnabled');
const predictionsCloseWeekdayInput = document.getElementById('predictionsCloseWeekday');
const predictionsCloseTimeInput = document.getElementById('predictionsCloseTime');
const predictionsClosingSoonEnabledInput = document.getElementById('predictionsClosingSoonEnabled');
const predictionsClosingSoonWeekdayInput = document.getElementById('predictionsClosingSoonWeekday');
const predictionsClosingSoonTimeInput = document.getElementById('predictionsClosingSoonTime');
const predictionsClosingSoonHoursInput = document.getElementById('predictionsClosingSoonHours');
const saveButton = document.getElementById('saveNotificationSettingsBtn');
const statusText = document.getElementById('notificationSettingsStatus');
const manualMessageInput = document.getElementById('manualNotificationMessage');
const manualCounter = document.getElementById('manualNotificationCounter');
const manualSendButton = document.getElementById('sendManualNotificationBtn');
const manualStatusText = document.getElementById('manualNotificationStatus');
const searchInput = document.getElementById('usersNotificationsSearch');
const tableBody = document.getElementById('usersNotificationsBody');

const totalUsersValue = document.getElementById('summaryTotalUsers');
const pushReadyValue = document.getElementById('summaryPushReady');
const beforeOpenValue = document.getElementById('summaryBeforeOpen');
const onOpenValue = document.getElementById('summaryOnOpen');
const onCloseValue = document.getElementById('summaryOnClose');

let latestUsers = [];

function getDefaultConfig() {
  return {
    beforeOpenEnabled: true,
    beforeOpenHours: 2,
    onOpenEnabled: true,
    onCloseEnabled: true,
    predictionsOpenEnabled: false,
    predictionsOpenWeekday: 5,
    predictionsOpenTime: '09:00',
    predictionsCloseEnabled: false,
    predictionsCloseWeekday: 6,
    predictionsCloseTime: '20:00',
    predictionsClosingSoonEnabled: false,
    predictionsClosingSoonWeekday: 6,
    predictionsClosingSoonTime: '20:00',
    predictionsClosingSoonHours: 2
  };
}

function getUserDisplayName(userData) {
  return userData?.nometabela || userData?.nomeDeUsuario || userData?.nome || userData?.email || 'Utilizador';
}

function normalizeUserSettings(rawSettings) {
  return {
    pushEnabled: rawSettings?.pushEnabled === true,
    pushSubscriptions: Array.isArray(rawSettings?.pushSubscriptions) ? rawSettings.pushSubscriptions : []
  };
}

function setStatus(message, tone = '') {
  statusText.textContent = message;
  statusText.className = 'status-text';

  if (tone) {
    statusText.classList.add(tone);
  }
}

function setManualStatus(message, tone = '') {
  manualStatusText.textContent = message;
  manualStatusText.className = 'status-text';

  if (tone) {
    manualStatusText.classList.add(tone);
  }
}

function fillConfigForm(config) {
  beforeOpenEnabledInput.checked = config.beforeOpenEnabled;
  beforeOpenHoursInput.value = String(config.beforeOpenHours);
  onOpenEnabledInput.checked = config.onOpenEnabled;
  onCloseEnabledInput.checked = config.onCloseEnabled;
  predictionsOpenEnabledInput.checked = config.predictionsOpenEnabled;
  predictionsOpenWeekdayInput.value = String(config.predictionsOpenWeekday);
  predictionsOpenTimeInput.value = config.predictionsOpenTime;
  predictionsCloseEnabledInput.checked = config.predictionsCloseEnabled;
  predictionsCloseWeekdayInput.value = String(config.predictionsCloseWeekday);
  predictionsCloseTimeInput.value = config.predictionsCloseTime;
  predictionsClosingSoonEnabledInput.checked = config.predictionsClosingSoonEnabled;
  predictionsClosingSoonWeekdayInput.value = String(config.predictionsClosingSoonWeekday);
  predictionsClosingSoonTimeInput.value = config.predictionsClosingSoonTime;
  predictionsClosingSoonHoursInput.value = String(config.predictionsClosingSoonHours);
}

function renderSummary(users) {
  const pushSummary = users.reduce((acc, user) => {
    const settings = normalizeUserSettings(user[USER_SETTINGS_FIELD]);

    acc.total += 1;
    if (settings.pushEnabled && settings.pushSubscriptions.length > 0) {
      acc.pushReady += 1;
    }

    return acc;
  }, {
    total: 0,
    pushReady: 0
  });

  totalUsersValue.textContent = pushSummary.total;
  pushReadyValue.textContent = pushSummary.pushReady;
  beforeOpenValue.textContent = Math.max(0, pushSummary.total - pushSummary.pushReady);
  onOpenValue.textContent = beforeOpenEnabledInput.checked
    ? `${beforeOpenHoursInput.value}h`
    : 'Off';
  const activeRules = [
    onOpenEnabledInput.checked,
    onCloseEnabledInput.checked,
    predictionsOpenEnabledInput.checked,
    predictionsCloseEnabledInput.checked,
    predictionsClosingSoonEnabledInput.checked
  ].filter(Boolean).length;
  onCloseValue.textContent = `${activeRules}/5 On`;
}

function isValidWeekday(value) {
  return Number.isInteger(value) && value >= 0 && value <= 6;
}

function isValidTime(value) {
  return typeof value === 'string' && /^\d{2}:\d{2}$/.test(value);
}

function isValidHoursBefore(value) {
  return Number.isInteger(value) && value > 0 && value <= 48;
}

function renderUsersTable() {
  const searchTerm = searchInput.value.trim().toLowerCase();
  const filteredUsers = latestUsers.filter((user) => {
    const displayName = getUserDisplayName(user).toLowerCase();
    const email = (user.email || '').toLowerCase();
    return !searchTerm || displayName.includes(searchTerm) || email.includes(searchTerm);
  });

  if (filteredUsers.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="4" class="table-muted">Nenhum utilizador encontrado para este filtro.</td>
      </tr>
    `;
    return;
  }

  tableBody.innerHTML = filteredUsers
    .sort((left, right) => getUserDisplayName(left).localeCompare(getUserDisplayName(right), 'pt'))
    .map((user) => {
      const settings = normalizeUserSettings(user[USER_SETTINGS_FIELD]);
      const pushReady = settings.pushEnabled && settings.pushSubscriptions.length > 0;

      return `
        <tr>
          <td>${getUserDisplayName(user)}</td>
          <td class="table-muted">${user.email || 'Sem email'}</td>
          <td><span class="table-badge ${pushReady ? 'is-on' : 'is-off'}">${pushReady ? 'Ligado' : 'Desligado'}</span></td>
          <td class="table-muted">${settings.pushSubscriptions.length}</td>
        </tr>
      `;
    })
    .join('');
}

async function saveSettings() {
  const nextConfig = {
    beforeOpenEnabled: beforeOpenEnabledInput.checked,
    beforeOpenHours: Number.parseInt(beforeOpenHoursInput.value, 10),
    onOpenEnabled: onOpenEnabledInput.checked,
    onCloseEnabled: onCloseEnabledInput.checked,
    predictionsOpenEnabled: predictionsOpenEnabledInput.checked,
    predictionsOpenWeekday: Number.parseInt(predictionsOpenWeekdayInput.value, 10),
    predictionsOpenTime: predictionsOpenTimeInput.value,
    predictionsCloseEnabled: predictionsCloseEnabledInput.checked,
    predictionsCloseWeekday: Number.parseInt(predictionsCloseWeekdayInput.value, 10),
    predictionsCloseTime: predictionsCloseTimeInput.value,
    predictionsClosingSoonEnabled: predictionsClosingSoonEnabledInput.checked,
    predictionsClosingSoonWeekday: Number.parseInt(predictionsClosingSoonWeekdayInput.value, 10),
    predictionsClosingSoonTime: predictionsClosingSoonTimeInput.value,
    predictionsClosingSoonHours: Number.parseInt(predictionsClosingSoonHoursInput.value, 10),
    updatedAt: serverTimestamp(),
    updatedBy: auth.currentUser?.uid || null
  };

  if (!Number.isInteger(nextConfig.beforeOpenHours) || nextConfig.beforeOpenHours < 0 || nextConfig.beforeOpenHours > 10) {
    setStatus('Escolhe um valor válido entre 0 e 10 horas.', 'is-error');
    return;
  }

  if (!isValidWeekday(nextConfig.predictionsOpenWeekday) || !isValidWeekday(nextConfig.predictionsCloseWeekday) || !isValidWeekday(nextConfig.predictionsClosingSoonWeekday)) {
    setStatus('Escolhe um dia da semana válido para os avisos de prognósticos.', 'is-error');
    return;
  }

  if (!isValidTime(nextConfig.predictionsOpenTime) || !isValidTime(nextConfig.predictionsCloseTime) || !isValidTime(nextConfig.predictionsClosingSoonTime)) {
    setStatus('Escolhe uma hora válida no formato HH:MM.', 'is-error');
    return;
  }

  if (!isValidHoursBefore(nextConfig.predictionsClosingSoonHours)) {
    setStatus('Escolhe um valor vÃ¡lido de horas antes do fecho.', 'is-error');
    return;
  }

  saveButton.disabled = true;
  setStatus('A guardar configuração global...', 'is-warn');

  try {
    await setDoc(doc(db, ...CONFIG_DOC_PATH), nextConfig, { merge: true });
    setStatus('Configuração global guardada com sucesso.', 'is-ok');
  } catch (error) {
    console.error('Erro ao guardar notificações globais:', error);
    setStatus('Não foi possível guardar agora.', 'is-error');
  } finally {
    saveButton.disabled = false;
  }
}

function updateManualCounter() {
  const length = manualMessageInput.value.length;
  manualCounter.textContent = `${length} / 180`;
}

async function handleManualNotificationSend() {
  const message = manualMessageInput.value.trim();

  if (!message) {
    setManualStatus('Escreve uma mensagem antes de enviar.', 'is-error');
    return;
  }

  manualSendButton.disabled = true;
  setManualStatus('A enviar notificação manual...', 'is-warn');

  try {
    const result = await sendManualMarketNotification(message);
    const deliveredTo = Number(result?.deliveredTo || 0);

    if (deliveredTo > 0) {
      manualMessageInput.value = '';
      updateManualCounter();
    }

    setManualStatus(
      deliveredTo > 0
        ? `Notificação enviada para ${deliveredTo} dispositivo(s) ativo(s).`
        : 'Não há dispositivos ativos para receber esta notificação.',
      'is-ok'
    );
  } catch (error) {
    console.error('Erro ao enviar notificação manual:', error);
    setManualStatus(error?.message || 'Não foi possível enviar agora.', 'is-error');
  } finally {
    manualSendButton.disabled = false;
  }
}

function startRealtimeListeners() {
  onSnapshot(doc(db, ...CONFIG_DOC_PATH), (snapshot) => {
    fillConfigForm(snapshot.exists() ? { ...getDefaultConfig(), ...snapshot.data() } : getDefaultConfig());
    renderSummary(latestUsers);
  });

  onSnapshot(collection(db, 'users'), (snapshot) => {
    latestUsers = snapshot.docs.map((userDoc) => ({
      id: userDoc.id,
      ...userDoc.data()
    }));

    renderSummary(latestUsers);
    renderUsersTable();
  }, (error) => {
    console.error('Erro ao ler utilizadores para notificações:', error);
    setStatus('Erro ao carregar a lista de utilizadores.', 'is-error');
  });
}

saveButton.addEventListener('click', saveSettings);
manualMessageInput.addEventListener('input', updateManualCounter);
manualSendButton.addEventListener('click', handleManualNotificationSend);
searchInput.addEventListener('input', renderUsersTable);

updateManualCounter();
startRealtimeListeners();
