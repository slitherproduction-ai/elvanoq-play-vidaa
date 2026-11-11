/* Regras puras de lista (sem DOM): sincronização do Portal, parser M3U
 * equivalente ao CatalogService.brs do Roku e normalização Xtream.
 * Modelo de item idêntico ao Roku:
 *   { id, type: 'live'|'movies'|'series', title, category, logo, tvg_id,
 *     stream_url, added_at, rating, featured, ... }
 */
(function (root) {
  'use strict';
  function text(value) {
    if (typeof value === 'number' && isFinite(value)) return String(value);
    return typeof value === 'string' && value.replace(/^\s+|\s+$/g, '') ? value.replace(/^\s+|\s+$/g, '') : null;
  }
  function extend(target, source) { for (var k in source) if (Object.prototype.hasOwnProperty.call(source, k)) target[k] = source[k]; return target; }
  function isHttpUrl(value) { return typeof value === 'string' && /^https?:\/\/[^\s\/?#@]+/i.test(value.replace(/^\s+/, '')); }
  function stripSlash(value) { return String(value || '').replace(/\/+$/, ''); }

  function allowed(body) {
    var license = (body && body.license) || {};
    var codeAccess = body && body.code_access;
    return !!(body && body.active === true && license.can_play === true && (!codeAccess || codeAccess.can_connect === true));
  }

  /* Link de API Xtream cadastrado como "M3U" (player_api.php / get.php /
   * panel_api.php com username e password). Baixar esse link traz um JSON
   * gigante (ex.: get_vod_streams = catálogo inteiro), não um M3U; por isso
   * vira uma fonte Xtream, carregada por categoria como as demais. */
  function xtreamFromUrl(url) {
    var m = /^\s*(https?:\/\/[^\s?#]+?)\/(?:player_api|get|panel_api)\.php\?([^#]*)/i.exec(String(url || ''));
    if (!m) return null;
    var params = {}, parts = m[2].split('&');
    for (var i = 0; i < parts.length; i++) {
      var eq = parts[i].indexOf('=');
      if (eq <= 0) continue;
      try { params[decodeURIComponent(parts[i].slice(0, eq)).toLowerCase()] = decodeURIComponent(parts[i].slice(eq + 1).replace(/\+/g, ' ')); } catch (_) {}
    }
    if (!text(params.username) || !text(params.password)) return null;
    return { host: m[1], username: params.username, password: params.password };
  }

  function normalize(playlist) {
    if (!playlist || (playlist.kind !== 'm3u' && playlist.kind !== 'xtream')) return null;
    var credentials = playlist.credentials || {};
    if (playlist.kind === 'm3u') {
      var asXtream = xtreamFromUrl(credentials.url);
      if (asXtream) playlist = extend(extend({}, playlist), { kind: 'xtream', credentials: extend(extend({ m3uUrl: credentials.url }, credentials), asXtream) });
      credentials = playlist.credentials;
    }
    if (playlist.kind === 'm3u' && !isHttpUrl(text(credentials.url))) return null;
    if (playlist.kind === 'xtream' && (!isHttpUrl(text(credentials.host)) || !text(credentials.username) || !text(credentials.password))) return null;
    return {
      name: text(playlist.name) || 'Lista do Portal',
      sourceType: playlist.kind,
      credentials: playlist.kind === 'm3u' ? { url: credentials.url } : extend({ host: credentials.host, username: credentials.username, password: credentials.password }, credentials.m3uUrl ? { m3uUrl: credentials.m3uUrl } : {}),
      epgUrl: text(playlist.epg_url) || text(playlist.xmltv_url) || text(credentials.epg_url) || text(credentials.xmltv_url) || null,
      updatedAt: text(playlist.updated_at) || null
    };
  }

  function merge(existing, playlist, deviceId) {
    var items = existing && existing.length !== undefined ? existing.slice() : [];
    var normalized = normalize(playlist);
    if (!normalized) return { items: items, changed: false, invalid: true };
    var sourceId = 'portal-webos:' + deviceId;
    var entry = extend(normalized, { id: sourceId, sourceId: sourceId, origin: 'portal-webos' });
    var index = -1;
    for (var i = 0; i < items.length; i++) if (items[i] && items[i].sourceId === sourceId) { index = i; break; }
    if (index === -1) items.push(entry); else items[index] = extend(extend({}, items[index]), entry);
    return { items: items, changed: true, invalid: false, entry: entry };
  }

  /* ---------- Tipos de conteúdo (mesmas regras do Roku) ---------- */
  function normalizedContentType(value) {
    var normalized = String(value || '').replace(/^\s+|\s+$/g, '').toLowerCase();
    if (!normalized) return '';
    if (/^(series|serie|series tv|tv shows|show|shows)$/.test(normalized)) return 'series';
    if (/^(movie|movies|film|films|vod)$/.test(normalized)) return 'movies';
    if (/^(live|live tv|tv|channel|channels)$/.test(normalized)) return 'live';
    if (normalized.indexOf('série') !== -1 || normalized.indexOf('serie') !== -1 || normalized.indexOf('tv show') !== -1) return 'series';
    if (normalized.indexOf('filme') !== -1 || normalized.indexOf('movie') !== -1 || normalized.indexOf('film') !== -1 || normalized.indexOf('vod') !== -1) return 'movies';
    if (normalized.indexOf('ao vivo') !== -1 || normalized.indexOf('ao-vivo') !== -1 || normalized.indexOf('live') !== -1) return 'live';
    return '';
  }

  function catalogItemType(item) {
    if (item.type) return item.type;
    return normalizedContentType(item.category) || 'live';
  }

  /* ---------- M3U ---------- */
  function attribute(line, name) {
    var token = name + '="';
    var start = line.indexOf(token);
    if (start === -1) return '';
    var valueStart = start + token.length;
    var end = line.indexOf('"', valueStart);
    return end === -1 ? '' : line.slice(valueStart, end);
  }
  function firstAttribute(line, names) {
    for (var i = 0; i < names.length; i++) { var v = attribute(line, names[i]); if (v) return v; }
    return '';
  }
  function extinfTitle(line) {
    var lastQuote = line.lastIndexOf('"');
    var comma = line.indexOf(',', lastQuote + 1);
    if (comma === -1) return 'Canal';
    return line.slice(comma + 1).replace(/^\s+|\s+$/g, '') || 'Canal';
  }
  function typeLimit(type) { return type === 'live' ? 5000 : 5000; }

  function parseM3u(source) {
    var lines = String(source || '').replace(/\r/g, '').split('\n');
    var items = [], groups = {}, groupOrder = [], counts = {}, pending = null, epgUrl = '';
    var seen = {};
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].replace(/^\s+|\s+$/g, '');
      if (!line) continue;
      if (line.indexOf('#EXTM3U') === 0) { epgUrl = firstAttribute(line, ['url-tvg', 'x-tvg-url', 'tvg-url']); continue; }
      if (line.indexOf('#EXTINF') === 0) {
        pending = {
          title: extinfTitle(line), group: attribute(line, 'group-title'), logo: attribute(line, 'tvg-logo'),
          tvg_id: attribute(line, 'tvg-id'), tvg_name: attribute(line, 'tvg-name'),
          added_at: firstAttribute(line, ['added', 'date', 'release-date']),
          rating: firstAttribute(line, ['rating', 'tvg-rating', 'score']),
          featured: firstAttribute(line, ['featured', 'weekly-featured', 'is-featured']),
          content_type: firstAttribute(line, ['content-type', 'content_type', 'media-type', 'media_type', 'tvg-type', 'tvg_type', 'type', 'category-type'])
        };
        continue;
      }
      if (pending && line.charAt(0) !== '#') {
        if (isHttpUrl(line)) {
          var category = pending.group || 'Sem categoria';
          var type = normalizedContentType(pending.content_type) || normalizedContentType(category) || 'live';
          counts[type] = counts[type] || 0;
          if (counts[type] < typeLimit(type)) {
            counts[type]++;
            var id = pending.tvg_id ? 'live:' + pending.tvg_id : 'live:' + category + ':' + pending.title;
            if (type !== 'live') id = type + ':' + category + ':' + pending.title;
            if (seen[id]) id = id + ':' + items.length;
            seen[id] = true;
            items.push({ id: id, type: type, title: pending.title, category: category, logo: pending.logo, tvg_id: pending.tvg_id, tvg_name: pending.tvg_name, added_at: pending.added_at, rating: pending.rating, featured: pending.featured, stream_url: line });
            if (type === 'live' && !groups[category]) { groups[category] = true; groupOrder.push(category); }
          }
        }
        pending = null;
      }
    }
    return { items: items, categories: groupOrder, epgUrl: epgUrl };
  }

  /* ---------- Xtream ---------- */
  function buildXtreamApiUrl(host, username, password, action, extra) {
    var base = stripSlash(host);
    if (!isHttpUrl(base)) return null;
    var url = base + '/player_api.php?username=' + encodeURIComponent(username) + '&password=' + encodeURIComponent(password);
    if (action) url += '&action=' + encodeURIComponent(action);
    if (extra) for (var k in extra) if (Object.prototype.hasOwnProperty.call(extra, k)) url += '&' + encodeURIComponent(k) + '=' + encodeURIComponent(extra[k]);
    return url;
  }
  function xtreamEpgUrl(host, username, password) {
    return stripSlash(host) + '/xmltv.php?username=' + encodeURIComponent(username) + '&password=' + encodeURIComponent(password);
  }
  function categoryNames(list) {
    var map = {};
    if (list && list.length) for (var i = 0; i < list.length; i++) if (list[i] && list[i].category_id != null) map[String(list[i].category_id)] = text(list[i].category_name) || '';
    return map;
  }
  function categoryOf(item, names, fallback) {
    return text(item.category_name) || names[String(item.category_id)] || fallback;
  }
  function epochToIso(value) {
    var n = Number(value);
    if (!n || !isFinite(n)) return '';
    try { return new Date(n * 1000).toISOString(); } catch (_) { return ''; }
  }
  function xtreamLiveStreams(host, username, password, body, categories, liveExtension) {
    if (!body || body.length === undefined) return [];
    var base = stripSlash(host), names = categoryNames(categories), out = [];
    for (var i = 0; i < body.length; i++) {
      var item = body[i];
      if (!item || item.stream_id == null) continue;
      out.push({ id: 'xtream:' + item.stream_id, stream_id: item.stream_id, type: 'live', title: text(item.name) || 'Canal', category: categoryOf(item, names, 'Ao vivo'), logo: text(item.stream_icon) || '', tvg_id: text(item.epg_channel_id) || '', archive_days: String(item.tv_archive) === '1' ? Math.max(1, parseInt(item.tv_archive_duration, 10) || 1) : 0, added_at: epochToIso(item.added), stream_url: base + '/live/' + encodeURIComponent(username) + '/' + encodeURIComponent(password) + '/' + encodeURIComponent(item.stream_id) + '.' + (liveExtension || text(item.container_extension) || 'ts') });
    }
    return out;
  }
  function xtreamMovies(host, username, password, body, categories) {
    if (!body || body.length === undefined) return [];
    var base = stripSlash(host), names = categoryNames(categories), out = [];
    for (var i = 0; i < body.length; i++) {
      var item = body[i];
      if (!item || item.stream_id == null) continue;
      out.push({ id: 'movie:' + item.stream_id, stream_id: item.stream_id, type: 'movies', title: text(item.name) || 'Filme', category: categoryOf(item, names, 'Filmes'), logo: text(item.stream_icon) || '', rating: text(item.rating) || '', added_at: epochToIso(item.added), year: text(item.year) || '', plot: text(item.plot) || '', stream_url: base + '/movie/' + encodeURIComponent(username) + '/' + encodeURIComponent(password) + '/' + encodeURIComponent(item.stream_id) + '.' + (text(item.container_extension) || 'mp4') });
    }
    return out;
  }
  function xtreamSeries(body, categories) {
    if (!body || body.length === undefined) return [];
    var names = categoryNames(categories), out = [];
    for (var i = 0; i < body.length; i++) {
      var item = body[i];
      if (!item || item.series_id == null) continue;
      var backdrop = '', bp = item.backdrop_path;
      if (bp && typeof bp !== 'string') { for (var b = 0; b < bp.length; b++) if (/^https?:/.test(String(bp[b]))) { backdrop = String(bp[b]); break; } } else if (/^https?:/.test(String(bp || ''))) backdrop = String(bp);
      out.push({ id: 'series:' + item.series_id, series_id: item.series_id, type: 'series', backdrop: backdrop, title: text(item.name) || 'Série', category: categoryOf(item, names, 'Séries'), logo: text(item.cover) || '', rating: text(item.rating) || '', added_at: epochToIso(item.last_modified), year: text(item.year) || text(item.releaseDate) || '', plot: text(item.plot) || '', stream_url: '' });
    }
    return out;
  }
  /* Lista de categorias (get_*_categories) -> [{ id, name }]. */
  function xtreamCategoryList(body) {
    var out = [];
    if (!body || body.length === undefined) return out;
    for (var i = 0; i < body.length; i++) {
      var c = body[i];
      if (!c || c.category_id == null) continue;
      out.push({ id: String(c.category_id), name: text(c.category_name) || 'Sem categoria' });
    }
    return out;
  }

  /* Itens de uma categoria (get_*_streams&category_id=X), com o nome dela. */
  function xtreamCategoryItems(kind, host, username, password, body, categoryName, liveExtension, limit) {
    var names = {}, list;
    if (body && body.length !== undefined) for (var i = 0; i < body.length; i++) if (body[i]) body[i].category_name = categoryName;
    if (kind === 'live') list = xtreamLiveStreams(host, username, password, body, names, liveExtension);
    else if (kind === 'series') list = xtreamSeries(body, names);
    else list = xtreamMovies(host, username, password, body, names);
    return limit ? list.slice(0, limit) : list;
  }

  /* Recria um item salvo (favoritos, continuar, histórico) sem a categoria
   * carregada — mesma ideia do xtreamItemFromSaved do Roku. Nunca há URL salva. */
  function xtreamItemFromSaved(cred, saved, liveExtension) {
    if (!cred || !saved || !saved.sid || !saved.kind) return null;
    var stream = { name: saved.title || '', stream_id: saved.sid, series_id: saved.sid, stream_icon: saved.logo || '', cover: saved.logo || '', container_extension: saved.ext || '', epg_channel_id: saved.tvg || '', category_name: saved.category || '', tv_archive: saved.arc ? 1 : 0, tv_archive_duration: saved.arc || 0 };
    var item = xtreamCategoryItems(saved.kind, cred.host, cred.username, cred.password, [stream], saved.category || '', liveExtension, 1)[0];
    if (!item) return null;
    item.id = saved.id;
    return item;
  }

  function xtreamEpisodeUrl(host, username, password, extension, id) {
    return stripSlash(host) + '/series/' + encodeURIComponent(username) + '/' + encodeURIComponent(password) + '/' + encodeURIComponent(id) + '.' + (text(extension) || 'mp4');
  }
  /* get_series_info -> temporadas ordenadas com episódios reproduzíveis. */
  function xtreamSeasons(host, username, password, info) {
    var seasons = [], episodes = (info && info.episodes) || {};
    var meta = {};
    if (info && info.seasons && info.seasons.length) for (var s = 0; s < info.seasons.length; s++) if (info.seasons[s]) meta[String(info.seasons[s].season_number)] = info.seasons[s];
    var keys = [];
    for (var key in episodes) if (Object.prototype.hasOwnProperty.call(episodes, key)) keys.push(key);
    keys.sort(function (a, b) { return Number(a) - Number(b); });
    for (var k = 0; k < keys.length; k++) {
      var list = episodes[keys[k]] || [], mapped = [];
      for (var e = 0; e < list.length; e++) {
        var ep = list[e];
        if (!ep || ep.id == null) continue;
        var epInfo = ep.info || {};
        mapped.push({ id: ep.id, image: text(epInfo.movie_image) || '', number: Number(ep.episode_num) || e + 1, name: text(ep.title) || ('Episódio ' + (Number(ep.episode_num) || e + 1)), overview: text(epInfo.plot) || '', duration_seconds: Number(epInfo.duration_secs) || 0, stream_url: xtreamEpisodeUrl(host, username, password, ep.container_extension, ep.id) });
      }
      mapped.sort(function (a, b) { return a.number - b.number; });
      var m = meta[keys[k]] || {};
      seasons.push({ number: Number(keys[k]), name: text(m.name) || ('Temporada ' + keys[k]), episode_count: mapped.length, episodes: mapped });
    }
    return seasons;
  }

  var api = {
    allowed: allowed, normalize: normalize, merge: merge, isHttpUrl: isHttpUrl,
    normalizedContentType: normalizedContentType, catalogItemType: catalogItemType,
    parseM3u: parseM3u, xtreamFromUrl: xtreamFromUrl, buildXtreamApiUrl: buildXtreamApiUrl, xtreamEpgUrl: xtreamEpgUrl,
    xtreamLiveStreams: xtreamLiveStreams, xtreamMovies: xtreamMovies, xtreamSeries: xtreamSeries,
    xtreamEpisodeUrl: xtreamEpisodeUrl, xtreamSeasons: xtreamSeasons,
    xtreamCategoryList: xtreamCategoryList, xtreamCategoryItems: xtreamCategoryItems, xtreamItemFromSaved: xtreamItemFromSaved
  };
  root.EP = root.EP || {};
  root.EP.PlaylistRules = api;
  root.ELVANOQPlaylist = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
}(typeof window !== 'undefined' ? window : globalThis));
