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

const beforeOpenScheduleContainer = document.getElementById('beforeOpenScheduleContainer');
const beforeOpenScheduleText = document.getElementById('beforeOpenScheduleText');
const onOpenScheduleContainer = document.getElementById('onOpenScheduleContainer');
const onOpenScheduleText = document.getElementById('onOpenScheduleText');
const onCloseScheduleContainer = document.getElementById('onCloseScheduleContainer');
const onCloseScheduleText = document.getElementById('onCloseScheduleText');
const predictionsOpenScheduleContainer = document.getElementById('predictionsOpenScheduleContainer');
const predictionsOpenScheduleText = document.getElementById('predictionsOpenScheduleText');
const predictionsCloseScheduleContainer = document.getElementById('predictionsCloseScheduleContainer');
const predictionsCloseScheduleText = document.getElementById('predictionsCloseScheduleText');
const predictionsClosingSoonScheduleContainer = document.getElementById('predictionsClosingSoonScheduleContainer');
const predictionsClosingSoonScheduleText = document.getElementById('predictionsClosingSoonScheduleText');

const totalUsersValue = document.getElementById('summaryTotalUsers');
const pushReadyValue = document.getElementById('summaryPushReady');
const beforeOpenValue = document.getElementById('summaryBeforeOpen');
const onOpenValue = document.getElementById('summaryOnOpen');
const onCloseValue = document.getElementById('summaryOnClose');

const WEEKDAYS_PT = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
let latestUsers = [];
let activeMarketSchedule = null;

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

function parseFirestoreDate(value) {
  if (!value) return null;
  if (typeof value.toDate === 'function') return value.toDate();
  if (value instanceof Date) return value;
  if (typeof value === 'number') return new Date(value);
  if (typeof value === 'string') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (typeof value.seconds === 'number') {
    return new Date(value.seconds * 1000);
  }
  return null;
}

function getClosingSoonSchedule(weekdayVal, timeStr, hoursBeforeVal) {
  const weekday = Number.parseInt(weekdayVal, 10);
  const hoursBefore = Number.parseInt(hoursBeforeVal, 10);

  if (!isValidWeekday(weekday) || !isValidTime(timeStr) || !isValidHoursBefore(hoursBefore)) {
    return '--';
  }

  const [hours, minutes] = timeStr.split(':').map((v) => Number.parseInt(v, 10));
  const anchor = new Date(2026, 0, 4 + weekday, hours, minutes, 0, 0);
  anchor.setHours(anchor.getHours() - hoursBefore);

  const dayName = WEEKDAYS_PT[anchor.getDay()];
  const formattedHours = String(anchor.getHours()).padStart(2, '0');
  const formattedMinutes = String(anchor.getMinutes()).padStart(2, '0');

  return `${dayName} às ${formattedHours}:${formattedMinutes}`;
}

