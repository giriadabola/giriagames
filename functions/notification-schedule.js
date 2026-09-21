function isDueWithinRetryWindow({
  now,
  targetDate,
  retryWindowMs,
  lastOccurrenceKey,
  currentOccurrenceKey,
}) {
  if (!(now instanceof Date) || !(targetDate instanceof Date)) {
    return false;
  }

  if (Number.isNaN(now.getTime()) ||
    Number.isNaN(targetDate.getTime()) ||
    !Number.isFinite(retryWindowMs) ||
    retryWindowMs < 0) {
    return false;
  }

  const nowMs = now.getTime();
  const targetMs = targetDate.getTime();

  return nowMs >= targetMs &&
    nowMs <= targetMs + retryWindowMs &&
    lastOccurrenceKey !== currentOccurrenceKey;
}

module.exports = {
  isDueWithinRetryWindow,
};
