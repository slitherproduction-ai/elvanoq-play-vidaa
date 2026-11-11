/* Normaliza o controle VIDAA (Hisense/Toshiba) para os nomes de tecla do
 * Roku, assim as views usam exatamente a mesma lógica de onKeyEvent.
 *
 * O VIDAA usa os keyCodes HbbTV/W3C: Voltar = 8, cores 403–406, mídia
 * 19/412/413/415/417. Os códigos LG/Tizen continuam aceitos (inofensivos).
 * Roku "*" (options) → botão AZUL (também VERMELHO e INFO).
 */
(function (EP) {
  'use strict';
  var MAP = {
    37: 'left', 38: 'up', 39: 'right', 40: 'down',
    13: 'OK',
    10009: 'back', 461: 'back', 8: 'back', 27: 'back', 65385: 'back', 65376: 'OK',
    406: 'options', 403: 'options', 457: 'options', 112: 'options', 82: 'options',
    404: 'green', 405: 'yellow',
    415: 'play', 19: 'pause', 413: 'stop', 179: 'play', 10252: 'play',
    412: 'rev', 417: 'fwd', 227: 'rev', 228: 'fwd',
    33: 'channelUp', 34: 'channelDown', 427: 'channelUp', 428: 'channelDown'
  };
  EP.OPTIONS_LABEL = 'AZUL';

  EP.keyName = function (event) {
    var code = event.keyCode || event.which;
    if (code >= 48 && code <= 57) return String(code - 48);
    if (code >= 96 && code <= 105) return String(code - 96);
    if (MAP[code]) return MAP[code];
    if (event.key === 'Enter') return 'OK';
    return '';
  };
}(window.EP));
