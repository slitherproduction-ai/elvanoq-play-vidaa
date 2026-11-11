const assert = require('node:assert/strict');
const rules = require('../public/src/services/playlistRules.js');

const m3u = { name: 'Portal M3U', kind: 'm3u', credentials: { url: 'https://provider.example:8443/live.m3u?token=private' }, updated_at: '2026-10-23T12:00:00Z' };
const xtream = { name: 'Portal Xtream', kind: 'xtream', credentials: { host: 'http://provider.example:8080', username: 'user', password: 'secret' } };
const granted = { active: true, license: { can_play: true }, code_access: { can_connect: true } };

assert.equal(rules.normalize(m3u).sourceType, 'm3u');
assert.equal(rules.normalize(m3u).credentials.url, m3u.credentials.url);
assert.equal(rules.normalize(xtream).sourceType, 'xtream');
assert.equal(rules.normalize(xtream).credentials.host, 'http://provider.example:8080', 'preserves configured HTTP and explicit port');
assert.equal(rules.isHttpUrl('https://provider.example:8443/live.m3u'), true);
assert.equal(rules.isHttpUrl('http://provider.example:8080'), true);
assert.equal(rules.isHttpUrl('ftp://provider.example/list.m3u'), false);
assert.equal(rules.allowed(granted), true, 'annual/vitalício/individual are defined by server can_play');
assert.equal(rules.allowed({ active: true, license: { can_play: false } }), false, 'expired/blocked license');
assert.equal(rules.allowed({ active: false, license: { can_play: true } }), false, 'disabled TV');
assert.equal(rules.allowed({ active: true, license: { can_play: true }, code_access: { can_connect: false } }), false, 'restricted code denied');

const local = [{ id: 'manual-1', sourceId: 'manual-1', sourceType: 'm3u', favorites: ['a'], history: ['b'] }];
let merged = rules.merge(local, m3u, 'a'.repeat(64));
assert.equal(merged.items.length, 2, 'keeps local lists');
merged = rules.merge(merged.items, xtream, 'a'.repeat(64));
assert.equal(merged.items.length, 2, 'updates Portal entry without duplication');
assert.equal(merged.items[1].sourceType, 'xtream');
assert.equal(rules.merge(local, null, 'a'.repeat(64)).items.length, 1, 'null playlist never deletes local data');
assert.equal(rules.normalize({ kind: 'm3u', credentials: {} }), null);

// Link de API Xtream cadastrado como M3U vira fonte Xtream (carregada por categoria)
const apiAsM3u = rules.normalize({ name: 'Flix', kind: 'm3u', credentials: { url: 'http://flix.example/player_api.php?username=Admin01&password=s%40nha&action=get_vod_streams' } });
assert.equal(apiAsM3u.sourceType, 'xtream');
assert.deepEqual(apiAsM3u.credentials, { host: 'http://flix.example', username: 'Admin01', password: 's@nha', m3uUrl: 'http://flix.example/player_api.php?username=Admin01&password=s%40nha&action=get_vod_streams' });
const getAsM3u = rules.normalize({ kind: 'm3u', credentials: { url: 'http://flix.example:8080/get.php?username=u&password=p&type=m3u_plus&output=ts' } });
assert.equal(getAsM3u.sourceType, 'xtream');
assert.equal(getAsM3u.credentials.host, 'http://flix.example:8080');
assert.equal(rules.xtreamFromUrl('http://flix.example/sub/player_api.php?username=u&password=p').host, 'http://flix.example/sub');
assert.equal(rules.xtreamFromUrl('https://provider.example:8443/live.m3u?token=private'), null, 'M3U de verdade continua M3U');
assert.equal(rules.xtreamFromUrl('http://flix.example/get.php?username=u'), null, 'sem senha não converte');

// Parser M3U equivalente ao CatalogService.brs do Roku
const parsed = rules.parseM3u([
  '#EXTM3U url-tvg="https://epg.example/guide.xml"',
  '#EXTINF:-1 tvg-id="news.br" tvg-logo="https://img.example/1.png" group-title="Notícias",Canal 1, Edição SP',
  'http://provider.example:8080/live/1.ts',
  '#EXTINF:-1 group-title="Filmes | Ação" rating="8.1",Filme X',
  'http://provider.example:8080/movie/1.mp4',
  '#EXTINF:-1 group-title="Séries Netflix",Série Y S01E01',
  'http://provider.example:8080/series/1.mp4',
  '#EXTINF:-1 group-title="Notícias",Canal sem URL',
  '#EXTVLCOPT:http-user-agent=x'
].join('\n'));
assert.equal(parsed.items.length, 3);
assert.equal(parsed.epgUrl, 'https://epg.example/guide.xml');
assert.equal(parsed.items[0].stream_url, 'http://provider.example:8080/live/1.ts');
assert.equal(parsed.items[0].title, 'Canal 1, Edição SP', 'title keeps commas after attributes');
assert.equal(parsed.items[0].id, 'live:news.br');
assert.equal(parsed.items[0].type, 'live');
assert.equal(parsed.items[1].type, 'movies');
assert.equal(parsed.items[2].type, 'series');
assert.deepEqual(parsed.categories, ['Notícias'], 'only live groups become Live TV categories');

