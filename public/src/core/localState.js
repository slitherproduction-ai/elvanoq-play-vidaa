/* Porta de source/LocalState.brs: favoritos, assistir mais tarde, continuar
 * assistindo e histórico, sem duplicação e sem persistir URLs ou credenciais.
 */
(function (EP) {
  'use strict';
  var KEY = 'local_state';
  var LIMITS = { favorites: 300, watch_later: 200, continue_watching: 60, history: 80 };

  function defaults() {
    return { favorites: [], watch_later: [], continue_watching: [], history: [], parental: { enabled: false, locked_categories: [] } };
  }

  function sanitizeItem(item) {
    var safe = { id: String(item.id) };
    var fields = ['title', 'category', 'kind', 'progress_seconds', 'duration_seconds', 'completed', 'updated_at'];
    for (var i = 0; i < fields.length; i++) if (item[fields[i]] !== undefined && item[fields[i]] !== null) safe[fields[i]] = item[fields[i]];
    if (item.type && !safe.kind) safe.kind = item.type;
    // Dados mínimos para recriar o item com o catálogo sob demanda (como no Roku).
    // Nunca guarda a URL completa, que contém usuário e senha da lista.
    var sid = item.sid || item.series_id || item.stream_id;
    if (sid !== undefined && sid !== null && sid !== '') safe.sid = String(sid);
    if (item.ext) safe.ext = item.ext;
    else if (item.type === 'movies' && item.stream_url) { var m = /\.([a-z0-9]{2,5})(?:\?|$)/i.exec(item.stream_url); if (m) safe.ext = m[1]; }
    if (item.series_title) safe.series_title = String(item.series_title).slice(0, 200);
    if (item.tvg) safe.tvg = item.tvg; else if (item.tvg_id) safe.tvg = item.tvg_id;
    if (item.archive_days > 0 || item.arc > 0) safe.arc = Math.min(60, item.archive_days || item.arc);
    if (item.logo && String(item.logo).length <= 300 && String(item.logo).indexOf('/player_api.php') === -1) safe.logo = item.logo;
    return safe;
  }

  function sanitizeItems(items) {
    var out = [];
    if (!items || !items.length) return out;
    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      if (item && item.id && String(item.id).indexOf('://') === -1) out.push(sanitizeItem(item));
    }
    return out;
  }

  function trim(items, max) { return items.length <= max ? items : items.slice(items.length - max); }

  var LocalState = EP.LocalState = {
    load: function () {
      var state = EP.Registry.readJson(KEY, null);
      if (!state || typeof state !== 'object') return defaults();
      state.favorites = sanitizeItems(state.favorites);
      state.watch_later = sanitizeItems(state.watch_later);
      state.continue_watching = sanitizeItems(state.continue_watching);
      state.history = sanitizeItems(state.history);
      if (!state.parental) state.parental = { enabled: false, locked_categories: [] };
      return state;
    },
    save: function (state) {
      for (var key in LIMITS) state[key] = trim(state[key] || [], LIMITS[key]);
      EP.Registry.writeJson(KEY, state);
    },
    upsert: function (items, item) {
      if (!item || !item.id) return items;
      var safe = sanitizeItem(item), next = [], replaced = false;
      for (var i = 0; i < items.length; i++) {
        if (items[i].id === safe.id) { next.push(safe); replaced = true; } else next.push(items[i]);
      }
      if (!replaced) next.push(safe);
      return next;
    },
    remove: function (items, id) {
      var next = [];
      for (var i = 0; i < items.length; i++) if (items[i].id !== id) next.push(items[i]);
      return next;
    },
    contains: function (items, id) { return EP.findIndex(items, function (x) { return x.id === id; }) !== -1; },
    toggle: function (collection, item) {
      var state = LocalState.load();
      var exists = LocalState.contains(state[collection], item.id);
      state[collection] = exists ? LocalState.remove(state[collection], item.id) : LocalState.upsert(state[collection], item);
      LocalState.save(state);
      return !exists;
    },
    isFavorite: function (id) { return LocalState.contains(LocalState.load().favorites, id); },
    resumePositionFor: function (item) {
      if (!item || !item.id) return 0;
      var saved = EP.find(LocalState.load().continue_watching, function (x) { return x.id === item.id; });
      if (!saved || saved.completed === true) return 0;
      return saved.progress_seconds > 0 ? Math.floor(saved.progress_seconds) : 0;
    },
    clearHistory: function () {
      var state = LocalState.load();
      state.history = []; state.continue_watching = [];
      LocalState.save(state);
    }
  };
}(window.EP));
