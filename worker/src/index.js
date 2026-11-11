/* ELVANOQ Play — Worker da versão VIDAA (Hisense/Toshiba).
 *
 * O mesmo Worker atende dois endereços com o mesmo app:
 *   https://vidaa.elvanoqplay.app  endereço da loja VIDAA (exige HTTPS)
 *   http://vidaa.elvanoqplay.com   cópia em HTTP puro, para testes e para
 *                                  TVs que bloqueiam vídeo http:// numa
 *                                  página HTTPS (conteúdo misto)
 *
 *   GET  /                 o app (pasta public/, via Workers Assets)
 *   POST /api/portal       relay para o portal-control (ações das TVs web)
 *   GET  /api/fetch?u=     relay de listas: Xtream API, M3U e EPG (CORS)
 *   GET  /health           status
 *
 * O vídeo NÃO passa por aqui: a TV toca direto do servidor da lista.
 */

const PORTAL_URL = 'https://xrrgjssvdqvtrqhxpask.supabase.co/functions/v1/portal-control';
const PORTAL_ACTIONS = new Set(['webos-device-register', 'webos-license-status', 'webos-playlist-sync', 'server-code-resolve']);
const FETCH_TIMEOUT_MS = 60000;
const FETCH_MAX_BYTES = 80 * 1024 * 1024; // listas M3U e XMLTV grandes
const DEVICE_CACHE_SECONDS = 600;
const USER_AGENT = 'ELVANOQPlay-VIDAA/1.0';

const json = (data, status = 200, extra = {}) => new Response(JSON.stringify(data), {
  status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extra }
});

/* ---------- relay do Portal ---------- */
async function portal(request, env) {
  const raw = await request.text();
  if (raw.length > 16384) return json({ error: 'Dados muito extensos.' }, 413);
  let body;
  try { body = JSON.parse(raw); } catch { return json({ error: 'Solicitação inválida.' }, 400); }
  if (!body || typeof body !== 'object' || !PORTAL_ACTIONS.has(body.action)) return json({ error: 'Ação não permitida.' }, 403);
  const key = env.PORTAL_KEY;
  const upstream = await fetch(PORTAL_URL, {
    method: 'POST',
    // Sem cabeçalho Origin: o Portal trata como cliente nativo (igual LG/Roku).
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', apikey: key, Authorization: 'Bearer ' + key, 'User-Agent': USER_AGENT },
    body: JSON.stringify(body)
  }).catch(() => null);
  if (!upstream) return json({ error: 'Portal indisponível.' }, 502);
  const headers = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };
  const retry = upstream.headers.get('Retry-After');
  if (retry) headers['Retry-After'] = retry;
  return new Response(await upstream.text(), { status: upstream.status, headers });
}

/* ---------- relay de listas ---------- */
function blockedHost(hostname) {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local') || h.endsWith('.internal')) return true;
  if (/^(0|10|127)\./.test(h) || /^169\.254\./.test(h) || /^192\.168\./.test(h) || /^172\.(1[6-9]|2\d|3[01])\./.test(h) || /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(h)) return true;
  if (h === '::1' || h.startsWith('fc') || h.startsWith('fd') || h.startsWith('fe80')) return true;
  return false;
}

/* Só a TV registrada no Portal usa o relay. A resposta do Portal fica em
 * cache por 10 min para não gastar a cota de 60 consultas/15 min. */
