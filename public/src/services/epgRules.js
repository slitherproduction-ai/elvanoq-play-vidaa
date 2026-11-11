/* Porta do parser XMLTV do EpgService.brs (sem DOM, testável no Node).
 * entries[channelId] = até 6 programas relevantes ordenados por início:
 *   { title, start: 'YYYYMMDDHHMMSS +ZZZZ', startSec, stopSec }
 */
(function (root) {
  'use strict';
  var MAX_TOTAL = 6000, PER_CHANNEL = 6;

  function xmltvSeconds(value) {
    if (!value || value.length < 14) return 0;
    var d = value.slice(0, 14);
    var ms = Date.UTC(+d.slice(0, 4), +d.slice(4, 6) - 1, +d.slice(6, 8), +d.slice(8, 10), +d.slice(10, 12), +d.slice(12, 14));
    var seconds = Math.floor(ms / 1000);
    var tail = value.slice(14).replace(/^\s+|\s+$/g, '');
    if (tail.length >= 5 && (tail.charAt(0) === '+' || tail.charAt(0) === '-')) {
      var offset = (+tail.slice(1, 3)) * 3600 + (+tail.slice(3, 5)) * 60;
      seconds -= tail.charAt(0) === '-' ? -offset : offset;
    }
    return seconds;
  }

  function attr(tag, name) {
    var m = new RegExp('\\s' + name + '="([^"]*)"').exec(tag);
    return m ? m[1] : '';
  }

  function decodeEntities(value) {
    return String(value || '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&amp;/g, '&');
  }

  function insert(list, programme) {
    list.push(programme);
    list.sort(function (a, b) { return (a.startSec || 0) - (b.startSec || 0); });
    if (list.length > PER_CHANNEL) list.length = PER_CHANNEL;
  }

  function relevant(startSec, stopSec, nowSec) {
    if (!startSec) return true;
    if (stopSec <= nowSec) return false;
    return startSec <= nowSec + 28800;
  }

  function parseXmltv(body, nowSec) {
    nowSec = nowSec || Math.floor(Date.now() / 1000);
    var entries = {}, total = 0;
    var re = /<programme\b([^>]*)>([\s\S]*?)<\/programme>/g, match;
    while ((match = re.exec(body)) && total < MAX_TOTAL) {
      var opening = match[1];
      var channel = attr(opening, 'channel');
      var start = attr(opening, 'start');
      var startSec = xmltvSeconds(start);
      var stopSec = xmltvSeconds(attr(opening, 'stop'));
      if (startSec && !stopSec) stopSec = startSec + 7200;
      var titleMatch = /<title\b[^>]*>([\s\S]*?)<\/title>/.exec(match[2]);
      var title = titleMatch ? decodeEntities(titleMatch[1]).replace(/^\s+|\s+$/g, '') : '';
      if (channel && title && relevant(startSec, stopSec, nowSec)) {
        insert(entries[channel] = entries[channel] || [], { title: title, start: start, startSec: startSec, stopSec: stopSec });
        total++;
      }
    }
    return entries;
  }

  function decodeBase64(value) {
    try {
      var binary = (typeof atob === 'function') ? atob(value) : Buffer.from(value, 'base64').toString('binary');
      return decodeURIComponent(escape(binary));
    } catch (_) { return String(value || ''); }
  }

  function formatStamp(seconds) {
    var d = new Date(seconds * 1000);
    function p(n) { return n < 10 ? '0' + n : String(n); }
    return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds());
  }

  /* get_short_epg (Xtream): títulos em base64, horários em epoch. O "start"
   * fica em horário local, que é como o Roku exibe HH:MM. */
  function parseShortEpg(body, nowSec) {
    nowSec = nowSec || Math.floor(Date.now() / 1000);
    var list = (body && body.epg_listings) || [], out = [];
    for (var i = 0; i < list.length; i++) {
      var p = list[i];
      var startSec = Number(p.start_timestamp) || 0, stopSec = Number(p.stop_timestamp) || 0;
      var title = decodeBase64(p.title || '').replace(/^\s+|\s+$/g, '');
      if (!title || !relevant(startSec, stopSec || startSec + 7200, nowSec)) continue;
      out.push({ title: title, start: startSec ? formatStamp(startSec) : '', startSec: startSec, stopSec: stopSec });
    }
    out.sort(function (a, b) { return a.startSec - b.startSec; });
    return out.slice(0, PER_CHANNEL);
  }

  /* "HH:MM  •  Título" — igual ao programmeLabel do LiveTVView.brs (ali o
   * horário vem cru do XMLTV; aqui convertemos para o fuso da TV). */
  function programmeLabel(programme, separator) {
    if (!programme) return '';
    var label = programme.title;
    if (programme.startSec) {
      var d = new Date(programme.startSec * 1000);
      label = (d.getHours() < 10 ? '0' : '') + d.getHours() + ':' + (d.getMinutes() < 10 ? '0' : '') + d.getMinutes() + (separator || '  •  ') + label;
    }
    return label;
  }

  function progress(programme, nowSec) {
    if (!programme || !programme.startSec || !programme.stopSec) return 0;
    nowSec = nowSec || Math.floor(Date.now() / 1000);
    var value = (nowSec - programme.startSec) / (programme.stopSec - programme.startSec);
    return Math.max(0, Math.min(1, value));
  }

  var api = { parseXmltv: parseXmltv, parseShortEpg: parseShortEpg, xmltvSeconds: xmltvSeconds, programmeLabel: programmeLabel, progress: progress };
  root.EP = root.EP || {};
  root.EP.EpgRules = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
}(typeof window !== 'undefined' ? window : globalThis));
