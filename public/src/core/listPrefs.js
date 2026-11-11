/* Preferências guardadas por lista (Android 2.17.21):
 * - ListScope: identificador da lista ativa (hash; nunca host/usuário/senha).
 * - LiveFormat: formato do ao vivo (auto lembra o que abriu; hls/ts manual).
 * - CategoryVisibility: categorias ocultas por lista e por tipo.
 * Tudo no localStorage via EP.Registry (prefixo "elvanoq-lg:").
 */
(function (root) {
  'use strict';
  var EP = root.EP = root.EP || {};
  var R = function () { return EP.Registry; };
  var currentId = 'default';

  var ListScope = EP.ListScope = {
    /* xtream: host + usuário; m3u: URL. Só o hash curto fica salvo. */
    idFor: function (playlist) {
      if (!playlist) return 'default';
      var c = playlist.credentials || playlist;
      var basis = playlist.sourceType === 'xtream' || c.host
        ? 'x|' + String(c.host || '').toLowerCase().replace(/\/+$/, '') + '|' + String(c.username || '')
        : 'm|' + String(c.url || '');
      return EP.Sha256.sha256Sync(basis).slice(0, 16);
    },
    set: function (id) { currentId = id || 'default'; },
    id: function () { return currentId; }
  };

  /* ---------- formato do ao vivo ---------- */
  var MODES = ['auto', 'hls', 'ts'];
  var LiveFormat = EP.LiveFormat = {
    MODES: MODES,
    LABELS: { auto: 'Automático', hls: 'HLS (m3u8)', ts: 'MPEG-TS (ts)' },
    mode: function () { var m = R().read('liveFormatMode:' + currentId); return MODES.indexOf(m) >= 0 ? m : 'auto'; },
    setMode: function (mode) { R().write('liveFormatMode:' + currentId, MODES.indexOf(mode) >= 0 ? mode : 'auto'); },
    remembered: function () { var f = R().read('liveFormat:' + currentId); return f === 'hls' || f === 'ts' ? f : ''; },
    remember: function (format) { if ((format === 'hls' || format === 'ts') && LiveFormat.mode() === 'auto') R().write('liveFormat:' + currentId, format); },
    /* Formato para começar: manual vence; no automático, o último que abriu. */
    preferred: function () { var m = LiveFormat.mode(); return m === 'auto' ? LiveFormat.remembered() : m; },
    formatOf: function (url) {
      var m = /\/live\/[^?#]+\.(m3u8|ts)(?:[?#]|$)/i.exec(String(url || ''));
      return m ? (m[1].toLowerCase() === 'ts' ? 'ts' : 'hls') : '';
    },
    /* Só reescreve URLs de ao vivo Xtream (/live/.../id.ext). */
    withFormat: function (url, format) {
      if (!format || !LiveFormat.formatOf(url)) return url;
      return String(url).replace(/\.(m3u8|ts)([?#]|$)/i, (format === 'ts' ? '.ts' : '.m3u8') + '$2');
    },
    alternative: function (url) {
      var f = LiveFormat.formatOf(url);
      return f ? LiveFormat.withFormat(url, f === 'ts' ? 'hls' : 'ts') : '';
    },
    apply: function (url) { return LiveFormat.withFormat(url, LiveFormat.preferred()); }
  };

  /* ---------- categorias visíveis ---------- */
  var KINDS = ['live', 'movies', 'series'];
  var cache = null;
  function all() {
    if (!cache) { cache = R().readJson('hiddenCategories', {}); if (!cache || typeof cache !== 'object') cache = {}; }
    return cache;
  }
  function listOf(kind) {
    var lists = all()[currentId];
    return lists && lists[kind] && lists[kind].length !== undefined ? lists[kind] : [];
  }
  var CategoryVisibility = EP.CategoryVisibility = {
    KINDS: KINDS,
    hiddenMap: function (kind) {
      var map = {}, ids = listOf(kind);
      for (var i = 0; i < ids.length; i++) map[ids[i]] = true;
      return map;
    },
    isHidden: function (kind, id) { return !!CategoryVisibility.hiddenMap(kind)[id]; },
    hiddenCount: function () { var n = 0; for (var k = 0; k < KINDS.length; k++) n += listOf(KINDS[k]).length; return n; },
    toggle: function (kind, id) {
      var store = all(), lists = store[currentId] || {}, ids = listOf(kind).slice(), at = ids.indexOf(id);
      if (at >= 0) ids.splice(at, 1); else ids.push(id);
      lists[kind] = ids; store[currentId] = lists;
      R().writeJson('hiddenCategories', store);
      return at < 0; // true = agora oculta
    },
    /* categories: [{id, name}] -> só as visíveis. */
    filterCategories: function (kind, categories) {
      var hidden = CategoryVisibility.hiddenMap(kind), out = [];
      for (var i = 0; i < (categories || []).length; i++) if (!hidden[categories[i].id]) out.push(categories[i]);
      return out;
    },
    /* Nomes ocultos (os itens só guardam o nome da categoria). */
    hiddenNames: function (kind, categories) {
      var hidden = CategoryVisibility.hiddenMap(kind), names = {};
      for (var i = 0; i < (categories || []).length; i++) if (hidden[categories[i].id]) names[categories[i].name] = true;
      return names;
    },
    _reset: function () { cache = null; }
  };
}(typeof window !== 'undefined' ? window : globalThis));
