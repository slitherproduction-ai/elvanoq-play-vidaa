/* Diálogo de lista no padrão premium (1.1.0): opções do canal (AZUL) e
 * "Rever programas". ↑/↓ escolhem, OK confirma, Voltar fecha.
 * opts: { title, subtitle, items: [{ label, meta, badge }], emptyText,
 *         loading, onSelect(index, item), onClose() }
 */
(function (EP) {
  'use strict';
  var S = EP.Stage, ROWS = 8, ROW_H = 68;

  function ListDialog(stage, opts) {
    var self = this;
    this.opts = opts || {};
    this.closed = false;
    var root = this.root = S.group(stage, { className: 'layer kb-backdrop' });
    S.rect(root, { x: 0, y: 0, w: 1920, h: 1080, color: '0x02070DCC' });
    var height = 176 + ROWS * ROW_H;
    var top = Math.round((1080 - height) / 2);
    S.el(root, { x: 460, y: top, w: 1000, h: height, className: 'premium-card', css: 'background:rgba(11,18,30,0.97)' });
    S.el(root, { x: 460, y: top, w: 1000, h: 160, css: 'border-radius:16px 16px 0 0;background:linear-gradient(rgba(20,125,255,0.22),rgba(20,125,255,0))' });
    S.label(root, { x: 508, y: top + 40, w: 904, h: 44, text: this.opts.title || '', size: 32, weight: 700 });
    this.subtitle = S.label(root, { x: 508, y: top + 90, w: 904, h: 30, text: this.opts.subtitle || '', size: 20, color: '0x8894A8FF' });
    this.rows = [];
    for (var i = 0; i < ROWS; i++) {
      var row = S.el(root, { x: 492, y: top + 140 + i * ROW_H, w: 936, h: ROW_H - 8, className: 'premium-row' });
      row.innerHTML = '<span class="pr-label"></span><span class="pr-badge"></span><span class="pr-meta"></span>';
      (function (index) { row.addEventListener('click', function () { self.selected = self.offset + index; self.choose(); }); }(i));
      this.rows.push(row);
    }
    this.empty = S.label(root, { x: 508, y: top + 160, w: 904, h: 60, size: 24, color: '0xB8C4D6FF' });
    S.label(root, { x: 508, y: top + height - 34, w: 904, h: 24, text: '↑/↓ escolher   •   OK confirmar   •   Voltar fechar', size: 18, color: '0x63728AFF' });
    this.selected = 0; this.offset = 0;
    this.setItems(this.opts.items || [], this.opts.emptyText, this.opts.loading);
  }

  ListDialog.prototype.setItems = function (items, emptyText, loading) {
    this.items = items || [];
    this.selected = 0; this.offset = 0;
    this.empty.textContent = loading ? 'Carregando…' : (emptyText || 'Nada para mostrar.');
    S.show(this.empty, !this.items.length);
    this.render();
  };

  ListDialog.prototype.setSubtitle = function (text) { this.subtitle.textContent = text || ''; };

  ListDialog.prototype.render = function () {
    for (var i = 0; i < ROWS; i++) {
      var item = this.items[this.offset + i], row = this.rows[i];
      row.style.display = item ? 'flex' : 'none';
      if (!item) continue;
      row.children[0].textContent = item.label || '';
      row.children[1].textContent = item.badge || '';
      row.children[1].style.display = item.badge ? 'inline-block' : 'none';
      row.children[2].textContent = item.meta || '';
      S.toggle(row, 'focused', this.offset + i === this.selected);
    }
  };

  ListDialog.prototype.handleKey = function (key) {
    if (key === 'back') { this.close(); if (this.opts.onClose) this.opts.onClose(); return true; }
    if (!this.items.length) return true;
    if (key === 'down' || key === 'channelDown') this.move(key === 'down' ? 1 : ROWS);
    else if (key === 'up' || key === 'channelUp') this.move(key === 'up' ? -1 : -ROWS);
    else if (key === 'OK') this.choose();
    return true;
  };

  ListDialog.prototype.move = function (delta) {
    this.selected = Math.max(0, Math.min(this.items.length - 1, this.selected + delta));
    if (this.selected < this.offset) this.offset = this.selected;
    else if (this.selected >= this.offset + ROWS) this.offset = this.selected - ROWS + 1;
    this.render();
  };

  ListDialog.prototype.choose = function () {
    var item = this.items[this.selected];
    if (item && this.opts.onSelect) this.opts.onSelect(this.selected, item);
  };

  ListDialog.prototype.close = function () {
    if (this.closed) return;
    this.closed = true;
    if (this.root.parentNode) this.root.parentNode.removeChild(this.root);
  };

  EP.ListDialog = ListDialog;
}(window.EP));
