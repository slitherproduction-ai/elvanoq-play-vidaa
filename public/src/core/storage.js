/* Equivalente ao roRegistrySection("ELVANOQPlay") do Roku, sobre localStorage.
 * sessionStorage guarda o desbloqueio parental apenas durante a sessão.
 */
(function (EP) {
  'use strict';
  var PREFIX = 'elvanoq-lg:';
  var memory = {};

  function backend(session) {
    try {
      var store = session ? window.sessionStorage : window.localStorage;
      var probe = PREFIX + 'probe';
      store.setItem(probe, '1'); store.removeItem(probe);
      return store;
    } catch (_) { return null; }
  }

  EP.Registry = {
    read: function (key, session) {
      var store = backend(session);
      try { return store ? store.getItem(PREFIX + key) : (memory[key] === undefined ? null : memory[key]); } catch (_) { return null; }
    },
    write: function (key, value, session) {
      var store = backend(session);
      try { if (store) store.setItem(PREFIX + key, value); else memory[key] = value; return true; } catch (_) { return false; }
    },
    remove: function (key, session) {
      var store = backend(session);
      try { if (store) store.removeItem(PREFIX + key); else delete memory[key]; } catch (_) {}
    },
    readJson: function (key, fallback, session) {
      var raw = EP.Registry.read(key, session);
      if (!raw) return fallback;
      try { var parsed = JSON.parse(raw); return parsed === null || parsed === undefined ? fallback : parsed; } catch (_) { return fallback; }
    },
    writeJson: function (key, value, session) { return EP.Registry.write(key, JSON.stringify(value), session); }
  };
}(window.EP));
