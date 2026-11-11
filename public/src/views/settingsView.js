/* Ajustes 1.1.0 no padrão premium (Android 2.17.21): central com grupos
 * Lista / Conteúdo / Sistema e as páginas Controle parental, Categorias
 * visíveis, Diagnóstico e Sobre. Voltar numa página volta à central; na
 * central volta à Início. VERDE sincroniza e AMARELO abre o código do
 * servidor de qualquer página.
 * provider: { diagnostics() -> {...}, test(cb), counts() -> {protected, hidden} }
 */
(function (EP) {
  'use strict';
  var S = EP.Stage;

  /* Fundo comum das páginas premium: brilho azul no topo + título. */
  function premiumPage(parent, title, subtitle) {
    var root = S.group(parent, { className: 'layer' });
    S.rect(root, { x: 0, y: 0, w: 1920, h: 1080, color: '0x070B14FF' });
    S.el(root, { x: 0, y: 0, w: 1920, h: 420, className: 'premium-glow' });
    S.label(root, { x: 64, y: 60, w: 1100, h: 56, text: title, size: 44, weight: 700, css: 'letter-spacing:-0.02em' });
    var sub = S.label(root, { x: 64, y: 118, w: 1100, h: 30, text: subtitle || '', size: 21, color: '0x8894A8FF' });
    return { root: root, subtitle: sub };
  }
  function groupLabel(parent, x, y, text) {
    return S.label(parent, { x: x, y: y, w: 600, h: 24, text: text, size: 16, weight: 700, color: '0x63728AFF', css: 'letter-spacing:0.14em;text-transform:uppercase' });
  }
  EP.premiumPage = premiumPage;
  EP.premiumGroupLabel = groupLabel;

  var ROWS = [
    { group: 'Lista', id: 'sync', title: 'Sincronizar lista', sub: 'Busca no Portal a lista salva para esta TV', icon: 'refresh', detail: 'Atualiza a lista cadastrada no Portal ELVANOQ Play para esta TV. Use depois de trocar ou editar a lista no celular.' },
    { group: 'Lista', id: 'code', title: 'Entrar com código do servidor', sub: 'Código, usuário e senha do seu servidor', icon: 'key', detail: 'Conecta uma lista pelo código do servidor recebido no Portal. Usuário e senha ficam só na memória desta sessão.' },
    { group: 'Conteúdo', id: 'parental', title: 'Controle parental', sub: 'PIN, conteúdo adulto e bloqueios', icon: 'lock', detail: 'Crie um PIN e escolha as categorias e títulos protegidos. Categorias adultas são protegidas automaticamente.' },
    { group: 'Conteúdo', id: 'categories', title: 'Categorias visíveis', sub: 'Mostrar ou ocultar categorias desta lista', icon: 'grid', detail: 'Oculte categorias que você não usa. Elas somem das listas de categorias, de "Todos" e das grades. Vale só para a lista ativa.' },
    { group: 'Conteúdo', id: 'format', title: 'Formato do ao vivo', sub: 'OK alterna entre Automático, HLS e TS', icon: 'live', detail: 'No Automático, a TV lembra o formato que abriu nesta lista (HLS ou TS) e começa por ele nas próximas vezes e no zapping. Uma escolha manual sempre vence.' },
    { group: 'Sistema', id: 'account', title: 'Conta', sub: 'Excluir o login desta TV', icon: 'key', detail: 'Apaga os dados de acesso desta TV e volta para a tela de login.' },
    { group: 'Sistema', id: 'diagnostics', title: 'Diagnóstico', sub: 'Versão, lista, reprodução e conexão', icon: 'info', detail: 'Mostra o estado do aplicativo e testa a conexão com o Portal e com o servidor da lista. Nenhum endereço, usuário ou senha aparece aqui.' },
    { group: 'Sistema', id: 'about', title: 'Sobre', sub: 'Versão, novidades e privacidade', icon: 'sparkles', detail: 'Informações sobre o ELVANOQ Play para TVs VIDAA.' }
  ];

  function SettingsView(parent, provider) {
    var self = this;
    this.events = new EP.Emitter();
    this.provider = provider || {};
    this.root = S.group(parent, { className: 'layer' });
    var page = premiumPage(this.root, 'Ajustes', 'Lista, conteúdo e sistema desta TV');
    this.hub = page.root;
    this.deviceInfo = S.label(this.hub, { x: 944, y: 124, w: 912, h: 28, size: 20, align: 'right', color: '0xB6C2D6FF' });
    this.rows = [];
    var y = 176, lastGroup = '';
    for (var i = 0; i < ROWS.length; i++) {
      var def = ROWS[i];
      if (def.group !== lastGroup) { groupLabel(this.hub, 72, y, def.group); y += 34; lastGroup = def.group; }
      var row = S.el(this.hub, { x: 64, y: y, w: 1100, h: 76, className: 'premium-row settings-row' });
      row.innerHTML = '<span class="pr-icon">' + EP.iconSvg(def.icon) + '</span><span class="pr-text"><span class="pr-title"></span><span class="pr-sub"></span></span><span class="pr-meta"></span><span class="pr-chev">' + EP.iconSvg('chevronRight') + '</span>';
      row.querySelector('.pr-title').textContent = def.title;
      row.querySelector('.pr-sub').textContent = def.sub;
      (function (index) { row.addEventListener('click', function () { self.selected = index; self.render(); self.activate(); }); }(i));
      this.rows.push(row);
      y += 86;
      if (i + 1 < ROWS.length && ROWS[i + 1].group !== def.group) y += 14;
    }
    S.el(this.hub, { x: 1204, y: 210, w: 652, h: 640, className: 'premium-card' });
    this.detailIcon = S.el(this.hub, { x: 1252, y: 254, w: 64, h: 64, className: 'pr-bigicon' });
    this.detailTitle = S.label(this.hub, { x: 1252, y: 344, w: 556, h: 44, size: 32, weight: 700 });
    this.detailText = S.label(this.hub, { x: 1252, y: 400, w: 556, h: 200, size: 22, lineHeight: 34, lines: 6, color: '0xB8C4D6FF' });
    this.detailValue = S.label(this.hub, { x: 1252, y: 640, w: 556, h: 34, size: 22, weight: 600, color: '0x00D7FFFF' });
    this.status = S.label(this.hub, { x: 1252, y: 760, w: 556, h: 64, size: 20, lineHeight: 30, lines: 2, color: '0x8894A8FF' });
    S.label(this.hub, { x: 64, y: 1020, w: 1100, h: 26, text: '↑/↓ escolher   •   OK abrir   •   VERDE sincronizar   •   AMARELO código do servidor   •   Voltar Início', size: 18, color: '0x63728AFF' });

    this.parental = new EP.ParentalView(this.root);
    this.categories = new EP.CategoriesView(this.root);
    this.diagnostics = new DiagnosticsPage(this.root, this.provider);
    this.about = new AboutPage(this.root);
    this.parental.events.on('action', function (a) { self.events.emit('action', a); });
    this.categories.events.on('changed', function () { self.events.emit('visibilityChanged'); self.render(); });
    this.pages = { parental: this.parental, categories: this.categories, diagnostics: this.diagnostics, about: this.about };
    this.page = '';
    this.selected = 0; this.hasFocus = false;
    this.showPage('');
  }

  SettingsView.prototype.show = function (visible) { S.show(this.root, visible); if (visible) { this.showPage(''); this.render(); } };
  SettingsView.prototype.isVisible = function () { return S.isVisible(this.root); };
  SettingsView.prototype.setContentFocus = function (focused) {
    this.hasFocus = focused;
    var page = this.pages[this.page];
    if (page && page.setContentFocus) page.setContentFocus(focused);
    this.render();
  };
  SettingsView.prototype.setInfo = function (info) {
    this.info = info || {};
    this.deviceInfo.textContent = info && info.code ? 'TV ' + info.code + '   •   Chave ' + info.key + '   •   Licença ' + EP.lower(info.licenseLabel) : '';
    this.parental.setInfo(info);
    this.render();
  };
  SettingsView.prototype.setStatus = function (text) { this.status.textContent = text || ''; this.parental.setStatus(text); };
  SettingsView.prototype.setCatalog = function (payload) {
    this.payload = payload || {};
    this.parental.setCatalog(payload);
    this.categories.setLists((payload && payload.categoryLists) || {});
    this.render();
  };

  SettingsView.prototype.showPage = function (name) {
    this.page = name;
    S.show(this.hub, !name);
    for (var key in this.pages) if (this.pages.hasOwnProperty(key)) {
      this.pages[key].show(key === name);
      if (key === name && this.pages[key].setContentFocus) this.pages[key].setContentFocus(this.hasFocus);
    }
  };

  SettingsView.prototype.value = function (id) {
    var counts = this.provider.counts ? this.provider.counts() : {};
    if (id === 'parental') return !EP.Parental.hasPin() ? 'Sem PIN' : (counts.protectedCount || 0) + ' protegidas';
    if (id === 'categories') { var n = EP.CategoryVisibility.hiddenCount(); return n ? n + (n === 1 ? ' oculta' : ' ocultas') : 'Todas visíveis'; }
    if (id === 'format') return EP.LiveFormat.LABELS[EP.LiveFormat.mode()];
    if (id === 'about') return 'Versão ' + EP.VERSION;
    if (id === 'diagnostics') return '';
    return '';
  };

  SettingsView.prototype.render = function () {
    if (this.page) return;
    for (var i = 0; i < this.rows.length; i++) {
      this.rows[i].querySelector('.pr-meta').textContent = this.value(ROWS[i].id);
      S.toggle(this.rows[i], 'focused', this.hasFocus && i === this.selected);
    }
    var def = ROWS[this.selected];
    this.detailIcon.innerHTML = EP.iconSvg(def.icon);
    this.detailTitle.textContent = def.title;
    this.detailText.textContent = def.detail;
    this.detailValue.textContent = this.value(def.id);
  };

  SettingsView.prototype.activate = function () {
    var id = ROWS[this.selected].id;
    if (id === 'account') { this.events.emit('action', 'account'); return; }
    if (id === 'sync') { this.setStatus('Buscando a lista salva no Portal…'); this.events.emit('action', 'sync'); return; }
    if (id === 'code') { this.events.emit('action', 'code'); return; }
    if (id === 'format') {
      var modes = EP.LiveFormat.MODES, next = modes[(modes.indexOf(EP.LiveFormat.mode()) + 1) % modes.length];
      EP.LiveFormat.setMode(next);
      this.status.textContent = 'Formato do ao vivo: ' + EP.LiveFormat.LABELS[next] + '.';
      this.render();
      return;
    }
    this.showPage(id);
  };

  SettingsView.prototype.handleBack = function () {
    if (!this.page) return false;
    var page = this.pages[this.page];
    if (page.handleBack && page.handleBack()) return true;
    var from = this.page;
    this.showPage('');
    for (var i = 0; i < ROWS.length; i++) if (ROWS[i].id === from) this.selected = i;
    this.render();
    return true;
  };

  SettingsView.prototype.handleKey = function (key) {
    if (key === 'green') { this.setStatus('Buscando a lista salva no Portal…'); this.events.emit('action', 'sync'); return true; }
    if (key === 'yellow') { this.events.emit('action', 'code'); return true; }
    if (this.page) return this.pages[this.page].handleKey(key);
    if (key === 'down' && this.selected < ROWS.length - 1) { this.selected++; this.render(); return true; }
    if (key === 'up' && this.selected > 0) { this.selected--; this.render(); return true; }
    if (key === 'OK') { this.activate(); return true; }
    return true;
  };

  /* ---------- Diagnóstico ---------- */
  function DiagnosticsPage(parent, provider) {
    var page = premiumPage(parent, 'Diagnóstico', 'Estado do aplicativo nesta TV   •   OK testa a conexão');
    this.root = page.root; this.provider = provider;
    this.groups = [
      { title: 'Aplicativo', x: 64, y: 176, keys: ['app', 'engine', 'screen', 'device'] },
      { title: 'Lista', x: 64, y: 560, keys: ['list', 'source', 'categories', 'cache'] },
      { title: 'Reprodução', x: 984, y: 176, keys: ['license', 'format', 'remembered', 'parental'] },
      { title: 'Conexão', x: 984, y: 560, keys: ['portal', 'server', 'tested'] }
    ];
    this.values = {};
    for (var g = 0; g < this.groups.length; g++) {
      var grp = this.groups[g];
      groupLabel(this.root, grp.x + 8, grp.y, grp.title);
      S.el(this.root, { x: grp.x, y: grp.y + 34, w: 872, h: grp.keys.length * 72 + 24, className: 'premium-card' });
      for (var k = 0; k < grp.keys.length; k++) {
        var y = grp.y + 46 + k * 72;
        var name = S.label(this.root, { x: grp.x + 32, y: y + 18, w: 360, h: 34, size: 22, color: '0x8894A8FF' });
        var value = S.label(this.root, { x: grp.x + 392, y: y + 18, w: 448, h: 34, size: 22, weight: 600, align: 'right' });
        this.values[grp.keys[k]] = { name: name, value: value };
        if (k > 0) S.el(this.root, { x: grp.x + 32, y: y, w: 808, h: 1, css: 'background:rgba(190,222,255,0.08)' });
      }
    }
    this.button = S.el(this.root, { x: 64, y: 980, w: 300, h: 60, text: 'Testar conexão', className: 'premium-button focused' });
  }
  DiagnosticsPage.prototype.show = function (visible) { S.show(this.root, visible); if (visible) this.refresh(); };
  DiagnosticsPage.prototype.refresh = function () {
    var d = this.provider.diagnostics ? this.provider.diagnostics() : {};
    var labels = { app: 'Versão', engine: 'Navegador da TV', screen: 'Tela', device: 'Código da TV', list: 'Lista', source: 'Origem', categories: 'Categorias', cache: 'Em memória', license: 'Licença', format: 'Formato do ao vivo', remembered: 'Último formato que abriu', parental: 'Controle parental', portal: 'Portal ELVANOQ', server: 'Servidor da lista', tested: 'Último teste' };
    for (var key in this.values) if (this.values.hasOwnProperty(key)) {
      this.values[key].name.textContent = labels[key];
      this.values[key].value.textContent = d[key] === undefined || d[key] === '' ? '—' : String(d[key]);
    }
  };
  DiagnosticsPage.prototype.handleKey = function (key) {
    var self = this;
    if (key === 'OK' && this.provider.test && !this.testing) {
      this.testing = true;
      this.values.portal.value.textContent = 'Testando…';
      this.values.server.value.textContent = 'Testando…';
      this.provider.test(function () { self.testing = false; self.refresh(); });
    }
    return true;
  };

  /* ---------- Sobre ---------- */
  var NEWS = [
    'Tela inicial com duas fileiras: Novidades para você e Continuar assistindo.',
    'Voltar no player fecha os controles primeiro; com a tela limpa, sai do vídeo.',
    'Ao sair do ao vivo, a lista volta no canal que estava tocando.',
    'Pesquise categorias e canais na TV ao Vivo: suba até o campo no topo de cada coluna.',
    'Reconexão mais estável: o vídeo só é reiniciado depois que começou a tocar.',
    'O vídeo volta sozinho quando o sinal trava; filmes retomam do mesmo ponto.',
    'Rever programas nos canais com arquivo, com três formatos de catch-up.',
    'Categorias adultas protegidas pelo PIN automaticamente.'
  ];
  function AboutPage(parent) {
    var page = premiumPage(parent, 'Sobre', 'ELVANOQ Play para TVs VIDAA');
    this.root = page.root;
    S.el(this.root, { x: 64, y: 176, w: 872, h: 520, className: 'premium-card' });
    S.poster(this.root, { x: 112, y: 222, w: 360, h: 120, uri: 'images/elvanoq-wordmark-white.png', mode: 'fit' }).style.backgroundPosition = 'left center';
    this.version = S.label(this.root, { x: 112, y: 370, w: 776, h: 40, size: 30, weight: 700 });
    S.label(this.root, { x: 112, y: 420, w: 776, h: 200, size: 22, lineHeight: 34, lines: 6, color: '0xB8C4D6FF', text: 'Player de vídeo para listas autorizadas pelo usuário. O ELVANOQ Play não vende nem fornece canais, filmes ou séries: o conteúdo vem da lista que você conecta pelo Portal ou pelo código do servidor.' });
    S.label(this.root, { x: 112, y: 632, w: 776, h: 30, size: 20, color: '0x00D7FFFF', text: 'elvanoqplay.app' });
    groupLabel(this.root, 992, 176, 'Novidades da ' + EP.VERSION);
    S.el(this.root, { x: 984, y: 210, w: 872, h: 486, className: 'premium-card' });
    for (var i = 0; i < NEWS.length; i++) {
      S.el(this.root, { x: 1024, y: 252 + i * 72, w: 10, h: 10, css: 'border-radius:5px;background:#00d7ff' });
      S.label(this.root, { x: 1052, y: 238 + i * 72, w: 772, h: 64, size: 21, lineHeight: 30, lines: 2, text: NEWS[i] });
    }
    groupLabel(this.root, 72, 730, 'Privacidade');
    S.el(this.root, { x: 64, y: 764, w: 1792, h: 200, className: 'premium-card' });
    S.label(this.root, { x: 112, y: 796, w: 1700, h: 140, size: 21, lineHeight: 32, lines: 4, color: '0xB8C4D6FF', text: 'A identificação da TV sai do aparelho só como um resumo criptográfico (SHA-256). Usuário e senha da lista não aparecem na tela nem em registros. Favoritos, progresso, PIN (protegido) e preferências ficam guardados apenas nesta TV. Fonte Inter sob a licença SIL Open Font License.' });
  }
  AboutPage.prototype.show = function (visible) { S.show(this.root, visible); if (visible) this.version.textContent = 'Versão ' + EP.VERSION; };
  AboutPage.prototype.handleKey = function () { return true; };

  EP.SettingsView = SettingsView;
}(window.EP));


