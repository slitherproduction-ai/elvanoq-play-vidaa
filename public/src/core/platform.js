/* Plataforma VIDAA (Hisense, Toshiba e outras marcas com VIDAA / Home OS).
 *
 * No VIDAA o app é uma página HTML5 hospedada: a loja abre o endereço em
 * tela cheia no navegador do sistema. Por isso:
 *  - Portal e listas passam pelo relay do mesmo domínio (Worker), porque o
 *    Portal só aceita origens próprias e servidores Xtream não enviam CORS;
 *  - o vídeo continua indo direto ao servidor da lista (sem relay);
 *  - a identidade usa o ID do aparelho exposto pelo VIDAA (Hisense_*) quando
 *    existe; senão, uma identidade aleatória guardada no localStorage.
 */
(function (EP) {
  'use strict';

  var sameOrigin = /^https?:$/.test(window.location.protocol);

  EP.Config = {
    platform: 'vidaa',
    deviceName: 'TV VIDAA',
    codePrefix: 'VD',
    // Servido pelo Worker: rotas relativas no mesmo domínio.
    portalUrl: sameOrigin ? '/api/portal' : 'https://xrrgjssvdqvtrqhxpask.supabase.co/functions/v1/portal-control',
    proxyUrl: sameOrigin ? '/api/fetch' : '',
    // 'auto': tenta direto e, se o navegador bloquear (CORS/conteúdo misto), usa o relay.
    proxyMode: 'auto'
  };

  /* Funções globais que o navegador do VIDAA expõe às web apps. O nome varia
   * entre versões do sistema; fora da TV nenhuma existe. */
  function call(names) {
    for (var i = 0; i < names.length; i++) {
      try {
        var fn = window[names[i]];
        if (typeof fn === 'function') {
          var value = fn();
          if (value !== undefined && value !== null && String(value).replace(/\s/g, '') !== '') return String(value);
        }
      } catch (_) {}
    }
    return '';
  }

  EP.vidaaDeviceId = function () {
    var id = call(['Hisense_GetDeviceID', 'Hisense_GetDeviceId', 'Hisense_getDeviceID']);
    return id.length >= 6 && !/^0+$/.test(id) ? id : '';
  };

  EP.vidaaModel = function () { return call(['Hisense_GetModelName', 'Hisense_GetModel']); };

  EP.isVidaa = function () {
    return !!EP.vidaaDeviceId() || /VIDAA|Hisense|HiBrowser/i.test(navigator.userAgent || '');
  };

  /* No VIDAA as teclas coloridas e de mídia chegam direto como keydown
   * (códigos HbbTV/W3C); não há registro de teclas como no Tizen. */
  EP.registerTvKeys = function () {};

  /* Voltar na tela raiz fecha o app e volta à Home da TV. */
  EP.exitApp = function () {
    try { if (typeof window.Hisense_closeApp === 'function') { window.Hisense_closeApp(); return; } } catch (_) {}
    try { window.close(); } catch (_) {}
  };

  /* Deep link opcional pela URL: ?contentId=movie:123:mp4&mediaType=movie */
  EP.launchDeepLink = function () {
    var q = window.location.search || '';
    var id = /[?&]contentId=([^&]+)/.exec(q);
    if (!id) return null;
    var type = /[?&]mediaType=([^&]+)/.exec(q);
    try { return { contentId: decodeURIComponent(id[1]), mediaType: type ? decodeURIComponent(type[1]) : '' }; } catch (_) { return null; }
  };
}(window.EP));
