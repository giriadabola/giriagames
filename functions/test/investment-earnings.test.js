const {test} = require('node:test');
const assert = require('node:assert/strict');
const {buildInvestmentEarningsFunctions, calculateInvestmentReturn, parseFootyStatsMatches,
    configuredFootyStatsId, fetchTrustedMatches} = require('../investment-earnings');

const row = (date, badge = 'W', score = '2-1', rival = 'Rival') =>
    `<li><span class="date">${date}</span><a>${score} vs ${rival}</a><span class="result">${badge}</span></li>`;
const html = (...rows) => `<div id="matches"><ul class="matches">${rows.join('')}</ul></div>`;

function fixture() {
    const season = '2026/2027';
    const records = new Map(Object.entries({
        'users/u': {aceite: 'Yes', arena: 'Arena 5', investimentos: [{clubeId: 'forged', timestamp: 0}],
            [season]: {'mini-gcoins': 10, investimentosgCoins: 2, GCoins: 40},
            '2025/2026': {'mini-gcoins': 99}},
        'clubes/c': {investimentoembed: '123', investimentos: [{arena: 'Arena 4', status: true}]},
        'clubes/d': {investimentoembed: '456', investimentos: [{arena: 'Arena 5', status: true}]},
        'settings/investimentos': {porpessoa: 1},
        'paineis/paineis arena': {},
    }));
    let time = Date.parse('2026-09-01T12:00:00Z');
    let response = html(row('September 2, 2026'), row('September 3, 2026', 'L', '0-1'));
    let offline = false;
    const fetched = [];
    const snapshot = (ref, source = records) => ({id: ref.id, exists: source.has(ref.path), data: () => structuredClone(source.get(ref.path))});
    const collection = path => ({path, doc: id => ({path: `${path}/${id}`, id,
        get: async function () { return snapshot(this); }, collection: name => collection(`${path}/${id}/${name}`)})});
    let queue = Promise.resolve();
    const db = {collection, runTransaction: handler => {
        const result = queue.then(async () => {
            const working = structuredClone(records);
            let wrote = false;
            const tx = {
                get: async ref => {
                    assert.equal(wrote, false, 'reads must precede writes');
                    if (ref.id) return snapshot(ref, working);
                    return {docs: [...working.keys()].filter(k => k.startsWith(ref.path + '/') && k.split('/').length === 2)
                        .map(k => snapshot({path: k, id: k.split('/')[1]}, working))};
                },
                getAll: async (...refs) => Promise.all(refs.map(ref => tx.get(ref))),
                create: (ref, value) => { wrote = true; assert.equal(working.has(ref.path), false); working.set(ref.path, structuredClone(value)); },
                set: (ref, value, options) => {
                    wrote = true;
                    const previous = working.get(ref.path) || {};
                    const merged = options?.merge ? {...previous} : {};
                    for (const [key, item] of Object.entries(value)) merged[key] = options?.merge && item && typeof item === 'object' && !Array.isArray(item)
                        ? {...previous[key], ...item} : item;
                    working.set(ref.path, structuredClone(merged));
                },
                update: (ref, field, value) => {
                    wrote = true;
                    const previous = working.get(ref.path);
                    if (field.parts) previous[field.parts[0]][field.parts[1]] = value;
                    else Object.assign(previous, structuredClone(field));
                },
            };
            const result = await handler(tx);
            records.clear();
            for (const [key, value] of working) records.set(key, value);
            return result;
        });
        queue = result.catch(() => {});
        return result;
    }};
    const admin = {firestore: {FieldPath: class {constructor(...parts) { this.parts = parts; }},
        FieldValue: {serverTimestamp: () => 'server-time'}}};
    const functions = buildInvestmentEarningsFunctions({admin, db, getLatestSeason: async () => season, now: () => time,
        fetchImpl: async (url, options) => {
            fetched.push({url, options});
            if (offline) throw new Error('offline');
            return {ok: true, text: async () => response};
        }});
    let counter = 0;
    return {records, season, fetched, functions,
        call: (name, data = {}) => functions[name].run({auth: {uid: 'u'}, data: {operationId: `op-${++counter}`, ...data}}),
        setTime: value => { time = Date.parse(value); },
        setHtml: value => { response = value; },
        setOffline: () => { offline = true; }};
}

