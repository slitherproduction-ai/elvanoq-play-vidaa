/* ELVANOQ Play VIDAA — namespace e utilitários básicos.
 * Todo o código usa ES5 + Promise para rodar também em TVs VIDAA antigas
 * (Chromium 53+). Não use arrow functions, let/const, template strings,
 * Array.prototype.find, Object.assign ou URLSearchParams.
 */
(function (root) {
  'use strict';
  var EP = root.EP = root.EP || {};
  EP.VERSION = '1.0.0';
  EP.BUILD = 'vidaa';

  /* Capas do TMDB no tamanho em que aparecem (Roku 1.1.1): menos download,
   * menos decodificação e menos memória. Outras URLs passam sem mudança. */
  EP.sizedImage = function (url, size) {
    url = url ? String(url) : '';
    return size ? url.replace(/(image\.tmdb\.org\/t\/p\/)[^\/]+\//, '$1' + size + '/') : url;
  };

  EP.text = function (value) {
    if (typeof value === 'number' && isFinite(value)) return String(value);
    return typeof value === 'string' && value.replace(/^\s+|\s+$/g, '') ? value.replace(/^\s+|\s+$/g, '') : '';
  };

  EP.extend = function (target) {
    for (var i = 1; i < arguments.length; i++) {
      var source = arguments[i];
      if (!source) continue;
      for (var key in source) if (Object.prototype.hasOwnProperty.call(source, key)) target[key] = source[key];
    }
    return target;
  };

  EP.findIndex = function (items, predicate) {
    if (!items) return -1;
    for (var i = 0; i < items.length; i++) if (predicate(items[i], i)) return i;
    return -1;
  };

  EP.find = function (items, predicate) {
    var index = EP.findIndex(items, predicate);
    return index === -1 ? null : items[index];
  };

  EP.pad2 = function (value) { value = Math.floor(value); return value < 10 ? '0' + value : String(value); };

  EP.formatTime = function (value) {
    var seconds = Math.max(0, Math.floor(value || 0));
    var hours = Math.floor(seconds / 3600);
    var minutes = Math.floor((seconds % 3600) / 60);
    var remaining = seconds % 60;
    if (hours > 0) return EP.pad2(hours) + ':' + EP.pad2(minutes) + ':' + EP.pad2(remaining);
    return EP.pad2(minutes) + ':' + EP.pad2(remaining);
  };

  /* Título limpo para exibição (sem marcações do provedor como [DUB], (L), 4K). */
  EP.displayTitle = function (title) {
    var t = String(title || '');
    t = t.replace(/\s*[\[(](?:dub(?:lado)?|leg(?:endado)?|nac(?:ional)?|l|d|4k|fhd|hd|sd|uhd|hdr|cam|ts|multi(?:-?audio)?)[\])]\s*/gi, ' ');
    t = t.replace(/\s+[|\-]\s*(?:dub(?:lado)?|leg(?:endado)?|4k|fhd|hd|uhd)\s*$/i, '');
    t = t.replace(/^\s*(?:pt|br|pt-br)\s*[|:\-]\s*/i, '');
    return t.replace(/\s{2,}/g, ' ').replace(/^\s+|\s+$/g, '') || String(title || '');
  };

  /* Selo de qualidade a partir do nome (Android: titleVariant/quality). */
  EP.qualityOf = function (title) {
    var m = /\b(4K|UHD|FHD|HDR)\b/i.exec(String(title || ''));
    return m ? m[1].toUpperCase() : '';
  };

  var MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  EP.clockText = function (date) {
    date = date || new Date();
    return { time: EP.pad2(date.getHours()) + ':' + EP.pad2(date.getMinutes()), date: date.getDate() + ' ' + MONTHS[date.getMonth()] + ' ' + date.getFullYear() };
  };

  EP.formatNumber = function (value) {
    return String(Math.floor(value || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  };

  EP.lower = function (value) { return String(value || '').toLowerCase(); };

  /* Pequeno emissor de eventos — equivalente aos campos observáveis do SceneGraph. */
  EP.Emitter = function () { this._handlers = {}; };
  EP.Emitter.prototype.on = function (name, handler) {
    (this._handlers[name] = this._handlers[name] || []).push(handler);
    return this;
  };
  EP.Emitter.prototype.emit = function (name, payload) {
    var list = this._handlers[name] || [];
    for (var i = 0; i < list.length; i++) list[i](payload);
  };

  /* Timer com a mesma semântica do nó Timer do Roku (start/stop, repeat). */
  EP.Timer = function (seconds, repeat, onFire) {
    this.seconds = seconds; this.repeat = !!repeat; this.onFire = onFire; this.handle = null;
  };
  EP.Timer.prototype.start = function () {
    var self = this;
    this.stop();
    if (this.repeat) this.handle = setInterval(function () { self.onFire(); }, this.seconds * 1000);
    else this.handle = setTimeout(function () { self.handle = null; self.onFire(); }, this.seconds * 1000);
  };
  EP.Timer.prototype.stop = function () {
    if (this.handle === null) return;
    clearInterval(this.handle); clearTimeout(this.handle); this.handle = null;
  };
  EP.Timer.prototype.running = function () { return this.handle !== null; };
}(typeof window !== 'undefined' ? window : globalThis));

