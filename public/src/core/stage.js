/* Palco 1920x1080 com as mesmas coordenadas do SceneGraph do Roku.
 * Cada helper cria um elemento posicionado em pixels absolutos, igual a
 * Rectangle / Label / Poster com translation, width e height.
 */
(function (EP) {
  'use strict';
  var Stage = EP.Stage = {};

  /* 0xRRGGBBAA (formato Roku) -> rgba() */
  Stage.color = function (value) {
    var hex = String(value || '').replace(/^0x/i, '').replace('#', '');
    if (hex.length === 6) hex += 'FF';
    if (hex.length !== 8) return 'transparent';
    var r = parseInt(hex.slice(0, 2), 16), g = parseInt(hex.slice(2, 4), 16), b = parseInt(hex.slice(4, 6), 16), a = parseInt(hex.slice(6, 8), 16) / 255;
    return 'rgba(' + r + ',' + g + ',' + b + ',' + Math.round(a * 1000) / 1000 + ')';
  };

  function place(node, opts) {
    var s = node.style;
    s.left = (opts.x || 0) + 'px';
    s.top = (opts.y || 0) + 'px';
    if (opts.w !== undefined) s.width = opts.w + 'px';
    if (opts.h !== undefined) s.height = opts.h + 'px';
    if (opts.opacity !== undefined) s.opacity = String(opts.opacity);
    if (opts.id) node.id = opts.id;
    if (opts.visible === false) node.style.display = 'none';
    if (opts.className) node.className += ' ' + opts.className;
    return node;
  }

  Stage.group = function (parent, opts) {
    var node = document.createElement('div');
    node.className = 'sg-group';
    place(node, opts || {});
    if (parent) parent.appendChild(node);
    return node;
  };

  Stage.rect = function (parent, opts) {
    var node = document.createElement('div');
    node.className = 'sg-rect';
    place(node, opts);
    node.style.backgroundColor = Stage.color(opts.color);
    parent.appendChild(node);
    return node;
  };

  /* font: 'small' | 'medium' | 'large', bold opcional — equivalentes a
   * SmallSystemFont, MediumSystemFont e LargeSystemFont em FHD. */
  Stage.label = function (parent, opts) {
    var node = document.createElement('div');
    node.className = 'sg-label font-' + (opts.font || 'medium') + (opts.bold ? ' bold' : '') + (opts.wrap ? ' wrap' : '') + (opts.weight ? ' w' + opts.weight : '') + (opts.lines ? ' clamp' + opts.lines : '');
    place(node, opts);
    if (opts.size) node.style.fontSize = opts.size + 'px';
    if (opts.lineHeight) node.style.lineHeight = opts.lineHeight + 'px';
    if (opts.css) node.style.cssText += ';' + opts.css;
    if (opts.visible === false) Stage.show(node, false);
    if (opts.color) node.style.color = Stage.color(opts.color);
    if (opts.align) node.style.textAlign = opts.align;
    if (opts.valign === 'center') { node.style.display = opts.visible === false ? 'none' : 'flex'; node.style.alignItems = 'center'; node.style.justifyContent = opts.align === 'center' ? 'center' : (opts.align === 'right' ? 'flex-end' : 'flex-start'); }
    node.textContent = opts.text || '';
    parent.appendChild(node);
    if (opts.fit) Stage.autoFit(node);
    return node;
  };

  /* Reduz a fonte até o texto caber (botões com largura fixa do layout Roku). */
  Stage.autoFit = function (node) {
    function fit() {
      node.style.fontSize = '';
      var size = parseFloat(window.getComputedStyle(node).fontSize) || 24;
      var guard = 0;
      while (node.scrollWidth > node.clientWidth + 1 && size > 16 && guard++ < 20) { size -= 1; node.style.fontSize = size + 'px'; }
    }
    if (window.MutationObserver) new MutationObserver(fit).observe(node, { childList: true, characterData: true, subtree: true });
    setTimeout(fit, 0);
  };

  /* Elemento genérico com classe CSS (cartões, botões, chips). */
  Stage.el = function (parent, opts) {
    var node = document.createElement(opts.tag || 'div');
    node.className = 'el ' + (opts.className || '');
    place(node, { x: opts.x, y: opts.y, w: opts.w, h: opts.h, id: opts.id, visible: opts.visible, opacity: opts.opacity });
    if (opts.html) node.innerHTML = opts.html;
    if (opts.text) node.textContent = opts.text;
    if (opts.css) node.style.cssText += ';' + opts.css;
    if (opts.visible === false) Stage.show(node, false);
    if (parent) parent.appendChild(node);
    return node;
  };

  /* Botão no padrão Android (primary / glass / round), com ícone opcional. */
  Stage.button = function (parent, opts) {
    var node = document.createElement('div');
    node.className = 'btn' + (opts.variant ? ' ' + opts.variant : '');
    node.style.left = opts.x + 'px'; node.style.top = opts.y + 'px';
    if (opts.w) node.style.width = opts.w + 'px';
    if (opts.h) node.style.height = opts.h + 'px';
    Stage.setButton(node, opts.icon, opts.label);
    if (opts.visible === false) node.style.display = 'none';
    parent.appendChild(node);
    return node;
  };
  Stage.setButton = function (node, icon, label) {
    node.innerHTML = '';
    if (icon) node.appendChild(EP.icon(icon));
    if (label) { var t = document.createElement('span'); t.textContent = label; node.appendChild(t); }
  };

  Stage.focus = function (node, focused) {
    if (!node) return;
    var has = (' ' + node.className + ' ').indexOf(' focused ') !== -1;
    if (focused && !has) node.className += ' focused';
    if (!focused && has) node.className = (' ' + node.className + ' ').replace(' focused ', ' ').replace(/^\s+|\s+$/g, '');
  };
  Stage.toggle = function (node, cls, on) {
    var has = (' ' + node.className + ' ').indexOf(' ' + cls + ' ') !== -1;
    if (on && !has) node.className += ' ' + cls;
    if (!on && has) node.className = (' ' + node.className + ' ').replace(' ' + cls + ' ', ' ').replace(/^\s+|\s+$/g, '');
  };

  Stage.poster = function (parent, opts) {
    var node = document.createElement('div');
    node.className = 'sg-poster ' + (opts.mode === 'fit' ? 'fit' : 'fill');
    place(node, opts);
    if (opts.uri) Stage.setPoster(node, opts.uri);
    parent.appendChild(node);
    return node;
  };

  /* size: tamanho TMDB pedido (padrão w342, o das grades). */
  Stage.setPoster = function (node, uri, size) {
    if (uri) uri = EP.sizedImage(uri, size || 'w342');
    node.style.backgroundImage = uri ? 'url("' + String(uri).replace(/"/g, '%22') + '")' : 'none';
  };

  Stage.show = function (node, visible) {
    if (!node) return;
    if (visible) {
      node.style.display = node.getAttribute('data-flex') === '1' ? 'flex' : '';
    } else {
      if (node.style.display === 'flex') node.setAttribute('data-flex', '1');
      node.style.display = 'none';
    }
  };

  Stage.isVisible = function (node) { return !!node && node.style.display !== 'none'; };

  Stage.move = function (node, x, y, w) {
    node.style.left = x + 'px';
    node.style.top = y + 'px';
    if (w !== undefined) node.style.width = w + 'px';
  };

  /* Ajusta o palco à janela (TVs 4K expõem 1920x1080 CSS; o resto é escalado). */
  Stage.fit = function (stage) {
    function apply() {
      var scale = Math.min(window.innerWidth / 1920, window.innerHeight / 1080) || 1;
      stage.style.transform = 'scale(' + scale + ')';
      stage.style.left = Math.round((window.innerWidth - 1920 * scale) / 2) + 'px';
      stage.style.top = Math.round((window.innerHeight - 1080 * scale) / 2) + 'px';
    }
    apply();
    window.addEventListener('resize', apply);
  };
}(window.EP));
