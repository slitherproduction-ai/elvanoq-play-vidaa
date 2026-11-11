import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const errors = [];
const requireFile = (relativePath) => {
  const filePath = resolve(root, relativePath);
  if (!existsSync(filePath)) errors.push('Arquivo obrigatório ausente: ' + relativePath);
  else if (statSync(filePath).size === 0) errors.push('Arquivo vazio: ' + relativePath);
  return filePath;
};

// Todos os scripts e estilos referenciados pelo index.html precisam existir e compilar.
const html = existsSync(resolve(root, 'public/index.html')) ? readFileSync(resolve(root, 'public/index.html'), 'utf8') : '';
const scripts = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map((m) => m[1]);
const styles = [...html.matchAll(/<link[^>]+href="([^"]+\.css)"/g)].map((m) => m[1]);
if (!scripts.length) errors.push('index.html não referencia nenhum script.');
for (const style of styles) requireFile('public/' + style);
for (const script of scripts) {
  const scriptPath = requireFile('public/' + script);
  if (!existsSync(scriptPath)) continue;
  const result = spawnSync(process.execPath, ['--check', scriptPath], { encoding: 'utf8' });
  if (result.status !== 0) errors.push(script + ' contém erro de sintaxe: ' + result.stderr.trim());
  // Compatibilidade com navegadores de TV antigos (VIDAA U4+): sem sintaxe ES2015+ nas fontes do app.
  const source = readFileSync(scriptPath, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  if (/=>|`|\b(let|const|class)\s|\basync\s+function|\bawait\s/.test(source)) errors.push(script + ' usa sintaxe ES2015+ (use ES5 + Promise).');
}

// Imagens usadas pelo layout Roku
for (const asset of ['images/elvanoq-wordmark-white.png', 'images/elvanoq-login-tv-backdrop.jpg', 'images/splash.jpg', 'fonts/Inter-Regular.woff', 'fonts/Inter-Medium.woff', 'fonts/Inter-SemiBold.woff', 'fonts/Inter-Bold.woff']) requireFile('public/' + asset);

// Testes de regras
for (const test of ['tests/home-rails.test.cjs', 'tests/playlist-sync.test.cjs', 'tests/epg-and-stream.test.cjs', 'tests/v110-features.test.cjs', 'tests/player-watchdog.test.cjs', 'tests/live-search.test.cjs', 'tests/v113-features.test.cjs']) {
  const result = spawnSync(process.execPath, [resolve(root, test)], { encoding: 'utf8' });
  if (result.status !== 0) errors.push(test + ' falhou:\n' + (result.stderr || result.stdout).trim());
}

// Worker + plataforma VIDAA
requireFile('worker/src/index.js');
requireFile('worker/wrangler.toml');
// Nada de Samsung/MSX no app VIDAA
for (const script of scripts) { const src = readFileSync(resolve(root, 'public/' + script), 'utf8'); if (/samsung-msx|elvanoq-msx|SM-NET/.test(src)) errors.push(script + ' ainda contém referência ao Samsung/MSX.'); }
for (const asset of ['store/vidaa-banner-1776x284.jpg', 'store/vidaa-icon-512.png']) requireFile(asset);
for (const test of ['tests/worker.test.mjs', 'tests/vidaa-code-license-client.mjs']) {
  const result = spawnSync(process.execPath, [resolve(root, test)], { encoding: 'utf8' });
  if (result.status !== 0) errors.push(test + ' falhou:\n' + (result.stderr || result.stdout).trim());
}

if (errors.length) { console.error('Validação VIDAA falhou:\n- ' + errors.join('\n- ')); process.exit(1); }
console.log('Validação VIDAA concluída com sucesso (' + scripts.length + ' scripts + Worker).');