async function deviceAllowed(deviceId, deviceKey, env, ctx) {
  if (!/^[a-f0-9]{64}$/.test(deviceId) || !/^\d{6,128}$/.test(deviceKey)) return false;
  const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(deviceId + ':' + deviceKey))))
    .map((b) => b.toString(16).padStart(2, '0')).join('');
  const cacheKey = new Request('https://cache.elvanoq/device/' + digest);
  const cache = caches.default;
  const hit = await cache.match(cacheKey);
  if (hit) return (await hit.text()) === '1';
  const r = await fetch(PORTAL_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: env.PORTAL_KEY, Authorization: 'Bearer ' + env.PORTAL_KEY, 'User-Agent': USER_AGENT },
    body: JSON.stringify({ action: 'webos-license-status', device_id: deviceId, device_key: deviceKey, platform: 'vidaa' })
  }).catch(() => null);
  if (!r) return false; // Portal fora do ar: não libera o relay
  // 200 = TV conhecida (ativa, pendente ou expirada). 403 = identidade/chave inválidas.
  const ok = r.status === 200;
  ctx.waitUntil(cache.put(cacheKey, new Response(ok ? '1' : '0', { headers: { 'Cache-Control': 'max-age=' + (ok ? DEVICE_CACHE_SECONDS : 60) } })));
  return ok;
}

async function relayFetch(url, env, request, ctx) {
  const target = url.searchParams.get('u') || '';
  let t;
  try { t = new URL(target); } catch { return json({ error: 'URL inválida.' }, 400); }
  if (!['http:', 'https:'].includes(t.protocol) || t.username || t.password || blockedHost(t.hostname)) return json({ error: 'Destino não permitido.' }, 400);
  if (!(await deviceAllowed(request.headers.get('X-EP-Device') || '', request.headers.get('X-EP-Key') || '', env, ctx))) {
    return json({ error: 'TV não registrada no Portal.' }, 403);
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  let upstream;
  try {
    upstream = await fetch(t.toString(), { headers: { 'User-Agent': USER_AGENT, Accept: '*/*' }, redirect: 'follow', signal: controller.signal });
  } catch {
    clearTimeout(timer);
    return json({ error: 'O servidor da lista não respondeu.' }, 504, { 'X-EP-Status': '0' });
  }
  clearTimeout(timer);
  const type = (upstream.headers.get('Content-Type') || '').toLowerCase();
  if (/^(video|audio|image)\//.test(type) || type.includes('mpegurl') && /\.ts(\?|$)/.test(t.pathname)) {
    return json({ error: 'O relay não transmite vídeo.' }, 415);
  }
  const length = parseInt(upstream.headers.get('Content-Length') || '0', 10);
  if (length > FETCH_MAX_BYTES) return json({ error: 'Lista grande demais.' }, 413);
  const headers = { 'Content-Type': type || 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', 'X-EP-Status': String(upstream.status) };
  return new Response(limitBody(upstream.body, FETCH_MAX_BYTES), { status: upstream.status, headers });
}

/* O Content-Length nem sempre vem (respostas em partes): conta os bytes que
 * passam e corta a transferência no limite, para uma lista sem fim não gastar
 * a cota do Worker. */
export function limitBody(body, maxBytes) {
  if (!body) return body;
  let seen = 0;
  return body.pipeThrough(new TransformStream({
    transform(chunk, controller) {
      seen += chunk.byteLength;
      if (seen > maxBytes) {
        controller.error(new Error('Lista grande demais.'));
        return;
      }
      controller.enqueue(chunk);
    }
  }));
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    if (path === '/health') return json({ ok: true, app: 'elvanoq-play-vidaa', version: env.APP_VERSION || '1.0.0', scheme: url.protocol.replace(':', '') });
    if (path === '/api/portal') {
      if (request.method !== 'POST') return json({ error: 'Método não permitido.' }, 405);
      return portal(request, env);
    }
    if (path === '/api/fetch') {
      if (request.method !== 'GET') return json({ error: 'Método não permitido.' }, 405);
      return relayFetch(url, env, request, ctx);
    }
    // Arquivos do app. O endereço HTTP nunca redireciona para HTTPS.
    const response = await env.ASSETS.fetch(request);
    const out = new Response(response.body, response);
    out.headers.set('Cache-Control', path === '/' || path.endsWith('.html') ? 'no-cache' : 'public, max-age=3600');
    return out;
  }
};


