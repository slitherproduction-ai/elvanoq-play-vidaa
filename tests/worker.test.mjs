// Testes do Worker com Portal, listas e cache simulados (sem rede).
import assert from 'node:assert/strict';

const calls = [];
const store = new Map();
globalThis.caches = { default: {
  match: async (req) => { const v = store.get(req.url); return v ? new Response(v) : undefined; },
  put: async (req, res) => { store.set(req.url, await res.text()); }
} };
globalThis.fetch = async (input, init = {}) => {
  const url = typeof input === 'string' ? input : input.url;
  calls.push({ url, init });
  if (url.includes('portal-control')) {
    const body = JSON.parse(init.body);
    assert.equal(init.headers.Origin, undefined, 'relay não envia Origin');
    assert.equal(init.headers.apikey, 'pk_test');
    if (body.action === 'webos-license-status') {
      assert.equal(body.platform, 'vidaa');
      return body.device_key === '123456' ? Response.json({ license: { can_play: true } }) : new Response('{"error":"x"}', { status: 403 });
    }
    return Response.json({ ok: true, echo: body.action, platform: body.platform });
  }
  if (url.startsWith('http://iptv.example:8080/player_api.php')) return new Response('{"user_info":{"auth":1}}', { headers: { 'Content-Type': 'application/json' } });
  if (url.startsWith('http://iptv.example:8080/live/')) return new Response('bin', { headers: { 'Content-Type': 'video/mp2t' } });
  throw new Error('rede indisponível');
};

const worker = (await import('../worker/src/index.js')).default;
const env = { PORTAL_KEY: 'pk_test', APP_VERSION: '1.0.0', ASSETS: { fetch: async () => new Response('<html>', { headers: { 'Content-Type': 'text/html' } }) } };
const ctx = { waitUntil: (p) => p };
const call = (path, init) => worker.fetch(new Request('https://tv.exemplo.com.br' + path, init), env, ctx);
const device = 'a'.repeat(64);

// O endereço HTTP não redireciona para HTTPS
let r = await worker.fetch(new Request('http://vidaa.exemplo.com/'), env, ctx);
assert.equal(r.status, 200); assert.equal(r.headers.get('Location'), null);
let j;
r = await call('/msx/start.json');
assert.notEqual(r.headers.get('Content-Type'), 'application/json; charset=utf-8', 'sem rotas do MSX');

// Portal: só ações das TVs web
r = await call('/api/portal', { method: 'POST', body: JSON.stringify({ action: 'webos-device-register', device_id: device, device_key: '123456', platform: 'vidaa' }) });
j = await r.json();
assert.equal(r.status, 200); assert.equal(j.echo, 'webos-device-register'); assert.equal(j.platform, 'vidaa');
r = await call('/api/portal', { method: 'POST', body: JSON.stringify({ action: 'roku-device-bind' }) });
assert.equal(r.status, 403, 'ações administrativas bloqueadas');
r = await call('/api/portal', { method: 'GET' });
assert.equal(r.status, 405);

// Relay de listas
const api = '/api/fetch?u=' + encodeURIComponent('http://iptv.example:8080/player_api.php?username=u&password=p');
r = await call(api, { headers: { 'X-EP-Device': device, 'X-EP-Key': '123456' } });
assert.equal(r.status, 200); assert.equal(r.headers.get('X-EP-Status'), '200');
assert.match(await r.text(), /user_info/);
const portalCalls = calls.filter((c) => c.url.includes('portal-control')).length;
await call(api, { headers: { 'X-EP-Device': device, 'X-EP-Key': '123456' } });
assert.equal(calls.filter((c) => c.url.includes('portal-control')).length, portalCalls, 'licença em cache');
r = await call(api, { headers: { 'X-EP-Device': 'b'.repeat(64), 'X-EP-Key': '999999' } });
assert.equal(r.status, 403, 'TV desconhecida não usa o relay');
r = await call(api);
assert.equal(r.status, 403, 'sem identidade');
r = await call('/api/fetch?u=' + encodeURIComponent('http://192.168.0.1/admin'), { headers: { 'X-EP-Device': device, 'X-EP-Key': '123456' } });
assert.equal(r.status, 400, 'rede interna bloqueada');
r = await call('/api/fetch?u=' + encodeURIComponent('http://iptv.example:8080/live/u/p/1.ts'), { headers: { 'X-EP-Device': device, 'X-EP-Key': '123456' } });
assert.equal(r.status, 415, 'vídeo não passa pelo relay');
r = await call('/api/fetch?u=' + encodeURIComponent('http://offline.example/x.m3u'), { headers: { 'X-EP-Device': device, 'X-EP-Key': '123456' } });
assert.equal(r.status, 504); assert.equal(r.headers.get('X-EP-Status'), '0');

// Arquivos do app
r = await call('/');
assert.equal(r.headers.get('Cache-Control'), 'no-cache');
r = await call('/health');
j = await r.json(); assert.equal(j.ok, true); assert.equal(j.app, 'elvanoq-play-vidaa'); assert.equal(j.scheme, 'https');

// Limite de bytes mesmo sem Content-Length (resposta em partes)
const { limitBody } = await import('../worker/src/index.js');
const chunked = () => new ReadableStream({ start(c) { for (let i = 0; i < 4; i++) c.enqueue(new Uint8Array(10)); c.close(); } });
assert.equal((await new Response(limitBody(chunked(), 100)).arrayBuffer()).byteLength, 40, 'abaixo do limite passa inteiro');
await assert.rejects(new Response(limitBody(chunked(), 25)).arrayBuffer(), 'acima do limite é cortado');

console.log('worker.test.mjs: ok');
