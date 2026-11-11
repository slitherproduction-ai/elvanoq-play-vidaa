// 1.1.3 (paridade Roku 1.1.1 / Android 2.17.29-2.17.30): imagens no tamanho
// da tela, Voltar fecha os controles antes de sair, retomada direto no ponto
// e volta do player no canal que estava tocando.
const assert = require('node:assert/strict');
global.window = global;
global.document = { visibilityState: 'visible' };
global.EP = { Stage: { isVisible: (n) => !!n.visible } };
const SRC = '../public/src';
require(SRC + '/core/ns.js');
require(SRC + '/views/playerView.js');
require(SRC + '/views/liveTVView.js');

// Imagens TMDB no tamanho pedido; outras URLs sem mudança.
assert.equal(EP.sizedImage('https://image.tmdb.org/t/p/original/abc.jpg', 'w342'), 'https://image.tmdb.org/t/p/w342/abc.jpg');
assert.equal(EP.sizedImage('http://image.tmdb.org/t/p/w780/x.png', 'w500'), 'http://image.tmdb.org/t/p/w500/x.png');
assert.equal(EP.sizedImage('http://servidor/logo.png', 'w342'), 'http://servidor/logo.png');
assert.equal(EP.sizedImage('', 'w342'), '');

// Voltar no player.
const P = EP.PlayerView.prototype;
function player(osd, failed, source) {
  return {
    osd: { visible: osd }, failed, closed: 0, hidden: 0, awaitingNextEpisode: false,
    video: { querySelector: () => (source ? {} : null) },
    hasSource: P.hasSource, hideOsd() { this.hidden++; this.osd.visible = false; }, close() { this.closed++; }
  };
}
let p = player(true, false, true);
P.handleKey.call(p, 'back');
assert.equal(p.hidden, 1, 'com controles: Voltar fecha os controles');
assert.equal(p.closed, 0);
P.handleKey.call(p, 'back');
assert.equal(p.closed, 1, 'tela limpa: Voltar sai');
p = player(true, true, true); P.handleKey.call(p, 'back');
assert.equal(p.closed, 1, 'tela de erro: Voltar sai direto');
p = player(true, false, false); P.handleKey.call(p, 'back');
assert.equal(p.closed, 1, 'sem vídeo carregado (bloqueado/sem licença): Voltar sai direto');

// Volta do player no canal que estava tocando.
const L = EP.LiveTVView.prototype;
const channels = [];
for (let i = 0; i < 40; i++) channels.push({ id: 'c' + i });
const live = Object.assign(Object.create(L), {
  visibleChannels: channels, selectedIndex: 0, channelOffset: 0, searchFocus: 'channels', focusColumn: 'categories',
  renders: 0, previews: 0, renderGuide() { this.renders++; }, playSelected() { this.previews++; }
});
assert.equal(live.returnToChannel('c30'), true);
assert.equal(live.selectedIndex, 30);
assert.ok(live.channelOffset <= 30 && live.channelOffset + 13 > 30, 'canal visível na coluna');
assert.equal(live.focusColumn, 'channels');
assert.equal(live.searchFocus, '');
assert.equal(live.previews, 1, 'prévia retomada no canal');
assert.equal(live.returnToChannel('nao-existe'), false);
assert.equal(live.selectedIndex, 30);

console.log('v113-features.test.cjs: ok');
