/* Home em formato hub — ELVANOQ Play Roku 0.1.88 (HomeView):
 *   1. destaque largo (0–640) com rótulo, título, metadados, sinopse,
 *      "Assistir agora" / "Minha Lista" e paginação; relógio fixo no canto;
 *   2. blocos: TV ao Vivo, Filmes, Séries, Busca, Minha Lista, Ajustes;
 *   3. duas fileiras: Novidades para você e Continuar assistindo (se houver).
 * Ao focar as fileiras a página sobe 328 / 712 px, como no Roku. Acabamento do
 * Android: arte com sombras, luz ambiente, transição do destaque, pôsteres
 * arredondados com foco ciano e ampliação.
 */
(function (EP) {
  'use strict';
  var S = EP.Stage, LS = EP.LocalState, R = function () { return EP.PlaylistRules; };
  var TILES = [
    { key: 1, title: 'TV ao Vivo', icon: 'tv' }, { key: 2, title: 'Filmes', icon: 'film' }, { key: 3, title: 'Séries', icon: 'series' },
    { key: 4, title: 'Busca', icon: 'search' }, { key: 5, title: 'Minha Lista', icon: 'star' }, { key: 6, title: 'Ajustes', icon: 'settings' }
  ];
  var TILE_X = 64, TILE_W = 280, TILE_GAP = 22, TILE_Y = 662, TILE_H = 150;
  var POSTER_W = 196, POSTER_H = 294, POSTER_GAP = 24, RAIL_Y = 892, RAIL_VISIBLE = 8, RAIL_LIMIT = 30;
  var SCROLL = 328;
  var GLOWS = ['rgba(126, 48, 205, 0.62)', 'rgba(20, 110, 255, 0.55)', 'rgba(0, 170, 200, 0.45)'];

  function HomeView(parent) {
    var root = this.root = S.group(parent, { className: 'layer' });
    var self = this;
    this.events = new EP.Emitter();
    S.rect(root, { x: 0, y: 0, w: 1920, h: 1080, color: '0x070B14FF' });
    var scroller = this.scroller = S.group(root, { className: 'layer scroller' });

    // Destaque
    var hero = this.hero = S.group(scroller, { className: 'layer' });
    hero.style.height = '640px'; hero.style.overflow = 'hidden';
    this.glow = S.el(hero, { x: 0, y: 0, w: 1920, h: 640, className: 'fade' });
    this.art = S.el(hero, { x: 0, y: 0, w: 1920, h: 640, className: 'fade', css: 'background-size:cover;background-position:center top;opacity:0' });
    S.el(hero, { x: 0, y: 0, w: 1920, h: 640, css: 'background:linear-gradient(90deg,rgba(7,11,20,0.96) 0%,rgba(7,11,20,0.78) 34%,rgba(7,11,20,0.2) 66%,rgba(7,11,20,0) 86%)' });
    S.el(hero, { x: 0, y: 0, w: 1920, h: 220, css: 'background:linear-gradient(rgba(7,11,20,0.82),rgba(7,11,20,0))' });
    S.el(hero, { x: 0, y: 380, w: 1920, h: 260, css: 'background:linear-gradient(rgba(7,11,20,0),rgba(7,11,20,0.9) 70%,#070b14)' });
    S.poster(hero, { x: 64, y: 44, w: 210, h: 70, uri: 'images/elvanoq-wordmark-white.png', mode: 'fit' }).style.backgroundPosition = 'left center';

    var copy = this.copy = S.group(hero, { className: 'layer slide-content' });
    this.eyebrow = S.label(copy, { x: 64, y: 214, w: 800, h: 32, text: 'DESTAQUE ELVANOQ', size: 18, weight: 700, color: '0x00D7FFFF', css: 'letter-spacing:0.06em' });
    this.heroTitle = S.label(copy, { x: 64, y: 252, w: 980, h: 80, text: 'Sua TV, do seu jeito', size: 56, weight: 700, css: 'letter-spacing:-0.025em' });
    this.heroMeta = S.label(copy, { x: 64, y: 336, w: 980, h: 34, size: 20, color: '0xB6C2D6FF' });
    this.heroDescription = S.label(copy, { x: 64, y: 378, w: 860, h: 104, size: 24, lineHeight: 34, lines: 3, color: '0xD6DEEBFF', text: 'Sincronizando a sua lista autorizada…' });
    this.watchButton = S.button(copy, { x: 64, y: 500, w: 240, variant: 'primary', label: 'Assistir agora' });
    this.listButton = S.button(copy, { x: 324, y: 500, w: 260, label: '+ Minha Lista' });
    this.dots = S.group(hero, { x: 1766, y: 592 });

    S.el(scroller, { x: 0, y: 639, w: 1920, h: 2, className: 'divider' });

    // Blocos
    this.tiles = [];
    for (var i = 0; i < TILES.length; i++) {
      var tile = S.el(scroller, { x: TILE_X + i * (TILE_W + TILE_GAP), y: TILE_Y, w: TILE_W, h: TILE_H, className: 'hub-tile' });
      tile.appendChild(EP.icon(TILES[i].icon));
      var label = document.createElement('div'); label.className = 'hub-label'; label.textContent = TILES[i].title; tile.appendChild(label);
      (function (index) {
        tile.addEventListener('click', function () { self.area = 'tiles'; self.tileIndex = index; self.updateFocus(); self.handleKey('OK'); });
      }(i));
      this.tiles.push(tile);
    }

    // Fileiras com índices e deslocamentos independentes.
    this.rails = [];
    for (var row = 0; row < 2; row++) {
      var group = S.group(scroller, { x: 0, y: row * 384 });
      var title = S.label(group, { x: 64, y: 842, w: 900, h: 40, text: row ? 'Continuar assistindo' : 'Novidades para você', size: 26, weight: 600 });
      var hint = S.label(group, { x: 1056, y: 846, w: 800, h: 32, text: row ? 'Retome de onde parou' : 'Filmes e séries adicionados recentemente', size: 20, align: 'right', color: '0x8894A8FF' });
      var viewport = S.el(group, { x: 44, y: RAIL_Y - 20, w: 1832, h: POSTER_H + 40, css: 'overflow:hidden' });
      var strip = S.el(viewport, { x: 20, y: 20, w: 8000, h: POSTER_H, className: 'scroller' });
      this.rails.push({ group: group, title: title, hint: hint, strip: strip, items: [], posters: [], index: 0, offset: 0 });
    }
    this.railRow = 0;
    this.emptyState = S.label(scroller, { x: 64, y: 900, w: 1500, h: 52, size: 24, color: '0x8894A8FF', visible: false });

    // Relógio fixo (não rola com a página)
    this.clock = S.label(root, { x: 1506, y: 44, w: 350, h: 50, size: 36, weight: 600, align: 'right' });
    this.clockDate = S.label(root, { x: 1506, y: 94, w: 350, h: 32, size: 20, align: 'right', color: '0xD6DEEBFF' });
    this.updateClock();
    this.clockTimer = setInterval(function () { self.updateClock(); }, 15000);

    this.area = 'tiles'; this.tileIndex = 0; this.heroAction = 0;
    this.slides = []; this.slideIndex = 0; this.isActive = true; this.hasFocus = true;
    this.heroTimer = new EP.Timer(8, true, function () { self.nextSlide(1); });
    this.watchButton.addEventListener('click', function () { self.area = 'hero'; self.heroAction = 0; self.handleKey('OK'); });
    this.listButton.addEventListener('click', function () { self.area = 'hero'; self.heroAction = 1; self.handleKey('OK'); });
    this.renderGlow(0);
    this.updateFocus();
  }

  HomeView.prototype.show = function (visible) { S.show(this.root, visible); };
  HomeView.prototype.setContentFocus = function (focused) { this.hasFocus = focused; this.updateFocus(); };

  HomeView.prototype.updateClock = function () {
    var c = EP.clockText();
    this.clock.textContent = c.time;
    this.clockDate.textContent = c.date;
  };

  HomeView.prototype.renderGlow = function (index) {
    var color = GLOWS[index % GLOWS.length];
    this.glow.style.background = 'radial-gradient(ellipse 900px 520px at 88% 6%, ' + color + ', rgba(7,11,20,0) 72%), radial-gradient(ellipse 700px 400px at 60% 0%, rgba(20,125,255,0.10), rgba(7,11,20,0) 70%)';
  };

  /* ---------- dados ---------- */
  HomeView.prototype.setCatalog = function (payload) {
    var items = (payload && payload.items) || [];
    this.metadataLoader = payload && payload.metadataLoader;
    this.catalogItems = items;
    if (!items.length) {
      this.heroTimer.stop();
      this.slides = [];
      this.railRow = 0;
      this.rails[0].items = []; this.rails[1].items = [];
      this.renderRail(0); this.renderRail(1);
      S.show(this.emptyState, true);
      this.emptyState.textContent = 'Sua lista será exibida aqui assim que a sincronização for concluída.';
      return;
    }
    S.show(this.emptyState, false);
    var vod = [], byId = {};
    for (var i = 0; i < items.length; i++) {
      byId[items[i].id] = items[i];
      if (items[i].type === 'movies' || items[i].type === 'series') vod.push(items[i]);
    }
    this.byId = byId;
    this.buildSlides(vod.length ? vod : items);
    this.buildRail(vod, byId);
    if (this.isActive && this.slides.length > 1) this.heroTimer.start();
  };

  function addedValue(item) { return item.added_at ? String(item.added_at) : ''; }

  HomeView.prototype.buildSlides = function (pool) {
    var slides = [];
    function push(label, item) {
      if (!item || slides.length >= 3) return;
      for (var i = 0; i < slides.length; i++) if (slides[i].item.id === item.id) return;
      slides.push({ label: label, item: item });
    }
    var featured = null, recent = null, top = null, recentValue = '', topValue = 0;
    for (var i = 0; i < pool.length; i++) {
      var it = pool[i], v = EP.lower(it.featured);
      if (!featured && (v === 'true' || v === '1' || v === 'yes')) featured = it;
      if (addedValue(it) > recentValue) { recent = it; recentValue = addedValue(it); }
      var r = parseFloat(it.rating) || 0;
      if (r > topValue) { top = it; topValue = r; }
    }
    // Destaque da semana: o mais bem avaliado entre os 40 mais recentes (Android: weeklyFeaturedMovie).
    if (!featured) {
      var recentList = pool.slice().sort(function (a, b) { return addedValue(b) > addedValue(a) ? 1 : addedValue(b) < addedValue(a) ? -1 : 0; }).slice(0, 40);
      var best = -1;
      for (i = 0; i < recentList.length; i++) { var rr = parseFloat(recentList[i].rating) || 0; if (rr > best && recentList[i] !== recent) { best = rr; featured = recentList[i]; } }
    }
    push('DESTAQUE DA SEMANA', featured);
    push('RECÉM-ADICIONADO', recent);
    push('MAIS BEM AVALIADO', top);
    var state = LS.load();
    var last = state.continue_watching[state.continue_watching.length - 1];
    if (last && this.byId[last.id]) push('CONTINUE ASSISTINDO', this.byId[last.id]);
    push('DESTAQUE ELVANOQ', pool[0]);
    this.slides = slides;
    this.slideIndex = Math.min(this.slideIndex, Math.max(0, slides.length - 1));
    this.renderDots();
    this.renderSlide(false);
  };

  HomeView.prototype.renderDots = function () {
    this.dots.innerHTML = '';
    if (this.slides.length < 2) return;
    for (var i = 0; i < this.slides.length; i++) {
      S.el(this.dots, { x: i * 24, y: 0, w: 14, h: 14, css: 'border-radius:3px;background:' + (i === this.slideIndex ? 'var(--accent)' : 'rgba(136,148,168,0.45)') });
    }
  };

  HomeView.prototype.renderSlide = function (animate) {
    var slide = this.slides[this.slideIndex];
    if (!slide) return;
    var self = this, item = slide.item;
    this.heroItem = item;
    this.renderGlow(this.slideIndex);
    if (animate) {
      S.toggle(this.copy, 'entering', true);
      setTimeout(function () { S.toggle(self.copy, 'entering', false); }, 40);
    }
    this.eyebrow.textContent = slide.label;
    this.heroTitle.textContent = EP.displayTitle(item.title);
    this.renderHeroMeta(item, null);
    this.heroDescription.textContent = item.plot || 'Disponível na sua lista autorizada. Assista agora ou salve na Minha Lista para depois.';
    S.setButton(this.watchButton, 'play', item.type === 'series' ? 'Ver episódios' : 'Assistir agora');
    this.updateListButton();
    this.setArt(item.backdrop || '', item.logo || '');
    this.renderDots();
    // Sinopse, gêneros e arte larga vêm do Xtream sob demanda (só para o destaque).
    if (this.metadataLoader && !item._heroLoaded) {
      item._heroLoaded = true;
      this.metadataLoader(item, function (meta) {
        if (!meta || !meta.found) return;
        if (meta.item.overview && !item.plot) item.plot = meta.item.overview;
        if (meta.item.backdrop) item.backdrop = meta.item.backdrop;
        item._meta = meta.item;
        if (self.heroItem === item) {
          self.heroDescription.textContent = item.plot || self.heroDescription.textContent;
          self.renderHeroMeta(item, meta.item);
          self.setArt(item.backdrop || '', item.logo || '');
        }
      });
    } else if (item._meta) this.renderHeroMeta(item, item._meta);
  };

  HomeView.prototype.renderHeroMeta = function (item, meta) {
    var parts = [item.category];
    var year = (meta && meta.release_date) ? String(meta.release_date).slice(0, 4) : item.year;
    if (year) parts.push(year);
    var rating = parseFloat((meta && meta.vote_average) || item.rating);
    if (rating > 0) parts.push('Nota ' + (Math.round(rating * 10) / 10));
    if (meta && meta.genres && meta.genres.length) parts.push(meta.genres.slice(0, 2).join(', '));
    this.heroMeta.textContent = parts.join('   •   ');
  };

  /* Arte larga: ocupa todo o destaque; pôster vertical fica à direita. */
  HomeView.prototype.setArt = function (backdrop, poster) {
    var art = this.art;
    if (backdrop) {
      S.move(art, 0, 0, 1920);
      art.style.backgroundImage = 'url("' + EP.sizedImage(backdrop, 'w1280').replace(/"/g, '%22') + '")';
      art.style.opacity = '0.85';
    } else if (poster) {
      S.move(art, 1040, 0, 880);
      art.style.backgroundImage = 'url("' + EP.sizedImage(poster, 'w780').replace(/"/g, '%22') + '")';
      art.style.opacity = '0.55';
    } else art.style.opacity = '0';
  };

  HomeView.prototype.nextSlide = function (delta) {
    if (!this.isActive || this.slides.length < 2) return;
    if (this.hasFocus && this.area === 'hero') return; // pausa com foco nos botões
    this.slideIndex = (this.slideIndex + delta + this.slides.length) % this.slides.length;
    this.renderSlide(true);
  };

  HomeView.prototype.buildRail = function (vod, byId) {
    var state = LS.load(), items = [], seen = {}, i;
    function add(item, progress) { if (item && item.type !== 'live' && !seen[item.id] && items.length < RAIL_LIMIT) { seen[item.id] = true; items.push({ item: item, progress: progress || 0 }); } }
    var savedItems = state.continue_watching.slice().sort(function (a, b) { return (a.updated_at || 0) > (b.updated_at || 0) ? 1 : (a.updated_at || 0) < (b.updated_at || 0) ? -1 : 0; });
    for (i = savedItems.length - 1; i >= 0; i--) {
      var saved = savedItems[i];
      var item = byId[saved.id] || byId[String(saved.id).split(':episode:')[0]];
      if (item) { add(item, saved.duration_seconds ? saved.progress_seconds / saved.duration_seconds : 0); if (items.length && items[items.length - 1].item === item && !items[items.length - 1].saved) items[items.length - 1].saved = saved; }
    }
    this.rails[1].items = items;
    items = []; seen = {};
    var sorted = vod.slice().sort(function (a, b) { return addedValue(b) > addedValue(a) ? 1 : addedValue(b) < addedValue(a) ? -1 : 0; });
    var titles = {};
    for (i = 0; i < sorted.length && items.length < RAIL_LIMIT; i++) {
      var key = EP.lower(EP.displayTitle(sorted[i].title)) + '|' + (sorted[i].year || '');
      if (titles[key]) continue;
      titles[key] = true; add(sorted[i]);
    }
    this.rails[0].items = items;
    for (i = 0; i < 2; i++) {
      var rail = this.rails[i];
      rail.index = Math.min(rail.index, Math.max(0, rail.items.length - 1));
      rail.offset = Math.min(rail.offset, Math.max(0, rail.items.length - RAIL_VISIBLE));
      this.renderRail(i);
    }
    if (!this.rails[1].items.length && this.railRow === 1) this.railRow = 0;
    this.updateFocus();
  };

  HomeView.prototype.renderRail = function (row) {
    var self = this, rail = this.rails[row];
    S.show(rail.group, row === 0 || rail.items.length > 0);
    rail.strip.innerHTML = '';
    rail.posters = [];
    for (var i = 0; i < rail.items.length; i++) {
      var entry = rail.items[i], item = entry.item;
      var p = S.el(rail.strip, { x: i * (POSTER_W + POSTER_GAP), y: 0, w: POSTER_W, h: POSTER_H, className: 'poster' + (item.logo ? ' has-art' : '') });
      if (item.logo) S.setPoster(p, item.logo);
      p.style.backgroundSize = 'cover';
      var fb = document.createElement('div'); fb.className = 'tile-fallback'; fb.textContent = EP.displayTitle(item.title); p.appendChild(fb);
      var q = EP.qualityOf(item.title);
      if (q) { var b = document.createElement('div'); b.className = 'badge'; b.textContent = q; p.appendChild(b); }
      if (entry.progress > 0) {
        var track = document.createElement('div'); track.className = 'progress-track';
        var fill = document.createElement('div'); fill.className = 'progress-fill'; fill.style.width = Math.round(Math.min(1, entry.progress) * 100) + '%';
        track.appendChild(fill); p.appendChild(track);
      }
      (function (index) { p.addEventListener('click', function () { self.area = 'rail'; self.railRow = row; rail.index = index; self.updateFocus(); self.handleKey('OK'); }); }(i));
      rail.posters.push(p);
    }
    this.updateFocus();
  };

  HomeView.prototype.setActive = function (active) {
    this.isActive = active;
    if (!active) this.resumeToken = null;
    if (active) { this.updateClock(); if (this.catalogItems) this.buildRail(this.vodOnly(), this.byId || {}); }
    if (active && this.slides.length > 1) this.heroTimer.start(); else this.heroTimer.stop();
  };

  HomeView.prototype.vodOnly = function () {
    var out = [];
    for (var i = 0; i < (this.catalogItems || []).length; i++) if (this.catalogItems[i].type !== 'live') out.push(this.catalogItems[i]);
    return out;
  };

  /* ---------- foco ---------- */
  HomeView.prototype.updateFocus = function () {
    var f = this.hasFocus;
    S.focus(this.watchButton, f && this.area === 'hero' && this.heroAction === 0);
    S.focus(this.listButton, f && this.area === 'hero' && this.heroAction === 1);
    for (var i = 0; i < this.tiles.length; i++) S.focus(this.tiles[i], f && this.area === 'tiles' && i === this.tileIndex);
    for (var row = 0; row < 2; row++) {
      var rail = this.rails[row];
      if (rail.index < rail.offset) rail.offset = rail.index;
      if (rail.index >= rail.offset + RAIL_VISIBLE) rail.offset = rail.index - RAIL_VISIBLE + 1;
      for (i = 0; i < rail.posters.length; i++) S.focus(rail.posters[i], f && this.area === 'rail' && this.railRow === row && i === rail.index);
      rail.strip.style.transform = 'translateX(-' + (rail.offset * (POSTER_W + POSTER_GAP)) + 'px)';
    }
    this.scroller.style.transform = this.area === 'rail' ? 'translateY(-' + (SCROLL + this.railRow * 384) + 'px)' : 'translateY(0)';
  };

  HomeView.prototype.changeRail = function (row) {
    var from = this.rails[this.railRow], to = this.rails[row];
    to.index = Math.min(to.items.length - 1, to.offset + Math.min(RAIL_VISIBLE - 1, from.index - from.offset));
    this.railRow = row;
    this.updateFocus();
  };

  HomeView.prototype.handleKey = function (key) {
    if (this.area === 'hero') {
      if (key === 'left' && this.heroAction > 0) { this.heroAction--; this.updateFocus(); return true; }
      if (key === 'right' && this.heroAction < 1) { this.heroAction++; this.updateFocus(); return true; }
      if (key === 'down') { this.area = 'tiles'; this.updateFocus(); return true; }
      if (key === 'OK' && this.heroItem) {
        if (this.heroAction === 0) {
          if (this.heroItem.type === 'series') this.events.emit('selectedItem', this.heroItem);
          else this.events.emit('playRequested', this.heroItem);
        } else this.toggleHeroFavorite();
        return true;
      }
      return true;
    }
    if (this.area === 'tiles') {
      if (key === 'left' && this.tileIndex > 0) { this.tileIndex--; this.updateFocus(); return true; }
      if (key === 'right' && this.tileIndex < this.tiles.length - 1) { this.tileIndex++; this.updateFocus(); return true; }
      if (key === 'up' && this.heroItem) { this.area = 'hero'; this.heroAction = 0; this.updateFocus(); return true; }
      if (key === 'down' && this.rails[0].items.length) { this.area = 'rail'; this.railRow = 0; this.updateFocus(); return true; }
      if (key === 'OK') { this.events.emit('navigate', TILES[this.tileIndex].key); return true; }
      return true;
    }
    // Fileiras
    var rail = this.rails[this.railRow];
    if (key === 'left' && rail.index > 0) { rail.index--; this.updateFocus(); return true; }
    if (key === 'right' && rail.index < rail.items.length - 1) { rail.index++; this.updateFocus(); return true; }
    if (key === 'down' && this.railRow === 0 && this.rails[1].items.length) { this.changeRail(1); return true; }
    if (key === 'up') { if (this.railRow === 1) this.changeRail(0); else { this.area = 'tiles'; this.updateFocus(); } return true; }
    if (key === 'OK' && rail.items[rail.index]) { this.openRailEntry(rail.items[rail.index]); return true; }
    return true;
  };

  HomeView.prototype.openRailEntry = function (entry) {
    if (this.railRow !== 1) { this.events.emit('selectedItem', entry.item); return; }
    var self = this, item = entry.item, saved = entry.saved;
    if (item.type !== 'series' || !saved || String(saved.id).indexOf(':episode:') === -1 || !this.metadataLoader) {
      this.events.emit('playRequested', item); return;
    }
    var token = this.resumeToken = {};
    this.metadataLoader(item, function (meta) {
      if (self.resumeToken !== token || !self.isActive) return;
      var seasons = (meta && meta.item && meta.item.seasons) || [];
      for (var i = 0; i < seasons.length; i++) {
        var episodes = seasons[i].episodes || [];
        for (var j = 0; j < episodes.length; j++) {
          var ep = episodes[j];
          if (item.id + ':episode:' + ep.id !== saved.id || !ep.stream_url) continue;
          var resumed = {};
          for (var key in item) if (Object.prototype.hasOwnProperty.call(item, key)) resumed[key] = item[key];
          resumed.id = saved.id; resumed.title = saved.title || item.title; resumed.stream_url = ep.stream_url;
          self.events.emit('playRequested', resumed);
          return;
        }
      }
      self.events.emit('selectedItem', item);
    });
  };

  /* Voltar dentro da Home: retorna aos blocos antes de sair do app. */
  HomeView.prototype.handleBack = function () {
    if (this.area !== 'tiles') { this.area = 'tiles'; this.updateFocus(); return true; }
    return false;
  };

  HomeView.prototype.focusTile = function (sectionKey) {
    for (var i = 0; i < TILES.length; i++) if (TILES[i].key === sectionKey) this.tileIndex = i;
    this.area = 'tiles';
    this.updateFocus();
  };

  HomeView.prototype.updateListButton = function () {
    if (!this.heroItem) return;
    var fav = LS.isFavorite(this.heroItem.id);
    S.setButton(this.listButton, fav ? 'check' : 'plus', fav ? 'Na Minha Lista' : 'Minha Lista');
  };

  HomeView.prototype.toggleHeroFavorite = function () {
    if (!this.heroItem) return;
    var added = LS.toggle('favorites', this.heroItem);
    this.heroMeta.textContent = this.heroItem.category + (added ? '   •   Adicionado à Minha Lista' : '   •   Removido da Minha Lista');
    this.updateListButton();
  };

  EP.HomeView = HomeView;
}(window.EP));

