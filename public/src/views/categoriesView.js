/* Ajustes > Categorias visíveis (1.1.0): abas Ao vivo / Filmes / Séries e
 * linhas Visível / Oculta. OK alterna; ←/→ trocam a aba. Gravado por lista
 * (EP.CategoryVisibility). As ocultas somem das categorias, de "Todos" e das
 * grades da lista ativa.
 */
(function (EP) {
  'use strict';
  var S = EP.Stage, CV = EP.CategoryVisibility;
  var TABS = [{ kind: 'live', label: 'Ao vivo' }, { kind: 'movies', label: 'Filmes' }, { kind: 'series', label: 'Séries' }];
  var ROWS = 12, ROW_Y = 300, STRIDE = 58;

  function CategoriesView(parent) {
    var self = this;
    this.events = new EP.Emitter();
    var page = EP.premiumPage(parent, 'Categorias visíveis', 'Escolha o que aparece nesta lista   •   OK mostra ou oculta');
    this.root = page.root;
    this.tabs = [];
    for (var t = 0; t < TABS.length; t++) {
      var tab = S.el(this.root, { x: 64 + t * 196, y: 176, w: 180, h: 52, text: TABS[t].label, className: 'premium-tab' });
      (function (index) { tab.addEventListener('click', function () { self.tab = index; self.selected = 0; self.render(); }); }(t));
      this.tabs.push(tab);
    }
    this.counter = S.label(this.root, { x: 1156, y: 190, w: 700, h: 30, size: 20, align: 'right', color: '0x8894A8FF' });
    S.el(this.root, { x: 64, y: 252, w: 1792, h: 756, className: 'premium-card' });
    this.rows = [];
    for (var r = 0; r < ROWS; r++) {
      var row = S.el(this.root, { x: 88, y: ROW_Y + r * STRIDE, w: 1744, h: 50, className: 'premium-row compact' });
      row.innerHTML = '<span class="pr-label"></span><span class="pr-state"></span>';
      (function (index) { row.addEventListener('click', function () { self.selected = self.offset + index; self.toggle(); }); }(r));
      this.rows.push(row);
    }
    this.empty = S.label(this.root, { x: 112, y: 300, w: 1600, h: 40, size: 24, color: '0xB8C4D6FF', text: 'Nenhuma categoria nesta aba.' });
    S.label(this.root, { x: 64, y: 1028, w: 1792, h: 26, text: '←/→ trocar aba   •   ↑/↓ escolher   •   OK mostrar/ocultar   •   Voltar Ajustes', size: 18, color: '0x63728AFF' });
    this.lists = {}; this.tab = 0; this.selected = 0; this.offset = 0; this.hasFocus = false;
  }

  CategoriesView.prototype.show = function (visible) { S.show(this.root, visible); if (visible) this.render(); };
  CategoriesView.prototype.setContentFocus = function (focused) { this.hasFocus = focused; this.render(); };
  CategoriesView.prototype.setLists = function (lists) { this.lists = lists || {}; this.selected = 0; this.offset = 0; };
  CategoriesView.prototype.current = function () { return this.lists[TABS[this.tab].kind] || []; };

  CategoriesView.prototype.render = function () {
    var kind = TABS[this.tab].kind, list = this.current(), hidden = CV.hiddenMap(kind), nHidden = 0, i;
    for (i = 0; i < list.length; i++) if (hidden[list[i].id]) nHidden++;
    for (i = 0; i < TABS.length; i++) S.toggle(this.tabs[i], 'active', i === this.tab);
    this.counter.textContent = list.length ? EP.formatNumber(list.length) + ' categorias   •   ' + nHidden + (nHidden === 1 ? ' oculta' : ' ocultas') : '';
    if (this.selected >= list.length) this.selected = Math.max(0, list.length - 1);
    if (this.selected < this.offset) this.offset = this.selected;
    else if (this.selected >= this.offset + ROWS) this.offset = this.selected - ROWS + 1;
    S.show(this.empty, !list.length);
    for (var r = 0; r < ROWS; r++) {
      var entry = list[this.offset + r], row = this.rows[r];
      row.style.display = entry ? 'flex' : 'none';
      if (!entry) continue;
      var isHidden = !!hidden[entry.id];
      row.children[0].textContent = entry.name;
      row.children[1].textContent = isHidden ? 'Oculta' : 'Visível';
      S.toggle(row.children[1], 'off', isHidden);
      S.toggle(row, 'dimmed', isHidden);
      S.toggle(row, 'focused', this.hasFocus && this.offset + r === this.selected);
    }
  };

  CategoriesView.prototype.toggle = function () {
    var list = this.current(), entry = list[this.selected];
    if (!entry) return;
    CV.toggle(TABS[this.tab].kind, entry.id);
    this.render();
    this.events.emit('changed');
  };

  CategoriesView.prototype.handleKey = function (key) {
    var list = this.current();
    if (key === 'left' && this.tab > 0) { this.tab--; this.selected = 0; this.offset = 0; }
    else if (key === 'right' && this.tab < TABS.length - 1) { this.tab++; this.selected = 0; this.offset = 0; }
    else if (key === 'down' || key === 'channelDown') this.selected = Math.min(list.length - 1, this.selected + (key === 'down' ? 1 : ROWS));
    else if (key === 'up' || key === 'channelUp') this.selected = Math.max(0, this.selected - (key === 'up' ? 1 : ROWS));
    else if (key === 'OK') { this.toggle(); return true; }
    this.render();
    return true;
  };

  EP.CategoriesView = CategoriesView;
}(window.EP));
