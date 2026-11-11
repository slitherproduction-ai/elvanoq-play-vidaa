/* Porta de components/PlayerView.xml + PlayerView.brs com o <video> nativo
 * do webOS: OSD superior/inferior, linha do tempo, controles ↶10s / Pausar /
 * 10s↷ / Áudio / Legendas, zapping ↑/↓ no ao vivo, guia now/next,
 * reconexão automática (3x), pular abertura, próximo episódio em 6s e
 * gravação de progresso a cada 30s.
 * 1.1.0 (Android 2.17.21) e 1.1.1 (Android 2.17.25): retomada automática quando o vídeo trava
 * (12 s ao vivo / 20 s filme, até 3 tentativas), formato do ao vivo lembrado
 * por lista e rever programas com três formatos de catch-up.
 */
(function (EP) {
  'use strict';
  var S = EP.Stage, LS = EP.LocalState, P = EP.Parental, F = EP.StreamFormat, G = EP.EpgRules, LF = EP.LiveFormat;
  var WATCH_MS = 4000, STALL_LIVE_MS = 20000, STALL_VOD_MS = 30000, STALL_RETRIES = 3;
  var STALL_TEXT = 'O sinal parou de chegar. Reconectando…';

  function PlayerView(parent) {
    var root = this.root = S.group(parent, { className: 'layer', visible: false });
    var self = this;
    this.events = new EP.Emitter();
    S.rect(root, { x: 0, y: 0, w: 1920, h: 1080, color: '0x000000FF' });
    var video = this.video = document.createElement('video');
    video.className = 'sg-video';
    video.setAttribute('playsinline', '');
    video.style.left = '0px'; video.style.top = '0px'; video.style.width = '1920px'; video.style.height = '1080px';
    root.appendChild(video);
    // OSD com a geometria do PlayerView.xml do Roku 0.1.88.
    var osd = this.osd = S.group(root, { className: 'layer' });
    S.rect(osd, { x: 0, y: 0, w: 1920, h: 1080, color: '0x070B1433' });
    S.el(osd, { x: 0, y: 0, w: 1920, h: 240, css: 'background:linear-gradient(rgba(7,11,20,0.92),rgba(7,11,20,0))' });
    S.el(osd, { x: 0, y: 440, w: 1920, h: 640, css: 'background:linear-gradient(rgba(7,11,20,0),rgba(7,11,20,0.82) 45%,rgba(7,11,20,0.97))' });
    this.backLabel = S.el(osd, { x: 0, y: 0, w: 1, h: 1, visible: false });
    this.logo = S.el(osd, { x: 64, y: 664, w: 108, h: 72, visible: false, css: 'border-radius:12px;background:#111b2d center/contain no-repeat' });
    this.hint = S.label(osd, { x: 64, y: 52, w: 1400, h: 34, text: 'OK: controles   •   Voltar: sair', size: 22, color: '0xC9D3E3FF' });
    this.contentBadge = S.label(osd, { x: 1456, y: 52, w: 400, h: 34, text: 'ELVANOQ PLAY', size: 18, weight: 700, align: 'right', color: '0x00D7FFFF', css: 'letter-spacing:0.14em' });
    this.nowPlaying = S.label(osd, { x: 64, y: 752, w: 800, h: 26, text: 'REPRODUZINDO', size: 18, weight: 700, color: '0x00D7FFFF', css: 'letter-spacing:0.14em' });
    this.title = S.label(osd, { x: 64, y: 784, w: 1500, h: 56, size: 42, weight: 700, css: 'letter-spacing:-0.015em' });
    this.liveGuideLabel = S.label(osd, { x: 64, y: 846, w: 1500, h: 32, size: 22, weight: 500, color: '0xD6DEEBFF', visible: false });
    this.timeline = S.el(osd, { x: 64, y: 898, w: 1792, h: 6, className: 'timeline', html: '<div class="fill" style="width:0"></div>' });
    this.timelineProgress = this.timeline.firstChild;
    this.timeLabel = S.label(osd, { x: 64, y: 914, w: 700, h: 30, size: 22, weight: 600 });
    this.trackStatus = S.label(osd, { x: 856, y: 914, w: 1000, h: 30, size: 20, align: 'right', color: '0x8894A8FF' });
    this.trackPanelTitle = document.createElement('span');
    this.trackPanelValue = document.createElement('span');
    var defs = ['-10s', 'Pausar', '+10s', 'Áudio', 'Legendas'];
    this.controlLabels = [];
    for (var i = 0; i < 5; i++) {
      var control = S.el(osd, { x: 64 + i * 176, y: 958, w: 160, h: 56, className: 'osd-control' });
      S.setButton(control, '', defs[i]);
      (function (index) { control.addEventListener('click', function () { self.selectedControl = index; self.updateControlFocus(); self.runSelectedControl(); }); }(i));
      this.controlLabels.push(control);
    }
    this.controls = S.label(osd, { x: 1256, y: 972, w: 600, h: 30, text: '←/→ selecionar   •   OK confirmar', size: 20, align: 'right', color: '0x8894A8FF' });
    this.backLabel.addEventListener('click', function () { self.handleKey('back'); });
    this.nextPanel = S.group(root, { className: 'layer', visible: false });
    S.el(this.nextPanel, { x: 660, y: 420, w: 600, h: 176, css: 'border-radius:24px;background:rgba(13,20,34,0.95);border:2px solid rgba(0,215,255,0.35);box-shadow:0 30px 70px rgba(0,0,0,0.5)' });
    S.label(this.nextPanel, { x: 696, y: 448, w: 540, h: 30, text: 'PRÓXIMO EPISÓDIO', size: 18, weight: 700, color: '0x00D7FFFF', css: 'letter-spacing:0.14em' });
    this.nextEpisodeHint = S.label(this.nextPanel, { x: 696, y: 492, w: 540, h: 80, size: 22, lineHeight: 30, color: '0xF4F8FFFF' });
    this.nextEpisodeHint.className += ' pre';

    this.content = null; this.selectedControl = 1; this.lastPersistedSecond = -30; this.liveRetries = 0;
    this.awaitingNextEpisode = false; this.subtitlesDisabled = false;
    this.osdTimer = new EP.Timer(5, false, function () { if (self.isPlaying()) self.hideOsd(); });
    this.nextEpisodeTimer = new EP.Timer(6, false, function () { self.requestNextEpisode(); });
    this.retryTimer = new EP.Timer(2, false, function () { self.onRetryTimer(); });
    this.bindVideo();
    this.updateControlFocus();
  }

  PlayerView.prototype.isVisible = function () { return S.isVisible(this.root); };
  PlayerView.prototype.isPlaying = function () { return !this.video.paused && !this.video.ended && this.video.readyState > 2; };
  PlayerView.prototype.isLive = function () { return !!(this.content && this.content.liveQueue && this.content.liveQueue.length); };
  PlayerView.prototype.isCatchup = function () { return !!(this.content && this.content.catchupUrls && this.content.catchupUrls.length); };
  PlayerView.prototype.hasTimeline = function () { var d = this.video.duration; return !this.isLive() && isFinite(d) && d > 0; };

  PlayerView.prototype.bindVideo = function () {
    var self = this, v = this.video;
    v.addEventListener('playing', function () {
      self.liveRetries = 0;
      self.userPaused = false;
      if (self.isLive()) LF.remember(LF.formatOf(self.currentUrl)); // "Automático": lembra o que abriu
      if (self.hint.textContent === STALL_TEXT) self.hint.textContent = self.defaultHint();
      S.setButton(self.controlLabels[1], '', 'Pausar');
      if (self.shouldRestorePosition && self.content.resumePosition > 0) {
        // O ponto salvo já foi aplicado no loadedmetadata (Roku 1.1.1: PlayStart).
        // Só se a TV ignorou aquele salto é que ele é feito aqui.
        if (v.currentTime < self.content.resumePosition - 5) { try { v.currentTime = self.content.resumePosition; } catch (_) {} }
        self.shouldRestorePosition = false;
        self.hint.textContent = 'Retomando de onde você parou.';
      } else if (/Carregando|Reconectando|Tentando/.test(self.hint.textContent)) self.hint.textContent = self.defaultHint();
      self.refreshTrackStatus();
      self.showOsd();
    });
    v.addEventListener('pause', function () { if (!v.ended && !self.failed) { S.setButton(self.controlLabels[1], '', 'Retomar'); self.showOsd(); } });
    v.addEventListener('waiting', function () { if (self.hint.textContent !== STALL_TEXT) self.hint.textContent = 'Carregando stream…'; self.showOsd(); });
    v.addEventListener('timeupdate', function () { self.onPositionChanged(); });
    v.addEventListener('loadedmetadata', function () {
      self.refreshTrackStatus();
      // Retomada depois de travar: volta à última posição do filme/episódio.
      if (self.pendingSeek > 0) { try { v.currentTime = self.pendingSeek; } catch (_) {} self.pendingSeek = 0; }
    });
    v.addEventListener('ended', function () { self.onFinished(); });
    v.addEventListener('error', function () { self.onLoadError(self.loadToken); });
  };

  PlayerView.prototype.defaultHint = function () {
    return this.isLive() ? '↑/↓: trocar canal  •  ' + EP.OPTIONS_LABEL + ': favorito  •  Voltar: sair' : 'OK: controles  •  Voltar: sair';
  };

  /* content: { streamUrl, id, title, category, resumePosition, persistEnabled,
   *            skipIntroEnd, nextEpisode, liveQueue, liveIndex, liveGuide } */
  PlayerView.prototype.play = function (content) {
    this.content = content;
    S.show(this.root, true);
    this.cancelNextEpisode(false);
    this.title.textContent = content.title || '';
    var hasLogo = !!(content.logo && content.liveQueue && content.liveQueue.length);
    S.show(this.logo, hasLogo);
    if (hasLogo) S.setPoster(this.logo, content.logo);
    this.nowPlaying.textContent = content.liveQueue && content.liveQueue.length ? 'AO VIVO' : (content.nextEpisode ? 'EPISÓDIO' : 'REPRODUZINDO');
    this.skipIntroAvailable = content.skipIntroEnd > 0;
    this.subtitlesDisabled = false;
    this.lastPersistedSecond = -30;
    this.shouldRestorePosition = content.resumePosition > 0;
    this.liveRetries = 0;
    this.rawCredentialTried = false;
    this.catchupIndex = 0;
    // Filme/episódio retomado começa direto no ponto salvo (antes de bufferizar
    // o início): o salto é feito no loadedmetadata, como o PlayStart do Roku.
    this.pendingSeek = !this.isLive() && content.resumePosition > 0 ? content.resumePosition : 0;
    this.userPaused = false;
    this.lastGoodPosition = content.resumePosition || 0;
    this.retryTimer.stop();
    this.selectedControl = 1; this.updateControlFocus();
    if (P.isBlockedItem(content.category, content.id)) {
      this.stopVideo();
      this.hint.textContent = 'Conteúdo protegido. Valide o PIN em Ajustes para assistir.';
      this.showOsd();
      return;
    }
    var url = content.streamUrl;
    if (this.isCatchup()) { url = content.catchupUrls[0]; this.nowPlaying.textContent = 'REVENDO'; }
    else if (this.isLive()) url = LF.apply(url);
    this.load(url);
    this.startWatchdog();
    this.hint.textContent = this.defaultHint();
    if (this.isLive()) this.renderLiveGuide(); else S.show(this.liveGuideLabel, false);
    this.updateTimeline();
    this.showOsd();
  };

  PlayerView.prototype.load = function (url) {
    var v = this.video;
    this.currentUrl = url;
    // Libera o decoder da TV antes de trocar a fonte: pause, sem src, load().
    try { v.pause(); } catch (_) {}
    v.removeAttribute('src');
    while (v.firstChild) v.removeChild(v.firstChild);
    try { v.load(); } catch (_) {}
    var source = document.createElement('source'), self = this, token = this.loadToken = {};
    source.src = url;
    // Com <source>, a falha chega no próprio <source> (o <video> não dispara 'error').
    source.addEventListener('error', function () { self.onLoadError(token); });
    var mime = F.mimeForUrl(url);
    if (mime && mime !== 'video/mp2t' && mime !== 'video/x-matroska') source.type = mime;
    v.appendChild(source);
    try { v.load(); } catch (_) {}
    var attempt = v.play();
    if (attempt && attempt.catch) attempt.catch(function () {});
  };

  PlayerView.prototype.renderLiveGuide = function () {
    var guide = this.content && this.content.liveGuide;
    if (!this.isLive() || !guide || !guide.now) { S.show(this.liveGuideLabel, false); return; }
    var text = 'GUIA  ' + G.programmeLabel(guide.now, '  ');
    if (guide.next) text += '   •   SEGUINTE  ' + G.programmeLabel(guide.next, '  ');
    this.liveGuideLabel.textContent = text;
    S.show(this.liveGuideLabel, true);
  };

  PlayerView.prototype.setLiveGuide = function (guide) {
    if (!this.content) return;
    this.content.liveGuide = guide;
    if (S.isVisible(this.osd)) this.renderLiveGuide();
  };

  /* Uma falha por carregamento, venha do <video> ou do <source>. */
  PlayerView.prototype.onLoadError = function (token) {
    if (!token || token !== this.loadToken || token.failed) return;
    token.failed = true;
    this.onError();
  };

  PlayerView.prototype.onError = function () {
    if (!this.content) return;
    var self = this;
    if (this.isCatchup()) {
      // Próximo formato de catch-up; sem cair para o ao vivo.
      if (this.catchupIndex < this.content.catchupUrls.length - 1) {
        this.catchupIndex++;
        this.hint.textContent = 'Tentando outro formato para rever…';
        this.load(this.content.catchupUrls[this.catchupIndex]);
        return;
      }
      this.showFatal('Este programa não está disponível para rever.');
      return;
    }
    if (this.isLive() && this.liveRetries < 3) {
      this.liveRetries++;
      this.hint.textContent = 'Reconectando ao canal… (' + this.liveRetries + '/3)';
      this.showOsd();
      this.retryTimer.start();
      return;
    }
    // Última tentativa: usuário e senha sem codificação na URL (painéis que não
    // aceitam %40, %2B etc.). Só uma vez por conteúdo.
    var raw = !this.rawCredentialTried && F.rawCredentialVariant(this.currentUrl);
    if (raw) {
      this.rawCredentialTried = true;
      this.hint.textContent = 'Tentando outro endereço do servidor…';
      this.load(raw);
      return;
    }
    this.showFatal('Não foi possível reproduzir este conteúdo. Tente novamente.');
  };

  /* Tela de erro: a OSD fica visível com o controle "Tentar" em foco. */
  PlayerView.prototype.showFatal = function (message) {
    var self = this;
    this.stopWatchdog();
    this.failed = true;
    this.hint.textContent = message;
    S.setButton(this.controlLabels[1], '', 'Tentar');
    this.selectedControl = 1; this.updateControlFocus();
    this.showOsd();
    setTimeout(function () { self.osdTimer.stop(); }, 0);
  };

  /* ---------- retomada automática quando o vídeo trava ----------
   * Um único setInterval de 4 s enquanto o player está aberto. Conta como
   * travado quando currentTime não avança por 20 s (ao vivo) ou 30 s (filme),
   * sem pausa do usuário e com a tela visível. Só é armado depois que o vídeo
   * começou a avançar: servidor lento na abertura não é reiniciado em ciclo
   * (a falha de abertura continua tratada pelos eventos de erro). */
  PlayerView.prototype.startWatchdog = function () {
    var self = this;
    this.stopWatchdog();
    this.failed = false;
    this.stallRetries = 0;
    this.hasStarted = false;
    this.lastTime = -1;
    this.lastProgressAt = Date.now();
    this.watchdog = setInterval(function () { self.watchTick(); }, WATCH_MS);
  };

  PlayerView.prototype.stopWatchdog = function () {
    if (this.watchdog) clearInterval(this.watchdog);
    this.watchdog = null;
  };

  PlayerView.prototype.watchTick = function () {
    var v = this.video, now = Date.now();
    if (!this.content || this.failed || this.awaitingNextEpisode) { this.lastProgressAt = now; return; }
    var hidden = typeof document.visibilityState === 'string' && document.visibilityState !== 'visible';
    if (this.userPaused || v.ended || hidden) { this.lastProgressAt = now; this.lastTime = v.currentTime; return; }
    // 1ª leitura depois de abrir/reconectar: só marca a posição. Após uma
    // reconexão o ao vivo recomeça perto de 0, então não comparamos com a
    // posição de antes (isso dava "O sinal não voltou" com o canal tocando).
    if (this.lastTime < 0) { this.lastTime = v.currentTime; this.lastProgressAt = now; return; }
    if (v.currentTime > this.lastTime + 0.25) {
      if (this.stallRetries && this.hint.textContent === STALL_TEXT) this.hint.textContent = this.defaultHint();
      this.hasStarted = true;
      this.lastTime = v.currentTime;
      this.lastProgressAt = now;
      this.stallRetries = 0; // voltou a avançar
      if (!this.isLive() && v.currentTime > 1) this.lastGoodPosition = v.currentTime;
      return;
    }
    if (!this.hasStarted) { this.lastProgressAt = now; return; }
    if (now - this.lastProgressAt < (this.isLive() ? STALL_LIVE_MS : STALL_VOD_MS)) return;
    if (this.stallRetries >= STALL_RETRIES) { this.showFatal('O sinal não voltou. Confira a internet e tente de novo.'); return; }
    this.stallRetries++;
    this.lastProgressAt = now;
    this.hint.textContent = STALL_TEXT;
    this.showOsd();
    this.osdTimer.stop();
    this.pendingSeek = this.isLive() ? 0 : Math.max(this.lastGoodPosition || 0, this.lastTime || 0);
    this.lastTime = -1;
    this.load(this.currentUrl);
  };

  PlayerView.prototype.onRetryTimer = function () {
    if (!this.isLive() || !this.content) return;
    // No "Automático", a 1ª reconexão troca HLS <-> TS do mesmo canal Xtream;
    // o formato que abrir fica lembrado para a lista. A escolha manual vence.
    var alternative = this.liveRetries === 1 && LF.mode() === 'auto' ? (LF.alternative(this.currentUrl) || F.hlsAlternative(this.currentUrl)) : '';
    this.load(alternative || this.currentUrl);
  };

  PlayerView.prototype.onFinished = function () {
    if (this.isLive() && this.liveRetries < 3) { this.onError(); return; }
    this.persistProgress(true);
    var next = this.content && this.content.nextEpisode;
    if (next && next.url) {
      this.osdTimer.stop();
      this.awaitingNextEpisode = true;
      S.show(this.nextPanel, true);
      this.nextEpisodeHint.textContent = 'A seguir: ' + next.title + '\nOK iniciar agora  •  ' + EP.OPTIONS_LABEL + ' cancelar';
      this.hint.textContent = 'Próximo episódio em 6 segundos.';
      this.showOsd();
      this.nextEpisodeTimer.start();
      return;
    }
    this.hint.textContent = 'Reprodução concluída.';
    this.showOsd();
  };

  PlayerView.prototype.onPositionChanged = function () {
    // 'timeupdate' chega ~4x/s: com os controles ocultos não redesenha a barra
    // (showOsd atualiza ao reaparecer).
    if (this.osdVisible) this.updateTimeline();
    this.updateSkipIntroHint();
    var pos = this.video.currentTime;
    if (pos - this.lastPersistedSecond >= 30) this.persistProgress(false);
  };

  PlayerView.prototype.updateSkipIntroHint = function () {
    if (!this.skipIntroAvailable || !this.content) return;
    if (this.video.currentTime >= this.content.skipIntroEnd) { this.skipIntroAvailable = false; return; }
    var text = EP.OPTIONS_LABEL + ': pular abertura  •  OK: controles  •  Voltar: sair';
    if (this.hint.textContent !== text) this.hint.textContent = text;
  };

  PlayerView.prototype.handleKey = function (key) {
    if (this.awaitingNextEpisode) {
      if (key === 'OK') this.requestNextEpisode();
      else if (key === 'options' || key === 'back') this.cancelNextEpisode(true);
      return true;
    }
    if (key === 'play' || key === 'pause') { this.togglePlayPause(key); return true; }
    if (key === 'stop') { this.close(); return true; }
    if (key === 'rev') { this.seekBy(-10); this.showOsd(); return true; }
    if (key === 'fwd') { this.seekBy(10); this.showOsd(); return true; }
    // Android 2.17.30 / Roku 1.1.1: com os controles na tela, Voltar primeiro
    // fecha os controles; com a tela limpa, Voltar sai do player. Na tela de
    // erro ou sem vídeo carregado, Voltar sai direto.
    if (key === 'back') {
      if (S.isVisible(this.osd) && !this.failed && this.hasSource()) { this.hideOsd(); return true; }
      this.close();
      return true;
    }
    if (key === 'left') { if (this.selectedControl > 0) this.selectedControl--; this.updateControlFocus(); this.showOsd(); return true; }
    if (key === 'right') { if (this.selectedControl < 4) this.selectedControl++; this.updateControlFocus(); this.showOsd(); return true; }
    if ((key === 'up' || key === 'channelUp') && this.isLive()) { this.switchLiveChannel(-1); return true; }
    if ((key === 'down' || key === 'channelDown') && this.isLive()) { this.switchLiveChannel(1); return true; }
    if (key === 'options' && this.skipIntroAvailable && this.video.currentTime < this.content.skipIntroEnd) {
      try { this.video.currentTime = this.content.skipIntroEnd; } catch (_) {}
      this.skipIntroAvailable = false;
      this.hint.textContent = 'Abertura pulada.';
      this.showOsd();
      return true;
    }
    if (key === 'options' && this.isLive()) {
      this.events.emit('favoriteRequested', { id: this.content.id, title: this.content.title, category: this.content.category });
      this.hint.textContent = LS.isFavorite(this.content.id) ? 'Adicionado aos favoritos.' : 'Removido dos favoritos.';
      this.showOsd();
      return true;
    }
    if (key === 'OK') { if (S.isVisible(this.osd)) this.runSelectedControl(); else this.showOsd(); return true; }
    this.showOsd();
    this.refreshTrackStatus();
    return true;
  };

  PlayerView.prototype.hasSource = function () { return !!this.video.querySelector('source'); };

  PlayerView.prototype.close = function () {
    this.persistProgress(false);
    this.stopPlayback();
    S.show(this.root, false);
    this.events.emit('closeRequested');
  };

  PlayerView.prototype.requestNextEpisode = function () {
    if (!this.awaitingNextEpisode) return;
    this.nextEpisodeTimer.stop();
    this.awaitingNextEpisode = false;
    S.show(this.nextPanel, false);
    if (this.content && this.content.nextEpisode) this.events.emit('nextEpisodeRequested', this.content.nextEpisode);
  };

  PlayerView.prototype.cancelNextEpisode = function (showMessage) {
    this.nextEpisodeTimer.stop();
    this.awaitingNextEpisode = false;
    S.show(this.nextPanel, false);
    if (showMessage) {
      if (this.content) this.content.nextEpisode = null;
      this.hint.textContent = 'Próximo episódio cancelado.';
      this.showOsd();
    }
  };

  PlayerView.prototype.switchLiveChannel = function (delta) {
    var c = this.content;
    var next = Math.max(0, Math.min(c.liveQueue.length - 1, c.liveIndex + delta));
    if (next === c.liveIndex) { this.hint.textContent = 'Não há outro canal nesta direção.'; this.showOsd(); return; }
    this.events.emit('channelRequested', { item: c.liveQueue[next], index: next });
  };

  PlayerView.prototype.showOsd = function () {
    this.osdVisible = true;
    S.show(this.osd, true);
    if (this.content) this.updateTimeline();
    if (this.isLive()) this.renderLiveGuide();
    if (this.awaitingNextEpisode) S.show(this.nextPanel, true);
    if (this.isPlaying()) this.osdTimer.start(); else this.osdTimer.stop();
  };

  PlayerView.prototype.hideOsd = function () {
    this.osdTimer.stop();
    this.osdVisible = false;
    S.show(this.osd, false);
    S.show(this.nextPanel, false);
  };

  PlayerView.prototype.updateControlFocus = function () {
    for (var i = 0; i < 5; i++) S.focus(this.controlLabels[i], i === this.selectedControl);
    this.refreshTrackStatus();
  };

  PlayerView.prototype.runSelectedControl = function () {
    var c = this.selectedControl;
    if (c === 0) this.seekBy(-10);
    else if (c === 1) this.togglePlayPause('play');
    else if (c === 2) this.seekBy(10);
    else if (c === 3) this.cycleAudioTrack();
    else if (c === 4) this.cycleSubtitleTrack();
    this.showOsd();
  };

  PlayerView.prototype.togglePlayPause = function (key) {
    var v = this.video;
    if (this.failed || v.error || /Não foi possível|não está disponível|não voltou/.test(this.hint.textContent)) {
      this.hint.textContent = 'Tentando reconectar ao stream…';
      this.liveRetries = 0;
      this.catchupIndex = 0;
      this.pendingSeek = this.isLive() ? 0 : (this.lastGoodPosition || 0);
      this.load(this.isCatchup() ? this.content.catchupUrls[0] : this.currentUrl);
      this.startWatchdog();
    } else if (key === 'pause' || (!v.paused && key !== 'play')) { this.userPaused = true; v.pause(); }
    else if (v.paused) { this.userPaused = false; var attempt = v.play(); if (attempt && attempt.catch) attempt.catch(function () {}); }
    else { this.userPaused = true; v.pause(); }
    this.showOsd();
  };

  PlayerView.prototype.seekBy = function (delta) {
    if (!this.hasTimeline()) { this.hint.textContent = 'Avanço não disponível neste stream ao vivo.'; return; }
    var v = this.video;
    try { v.currentTime = Math.max(0, Math.min(v.duration, v.currentTime + delta)); } catch (_) {}
  };

  function audioTracks(v) { var t = v.audioTracks; return t && t.length !== undefined ? t : null; }
  function textTracks(v) {
    var list = [], t = v.textTracks;
    if (!t) return list;
    for (var i = 0; i < t.length; i++) if (t[i].kind === 'subtitles' || t[i].kind === 'captions') list.push(t[i]);
    return list;
  }
  function trackName(track, index) { return EP.text(track.label) || EP.text(track.language) || ('Faixa ' + (index + 1)); }

  PlayerView.prototype.cycleAudioTrack = function () {
    var tracks = audioTracks(this.video);
    if (!tracks || tracks.length < 2) { this.hint.textContent = 'Não há outra faixa de áudio neste stream.'; return; }
    var current = 0;
    for (var i = 0; i < tracks.length; i++) if (tracks[i].enabled) current = i;
    var next = (current + 1) % tracks.length;
    for (i = 0; i < tracks.length; i++) tracks[i].enabled = i === next;
    this.hint.textContent = 'Faixa de áudio atualizada.';
    this.refreshTrackStatus();
  };

  PlayerView.prototype.cycleSubtitleTrack = function () {
    var tracks = textTracks(this.video);
    if (!tracks.length) { this.hint.textContent = 'Não há legendas neste stream.'; return; }
    var current = -1;
    for (var i = 0; i < tracks.length; i++) if (tracks[i].mode === 'showing') current = i;
    var next = current + 1;
    for (i = 0; i < tracks.length; i++) tracks[i].mode = i === next ? 'showing' : 'disabled';
    this.subtitlesDisabled = next >= tracks.length;
    this.hint.textContent = this.subtitlesDisabled ? 'Legendas desativadas.' : 'Legenda atualizada.';
    this.refreshTrackStatus();
  };

  PlayerView.prototype.refreshTrackStatus = function () {
    var audio = 'Áudio: automático', subtitles = 'Legendas: automático';
    var a = audioTracks(this.video);
    if (a) for (var i = 0; i < a.length; i++) if (a[i].enabled && a.length > 1) audio = 'Áudio: ' + trackName(a[i], i);
    var t = textTracks(this.video);
    if (this.subtitlesDisabled) subtitles = 'Legendas: desativadas';
    else for (i = 0; i < t.length; i++) if (t[i].mode === 'showing') subtitles = 'Legendas: ' + trackName(t[i], i);
    this.trackStatus.textContent = audio + '  •  ' + subtitles;
    if (this.selectedControl === 3) { this.trackPanelTitle.textContent = 'ÁUDIO'; this.trackPanelValue.textContent = audio; }
    else if (this.selectedControl === 4) { this.trackPanelTitle.textContent = 'LEGENDAS'; this.trackPanelValue.textContent = subtitles; }
    else { this.trackPanelTitle.textContent = 'ÁUDIO E LEGENDAS'; this.trackPanelValue.textContent = audio + '  •  ' + subtitles; }
  };

  PlayerView.prototype.updateTimeline = function () {
    if (!this.hasTimeline()) {
      var now = this.isLive() && this.content.liveGuide && this.content.liveGuide.now;
      this.timelineProgress.style.width = now ? Math.round(100 * G.progress(now)) + '%' : '0';
      this.timeLabel.textContent = now ? 'AO VIVO   •   ' + now.title : 'Transmissão ao vivo';
      return;
    }
    var v = this.video, pct = Math.max(0, Math.min(1, v.currentTime / v.duration));
    this.timelineProgress.style.width = (pct * 100).toFixed(2) + '%';
    this.timeLabel.textContent = EP.formatTime(v.currentTime) + ' / ' + EP.formatTime(v.duration);
  };

  PlayerView.prototype.persistProgress = function (completed) {
    var c = this.content, v = this.video;
    if (!c || !c.persistEnabled || !c.id || !(v.currentTime > 0)) return;
    var duration = isFinite(v.duration) ? Math.floor(v.duration) : 0;
    if (duration > 0 && v.currentTime / duration >= 0.95) completed = true;
    var item = { id: c.id, title: c.title, category: c.category, progress_seconds: Math.floor(v.currentTime), duration_seconds: duration, completed: completed, updated_at: new Date().toISOString() };
    if (c.saved) for (var key in c.saved) if (c.saved[key]) item[key] = c.saved[key];
    var state = LS.load();
    if (!this.isLive()) state.continue_watching = completed ? LS.remove(state.continue_watching, item.id) : LS.upsert(LS.remove(state.continue_watching, item.id), item);
    state.history = LS.upsert(LS.remove(state.history, item.id), item);
    LS.save(state);
    this.lastPersistedSecond = Math.floor(v.currentTime);
  };

  PlayerView.prototype.stopVideo = function () {
    var v = this.video;
    try { v.pause(); } catch (_) {}
    v.removeAttribute('src');
    while (v.firstChild) v.removeChild(v.firstChild);
    try { v.load(); } catch (_) {}
  };

  PlayerView.prototype.stopPlayback = function () {
    this.stopWatchdog();
    this.retryTimer.stop();
    this.osdTimer.stop();
    this.nextEpisodeTimer.stop();
    this.awaitingNextEpisode = false;
    this.stopVideo();
  };

  EP.PlayerView = PlayerView;
}(window.EP));
