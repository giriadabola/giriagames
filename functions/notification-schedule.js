function getZonedDateKey(date, timeZone) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return null;
  }

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date).reduce((result, part) => {
    if (part.type !== "literal") {
      result[part.type] = part.value;
    }
    return result;
  }, {});

  return `${parts.year}-${parts.month}-${parts.day}`;
}

function isDueDuringScheduledDay({
  now,
  targetDate,
  lastOccurrenceKey,
  currentOccurrenceKey,
  timeZone,
}) {
  if (!(now instanceof Date) || !(targetDate instanceof Date)) {
    return false;
  }

  if (Number.isNaN(now.getTime()) || Number.isNaN(targetDate.getTime())) {
    return false;
  }

  return now.getTime() >= targetDate.getTime() &&
    getZonedDateKey(now, timeZone) === getZonedDateKey(targetDate, timeZone) &&
    lastOccurrenceKey !== currentOccurrenceKey;
}

module.exports = {
  getZonedDateKey,
  isDueDuringScheduledDay,
};
