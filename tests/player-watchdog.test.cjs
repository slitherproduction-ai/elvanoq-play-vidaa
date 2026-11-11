// 1.1.1 (paridade Android 2.17.25): retomada automática do player.
// Simula relógio e <video> para checar quando o watchdog reinicia o stream.
const assert = require('node:assert/strict');
global.window = global;
global.document = { visibilityState: 'visible' };
global.EP = {};
require('../public/src/views/playerView.js');
const P = EP.PlayerView.prototype;

let clock = 0;
Date.now = () => clock;
global.setInterval = () => 0;
global.clearInterval = () => {};

function fake(live) {
  return {
    video: { currentTime: 0, ended: false }, content: { liveQueue: live ? [1] : [] },
    failed: false, awaitingNextEpisode: false, userPaused: false, hint: { textContent: '' }, loads: 0, fatal: '',
    osdTimer: { stop() {} }, showOsd() {}, defaultHint() { return 'ok'; }, isLive() { return live; }, stopWatchdog() {},
    load() { this.loads++; this.video.currentTime = 0; }, showFatal(m) { this.fatal = m; }
  };
}
// Avança `sec` segundos em passos de 4 s (WATCH_MS); com `playing`, o vídeo anda junto.
function run(f, sec, playing) {
  for (let s = 0; s < sec; s += 4) { clock += 4000; if (playing) f.video.currentTime += 4; P.watchTick.call(f); }
}

// Servidor lento: 60 s sem começar não reinicia em ciclo.
let f = fake(true); P.startWatchdog.call(f); run(f, 60, false);
assert.equal(f.loads, 0, 'abertura lenta não reinicia');

// Ao vivo tocando, trava 24 s (> 20 s): reconecta uma vez.
f = fake(true); P.startWatchdog.call(f); run(f, 40, true); run(f, 16, false);
assert.equal(f.loads, 0, 'ao vivo: 16 s parado ainda não reconecta');
run(f, 8, false);
assert.equal(f.loads, 1, 'ao vivo: reconecta depois de 20 s');
// Depois da reconexão o ao vivo recomeça perto de 0: não pode virar "não voltou".
run(f, 120, true);
assert.equal(f.loads, 1); assert.equal(f.fatal, '', 'canal que voltou a tocar não cai na tela de erro');
// Travado de vez: 3 tentativas e tela de erro.
run(f, 200, false);
assert.equal(f.loads, 4); assert.ok(f.fatal);

// Filme: limite de 30 s.
f = fake(false); P.startWatchdog.call(f); run(f, 40, true); run(f, 24, false);
assert.equal(f.loads, 0, 'filme: 24 s parado não reinicia');
run(f, 12, false);
assert.equal(f.loads, 1, 'filme: reinicia depois de 30 s');

// Pausa do usuário não conta.
f = fake(false); P.startWatchdog.call(f); run(f, 20, true); f.userPaused = true; run(f, 120, false);
assert.equal(f.loads, 0, 'pausa não reconecta');

console.log('player-watchdog.test.cjs: ok');
