/* Rever programas (catch-up Xtream), na mesma ordem do Android 2.17.21:
 *  1. /timeshift/{user}/{pass}/{min}/{inicio_unix}/{id}.m3u8
 *  2. /timeshift/{user}/{pass}/{min}/{AAAA-MM-DD:HH-MM}/{id}.ts
 *  3. /streaming/timeshift.php?username=&password=&stream=&start=&duration=
 * O horário dos formatos 2 e 3 é o local da TV. Só canais com tv_archive.
 * As URLs levam usuário e senha: nunca vão para log nem para a tela.
 */
(function (root) {
  'use strict';
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function localStamp(unix) {
    var d = new Date(unix * 1000);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ':' + pad(d.getHours()) + '-' + pad(d.getMinutes());
  }
  function base(host) { return String(host || '').replace(/\/+$/, ''); }

  /* programme: { start, stop } em milissegundos. */
  function catchupUrls(cred, streamId, programme) {
    if (!cred || !cred.host || !cred.username || !cred.password || streamId == null || !programme) return [];
    var start = Math.floor(programme.start / 1000), stop = Math.floor(programme.stop / 1000);
    if (!(start > 0) || !(stop > start)) return [];
    var minutes = Math.max(1, Math.ceil((stop - start) / 60));
    var u = encodeURIComponent(cred.username), p = encodeURIComponent(cred.password), id = encodeURIComponent(streamId), h = base(cred.host);
    var stamp = localStamp(start);
    return [
      h + '/timeshift/' + u + '/' + p + '/' + minutes + '/' + start + '/' + id + '.m3u8',
      h + '/timeshift/' + u + '/' + p + '/' + minutes + '/' + stamp + '/' + id + '.ts',
      h + '/streaming/timeshift.php?username=' + u + '&password=' + p + '&stream=' + id + '&start=' + encodeURIComponent(stamp) + '&duration=' + minutes
    ];
  }

  /* get_simple_data_table -> programas que já terminaram e têm arquivo,
   * dentro dos dias de arquivo do canal, do mais recente para o mais antigo. */
  function decode(value) {
    var s = String(value || '');
    if (!s) return '';
    try {
      if (/^[A-Za-z0-9+/=\s]+$/.test(s) && s.length % 4 === 0) {
        var bin = typeof atob === 'function' ? atob(s) : Buffer.from(s, 'base64').toString('binary');
        try { return decodeURIComponent(escape(bin)); } catch (_) { return bin; }
      }
    } catch (_) {}
    return s;
  }
  function archiveProgrammes(body, archiveDays, now) {
    var list = body && body.epg_listings, out = [];
    if (!list || list.length === undefined) return out;
    now = now || Date.now();
    var oldest = now - Math.max(1, archiveDays || 1) * 86400000;
    for (var i = 0; i < list.length; i++) {
      var e = list[i];
      if (!e) continue;
      var start = Number(e.start_timestamp) * 1000, stop = Number(e.stop_timestamp) * 1000;
      if (!(start > 0) || !(stop > start) || stop > now || start < oldest) continue;
      if (e.has_archive !== undefined && String(e.has_archive) !== '1') continue;
      out.push({ title: decode(e.title) || 'Programa', start: start, stop: stop });
    }
    out.sort(function (a, b) { return b.start - a.start; });
    return out.slice(0, 200);
  }

  var api = { catchupUrls: catchupUrls, archiveProgrammes: archiveProgrammes, localStamp: localStamp };
  root.EP = root.EP || {};
  root.EP.CatchupRules = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
}(typeof window !== 'undefined' ? window : globalThis));