function renderScheduleDisplays() {
  const updateCardContainer = (container, textEl, textValue, isEnabled) => {
    if (!container || !textEl) return;
    textEl.textContent = isEnabled ? textValue : `${textValue} (Desativado)`;
    container.classList.toggle('is-disabled', !isEnabled);
  };

  const beforeHours = Number.parseInt(beforeOpenHoursInput.value, 10) || 0;
  let beforeText = '';
  if (activeMarketSchedule && activeMarketSchedule.aberturaDate) {
    const launchDate = new Date(activeMarketSchedule.aberturaDate.getTime() - (beforeHours * 3600000));
    const dayName = WEEKDAYS_PT[launchDate.getDay()];
    const dateStr = launchDate.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' });
    const timeStr = launchDate.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
    beforeText = `${dayName} (${dateStr}) às ${timeStr}`;
  } else {
    beforeText = `Sem mercado agendado (${beforeHours}h antes da abertura)`;
  }
  updateCardContainer(beforeOpenScheduleContainer, beforeOpenScheduleText, beforeText, beforeOpenEnabledInput.checked);

  let onOpenText = '';
  if (activeMarketSchedule && activeMarketSchedule.aberturaDate) {
    const launchDate = activeMarketSchedule.aberturaDate;
    const dayName = WEEKDAYS_PT[launchDate.getDay()];
    const dateStr = launchDate.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' });
    const timeStr = launchDate.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
    onOpenText = `${dayName} (${dateStr}) às ${timeStr}`;
  } else {
    onOpenText = 'Sem mercado agendado (na abertura)';
  }
  updateCardContainer(onOpenScheduleContainer, onOpenScheduleText, onOpenText, onOpenEnabledInput.checked);

  let onCloseText = '';
  if (activeMarketSchedule && activeMarketSchedule.fechamentoDate) {
    const launchDate = activeMarketSchedule.fechamentoDate;
    const dayName = WEEKDAYS_PT[launchDate.getDay()];
    const dateStr = launchDate.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' });
    const timeStr = launchDate.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
    onCloseText = `${dayName} (${dateStr}) às ${timeStr}`;
  } else {
    onCloseText = 'Sem mercado agendado (no fecho)';
  }
  updateCardContainer(onCloseScheduleContainer, onCloseScheduleText, onCloseText, onCloseEnabledInput.checked);

  const openWk = Number.parseInt(predictionsOpenWeekdayInput.value, 10);
  const openTime = predictionsOpenTimeInput.value;
  const openText = (isValidWeekday(openWk) && isValidTime(openTime))
    ? `${WEEKDAYS_PT[openWk]} às ${openTime}`
    : '--';
  updateCardContainer(predictionsOpenScheduleContainer, predictionsOpenScheduleText, openText, predictionsOpenEnabledInput.checked);

  const closeWk = Number.parseInt(predictionsCloseWeekdayInput.value, 10);
  const closeTime = predictionsCloseTimeInput.value;
  const closeText = (isValidWeekday(closeWk) && isValidTime(closeTime))
    ? `${WEEKDAYS_PT[closeWk]} às ${closeTime}`
    : '--';
  updateCardContainer(predictionsCloseScheduleContainer, predictionsCloseScheduleText, closeText, predictionsCloseEnabledInput.checked);

  const soonWk = predictionsClosingSoonWeekdayInput.value;
  const soonTime = predictionsClosingSoonTimeInput.value;
  const soonHrs = predictionsClosingSoonHoursInput.value;
  const soonText = getClosingSoonSchedule(soonWk, soonTime, soonHrs);
  updateCardContainer(predictionsClosingSoonScheduleContainer, predictionsClosingSoonScheduleText, soonText, predictionsClosingSoonEnabledInput.checked);
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

  renderScheduleDisplays();
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

function parseDeviceInfo(subscription, index) {
  const ua = subscription?.userAgent || '';
  const platform = subscription?.platform || '';
  const standalone = subscription?.standalone === true;

  if (!ua && !platform) {
    return {
      label: `Dispositivo #${index + 1}`,
      icon: 'fas fa-mobile-alt'
    };
  }

  let os = 'Dispositivo';
  let osIcon = 'fas fa-mobile-alt';
  let browser = '';

  if (/iphone|ipad|ipod/i.test(ua) || /iphone|ipad|ipod/i.test(platform)) {
    os = 'iOS';
    osIcon = 'fab fa-apple';
  } else if (/android/i.test(ua)) {
    os = 'Android';
    osIcon = 'fab fa-android';
  } else if (/win/i.test(platform) || /windows/i.test(ua)) {
    os = 'Windows';
    osIcon = 'fab fa-windows';
  } else if (/mac/i.test(platform) || /macintosh|mac os/i.test(ua)) {
    os = 'Mac';
    osIcon = 'fab fa-apple';
  } else if (/linux/i.test(platform) || /linux/i.test(ua)) {
    os = 'Linux';
    osIcon = 'fab fa-linux';
  }

  if (/edg/i.test(ua)) {
    browser = 'Edge';
  } else if (/opr|opera/i.test(ua)) {
    browser = 'Opera';
  } else if (/chrome|crios/i.test(ua)) {
    browser = 'Chrome';
  } else if (/firefox|fxios/i.test(ua)) {
    browser = 'Firefox';
  } else if (/safari/i.test(ua)) {
    browser = 'Safari';
  }

  const appTag = standalone ? ' App' : '';
  const name = browser ? `${browser} em ${os}${appTag}` : `${os}${appTag}`;

  return {
    label: name,
    icon: osIcon
  };
}

function renderDevicesCell(subscriptions) {
  if (!subscriptions || subscriptions.length === 0) {
    return '<span class="table-muted">Nenhum</span>';
  }

  const chipsHtml = subscriptions.map((sub, index) => {
    const info = parseDeviceInfo(sub, index);
    return `<span class="device-chip" title="${sub.updatedAtIso ? 'Atualizado a: ' + new Date(sub.updatedAtIso).toLocaleString('pt-PT') : ''}"><i class="${info.icon}"></i> ${info.label}</span>`;
  }).join('');

  return `<div class="device-chips-list">${chipsHtml}</div>`;
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
          <td>${renderDevicesCell(settings.pushSubscriptions)}</td>
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

  onSnapshot(collection(db, 'paineis', 'Banca', 'horarioMercado'), (snapshot) => {
    const now = new Date();
    const schedules = snapshot.docs.map((docSnap) => {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        ...data,
        aberturaDate: parseFirestoreDate(data.abertura),
        fechamentoDate: parseFirestoreDate(data.fechamento)
      };
    });

    const upcoming = schedules
      .filter((s) => s.fechamentoDate && s.fechamentoDate.getTime() > now.getTime())
      .sort((a, b) => (a.aberturaDate?.getTime() || 0) - (b.aberturaDate?.getTime() || 0));

    activeMarketSchedule = upcoming[0] || null;
    renderScheduleDisplays();
  }, (error) => {
    console.error('Erro ao ler horário de mercado:', error);
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

beforeOpenEnabledInput.addEventListener('change', renderScheduleDisplays);
beforeOpenHoursInput.addEventListener('change', renderScheduleDisplays);
onOpenEnabledInput.addEventListener('change', renderScheduleDisplays);
onCloseEnabledInput.addEventListener('change', renderScheduleDisplays);
predictionsOpenEnabledInput.addEventListener('change', renderScheduleDisplays);
predictionsOpenWeekdayInput.addEventListener('change', renderScheduleDisplays);
predictionsOpenTimeInput.addEventListener('input', renderScheduleDisplays);
predictionsCloseEnabledInput.addEventListener('change', renderScheduleDisplays);
predictionsCloseWeekdayInput.addEventListener('change', renderScheduleDisplays);
predictionsCloseTimeInput.addEventListener('input', renderScheduleDisplays);
predictionsClosingSoonEnabledInput.addEventListener('change', renderScheduleDisplays);
predictionsClosingSoonWeekdayInput.addEventListener('change', renderScheduleDisplays);
predictionsClosingSoonTimeInput.addEventListener('input', renderScheduleDisplays);
predictionsClosingSoonHoursInput.addEventListener('change', renderScheduleDisplays);

updateManualCounter();
startRealtimeListeners();
