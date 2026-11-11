/* Detalhes — DetailView do ELVANOQ Play Roku 0.1.88 (mesma geometria):
 * fundo com arte, pôster 360x540 emoldurado à direita, DETALHES, título 54,
 * metadados, gêneros, sinopse (4 linhas), ações Assistir / Minha Lista /
 * Assistir mais tarde / Trailer, status e:
 *   • séries: painel da temporada (←/→ troca) e 7 cartões de episódio 240x135;
 *     "Assistir" toca o episódio selecionado;
 *   • filmes: "Mais como este" (títulos da mesma categoria na lista).
 * Navegação: ações → temporada → episódios (↑/↓).
 */
(function (EP) {
  'use strict';
  var S = EP.Stage, LS = EP.LocalState, P = EP.Parental;
  var ACTION_X = [64, 324, 604, 914], ACTION_W = [240, 260, 290, 180];
  var CARD_W = 240, CARD_H = 135, CARD_GAP = 18, CARDS = 7, REC_W = 150, REC_H = 225, REC_GAP = 22;

  function DetailView(parent) {
    var root = this.root = S.group(parent, { className: 'layer', visible: false });
    var self = this;
    this.events = new EP.Emitter();
    S.rect(root, { x: 0, y: 0, w: 1920, h: 1080, color: '0x070B14FF' });
    this.backdrop = S.el(root, { x: 0, y: 0, w: 1920, h: 1080, className: 'fade', css: 'background-size:cover;background-position:center top;opacity:0' });
    S.el(root, { x: 0, y: 0, w: 1920, h: 1080, css: 'background:linear-gradient(90deg,rgba(7,11,20,0.97) 0%,rgba(7,11,20,0.86) 42%,rgba(7,11,20,0.4) 75%,rgba(7,11,20,0.25) 100%)' });
    S.el(root, { x: 0, y: 440, w: 1920, h: 640, css: 'background:linear-gradient(rgba(7,11,20,0),rgba(7,11,20,0.94) 45%,#070b14)' });
    S.el(root, { x: 0, y: 0, w: 1920, h: 220, css: 'background:linear-gradient(rgba(7,11,20,0.8),rgba(7,11,20,0))' });

    S.el(root, { x: 1484, y: 134, w: 372, h: 552, css: 'border-radius:22px;background:#111b2d;border:1px solid rgba(244,248,255,0.14);box-shadow:0 24px 48px rgba(0,0,0,0.5)' });
    this.poster = S.el(root, { x: 1490, y: 140, w: 360, h: 540, css: 'border-radius:17px;background-color:#0d1422;background-size:cover;background-position:center' });
    this.posterFallback = S.label(root, { x: 1510, y: 380, w: 320, h: 80, size: 26, weight: 600, align: 'center', wrap: true, color: '0x8894A8FF' });

    this.eyebrow = S.label(root, { x: 64, y: 140, w: 700, h: 30, size: 18, weight: 700, color: '0x00D7FFFF', css: 'letter-spacing:0.08em' });
    this.title = S.label(root, { x: 64, y: 180, w: 1200, h: 84, size: 54, weight: 700, css: 'letter-spacing:-0.03em;text-shadow:0 4px 20px rgba(0,0,0,0.4)' });
    this.meta = S.label(root, { x: 64, y: 268, w: 1200, h: 34, size: 20, color: '0xB6C2D6FF' });
    this.genres = S.label(root, { x: 64, y: 306, w: 1200, h: 30, size: 20, color: '0x00D7FFFF' });
    this.overview = S.label(root, { x: 64, y: 350, w: 1150, h: 160, size: 24, lineHeight: 36, lines: 4, color: '0xD6DEEBFF' });

    this.buttons = [];
    var labels = ['Assistir', '+ Minha Lista', 'Assistir mais tarde', 'Trailer'];
    for (var i = 0; i < 4; i++) {
      var b = S.button(root, { x: ACTION_X[i], y: 540, w: ACTION_W[i], h: 64, variant: i === 0 ? 'primary' : '', label: labels[i], visible: i < 3 });
      (function (index) { b.addEventListener('click', function () { self.zone = 'actions'; self.action = index; self.updateFocus(); self.runAction(); }); }(i));
      this.buttons.push(b);
    }
    this.status = S.label(root, { x: 64, y: 628, w: 1150, h: 36, size: 20, color: '0x00D7FFFF' });

    // Filmes: "Mais como este"
    this.similarTitle = S.label(root, { x: 64, y: 700, w: 900, h: 42, text: 'Mais como este', size: 26, weight: 600 });
    this.similarHint = S.label(root, { x: 380, y: 708, w: 840, h: 30, size: 20, color: '0x8894A8FF', text: 'Da mesma categoria na sua lista' });
    // Séries: painel da temporada + cartões
    this.seasonPanel = S.el(root, { x: 64, y: 660, w: 1150, h: 88, visible: false, css: 'border-radius:16px;background:#111b2d;border:1px solid rgba(190,222,255,0.10)' });
    this.seasonLabel = S.label(root, { x: 92, y: 670, w: 1100, h: 38, size: 26, weight: 600, visible: false });
    this.seasonHint = S.label(root, { x: 92, y: 710, w: 1100, h: 30, size: 20, color: '0x8894A8FF', visible: false });
    var lower = S.el(root, { x: 44, y: 0, w: 1876, h: 1080, css: 'overflow:hidden;pointer-events:none' });
    this.strip = S.el(lower, { x: 20, y: 786, w: 12000, h: 280, className: 'scroller', css: 'pointer-events:auto' });
    this.episodeHint = S.label(root, { x: 64, y: 1036, w: 1150, h: 30, size: 20, color: '0x8894A8FF', visible: false });

    this.item = null; this.seasons = null; this.episodes = null; this.similar = [];
    this.zone = 'actions'; this.action = 0; this.seasonIndex = 0; this.cardIndex = 0; this.trailerUrl = '';
  }

  DetailView.prototype.isVisible = function () { return S.isVisible(this.root); };
  DetailView.prototype.show = function (visible) { S.show(this.root, visible); };
  DetailView.prototype.isSeries = function () { return this.item && this.item.type === 'series'; };

  DetailView.prototype.setItem = function (item, similar) {
    this.item = item;
    this.seasons = null; this.episodes = null; this.trailerUrl = '';
    this.zone = 'actions'; this.action = 0; this.seasonIndex = 0; this.cardIndex = 0;
    this.similar = item.type === 'series' ? [] : (similar || []).slice(0, 12);
    this.eyebrow.textContent = 'DETALHES';
    this.title.textContent = EP.displayTitle(item.title);
    this.meta.textContent = item.category + '   •   Conteúdo da sua lista';
    this.genres.textContent = '';
    this.overview.textContent = item.plot || 'Informações complementares, elenco, trailer e recomendações serão exibidos quando os metadados estiverem disponíveis.';
    this.setArt(item.backdrop || '', item.logo || '');
    S.setButton(this.buttons[0], '', item.type === 'series' ? 'Ver episódios' : (LS.resumePositionFor(item) > 0 ? 'Continuar' : 'Assistir'));
    S.show(this.buttons[3], false);
    this.status.textContent = item.type === 'series' ? 'Carregando temporadas…' : '';
    this.updateCollectionButtons();
    this.renderLower();
    this.updateFocus();
  };

  DetailView.prototype.setArt = function (backdrop, poster) {
    S.setPoster(this.poster, poster || backdrop, 'w500');
    this.posterFallback.textContent = poster || backdrop ? '' : EP.displayTitle(this.item.title);
    var art = backdrop ? EP.sizedImage(backdrop, 'w1280') : EP.sizedImage(poster, 'w500');
    this.backdrop.style.backgroundImage = art ? 'url("' + art.replace(/"/g, '%22') + '")' : 'none';
    this.backdrop.style.opacity = art ? '0.55' : '0';
    this.backdrop.style.filter = backdrop ? 'none' : 'blur(18px)';
  };

  DetailView.prototype.setMetadata = function (metadata) {
    if (!this.item) return;
    if (!metadata || metadata.found !== true || !metadata.item) {
      if (this.isSeries()) this.status.textContent = 'Esta série não tem episódios na sua lista.';
      return;
    }
    var d = metadata.item, parts = [];
    if (d.overview) this.overview.textContent = d.overview;
    if (d.release_date) parts.push(String(d.release_date).slice(0, 10));
    if (d.duration) parts.push(d.duration);
    if (parseFloat(d.vote_average) > 0) parts.push('Avaliação ' + (Math.round(parseFloat(d.vote_average) * 10) / 10));
    parts.push(this.item.category);
    this.meta.textContent = parts.join('   •   ');
    if (d.genres && d.genres.length) this.genres.textContent = d.genres.slice(0, 4).join('  •  ');
    if (d.backdrop || d.poster) this.setArt(d.backdrop || this.item.backdrop || '', d.poster || this.item.logo || '');
    this.trailerUrl = d.trailer_url || '';
    S.show(this.buttons[3], !!this.trailerUrl);
    if (this.trailerUrl && !this.isSeries()) this.status.textContent = 'Trailer oficial disponível.';
    if (d.seasons && d.seasons.length) {
      this.seasons = d.seasons;
      this.seasonIndex = 0;
      this.status.textContent = '';
      S.setButton(this.buttons[0], '', 'Assistir');
    } else if (this.isSeries()) this.status.textContent = 'Esta série não tem episódios na sua lista.';
    this.renderLower();
    this.updateFocus();
  };

  DetailView.prototype.renderLower = function () {
    var self = this, seasonMode = !!this.seasons;
    this.strip.innerHTML = '';
    this.cards = [];
    S.show(this.seasonPanel, seasonMode); S.show(this.seasonLabel, seasonMode); S.show(this.seasonHint, seasonMode); S.show(this.episodeHint, seasonMode);
    var similarMode = !seasonMode && this.similar.length > 0;
    S.show(this.similarTitle, similarMode); S.show(this.similarHint, similarMode);
    if (seasonMode) {
      var season = this.seasons[this.seasonIndex];
      this.episodes = season.episodes || [];
      this.seasonLabel.textContent = season.name + '   •   ' + season.episode_count + ' episódios   •   ' + (this.seasonIndex + 1) + ' de ' + this.seasons.length;
      S.move(this.strip, 20, 786);
      for (var e = 0; e < this.episodes.length; e++) this.cards.push(this.episodeCard(this.episodes[e], e));
    } else if (similarMode) {
      this.episodes = null;
      S.move(this.strip, 20, 760);
      for (var r = 0; r < this.similar.length; r++) this.cards.push(this.recommendationCard(this.similar[r], r));
    } else this.episodes = null;
    this.cardIndex = Math.min(this.cardIndex, Math.max(0, this.cards.length - 1));
    if (seasonMode && self.seasons.length) this.updateHints();
  };

  DetailView.prototype.updateHints = function () {
    this.seasonHint.textContent = this.seasons.length > 1 ? '←/→ trocar temporada   •   ↓ ver episódios' : '↓ ver episódios';
    this.episodeHint.textContent = this.zone === 'episodes' ? '←/→ escolher episódio   •   OK assistir   •   ↑ temporadas' : '↓ para escolher um episódio';
  };

  DetailView.prototype.episodeCard = function (ep, index) {
    var self = this;
    var box = S.el(this.strip, { x: index * (CARD_W + CARD_GAP), y: 0, w: CARD_W, h: CARD_H + 92 });
    var img = S.el(box, { x: 0, y: 0, w: CARD_W, h: CARD_H, className: 'poster has-art', css: 'border-radius:12px;background-image:linear-gradient(135deg,#1a2b4a,#0d1422 70%)' });
    var art = ep.image || this.item.backdrop || this.item.logo;
    if (art) { S.setPoster(img, art, 'w300'); img.style.backgroundSize = 'cover'; }
    var saved = EP.find(LS.load().continue_watching, function (x) { return x.id === self.episodeId(ep); });
    if (saved && saved.duration_seconds) {
      var track = document.createElement('div'); track.className = 'progress-track';
      var fill = document.createElement('div'); fill.className = 'progress-fill'; fill.style.width = Math.round(100 * saved.progress_seconds / saved.duration_seconds) + '%';
      track.appendChild(fill); img.appendChild(track);
    }
    S.label(box, { x: 0, y: CARD_H + 11, w: CARD_W, h: 26, text: 'EPISÓDIO ' + ep.number, size: 18, weight: 700, color: '0x00D7FFFF', css: 'letter-spacing:0.06em' });
    S.label(box, { x: 0, y: CARD_H + 37, w: CARD_W, h: 56, text: ep.name || 'Episódio', size: 20, weight: 500, lineHeight: 26, lines: 2 });
    img.addEventListener('click', function () { self.zone = 'episodes'; self.cardIndex = index; self.updateFocus(); self.playEpisode(); });
    return img;
  };

  DetailView.prototype.recommendationCard = function (item, index) {
    var self = this;
    var box = S.el(this.strip, { x: index * (REC_W + REC_GAP), y: 0, w: REC_W, h: REC_H + 46 });
    var p = S.el(box, { x: 0, y: 0, w: REC_W, h: REC_H, className: 'poster' + (item.logo ? ' has-art' : '') });
    if (item.logo) { S.setPoster(p, item.logo); p.style.backgroundSize = 'cover'; }
    var fb = document.createElement('div'); fb.className = 'tile-fallback'; fb.textContent = EP.displayTitle(item.title); p.appendChild(fb);
    S.label(box, { x: 2, y: REC_H + 12, w: REC_W - 4, h: 26, text: EP.displayTitle(item.title), size: 18, color: '0x8894A8FF' });
    p.addEventListener('click', function () { self.events.emit('selectedItem', item); });
    return p;
  };

  DetailView.prototype.episodeId = function (ep) { return this.item.id + ':episode:' + ep.id; };

  DetailView.prototype.episodeQueue = function (startIndex) {
    var queue = [], season = this.seasons[this.seasonIndex];
    for (var i = startIndex; i < this.episodes.length; i++) {
      var ep = this.episodes[i];
      if (!/^https?:\/\//.test(ep.stream_url || '')) break;
      queue.push({ url: ep.stream_url, title: EP.displayTitle(this.item.title) + ' • T' + season.number + ' E' + ep.number + (ep.name ? ' — ' + ep.name : ''), id: this.episodeId(ep), parentId: this.item.id, category: this.item.category, introEnd: 0 });
    }
    return queue;
  };

  DetailView.prototype.playEpisode = function () {
    if (P.isBlockedItem(this.item.category, this.item.id)) { this.status.textContent = 'Conteúdo protegido. Valide o PIN em Ajustes para assistir.'; return; }
    if (!this.episodes || !this.episodes.length) { this.status.textContent = 'Carregando episódios…'; return; }
    var queue = this.episodeQueue(this.cardIndex);
    if (!queue.length) { this.status.textContent = 'Este episódio ainda não possui reprodução autorizada na sua lista.'; return; }
    var request = queue[0];
    request.queue = queue;
    this.events.emit('episodeRequested', request);
  };

  DetailView.prototype.updateCollectionButtons = function () {
    if (!this.item) return;
    var state = LS.load();
    S.setButton(this.buttons[1], '', LS.contains(state.favorites, this.item.id) ? 'Na Minha Lista' : '+ Minha Lista');
    S.setButton(this.buttons[2], '', LS.contains(state.watch_later, this.item.id) ? 'Na lista: mais tarde' : 'Assistir mais tarde');
  };

  DetailView.prototype.updateFocus = function () {
    for (var i = 0; i < this.buttons.length; i++) S.focus(this.buttons[i], this.zone === 'actions' && i === this.action);
    this.seasonPanel.style.boxShadow = this.zone === 'seasons' ? '0 0 0 6px #00d7ff' : 'none';
    for (i = 0; i < (this.cards || []).length; i++) S.focus(this.cards[i], this.zone === 'episodes' && i === this.cardIndex);
    var stride = this.seasons ? CARD_W + CARD_GAP : REC_W + REC_GAP, visible = this.seasons ? CARDS : 10;
    var offset = this.zone === 'episodes' ? Math.max(0, this.cardIndex - visible + 1) : 0;
    this.strip.style.transform = 'translateX(-' + (offset * stride) + 'px)';
    if (this.seasons) this.updateHints();
  };

  DetailView.prototype.maxAction = function () { return this.trailerUrl ? 3 : 2; };

  DetailView.prototype.handleKey = function (key) {
    if (key === 'back') {
      if (this.zone !== 'actions') { this.zone = 'actions'; this.updateFocus(); return true; }
      this.events.emit('closeRequested'); return true;
    }
    var hasCards = this.cards && this.cards.length > 0;
    if (this.zone === 'actions') {
      if (key === 'right' && this.action < this.maxAction()) { this.action++; this.updateFocus(); return true; }
      if (key === 'left' && this.action > 0) { this.action--; this.updateFocus(); return true; }
      if (key === 'down') { if (this.seasons) this.zone = 'seasons'; else if (hasCards) this.zone = 'episodes'; this.updateFocus(); return true; }
      if (key === 'OK') { this.runAction(); return true; }
      return true;
    }
    if (this.zone === 'seasons') {
      if (key === 'right' && this.seasonIndex < this.seasons.length - 1) { this.seasonIndex++; this.cardIndex = 0; this.renderLower(); this.updateFocus(); return true; }
      if (key === 'left' && this.seasonIndex > 0) { this.seasonIndex--; this.cardIndex = 0; this.renderLower(); this.updateFocus(); return true; }
      if (key === 'up') { this.zone = 'actions'; this.updateFocus(); return true; }
      if ((key === 'down' || key === 'OK') && hasCards) { this.zone = 'episodes'; this.updateFocus(); return true; }
      return true;
    }
    if (key === 'right' && this.cardIndex < this.cards.length - 1) { this.cardIndex++; this.updateFocus(); return true; }
    if (key === 'left' && this.cardIndex > 0) { this.cardIndex--; this.updateFocus(); return true; }
    if (key === 'up') { this.zone = this.seasons ? 'seasons' : 'actions'; this.updateFocus(); return true; }
    if (key === 'OK') {
      if (!this.seasons) { this.events.emit('selectedItem', this.similar[this.cardIndex]); return true; }
      this.playEpisode();
    }
    return true;
  };

  DetailView.prototype.runAction = function () {
    var item = this.item;
    if (!item) return;
    if (this.action === 0) {
      if (P.isBlockedItem(item.category, item.id)) { this.status.textContent = 'Conteúdo protegido. Valide o PIN em Ajustes para assistir.'; return; }
      if (this.isSeries()) { this.playEpisode(); return; }
      this.events.emit('playRequested', item);
    } else if (this.action === 1) {
      this.status.textContent = LS.toggle('favorites', item) ? 'Adicionado aos favoritos.' : 'Removido dos favoritos.';
      this.updateCollectionButtons();
    } else if (this.action === 2) {
      this.status.textContent = LS.toggle('watch_later', item) ? 'Adicionado para assistir mais tarde.' : 'Removido de assistir mais tarde.';
      this.updateCollectionButtons();
    } else if (this.trailerUrl) {
      this.events.emit('trailerRequested', { url: this.trailerUrl, title: EP.displayTitle(item.title) + ' • Trailer', id: item.id, category: item.category });
    }
  };

  EP.DetailView = DetailView;
}(window.EP));
