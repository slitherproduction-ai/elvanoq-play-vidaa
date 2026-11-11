/* Ajustes — ParentalView do ELVANOQ Play Roku 0.1.88 (mesma geometria):
 * painel do PIN 620x830 (teclado 3x4 com Limpar / 0 / Apagar) e painel de
 * bloqueios 1152x830 (categorias ou canais e títulos).
 * Regras do Roku: sem PIN padrão (o primeiro acesso cria e confirma),
 * PIN salvo só como hash com sal, 5 erros bloqueiam por 5 minutos e o
 * desbloqueio vale somente nesta sessão. Bloqueios separados por lista ativa.
 * LG: o cabeçalho mostra código e chave da TV; VERDE sincroniza a lista e
 * AMARELO abre o login por código do servidor.
 */
(function (EP) {
  'use strict';
  var S = EP.Stage, P = EP.Parental;
  var KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'back'];
  var LIST_ROWS = 15, LIST_Y = 262, LIST_STRIDE = 44;

  function ParentalView(parent) {
    var self = this;
    this.events = new EP.Emitter();
    // 1.1.0: página premium dentro de Ajustes (brilho azul, cartões, foco 2 px).
    var root = this.root = EP.premiumPage(parent, 'Controle parental', 'PIN, conteúdo adulto e restrições desta TV').root;
    this.deviceInfo = S.label(root, { x: 944, y: 124, w: 912, h: 28, size: 20, align: 'right', color: '0xB6C2D6FF' });

    S.el(root, { x: 64, y: 180, w: 620, h: 830, className: 'premium-card' });
    S.label(root, { x: 104, y: 212, w: 540, h: 40, text: 'Controle Parental', size: 26, weight: 600 });
    this.description = S.label(root, { x: 104, y: 258, w: 540, h: 56, size: 20, lineHeight: 28, lines: 2, color: '0xB6C2D6FF' });
    this.dots = [];
    for (var d = 0; d < 4; d++) this.dots.push(S.el(root, { x: 104 + d * 52, y: 338, w: 30, h: 30, className: 'pin-dot' }));
    this.status = S.label(root, { x: 104, y: 384, w: 540, h: 30, size: 20, color: '0x8894A8FF' });
    this.keyNodes = [];
    for (var i = 0; i < KEYS.length; i++) {
      var label = KEYS[i] === 'clear' ? 'Limpar' : KEYS[i] === 'back' ? 'Apagar' : KEYS[i];
      var key = S.el(root, { x: 104 + (i % 3) * 176, y: 430 + Math.floor(i / 3) * 100, w: 160, h: 84, text: label, className: 'pin-key premium-key', css: 'line-height:80px;font-size:' + (label.length > 1 ? '20px' : '32px') });
      (function (index) { key.addEventListener('click', function () { self.keyIndex = index; self.pressKey(); }); }(i));
      this.keyNodes.push(key);
    }
    S.label(root, { x: 104, y: 956, w: 560, h: 28, text: 'Voltar   •   Ajustes', size: 18, color: '0x63728AFF' });

    S.el(root, { x: 704, y: 180, w: 1152, h: 830, className: 'premium-card' });
    this.listTitle = S.label(root, { x: 744, y: 212, w: 1072, h: 28, size: 18, weight: 700, color: '0x00D7FFFF', css: 'letter-spacing:0.08em' });
    this.lockedHint = S.label(root, { x: 744, y: 262, w: 1072, h: 34, size: 24, text: 'Digite o PIN para gerenciar categorias.' });
    this.rows = [];
    for (var r = 0; r < LIST_ROWS; r++) {
      var row = S.el(root, { x: 724, y: LIST_Y + r * LIST_STRIDE, w: 1112, h: 40, className: 'premium-row compact lock-row' });
      row.innerHTML = '<span class="icon" style="width:22px;height:22px;flex:none"></span><span class="pr-label"></span><span class="pr-badge"></span><span class="pr-state"></span>';
      this.rows.push(row);
    }
    this.scopeStatus = S.label(root, { x: 744, y: 940, w: 1072, h: 56, size: 20, lineHeight: 28, lines: 2, color: '0x8894A8FF', text: 'Bloqueios são separados por lista ativa.' });

    this.pin = ''; this.pinMode = 'unlock'; this.pendingPin = '';
    this.categories = []; this.items = []; this.mode = 'categories'; this.selected = 0; this.keyIndex = 0; this.hasFocus = false;
    this.refreshPinPrompt();
  }

  ParentalView.prototype.show = function (visible) { S.show(this.root, visible); if (visible) { this.refreshPinPrompt(); this.renderLocks(); } };
  ParentalView.prototype.isVisible = function () { return S.isVisible(this.root); };
  ParentalView.prototype.setContentFocus = function (focused) { this.hasFocus = focused; this.updateKeyFocus(); };
  ParentalView.prototype.setDeviceInfo = function (text) { this.deviceInfo.textContent = text || ''; };
  ParentalView.prototype.setCatalog = function (payload) {
    this.categories = (payload && payload.categories) || [];
    this.items = (payload && payload.items) || [];
    this.selected = 0;
    this.renderLocks();
  };
  // Compatível com o AppShell (Ajustes recebe info e status).
  ParentalView.prototype.setInfo = function (info) {
    this.setDeviceInfo(info && info.code ? 'TV ' + info.code + '   •   Chave ' + info.key + '   •   Licença ' + EP.lower(info.licenseLabel) : '');
  };
  ParentalView.prototype.setStatus = function (text) { if (text) this.status.textContent = text; };

  // Voltar durante a digitação cancela a entrada do PIN; senão volta à Home.
  ParentalView.prototype.handleBack = function () {
    if (this.pin.length || this.pinMode === 'change' || this.pinMode === 'change_confirm' || this.pinMode === 'create_confirm') { this.cancelPinEntry(); this.updateKeyFocus(); return true; }
    return false;
  };

  ParentalView.prototype.keypadActive = function () { return !P.sessionUnlocked() || this.pinMode !== 'unlock'; };

  ParentalView.prototype.refreshPinPrompt = function () {
    if (this.pinMode === 'change' || this.pinMode === 'change_confirm') return;
    if (P.sessionUnlocked()) {
      this.pinMode = 'unlock';
      this.description.textContent = 'Controle parental liberado nesta sessão.';
      this.status.textContent = EP.OPTIONS_LABEL + ' alterar PIN';
    } else if (!P.hasPin()) {
      if (this.pinMode !== 'create_confirm') this.pinMode = 'create';
      this.description.textContent = 'Crie um PIN de quatro dígitos para proteger categorias e conteúdos.';
      if (this.pinMode === 'create') this.status.textContent = 'Digite o novo PIN.';
    } else {
      this.pinMode = 'unlock';
      this.description.textContent = 'Digite o PIN para acessar categorias e restrições.';
      var remaining = P.lockRemainingSeconds();
      this.status.textContent = remaining > 0 ? lockoutMessage(remaining) : 'Digite seu PIN de quatro dígitos.';
    }
    this.pin = '';
    this.updateDots();
    this.updateKeyFocus();
  };

  function lockoutMessage(seconds) {
    var minutes = Math.floor((seconds + 59) / 60);
    return minutes <= 1 ? 'Muitas tentativas. Tente novamente em 1 minuto.' : 'Muitas tentativas. Tente novamente em ' + minutes + ' minutos.';
  }

  ParentalView.prototype.handleKey = function (key) {
    if (/^[0-9]$/.test(key)) { if (this.keypadActive()) this.enterDigit(key); return true; }
    if (key === 'green') { this.events.emit('action', 'sync'); this.status.textContent = 'Buscando a lista salva no Portal…'; return true; }
    if (key === 'yellow') { this.events.emit('action', 'code'); return true; }
    if (key === 'options' && P.sessionUnlocked()) {
      this.pinMode = 'change'; this.pin = ''; this.pendingPin = '';
      this.updateDots(); this.updateKeyFocus();
      this.status.textContent = 'Digite o novo PIN de quatro dígitos.';
      return true;
    }
    if (this.keypadActive()) return this.handleKeypad(key);
    if (key === 'left' || key === 'right') { this.mode = this.mode === 'categories' ? 'items' : 'categories'; this.selected = 0; this.renderLocks(); return true; }
    var list = this.mode === 'items' ? this.items : ['__adult__'].concat(this.categories);
    if (key === 'down' && this.selected < list.length - 1) { this.selected++; this.renderLocks(); return true; }
    if (key === 'up' && this.selected > 0) { this.selected--; this.renderLocks(); return true; }
    if (key === 'OK' && list.length) {
      if (this.mode === 'categories' && this.selected === 0) {
        P.setAdultProtection(!P.adultProtection());
        this.status.textContent = P.adultProtection() ? 'Categorias adultas protegidas automaticamente.' : 'Proteção automática de conteúdo adulto desligada.';
      } else if (this.mode === 'categories') {
        var cat = this.categories[this.selected - 1];
        var nowLocked = P.toggleCategory(cat);
        this.status.textContent = (nowLocked ? 'Categoria bloqueada: ' : 'Categoria liberada: ') + cat + (P.isAutoCategory(cat) ? (nowLocked ? ' (regra automática)' : ' (exceção salva)') : '');
      } else {
        var item = this.items[this.selected];
        this.status.textContent = (P.toggleItem(item.id) ? 'Item bloqueado: ' : 'Item desbloqueado: ') + EP.displayTitle(item.title);
      }
      this.renderLocks();
    }
    return true;
  };

  ParentalView.prototype.handleKeypad = function (key) {
    var col = this.keyIndex % 3, row = Math.floor(this.keyIndex / 3);
    if (key === 'left' && col > 0) this.keyIndex--;
    else if (key === 'right' && col < 2) this.keyIndex++;
    else if (key === 'up' && row > 0) this.keyIndex -= 3;
    else if (key === 'down' && row < 3) this.keyIndex += 3;
    else if (key === 'OK') { this.pressKey(); return true; }
    this.updateKeyFocus();
    return true;
  };

  ParentalView.prototype.pressKey = function () {
    if (!this.keypadActive()) return;
    var value = KEYS[this.keyIndex];
    if (value === 'back') { this.pin = this.pin.slice(0, -1); this.updateDots(); }
    else if (value === 'clear') { this.pin = ''; this.updateDots(); }
    else this.enterDigit(value);
    this.updateKeyFocus();
  };

  ParentalView.prototype.enterDigit = function (digit) {
    if (this.pin.length >= 4) return;
    if (this.pinMode === 'unlock' && P.lockRemainingSeconds() > 0) { this.status.textContent = lockoutMessage(P.lockRemainingSeconds()); return; }
    this.pin += digit;
    this.updateDots();
    if (this.pin.length === 4) this.validatePin();
  };

  ParentalView.prototype.cancelPinEntry = function () {
    this.pin = '';
    if (this.pinMode === 'change' || this.pinMode === 'change_confirm') { this.pinMode = 'unlock'; this.status.textContent = 'Alteração de PIN cancelada.'; }
    else if (this.pinMode === 'create_confirm') { this.pinMode = 'create'; this.status.textContent = 'Digite o novo PIN.'; }
    this.updateDots();
  };

  ParentalView.prototype.updateDots = function () {
    for (var i = 0; i < 4; i++) S.toggle(this.dots[i], 'filled', i < this.pin.length);
  };

  ParentalView.prototype.validatePin = function () {
    var entered = this.pin;
    this.pin = '';
    this.updateDots();
    if (this.pinMode === 'create' || this.pinMode === 'change') {
      this.pendingPin = entered;
      this.pinMode = this.pinMode === 'create' ? 'create_confirm' : 'change_confirm';
      this.status.textContent = 'Confirme o novo PIN.';
      return;
    }
    if (this.pinMode === 'create_confirm' || this.pinMode === 'change_confirm') {
      var wasCreate = this.pinMode === 'create_confirm';
      if (entered !== this.pendingPin) {
        this.pinMode = wasCreate ? 'create' : 'change';
        this.pendingPin = '';
        this.status.textContent = 'Os PINs não conferem. Digite o novo PIN novamente.';
        return;
      }
      P.setPin(entered);
      this.pendingPin = '';
      this.pinMode = 'unlock';
      if (wasCreate) {
        P.unlockSession();
        this.description.textContent = 'Controle parental liberado nesta sessão.';
        this.status.textContent = 'PIN criado. Guarde-o: ele protege os bloqueios.';
      } else this.status.textContent = 'PIN atualizado com sucesso.';
      this.renderLocks();
      return;
    }
    var remaining = P.lockRemainingSeconds();
    if (remaining > 0) { this.status.textContent = lockoutMessage(remaining); return; }
    if (P.verifyPin(entered)) {
      P.resetFailures();
      P.unlockSession();
      this.description.textContent = 'Controle parental liberado nesta sessão.';
      this.status.textContent = 'Controle parental desbloqueado nesta sessão.';
      this.renderLocks();
      return;
    }
    var left = P.registerFailure();
    this.status.textContent = left === 0 ? lockoutMessage(300) : (left === 1 ? 'PIN incorreto. Resta 1 tentativa.' : 'PIN incorreto. Restam ' + left + ' tentativas.');
  };

  ParentalView.prototype.updateKeyFocus = function () {
    var active = this.keypadActive();
    for (var i = 0; i < this.keyNodes.length; i++) { S.focus(this.keyNodes[i], active && this.hasFocus && i === this.keyIndex); this.keyNodes[i].style.opacity = active ? '1' : '0.45'; }
  };

  ParentalView.prototype.renderLocks = function () {
    this.updateKeyFocus();
    var unlocked = P.sessionUnlocked();
    var entries = this.mode === 'items' ? this.items : ['__adult__'].concat(this.categories);
    var protectedCount = P.protectedCount(this.categories);
    this.listTitle.textContent = this.mode === 'items' ? 'CANAIS E TÍTULOS' : 'CATEGORIAS DA LISTA   •   ' + protectedCount + (protectedCount === 1 ? ' PROTEGIDA' : ' PROTEGIDAS');
    S.show(this.lockedHint, !unlocked || !entries.length);
    this.lockedHint.textContent = !unlocked ? 'Digite o PIN para gerenciar categorias.' : 'Nenhum item recebido da lista atual.';
    var catLocks = P.categoryLocks(), itemLocks = P.itemLocks();
    var first = Math.max(0, Math.min(this.selected - (LIST_ROWS - 1), entries.length - LIST_ROWS));
    if (this.selected < LIST_ROWS) first = 0;
    for (var r = 0; r < LIST_ROWS; r++) {
      var row = this.rows[r], entry = unlocked ? entries[first + r] : null;
      row.style.display = entry === undefined || entry === null ? 'none' : 'flex';
      if (!entry) continue;
      if (entry === '__adult__') {
        var on = P.adultProtection();
        row.children[0].innerHTML = EP.iconSvg('lock');
        row.children[0].style.color = on ? '#00d7ff' : '#63728a';
        row.children[1].textContent = 'Proteger conteúdo adulto';
        row.children[2].style.display = 'none';
        row.children[3].textContent = on ? 'LIGADO' : 'DESLIGADO';
        row.children[3].style.color = on ? '#00d7ff' : '#63728a';
        S.focus(row, first + r === this.selected && this.hasFocus);
        continue;
      }
      var locked = this.mode === 'items' ? P.isItemLocked(entry.id, itemLocks) : P.isCategoryLocked(entry, catLocks);
      var auto = this.mode !== 'items' && P.isAutoCategory(entry);
      row.children[0].innerHTML = EP.iconSvg(locked ? 'lock' : 'check');
      row.children[0].style.color = locked ? '#ff5c72' : '#16c784';
      row.children[1].textContent = this.mode === 'items' ? EP.displayTitle(entry.title) : entry;
      row.children[2].textContent = 'Automática';
      row.children[2].style.display = auto && locked ? 'inline-block' : 'none';
      row.children[3].textContent = locked ? 'BLOQUEADO' : 'LIBERADO';
      row.children[3].style.color = locked ? '#ff5c72' : '#63728a';
      S.focus(row, first + r === this.selected && this.hasFocus);
    }
    if (unlocked) this.scopeStatus.textContent = '←/→ alternar modo   •   ↑/↓ selecionar   •   OK bloquear/desbloquear   •   ' + EP.OPTIONS_LABEL + ' alterar PIN';
    else this.scopeStatus.textContent = 'Bloqueios são separados por lista ativa.';
  };

  EP.ParentalView = ParentalView;
}(window.EP));
