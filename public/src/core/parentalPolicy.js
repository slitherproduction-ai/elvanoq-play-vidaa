/* Porta de source/ParentalPolicy.brs: bloqueios por categoria e por item,
 * separados por lista ativa (server_code), PIN inicial 0000 e desbloqueio
 * válido somente nesta sessão do aplicativo.
 */
(function (EP) {
  'use strict';
  var R = EP.Registry;
  // Android 2.17.21: categorias adultas protegidas automaticamente (nome em minúsculas).
  var ADULT = new RegExp('(^|[^a-z0-9\u00C0-\u024F])(x{3,}|porn[a-z\u00C0-\u024F]*|adult[oa]s?|adults?|hentai|er[o\u00F3]tic[a-z\u00C0-\u024F]*|playboy|sexy ?hot|nsfw|\\+ ?18|18 ?\\+)(?![a-z0-9\u00C0-\u024F])', 'i');

  var Parental = EP.Parental = {
    scopeKey: function () {
      var metadata = R.readJson('playlist_metadata', null);
      if (metadata && metadata.server_code) return 'parental_locks_' + metadata.server_code;
      return 'parental_locks_default';
    },
    itemScopeKey: function () { return Parental.scopeKey() + '_items'; },
    sessionUnlocked: function () { return R.read('parental_session', true) === 'unlocked'; },
    unlockSession: function () { R.write('parental_session', 'unlocked', true); },
    clearSession: function () { R.remove('parental_session', true); },
    /* PIN (Roku 0.1.88): guardado só como SHA-256 com sal aleatório do aparelho;
     * sem PIN padrão — o primeiro acesso cria um; 5 erros bloqueiam por 5 min. */
    hashPin: function (pin, salt) { return EP.Sha256.sha256Sync('elvanoq-pin:' + salt + ':' + pin); },
    hasPin: function () { Parental.migrateLegacyPin(); return !!R.read('parental_pin_hash'); },
    setPin: function (pin) {
      var salt = '';
      for (var i = 0; i < 4; i++) salt += Math.floor(Math.random() * 0x100000000).toString(16);
      try { var a = new Uint8Array(16); window.crypto.getRandomValues(a); salt = ''; for (i = 0; i < 16; i++) salt += ('0' + a[i].toString(16)).slice(-2); } catch (_) {}
      R.write('parental_salt', salt);
      R.write('parental_pin_hash', Parental.hashPin(pin, salt));
      R.remove('parental_pin');
      R.write('parental_fail_count', '0');
    },
    verifyPin: function (pin) { return Parental.hashPin(pin, R.read('parental_salt') || '') === R.read('parental_pin_hash'); },
    /* Versões antigas guardavam o PIN em texto: quem trocou mantém o valor
     * (agora protegido); o 0000 padrão é descartado e um PIN novo é criado. */
    migrateLegacyPin: function () {
      var legacy = R.read('parental_pin');
      if (!legacy) return;
      if (!R.read('parental_pin_hash') && legacy !== '0000') Parental.setPin(legacy);
      else R.remove('parental_pin');
    },
    lockRemainingSeconds: function () {
      var until = parseInt(R.read('parental_lock_until') || '0', 10), remaining = until - Math.floor(Date.now() / 1000);
      return remaining > 0 && remaining <= 300 ? remaining : 0;
    },
    registerFailure: function () {
      var failures = (parseInt(R.read('parental_fail_count') || '0', 10) || 0) + 1;
      if (failures >= 5) { R.write('parental_fail_count', '0'); R.write('parental_lock_until', String(Math.floor(Date.now() / 1000) + 300)); return 0; }
      R.write('parental_fail_count', String(failures));
      return 5 - failures;
    },
    resetFailures: function () { R.write('parental_fail_count', '0'); },
    categoryLocks: function () { var v = R.readJson(Parental.scopeKey(), []); return v && v.length !== undefined ? v : []; },
    itemLocks: function () { var v = R.readJson(Parental.itemScopeKey(), []); return v && v.length !== undefined ? v : []; },
    isAdultName: function (name) { return ADULT.test(EP.lower(name)); },
    adultProtection: function () { return R.read('parental_adult_protect') !== '0'; },
    setAdultProtection: function (on) { R.write('parental_adult_protect', on ? '1' : '0'); },
    /* Categoria protegida pela regra automática (sem exceção gravada). */
    isAutoCategory: function (category) { return Parental.adultProtection() && Parental.isAdultName(category); },
    isCategoryLocked: function (category, locks) {
      locks = locks || Parental.categoryLocks();
      var needle = EP.lower(category), exception = '!' + needle;
      var auto = Parental.isAutoCategory(category);
      for (var i = 0; i < locks.length; i++) {
        var lock = EP.lower(locks[i]);
        if (lock === needle) return true;
        if (auto && lock === exception) return false; // liberada pelo responsável
      }
      return auto;
    },
    /* Liberar uma automática grava "!<categoria>"; liberar de novo volta à regra. */
    hasException: function (category, locks) {
      locks = locks || Parental.categoryLocks();
      var exception = '!' + EP.lower(category);
      for (var i = 0; i < locks.length; i++) if (EP.lower(locks[i]) === exception) return true;
      return false;
    },
    protectedCount: function (categories) {
      var locks = Parental.categoryLocks(), n = 0;
      for (var i = 0; i < (categories || []).length; i++) if (Parental.isCategoryLocked(categories[i], locks)) n++;
      return n;
    },
    isItemLocked: function (id, locks) {
      locks = locks || Parental.itemLocks();
      for (var i = 0; i < locks.length; i++) if (locks[i] === id) return true;
      return false;
    },
    isBlocked: function (category) {
      if (Parental.sessionUnlocked()) return false;
      return Parental.isCategoryLocked(category);
    },
    isBlockedItem: function (category, id) {
      if (Parental.isBlocked(category)) return true;
      if (Parental.sessionUnlocked() || !id) return false;
      return Parental.isItemLocked(id);
    },
    toggleCategory: function (category) {
      if (Parental.isAutoCategory(category)) {
        var current = Parental.categoryLocks(), kept = [], exception = '!' + EP.lower(category), had = false;
        for (var j = 0; j < current.length; j++) {
          var lock = EP.lower(current[j]);
          if (lock === exception) had = true;
          else if (lock !== EP.lower(category)) kept.push(current[j]);
        }
        if (!had) kept.push('!' + category);
        R.writeJson(Parental.scopeKey(), kept);
        return had; // true = bloqueada de novo pela regra
      }
      var locks = Parental.categoryLocks(), next = [], removed = false;
      for (var i = 0; i < locks.length; i++) {
        if (EP.lower(locks[i]) === EP.lower(category)) removed = true;
        else if (EP.lower(locks[i]) !== '!' + EP.lower(category)) next.push(locks[i]);
      }
      if (!removed) next.push(category);
      R.writeJson(Parental.scopeKey(), next);
      return !removed;
    },
    toggleItem: function (id) {
      var locks = Parental.itemLocks(), next = [], removed = false;
      for (var i = 0; i < locks.length; i++) { if (locks[i] === id) removed = true; else next.push(locks[i]); }
      if (!removed) next.push(id);
      R.writeJson(Parental.itemScopeKey(), next);
      return !removed;
    }
  };
}(window.EP));
