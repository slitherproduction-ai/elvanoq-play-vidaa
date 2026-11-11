/* Equivalente ao MetadataService.brs. O Portal ainda não expõe uma ação
 * "webos-metadata" (o TMDB existe só para Roku), então os detalhes vêm da
 * própria fonte Xtream: get_vod_info para filmes e get_series_info para
 * séries (temporadas e episódios reproduzíveis). Listas M3U não trazem
 * metadados — a tela mostra o mesmo texto padrão do Roku.
 *
 * Formato retornado (o mesmo que o DetailView do Roku espera):
 *   { found, item: { title, overview, release_date, vote_average, genres[],
 *     poster, seasons: [{ number, name, episode_count, episodes[] }], trailer_url } }
 */
(function (EP) {
  'use strict';
  function firstText() {
    for (var i = 0; i < arguments.length; i++) { var v = EP.text(arguments[i]); if (v) return v; }
    return '';
  }
  function genres(value) {
    var raw = firstText(value);
    if (!raw) return [];
    var parts = raw.split(/\s*[,\/|]\s*/), out = [];
    for (var i = 0; i < parts.length && out.length < 4; i++) if (parts[i]) out.push(parts[i]);
    return out;
  }
  function firstBackdrop(value) {
    var list = value && value.length !== undefined && typeof value !== 'string' ? value : [value];
    for (var i = 0; i < list.length; i++) { var v = EP.text(list[i]); if (/^https?:\/\//.test(v)) return v; }
    return '';
  }
  function httpsTrailer(info) {
    var candidate = firstText(info.trailer_url, info.trailer);
    return /^https:\/\//.test(candidate) && !/youtube\.com|youtu\.be/.test(candidate) ? candidate : '';
  }

  EP.MetadataService = {
    load: function (item, xtream) {
      if (!item || !xtream) return Promise.resolve({ found: false });
      var rules = EP.PlaylistRules, url;
      if (item.type === 'movies' && item.stream_id != null) url = rules.buildXtreamApiUrl(xtream.host, xtream.username, xtream.password, 'get_vod_info', { vod_id: item.stream_id });
      else if (item.type === 'series' && item.series_id != null) url = rules.buildXtreamApiUrl(xtream.host, xtream.username, xtream.password, 'get_series_info', { series_id: item.series_id });
      else return Promise.resolve({ found: false });
      return EP.Http.get(url, 20000).then(function (response) {
        var body = EP.Http.json(response);
        if (!body || response.status < 200 || response.status >= 300) return { found: false };
        var info = body.info || {};
        var details = {
          title: firstText(info.name, info.title, item.title),
          overview: firstText(info.plot, info.description, item.plot),
          release_date: firstText(info.releasedate, info.releaseDate, info.release_date, item.year),
          vote_average: firstText(info.rating, info.rating_5based && String(info.rating_5based * 2), item.rating),
          genres: genres(info.genre),
          poster: firstText(info.cover_big, info.movie_image, info.cover, item.logo),
          backdrop: firstBackdrop(info.backdrop_path),
          duration: firstText(info.duration),
          trailer_url: httpsTrailer(info),
          seasons: []
        };
        if (item.type === 'series') details.seasons = rules.xtreamSeasons(xtream.host, xtream.username, xtream.password, body);
        return { found: true, item: details };
      }, function () { return { found: false }; });
    }
  };
}(window.EP));
