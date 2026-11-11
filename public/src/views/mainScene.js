/* Porta de components/MainScene.xml + MainScene.brs: tela de ativação
 * (mesmo layout do Roku) e ciclo de vida da licença.
 *
 * Diferenças da versão web (LG/Samsung/VIDAA), preservadas da versão 0.4.0:
 *  - VIDAA usa o SHA-256 do ID do aparelho (ou uma identidade local);
 *  - o Portal recebe só o SHA-256 da identidade e uma chave numérica local;
 *  - a tela mostra código e chave, exigidos em elvanoqplay.app.
 */
(function (EP) {
  'use strict';
  var S = EP.Stage, Portal = EP.Portal;
  var PENDING_POLL = 30, ACTIVE_POLL = 300; // segundos (Portal: 60 consultas / 15 min)

  function MainScene(stage) {
    var self = this;
    this.stage = stage;
    // Mesmo layout do MainScene.xml do Roku 0.1.88: 3 passos, código em
    // destaque com borda ciano, QR code, botão contornado e status pulsante.
    var root = this.activation = S.group(stage, { className: 'layer' });
    S.rect(root, { x: 0, y: 0, w: 1920, h: 1080, color: '0x070B14FF' });
    S.poster(root, { x: 0, y: 0, w: 1920, h: 1080, uri: 'images/elvanoq-login-tv-backdrop.jpg' });
    S.el(root, { x: 0, y: 0, w: 1920, h: 1080, css: 'background:rgba(7,11,20,0.30)' });
    S.el(root, { x: 0, y: 0, w: 1920, h: 1080, css: 'background:linear-gradient(90deg,rgba(7,11,20,0.98) 0%,rgba(7,11,20,0.94) 38%,rgba(7,11,20,0.55) 62%,rgba(7,11,20,0) 85%)' });
    S.el(root, { x: 0, y: 0, w: 1920, h: 1080, css: 'background:linear-gradient(rgba(7,11,20,0) 55%,rgba(7,11,20,0.85) 100%)' });
    S.poster(root, { x: 96, y: 64, w: 240, h: 80, uri: 'images/elvanoq-wordmark-white.png', mode: 'fit' }).style.backgroundPosition = 'left center';
    this.clockTime = S.label(root, { x: 1460, y: 60, w: 364, h: 48, size: 40, weight: 600, align: 'right' });
    this.clockDate = S.label(root, { x: 1460, y: 110, w: 364, h: 30, size: 20, align: 'right', color: '0x8894A8FF' });
    S.label(root, { x: 96, y: 236, w: 900, h: 28, text: 'ACESSO SEGURO', size: 20, weight: 700, color: '0x00D7FFFF', css: 'letter-spacing:0.14em' });
    this.headline = S.label(root, { x: 96, y: 268, w: 1000, h: 84, text: 'Ative sua TV', size: 64, weight: 700, css: 'letter-spacing:-0.025em' });
    this.description = S.label(root, { x: 96, y: 356, w: 960, h: 34, size: 24, color: '0xB8C4D6FF', text: 'Vincule este aparelho ao Portal ELVANOQ Play em três passos.' });
    var steps = ['Acesse elvanoqplay.app ou aponte a câmera para o QR code', 'Informe o código e a chave desta TV', 'A TV ativa sozinha em alguns segundos'];
    for (var i = 0; i < 3; i++) {
      S.el(root, { x: 96, y: 418 + i * 58, w: 40, h: 40, text: String(i + 1), css: 'border-radius:20px;background:#147dff;color:#fff;font-size:20px;font-weight:700;display:flex;align-items:center;justify-content:center' });
      S.label(root, { x: 156, y: 418 + i * 58, w: 900, h: 40, text: steps[i], size: 24, weight: 500, valign: 'center' });
    }
    S.label(root, { x: 96, y: 612, w: 700, h: 26, text: 'CÓDIGO DESTE APARELHO', size: 18, weight: 700, color: '0x8894A8FF', css: 'letter-spacing:0.12em' });
    S.el(root, { x: 96, y: 646, w: 720, h: 116, css: 'box-sizing:border-box;border:3px solid #00d7ff;border-radius:16px;background:#0d1422' });
    this.deviceCode = S.label(root, { x: 99, y: 656, w: 714, h: 58, size: 44, weight: 700, align: 'center', css: 'letter-spacing:0.04em' });
    this.deviceKey = S.label(root, { x: 99, y: 716, w: 714, h: 30, size: 22, align: 'center', color: '0xB8C4D6FF' });
    this.qrGroup = S.group(root, { className: 'layer', visible: false });
    S.el(this.qrGroup, { x: 860, y: 596, w: 234, h: 234, css: 'background:#fff;border-radius:12px' });
    this.qrHolder = S.el(this.qrGroup, { x: 878, y: 614, w: 198, h: 198 });
    S.label(this.qrGroup, { x: 860, y: 842, w: 234, h: 28, text: 'Aponte a câmera do celular', size: 18, align: 'center', color: '0xB8C4D6FF' });
    S.label(this.qrGroup, { x: 860, y: 870, w: 234, h: 30, text: 'elvanoqplay.app', size: 22, weight: 600, align: 'center', color: '0x00D7FFFF' });
    this.button = S.el(root, { x: 96, y: 790, w: 720, h: 72, className: 'outline-action' });
    this.buttonText = this.button;
    this.button.addEventListener('click', function () { self.handleKey('OK'); });
    this.statusDot = S.el(root, { x: 96, y: 912, w: 18, h: 18, className: 'status-dot pulse' });
    this.status = S.label(root, { x: 130, y: 900, w: 1000, h: 42, text: 'Preparando ativação…', size: 22, weight: 500, valign: 'center' });
    S.label(root, { x: 1460, y: 1010, w: 364, h: 30, text: 'v' + EP.VERSION, size: 16, align: 'right', color: '0x8894A899' });
    // Aviso de teste encerrado (Roku 1.0.1): sem pagamento nem link externo.
    var ov = this.expiredOverlay = S.group(root, { className: 'layer', visible: false });
    S.rect(ov, { x: 0, y: 0, w: 1920, h: 1080, color: '0x02070DEB' });
    S.el(ov, { x: 300, y: 150, w: 1320, h: 780, css: 'border-radius:28px;background:#0b121e;border:1px solid rgba(190,220,255,0.2)' });
    S.poster(ov, { x: 810, y: 196, w: 300, h: 100, uri: 'images/elvanoq-wordmark-white.png', mode: 'fit' });
    S.label(ov, { x: 300, y: 330, w: 1320, h: 60, text: 'Seu teste gratuito terminou', size: 44, weight: 700, align: 'center' });
    S.label(ov, { x: 420, y: 400, w: 1080, h: 72, size: 24, lineHeight: 34, lines: 2, align: 'center', color: '0xB8C4D6FF', text: 'Este aparelho ainda não possui uma licença ativa. Assim que a licença for ativada, a TV libera o acesso automaticamente.' });
    S.label(ov, { x: 300, y: 506, w: 1320, h: 26, text: 'CÓDIGO DESTE APARELHO', size: 18, weight: 700, align: 'center', color: '0x8894A8FF', css: 'letter-spacing:0.12em' });
    S.el(ov, { x: 560, y: 544, w: 800, h: 104, css: 'box-sizing:border-box;border:3px solid #00d7ff;border-radius:18px;background:#0d1422' });
    this.expiredCode = S.label(ov, { x: 563, y: 547, w: 794, h: 98, size: 44, weight: 700, align: 'center', valign: 'center' });
    this.expiredInfo = S.label(ov, { x: 300, y: 672, w: 1320, h: 30, size: 20, align: 'center', color: '0x8894A8FF' });
    S.el(ov, { x: 740, y: 738, w: 440, h: 72, text: 'OK   •   Verificar agora', css: 'border-radius:28px;background:#f4f8ff;color:#070b14;font-size:24px;font-weight:600;display:flex;align-items:center;justify-content:center;white-space:pre' });
    S.label(ov, { x: 300, y: 852, w: 1320, h: 28, text: 'Voltar   •   Sair do aplicativo', size: 18, align: 'center', color: '0x8894A8FF', css: 'white-space:pre' });

    this.updateClock();
    this.clockTimer = new EP.Timer(20, true, function () { self.updateClock(); });
    this.clockTimer.start();

    this.shell = new EP.AppShell(stage, this);
    this.loading = S.el(stage, { x: 1300, y: 990, w: 560, h: 56, visible: false, css: 'display:flex;align-items:center;justify-content:center;padding:0 24px;border-radius:28px;background:rgba(17,27,45,0.92);border:1px solid rgba(190,222,255,0.16);font-size:20px;color:#c9d3e3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;z-index:40' });

    this.dialog = null;
    this.requestInFlight = false;
    this.playlistSynced = false;
    this.licenseTimer = new EP.Timer(PENDING_POLL, true, function () { self.checkLicense(); });
  }

  MainScene.prototype.start = function () {
    EP.Parental.clearSession();
    Portal.readIdentity();
    this.updateIdentity();
    if (!Portal.hasConsent()) { this.giveConsent(); return; }
    if (EP.Registry.read('login_removed') === 'true') {
      this.status.textContent = 'Login excluído. Entre novamente para continuar.';
      return;
    }
    this.connect();
  };

  MainScene.prototype.updateIdentity = function () {
    if (!Portal.identity) {
      this.deviceCode.textContent = 'Código ainda não gerado';
      this.deviceCode.style.fontSize = '32px';
      this.deviceKey.textContent = 'Pressione OK para gerar a identificação protegida';
      this.button.textContent = 'OK   •   Continuar e gerar identificação';
      S.show(this.qrGroup, false);
      return;
    }
    this.description.textContent = 'Vincule este aparelho ao Portal ELVANOQ Play em três passos.';
    this.deviceCode.textContent = Portal.deviceCode();
    this.deviceCode.style.fontSize = '44px';
    this.deviceKey.textContent = 'Chave do dispositivo: ' + Portal.identity.key;
    this.button.textContent = 'OK   •   Entrar com código do servidor';
    this.renderQr();
  };

  /* QR com o código desta TV (mesma URL do Roku). Sem matriz, some o QR. */
  MainScene.prototype.renderQr = function () {
    var svg = EP.QrCode.qrSvg('https://elvanoqplay.app/adicionar-lista/?codigo=' + Portal.deviceCode(), 6, '#070b14');
    this.qrHolder.innerHTML = svg;
    S.show(this.qrGroup, !!svg);
  };

  MainScene.prototype.updateClock = function () {
    var now = new Date(), days = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    var months = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
    this.clockTime.textContent = EP.clockText(now).time;
    this.clockDate.textContent = days[now.getDay()] + ', ' + now.getDate() + ' ' + months[now.getMonth()];
  };

  // Cores do ponto de status como no setStatusTone do Roku.
  MainScene.prototype.setTone = function (tone) {
    var colors = { error: '#ff5c72', waiting: '#ffb547', active: '#2ee59d', connecting: '#00d7ff' };
    this.statusDot.style.background = colors[tone] || colors.connecting;
    S.toggle(this.statusDot, 'pulse', tone !== 'error');
    this.status.style.color = tone === 'error' ? '#ffb3be' : '#f4f8ff';
  };

  MainScene.prototype.settingsInfo = function () {
    var id = Portal.identity, state = this.licenseState || 'pending';
    var labels = { active: ['Ativa', 'success'], expired: ['Expirada', 'warning'], blocked: ['Bloqueada', 'warning'], offline: ['Sem conexão', 'warning'], error: ['Indisponível', 'warning'], pending: ['Pendente', 'warning'] };
    var license = this.manualSession && state !== 'active' ? ['Acesso por código', 'success'] : (labels[state] || labels.pending);
    return {
      name: this.shell.playlistName || EP.Config.deviceName,
      code: id ? Portal.deviceCode() : '', key: id ? id.key : '',
      licenseLabel: license[0], licenseTone: license[1],
      listLabel: this.shell.playlistName ? (this.shell.playlistOrigin === 'manual-code' ? 'Código do servidor' : 'Portal') : 'Nenhuma'
    };
  };

  MainScene.prototype.setLoading = function (message) {
    var self = this;
    this.loading.textContent = message || '';
    S.show(this.loading, !!message);
    clearTimeout(this.loadingTimer);
    // Mensagens finais somem sozinhas; "Carregando…" fica até concluir.
    if (message && !/…$/.test(message)) this.loadingTimer = setTimeout(function () { S.show(self.loading, false); }, 6000);
  };

  /* ---------- fluxo do Portal (registro -> licença -> lista) ---------- */
  MainScene.prototype.openAccount = function () {
    var self = this;
    this.openList({ title: 'Conta', subtitle: 'Excluir o login salvo nesta TV?',
      items: [{ label: 'Cancelar' }, { label: 'Excluir login' }],
      onSelect: function (index) {
        self.dialog.close();
        if (index !== 1) return;
        self.licenseTimer.stop();
        self.shell.stopPlayback();
        Portal.manual = null;
        EP.Parental.clearSession();
        EP.Registry.remove('playlist_metadata');
        EP.Registry.write('login_removed', 'true');
        try { window.localStorage.removeItem('elvanoq-vidaa-playlists-v1'); } catch (_) {}
        window.location.reload();
      }
    });
  };

  MainScene.prototype.connect = function () {
    var self = this;
    this.status.textContent = 'Conectando ao Portal para ativação…';
    this.setTone('connecting');
    Portal.register().then(function (r) {
      if (!r.ok && r.status !== 0 && r.status !== 429) { self.showActivationState('error', r.message); return; }
      self.checkLicense();
    });
    this.licenseTimer.start();
  };

  MainScene.prototype.checkLicense = function () {
    var self = this;
    if (this.requestInFlight || !Portal.identity) return;
    this.requestInFlight = true;
    Portal.licenseStatus().then(function (r) {
      self.requestInFlight = false;
      self.showActivationState(r.state, r.message);
      if (r.state === 'active' && !self.playlistSynced) self.requestPlaylistSync(false);
    });
  };

  MainScene.prototype.requestPlaylistSync = function (manual) {
    var self = this;
    if (this.syncInFlight) return;
    this.syncInFlight = true;
    if (manual) this.setLoading('Buscando a lista salva no Portal…');
    Portal.playlistSync().then(function (r) {
      self.syncInFlight = false;
      if (r.ok && r.playlist) {
        self.playlistSynced = true;
        self.shell.applyPlaylist({ display_name: r.displayName, server_code: r.body.server_code, playlist: r.playlist });
        return;
      }
      if (r.ok && r.empty) { self.playlistSynced = true; self.setLoading('Nenhuma lista vinculada a esta TV no Portal. Adicione em elvanoqplay.app.'); return; }
      // Falha de rede/limite: usa a última lista sincronizada, sem apagar dados locais.
      var cached = Portal.portalPlaylist();
      if (cached && (r.status === 0 || r.status === 429 || r.status >= 500) && !self.playlistSynced) {
        self.playlistSynced = true;
        self.shell.applyPlaylist({ display_name: cached.name, playlist: cached });
        return;
      }
      self.setLoading(r.message || 'Falha temporária ao sincronizar. Seus dados locais foram preservados.');
    });
  };

  MainScene.prototype.showActivationState = function (state, message) {
    this.licenseState = state === 'offline' && this.licenseState === 'active' ? 'active' : state;
    if (state === 'active') {
      S.show(this.expiredOverlay, false);
      this.licenseTimer.seconds = ACTIVE_POLL; if (this.licenseTimer.running()) this.licenseTimer.start();
      this.setActivationVisible(false);
      this.shell.show(true);
      return;
    }
    if (state === 'offline' && this.shell.isVisible()) return; // mantém o app em uso sem rede
    if (state !== 'offline') S.show(this.expiredOverlay, state === 'expired');
    if (state === 'expired') {
      this.expiredCode.textContent = Portal.identity ? Portal.deviceCode() : '';
      this.expiredInfo.textContent = 'A ativação é verificada automaticamente a cada ' + PENDING_POLL + ' segundos.';
    }
    this.licenseTimer.seconds = PENDING_POLL; if (this.licenseTimer.running()) this.licenseTimer.start();
    if ((state === 'expired' || state === 'blocked') && this.shell.isVisible()) {
      this.shell.stopPlayback();
      this.shell.show(false);
    }
    if (state === 'pending' && this.shell.isVisible() && this.manualSession) return;
    this.setActivationVisible(true);
    this.setTone(state === 'pending' ? 'waiting' : state === 'offline' ? 'connecting' : 'error');
    if (state === 'expired') this.status.textContent = 'Teste gratuito encerrado. Este aparelho não possui licença ativa.';
    else if (state === 'blocked') this.status.textContent = 'Dispositivo bloqueado. Consulte o suporte no Portal.';
    else if (state === 'offline') this.status.textContent = message || 'Sem conexão. A ativação será verificada novamente.';
    else if (state === 'error') this.status.textContent = message || 'Falha ao consultar o Portal. Vamos tentar novamente.';
    else this.status.textContent = 'Aguardando ativação. Vincule esta TV em elvanoqplay.app.';
  };

  // Deep link: guardado até o catálogo carregar.
  MainScene.prototype.setDeepLink = function (link) { this.shell.setDeepLink(link); };

  MainScene.prototype.setActivationVisible = function (visible) { S.show(this.activation, visible); };

  /* ---------- teclas ---------- */
  MainScene.prototype.handleKey = function (key, event) {
    if (this.dialog && !this.dialog.closed) return this.dialog.handleKey(key, event);
    if (this.shell.isVisible() && !S.isVisible(this.activation)) return this.shell.handleKey(key);
    // Teste encerrado: OK verifica de novo; Voltar sai do app.
    if (S.isVisible(this.expiredOverlay)) {
      if (key === 'back') return false;
      if (key === 'OK') { this.expiredInfo.textContent = 'Verificando a ativação…'; this.checkLicense(); }
      return true;
    }
    if (key === 'OK') {
      if (!Portal.identity) this.giveConsent(); else this.openServerCodeKeyboard();
      return true;
    }
    return key !== 'back';
  };

  MainScene.prototype.giveConsent = function () {
    var self = this;
    this.status.textContent = 'Gerando identificação protegida…';
    Portal.ensureIdentity().then(function () { self.updateIdentity(); self.connect(); }, function () {
      self.status.textContent = 'Não foi possível preparar a ativação desta TV. Reinicie o aplicativo.';
    });
  };

  MainScene.prototype.openList = function (opts) {
    if (this.dialog && !this.dialog.closed) this.dialog.close();
    this.dialog = new EP.ListDialog(this.stage, opts);
    return this.dialog;
  };

  MainScene.prototype.openKeyboard = function (opts) {
    if (this.dialog && !this.dialog.closed) this.dialog.close();
    this.dialog = new EP.KeyboardDialog(this.stage, opts);
    return this.dialog;
  };

  /* Login por código do servidor: código -> usuário -> senha (só em memória). */
  MainScene.prototype.openServerCodeKeyboard = function () {
    var self = this;
    this.status.textContent = 'Informe o código do servidor para continuar.';
    this.openKeyboard({
      title: 'Código do servidor', message: 'Digite o código recebido no Portal.', buttons: ['Continuar', 'Cancelar'],
      onButton: function (index, value) {
        if (index !== 0) { self.status.textContent = 'Login por código cancelado.'; return; }
        var code = String(value || '').replace(/\s/g, '').toLowerCase();
        if (!/^[a-z0-9][a-z0-9_-]{2,31}$/.test(code)) { self.status.textContent = 'Código inválido. Confira o código e tente novamente.'; return; }
        self.status.textContent = 'Validando o código do servidor…';
        Portal.serverCodeResolve(code).then(function (r) {
          if (!r.ok) { self.status.textContent = r.message || 'Não foi possível validar este código. Tente novamente.'; return; }
          if (!r.host) { self.status.textContent = 'O Portal não retornou um servidor compatível.'; return; }
          self.askCredentials(code, r.host);
        });
      }
    });
  };

  MainScene.prototype.askCredentials = function (code, host) {
    var self = this;
    this.openKeyboard({
      title: 'Usuário da lista', message: 'Informe o usuário do seu acesso.', buttons: ['Continuar', 'Cancelar'],
      onButton: function (index, username) {
        username = EP.text(username);
        if (index !== 0 || !username) { self.status.textContent = 'Login por código cancelado.'; return; }
        self.openKeyboard({
          title: 'Senha da lista', message: 'Informe a senha do seu acesso.', buttons: ['Conectar', 'Cancelar'], secure: true,
          onButton: function (i, password) {
            if (i !== 0 || !password) { self.status.textContent = 'Login por código cancelado.'; return; }
            var playlist = Portal.useManualPlaylist({ name: 'Acesso por código', sourceType: 'xtream', credentials: { host: host, username: username, password: password } });
            EP.Registry.remove('login_removed');
            self.manualSession = true;
            self.setActivationVisible(false);
            self.shell.show(true);
            self.shell.applyPlaylist({ display_name: 'Acesso por código', server_code: code, playlist: playlist });
          }
        });
      }
    });
  };

  EP.MainScene = MainScene;
}(window.EP));

