/* Busca — SearchView do ELVANOQ Play Roku 0.1.88 (mesma geometria): campo
 * 1100x68 com linha ciano, filtros Todos/Filmes/Séries/Canais e grade 8x2 de
 * pôsteres 200x300. Lista Xtream: busca em todo o catálogo (CatalogService).
 */
(function (EP) {
  'use strict';
  var S = EP.Stage;
  var FILTERS = ['Todos', 'Filmes', 'Séries', 'Canais'], TYPES = ['', 'movies', 'series', 'live'];
  var PLACEHOLDER = 'Buscar filmes, séries e canais';

  function SearchView(parent) {
    var root = this.root = S.group(parent, { className: 'layer' });
    var self = this;
    this.events = new EP.Emitter();
    S.rect(root, { x: 0, y: 0, w: 1920, h: 1080, color: '0x070B14FF' });
    S.label(root, { x: 64, y: 64, w: 600, h: 52, text: 'Busca', size: 40, weight: 700, css: 'letter-spacing:-0.02em' });
    this.field = S.el(root, { x: 64, y: 140, w: 1100, h: 68, css: 'border-radius:14px 14px 0 0;background:#111b2d' });
    S.el(root, { x: 64, y: 206, w: 1100, h: 2, css: 'background:#00d7ff' });
    var icon = S.el(root, { x: 88, y: 156, w: 36, h: 36, css: 'color:rgba(244,248,255,0.7)' });
    icon.appendChild(EP.icon('search', 36));
    this.queryLabel = S.label(root, { x: 140, y: 154, w: 990, h: 40, text: PLACEHOLDER, size: 26, color: '0x8894A8FF' });
    S.label(root, { x: 1184, y: 160, w: 672, h: 30, text: 'OK: digitar   •   ' + EP.OPTIONS_LABEL + ': filtro', size: 20, align: 'right', color: '0x8894A8FF' });
    this.field.addEventListener('click', function () { self.events.emit('keyboardRequested'); });
    this.queryLabel.addEventListener('click', function () { self.events.emit('keyboardRequested'); });
    this.chips = [];
    for (var i = 0; i < FILTERS.length; i++) {
      var chip = S.el(root, { x: 64 + i * 140, y: 236, w: 124, h: 44, text: FILTERS[i], css: 'border-radius:22px;text-align:center;line-height:44px;font-size:22px;color:#c9d3e3' });
      (function (index) { chip.addEventListener('click', function () { self.setFilter(index); }); }(i));
      this.chips.push(chip);
    }
    this.resultsTitle = S.label(root, { x: 64, y: 312, w: 1200, h: 34, text: 'Resultados', size: 26, weight: 600 });
    this.wall = new EP.PosterWall(root, { x: 64, y: 360, w: 1796, cols: 8, rows: 2, gapX: 28, gapY: 36 });
    this.wall.onSelect = function (entry) { self.events.emit('selectedItem', entry.item); };
    this.empty = S.label(root, { x: 64, y: 420, w: 1500, h: 42, size: 24, color: '0x8894A8FF', text: 'Aperte OK para digitar o que você procura.' });
    this.items = []; this.query = ''; this.filter = 0; this.hasFocus = false; this.lazy = false;
    this.remote = { items: [], loading: false, error: '' };
    this.render();
  }

  SearchView.prototype.show = function (visible) { S.show(this.root, visible); };
  SearchView.prototype.setContentFocus = function (focused) { this.hasFocus = focused; this.updateFocus(); };
  SearchView.prototype.setCatalog = function (payload) {
    this.lazy = !!(payload && payload.lazy);
    this.items = (payload && payload.items) || [];
    if (this.query && !this.lazy) this.render();
  };

  SearchView.prototype.setQuery = function (query) {
    this.query = EP.text(query);
    this.wall.index = 0; this.wall.rowOffset = 0;
    if (this.lazy && this.query) {
      this.remote = { items: [], loading: true, error: '' };
      this.events.emit('searchRequested', { query: this.query });
    }
    this.render();
  };

  SearchView.prototype.setResults = function (payload) {
    if (!payload || payload.query !== this.query) return;
    this.remote = { items: payload.items || [], loading: false, error: payload.error || '' };
    this.render();
  };

  SearchView.prototype.setFilter = function (index) {
    this.filter = index;
    this.wall.index = 0; this.wall.rowOffset = 0;
    this.render();
  };

  function normalize(value) {
    var s = EP.lower(EP.displayTitle(value));
    try { s = s.normalize('NFD').replace(/[̀-ͯ]/g, ''); } catch (_) {}
    return s;
  }

  SearchView.prototype.render = function () {
    var entries = [], type = TYPES[this.filter], i;
    this.queryLabel.textContent = this.query || PLACEHOLDER;
    this.queryLabel.style.color = this.query ? '#f4f8ff' : '#8894a8';
    var source = this.lazy ? this.remote.items : this.items;
    if (this.query) {
      var needle = normalize(this.query);
      for (i = 0; i < source.length && entries.length < 300; i++) {
        var item = source[i];
        if (type && EP.PlaylistRules.catalogItemType(item) !== type) continue;
        if (!this.lazy && normalize(item.title).indexOf(needle) === -1 && normalize(item.category).indexOf(needle) === -1) continue;
        entries.push({ item: item });
      }
    }
    this.wall.setEntries(entries);
    this.resultsTitle.textContent = this.query ? 'Resultados — ' + EP.formatNumber(entries.length) + ' encontrados' : 'Resultados';
    var empty = '';
    if (!this.query) empty = 'Aperte OK para digitar o que você procura.';
    else if (this.lazy && this.remote.loading) empty = 'Buscando em todo o catálogo…';
    else if (!entries.length) empty = this.remote.error || 'Nenhum ' + ['resultado', 'filme', 'série', 'canal'][this.filter] + ' encontrado para "' + this.query + '".';
    this.empty.textContent = empty;
    S.show(this.empty, !!empty);
    for (i = 0; i < this.chips.length; i++) {
      this.chips[i].style.background = i === this.filter ? '#147dff' : 'transparent';
      this.chips[i].style.color = i === this.filter ? '#ffffff' : '#c9d3e3';
      this.chips[i].style.fontWeight = i === this.filter ? '600' : '400';
    }
    this.updateFocus();
  };

  SearchView.prototype.updateFocus = function () { this.wall.setFocus(this.hasFocus && this.wall.entries.length > 0); };

  SearchView.prototype.handleKey = function (key) {
    if (key === 'options') { this.setFilter((this.filter + 1) % 4); return true; }
    if (!this.wall.entries.length) { if (key === 'OK') this.events.emit('keyboardRequested'); return true; }
    if (key === 'OK') { var c = this.wall.current(); if (c) this.events.emit('selectedItem', c.item); return true; }
    if (this.wall.move(key) === 'edge-up') this.events.emit('keyboardRequested');
    return true;
  };

  SearchView.prototype.handleBack = function () {
    if (this.query) { this.query = ''; this.remote = { items: [], loading: false, error: '' }; this.render(); return true; }
    return false;
  };

  EP.SearchView = SearchView;
}(window.EP));
