/* Equivalente ao CatalogService.brs (Roku 0.1.88).
 * - M3U: lista completa em memória (parser do Roku).
 * - Xtream: catálogo completo SOB DEMANDA. Na abertura chegam só a conta e as
 *   listas de categorias (leves) e uma "semente" para a Home (1ª categoria de
 *   filmes e de séries). Os títulos de cada categoria são baixados quando ela
 *   é aberta; a busca percorre o catálogo inteiro sem convertê-lo todo em
 *   objetos. Canais ao vivo usam HLS (.m3u8) quando o servidor permite.
 */
(function (EP) {
  'use strict';
  var R = function () { return EP.PlaylistRules; };
  var SEED_LIMIT = 150, CATEGORY_LIMIT = 5000, SEARCH_LIMIT = 120;

  function fail(error, fallback) {
    return new Error(error && error.message === 'timeout' ? 'O servidor da lista demorou para responder.' : fallback);
  }

  function apiUrl(xt, action, extra) { return R().buildXtreamApiUrl(xt.host, xt.username, xt.password, action, extra); }

  function getJson(url, timeout) {
    return EP.Http.get(url, timeout || 30000).then(function (response) {
      if (response.status < 200 || response.status >= 300) return null;
      return EP.Http.json(response);
    }, function () { return null; });
  }

  function loadM3u(playlist) {
    return EP.Http.get(playlist.credentials.url, 60000).then(function (response) {
      if (response.status < 200 || response.status >= 300) throw new Error('O servidor da lista não aceitou a solicitação.');
      if (!response.text) throw new Error('A lista retornou vazia.');
      var head = response.text.slice(0, 64).replace(/^[\s\uFEFF]+/, '');
      if (head.charAt(0) === '[' || head.charAt(0) === '{') throw new Error('O link cadastrado é uma API Xtream, não um arquivo M3U. No Portal, cadastre a lista como Xtream (servidor, usuário e senha).');
      var parsed = R().parseM3u(response.text);
      if (!parsed.items.length) throw new Error('A lista M3U não tem canais ou está num formato não reconhecido.');
      var epgUrl = playlist.epgUrl || parsed.epgUrl || '';
      return { ok: true, lazy: false, channels: parsed.items, categories: parsed.categories, epg: epgUrl ? { kind: 'xmltv', url: epgUrl } : null };
    }, function (error) { throw fail(error, 'Não foi possível carregar a lista M3U.'); });
  }

  function loadXtream(playlist) {
    var c = playlist.credentials;
    var xt = { host: String(c.host).replace(/\/+$/, ''), username: c.username, password: c.password, liveExtension: 'ts' };
    return EP.Http.get(apiUrl(xt, ''), 30000).then(function (response) {
      var account = EP.Http.json(response);
      if (!account || !account.user_info) throw new Error('Não foi possível conectar ao servidor da lista.');
      if (String(account.user_info.auth) !== '1') throw new Error('Usuário ou senha da lista recusados pelo servidor.');
      var formats = account.user_info.allowed_output_formats || [];
      for (var i = 0; i < formats.length; i++) if (EP.lower(formats[i]) === 'm3u8') xt.liveExtension = 'm3u8';
      return Promise.all([
        getJson(apiUrl(xt, 'get_live_categories')), getJson(apiUrl(xt, 'get_vod_categories')), getJson(apiUrl(xt, 'get_series_categories'))
      ]);
    }, function (error) { throw fail(error, 'Não foi possível conectar ao servidor da lista.'); }).then(function (lists) {
      var rules = R();
      var live = rules.xtreamCategoryList(lists[0]), movies = rules.xtreamCategoryList(lists[1]), series = rules.xtreamCategoryList(lists[2]);
      if (!live.length && !movies.length && !series.length) throw new Error('O servidor não retornou categorias.');
      // Semente para o Início (Novidades): 1ª categoria de filmes e de séries.
      var seeds = [];
      if (movies.length) seeds.push(Catalog.loadCategory(xt, 'movies', movies[0], SEED_LIMIT));
      if (series.length) seeds.push(Catalog.loadCategory(xt, 'series', series[0], SEED_LIMIT));
      return Promise.all(seeds).then(function (loaded) {
        var items = [];
        for (var i = 0; i < loaded.length; i++) items = items.concat(loaded[i].items);
        var names = [];
        for (i = 0; i < live.length; i++) names.push(live[i].name);
        var epg = playlist.epgUrl ? { kind: 'xmltv', url: playlist.epgUrl } : { kind: 'xtream', host: xt.host, username: xt.username, password: xt.password };
        return { ok: true, lazy: true, xtream: xt, liveCategories: live, movieCategories: movies, seriesCategories: series, channels: items, categories: names, epg: epg };
      });
    });
  }

  var ACTIONS = { live: 'get_live_streams', movies: 'get_vod_streams', series: 'get_series' };

  var Catalog = EP.CatalogService = {
    load: function (playlist) {
      if (!playlist || !playlist.credentials) return Promise.reject(new Error('A lista vinculada ainda não possui uma fonte compatível.'));
      if (playlist.sourceType !== 'xtream') {
        // listas salvas antes da correção podem ter um link Xtream marcado como M3U
        var asXtream = R().xtreamFromUrl(playlist.credentials.url);
        if (asXtream) playlist = EP.extend(EP.extend({}, playlist), { sourceType: 'xtream', credentials: EP.extend({ m3uUrl: playlist.credentials.url }, asXtream) });
      }
      if (playlist.sourceType !== 'xtream') return loadM3u(playlist);
      // Lista enviada como M3U e convertida para Xtream: se o servidor não liberar
      // a API Xtream, volta para o M3U original (só links get.php; player_api é JSON).
      var m3uUrl = playlist.credentials.m3uUrl;
      return loadXtream(playlist).then(null, function (error) {
        if (!m3uUrl || /\/(player_api|panel_api)\.php/i.test(m3uUrl)) throw error;
        return loadM3u(EP.extend(EP.extend({}, playlist), { sourceType: 'm3u', credentials: { url: m3uUrl } }));
      });
    },

    /* Títulos de uma categoria. Resolve sempre: { ok, items, error? }. */
    loadCategory: function (xt, kind, category, limit) {
      return EP.Http.get(apiUrl(xt, ACTIONS[kind], { category_id: category.id }), 45000).then(function (response) {
        var body = EP.Http.json(response);
        if (response.status < 200 || response.status >= 300 || !body || body.length === undefined) return { ok: false, items: [], error: 'Não foi possível carregar esta categoria. Tente novamente.' };
        var items = R().xtreamCategoryItems(kind, xt.host, xt.username, xt.password, body, category.name, xt.liveExtension, limit || CATEGORY_LIMIT);
        // Total do servidor (vai junto com a lista, inclusive no cache): a grade
        // avisa quando a categoria passa do limite carregado.
        items.serverTotal = body.length;
        return { ok: true, items: items };
      }, function () { return { ok: false, items: [], error: 'Não foi possível carregar esta categoria. Tente novamente.' }; });
    },

    /* Busca no catálogo inteiro: baixa a lista completa de cada tipo uma vez
     * por sessão (texto) e só converte em itens os títulos encontrados. */
    rawCache: {},
    search: function (xt, query, kinds, categoryNames) {
      var needle = normalize(query);
      kinds = kinds && kinds.length ? kinds : ['movies', 'series', 'live'];
      if (!needle) return Promise.resolve({ ok: true, items: [] });
      var failed = 0;
      return Promise.all(kinds.map(function (kind) {
        return Catalog.rawList(xt, kind).then(function (raw) {
          if (raw === null) { failed++; return []; }
          return scan(raw, needle, kind, xt, (categoryNames && categoryNames[kind]) || {});
        });
      })).then(function (groups) {
        var items = [];
        for (var i = 0; i < groups.length; i++) items = items.concat(groups[i]);
        return { ok: failed < kinds.length, items: items, error: failed >= kinds.length ? 'Não foi possível consultar o servidor da lista.' : '' };
      });
    },
    rawList: function (xt, kind) {
      var key = xt.host + '|' + xt.username + '|' + kind;
      scheduleRawCacheRelease();
      if (Catalog.rawCache[key]) return Catalog.rawCache[key];
      var promise = EP.Http.get(apiUrl(xt, ACTIONS[kind]), 120000).then(function (response) {
        if (response.status < 200 || response.status >= 300 || !response.text) { delete Catalog.rawCache[key]; return null; }
        return response.text;
      }, function () { delete Catalog.rawCache[key]; return null; });
      Catalog.rawCache[key] = promise;
      return promise;
    },
    clearSearchCache: function () { Catalog.rawCache = {}; }
  };

  /* O texto bruto da busca (filmes + séries + canais) pode passar de dezenas de
   * MB: sai da memória depois de 5 min sem buscar e volta a ser baixado na
   * próxima busca. */
  var RAW_CACHE_IDLE_MS = 5 * 60 * 1000, rawCacheTimer = null;
  function scheduleRawCacheRelease() {
    if (rawCacheTimer) clearTimeout(rawCacheTimer);
    rawCacheTimer = setTimeout(function () { rawCacheTimer = null; Catalog.clearSearchCache(); }, RAW_CACHE_IDLE_MS);
  }

  function normalize(value) {
    var s = EP.lower(String(value || '')).replace(/^\s+|\s+$/g, '');
    try { s = s.normalize('NFD').replace(/[̀-ͯ]/g, ''); } catch (_) {}
    return s;
  }

  /* Percorre os campos "name" do JSON cru; cada objeto Xtream é plano (só
   * listas simples dentro), então { … } em volta do achado é o item inteiro. */
  function scan(raw, needle, kind, xt, names) {
    var re = /"name"\s*:\s*"((?:[^"\\]|\\.)*)"/g, match, found = [], seen = {};
    while ((match = re.exec(raw)) && found.length < SEARCH_LIMIT) {
      var name;
      try { name = JSON.parse('"' + match[1] + '"'); } catch (_) { continue; }
      if (normalize(name).indexOf(needle) === -1) continue;
      var start = raw.lastIndexOf('{', match.index), end = raw.indexOf('}', match.index);
      if (start === -1 || end === -1) continue;
      var stream;
      try { stream = JSON.parse(raw.slice(start, end + 1)); } catch (_) { continue; }
      var category = names[String(stream.category_id)] || '';
      var item = R().xtreamCategoryItems(kind, xt.host, xt.username, xt.password, [stream], category, xt.liveExtension, 1)[0];
      if (item && !seen[item.id]) { seen[item.id] = true; found.push(item); }
    }
    return found;
  }
}(window.EP));
