const test = require("node:test");
const assert = require("node:assert/strict");
const {isDueWithinRetryWindow} = require("../notification-schedule");

const WEEK_KEY = "2026-09-14";
const RETRY_WINDOW_MS = 15 * 60 * 1000;

function isDue(nowIso, targetIso, lastOccurrenceKey = null) {
  return isDueWithinRetryWindow({
    now: new Date(nowIso),
    targetDate: new Date(targetIso),
    retryWindowMs: RETRY_WINDOW_MS,
    lastOccurrenceKey,
    currentOccurrenceKey: WEEK_KEY,
  });
}

test("dispara à hora marcada em Lisboa", () => {
  assert.equal(isDue("2026-09-15T07:00:00Z", "2026-09-15T07:00:00Z"), true);
});

test("volta a tentar durante os quinze minutos seguintes", () => {
  assert.equal(isDue("2026-09-15T07:03:00Z", "2026-09-15T07:00:00Z"), true);
});

test("não dispara antes da hora marcada", () => {
  assert.equal(isDue("2026-09-15T06:59:00Z", "2026-09-15T07:00:00Z"), false);
});

test("não envia muito depois da hora marcada", () => {
  assert.equal(isDue("2026-09-15T07:16:00Z", "2026-09-15T07:00:00Z"), false);
});

test("não repete uma ocorrência já enviada", () => {
  assert.equal(isDue("2026-09-15T07:03:00Z", "2026-09-15T07:00:00Z", WEEK_KEY), false);
});
