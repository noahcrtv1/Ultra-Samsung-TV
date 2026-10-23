/*
 * Extras on top of the picks (Plus): the verse of the day, My List with followed shows and their new episodes,
 * What's New (this fortnight on the TV's services), trailers and synopses, the random pick, and the Mac hub
 * (reminders, the Mac's load, music playing, references, videos sent from the Mac), polled when hub_url is set.
 */
var Plus = (function () {
  'use strict';

  function store(key, value) { try { localStorage.setItem('fmtv.plus.' + key, JSON.stringify(value)); } catch (e) {} }
  function stored(key) { try { return JSON.parse(localStorage.getItem('fmtv.plus.' + key)); } catch (e) { return null; } }

  var listeners = [];
  function changed() { for (var i = 0; i < listeners.length; i++) listeners[i](); }

  // MARK: - Verse of the day (Almeida)

  var VERSES = [
    ['O Senhor é o meu pastor; nada me faltará.', 'Salmos 23:1'],
    ['Tudo posso naquele que me fortalece.', 'Filipenses 4:13'],
    ['Porque Deus amou o mundo de tal maneira que deu o seu Filho unigênito.', 'João 3:16'],
    ['Sê forte e corajoso; não temas, nem te espantes, porque o Senhor teu Deus é contigo.', 'Josué 1:9'],
    ['Entrega o teu caminho ao Senhor; confia nele, e ele tudo fará.', 'Salmos 37:5'],
    ['O choro pode durar uma noite, mas a alegria vem pela manhã.', 'Salmos 30:5'],
    ['Lâmpada para os meus pés é a tua palavra, e luz para o meu caminho.', 'Salmos 119:105'],
    ['Buscai primeiro o Reino de Deus, e a sua justiça.', 'Mateus 6:33'],
    ['Vinde a mim, todos os que estais cansados e oprimidos, e eu vos aliviarei.', 'Mateus 11:28'],
    ['Eu sou o caminho, e a verdade, e a vida.', 'João 14:6'],
    ['Deixo-vos a paz, a minha paz vos dou.', 'João 14:27'],
    ['Todas as coisas contribuem juntamente para o bem daqueles que amam a Deus.', 'Romanos 8:28'],
    ['Se Deus é por nós, quem será contra nós?', 'Romanos 8:31'],
    ['Não vos conformeis com este mundo, mas transformai-vos pela renovação do vosso entendimento.', 'Romanos 12:2'],
    ['O amor é sofredor, é benigno; o amor não é invejoso.', '1 Coríntios 13:4'],
    ['A minha graça te basta, porque o meu poder se aperfeiçoa na fraqueza.', '2 Coríntios 12:9'],
    ['Não andeis ansiosos de coisa alguma.', 'Filipenses 4:6'],
    ['Lançando sobre ele toda a vossa ansiedade, porque ele tem cuidado de vós.', '1 Pedro 5:7'],
    ['Os que esperam no Senhor renovarão as suas forças.', 'Isaías 40:31'],
    ['Não temas, porque eu sou contigo.', 'Isaías 41:10'],
    ['As misericórdias do Senhor se renovam cada manhã.', 'Lamentações 3:23'],
    ['Confia no Senhor de todo o teu coração, e não te estribes no teu próprio entendimento.', 'Provérbios 3:5'],
    ['Sobre tudo o que se deve guardar, guarda o teu coração.', 'Provérbios 4:23'],
    ['Deleita-te também no Senhor, e ele te concederá o que deseja o teu coração.', 'Salmos 37:4'],
    ['Aquietai-vos, e sabei que eu sou Deus.', 'Salmos 46:10'],
    ['Este é o dia que fez o Senhor; regozijemo-nos, e alegremo-nos nele.', 'Salmos 118:24'],
    ['O Senhor é a minha luz e a minha salvação; a quem temerei?', 'Salmos 27:1'],
    ['Eis que estou convosco todos os dias, até a consumação dos séculos.', 'Mateus 28:20'],
    ['Vós sois a luz do mundo.', 'Mateus 5:14'],
    ['A fé é o firme fundamento das coisas que se esperam.', 'Hebreus 11:1'],
    ['Alegrai-vos sempre no Senhor; outra vez digo, alegrai-vos.', 'Filipenses 4:4'],
    ['Deus é o nosso refúgio e fortaleza, socorro bem presente na angústia.', 'Salmos 46:1'],
    ['O Senhor te abençoe e te guarde.', 'Números 6:24'],
    ['Porque eu bem sei os pensamentos que tenho a vosso respeito: pensamentos de paz.', 'Jeremias 29:11'],
    ['Ensina-nos a contar os nossos dias, para que alcancemos corações sábios.', 'Salmos 90:12'],
    ['Seja a vossa palavra sempre agradável, temperada com sal.', 'Colossenses 4:6'],
    ['Tudo quanto fizerdes, fazei-o de todo o coração, como ao Senhor.', 'Colossenses 3:23'],
    ['Em tudo dai graças.', '1 Tessalonicenses 5:18'],
    ['Deus é amor.', '1 João 4:8'],
    ['Eu e a minha casa serviremos ao Senhor.', 'Josué 24:15']
  ];

  function verse() {
    var d = new Date(), n = Math.floor((d.getTime() - d.getTimezoneOffset() * 60000) / 86400000);
    var v = VERSES[n % VERSES.length];
    return {text: v[0], ref: v[1]};
  }

  // MARK: - My List: saved titles; shows in it are followed for new episodes

  var list = stored('list') || [];

  function keyOf(p) { return p.kind + ':' + p.id; }
  function inList(p) { for (var i = 0; i < list.length; i++) if (keyOf(list[i]) === keyOf(p)) return list[i]; return null; }

  function toggle(p) {
    var had = inList(p);
    if (had) list.splice(list.indexOf(had), 1);
    else list.unshift({id: p.id, kind: p.kind, title: p.title, backdrop: p.backdrop, meta: p.meta, app: p.app,
      service: p.service, detailed: true, seen: '', fresh: ''});
    store('list', list);
    if (!had && p.kind === 'tv') checkEpisodes(true);
    changed();
    return !had;
  }

  function episodeCode(e) { return e ? 'T' + e.season_number + 'E' + e.episode_number : ''; }

  var episodesAt = stored('episodesAt') || 0, checking = false;

  /** Once every 6 h: the latest aired episode of each followed show; newer than what was seen → it's new. */
  function checkEpisodes(force, done) {
    if (checking || (!force && Date.now() - episodesAt < 6 * 3600000)) { if (done) done([]); return; }
    checking = true;
    var shows = list.filter(function (x) { return x.kind === 'tv'; }), news = [], i = 0;
    (function next() {
      if (i >= shows.length) {
        checking = false;
        episodesAt = Date.now();
        store('episodesAt', episodesAt);
        store('list', list);
        changed();
        if (done) done(news);
        return;
      }
      var s = shows[i++];
      Data.tmdb('/tv/' + s.id + '?language=' + I18N.locale(), function (err, o) {
        if (!err && o && o.last_episode_to_air) {
          var code = episodeCode(o.last_episode_to_air);
          if (!s.seen) s.seen = code;                 // just followed: what's out is not news
          else if (code !== s.seen) { s.fresh = code; news.push(s); }
        }
        next();
      });
    })();
  }

  /** The show was opened: its new episode isn't news anymore. */
  function seen(p) {
    var s = inList(p);
    if (s && s.fresh) { s.seen = s.fresh; s.fresh = ''; store('list', list); changed(); }
  }

  function myList() {
    return list.map(function (x) {
      var copy = {};
      for (var k in x) if (x.hasOwnProperty(k)) copy[k] = x[k];
      if (x.fresh) copy.meta = tr('Episódio novo: ', 'New episode: ', 'Episodio nuevo: ') + x.fresh + (x.service ? ' · ' + x.service : '');
      return copy;
    });
  }

  // MARK: - What's New: released in the last 14 days on the TV's services

  var news = stored('news') || {at: 0, picks: []}, fetchingNews = false;

  function refreshNews() {
    var filter = Data.providerFilter();
    if (!filter) { Data.ensureFilter(function (f) { if (f) refreshNews(); }); return; }
    if (fetchingNews || !filter || (Date.now() - news.at < 6 * 3600000 && news.picks.length)) return;
    fetchingNews = true;
    var out = [], kinds = [['movie', 'primary_release_date'], ['tv', 'first_air_date']], k = 0;
    (function nextKind() {
      if (k >= kinds.length) {
        var picked = [], seenIds = {}, i = 0;
        out.sort(function (a, b) { return b.pop - a.pop; });
        (function detail() {
          if (i >= out.length || picked.length >= 9) {
            fetchingNews = false;
            if (picked.length) { news = {at: Date.now(), picks: picked}; store('news', news); changed(); }
            return;
          }
          var p = out[i++];
          if (seenIds[p.id]) { detail(); return; }
          seenIds[p.id] = true;
          Data.details(p, function (e) { if (!e && p.app) picked.push(p); detail(); });
        })();
        return;
      }
      var kind = kinds[k++];
      Data.tmdb('/discover/' + kind[0] + '?' + kind[1] + '.gte=' + Data.day(-14) + '&' + kind[1] + '.lte=' + Data.day(0)
          + filter, function (e, r) {
        for (var j = 0; !e && r && j < r.results.length && j < 10; j++) {
          var p = Data.newPick(r.results[j], kind[0]);
          if (p) { p.pop = r.results[j].popularity || 0; out.push(p); }
        }
        nextKind();
      });
    })();
  }

  // MARK: - Trailers and synopses

  var trailers = stored('trailers') || {}, overviews = {};

  function pickVideo(results) {
    var best = null, score = -1;
    for (var i = 0; results && i < results.length; i++) {
      var v = results[i];
      if (v.site !== 'YouTube' || !v.key) continue;
      var s = (v.type === 'Trailer' ? 4 : v.type === 'Teaser' ? 2 : 0) + (v.official ? 1 : 0);
      if (s > score) { score = s; best = v.key; }
    }
    return best;
  }

  /** The title's YouTube trailer id (dubbed or subtitled in the TV's language first), or null. */
  function trailer(p, done) {
    var k = keyOf(p);
    if (trailers[k] !== undefined) { done(trailers[k]); return; }
    Data.tmdb('/' + p.kind + '/' + p.id + '/videos?language=' + I18N.locale(), function (e, r) {
      var key = !e && r ? pickVideo(r.results) : null;
      function keep(x) { trailers[k] = x; store('trailers', trailers); done(x); }
      if (key) { keep(key); return; }
      Data.tmdb('/' + p.kind + '/' + p.id + '/videos?language=en-US', function (e2, r2) {
        keep(!e2 && r2 ? pickVideo(r2.results) : null);
      });
    });
  }

  /** The synopsis, in the TV's language (English when TMDB has none). */
  function overview(p, done) {
    var k = keyOf(p);
    if (overviews[k] !== undefined) { done(overviews[k]); return; }
    Data.tmdb('/' + p.kind + '/' + p.id + '?language=' + I18N.locale(), function (e, o) {
      if (!e && o && o.overview) { overviews[k] = o.overview; done(o.overview); return; }
      Data.tmdb('/' + p.kind + '/' + p.id + '?language=en-US', function (e2, o2) {
        overviews[k] = !e2 && o2 && o2.overview ? o2.overview : '';
        done(overviews[k]);
      });
    });
  }

  /** Movies and shows matching the text, as picks (with where they are, for the TV's services). */
  function search(text, done) {
    Data.tmdb('/search/multi?include_adult=false&language=' + I18N.locale() + '&query=' + encodeURIComponent(text), function (e, r) {
      var out = [];
      for (var i = 0; !e && r && i < r.results.length && out.length < 6; i++) {
        var o = r.results[i];
        if (o.media_type !== 'movie' && o.media_type !== 'tv') continue;
        var p = Data.newPick(o, o.media_type);
        if (p) out.push(p);
      }
      done(out);
    });
  }

  /**
   * Something to watch, at random, from the whole catalog of the TV's services: a well-rated movie or show from a
   * random page of TMDB's discover; done(pick) with where it is, or null (then this hour's picks and the lists).
   */
  function shuffle(done) {
    if (!Data.providerFilter()) { Data.ensureFilter(function (f) { if (f) shuffle(done); else done(null); }); return; }
    var filter = Data.providerFilter(), tries = 0;
    function local() {
      var pool = Data.showcase().concat(news.picks, list).filter(function (p) { return p.app && Data.appFor(p.app) && p.backdrop; });
      done(pool.length ? pool[Math.floor(Math.random() * pool.length)] : null);
    }
    if (!filter) { local(); return; }
    (function attempt() {
      if (tries++ > 3) { local(); return; }
      var kind = Math.random() < 0.55 ? 'movie' : 'tv', page = 1 + Math.floor(Math.random() * 15);
      Data.tmdb('/discover/' + kind + '?vote_average.gte=6.6&vote_count.gte=' + (kind === 'movie' ? 300 : 120) + '&page=' + page
          + filter.replace('sort_by=popularity.desc', 'sort_by=vote_count.desc'), function (e, r) {
        var res = !e && r && r.results ? r.results : [];
        if (!res.length) { attempt(); return; }
        var p = Data.newPick(res[Math.floor(Math.random() * res.length)], kind);
        if (!p) { attempt(); return; }
        Data.details(p, function (err) { if (!err && p.app) done(p); else attempt(); });
      });
    })();
  }

  // MARK: - Premieres: titles still to come, counted down on the island

  var premieres = stored('premieres') || [];
  function premiere(p) {
    for (var i = 0; i < premieres.length; i++) if (premieres[i].key === keyOf(p)) return premieres[i];
    return null;
  }
  function togglePremiere(p) {
    var had = premiere(p);
    if (had) premieres.splice(premieres.indexOf(had), 1);
    else premieres.push({key: keyOf(p), id: p.id, kind: p.kind, title: p.title, date: p.released, backdrop: p.backdrop});
    store('premieres', premieres);
    changed();
    return !had;
  }

  // MARK: - The Mac hub

  var HUB = (CONFIG.hubUrl || '').replace(/\/$/, '');
  var hub = {online: false}, hubKey = '', hubListeners = [], lastReminder = stored('lastReminder') || 0;
  var onReminder = function () {}, onCast = function () {}, lastCast = stored('lastCast') || 0;

  function hubGet(path, done) {
    if (!HUB) { done(null); return; }
    var x = new XMLHttpRequest();
    x.open('GET', HUB + path, true);
    x.timeout = 4000;
    x.onload = function () { try { done(x.status === 200 ? JSON.parse(x.responseText) : null); } catch (e) { done(null); } };
    x.onerror = x.ontimeout = function () { done(null); };
    x.send();
  }

  function hubPost(path, body) {
    if (!HUB) return;
    try {
      var x = new XMLHttpRequest();
      x.open('POST', HUB + path, true);
      x.setRequestHeader('Content-Type', 'application/json');
      x.send(JSON.stringify(body || {}));
    } catch (e) {}
  }

  function pollHub() {
    hubGet('/api/tv/state', function (s) {
      var before = hubKey;
      hub = s || {online: false};
      hub.online = !!s;
      // Only what the screen shows counts as a change (the hub answers every 4 s).
      hubKey = hub.online + JSON.stringify(hub.music || {}) + (hub.refs || []).join();
      var r = hub.reminder;
      if (r && r.at > lastReminder) { lastReminder = r.at; store('lastReminder', r.at); onReminder(r); }
      var c = hub.cast;
      if (c && c.at > lastCast) { lastCast = c.at; store('lastCast', c.at); onCast(c); }
      if (hubKey !== before) for (var i = 0; i < hubListeners.length; i++) hubListeners[i]();
    });
  }

  if (HUB) { pollHub(); setInterval(function () { if (!document.hidden) pollHub(); }, 6000); }

  /** Movie night: the Alexa routine (Voice Monkey), when its URL is set. */
  function popcorn() {
    var url = CONFIG.voiceMonkeyUrl;
    if (!url) return false;
    try {
      var x = new XMLHttpRequest();
      x.open('GET', url, true);
      x.send();
    } catch (e) { return false; }
    return true;
  }

  return {
    onChange: function (fn) { listeners.push(fn); },
    onHub: function (fn) { hubListeners.push(fn); },
    onReminder: function (fn) { onReminder = fn; },
    showReminder: function (r) { onReminder(r); },
    playCast: function (c) { onCast(c); },
    onCast: function (fn) { onCast = fn; },
    verse: verse,
    inList: inList,
    toggle: toggle,
    seen: seen,
    myList: myList,
    checkEpisodes: checkEpisodes,
    news: function () { return news.picks; },
    refresh: function () { refreshNews(); checkEpisodes(false, function (fresh) { if (fresh.length) changed(); }); },
    trailer: trailer,
    overview: overview,
    shuffle: shuffle,
    search: search,
    premiere: premiere,
    togglePremiere: togglePremiere,
    premieres: function () { return premieres; },
    hub: function () { return hub; },
    hubUrl: function (path) { return HUB ? HUB + path : ''; },
    trailerPage: function () { return CONFIG.trailerPage || (HUB ? HUB + '/yt.html' : ''); },
    hubPost: hubPost,
    popcorn: popcorn,
    hasPopcorn: function () { return !!CONFIG.voiceMonkeyUrl; },
    hasWifi: function () { return !!CONFIG.wifiSsid; },
    wifiSsid: function () { return CONFIG.wifiSsid || ''; }
  };
})();
