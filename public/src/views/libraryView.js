/* Minha Lista — LibraryView do ELVANOQ Play Roku 0.1.88 (mesma geometria):
 * abas Minha Lista / Favoritos / Continuar / Histórico e painel 1792x790 com
 * 12 linhas (título à esquerda; categoria e progresso à direita).
 */
(function (EP) {
  'use strict';
  var S = EP.Stage, LS = EP.LocalState;
  var TABS = [
    { key: 'watch_later', title: 'Minha Lista' }, { key: 'favorites', title: 'Favoritos' },
    { key: 'continue_watching', title: 'Continuar' }, { key: 'history', title: 'Histórico' }
  ];
  var ROWS = 12, ROW_Y = 256, STRIDE = 62;

  function LibraryView(parent) {
    var root = this.root = S.group(parent, { className: 'layer' });
    var self = this;
    this.events = new EP.Emitter();
    S.rect(root, { x: 0, y: 0, w: 1920, h: 1080, color: '0x070B14FF' });
    this.title = S.label(root, { x: 64, y: 64, w: 900, h: 52, text: 'Minha Lista', size: 40, weight: 700, css: 'letter-spacing:-0.02em' });
    this.tabFocus = S.el(root, { x: 64, y: 146, w: 200, h: 48, css: 'border-radius:24px;background:#147dff' });
    this.tabs = [];
    for (var t = 0; t < TABS.length; t++) {
      var tab = S.label(root, { x: 64 + t * 216, y: 146, w: 200, h: 48, text: TABS[t].title, size: 22, align: 'center', lineHeight: 48 });
      (function (index) { tab.addEventListener('click', function () { self.tab = index; self.index = 0; self.offset = 0; self.refresh(); }); }(t));
      this.tabs.push(tab);
    }
    S.el(root, { x: 64, y: 228, w: 1792, h: 790, className: 'panel', css: 'background:#0d1422' });
    this.itemFocus = S.el(root, { x: 76, y: ROW_Y, w: 1768, h: 54, visible: false, css: 'border-radius:12px;background:#147dff' });
    this.rowTitles = []; this.rowMetas = [];
    for (var r = 0; r < ROWS; r++) {
      var title = S.label(root, { x: 100, y: ROW_Y + 10 + r * STRIDE, w: 1240, h: 34, size: 24 });
      var meta = S.label(root, { x: 1360, y: ROW_Y + 12 + r * STRIDE, w: 470, h: 30, size: 20, align: 'right', color: '0x8894A8FF' });
      (function (row) { title.addEventListener('click', function () { self.index = self.offset + row; self.updateFocus(); self.handleKey('OK'); }); }(r));
      this.rowTitles.push(title); this.rowMetas.push(meta);
    }
    this.empty = S.label(root, { x: 100, y: ROW_Y + 10, w: 1600, h: 34, size: 24, color: '0x8894A8FF', visible: false, text: 'Nenhum item salvo nesta coleção ainda.' });
    S.label(root, { x: 64, y: 1030, w: 1500, h: 30, text: '←/→ trocar coleção   •   ↑/↓ selecionar   •   OK abrir   •   ' + EP.OPTIONS_LABEL + ' remover', size: 20, color: '0x8894A8FF' });
    this.tab = 0; this.index = 0; this.offset = 0; this.collection = []; this.hasFocus = false;
  }

  LibraryView.prototype.show = function (visible) { S.show(this.root, visible); };
  LibraryView.prototype.setContentFocus = function (focused) { this.hasFocus = focused; this.updateFocus(); };
  LibraryView.prototype.setResolver = function () {};

  LibraryView.prototype.refresh = function () {
    var state = LS.load();
    this.collection = (state[TABS[this.tab].key] || []).slice().reverse();
    if (this.index > this.collection.length - 1) this.index = Math.max(0, this.collection.length - 1);
    this.title.textContent = TABS[this.tab].title;
    S.move(this.tabFocus, 64 + this.tab * 216, 146);
    for (var t = 0; t < TABS.length; t++) { this.tabs[t].style.fontWeight = t === this.tab ? '600' : '400'; this.tabs[t].style.color = t === this.tab ? '#ffffff' : '#c9d3e3'; }
    S.show(this.empty, !this.collection.length);
    for (var r = 0; r < ROWS; r++) {
      var item = this.collection[this.offset + r];
      this.rowTitles[r].textContent = item ? EP.displayTitle(item.title || 'Sem título') : '';
      var meta = item ? (item.category || '') : '';
      if (item && item.progress_seconds && item.duration_seconds > 0) meta += (meta ? '   •   ' : '') + Math.floor(100 * item.progress_seconds / item.duration_seconds) + '%';
      this.rowMetas[r].textContent = meta;
    }
    this.updateFocus();
  };

  LibraryView.prototype.updateFocus = function () {
    var has = this.collection.length > 0;
    S.show(this.itemFocus, has);
    this.itemFocus.style.opacity = this.hasFocus ? '1' : '0.4';
    S.move(this.itemFocus, 76, ROW_Y + (this.index - this.offset) * STRIDE);
    for (var r = 0; r < ROWS; r++) this.rowMetas[r].style.color = this.offset + r === this.index && has ? '#d6deeb' : '#8894a8';
  };

  LibraryView.prototype.handleKey = function (key) {
    if (key === 'right' && this.tab < TABS.length - 1) { this.tab++; this.index = 0; this.offset = 0; this.refresh(); return true; }
    if (key === 'left' && this.tab > 0) { this.tab--; this.index = 0; this.offset = 0; this.refresh(); return true; }
    if (key === 'down' && this.index < this.collection.length - 1) { this.index++; this.viewport(); return true; }
    if (key === 'up' && this.index > 0) { this.index--; this.viewport(); return true; }
    if (key === 'OK' && this.collection.length) { this.events.emit('itemRequested', this.collection[this.index]); return true; }
    if (key === 'options' && this.collection.length) {
      var st = LS.load(), k = TABS[this.tab].key;
      st[k] = LS.remove(st[k], this.collection[this.index].id); LS.save(st); this.refresh();
      return true;
    }
    return true;
  };

  LibraryView.prototype.viewport = function () {
    if (this.index < this.offset) this.offset = this.index;
    else if (this.index >= this.offset + ROWS) this.offset = this.index - ROWS + 1;
    this.refresh();
  };

  EP.LibraryView = LibraryView;
}(window.EP));
