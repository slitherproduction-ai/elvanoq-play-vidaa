/* XMLHttpRequest com timeout, retornando Promise (sem fetch/AbortController,
 * indisponíveis em navegadores de TV antigos). Nunca registra URLs ou respostas.
 *
 * VIDAA: a página é hospedada, então o navegador aplica CORS. GETs de
 * outros domínios (Xtream, M3U, EPG) tentam direto e, se o navegador bloquear,
 * passam pelo relay /api/fetch do mesmo domínio. O host que falhou direto é
 * lembrado durante a sessão para não repetir a tentativa.
 */
(function (EP) {
  'use strict';
  var viaProxyHosts = {};

  function request(method, url, options) {
    options = options || {};
    return new Promise(function (resolve, reject) {
      var xhr = new XMLHttpRequest();
      var done = false;
      try { xhr.open(method, url, true); } catch (e) { reject(new Error('network')); return; }
      xhr.timeout = options.timeout || 15000;
      var headers = options.headers || {};
      for (var name in headers) if (Object.prototype.hasOwnProperty.call(headers, name)) xhr.setRequestHeader(name, headers[name]);
      xhr.onload = function () {
        if (done) return; done = true;
        resolve({ status: xhr.status, text: xhr.responseText || '', header: function (h) { try { return xhr.getResponseHeader(h); } catch (_) { return null; } } });
      };
      xhr.onerror = function () { if (done) return; done = true; reject(new Error('network')); };
      xhr.ontimeout = function () { if (done) return; done = true; reject(new Error('timeout')); };
      xhr.send(options.body === undefined ? null : options.body);
    });
  }

  function hostOf(url) { var m = /^https?:\/\/([^\/?#]+)/i.exec(String(url || '')); return m ? m[1].toLowerCase() : ''; }

  function isCrossOrigin(url) {
    var host = hostOf(url);
    return !!host && host !== String(window.location.host || '').toLowerCase();
  }

  function proxyHeaders() {
    var id = EP.Portal && EP.Portal.identity;
    return id ? { 'X-EP-Device': id.deviceId, 'X-EP-Key': String(id.key) } : {};
  }

  function viaProxy(url, timeout) {
    return request('GET', EP.Config.proxyUrl + '?u=' + encodeURIComponent(url), { timeout: timeout, headers: proxyHeaders() }).then(function (r) {
      // O relay devolve 502/504 com o status de origem em X-EP-Status quando a origem falhou.
      var origin = parseInt(r.header('X-EP-Status'), 10);
      if (origin > 0) r.status = origin;
      return r;
    });
  }

  function get(url, timeout) {
    var cfg = EP.Config || {};
    if (!cfg.proxyUrl || !isCrossOrigin(url)) return request('GET', url, { timeout: timeout });
    if (cfg.proxyMode === 'always' || viaProxyHosts[hostOf(url)]) return viaProxy(url, timeout);
    return request('GET', url, { timeout: timeout }).then(function (r) {
      if (r.status !== 0) return r;
      viaProxyHosts[hostOf(url)] = true;
      return viaProxy(url, timeout);
    }, function (error) {
      if (error && error.message === 'timeout') throw error;
      viaProxyHosts[hostOf(url)] = true; // bloqueio de CORS/conteúdo misto chega como erro de rede
      return viaProxy(url, timeout);
    });
  }

  EP.Http = {
    get: get,
    postJson: function (url, payload, headers, timeout) {
      return request('POST', url, { timeout: timeout, headers: EP.extend({ 'Content-Type': 'application/json', Accept: 'application/json' }, headers), body: JSON.stringify(payload) });
    },
    json: function (response) { try { return JSON.parse(response.text); } catch (_) { return null; } },
    query: function (params) {
      var parts = [];
      for (var key in params) if (Object.prototype.hasOwnProperty.call(params, key) && params[key] !== undefined && params[key] !== null) parts.push(encodeURIComponent(key) + '=' + encodeURIComponent(params[key]));
      return parts.join('&');
    }
  };
}(window.EP));
