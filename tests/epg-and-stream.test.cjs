const assert = require('node:assert/strict');
const epg = require('../public/src/services/epgRules.js');
const stream = require('../public/src/core/streamFormat.js');
const { sha256Sync } = require('../public/src/core/sha256.js');

// XMLTV (porta do EpgService.brs)
const now = Date.UTC(2026, 9, 30, 12, 0, 0) / 1000;
assert.equal(epg.xmltvSeconds('20261030120000 +0000'), now);
assert.equal(epg.xmltvSeconds('20261030090000 -0300'), now, 'applies timezone offset');
const xml = `<?xml version="1.0"?><tv>
<programme start="20261030100000 +0000" stop="20261030110000 +0000" channel="a"><title>Passado</title></programme>
<programme start="20261030130000 +0000" stop="20261030140000 +0000" channel="a"><title lang="pt">Depois</title></programme>
<programme start="20261030113000 +0000" stop="20261030130000 +0000" channel="a"><title>Agora &amp; Já</title></programme>
<programme start="20261031120000 +0000" stop="20261031130000 +0000" channel="a"><title>Muito longe</title></programme>
</tv>`;
const entries = epg.parseXmltv(xml, now);
assert.deepEqual(entries.a.map((p) => p.title), ['Agora & Já', 'Depois'], 'drops finished and >8h programmes, sorted by start');
assert.equal(epg.progress(entries.a[0], now), 1 / 3);

// get_short_epg (Xtream)
const short = epg.parseShortEpg({ epg_listings: [
  { title: Buffer.from('Jornal à noite').toString('base64'), start_timestamp: String(now - 600), stop_timestamp: String(now + 600) },
  { title: Buffer.from('Fim').toString('base64'), start_timestamp: String(now - 7200), stop_timestamp: String(now - 3600) }
] }, now);
assert.equal(short.length, 1);
assert.equal(short[0].title, 'Jornal à noite', 'decodes UTF-8 base64 titles');

// Formatos (porta do StreamFormat.brs)
assert.equal(stream.streamFormatForUrl('http://h/live/u/p/1.m3u8?token=x'), 'hls');
assert.equal(stream.streamFormatForUrl('http://h/get.php?output=m3u8'), 'hls');
assert.equal(stream.streamFormatForUrl('http://h/movie/u/p/1.mkv'), 'mkv');
assert.equal(stream.streamFormatForUrl('http://h/live/u/p/1.ts'), 'ts');
assert.equal(stream.hlsAlternative('http://h:8080/live/u/p/1.ts'), 'http://h:8080/live/u/p/1.m3u8');
assert.equal(stream.hlsAlternative('http://h:8080/movie/u/p/1.mp4'), '');

// SHA-256 de fallback (webOS sem crypto.subtle)
assert.equal(sha256Sync('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
assert.equal(sha256Sync('LGUDID-çã'), require('node:crypto').createHash('sha256').update('LGUDID-çã').digest('hex'));

console.log('epg, stream format and sha256: OK');
