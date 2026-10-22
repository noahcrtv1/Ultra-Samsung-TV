/*
 * The web demo of Free My TV Clássico: TMDB answers come from fixtures.js (recorded once, so the page carries no key),
 * an on-screen remote for phones and mice, and a few things the TV would get from the Mac hub, played out here.
 */
(function () {
  'use strict';

  var FIX = window.FIXTURES || {};
  var items = {};   // every movie/show seen in any recorded list, by "kind:id"
  Object.keys(FIX).forEach(function (k) {
    var kind = /\/(movie|tv)\b/.exec(k), list = FIX[k] && FIX[k].results;
    for (var i = 0; list && i < list.length; i++) {
      var o = list[i], t = o.media_type || (o.title ? 'movie' : o.name ? 'tv' : kind && kind[1]);
      if (t === 'movie' || t === 'tv') items[t + ':' + o.id] = o;
    }
  });
  var SERVICES = ['Netflix', 'Prime Video', 'Disney Plus', 'Max', 'Apple TV', 'Globoplay'];

  function pick(list) { return list[Math.floor(Math.random() * list.length)]; }
  function param(path, name) { var m = new RegExp('[?&]' + name + '=([^&]*)').exec(path); return m ? decodeURIComponent(m[1]) : ''; }

  function answer(path) {
    if (FIX[path]) return FIX[path];
    var m = /^\/(movie|tv)\/(\d+)(\/videos)?/.exec(path);
    if (m) {
      if (m[3]) return {results: []};
      var o = items[m[1] + ':' + m[2]];
      if (!o) return null;
      // Details nobody recorded: the list entry, on one of the sample services.
      var copy = JSON.parse(JSON.stringify(o));
      copy.genres = (o.genre_ids || []).map(function (g) { return {id: g, name: ''}; });
      copy.runtime = m[1] === 'movie' ? 95 + (o.id % 60) : 0;
      copy['watch/providers'] = {results: {BR: {flatrate: [{provider_name: SERVICES[o.id % SERVICES.length]}]}}};
      return copy;
    }
    if (path.indexOf('/search/multi') === 0) {
      var q = param(path, 'query').toLowerCase(), out = [];
      Object.keys(items).forEach(function (k) {
        var o = items[k], name = (o.title || o.name || '').toLowerCase();
        if (q && name.indexOf(q) >= 0) { var c = JSON.parse(JSON.stringify(o)); c.media_type = k.split(':')[0]; out.push(c); }
      });
      return {results: out.slice(0, 20)};
    }
    var d = /^\/discover\/(movie|tv)/.exec(path);
    if (d) {
      var g = param(path, 'with_genres'), rt = param(path, 'with_runtime.lte'), keys = Object.keys(FIX).filter(function (k) {
        return k.indexOf('/discover/' + d[1]) === 0 && (!g || param(k, 'with_genres') === g) && (!rt || param(k, 'with_runtime.lte') === rt);
      });
      if (!keys.length) keys = Object.keys(FIX).filter(function (k) { return k.indexOf('/discover/' + d[1]) === 0; });
      return keys.length ? FIX[pick(keys)] : null;
    }
    var base = path.split('?')[0], same = Object.keys(FIX).filter(function (k) { return k.split('?')[0] === base; });
    return same.length ? FIX[same[0]] : null;
  }

  window.TMDB_DEMO = function (path, done) {
    var a = answer(path);
    setTimeout(function () { if (a) done(null, JSON.parse(JSON.stringify(a))); else done(new Error('demo: ' + path)); }, 60);
  };

  // MARK: - On-screen remote (phones, mice)

  function remote() {
    var r = document.createElement('div');
    r.id = 'demo-remote';
    r.innerHTML = '<button data-k="38">▲</button><button data-k="37">◀</button><button data-k="13" class="ok">OK</button>'
      + '<button data-k="39">▶</button><button data-k="40">▼</button><button data-k="27" class="back">Voltar</button>';
    document.body.appendChild(r);
    [].forEach.call(r.querySelectorAll('button'), function (b) {
      b.addEventListener('click', function (e) { e.stopPropagation(); window.FreeMyTV.press(+b.getAttribute('data-k')); });
    });
    var tip = document.createElement('div');
    tip.id = 'demo-tip';
    tip.textContent = 'Demo · setas, Enter e Esc no teclado (ou o controle na tela)';
    document.body.appendChild(tip);
    setTimeout(function () { tip.className = 'off'; }, 9000);
  }

  // MARK: - What the Mac hub would send

  function hubLife() {
    var songs = [['Bohemian Rhapsody', 'Queen'], ['Blinding Lights', 'The Weeknd'], ['Garota de Ipanema', 'Tom Jobim']], n = 0;
    function song() {
      var s = songs[n++ % songs.length];
      More.island.set('music', {priority: 1, icon: '🎵', text: s[0], sub: s[1], right: 'eq', big: {title: s[0], sub: s[1] + ' · Spotify'}});
      More.island.flash('music', {icon: '🎵', text: s[0], big: {title: s[0], sub: s[1] + ' · Spotify'}}, 6000);
    }
    setTimeout(song, 25000);
    setInterval(song, 180000);
  }

  // MARK: - Test menu: fire everything the Dynamic Island and the automations do

  var LOGO = 'https://a.espncdn.com/i/teamlogos/soccer/500/2029.png';
  var gameN = 0, gameState = null;

  function game(state, us, them, clock) {
    var abbr = (CONFIG.team && CONFIG.team.abbr) || 'TIME';
    gameState = {id: 'demo' + gameN, at: state === 'pre' ? Date.now() + 9 * 60000 : Date.now() - 30 * 60000, league: 'bra.1', state: state,
      clock: clock || '', detail: clock || '', us: {abbr: abbr, score: us}, them: {abbr: 'PAL', name: 'Palmeiras', score: them, logo: LOGO},
      home: true, tv: 'Premiere, Globo'};
    More.test.onGame(gameState);
  }

  var TESTS = [
    ['⚽ Jogo do time', [
      ['Pré-jogo (9 min)', function () { gameN++; game('pre', 0, 0); }],
      ['Começou (ao vivo)', function () { game('in', 0, 0, "1'"); }],
      ['GOL do time', function () { var s = gameState ? gameState.us.score : 0; game('in', s + 1, gameState ? gameState.them.score : 0, "34'"); }],
      ['Gol do adversário', function () { game('in', gameState ? gameState.us.score : 0, (gameState ? gameState.them.score : 0) + 1, "52'"); }],
      ['Fim de jogo', function () { game('post', gameState ? gameState.us.score : 1, gameState ? gameState.them.score : 0, 'Fim'); }],
      ['Só a festa do gol', function () { More.test.goal('COR 2 × 1 PAL'); }]
    ]],
    ['🎵 Música e rádio', [
      ['Música no Spotify', function () { var s = ['Blinding Lights', 'The Weeknd']; More.island.set('music', {priority: 1, icon: '🎵', text: s[0], sub: s[1], right: 'eq', big: {title: s[0], sub: s[1] + ' · Spotify'}}); More.island.flash('music', {icon: '🎵', text: s[0], big: {title: s[0], sub: s[1] + ' · Spotify'}}, 6000); }],
      ['Parar música', function () { More.island.set('music', null); }],
      ['Abrir rádio do mundo', function () { Fun.relax(); setTimeout(function () { FreeMyTV.press(13); }, 300); }]
    ]],
    ['⛈ Clima', [
      ['Alerta de temporal', function () {
        var a = {priority: 3, icon: '⛈', text: 'Tempestade às 18h', color: '#3A1F00', big: {title: 'Alerta: tempestade', sub: 'Previsão para 18h em ' + (CONFIG.city || 'sua cidade')}};
        More.island.set('storm', a); More.island.flash('storm', a, 10000);
      }],
      ['Chuva na tela', function () { More.test.rain(true, false); }],
      ['Tempestade com raios', function () { More.test.rain(true, true); }],
      ['Limpar (clima real)', function () { More.island.set('storm', null); More.test.rain(null); }]
    ]],
    ['🔔 Avisos', [
      ['Lembrete na tela', function () { Plus.showReminder({text: 'Tira o bolo do forno 🍰', from: 'Mãe', at: Date.now()}); }],
      ['Resumo da noite', function () { More.test.night(); }],
      ['Estreia hoje', function () { More.island.flash('premiere', {icon: '🍿', text: 'Estreia hoje: Duna 3', big: {title: 'Estreia hoje: Duna 3', sub: 'Hoje!'}}, 8000); }],
      ['Contagem de estreia', function () { More.island.set('premiere', {priority: 0.5, icon: '🎟', text: 'Duna 3 em 12 dias', big: {title: 'Duna 3 em 12 dias', sub: '18 de dez.'}}); }]
    ]],
    ['🏠 Tela', [
      ['Boas-vindas', function () { More.test.welcome(); }],
      ['“Ainda está aí?”', function () { More.test.stillThere(); }],
      ['Focar a ilha (↑)', function () { var F = FreeMyTV; F.state.zone = 'top'; F.state.top = 0; F.move(0, -1); }],
      ['Vitrine', function () { FreeMyTV.showSaver(); }],
      ['O que ver hoje?', function () { Fun.whatToWatch(); }],
      ['Mandar vídeo (YouTube)', function () { Plus.playCast({kind: 'youtube', id: 'dQw4w9WgXcQ', at: Date.now()}); }]
    ]]
  ];

  function testMenu() {
    var btn = document.createElement('button');
    btn.id = 'demo-test';
    btn.textContent = '🧪 Testar';
    document.body.appendChild(btn);
    var panel = document.createElement('div');
    panel.id = 'demo-panel';
    TESTS.forEach(function (group) {
      var h = document.createElement('div');
      h.className = 'grp';
      h.textContent = group[0];
      panel.appendChild(h);
      group[1].forEach(function (t) {
        var b = document.createElement('button');
        b.textContent = t[0];
        b.addEventListener('click', function (e) { e.stopPropagation(); try { t[1](); } catch (x) { console.error(x); } });
        panel.appendChild(b);
      });
    });
    var hint = document.createElement('div');
    hint.className = 'hint';
    hint.textContent = 'Com a ilha focada: ← → troca, OK abre as ações, Esc fecha.';
    panel.appendChild(hint);
    document.body.appendChild(panel);
    btn.addEventListener('click', function (e) { e.stopPropagation(); panel.classList.toggle('open'); btn.classList.toggle('open'); });
  }

  window.addEventListener('load', function () {
    remote();
    testMenu();
    hubLife();
  });
})();
