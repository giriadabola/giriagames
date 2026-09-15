const test = require("node:test");
const assert = require("node:assert/strict");
const { isDueDuringScheduledDay } = require("../notification-schedule");

const TIME_ZONE = "Europe/Lisbon";
const WEEK_KEY = "2026-09-14";

function isDue(nowIso, targetIso, lastOccurrenceKey = null) {
  return isDueDuringScheduledDay({
    now: new Date(nowIso),
    targetDate: new Date(targetIso),
    lastOccurrenceKey,
    currentOccurrenceKey: WEEK_KEY,
    timeZone: TIME_ZONE,
  });
}

test("dispara à hora marcada em Lisboa", () => {
  assert.equal(isDue("2026-09-15T07:00:00Z", "2026-09-15T07:00:00Z"), true);
});

test("recupera uma falha mais tarde no mesmo dia", () => {
  assert.equal(isDue("2026-09-15T10:10:00Z", "2026-09-15T07:00:00Z"), true);
});

test("não dispara antes da hora marcada", () => {
  assert.equal(isDue("2026-09-15T06:59:00Z", "2026-09-15T07:00:00Z"), false);
});

test("não recupera a ocorrência noutro dia", () => {
  assert.equal(isDue("2026-09-16T07:00:00Z", "2026-09-15T07:00:00Z"), false);
});

test("não repete uma ocorrência já enviada", () => {
  assert.equal(isDue("2026-09-15T10:10:00Z", "2026-09-15T07:00:00Z", WEEK_KEY), false);
});
