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

  window.addEventListener('load', function () {
    remote();
    hubLife();
  });
})();
