/* AppShell no formato hub do Roku 0.1.88: sem menu lateral. A Home abre as
 * seções pelos blocos; Voltar retorna à Home com o foco no bloco de origem.
 * Também concentra catálogo, guia, metadados, detalhes, parental e player.
 *
 * Catálogo Xtream sob demanda (igual ao AppShell.brs): na carga só vêm as
 * categorias e uma semente para o Início; cada categoria é baixada quando a
 * seção pede, com cache LRU (10 categorias / 12.000 itens) — cabe na memória
 * da TV mesmo com listas de centenas de milhares de títulos.
 */
(function (EP) {
  'use strict';
  var S = EP.Stage, LS = EP.LocalState, P = EP.Parental, Portal = EP.Portal;
  var HOME = 0, LIVE = 1, MOVIES = 2, SERIES = 3, SEARCH = 4, LIBRARY = 5, SETTINGS = 6;
  var CATEGORY_LIMIT = 5000, CACHE_CATEGORIES = 10, CACHE_ITEMS = 12000;
  var KIND_OF = {}; KIND_OF[LIVE] = 'live'; KIND_OF[MOVIES] = 'movies'; KIND_OF[SERIES] = 'series';

  function AppShell(stage, app) {
    var self = this;
    this.app = app;
    var root = this.root = S.group(stage, { className: 'layer', visible: false });
    this.epg = new EP.EpgService();
    this.views = [
      new EP.HomeView(root), new EP.LiveTVView(root, this.epg), new EP.BrowseView(root, 'movies'), new EP.BrowseView(root, 'series'),
      new EP.SearchView(root), new EP.LibraryView(root), new EP.SettingsView(root, this.settingsProvider())
    ];
    this.parentalView = this.views[SETTINGS].parental;
    this.detailView = new EP.DetailView(root);
    this.playerView = new EP.PlayerView(root);
    this.catalog = null; this.categories = null; this.xtream = null; this.lazy = false; this.visibilityVersion = 0;
    this.resetCategoryCache();
    this.selectedIndex = HOME;
    this.bindViews();
    this.showSection();
  }

  AppShell.prototype.isVisible = function () { return S.isVisible(this.root); };
  AppShell.prototype.show = function (visible) { S.show(this.root, visible); if (visible) this.showSection(); };

  AppShell.prototype.bindViews = function () {
    var self = this, v = this.views;
    var openOrPlay = function (item) { if (item.type === 'live') self.playLiveItem(item, [item], 0); else self.openCatalogItem(item); };
    v[HOME].events.on('navigate', function (index) { self.openSection(index); });
    v[HOME].events.on('playRequested', function (item) { self.playCatalogItem(item, LS.resumePositionFor(item)); });
    v[HOME].events.on('selectedItem', function (item) {
      var resume = LS.resumePositionFor(item);
      if (item.type === 'movies' && resume > 0) self.playCatalogItem(item, resume); else openOrPlay(item);
    });
    v[LIVE].events.on('playRequested', function (r) { self.playLiveItem(r.item, r.channels, r.index); });
    v[MOVIES].events.on('selectedItem', openOrPlay);
    v[SERIES].events.on('selectedItem', openOrPlay);
    v[LIVE].events.on('categoryRequested', function (r) { self.requestCategory(LIVE, r); });
    v[LIVE].events.on('optionsRequested', function (r) { self.openChannelOptions(r.item); });
    v[LIVE].events.on('searchRequested', function (r) { self.openLiveSearchKeyboard(r.column); });
    v[MOVIES].events.on('categoryRequested', function (r) { self.requestCategory(MOVIES, r); });
    v[SERIES].events.on('categoryRequested', function (r) { self.requestCategory(SERIES, r); });
    v[SEARCH].events.on('searchRequested', function (r) { self.runGlobalSearch(r.query); });
    v[MOVIES].events.on('keyboardRequested', function () { self.openBrowseKeyboard(MOVIES); });
    v[SERIES].events.on('keyboardRequested', function () { self.openBrowseKeyboard(SERIES); });
    v[SEARCH].events.on('selectedItem', openOrPlay);
    v[SEARCH].events.on('keyboardRequested', function () { self.openSearchKeyboard(); });
    v[LIBRARY].events.on('itemRequested', function (saved) { self.onLibraryItemRequested(saved); });
    v[SETTINGS].events.on('action', function (action) { self.onSettingsAction(action); });
    v[SETTINGS].events.on('visibilityChanged', function () { self.onVisibilityChanged(); });
    var d = this.detailView, p = this.playerView;
    d.events.on('closeRequested', function () { d.show(false); self.refreshCurrent(true); });
    d.events.on('selectedItem', function (item) { self.openCatalogItem(item); });
    d.events.on('playRequested', function (item) { self.playCatalogItem(item, LS.resumePositionFor(item)); });
    d.events.on('trailerRequested', function (t) {
      if (P.isBlockedItem(t.category, t.id)) return;
      self.startPlayback({ streamUrl: t.url, id: t.id, title: t.title, category: t.category, resumePosition: 0, persistEnabled: false, skipIntroEnd: 0, nextEpisode: null, liveQueue: [] });
    });
    d.events.on('episodeRequested', function (ep) {
      if (P.isBlockedItem(ep.category, ep.parentId)) return;
      self.episodeQueue = ep.queue || [ep]; self.episodeQueueIndex = 0;
      self.playEpisode(ep);
    });
    p.events.on('closeRequested', function () {
      var c = p.content, liveItem = c && c.liveQueue && c.liveQueue.length ? c.liveQueue[c.liveIndex] : null;
      self.clearEpisodeQueue();
      self.homeDirty = true; // Continuar assistindo mudou
      if (d.isVisible() && d.item) { d.updateCollectionButtons(); d.renderLower(); d.updateFocus(); }
      // O carrossel parou durante o vídeo; refreshCurrent o retoma (via setActive ou setCatalog).
      if (self.selectedIndex === HOME) self.views[HOME].isActive = true;
      self.refreshCurrent(true);
      // Ao vivo: a lista volta com o canal que estava tocando e a prévia nele.
      if (liveItem && self.selectedIndex === LIVE && !d.isVisible()) self.views[LIVE].returnToChannel(liveItem.id);
    });
    p.events.on('channelRequested', function (r) { self.playLiveItem(r.item, p.content.liveQueue, r.index); });
    p.events.on('favoriteRequested', function (r) {
      var item = self.resolveCatalogItem(r);
      if (item) LS.toggle('favorites', item);
    });
    p.events.on('nextEpisodeRequested', function () { self.onNextEpisodeRequested(); });
  };

  /* ---------- navegação ---------- */
  AppShell.prototype.openSection = function (index) {
    this.selectedIndex = index;
    this.showSection();
    if (index === SEARCH && !this.views[SEARCH].query) this.openSearchKeyboard();
  };

  AppShell.prototype.returnToHome = function () {
    var from = this.selectedIndex;
    this.selectedIndex = HOME;
    this.showSection();
    this.views[HOME].focusTile(from);
  };

  AppShell.prototype.showSection = function () {
    var index = this.selectedIndex;
    for (var i = 0; i < this.views.length; i++) {
      this.views[i].show(i === index);
      this.views[i].setContentFocus(i === index);
    }
    this.views[HOME].setActive(index === HOME);
    if (index !== LIVE) this.views[LIVE].stopPreview();
    this.refreshCurrent(false);
  };

  AppShell.prototype.handleKey = function (key) {
    if (this.playerView.isVisible()) return this.playerView.handleKey(key);
    if (this.detailView.isVisible()) return this.detailView.handleKey(key);
    var view = this.views[this.selectedIndex];
    if (key === 'back') {
      if (view.handleBack && view.handleBack()) return true;
      if (this.selectedIndex === HOME) return false; // sai do aplicativo
      this.returnToHome();
      return true;
    }
    view.handleKey(key);
    return true;
  };

  AppShell.prototype.refreshCurrent = function (force) {
    var index = this.selectedIndex;
    if (index === LIBRARY) this.views[LIBRARY].refresh();
    if (index === SETTINGS) this.views[SETTINGS].setInfo(this.app.settingsInfo());
    if (!this.catalog) return;
    if (index === HOME && this.homeDirty && this.renderedVersion) { this.homeDirty = false; this.renderedVersion[HOME] = -1; }
    this.renderedVersion = this.renderedVersion || {};
    if (this.renderedVersion[index] === this.catalogVersion) {
      if (force && (index === MOVIES || index === SERIES)) this.views[index].refresh();
      if (index === HOME && force) this.views[HOME].setActive(true);
      return;
    }
    if (index !== LIBRARY) this.views[index].setCatalog(this.payload());
    this.renderedVersion[index] = this.catalogVersion;
  };

  AppShell.prototype.payload = function (index) {
    var self = this;
    if (index === undefined) index = this.selectedIndex;
    var CV = EP.CategoryVisibility;
    var base = {
      items: this.visibleCatalog(), categories: this.visibleCategoryNames(),
      metadataLoader: function (item, cb) { EP.MetadataService.load(item, self.xtream).then(cb); }
    };
    if (index === HOME) base.items = this.filterVisible(this.homeItems());
    if (index === SETTINGS) {
      base.items = this.pool().slice(0, 3000); base.categories = this.allCategoryNames();
      base.categoryLists = { live: this.categoryList('live'), movies: this.categoryList('movies'), series: this.categoryList('series') };
    }
    if (!this.lazy) return base;
    if (index === LIVE) return { lazy: true, liveCategories: CV.filterCategories('live', this.liveCategories), favorites: this.savedItems('live') };
    if (index === MOVIES) return { lazy: true, lazyCategories: CV.filterCategories('movies', this.movieCategories) };
    if (index === SERIES) return { lazy: true, lazyCategories: CV.filterCategories('series', this.seriesCategories) };
    if (index === SEARCH) return { lazy: true, items: [] };
    return base;
  };

  /* ---------- categorias visíveis ----------
   * [{id, name}] por tipo. Xtream usa o id da categoria; M3U usa o nome. */
  AppShell.prototype.categoryList = function (kind) {
    if (this.lazy) return (kind === 'live' ? this.liveCategories : kind === 'movies' ? this.movieCategories : this.seriesCategories) || [];
    var out = [], seen = {}, items = this.catalog || [];
    for (var i = 0; i < items.length; i++) {
      var it = items[i], type = it.type || 'live', name = it.category;
      if (type !== kind || !name || seen[name]) continue;
      seen[name] = true; out.push({ id: name, name: name });
    }
    return out;
  };

  /* Mapas de nomes ocultos por tipo, refeitos só quando algo muda. */
  AppShell.prototype.hiddenNames = function () {
    var stamp = this.catalogVersion + ':' + this.visibilityVersion;
    if (this.hiddenCache && this.hiddenCacheStamp === stamp) return this.hiddenCache;
    var CV = EP.CategoryVisibility, map = {}, any = false;
    for (var k = 0; k < CV.KINDS.length; k++) {
      var kind = CV.KINDS[k];
      map[kind] = CV.hiddenNames(kind, this.categoryList(kind));
      for (var n in map[kind]) if (map[kind].hasOwnProperty(n)) { any = true; break; }
    }
    map.any = any;
    this.hiddenCache = map; this.hiddenCacheStamp = stamp;
    return map;
  };

  AppShell.prototype.filterVisible = function (items) {
    var hidden = this.hiddenNames();
    if (!hidden.any || !items) return items || [];
    var out = [];
    for (var i = 0; i < items.length; i++) {
      var it = items[i], names = hidden[it.type || 'live'];
      if (!names || !names[it.category]) out.push(it);
    }
    return out;
  };

  AppShell.prototype.visibleCatalog = function () {
    var stamp = this.catalogVersion + ':' + this.visibilityVersion;
    if (this.visibleCatalogStamp !== stamp) { this.visibleCatalogCache = this.filterVisible(this.catalog || []); this.visibleCatalogStamp = stamp; }
    return this.visibleCatalogCache;
  };

  AppShell.prototype.visibleCategoryNames = function () {
    var hidden = this.hiddenNames(), list = this.categories || [];
    if (!hidden.any) return list;
    var out = [];
    for (var i = 0; i < list.length; i++) if (!hidden.live[list[i]] && !hidden.movies[list[i]] && !hidden.series[list[i]]) out.push(list[i]);
    return out;
  };

  AppShell.prototype.onVisibilityChanged = function () {
    this.visibilityVersion = (this.visibilityVersion || 0) + 1;
    this.renderedVersion = {}; // todas as seções refazem as listas na próxima abertura
  };

  AppShell.prototype.allCategoryNames = function () {
    if (!this.lazy) return this.categories || [];
    var names = [], seen = {}, lists = [this.liveCategories, this.movieCategories, this.seriesCategories];
    for (var l = 0; l < lists.length; l++) for (var i = 0; i < lists[l].length; i++) {
      var name = lists[l][i].name;
      if (name && !seen[name]) { seen[name] = true; names.push(name); }
    }
    return names;
  };

  /* ---------- catálogo sob demanda ---------- */
  AppShell.prototype.resetCategoryCache = function () {
    this.categoryCache = {}; this.categoryOrder = []; this.categoryPending = {}; this.poolVersion = (this.poolVersion || 0) + 1;
  };

  AppShell.prototype.requestCategory = function (index, request) {
    var self = this, view = this.views[index], kind = KIND_OF[index];
    if (!this.lazy || !this.xtream || !request) return;
    var key = kind + ':' + request.id, cached = this.categoryCache[key];
    if (cached) { this.touchCategory(key); view.setCategoryItems({ id: request.id, items: cached }); return; }
    if (this.categoryPending[key]) return;
    var token = this.catalogToken;
    this.categoryPending[key] = true;
    EP.CatalogService.loadCategory(this.xtream, kind, { id: request.id, name: request.name }, CATEGORY_LIMIT).then(function (result) {
      if (token !== self.catalogToken) return;
      delete self.categoryPending[key];
      if (result.ok) self.storeCategory(key, result.items);
      view.setCategoryItems({ id: request.id, items: result.items || [], error: result.ok ? '' : result.error });
    });
  };

  AppShell.prototype.touchCategory = function (key) {
    var order = this.categoryOrder, at = order.indexOf(key);
    if (at >= 0) order.splice(at, 1);
    order.push(key);
  };

  AppShell.prototype.storeCategory = function (key, items) {
    this.categoryCache[key] = items;
    this.touchCategory(key);
    var total = 0, k;
    for (k in this.categoryCache) total += this.categoryCache[k].length;
    while (this.categoryOrder.length > 1 && (this.categoryOrder.length > CACHE_CATEGORIES || total > CACHE_ITEMS)) {
      var oldest = this.categoryOrder.shift();
      total -= this.categoryCache[oldest].length;
      delete this.categoryCache[oldest];
    }
    this.poolVersion++;
  };

  /* Itens conhecidos agora: semente + categorias em cache. */
  AppShell.prototype.pool = function () {
    if (!this.lazy) return this.catalog || [];
    if (this.poolCache && this.poolCacheVersion === this.poolVersion) return this.poolCache;
    var out = (this.catalog || []).slice(), seen = {}, i;
    for (i = 0; i < out.length; i++) seen[out[i].id] = true;
    for (var c = 0; c < this.categoryOrder.length; c++) {
      var items = this.categoryCache[this.categoryOrder[c]];
      for (i = 0; i < items.length; i++) if (!seen[items[i].id]) { seen[items[i].id] = true; out.push(items[i]); }
    }
    this.poolCache = out; this.poolCacheVersion = this.poolVersion;
    return out;
  };

  /* Favoritos/Continuar/Histórico recriados a partir do salvo (sem URL salva). */
  AppShell.prototype.savedItems = function (kind) {
    var state = LS.load(), out = [], seen = {}, lists = [state.continue_watching, state.favorites, state.watch_later, state.history];
    for (var l = 0; l < lists.length; l++) for (var i = lists[l].length - 1; i >= 0; i--) {
      var saved = lists[l][i];
      if (seen[saved.id] || (kind && saved.kind !== kind) || saved.id.indexOf(':episode:') !== -1) continue;
      seen[saved.id] = true;
      if (kind === 'live' && l !== 1) continue; // canais: só favoritos
      var item = this.resolveCatalogItem(saved);
      if (item) out.push(item);
    }
    return out;
  };

  AppShell.prototype.homeItems = function () {
    if (!this.lazy) return this.catalog || [];
    var out = (this.catalog || []).slice(), seen = {}, i, state = LS.load(), lists = [state.continue_watching, state.favorites], extra = [];
    for (i = 0; i < out.length; i++) seen[out[i].id] = true;
    for (var l = 0; l < lists.length; l++) for (i = 0; i < lists[l].length; i++) {
      var item = this.resolveSaved(lists[l][i]);
      if (item && !seen[item.id]) { seen[item.id] = true; extra.push(item); }
    }
    return out.concat(extra);
  };

  AppShell.prototype.runGlobalSearch = function (query) {
    var self = this, token = this.catalogToken;
    if (!this.xtream) return;
    EP.CatalogService.search(this.xtream, query, ['live', 'movies', 'series']).then(function (result) {
      if (token === self.catalogToken) self.views[SEARCH].setResults({ query: query, items: self.filterVisible(result.items || []), error: result.ok ? '' : result.error });
    });
  };

  AppShell.prototype.openSearchKeyboard = function () {
    var self = this;
    this.app.openKeyboard({
      title: 'Buscar no ELVANOQ Play', message: 'Filmes, séries e canais da sua lista', text: this.views[SEARCH].query,
      buttons: ['Buscar', 'Cancelar'],
      onButton: function (index, value) { if (index === 0) self.views[SEARCH].setQuery(value); }
    });
  };

  /* TV ao Vivo: "Pesquisar categoria" / "Pesquisar canais". Limpar ou texto
   * vazio removem o filtro; Cancelar e Voltar fecham sem mudar nada. */
  AppShell.prototype.openLiveSearchKeyboard = function (column) {
    var live = this.views[LIVE], state = live.searchState(column);
    this.app.openKeyboard({
      title: state.title, message: state.message, text: state.text,
      buttons: ['Pesquisar', 'Limpar', 'Cancelar'],
      onButton: function (button, value) {
        if (button === 0) live.setSearch(column, value);
        else if (button === 1) live.setSearch(column, '');
      }
    });
  };

  AppShell.prototype.openBrowseKeyboard = function (index) {
    var self = this, view = this.views[index];
    this.app.openKeyboard({
      title: index === MOVIES ? 'Buscar filme' : 'Buscar série', message: 'Digite o nome do título', text: view.query,
      buttons: ['Buscar', 'Cancelar'],
      onButton: function (button, value) { if (button === 0) self.runBrowseSearch(index, value); }
    });
  };

  AppShell.prototype.runBrowseSearch = function (index, value) {
    var self = this, view = this.views[index], kind = KIND_OF[index], query = EP.text(value), token = this.catalogToken;
    if (!query) return;
    if (!this.lazy) {
      var needle = normalize(query), items = [], all = this.catalog || [];
      for (var i = 0; i < all.length && items.length < 240; i++) if (all[i].type === kind && normalize(all[i].title).indexOf(needle) !== -1) items.push(all[i]);
      view.setSearchResults({ query: query, items: this.filterVisible(items) });
      return;
    }
    view.setSearchResults({ query: query, items: [], loading: true });
    EP.CatalogService.search(this.xtream, query, [kind]).then(function (result) {
      if (token === self.catalogToken && view.search && view.search.query === query) view.setSearchResults({ query: query, items: self.filterVisible(result.items || []), error: result.ok ? '' : result.error });
    });
  };

  function normalize(value) {
    var s = EP.lower(EP.displayTitle(value));
    try { s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); } catch (_) {}
    return s;
  }

  AppShell.prototype.onSettingsAction = function (action) {
    if (action === 'account') this.app.openAccount();
    else if (action === 'sync') this.app.requestPlaylistSync(true);
    else if (action === 'code') this.app.openServerCodeKeyboard();
  };

  /* ---------- catálogo ---------- */
  AppShell.prototype.applyPlaylist = function (payload) {
    if (!payload || !payload.playlist) return;
    var metadata = { synced_at: new Date().toISOString(), display_name: payload.display_name || '', source_type: payload.playlist.sourceType };
    if (payload.server_code) metadata.server_code = payload.server_code;
    EP.Registry.writeJson('playlist_metadata', metadata);
    this.playlistName = payload.display_name || payload.playlist.name;
    this.playlistOrigin = payload.playlist.origin;
    this.loadCatalog(payload.playlist);
  };

  AppShell.prototype.loadCatalog = function (playlist) {
    var self = this;
    var token = this.catalogToken = {};
    this.app.setLoading('Carregando catálogo da sua lista…');
    EP.CatalogService.load(playlist).then(function (result) {
      if (token !== self.catalogToken) return;
      self.app.setLoading('');
      self.catalog = result.channels;
      self.categories = result.categories;
      self.xtream = result.xtream || null;
      self.lazy = !!result.lazy;
      self.liveCategories = result.liveCategories || [];
      self.movieCategories = result.movieCategories || [];
      self.seriesCategories = result.seriesCategories || [];
      self.resetCategoryCache();
      EP.CatalogService.clearSearchCache();
      self.catalogVersion = (self.catalogVersion || 0) + 1;
      EP.ListScope.set(EP.ListScope.idFor(playlist));
      migrateLegacyState(self.catalog);
      self.epg.configure(result.epg, function () { if (self.selectedIndex === LIVE) self.views[LIVE].setEpg(); });
      self.refreshCurrent(false);
      self.tryDeepLink();
      if (self.selectedIndex === SETTINGS) self.views[SETTINGS].setStatus(self.lazy ? 'Lista atualizada: ' + EP.formatNumber(self.allCategoryNames().length) + ' categorias.' : 'Lista atualizada: ' + EP.formatNumber(self.catalog.length) + ' itens.');
    }, function (error) {
      if (token !== self.catalogToken) return;
      self.app.setLoading((error && error.message) || 'Catálogo indisponível.');
    });
  };

  /* v0.4.0 guardava só ids em "elvanoq-lg-app-state-v2". Converte uma única vez. */
  function migrateLegacyState(catalog) {
    var legacy;
    try { legacy = JSON.parse(window.localStorage.getItem('elvanoq-lg-app-state-v2')); } catch (_) { legacy = null; }
    if (!legacy) return;
    var byId = {}, state = LS.load(), i;
    for (i = 0; i < catalog.length; i++) byId[catalog[i].id] = catalog[i];
    var favorites = legacy.favorites || [], history = legacy.history || [];
    for (i = 0; i < favorites.length; i++) if (byId[favorites[i]]) state.favorites = LS.upsert(state.favorites, byId[favorites[i]]);
    for (i = history.length - 1; i >= 0; i--) if (byId[history[i]]) state.history = LS.upsert(state.history, byId[history[i]]);
    LS.save(state);
    // PIN antigo em texto: só um PIN personalizado é mantido (agora como hash).
    if (/^\d{4}$/.test(String(legacy.parentalPin || '')) && legacy.parentalPin !== '0000' && !P.hasPin()) P.setPin(legacy.parentalPin);
    try { window.localStorage.removeItem('elvanoq-lg-app-state-v2'); } catch (_) {}
  }

  AppShell.prototype.resolveCatalogItem = function (saved) {
    if (!saved || !this.catalog) return null;
    var stamp = this.catalogVersion + ':' + this.poolVersion;
    if (!this.catalogIndex || this.catalogIndexVersion !== stamp) {
      var pool = this.pool();
      this.catalogIndex = {};
      for (var i = 0; i < pool.length; i++) this.catalogIndex[pool[i].id] = pool[i];
      this.catalogIndexVersion = stamp;
    }
    var found = this.catalogIndex[saved.id];
    if (found || !this.lazy || !saved.sid) return found || null;
    // Fora do cache: recria pelo id salvo, como o xtreamItemFromSaved do Roku.
    var rebuilt = EP.PlaylistRules.xtreamItemFromSaved(this.xtream, saved, this.xtream.liveExtension);
    if (rebuilt) this.catalogIndex[saved.id] = rebuilt;
    return rebuilt;
  };

  /* Episódios ficam salvos como "<série>:episode:<id>": resolve para a série. */
  AppShell.prototype.resolveSaved = function (saved) {
    var item = this.resolveCatalogItem(saved);
    if (item) return item;
    var parentId = String(saved.id || '').split(':episode:')[0];
    if (parentId === saved.id) return null;
    return this.resolveCatalogItem({ id: parentId, sid: saved.sid, kind: 'series', title: saved.series_title || '', category: saved.category, logo: saved.logo });
  };

  AppShell.prototype.onLibraryItemRequested = function (saved) {
    var item = this.resolveSaved(saved);
    if (!item) return;
    if (item.type === 'live') { this.playLiveItem(item, [item], 0); return; }
    if (item.id === saved.id && saved.progress_seconds > 0 && item.stream_url) { this.playCatalogItem(item, saved.progress_seconds); return; }
    this.openCatalogItem(item);
  };

  AppShell.prototype.similarTo = function (item) {
    var out = [];
    var pool = this.pool();
    if (!pool.length || item.type === 'series') return out;
    for (var i = 0; i < pool.length && out.length < 12; i++) {
      var c = pool[i];
      if (c.id !== item.id && c.type === item.type && c.category === item.category && EP.displayTitle(c.title) !== EP.displayTitle(item.title)) out.push(c);
    }
    return out;
  };

  AppShell.prototype.openCatalogItem = function (item) {
    if (!item) return;
    this.detailView.setItem(item, this.similarTo(item));
    this.detailView.show(true);
    this.reloadDetailMetadata();
  };

  AppShell.prototype.reloadDetailMetadata = function () {
    var d = this.detailView, item = d.item, token = this.metadataToken = {}, self = this;
    if (!item) return;
    EP.MetadataService.load(item, this.xtream).then(function (metadata) {
      if (token === self.metadataToken && d.item === item) d.setMetadata(metadata);
    });
  };

  /* ---------- reprodução ---------- */
  AppShell.prototype.startPlayback = function (content) {
    var p = this.playerView;
    this.views[LIVE].stopPreview();
    this.views[HOME].setActive(false); // carrossel parado atrás do vídeo (troca imagens grandes a cada 8 s)
    p.play(content);
    Portal.ensurePlayable().then(function (ok) {
      if (ok || p.content !== content) return;
      p.stopVideo();
      p.hint.textContent = 'Esta TV não possui licença ativa para reprodução.';
      p.showOsd();
    });
  };

  AppShell.prototype.playCatalogItem = function (item, resume) {
    if (!item) return;
    if (item.type === 'series' && !item.stream_url) { this.openCatalogItem(item); return; }
    if (!item.stream_url) return;
    this.clearEpisodeQueue();
    this.startPlayback({ streamUrl: item.stream_url, id: item.id, title: EP.displayTitle(item.title), category: item.category, resumePosition: resume || 0, persistEnabled: true, skipIntroEnd: 0, nextEpisode: null, liveQueue: [], saved: savedRef(item) });
  };

  AppShell.prototype.playLiveItem = function (item, channels, index) {
    if (!item || !item.stream_url) return;
    var self = this;
    this.clearEpisodeQueue();
    var content = { streamUrl: item.stream_url, id: item.id, title: EP.displayTitle(item.title), category: item.category, resumePosition: 0, persistEnabled: false, skipIntroEnd: 0, nextEpisode: null, liveQueue: channels, liveIndex: index, liveGuide: this.epg.guideFor(item), logo: item.logo };
    this.startPlayback(content);
    if (!content.liveGuide.now) this.epg.request(item, function () { if (self.playerView.content === content) self.playerView.setLiveGuide(self.epg.guideFor(item)); });
    var state = LS.load();
    var entry = savedRef(item);
    entry.id = item.id; entry.title = item.title; entry.category = item.category; entry.updated_at = new Date().toISOString();
    state.history = LS.upsert(LS.remove(state.history, item.id), entry);
    LS.save(state);
  };

  /* ---------- opções do canal e rever programas ---------- */
  AppShell.prototype.openChannelOptions = function (item) {
    var self = this, live = this.views[LIVE];
    var favorite = LS.isFavorite(item.id);
    this.app.openList({
      title: EP.displayTitle(item.title), subtitle: 'Opções do canal',
      items: [{ label: favorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos', action: 'favorite' }, { label: 'Rever programas', meta: 'Até ' + item.archive_days + (item.archive_days === 1 ? ' dia' : ' dias'), action: 'catchup' }],
      onSelect: function (index, entry) {
        if (entry.action === 'favorite') { self.app.dialog.close(); live.toggleFavorite(); }
        else self.openCatchupList(item);
      }
    });
  };

  AppShell.prototype.openCatchupList = function (item) {
    var self = this;
    var dialog = this.app.openList({ title: 'Rever programas', subtitle: EP.displayTitle(item.title), items: [], loading: true });
    var dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    function when(p) {
      var d = new Date(p.start), today = new Date(), yesterday = new Date(today.getTime() - 86400000);
      var day = d.toDateString() === today.toDateString() ? 'Hoje' : d.toDateString() === yesterday.toDateString() ? 'Ontem' : dayNames[d.getDay()] + ' ' + d.getDate() + '/' + (d.getMonth() + 1);
      return day + '   ' + EP.clockText(d).time + ' – ' + EP.clockText(new Date(p.stop)).time;
    }
    this.epg.archive(item, function (result) {
      if (dialog.closed) return;
      var rows = [];
      for (var i = 0; i < result.items.length; i++) rows.push({ label: result.items[i].title, meta: when(result.items[i]), programme: result.items[i] });
      dialog.opts.onSelect = function (index, entry) { dialog.close(); self.playCatchup(item, entry.programme); };
      dialog.setItems(rows, result.ok ? 'Nenhum programa disponível para rever neste canal.' : 'Não foi possível carregar a programação para rever.');
    });
  };

  AppShell.prototype.playCatchup = function (item, programme) {
    var urls = EP.CatchupRules.catchupUrls(this.xtream, item.stream_id, programme);
    if (!urls.length) return;
    this.clearEpisodeQueue();
    this.startPlayback({ streamUrl: urls[0], catchupUrls: urls, id: item.id + ':catchup', title: EP.displayTitle(item.title) + '  •  ' + programme.title, category: item.category, resumePosition: 0, persistEnabled: false, skipIntroEnd: 0, nextEpisode: null, liveQueue: [], logo: item.logo });
  };

  AppShell.prototype.playEpisode = function (ep) {
    var queue = this.episodeQueue || [];
    this.startPlayback({
      streamUrl: ep.url, id: ep.id, title: ep.title, category: ep.category, resumePosition: LS.resumePositionFor(ep), persistEnabled: true,
      skipIntroEnd: ep.introEnd || 0, nextEpisode: queue[this.episodeQueueIndex + 1] || null, liveQueue: [],
      saved: episodeRef(ep, this.detailView.item)
    });
  };

  /* Campos mínimos para recriar o item depois (nunca a URL com usuário/senha). */
  function savedRef(item) {
    var ref = { kind: item.type, sid: item.series_id || item.stream_id || '', logo: item.logo || '', tvg: item.tvg_id || '', arc: item.archive_days || 0 };
    var m = item.type === 'movies' && /\.([a-z0-9]{2,5})(?:\?|$)/i.exec(item.stream_url || '');
    if (m) ref.ext = m[1];
    return ref;
  }

  function episodeRef(ep, series) {
    var parent = String(ep.parentId || '').split(':');
    var ref = { kind: 'series', sid: parent[1] || '', logo: (series && series.logo) || '' };
    if (series && series.id === ep.parentId) ref.series_title = series.title;
    return ref;
  }

  AppShell.prototype.onNextEpisodeRequested = function () {
    if (!this.episodeQueue) return;
    var next = this.episodeQueueIndex + 1, ep = this.episodeQueue[next];
    if (!ep || !ep.url || P.isBlockedItem(ep.category, ep.parentId)) return;
    this.episodeQueueIndex = next;
    this.playEpisode(ep);
  };

  AppShell.prototype.clearEpisodeQueue = function () { this.episodeQueue = null; this.episodeQueueIndex = 0; };

  AppShell.prototype.stopPlayback = function () {
    this.clearEpisodeQueue();
    this.views[LIVE].stopPreview();
    this.playerView.stopPlayback();
    S.show(this.playerView.root, false);
    this.detailView.show(false);
    this.views[HOME].setActive(this.selectedIndex === HOME);
  };

  /* ---------- Ajustes: contagens, diagnóstico e teste de conexão ----------
   * Nada aqui mostra host, usuário, senha ou URL. */
  AppShell.prototype.settingsProvider = function () {
    var self = this;
    var tested = { portal: '', server: '', at: '' };
    return {
      counts: function () { return { protectedCount: P.protectedCount(self.allCategoryNames()) }; },
      diagnostics: function () {
        var info = self.app.settingsInfo(), ua = navigator.userAgent || '';
        var chrome = /Chrome\/(\d+)/.exec(ua), vidaa = EP.isVidaa ? EP.isVidaa() : false, model = EP.vidaaModel ? EP.vidaaModel() : '';
        var lists = { live: self.categoryList('live').length, movies: self.categoryList('movies').length, series: self.categoryList('series').length };
        return {
          app: EP.VERSION, engine: (vidaa ? 'VIDAA • ' + (model ? model + ' • ' : '') : '') + (chrome ? 'Chrome ' + chrome[1] : 'navegador web'),
          screen: window.innerWidth + '×' + window.innerHeight, device: info.code || 'Não gerado',
          list: self.catalog ? (self.lazy ? 'Xtream (sob demanda)' : (self.xtream ? 'Xtream' : 'M3U')) : 'Nenhuma',
          source: info.listLabel,
          categories: self.catalog ? lists.live + ' ao vivo • ' + lists.movies + ' filmes • ' + lists.series + ' séries' : '',
          cache: self.lazy ? self.categoryOrder.length + '/10 categorias • ' + EP.formatNumber(self.pool().length) + ' itens' : EP.formatNumber((self.catalog || []).length) + ' itens',
          license: info.licenseLabel, format: EP.LiveFormat.LABELS[EP.LiveFormat.mode()],
          remembered: EP.LiveFormat.remembered() === 'ts' ? 'TS' : EP.LiveFormat.remembered() === 'hls' ? 'HLS' : 'Ainda nenhum',
          parental: !P.hasPin() ? 'Sem PIN' : (P.adultProtection() ? 'PIN • adulto protegido' : 'PIN • adulto sem proteção'),
          portal: tested.portal, server: tested.server, tested: tested.at
        };
      },
      test: function (done) {
        var pending = 2;
        function finish() { if (--pending === 0) { tested.at = EP.clockText().time; done(); } }
        var t0 = Date.now();
        Portal.licenseStatus().then(function (r) {
          tested.portal = r.state === 'offline' ? 'Sem resposta' : 'Conectado • ' + (Date.now() - t0) + ' ms';
          finish();
        }, function () { tested.portal = 'Sem resposta'; finish(); });
        if (!self.xtream) { tested.server = self.catalog ? 'Lista M3U carregada' : 'Sem lista'; finish(); return; }
        var t1 = Date.now(), x = self.xtream;
        EP.Http.get(EP.PlaylistRules.buildXtreamApiUrl(x.host, x.username, x.password, '', {}), 12000).then(function (r) {
          tested.server = r.status >= 200 && r.status < 300 ? 'Respondeu • ' + (Date.now() - t1) + ' ms' : 'Erro ' + r.status;
          finish();
        }, function () { tested.server = 'Não respondeu'; finish(); });
      }
    };
  };

  /* ---------- deep linking (como no Roku 1.0.1) ----------
   * contentId aceito: o id de um item já conhecido, ou "movie:<stream_id>[:ext]",
   * "episode:<id>[:ext]", "series:<series_id>", "channel:<stream_id>". */
  AppShell.prototype.setDeepLink = function (link) {
    if (!link || !link.contentId) return;
    this.pendingDeepLink = link;
    this.tryDeepLink();
  };

  AppShell.prototype.tryDeepLink = function () {
    var link = this.pendingDeepLink;
    if (!link || !this.catalog) return;
    this.pendingDeepLink = null;
    var contentId = EP.text(link.contentId), mediaType = EP.lower(EP.text(link.mediaType));
    var item = this.resolveCatalogItem({ id: contentId }) || this.deepLinkItem(contentId);
    if (!item) return;
    this.detailView.show(false);
    if (item.type === 'live' || mediaType === 'live') this.playLiveItem(item, [item], 0);
    else if (item.type === 'series' || mediaType === 'series' || mediaType === 'season') this.openCatalogItem(item);
    else if (item.stream_url) this.playCatalogItem(item, LS.resumePositionFor(item)); // direto para o play
    else this.openCatalogItem(item);
  };

  AppShell.prototype.deepLinkItem = function (contentId) {
    var xt = this.xtream, parts = contentId.split(':');
    if (!xt || parts.length < 2) return null;
    var kind = EP.lower(parts[0]), sid = EP.text(parts[1]), ext = parts.length > 2 ? EP.text(parts[2]) : '';
    if (!sid) return null;
    if (kind === 'episode') {
      return { id: contentId, title: 'Episódio', category: '', type: 'movies', logo: '', stream_url: EP.PlaylistRules.xtreamEpisodeUrl(xt.host, xt.username, xt.password, ext || 'mp4', sid) };
    }
    var type = { movie: 'movies', series: 'series', channel: 'live' }[kind];
    if (!type) return null;
    return EP.PlaylistRules.xtreamItemFromSaved(xt, { id: contentId, kind: type, sid: sid, ext: type === 'movies' ? (ext || 'mp4') : ext, title: '' }, xt.liveExtension);
  };

  /* Pouca memória / app em segundo plano: mantém só a última categoria aberta
   * e solta a busca em cache (releaseMemory do Roku 1.0.1). */
  AppShell.prototype.releaseMemory = function () {
    while (this.categoryOrder.length > 1) delete this.categoryCache[this.categoryOrder.shift()];
    EP.CatalogService.clearSearchCache();
    this.poolVersion++;
    this.poolCache = null;
    this.catalogIndex = null;
  };

  EP.AppShell = AppShell;
}(window.EP));

