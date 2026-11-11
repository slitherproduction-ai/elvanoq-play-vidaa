/* Ícones vetoriais (traço 2, viewBox 24) no estilo Ionicons usado no Android.
 * EP.icon('tv', 54) devolve um <span class="icon"> com o SVG.
 */
(function (EP) {
  'use strict';
  var S = 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
  var F = 'fill="currentColor"';
  var PATHS = {
    tv: '<rect x="3" y="6.5" width="18" height="12.5" rx="2.5" ' + S + '/><path d="M8.5 2.8 12 6.3l3.5-3.5M9 22h6" ' + S + '/>',
    film: '<path d="M4 9h16v10.5a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19.5Z" ' + S + '/><path d="m3.6 9 15.6-4.2-.8-3L3.1 6Z" ' + S + '/><path d="m7.4 4.9 2.3 3M12.2 3.6l2.3 3M8 12.5h8" ' + S + '/>',
    series: '<rect x="7" y="7" width="14" height="13" rx="2" ' + S + '/><path d="M4 16V5.5A1.5 1.5 0 0 1 5.5 4H16" ' + S + '/><path d="m12.5 10.6 4 2.9-4 2.9Z" ' + F + '/>',
    search: '<circle cx="10.5" cy="10.5" r="6.5" ' + S + '/><path d="m15.5 15.5 5 5" ' + S + ' stroke-width="2.6"/>',
    star: '<path d="m12 2.8 2.8 6 6.5.7-4.9 4.4 1.4 6.4L12 17l-5.8 3.3 1.4-6.4-4.9-4.4 6.5-.7Z" ' + F + '/>',
    starOutline: '<path d="m12 2.8 2.8 6 6.5.7-4.9 4.4 1.4 6.4L12 17l-5.8 3.3 1.4-6.4-4.9-4.4 6.5-.7Z" ' + S + '/>',
    settings: '<path d="M12 8.6A3.4 3.4 0 1 0 12 15.4 3.4 3.4 0 1 0 12 8.6Z" ' + S + '/><path d="M19.4 13.5a7.7 7.7 0 0 0 0-3l2-1.6-2-3.4-2.4.9a7.6 7.6 0 0 0-2.6-1.5L14 2.4h-4l-.4 2.5A7.6 7.6 0 0 0 7 6.4l-2.4-.9-2 3.4 2 1.6a7.7 7.7 0 0 0 0 3l-2 1.6 2 3.4 2.4-.9a7.6 7.6 0 0 0 2.6 1.5l.4 2.5h4l.4-2.5a7.6 7.6 0 0 0 2.6-1.5l2.4.9 2-3.4Z" ' + S + '/>',
    play: '<path d="M7 4.5v15l12.5-7.5Z" ' + F + '/>',
    pause: '<path d="M7 4.5h3.5v15H7zM13.5 4.5H17v15h-3.5z" ' + F + '/>',
    plus: '<path d="M12 5v14M5 12h14" ' + S + ' stroke-width="2.6"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7.5" ' + S + ' stroke-width="2.6"/>',
    info: '<circle cx="12" cy="12" r="9" ' + S + '/><path d="M12 11v6M12 7.5v.1" ' + S + ' stroke-width="2.4"/>',
    bookmark: '<path d="M6 3.5h12v17l-6-4-6 4Z" ' + S + '/>',
    clock: '<circle cx="12" cy="12" r="9" ' + S + '/><path d="M12 7v5l3.5 2" ' + S + '/>',
    lock: '<rect x="5" y="10.5" width="14" height="10" rx="2" ' + S + '/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" ' + S + '/>',
    refresh: '<path d="M20 5v5h-5M4 19v-5h5" ' + S + '/><path d="M18.5 9A7 7 0 0 0 6 7.5L4 10M5.5 15A7 7 0 0 0 18 16.5l2-2.5" ' + S + '/>',
    key: '<circle cx="8" cy="15" r="4" ' + S + '/><path d="m11 12 8.5-8.5M16 7l2.5 2.5M14 9l2 2" ' + S + '/>',
    sparkles: '<path d="M12 3.5 13.6 9l5.4 1.6-5.4 1.6L12 17.6l-1.6-5.4L5 10.6 10.4 9Z" ' + S + '/><path d="M19 3v4M21 5h-4" ' + S + '/>',
    globe: '<circle cx="12" cy="12" r="9" ' + S + '/><path d="M3 12h18M12 3c2.6 2.6 3.8 5.6 3.8 9S14.6 18.4 12 21C9.4 18.4 8.2 15.4 8.2 12S9.4 5.6 12 3Z" ' + S + '/>',
    trash: '<path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13" ' + S + '/>',
    grid: '<rect x="4" y="4" width="6.5" height="6.5" rx="1.5" ' + S + '/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5" ' + S + '/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5" ' + S + '/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5" ' + S + '/>',
    chevronRight: '<path d="m9 5 7 7-7 7" ' + S + ' stroke-width="2.4"/>',
    chevronLeft: '<path d="m15 5-7 7 7 7" ' + S + ' stroke-width="2.4"/>',
    back10: '<path d="M4 5v5h5" ' + S + '/><path d="M4.5 10A8 8 0 1 1 6 16.5" ' + S + '/><text x="12.3" y="15.2" font-size="7" font-weight="700" text-anchor="middle" ' + F + ' font-family="Inter,Arial">10</text>',
    fwd10: '<path d="M20 5v5h-5" ' + S + '/><path d="M19.5 10A8 8 0 1 0 18 16.5" ' + S + '/><text x="11.7" y="15.2" font-size="7" font-weight="700" text-anchor="middle" ' + F + ' font-family="Inter,Arial">10</text>',
    audio: '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4Z" ' + S + '/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" ' + S + '/>',
    subtitles: '<rect x="3" y="5" width="18" height="14" rx="2.5" ' + S + '/><path d="M7 12.5h4M13 12.5h4M7 15.5h7" ' + S + '/>',
    heart: '<path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.2 4.3 4.3 0 0 1 19.5 10C19.5 15.4 12 20 12 20Z" ' + S + '/>',
    live: '<circle cx="12" cy="12" r="2.5" ' + F + '/><path d="M7.8 7.8a6 6 0 0 0 0 8.4M16.2 7.8a6 6 0 0 1 0 8.4M5 5a10 10 0 0 0 0 14M19 5a10 10 0 0 1 0 14" ' + S + '/>'
  };

  EP.iconSvg = function (name) {
    return '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' + (PATHS[name] || '') + '</svg>';
  };

  EP.icon = function (name, size) {
    var span = document.createElement('span');
    span.className = 'icon';
    if (size) { span.style.width = size + 'px'; span.style.height = size + 'px'; }
    span.innerHTML = EP.iconSvg(name);
    return span;
  };
}(window.EP));
