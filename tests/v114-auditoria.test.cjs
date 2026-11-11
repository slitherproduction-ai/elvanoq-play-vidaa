// 1.1.4 — auditoria técnica de 08/11/2026
const assert = require('node:assert/strict');
const stream = require('../public/src/core/streamFormat.js');

// Credenciais sem codificação como última tentativa do player
assert.equal(stream.rawCredentialVariant('http://h:8080/live/j%40o/p%2Bs/5.ts'), 'http://h:8080/live/j@o/p+s/5.ts');
assert.equal(stream.rawCredentialVariant('http://h/movie/u/p/9.mp4'), '', 'nada a trocar sem %');
assert.equal(stream.rawCredentialVariant('http://h/movie/u%2Fx/p/9.mp4'), '', 'não cria barra nova no caminho');
assert.equal(stream.rawCredentialVariant('http://h/series/a%20b/c/1.mkv'), 'http://h/series/a b/c/1.mkv');
assert.equal(stream.rawCredentialVariant(''), '');

console.log('v114-auditoria.test.cjs: ok');