test('preserves arena returns and draws', () => {
    assert.deepEqual([4, 5].map(a => ['W', 'L', 'D'].map(b => calculateInvestmentReturn(a, b))), [[4, -3, 0], [7, -4, 0]]);
});
test('server parser rejects challenge pages and ambiguous dates', () => {
    assert.throws(() => parseFootyStatsMatches('Just a moment'), {code: 'unavailable'});
    assert.throws(() => parseFootyStatsMatches(html(row('September 2'))), {code: 'unavailable'});
    assert.throws(() => parseFootyStatsMatches(html(row('invalid 2026'))), {code: 'unavailable'});
    assert.equal(parseFootyStatsMatches(html(row('September 2, 2026')))[0].timestamp, Date.parse('2026-09-02T00:00:00Z'));
    assert.equal(parseFootyStatsMatches(html(row('September 2, 2026'), row('September 2, 2026'))).length, 1);
});
test('configuration supplies only a numeric ID; server fixes host and rejects redirects', async () => {
    assert.equal(configuredFootyStatsId({investimentoembed: '<iframe src="https://footystats.org/api/club?id=123"></iframe>'}), '123');
    assert.throws(() => configuredFootyStatsId({investimentoembed: 'https://evil.test/'}));
    await assert.rejects(fetchTrustedMatches({investimentoembed: '123'}, async (url, options) => {
        assert.equal(url, 'https://footystats.org/api/club?id=123');
        assert.equal(options.redirect, 'error');
        return {ok: false};
    }), {code: 'unavailable'});
});
test('ignores forged client history; selection uses server date and enforces limit', async () => {
    const f = fixture();
    await assert.rejects(f.call('settleInvestmentEarnings', {matches: [{valorreal: 9999}]}), {code: 'failed-precondition'});
    await f.call('selectInvestment', {clubeId: 'c', timestamp: 0, arena: 5});
    const selected = f.records.get('users/u').investimentos[0];
    assert.equal(selected.timestamp, Date.parse('2026-09-01T12:00:00Z'));
    await assert.rejects(f.call('selectInvestment', {clubeId: 'd', limitPorPessoa: 99}), {code: 'resource-exhausted'});
});
test('atomic deterministic settlement, concurrent duplicate calls and season isolation', async () => {
    const f = fixture();
    await f.call('selectInvestment', {clubeId: 'c'});
    f.records.set('investimentos/forged', {userId: 'u', historico: [{valorreal: 99999}]});
    f.setTime('2026-09-04T00:00:00Z');
    const results = await Promise.all([f.call('settleInvestmentEarnings', {historico: [{valorreal: 99999}]}), f.call('settleInvestmentEarnings')]);
    assert.equal(results.reduce((n, r) => n + r.delta, 0), 1);
    const user = f.records.get('users/u');
    assert.equal(user[f.season]['mini-gcoins'], 11);
    assert.equal(user[f.season].investimentosgCoins, 3);
    assert.equal(user[f.season].GCoins, 40);
    assert.equal(user['2025/2026']['mini-gcoins'], 99);
    assert.equal([...f.records.keys()].filter(k => k.startsWith('movimentos/')).length, 2);
    assert.equal((await f.call('settleInvestmentEarnings')).delta, 0);
});
test('unavailable provider leaves balances and movements untouched', async () => {
    const f = fixture();
    await f.call('selectInvestment', {clubeId: 'c'});
    const before = structuredClone(f.records);
    f.setOffline();
    await assert.rejects(f.call('settleInvestmentEarnings'), {code: 'unavailable'});
    assert.deepEqual(f.records, before);
});
test('reselection cannot reopen past windows; removal retry cannot remove a new selection', async () => {
    const f = fixture();
    await f.call('selectInvestment', {clubeId: 'c'});
    f.setTime('2026-09-02T12:00:00Z');
    await f.call('removeInvestment', {clubeId: 'c', operationId: 'remove-once'});
    f.setTime('2026-09-04T12:00:00Z');
    await f.call('selectInvestment', {clubeId: 'c'});
    await f.call('removeInvestment', {clubeId: 'c', operationId: 'remove-once'});
    assert.equal(f.records.get('users/u').investimentos.length, 1);
    assert.equal((await f.call('settleInvestmentEarnings')).delta, 4);
});
test('authentication and server arena constraints are required', async () => {
    const f = fixture();
    await assert.rejects(f.functions.selectInvestment.run({data: {clubeId: 'c'}}), {code: 'unauthenticated'});
    f.records.get('users/u').arena = 'Arena 1';
    await assert.rejects(f.call('selectInvestment', {clubeId: 'c', arena: 5}), {code: 'failed-precondition'});
});

test('utilizador sem investimentos não recebe erro nem movimentos ao sincronizar', async () => {
    const f = fixture();
    f.records.get('users/u').investimentos = [];
    const result = await f.call('settleInvestmentEarnings');
    assert.equal(result.delta, 0);
    assert.equal(f.fetched.length, 0);
    assert.equal([...f.records.keys()].filter(k => k.startsWith('movimentos/')).length, 0);
});
