// 1.1.0 (paridade Android 2.17.21): catch-up, formato do ao vivo,
// proteção adulta automática e categorias visíveis.
const assert = require('node:assert/strict');
process.env.TZ = 'America/Sao_Paulo';
const store = {};
global.window = global;
global.EP = {
  lower: (s) => String(s || '').toLowerCase(),
  Registry: {
    read: (k) => (k in store ? store[k] : null),
    write: (k, v) => { store[k] = String(v); return true; },
    remove: (k) => { delete store[k]; },
    readJson: (k, f) => { try { return k in store ? JSON.parse(store[k]) : f; } catch (_) { return f; } },
    writeJson: (k, v) => { store[k] = JSON.stringify(v); return true; }
  }
};
EP.Sha256 = require('../public/src/core/sha256.js');
require('../public/src/core/parentalPolicy.js');
require('../public/src/core/listPrefs.js');
const catchup = require('../public/src/services/catchupRules.js');
const { Parental: P, LiveFormat: LF, CategoryVisibility: CV, ListScope } = EP;

// ---- catch-up: três formatos na ordem do Android, horário local ----
const start = Date.UTC(2026, 10, 4, 17, 0, 0); // 14:00 em São Paulo
const urls = catchup.catchupUrls({ host: 'http://h.test:8080/', username: 'u s', password: 'p' }, 77, { start, stop: start + 90 * 60000 });
assert.equal(urls.length, 3);
assert.equal(urls[0], 'http://h.test:8080/timeshift/u%20s/p/90/' + start / 1000 + '/77.m3u8');
assert.equal(urls[1], 'http://h.test:8080/timeshift/u%20s/p/90/2026-11-04:14-00/77.ts');
assert.equal(urls[2], 'http://h.test:8080/streaming/timeshift.php?username=u%20s&password=p&stream=77&start=2026-11-04%3A14-00&duration=90');
assert.deepEqual(catchup.catchupUrls(null, 1, { start, stop: start + 1 }), []);
const now = start + 5 * 3600000;
const b64 = (s) => Buffer.from(s).toString('base64');
const listed = catchup.archiveProgrammes({ epg_listings: [
  { title: b64('Jornal'), start_timestamp: start / 1000, stop_timestamp: start / 1000 + 3600, has_archive: 1 },
  { title: b64('Futuro'), start_timestamp: now / 1000 + 60, stop_timestamp: now / 1000 + 3600, has_archive: 0 },
  { title: b64('Sem arquivo'), start_timestamp: start / 1000 + 3600, stop_timestamp: start / 1000 + 7200, has_archive: 0 },
  { title: b64('Novela'), start_timestamp: start / 1000 + 7200, stop_timestamp: start / 1000 + 9000, has_archive: '1' },
  { title: b64('Antigo'), start_timestamp: start / 1000 - 9 * 86400, stop_timestamp: start / 1000 - 9 * 86400 + 600, has_archive: 1 }
] }, 7, now);
assert.deepEqual(listed.map((p) => p.title), ['Novela', 'Jornal'], 'only finished, archived, within days, newest first');

// ---- formato do ao vivo por lista ----
ListScope.set(ListScope.idFor({ sourceType: 'xtream', credentials: { host: 'http://h.test/', username: 'u' } }));
assert.equal(ListScope.id().length, 16);
assert.ok(!/h\.test|u$/.test(ListScope.id()), 'scope is a hash');
const live = 'http://h.test/live/u/p/9.m3u8';
assert.equal(LF.mode(), 'auto');
assert.equal(LF.apply(live), live, 'nothing remembered yet');
LF.remember('ts');
assert.equal(LF.apply(live), 'http://h.test/live/u/p/9.ts', 'starts with remembered TS');
assert.equal(LF.alternative('http://h.test/live/u/p/9.ts'), live);
assert.equal(LF.apply('http://h.test/movie/u/p/9.mp4'), 'http://h.test/movie/u/p/9.mp4', 'only live URLs');
LF.setMode('hls');
assert.equal(LF.apply('http://h.test/live/u/p/9.ts'), live, 'manual choice wins');
LF.remember('ts');
assert.equal(LF.remembered(), 'ts', 'manual mode does not overwrite memory');
LF.setMode('auto');
ListScope.set('other-list');
assert.equal(LF.remembered(), '', 'separate per list');

// ---- proteção adulta automática ----
assert.ok(P.isAdultName('Adultos +18') && P.isAdultName('XXX') && P.isAdultName('Canais Eróticos'));
assert.ok(!P.isAdultName('Esportes') && !P.isAdultName('Adultério') && !P.isAdultName('Sussex'));
assert.equal(P.adultProtection(), true, 'on by default');
assert.equal(P.isCategoryLocked('Adultos'), true);
assert.equal(P.toggleCategory('Adultos'), false, 'releasing an automatic category');
assert.ok(P.categoryLocks().includes('!Adultos'), 'exception saved');
assert.equal(P.isCategoryLocked('Adultos'), false);
assert.equal(P.toggleCategory('Adultos'), true, 'back to the rule');
assert.equal(P.isCategoryLocked('Adultos'), true);
P.toggleCategory('Notícias');
assert.equal(P.protectedCount(['Adultos', 'Notícias', 'Esportes']), 2, 'count includes automatic');
P.setAdultProtection(false);
assert.equal(P.isCategoryLocked('Adultos'), false);
P.setAdultProtection(true);

// ---- categorias visíveis ----
ListScope.set('list-a');
assert.equal(CV.toggle('movies', '20'), true);
assert.equal(CV.isHidden('movies', '20'), true);
assert.equal(CV.isHidden('live', '20'), false, 'per kind');
assert.deepEqual(CV.filterCategories('movies', [{ id: '20', name: 'Ação' }, { id: '21', name: 'Drama' }]).map((c) => c.id), ['21']);
assert.deepEqual(CV.hiddenNames('movies', [{ id: '20', name: 'Ação' }]), { 'Ação': true });
ListScope.set('list-b');
assert.equal(CV.isHidden('movies', '20'), false, 'per list');
ListScope.set('list-a');
CV.toggle('movies', '20');
assert.equal(CV.hiddenCount(), 0);
assert.ok(JSON.parse(store.hiddenCategories)['list-a'], 'stored as {serverId: {kind: [ids]}}');

console.log('1.1.0 features: OK');
