/* PosterWall: grade de pôsteres com rolagem por linhas, foco ciano e
 * ampliação (Android PosterCard em TV). Usada por Busca e Minha Lista.
 * Itens: { item, progress? } — item no modelo do catálogo.
 */
(function (EP) {
  'use strict';
  var S = EP.Stage;

  function PosterWall(parent, opts) {
    this.opts = opts; // x, y, w, cols, rows, gapX, gapY
    this.posterW = Math.floor((opts.w - opts.gapX * (opts.cols - 1)) / opts.cols);
    this.posterH = Math.round(this.posterW * 1.5);
    this.stride = this.posterH + opts.gapY;
    var viewport = S.el(parent, { x: opts.x - 24, y: opts.y - 24, w: opts.w + 48, h: opts.rows * this.stride + 24, css: 'overflow:hidden' });
    this.node = S.el(viewport, { x: 24, y: 24, w: opts.w, h: 4000, className: 'scroller' });
    this.entries = []; this.index = 0; this.rowOffset = 0; this.focused = false; this.tiles = {};
    this.onSelect = null;
  }

  PosterWall.prototype.setEntries = function (entries) {
    this.entries = entries || [];
    this.index = Math.min(this.index, Math.max(0, this.entries.length - 1));
    this.rowOffset = Math.min(this.rowOffset, Math.max(0, Math.floor(this.index / this.opts.cols)));
    this.renderedFor = null; // lista nova: recria todos os blocos
    this.render();
  };

  /* Rolar uma linha não recria a grade: os blocos que continuam na janela são
   * mantidos (sem decodificar a imagem de novo), só os que saem são removidos
   * e só os que entram são criados. Em TVs de 2016–2019 isso tira o engasgo. */
  PosterWall.prototype.render = function () {
    var o = this.opts;
    if (this.renderedFor !== this.entries) {
      this.node.innerHTML = '';
      this.tiles = {};
      this.renderedFor = this.entries;
    }
    var first = Math.max(0, this.rowOffset - 1) * o.cols, last = Math.min(this.entries.length, (this.rowOffset + o.rows + 1) * o.cols);
    for (var k in this.tiles) {
      if (!Object.prototype.hasOwnProperty.call(this.tiles, k)) continue;
      var n = Number(k);
      if (n < first || n >= last) { this.node.removeChild(this.tiles[k]); delete this.tiles[k]; }
    }
    for (var i = first; i < last; i++) if (!this.tiles[i]) this.tiles[i] = this.createTile(i);
    this.node.style.transform = 'translateY(-' + (this.rowOffset * this.stride) + 'px)';
    this.updateFocus();
  };

  PosterWall.prototype.createTile = function (i) {
    var self = this, o = this.opts, entry = this.entries[i], item = entry.item;
    var p = S.el(this.node, { x: (i % o.cols) * (this.posterW + o.gapX), y: Math.floor(i / o.cols) * this.stride, w: this.posterW, h: this.posterH, className: 'poster' + (item.logo ? ' has-art' : '') });
    if (item.logo) { S.setPoster(p, item.logo); p.style.backgroundSize = item.type === 'live' ? 'contain' : 'cover'; }
    var fb = document.createElement('div'); fb.className = 'tile-fallback'; fb.textContent = EP.displayTitle(item.title); p.appendChild(fb);
    var tag = item.type === 'live' ? 'AO VIVO' : EP.qualityOf(item.title);
    if (tag) { var b = document.createElement('div'); b.className = 'badge'; b.textContent = tag; p.appendChild(b); }
    if (entry.progress > 0) {
      var track = document.createElement('div'); track.className = 'progress-track';
      var fill = document.createElement('div'); fill.className = 'progress-fill'; fill.style.width = Math.round(Math.min(1, entry.progress) * 100) + '%';
      track.appendChild(fill); p.appendChild(track);
    }
    p.addEventListener('click', function () { self.index = i; self.updateFocus(); if (self.onSelect) self.onSelect(self.entries[i], i); });
    return p;
  };

  PosterWall.prototype.setFocus = function (focused) { this.focused = focused; this.updateFocus(); };

  PosterWall.prototype.updateFocus = function () {
    for (var k in this.tiles) if (Object.prototype.hasOwnProperty.call(this.tiles, k)) S.focus(this.tiles[k], this.focused && Number(k) === this.index);
  };

  PosterWall.prototype.current = function () { return this.entries[this.index]; };

  /* Retorna 'edge-left' / 'edge-up' quando o foco deve sair da grade. */
  PosterWall.prototype.move = function (key) {
    var cols = this.opts.cols, i = this.index, n = this.entries.length;
    if (!n) return key === 'left' ? 'edge-left' : key === 'up' ? 'edge-up' : 'none';
    if (key === 'left') { if (i % cols === 0) return 'edge-left'; i--; }
    else if (key === 'right') { if (i % cols === cols - 1 || i >= n - 1) return 'none'; i++; }
    else if (key === 'up') { if (i < cols) return 'edge-up'; i -= cols; }
    else if (key === 'down') { if (i + cols < n) i += cols; else if (Math.floor(i / cols) < Math.floor((n - 1) / cols)) i = n - 1; else return 'none'; }
    else return 'none';
    this.index = i;
    var row = Math.floor(i / cols);
    if (row < this.rowOffset) { this.rowOffset = row; this.render(); }
    else if (row >= this.rowOffset + this.opts.rows) { this.rowOffset = row - this.opts.rows + 1; this.render(); }
    else this.updateFocus();
    return 'moved';
  };

  EP.PosterWall = PosterWall;
}(window.EP));
