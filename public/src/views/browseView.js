/* Filmes e Séries — BrowseView do ELVANOQ Play Roku 0.1.88 (mesma geometria):
 *   cabeçalho (título, contagem, dica), painel de categorias 400x830 com 14
 *   linhas e contagem, grade 6x2 de pôsteres 200x300 com paginação automática
 *   (↓ na última fileira avança, ↑ na primeira volta) e rodapé do título focado.
 * Lista Xtream: categorias completas; os títulos chegam por categoria
 * (setCategoryItems) 350 ms depois que o controle para.
 */
(function (EP) {
  'use strict';
  var S = EP.Stage;
  var ROWS = 14, ROW_Y = 236, ROW_STRIDE = 52;
  var GRID_X = 504, GRID_Y = 226, POSTER_W = 200, POSTER_H = 300, GAP_X = 28, GAP_Y = 36, COLS = 6, PAGE = 12;

  function BrowseView(parent, kind) {
    var root = this.root = S.group(parent, { className: 'layer' });
    var self = this;
    this.kind = kind;
    this.events = new EP.Emitter();
    S.rect(root, { x: 0, y: 0, w: 1920, h: 1080, color: '0x070B14FF' });
    S.label(root, { x: 64, y: 64, w: 700, h: 52, text: kind === 'series' ? 'Séries' : 'Filmes', size: 40, weight: 700, css: 'letter-spacing:-0.02em' });
    this.countLabel = S.label(root, { x: 64, y: 118, w: 900, h: 28, size: 20, color: '0x8894A8FF', text: 'Carregando catálogo…' });
    S.label(root, { x: 1044, y: 118, w: 800, h: 28, size: 20, align: 'right', color: '0x8894A8FF', text: kind === 'series' ? '←  Categorias e Busca   •   OK  Temporadas e episódios' : '←  Categorias e Busca   •   OK  Detalhes e assistir' });

    S.el(root, { x: 64, y: 176, w: 400, h: 830, className: 'panel', css: 'background:#0d1422' });
    S.label(root, { x: 92, y: 196, w: 300, h: 26, text: 'CATEGORIAS', size: 18, weight: 700, color: '0x8894A8FF', css: 'letter-spacing:0.08em' });
    this.categoryFocus = S.el(root, { x: 76, y: ROW_Y, w: 376, h: 46, visible: false, css: 'border-radius:12px;background:#147dff;box-shadow:0 0 0 3px #00d7ff' });
    this.categoryMarker = S.el(root, { x: 76, y: ROW_Y, w: 4, h: 46, visible: false, css: 'border-radius:2px;background:#00d7ff' });
    this.rowLabels = []; this.rowCounts = [];
    for (var i = 0; i < ROWS; i++) {
      var label = S.label(root, { x: 92, y: ROW_Y + 6 + i * ROW_STRIDE, w: 290, h: 34, size: 22, color: '0xC9D3E3FF' });
      var count = S.label(root, { x: 384, y: ROW_Y + 9 + i * ROW_STRIDE, w: 56, h: 28, size: 18, align: 'right', color: '0x8894A8FF' });
      (function (row) {
        label.addEventListener('click', function () { self.focusArea = 'categories'; self.moveCategoryTo(self.categoryOffset + row); self.handleCategoryKey('OK'); });
      }(i));
      this.rowLabels.push(label); this.rowCounts.push(count);
    }
    this.categoryScroll = S.label(root, { x: 92, y: 966, w: 348, h: 28, size: 18, align: 'center', color: '0x8894A8FF' });

    this.eyebrow = S.label(root, { x: GRID_X, y: 186, w: 1340, h: 26, size: 18, weight: 700, color: '0x00D7FFFF', css: 'letter-spacing:0.08em' });
    this.grid = S.el(root, { x: GRID_X, y: GRID_Y, w: 1340, h: 640 });
    this.selectedTitle = S.label(root, { x: GRID_X, y: 904, w: 820, h: 44, size: 26, weight: 600 });
    this.selectedMeta = S.label(root, { x: GRID_X, y: 950, w: 820, h: 30, size: 20, color: '0x8894A8FF' });
    this.filterLabel = S.label(root, { x: 1344, y: 916, w: 500, h: 30, size: 20, align: 'right', color: '0x8894A8FF' });
    this.emptyState = S.label(root, { x: GRID_X, y: 500, w: 1340, h: 48, size: 24, align: 'center', color: '0x8894A8FF', visible: false });

    this.categories = []; this.allItems = []; this.selectedItems = [];
    this.categoryIndex = 0; this.categoryOffset = 0; this.page = 0; this.gridIndex = 0;
    this.focusArea = 'grid'; this.hasFocus = false; this.lazy = false; this.loadingId = '';
    this.search = { query: '', items: [], loading: false, error: '' };
    this.requestTimer = new EP.Timer(0.35, false, function () { self.requestCurrentCategory(); });
  }

  BrowseView.prototype.show = function (visible) { S.show(this.root, visible); };
  BrowseView.prototype.setContentFocus = function (focused) { this.hasFocus = focused; this.renderCategories(); this.updateGridFocus(); };

  function searchEntry() { return { name: 'Buscar título', key: '__search', total: -2, special: true }; }

  BrowseView.prototype.setCatalog = function (payload) {
    if (!payload) return;
    if (payload.lazy) { this.setLazyCatalog(payload.lazyCategories || []); return; }
    this.lazy = false;
    var items = payload.items || [], type = this.kind === 'series' ? 'series' : 'movies';
    var previous = this.categories[this.categoryIndex] ? this.categories[this.categoryIndex].name : '';
    var selected = [], order = [], counts = {};
    for (var i = 0; i < items.length; i++) {
      if (EP.PlaylistRules.catalogItemType(items[i]) !== type) continue;
      selected.push(items[i]);
      var c = EP.text(items[i].category) || 'Sem categoria', key = EP.lower(c);
      if (counts[key] === undefined) { counts[key] = 0; order.push(c); }
      counts[key]++;
    }
    this.allItems = selected;
    this.categories = [searchEntry(), { name: 'Todas', key: '', total: selected.length }];
    for (i = 0; i < order.length; i++) this.categories.push({ name: order[i], key: EP.lower(order[i]), total: counts[EP.lower(order[i])] });
    this.countLabel.textContent = EP.formatNumber(selected.length) + ' títulos   •   ' + EP.formatNumber(order.length) + ' categorias';
    this.categoryIndex = 1;
    for (i = 0; i < this.categories.length; i++) if (previous && this.categories[i].name === previous) this.categoryIndex = i;
    this.categoryOffset = 0;
    this.ensureCategoryVisible();
    this.applyCategory();
  };

  BrowseView.prototype.setLazyCatalog = function (categories) {
    var signature = categories.length + (categories.length ? ':' + categories[0].id + ':' + categories[categories.length - 1].id : '');
    if (this.lazy && this.lazySignature === signature) { this.renderCategories(); this.updateGridFocus(); return; }
    this.lazy = true; this.lazySignature = signature;
    this.categories = [searchEntry()];
    for (var i = 0; i < categories.length; i++) this.categories.push({ name: categories[i].name, key: categories[i].id, total: -1 });
    this.allItems = []; this.selectedItems = [];
    this.categoryIndex = this.categories.length > 1 ? 1 : 0;
    this.categoryOffset = 0; this.focusArea = 'grid';
    this.countLabel.textContent = EP.formatNumber(this.categories.length - 1) + ' categorias';
    if (this.categories.length === 1) {
      this.eyebrow.textContent = '';
      this.renderGrid([]);
      this.showEmpty('Nenhuma categoria encontrada na lista atual.');
      this.renderCategories();
      return;
    }
    this.applyCategory();
    this.requestCurrentCategory();
  };

  BrowseView.prototype.requestCurrentCategory = function () {
    if (!this.lazy || !this.categories.length) return;
    var category = this.categories[this.categoryIndex];
    if (category.special || this.loadingId === category.key) return;
    this.loadingId = category.key;
    this.events.emit('categoryRequested', { kind: this.kind, id: category.key, name: category.name });
  };

  BrowseView.prototype.setCategoryItems = function (payload) {
    if (!this.lazy || !payload || !this.categories.length || payload.id !== this.categories[this.categoryIndex].key) return;
    var category = this.categories[this.categoryIndex];
    if (!payload.error) category.total = payload.items.length;
    this.selectedItems = payload.items || [];
    this.serverTotal = payload.items && payload.items.serverTotal > this.selectedItems.length ? payload.items.serverTotal : 0;
    this.page = 0; this.gridIndex = 0;
    this.renderCategories();
    if (!this.selectedItems.length) { this.renderGrid([]); this.showEmpty(payload.error || 'Nenhum título nesta categoria.'); this.filterLabel.textContent = ''; this.updateSelectedCopy(); return; }
    S.show(this.emptyState, false);
    this.renderPage();
  };

  BrowseView.prototype.showEmpty = function (text) { this.emptyState.textContent = text; S.show(this.emptyState, true); };

  BrowseView.prototype.showSearchState = function () {
    this.requestTimer.stop();
    this.loadingId = '';
    this.page = 0; this.gridIndex = 0;
    this.renderCategories();
    if (!this.search.query) {
      this.selectedItems = [];
      this.eyebrow.textContent = 'BUSCA';
      this.renderGrid([]);
      this.showEmpty('Aperte OK para digitar o nome ' + (this.kind === 'series' ? 'da série.' : 'do filme.'));
      this.filterLabel.textContent = '';
      this.updateSelectedCopy();
      return;
    }
    this.showSearchResults();
  };

  BrowseView.prototype.showSearchResults = function () {
    this.selectedItems = this.search.items;
    this.page = 0; this.gridIndex = 0;
    this.eyebrow.textContent = 'RESULTADOS PARA "' + this.search.query.toUpperCase() + '"';
    if (this.search.loading) { this.renderGrid([]); this.showEmpty('Buscando em todo o catálogo…'); this.filterLabel.textContent = ''; this.updateSelectedCopy(); return; }
    if (!this.selectedItems.length) {
      this.renderGrid([]);
      this.showEmpty(this.search.error || 'Nada encontrado para "' + this.search.query + '". Aperte OK para buscar de novo.');
      this.filterLabel.textContent = '';
      this.updateSelectedCopy();
      return;
    }
    S.show(this.emptyState, false);
    this.renderPage();
  };

  BrowseView.prototype.setSearchResults = function (payload) {
    this.search = { query: payload.query, items: payload.items || [], loading: !!payload.loading, error: payload.error || '' };
    this.categoryIndex = 0;
    this.ensureCategoryVisible();
    if (!this.search.loading && this.search.items.length) this.focusArea = 'grid';
    this.renderCategories();
    this.showSearchResults();
    this.updateGridFocus();
  };

  BrowseView.prototype.applyCategory = function () {
    var category = this.categories[this.categoryIndex];
    if (!category) return;
    if (category.special) { this.showSearchState(); return; }
    this.page = 0; this.gridIndex = 0;
    this.eyebrow.textContent = category.name.toUpperCase();
    if (this.lazy) {
      this.selectedItems = [];
      this.renderGrid([]);
      this.showEmpty('Carregando ' + category.name + '…');
      this.filterLabel.textContent = '';
      this.renderCategories();
      this.updateSelectedCopy();
      // Espera o controle parar para pedir (rolar a lista não dispara um pedido por tecla).
      this.loadingId = '';
      this.requestTimer.start();
      return;
    }
    if (!category.key) this.selectedItems = this.allItems;
    else {
      var filtered = [];
      for (var i = 0; i < this.allItems.length; i++) if (EP.lower(EP.text(this.allItems[i].category) || 'Sem categoria') === category.key) filtered.push(this.allItems[i]);
      this.selectedItems = filtered;
    }
    this.renderCategories();
    if (!this.selectedItems.length) { this.renderGrid([]); this.showEmpty('Nenhum título encontrado na lista atual.'); this.filterLabel.textContent = ''; this.updateSelectedCopy(); return; }
    S.show(this.emptyState, false);
    this.renderPage();
  };

  BrowseView.prototype.ensureCategoryVisible = function () {
    if (this.categoryIndex < this.categoryOffset) this.categoryOffset = this.categoryIndex;
    if (this.categoryIndex >= this.categoryOffset + ROWS) this.categoryOffset = this.categoryIndex - ROWS + 1;
    if (this.categoryOffset < 0) this.categoryOffset = 0;
  };

  BrowseView.prototype.renderCategories = function () {
    var onList = this.focusArea === 'categories' && this.hasFocus;
    for (var row = 0; row < ROWS; row++) {
      var index = this.categoryOffset + row, label = this.rowLabels[row], count = this.rowCounts[row], c = this.categories[index];
      if (!c) { label.textContent = ''; count.textContent = ''; continue; }
      label.textContent = c.name;
      count.textContent = c.total < 0 ? '' : EP.formatNumber(c.total);
      var current = index === this.categoryIndex;
      var color = current ? (onList ? '#ffffff' : '#00d7ff') : (c.special ? '#00d7ff' : '#c9d3e3');
      label.style.color = color; label.style.fontWeight = current ? '600' : '400';
      count.style.color = current ? color : '#8894a8';
    }
    var y = ROW_Y + (this.categoryIndex - this.categoryOffset) * ROW_STRIDE;
    S.move(this.categoryFocus, 76, y); S.move(this.categoryMarker, 76, y);
    S.show(this.categoryFocus, onList);
    S.show(this.categoryMarker, !onList && this.categories.length > 0);
    this.categoryScroll.textContent = this.categories.length > ROWS ? (this.categoryIndex + 1) + ' de ' + this.categories.length : '';
  };

  BrowseView.prototype.renderGrid = function (items) {
    var self = this;
    this.grid.innerHTML = '';
    this.tiles = [];
    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      var p = S.el(this.grid, { x: (i % COLS) * (POSTER_W + GAP_X), y: Math.floor(i / COLS) * (POSTER_H + GAP_Y), w: POSTER_W, h: POSTER_H, className: 'poster' + (item.logo ? ' has-art' : '') });
      if (item.logo) { S.setPoster(p, item.logo); p.style.backgroundSize = 'cover'; }
      var fb = document.createElement('div'); fb.className = 'tile-fallback'; fb.textContent = EP.displayTitle(item.title); p.appendChild(fb);
      var q = EP.qualityOf(item.title);
      if (q) { var b = document.createElement('div'); b.className = 'badge'; b.textContent = q; p.appendChild(b); }
      (function (index) { p.addEventListener('click', function () { self.focusArea = 'grid'; self.gridIndex = index; self.updateGridFocus(); self.handleKey('OK'); }); }(i));
      this.tiles.push(p);
    }
  };

  BrowseView.prototype.renderPage = function () {
    if (!this.selectedItems.length) return;
    this.renderGrid(this.selectedItems.slice(this.page * PAGE, this.page * PAGE + PAGE));
    this.updateGridFocus();
    var total = Math.ceil(this.selectedItems.length / PAGE);
    // Categoria maior que o limite carregado: mostra quantos o servidor tem.
    var count = this.serverTotal && this.selectedItems.serverTotal === this.serverTotal
      ? EP.formatNumber(this.selectedItems.length) + ' de ' + EP.formatNumber(this.serverTotal) + ' títulos (use a busca para os demais)'
      : EP.formatNumber(this.selectedItems.length) + ' títulos';
    this.filterLabel.textContent = count + '   •   Página ' + (this.page + 1) + ' de ' + total;
  };

  BrowseView.prototype.updateGridFocus = function () {
    var show = this.hasFocus && this.focusArea === 'grid';
    for (var i = 0; i < (this.tiles || []).length; i++) S.focus(this.tiles[i], show && i === this.gridIndex);
    this.updateSelectedCopy();
  };

  BrowseView.prototype.updateSelectedCopy = function () {
    if (this.focusArea === 'categories' && this.categories[this.categoryIndex]) {
      var c = this.categories[this.categoryIndex];
      if (c.special) { this.selectedTitle.textContent = 'Buscar'; this.selectedMeta.textContent = 'OK  digitar o nome do título'; return; }
      this.selectedTitle.textContent = c.name;
      this.selectedMeta.textContent = c.total < 0 ? 'Carregando títulos…' : EP.formatNumber(c.total) + ' títulos   •   →  ou  OK para ver os títulos';
      return;
    }
    var item = this.selectedItems[this.page * PAGE + this.gridIndex];
    if (!item) { this.selectedTitle.textContent = ''; this.selectedMeta.textContent = ''; return; }
    this.selectedTitle.textContent = EP.displayTitle(item.title);
    var meta = item.category || '';
    if (parseFloat(item.rating) > 0) meta += '   •   Nota ' + (Math.round(parseFloat(item.rating) * 10) / 10);
    this.selectedMeta.textContent = meta;
  };

  BrowseView.prototype.moveCategoryTo = function (index) {
    index = Math.max(0, Math.min(this.categories.length - 1, index));
    if (index === this.categoryIndex) return;
    this.categoryIndex = index;
    this.ensureCategoryVisible();
    this.applyCategory();
  };

  BrowseView.prototype.handleKey = function (key) {
    if (this.focusArea === 'categories') return this.handleCategoryKey(key);
    if (!this.selectedItems.length) {
      if (key === 'left' && this.categories.length) { this.setFocusArea('categories'); return true; }
      if (key === 'OK' && this.categories[this.categoryIndex] && this.categories[this.categoryIndex].special) { this.events.emit('keyboardRequested'); return true; }
      return true;
    }
    var pageCount = Math.min(PAGE, this.selectedItems.length - this.page * PAGE), i = this.gridIndex;
    var total = Math.ceil(this.selectedItems.length / PAGE);
    if (key === 'right' && i < pageCount - 1 && i % COLS < COLS - 1) { this.gridIndex++; this.updateGridFocus(); return true; }
    if (key === 'left' && i % COLS > 0) { this.gridIndex--; this.updateGridFocus(); return true; }
    if (key === 'left') { this.setFocusArea('categories'); return true; }
    if (key === 'down' && i + COLS < pageCount) { this.gridIndex += COLS; this.updateGridFocus(); return true; }
    if (key === 'up' && i - COLS >= 0) { this.gridIndex -= COLS; this.updateGridFocus(); return true; }
    if (key === 'OK') { var item = this.selectedItems[this.page * PAGE + i]; if (item) this.events.emit('selectedItem', item); return true; }
    // Paginação automática: ↓ na última fileira avança, ↑ na primeira volta.
    if ((key === 'down' || key === 'channelDown') && this.page < total - 1) {
      var column = i % COLS;
      this.page++;
      this.gridIndex = Math.min(column, this.selectedItems.length - this.page * PAGE - 1);
      this.renderPage();
      return true;
    }
    if ((key === 'up' || key === 'channelUp') && this.page > 0) { this.page--; this.gridIndex = COLS + (i % COLS); this.renderPage(); return true; }
    if (key === 'options' && total > 1) { this.page = (this.page + 1) % total; this.gridIndex = 0; this.renderPage(); return true; }
    return true;
  };

  BrowseView.prototype.handleCategoryKey = function (key) {
    var total = this.categories.length;
    if (!total) return true;
    if (key === 'down') { this.moveCategoryTo(this.categoryIndex + 1); return true; }
    if (key === 'up') { this.moveCategoryTo(this.categoryIndex - 1); return true; }
    if (key === 'channelDown' || key === 'fwd') { this.moveCategoryTo(this.categoryIndex + ROWS); return true; }
    if (key === 'channelUp' || key === 'rev') { this.moveCategoryTo(this.categoryIndex - ROWS); return true; }
    if (key === 'right' || key === 'OK') {
      var c = this.categories[this.categoryIndex];
      if (c.special && (key === 'OK' || !this.selectedItems.length)) { this.events.emit('keyboardRequested'); return true; }
      if (this.selectedItems.length) this.setFocusArea('grid');
      return true;
    }
    return true;
  };

  BrowseView.prototype.setFocusArea = function (area) {
    this.focusArea = area;
    this.renderCategories();
    this.updateGridFocus();
  };

  BrowseView.prototype.refresh = function () { this.renderCategories(); this.updateGridFocus(); };

  EP.BrowseView = BrowseView;
}(window.EP));
