/* Equivalente ao EpgService.brs.
 * - XMLTV (url-tvg da M3U ou epg_url do Portal): carregado uma vez, com
 *   limite de tamanho para não esgotar a memória da TV.
 * - Xtream sem XMLTV: get_short_epg sob demanda por canal, com cache.
 */
(function (EP) {
  'use strict';
  var MAX_XMLTV_CHARS = 40 * 1024 * 1024;
  var SHORT_TTL = 10 * 60 * 1000;

  function EpgService() {
    this.source = null;
    this.entries = {};
    this.shortCache = {};
    this.pending = {};
  }

  EpgService.prototype.configure = function (source, onReady) {
    var self = this;
    this.source = source;
    this.entries = {};
    this.shortCache = {};
    if (!source || source.kind !== 'xmltv') return;
    EP.Http.get(source.url, 60000).then(function (response) {
      if (response.status < 200 || response.status >= 300 || !response.text || response.text.length > MAX_XMLTV_CHARS) return;
      self.entries = EP.EpgRules.parseXmltv(response.text);
      if (onReady) onReady();
    }, function () {});
  };

  /* Programas conhecidos para o canal (pode ser [] enquanto carrega). */
  EpgService.prototype.programmes = function (item) {
    if (!item) return [];
    if (this.source && this.source.kind === 'xtream') {
      var cached = this.shortCache[item.stream_id];
      return cached && Date.now() - cached.at < SHORT_TTL ? cached.list : [];
    }
    return (item.tvg_id && this.entries[item.tvg_id]) || [];
  };

  /* Busca sob demanda (somente Xtream). onReady é chamado se chegou algo novo. */
  EpgService.prototype.request = function (item, onReady) {
    var self = this, source = this.source;
    if (!item || !source || source.kind !== 'xtream' || item.stream_id == null) return;
    var cached = this.shortCache[item.stream_id];
    if ((cached && Date.now() - cached.at < SHORT_TTL) || this.pending[item.stream_id]) return;
    this.pending[item.stream_id] = true;
    var url = EP.PlaylistRules.buildXtreamApiUrl(source.host, source.username, source.password, 'get_short_epg', { stream_id: item.stream_id, limit: 4 });
    EP.Http.get(url, 12000).then(function (response) {
      delete self.pending[item.stream_id];
      var list = EP.EpgRules.parseShortEpg(EP.Http.json(response));
      self.shortCache[item.stream_id] = { at: Date.now(), list: list };
      if (onReady) onReady(item);
    }, function () { delete self.pending[item.stream_id]; });
  };

  /* Programas para rever (get_simple_data_table), só para canais com arquivo. */
  EpgService.prototype.archive = function (item, callback) {
    var source = this.source;
    if (!item || !(item.archive_days > 0) || !source || source.kind !== 'xtream' || item.stream_id == null) { callback({ ok: false, items: [] }); return; }
    var url = EP.PlaylistRules.buildXtreamApiUrl(source.host, source.username, source.password, 'get_simple_data_table', { stream_id: item.stream_id });
    EP.Http.get(url, 20000).then(function (response) {
      var ok = response.status >= 200 && response.status < 300;
      callback({ ok: ok, items: ok ? EP.CatchupRules.archiveProgrammes(EP.Http.json(response), item.archive_days) : [] });
    }, function () { callback({ ok: false, items: [] }); });
  };

  EpgService.prototype.guideFor = function (item) {
    var list = this.programmes(item);
    return { now: list[0] || null, next: list[1] || null };
  };

  EP.EpgService = EpgService;
}(window.EP));