// Xtream
assert.equal(rules.buildXtreamApiUrl('http://provider.example:8080/', 'user', 'secret', 'get_live_streams'), 'http://provider.example:8080/player_api.php?username=user&password=secret&action=get_live_streams');
const live = rules.xtreamLiveStreams('https://provider.example:8443', 'user', 'secret', [{ stream_id: 9, name: 'Canal 9', category_id: '3', epg_channel_id: 'c9', container_extension: 'm3u8' }], [{ category_id: '3', category_name: 'Esportes' }]);
assert.equal(live[0].stream_url, 'https://provider.example:8443/live/user/secret/9.m3u8');
assert.equal(live[0].category, 'Esportes', 'category name comes from get_live_categories');
assert.equal(live[0].tvg_id, 'c9');
const movies = rules.xtreamMovies('http://h:1', 'u', 'p', [{ stream_id: 5, name: 'M', stream_icon: 'https://i/x.jpg', rating: '7.2' }], []);
assert.equal(movies[0].type, 'movies');
assert.equal(movies[0].logo, 'https://i/x.jpg');
assert.equal(movies[0].stream_url, 'http://h:1/movie/u/p/5.mp4');
const seasons = rules.xtreamSeasons('http://h:1', 'u', 'p', { seasons: [{ season_number: 2, name: 'Temporada 2' }], episodes: { 2: [{ id: 22, episode_num: 2, title: 'B', container_extension: 'mkv' }, { id: 21, episode_num: 1, title: 'A' }], 1: [{ id: 11, episode_num: 1 }] } });
assert.equal(seasons.length, 2);
assert.equal(seasons[0].number, 1, 'seasons sorted');
assert.equal(seasons[1].episodes[0].name, 'A', 'episodes sorted');
assert.equal(seasons[1].episodes[1].stream_url, 'http://h:1/series/u/p/22.mkv');
assert.equal(rules.catalogItemType({ category: 'VOD Lançamentos' }), 'movies');
assert.equal(rules.catalogItemType({ category: 'Esportes' }), 'live');

// Catálogo sob demanda (Roku 0.1.88)
const cats = rules.xtreamCategoryList([{ category_id: 7, category_name: 'Ação' }, { category_name: 'sem id' }, null]);
assert.deepEqual(cats, [{ id: '7', name: 'Ação' }]);
const lazyMovies = rules.xtreamCategoryItems('movies', 'http://h:1', 'u', 'p', [{ stream_id: 5, name: 'Filme', container_extension: 'mkv' }, { stream_id: 6, name: 'Outro' }], 'Ação', 'm3u8', 1);
assert.equal(lazyMovies.length, 1, "limit applied");
assert.equal(lazyMovies[0].category, 'Ação');
assert.equal(lazyMovies[0].stream_url, 'http://h:1/movie/u/p/5.mkv');
const lazyLive = rules.xtreamCategoryItems('live', 'http://h:1', 'u', 'p', [{ stream_id: 9, name: 'Canal' }], 'Notícias', 'm3u8', 0);
assert.equal(lazyLive[0].stream_url, 'http://h:1/live/u/p/9.m3u8', 'live uses allowed m3u8');
const cred = { host: 'http://h:1', username: 'u', password: 'p' };
const rebuiltMovie = rules.xtreamItemFromSaved(cred, { id: 'movie:5', sid: '5', kind: 'movies', title: 'Filme', ext: 'mkv', category: 'Ação' }, 'ts');
assert.equal(rebuiltMovie.id, 'movie:5');
assert.equal(rebuiltMovie.stream_url, 'http://h:1/movie/u/p/5.mkv', 'saved item rebuilt without stored URL');
const rebuiltSeries = rules.xtreamItemFromSaved(cred, { id: 'series:3', sid: '3', kind: 'series', title: 'Série' }, 'ts');
assert.equal(rebuiltSeries.type, 'series');
assert.equal(rules.xtreamItemFromSaved(cred, { id: 'x', kind: 'movies' }, 'ts'), null, 'needs sid');

// QR da ativação (porta do QrCode.brs): versão 4, 33x33, até 78 bytes.
const qr = require('../public/src/core/qrCode.js');
const matrix = qr.qrMatrix('https://elvanoqplay.app/adicionar-lista/?codigo=LG-3FA92C81D0E7');
assert.equal(matrix.length, 33);
assert.equal(matrix[0][0], 1, 'finder pattern');
assert.equal(matrix[25][8], 1, 'dark module');
assert.equal(qr.qrMatrix('x'.repeat(79)), null, 'too long');
assert.ok(qr.qrSvg('abc', 6).indexOf('<svg') === 0);

console.log('playlist sync rules: OK');
