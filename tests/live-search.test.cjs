// 1.1.2: busca de categorias e canais na TV ao Vivo.
// Usa os métodos do LiveTVView sobre um objeto falso (sem DOM).
const assert = require('node:assert/strict');
global.window = global;
global.EP = {
  lower: (s) => String(s || '').toLowerCase(),
  text: (v) => (v == null ? '' : String(v)),
  displayTitle: (t) => String(t || '')
};
require('../public/src/views/liveTVView.js');
const V = EP.LiveTVView.prototype;

function view(opts) {
  const v = Object.create(V);
  Object.assign(v, {
    lazy: false, allCategories: ['Todas', 'Favoritos', 'Esportes', 'Notícias', 'Filmes HD', 'Esportes Premium'], allCategoryIds: [],
    categories: [], categoryIds: [], selectedCategoryIndex: 0, categoryOffset: 0,
    categoryChannels: [], visibleChannels: [], selectedIndex: 0, channelOffset: 0,
    categoryQuery: '', channelQuery: '', renders: 0, applied: 0, stops: 0, requested: 0,
    epg: { guideFor: (ch) => ({ now: ch.now ? { title: ch.now } : null }) },
    renderGuide() { this.renders++; }, stopPreview() { this.stops++; }, requestCurrentCategory() { this.requested++; },
    applyCategory() { this.applied++; }
  }, opts || {});
  v.filterCategories(false);
  return v;
}

// Categorias: "contém", sem maiúsculas; Todas/Favoritos sempre no topo.
let v = view();
v.setSearch('categories', 'ESPORTE');
assert.deepEqual(v.categories, ['Todas', 'Favoritos', 'Esportes', 'Esportes Premium']);
// A categoria aberta (Todas) continua na lista: não troca nem para a prévia.
assert.equal(v.selectedCategoryIndex, 0); assert.equal(v.applied, 0); assert.equal(v.stops, 0);

// Categoria aberta que sai do filtro: abre a primeira encontrada (não Todas/Favoritos).
v = view(); v.selectedCategoryIndex = 3; // Notícias
v.filterCategories(false);
v.setSearch('categories', 'premium');
assert.deepEqual(v.categories, ['Todas', 'Favoritos', 'Esportes Premium']);
assert.equal(v.selectedCategoryIndex, 2); assert.equal(v.applied, 1); assert.equal(v.stops, 1);

// Categoria aberta que continua: mesma categoria selecionada.
v = view(); v.selectedCategoryIndex = 5; // Esportes Premium
v.setSearch('categories', 'esp');
assert.equal(v.categories[v.selectedCategoryIndex], 'Esportes Premium'); assert.equal(v.applied, 0);

// Nada encontrado: só as fixas (a tela mostra "Nenhuma categoria encontrada").
v = view(); v.setSearch('categories', 'xyz');
assert.deepEqual(v.categories, ['Todas', 'Favoritos']); assert.equal(v.fixedCount(), 2);

// Limpar restaura tudo.
v.setSearch('categories', '');
assert.equal(v.categories.length, 6);

// Lista Xtream sob demanda: "Favoritos" fixo (id vazio); categoria real chamada "Todas" filtra normalmente.
v = view({ lazy: true, allCategories: ['Favoritos', 'Todas', 'Esportes', 'Notícias'], allCategoryIds: ['', '10', '11', '12'] });
v.selectedCategoryIndex = 3; v.filterCategories(false);
v.setSearch('categories', 'esp');
assert.deepEqual(v.categories, ['Favoritos', 'Esportes']); assert.deepEqual(v.categoryIds, ['', '11']);
assert.equal(v.selectedCategoryIndex, 1); assert.equal(v.requested, 1, 'pede os canais da nova categoria');

// Canais: nome ou programa atual do guia; mantém o selecionado se continua visível.
const channels = [
  { id: 'a', title: 'Globo SP' }, { id: 'b', title: 'ESPN', now: 'Futebol ao vivo' },
  { id: 'c', title: 'SporTV' }, { id: 'd', title: 'Discovery', now: 'Como é feito' }
];
v = view({ categoryChannels: channels });
v.filterChannels(false);
v.selectedIndex = 2; // SporTV
v.setSearch('channels', 'sport');
assert.deepEqual(v.visibleChannels.map((c) => c.id), ['c']);
assert.equal(v.selectedIndex, 0); assert.equal(v.stops, 0, 'filtrar canais não para a prévia');
v.setSearch('channels', 'FUTEBOL');
assert.deepEqual(v.visibleChannels.map((c) => c.id), ['b'], 'programa atual do guia');
v.setSearch('channels', 'o');
assert.deepEqual(v.visibleChannels.map((c) => c.id), ['a', 'b', 'c', 'd']);
v.selectedIndex = 3; v.setSearch('channels', 'disc');
assert.equal(v.visibleChannels[v.selectedIndex].id, 'd');
v.setSearch('channels', '  ');
assert.equal(v.channelQuery, ''); assert.equal(v.visibleChannels.length, 4);

// O filtro continua quando chegam os canais de outra categoria.
v.channelQuery = 'globo';
v.categoryChannels = channels.concat([{ id: 'e', title: 'Globo News' }]);
v.filterChannels(false);
assert.deepEqual(v.visibleChannels.map((c) => c.id), ['a', 'e']);

// Navegação: ▲ na primeira linha leva ao campo; no campo ▼ volta, ◀/▶ trocam, opções não faz nada.
v = view({ visibleChannels: channels, focusColumn: 'channels', searchFocus: '', updateFocus() {}, events: { emitted: [], emit(n, d) { this.emitted.push([n, d]); } } });
v.selectedIndex = 0;
v.handleKey('up'); assert.equal(v.searchFocus, 'channels');
v.handleKey('left'); assert.equal(v.searchFocus, 'categories');
v.handleKey('right'); assert.equal(v.searchFocus, 'channels');
v.handleKey('options'); assert.equal(v.events.emitted.length, 0);
v.handleKey('OK'); assert.deepEqual(v.events.emitted[0], ['searchRequested', { column: 'channels' }]);
v.handleKey('up'); assert.equal(v.searchFocus, 'channels', '▲ fica no campo');
v.handleKey('down'); assert.equal(v.searchFocus, ''); assert.equal(v.focusColumn, 'channels');

console.log('live-search.test.cjs: ok');
