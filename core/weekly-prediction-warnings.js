export const WEEKDAYS_PT = [
  'Domingo',
  'Segunda-feira',
  'Terça-feira',
  'Quarta-feira',
  'Quinta-feira',
  'Sexta-feira',
  'Sábado'
];

export const DEFAULT_WEEKLY_PREDICTION_WARNINGS = [
  { enabled: false, weekday: 1, time: '09:00' },
  { enabled: false, weekday: 3, time: '09:00' },
  { enabled: false, weekday: 5, time: '09:00' }
];

export const DEFAULT_WEEKLY_PREDICTION_WARNING_PREFERENCES = [true, true, true];

function isValidWeekday(value) {
  return Number.isInteger(value) && value >= 0 && value <= 6;
}

function isValidTime(value) {
  if (typeof value !== 'string' || !/^\d{2}:\d{2}$/.test(value)) return false;

  const [hours, minutes] = value.split(':').map((part) => Number.parseInt(part, 10));
  return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
}

function normalizeBoolean(value, fallback) {
  if (value === true || value === 'true' || value === 1) return true;
  if (value === false || value === 'false' || value === 0) return false;
  return fallback;
}

function normalizeInteger(value, fallback) {
  const parsed = typeof value === 'number' ? value : Number.parseInt(value, 10);
  return Number.isInteger(parsed) ? parsed : fallback;
}

function normalizeTime(value, fallback) {
  return isValidTime(value) ? value : fallback;
}

export function normalizeWeeklyPredictionWarnings(rawWarnings) {
  const source = Array.isArray(rawWarnings) ? rawWarnings : [];

  return DEFAULT_WEEKLY_PREDICTION_WARNINGS.map((fallback, index) => {
    const raw = source[index] || {};

    return {
      enabled: normalizeBoolean(raw.enabled, fallback.enabled),
      weekday: normalizeInteger(raw.weekday, fallback.weekday),
      time: normalizeTime(raw.time, fallback.time)
    };
  });
}

export function normalizeWeeklyPredictionWarningPreferences(rawPreferences) {
  return DEFAULT_WEEKLY_PREDICTION_WARNING_PREFERENCES.map((fallback, index) => (
    typeof rawPreferences?.[index] === 'boolean' ? rawPreferences[index] : fallback
  ));
}

export function formatWeeklyPredictionWarningSchedule(warning) {
  if (!warning || !isValidWeekday(warning.weekday) || !isValidTime(warning.time)) {
    return '--';
  }

  return `${WEEKDAYS_PT[warning.weekday]} às ${warning.time}`;
}
