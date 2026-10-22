/*
 * Fun: a full-screen layer of its own (#fun) with the remote's keys while it's open.
 *  - What to watch: random, the genre wheel, "this or that", by running time, this week's ranking
 *  - Today in film history, the movie quiz, premieres counted down on the island
 *  - The radio globe (radio-browser.info), ambient scenes (fire, aquarium, rain; drawn and voiced here), 2048
 */
var Fun = (function () {
  'use strict';

  var H = window.Home, $ = H.$, el = H.el, setClass = H.setClass;
  var box = $('fun'), screen = null;   // screen: {key(k) → handled, stop()}
  var K = TV.keys;

  function store(key, value) { try { localStorage.setItem('fmtv.fun.' + key, JSON.stringify(value)); } catch (e) {} }
  function stored(key) { try { return JSON.parse(localStorage.getItem('fmtv.fun.' + key)); } catch (e) { return null; } }
  function rnd(n) { return Math.floor(Math.random() * n); }
  function shuffled(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = rnd(i + 1), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function img(path, size) { return Data.image(path, size || 'w780'); }

  function open(build) {
    if (screen && screen.stop) screen.stop();
    box.innerHTML = '';
    box.className = 'on';
    screen = build(box) || {};
    H.wake();
  }

  function close() {
    if (screen && screen.stop) screen.stop();
    screen = null;
    box.className = '';
    box.innerHTML = '';
  }

  /** A pick from TMDB's discover over the TV's services, detailed; done(pick or null). */
  function discover(kind, extra, done) {
    Data.ensureFilter(function (filter) {
      if (!filter) { done(null); return; }
      var tries = 0;
      (function attempt() {
        if (tries++ > 3) { done(null); return; }
        Data.tmdb('/discover/' + kind + '?page=' + (1 + rnd(tries === 1 ? 8 : 2)) + extra + filter, function (e, r) {
          var res = !e && r && r.results ? shuffled(r.results) : [];
          var p = res.length ? Data.newPick(res[0], kind) : null;
          if (!p) { attempt(); return; }
          Data.details(p, function (err) { if (!err && p.app) done(p); else attempt(); });
        });
      })();
    });
  }

  function show(p) {
    if (!p) { H.toast(tr('Não achei nada assim agora', 'Nothing like that right now', 'No encontré nada así')); return; }
    close();
    H.openDetail(p);
  }

  function loading(text) {
    box.innerHTML = '';
    el('div', 'loading', box, text || tr('Procurando…', 'Looking…', 'Buscando…'));
  }

  // MARK: - A focusable list of tiles (menus): arrows move, OK runs, Back closes

  function menu(title, items, cols) {
    open(function (b) {
      el('div', 'ftitle', b, title);
      var grid = el('div', 'fgrid', b), i = 0;
      cols = cols || 4;
      items.forEach(function (it, n) {
        var t = el('div', 'ftile', grid);
        el('div', 'emoji', t, it.emoji);
        el('div', 'name', t, it.label);
        if (it.sub) el('div', 'sub', t, it.sub);
        t.onclick = function () { it.run(); };
        t.onmouseover = function () { i = n; focus(); };
      });
      function focus() { for (var n = 0; n < grid.children.length; n++) setClass(grid.children[n], 'focus', n === i); }
      focus();
      return {key: function (k) {
        if (k === K.left) i = Math.max(0, i - 1);
        else if (k === K.right) i = Math.min(items.length - 1, i + 1);
        else if (k === K.up) i = Math.max(0, i - cols);
        else if (k === K.down) i = Math.min(items.length - 1, i + cols);
        else if (k === K.ok) { items[i].run(); return true; }
        else return false;
        focus();
        return true;
      }};
    });
  }

  function whatToWatch() {
    menu(tr('O que ver hoje?', 'What to watch?', '¿Qué ver hoy?'), [
      {emoji: '🎲', label: tr('Sortear', 'Surprise me', 'Sortear'), run: function () { loading(tr('Sorteando…', 'Picking…', 'Sorteando…')); Plus.shuffle(show); }},
      {emoji: '🎡', label: tr('Roleta de gênero', 'Genre wheel', 'Ruleta de género'), run: wheel},
      {emoji: '⚔️', label: tr('Esse ou aquele', 'This or that', 'Este o aquel'), run: thisOrThat},
      {emoji: '⏱', label: tr('Pela duração', 'By running time', 'Por duración'), run: byTime},
      {emoji: '🏆', label: tr('Ranking da semana', "This week's top", 'Ranking semanal'), run: ranking},
      {emoji: '📅', label: tr('Hoje na história', 'On this day', 'Hoy en la historia'), run: history},
      {emoji: '🧠', label: tr('Quiz de filmes', 'Movie quiz', 'Quiz de películas'), run: quiz},
      {emoji: '⏳', label: tr('Em breve', 'Coming soon', 'Próximamente'), run: upcoming}
    ]);
  }

  function relax() {
    menu(tr('Diversão', 'Fun', 'Diversión'), [
      {emoji: '📻', label: tr('Rádio do mundo', 'World radio', 'Radio del mundo'), run: radio},
      {emoji: '🔥', label: tr('Lareira', 'Fireplace', 'Chimenea'), run: function () { ambient('fire'); }},
      {emoji: '🐠', label: tr('Aquário', 'Aquarium', 'Acuario'), run: function () { ambient('fish'); }},
      {emoji: '🌧', label: tr('Chuva na janela', 'Rain on the window', 'Lluvia'), run: function () { ambient('rain'); }},
      {emoji: '🔢', label: '2048', sub: tr('Recorde: ', 'Best: ', 'Récord: ') + (stored('best2048') || 0), run: game2048},
      {emoji: '🎬', label: tr('O que ver hoje?', 'What to watch?', '¿Qué ver?'), run: whatToWatch}
    ], 3);
  }

  // MARK: - The genre wheel

  var GENRES = [[28, 'Ação', '#FF6A00'], [35, 'Comédia', '#FFC93C'], [27, 'Terror', '#8B0000'], [878, 'Ficção', '#5B3CC4'],
    [10749, 'Romance', '#FF6F91'], [18, 'Drama', '#2E6B8A'], [53, 'Suspense', '#333A44'], [16, 'Animação', '#29B6F6'],
    [99, 'Documentário', '#3E7C59'], [12, 'Aventura', '#E5A100'], [80, 'Crime', '#5D4037'], [10751, 'Família', '#66BB6A']];

  function wheel() {
    open(function (b) {
      el('div', 'ftitle', b, tr('Roleta de gênero', 'Genre wheel', 'Ruleta de género'));
      var c = el('canvas', 'wheel', b), ctx = c.getContext('2d');
      c.width = c.height = 760;
      el('div', 'pointer', b, '▼');
      var hint = el('div', 'hint', b, tr('OK gira a roleta', 'OK spins the wheel', 'OK gira la ruleta'));
      var angle = 0, spinning = false, raf = 0, n = GENRES.length, seg = Math.PI * 2 / n;
      function draw() {
        ctx.clearRect(0, 0, 760, 760);
        for (var i = 0; i < n; i++) {
          var a0 = angle + i * seg - Math.PI / 2;
          ctx.beginPath();
          ctx.moveTo(380, 380);
          ctx.arc(380, 380, 370, a0, a0 + seg);
          ctx.fillStyle = GENRES[i][2];
          ctx.fill();
          ctx.save();
          ctx.translate(380, 380);
          ctx.rotate(a0 + seg / 2);
          ctx.fillStyle = '#FFF';
          ctx.font = '600 30px Inter, sans-serif';
          ctx.textAlign = 'right';
          ctx.fillText(GENRES[i][1], 340, 10);
          ctx.restore();
        }
        ctx.beginPath();
        ctx.arc(380, 380, 60, 0, Math.PI * 2);
        ctx.fillStyle = '#111';
        ctx.fill();
      }
      draw();
      function spin() {
        if (spinning) return;
        spinning = true;
        hint.textContent = '…';
        var start = angle, total = Math.PI * 2 * (5 + Math.random() * 3), t0 = Date.now(), dur = 5200;
        (function frame() {
          var t = Math.min(1, (Date.now() - t0) / dur), ease = 1 - Math.pow(1 - t, 4);
          angle = start + total * ease;
          draw();
          if (t < 1) { raf = requestAnimationFrame(frame); return; }
          // The segment under the pointer (at the top).
          var at = ((-angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2), g = GENRES[Math.floor(at / seg) % n];
          hint.textContent = g[1] + '! ' + tr('Buscando um título…', 'Finding a title…', 'Buscando…');
          var kind = rnd(3) ? 'movie' : 'tv', gid = kind === 'tv' && g[0] === 878 ? 10765 : kind === 'tv' && g[0] === 28 ? 10759 : g[0];
          if (kind === 'tv' && (gid === 27 || gid === 53 || gid === 10749)) kind = 'movie';
          discover(kind, '&with_genres=' + gid + '&vote_average.gte=6.3&vote_count.gte=150', function (p) { spinning = false; show(p); });
        })();
      }
      return {key: function (k) { if (k === K.ok) { spin(); return true; } return false; }, stop: function () { cancelAnimationFrame(raf); }};
    });
  }

  // MARK: - This or that: 5 duels, the winner stays

  function thisOrThat() {
    open(function (b) {
      loading();
      var pool = [], round = 0, champ = null, rival = null, side = 0;
      Data.ensureFilter(function (filter) {
        var page = 1 + rnd(5), kind = rnd(2) ? 'movie' : 'tv';
        Data.tmdb('/discover/' + kind + '?vote_average.gte=6.8&vote_count.gte=200&page=' + page + filter, function (e, r) {
          (r && r.results || []).forEach(function (o) { var p = Data.newPick(o, kind); if (p) pool.push(p); });
          pool = shuffled(pool);
          if (pool.length < 6) { show(null); return; }
          champ = pool.pop();
          next();
        });
      });
      function next() {
        if (round === 5) { loading(tr('Você escolheu!', 'Your pick!', '¡Elegiste!')); Data.details(champ, function () { show(champ); }); return; }
        rival = pool.pop();
        round++;
        b.innerHTML = '';
        el('div', 'ftitle', b, tr('Esse ou aquele? ', 'This or that? ', '¿Este o aquel? ') + round + '/5');
        var duel = el('div', 'duel', b);
        [champ, rival].forEach(function (p, n) {
          var c = el('div', 'dcard', duel);
          var im = el('div', 'dimg', c);
          im.style.backgroundImage = 'url(' + img(p.backdrop) + ')';
          el('div', 'dname', c, p.title);
          c.onclick = function () { side = n; pick(); };
          c.onmouseover = function () { side = n; focus(); };
        });
        el('div', 'vs', duel, 'VS');
        side = 0;
        focus();
      }
      function focus() { var d = b.querySelectorAll('.dcard'); for (var n = 0; n < d.length; n++) setClass(d[n], 'focus', n === side); }
      function pick() { champ = side === 0 ? champ : rival; next(); }
      return {key: function (k) {
        if (k === K.left) side = 0; else if (k === K.right) side = 1; else if (k === K.ok) { pick(); return true; } else return false;
        focus();
        return true;
      }};
    });
  }

  // MARK: - By running time

  function byTime() {
    var opts = [[90, '1h30'], [120, '2h'], [150, '2h30'], [0, tr('Sem limite', 'No limit', 'Sin límite')]];
    menu(tr('Quanto tempo você tem?', 'How much time do you have?', '¿Cuánto tiempo tienes?'), opts.map(function (o) {
      return {emoji: '⏱', label: o[1], run: function () {
        loading();
        discover('movie', '&vote_average.gte=6.4&vote_count.gte=200' + (o[0] ? '&with_runtime.lte=' + o[0] + '&with_runtime.gte=60' : ''), function (p) {
          if (p && p.runtime) {
            var end = new Date(Date.now() + p.runtime * 60000);
            p.meta = (p.meta ? p.meta + ' · ' : '') + tr('Termina às ', 'Ends at ', 'Termina a las ') + Data.time(end.getTime());
          }
          show(p);
        });
      }};
    }));
  }

  // MARK: - This week's ranking (TMDB's trending, kept to what's on the TV's services)

  function ranking() {
    open(function (b) {
      loading();
      var rows = [['movie', tr('Top filmes da semana', 'Top movies this week', 'Top películas')], ['tv', tr('Top séries da semana', 'Top shows this week', 'Top series')]];
      var lists = [[], []], done = 0, r = 0, c = 0;
      Data.ensureFilter(function (filter) {
        rows.forEach(function (row, n) {
          Data.tmdb('/discover/' + row[0] + '?sort_by=popularity.desc&vote_count.gte=30' + filter.replace('&sort_by=popularity.desc', ''), function (e, res) {
            (res && res.results || []).slice(0, 10).forEach(function (o) { var p = Data.newPick(o, row[0]); if (p && p.poster) lists[n].push(p); });
            if (++done === 2) build();
          });
        });
      });
      function build() {
        b.innerHTML = '';
        el('div', 'ftitle', b, tr('Ranking da semana', "This week's top", 'Ranking semanal'));
        var wrap = el('div', 'rwrap', b);
        rows.forEach(function (row, n) {
          el('div', 'rlabel', wrap, row[1]);
          var strip = el('div', 'rstrip', wrap);
          lists[n].forEach(function (p, i) {
            var it = el('div', 'ritem', strip);
            el('div', 'rnum', it, String(i + 1));
            var pi = el('div', 'rposter', it);
            pi.style.backgroundImage = 'url(' + img(p.poster, 'w342') + ')';
            it.onclick = function () { open1(p); };
          });
        });
        focus();
      }
      function open1(p) { loading(); Data.details(p, function () { show(p); }); }
      function focus() {
        var s = b.querySelectorAll('.rstrip');
        for (var n = 0; n < s.length; n++) {
          for (var m = 0; m < s[n].children.length; m++) setClass(s[n].children[m], 'focus', n === r && m === c);
          var x = Math.max(0, c - 3) * 300;
          s[n].style.webkitTransform = s[n].style.transform = n === r ? 'translateX(' + -x + 'px)' : '';
        }
      }
      return {key: function (k) {
        if (k === K.left) c = Math.max(0, c - 1);
        else if (k === K.right) c = Math.min(lists[r].length - 1, c + 1);
        else if (k === K.up) { r = 0; c = Math.min(c, lists[0].length - 1); }
        else if (k === K.down) { r = 1; c = Math.min(c, lists[1].length - 1); }
        else if (k === K.ok) { if (lists[r][c]) open1(lists[r][c]); return true; }
        else return false;
        focus();
        return true;
      }};
    });
  }

  // MARK: - Today in film history: famous movies released on this day, years ago (cached for the day)

  function historyList(done) {
    var d = new Date(), md = ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2), cache = stored('history');
    if (cache && cache.md === md) { done(cache.list); return; }
    var years = [], out = [];
    for (var y = d.getFullYear() - 1; y >= 1960; y--) years.push(y);
    (function next() {
      if (!years.length) {
        out.sort(function (a, b) { return b.votes - a.votes; });
        out = out.slice(0, 8);
        store('history', {md: md, list: out});
        done(out);
        return;
      }
      var batch = years.splice(0, 6), left = batch.length;
      batch.forEach(function (y) {
        var day = y + '-' + md;
        Data.tmdb('/discover/movie?language=' + I18N.locale() + '&primary_release_date.gte=' + day + '&primary_release_date.lte=' + day
            + '&sort_by=vote_count.desc&vote_count.gte=1500', function (e, r) {
          (r && r.results || []).slice(0, 2).forEach(function (o) {
            var p = Data.newPick(o, 'movie');
            if (p) { p.year = y; p.votes = o.vote_count; out.push(p); }
          });
          if (--left === 0) next();
        });
      });
    })();
  }

  function history() {
    open(function (b) {
      loading(tr('Abrindo o arquivo do cinema…', 'Opening the film archive…', 'Abriendo el archivo…'));
      var list = [], i = 0;
      historyList(function (l) {
        list = l;
        b.innerHTML = '';
        el('div', 'ftitle', b, tr('Hoje na história do cinema', 'On this day in film', 'Hoy en la historia del cine'));
        if (!list.length) { el('div', 'loading', b, tr('Nenhum clássico estreou hoje', 'No classics premiered today', 'Ningún clásico hoy')); return; }
        var strip = el('div', 'hstrip', b);
        list.forEach(function (p) {
          var it = el('div', 'hitem', strip);
          var im = el('div', 'himg', it);
          im.style.backgroundImage = 'url(' + img(p.backdrop) + ')';
          el('div', 'hyear', it, (new Date().getFullYear() - p.year) + tr(' anos', ' years ago', ' años'));
          el('div', 'hname', it, p.title + ' (' + p.year + ')');
        });
        focus();
      });
      function focus() {
        var s = b.querySelector('.hstrip');
        if (!s) return;
        for (var n = 0; n < s.children.length; n++) setClass(s.children[n], 'focus', n === i);
        s.style.webkitTransform = s.style.transform = 'translateX(' + -Math.max(0, i - 2) * 560 + 'px)';
      }
      return {key: function (k) {
        if (k === K.left) i = Math.max(0, i - 1);
        else if (k === K.right) i = Math.min(list.length - 1, i + 1);
        else if (k === K.ok) { var p = list[i]; if (p) { loading(); Data.details(p, function () { close(); H.openDetail(p); }); } return true; }
        else return false;
        focus();
        return true;
      }};
    });
  }

  // MARK: - Movie quiz: a still, blurred then clearer; 4 answers; 5 rounds

  function quiz() {
    open(function (b) {
      loading();
      var pool = [], round = 0, points = 0, answer = 0, choice = 0, opts = [], timer = 0, t0 = 0, locked = false;
      Data.tmdb('/movie/top_rated?language=' + I18N.locale() + '&page=' + (1 + rnd(5)), function (e, r) {
        (r && r.results || []).forEach(function (o) { var p = Data.newPick(o, 'movie'); if (p) pool.push(p); });
        Data.tmdb('/movie/popular?language=' + I18N.locale() + '&page=' + (1 + rnd(3)), function (e2, r2) {
          (r2 && r2.results || []).forEach(function (o) { var p = Data.newPick(o, 'movie'); if (p) pool.push(p); });
          pool = shuffled(pool);
          next();
        });
      });
      function next() {
        clearInterval(timer);
        if (round === 5 || pool.length < 4) {
          b.innerHTML = '';
          el('div', 'ftitle', b, tr('Fim do quiz', 'Quiz over', 'Fin del quiz'));
          el('div', 'qscore', b, points + ' / 5');
          var best = Math.max(points, stored('quizBest') || 0);
          store('quizBest', best);
          el('div', 'hint', b, tr('Recorde: ', 'Best: ', 'Récord: ') + best + ' · ' + tr('OK joga de novo', 'OK plays again', 'OK juega otra vez'));
          locked = true;
          return;
        }
        round++;
        locked = false;
        opts = pool.splice(0, 4);
        answer = rnd(4);
        choice = 0;
        b.innerHTML = '';
        el('div', 'ftitle', b, tr('Que filme é esse? ', 'Which movie? ', '¿Qué película es? ') + round + '/5 · ' + points + ' ' + tr('pts', 'pts', 'pts'));
        var still = el('div', 'qimg', b);
        still.style.backgroundImage = 'url(' + img(opts[answer].backdrop, 'w1280') + ')';
        var row = el('div', 'qopts', b);
        opts.forEach(function (p, n) {
          var o = el('div', 'qopt', row, p.title);
          o.onclick = function () { choice = n; reply(); };
        });
        t0 = Date.now();
        // The picture sharpens over 12 s.
        timer = setInterval(function () {
          var t = Math.min(1, (Date.now() - t0) / 12000), blur = Math.round(40 * (1 - t));
          still.style.webkitFilter = still.style.filter = 'blur(' + blur + 'px)';
        }, 200);
        still.style.webkitFilter = still.style.filter = 'blur(40px)';
        focus();
      }
      function focus() { var o = b.querySelectorAll('.qopt'); for (var n = 0; n < o.length; n++) setClass(o[n], 'focus', n === choice); }
      function reply() {
        if (locked) { round = 0; points = 0; next(); return; }
        locked = true;
        clearInterval(timer);
        var o = b.querySelectorAll('.qopt'), still = b.querySelector('.qimg');
        still.style.webkitFilter = still.style.filter = 'none';
        setClass(o[answer], 'right', true);
        if (choice === answer) points++; else setClass(o[choice], 'wrong', true);
        setTimeout(next, 2200);
      }
      return {key: function (k) {
        if (k === K.left) choice = Math.max(0, choice - 1);
        else if (k === K.right) choice = Math.min(3, choice + 1);
        else if (k === K.ok) { reply(); return true; }
        else return false;
        focus();
        return true;
      }, stop: function () { clearInterval(timer); }};
    });
  }

  // MARK: - Coming soon: premieres to count down

  function upcoming() {
    open(function (b) {
      loading();
      var list = [], i = 0;
      Data.tmdb('/movie/upcoming?language=' + I18N.locale() + '&region=' + (CONFIG.tmdbRegion || 'BR'), function (e, r) {
        (r && r.results || []).forEach(function (o) { var p = Data.newPick(o, 'movie'); if (p && p.released > Data.day(0)) list.push(p); });
        list.sort(function (a, c) { return a.released < c.released ? -1 : 1; });
        b.innerHTML = '';
        el('div', 'ftitle', b, tr('Em breve nos cinemas', 'Coming soon', 'Próximamente'));
        var strip = el('div', 'hstrip', b);
        list.slice(0, 12).forEach(function (p) {
          var it = el('div', 'hitem', strip);
          var im = el('div', 'himg', it);
          im.style.backgroundImage = 'url(' + img(p.backdrop) + ')';
          el('div', 'hyear', it, Data.date(p.released));
          el('div', 'hname', it, p.title);
        });
        el('div', 'hint', b, tr('OK abre · na ficha, “Avisar estreia” conta os dias na ilha', 'OK opens', 'OK abre'));
        focus();
      });
      function focus() {
        var s = b.querySelector('.hstrip');
        if (!s) return;
        for (var n = 0; n < s.children.length; n++) setClass(s.children[n], 'focus', n === i);
        s.style.webkitTransform = s.style.transform = 'translateX(' + -Math.max(0, i - 2) * 560 + 'px)';
      }
      return {key: function (k) {
        if (k === K.left) i = Math.max(0, i - 1);
        else if (k === K.right) i = Math.min(Math.min(list.length, 12) - 1, i + 1);
        else if (k === K.ok) { var p = list[i]; if (p) { close(); H.openDetail(p); } return true; }
        else return false;
        focus();
        return true;
      }};
    });
  }

  /** The nearest premiere on the island: "Duna 3 em 12 dias", "Estreia hoje". */
  function premieres() {
    var list = Plus.premieres().filter(function (x) { return x.date >= Data.day(0); });
    list.sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    var p = list[0];
    if (!p) { More.island.set('premiere', null); return; }
    var m = /^(\d+)-(\d+)-(\d+)/.exec(p.date), d = new Date(+m[1], m[2] - 1, +m[3]), now = new Date();
    now.setHours(0, 0, 0, 0);
    var days = Math.round((d - now) / 86400000);
    var text = days === 0 ? tr('Estreia hoje: ', 'Out today: ', 'Estreno hoy: ') + p.title : p.title + ' ' + tr('em ', 'in ', 'en ') + days + (days === 1 ? tr(' dia', ' day', ' día') : tr(' dias', ' days', ' días'));
    More.island.set('premiere', {priority: 0.5, icon: '🎟', text: text, big: {title: text, sub: Data.date(p.date)}});
    if (days === 0 && stored('premiereFlash') !== p.key) { store('premiereFlash', p.key); More.island.flash('premiere', {icon: '🍿', text: text, big: {title: text, sub: tr('Hoje!', 'Today!', '¡Hoy!')}}, 10000); }
  }

  // MARK: - World radio: a dotted globe of stations; turn it with the arrows, the station in front plays

  var audio = null, playingStation = null;

  function radio() {
    open(function (b) {
      el('div', 'ftitle', b, tr('Rádio do mundo', 'World radio', 'Radio del mundo'));
      var c = el('canvas', 'globe', b), ctx = c.getContext('2d');
      c.width = c.height = 820;
      var now = el('div', 'rnow', b, tr('Carregando estações…', 'Loading stations…', 'Cargando…'));
      el('div', 'hint', b, tr('Setas giram o globo · OK toca · Voltar sai (a rádio continua)', 'Arrows turn the globe · OK plays · Back leaves (keeps playing)', 'Flechas giran · OK toca'));
      var stations = stored('stations') || [], lon = -47, lat = -15, target = null, raf = 0;
      function load() {
        if (stations.length) { draw(); return; }
        var x = new XMLHttpRequest();
        x.open('GET', 'https://de1.api.radio-browser.info/json/stations/search?has_geo_info=true&order=clickcount&reverse=true&limit=700&hidebroken=true', true);
        x.onload = function () {
          try {
            JSON.parse(x.responseText).forEach(function (s) {
              if (s.geo_lat === null || !s.url_resolved) return;
              stations.push({n: s.name.trim().slice(0, 40), u: s.url_resolved, la: s.geo_lat, lo: s.geo_long, c: s.country, t: (s.tags || '').split(',')[0]});
            });
            store('stations', stations);
          } catch (e) {}
          draw();
        };
        x.onerror = function () { now.textContent = tr('Sem conexão com as rádios', 'No connection to the stations', 'Sin conexión'); };
        x.send();
      }
      function project(la, lo) {
        var r = Math.PI / 180, phi = la * r, lam = (lo - lon) * r, phi0 = lat * r;
        var cosc = Math.sin(phi0) * Math.sin(phi) + Math.cos(phi0) * Math.cos(phi) * Math.cos(lam);
        return {x: 410 + 380 * Math.cos(phi) * Math.sin(lam), y: 410 - 380 * (Math.cos(phi0) * Math.sin(phi) - Math.sin(phi0) * Math.cos(phi) * Math.cos(lam)), front: cosc};
      }
      function draw() {
        ctx.clearRect(0, 0, 820, 820);
        var g = ctx.createRadialGradient(330, 300, 60, 410, 410, 400);
        g.addColorStop(0, '#1E3A5F');
        g.addColorStop(1, '#050B16');
        ctx.beginPath();
        ctx.arc(410, 410, 380, 0, Math.PI * 2);
        ctx.fillStyle = g;
        ctx.fill();
        // Graticule
        ctx.strokeStyle = 'rgba(120, 170, 255, 0.12)';
        ctx.lineWidth = 1;
        for (var la = -60; la <= 60; la += 30) { ctx.beginPath(); for (var lo = -180; lo <= 180; lo += 5) { var q = project(la, lo); if (q.front > 0) ctx.lineTo(q.x, q.y); else ctx.moveTo(q.x, q.y); } ctx.stroke(); }
        for (var lo2 = -180; lo2 < 180; lo2 += 30) { ctx.beginPath(); for (var la2 = -90; la2 <= 90; la2 += 5) { var q2 = project(la2, lo2); if (q2.front > 0) ctx.lineTo(q2.x, q2.y); else ctx.moveTo(q2.x, q2.y); } ctx.stroke(); }
        // Stations; the one nearest the center is the target
        var best = null, bd = 1e9;
        for (var i = 0; i < stations.length; i++) {
          var s = stations[i], p = project(s.la, s.lo);
          if (p.front <= 0) continue;
          var dd = (p.x - 410) * (p.x - 410) + (p.y - 410) * (p.y - 410);
          if (dd < bd) { bd = dd; best = s; }
          ctx.fillStyle = s === playingStation ? '#1ED760' : 'rgba(255, 210, 120, ' + (0.35 + 0.6 * p.front) + ')';
          ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
        }
        target = bd < 60 * 60 ? best : null;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(410, 410, 18, 0, Math.PI * 2);
        ctx.stroke();
        now.textContent = target ? '📍 ' + target.n + ' · ' + target.c + (target.t ? ' · ' + target.t : '') : (playingStation ? '▶ ' + playingStation.n : tr('Gire até uma estação', 'Turn to a station', 'Gira hasta una estación'));
      }
      load();
      function turn(dlon, dlat) {
        lon = ((lon + dlon + 540) % 360) - 180;
        lat = Math.max(-70, Math.min(70, lat + dlat));
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(draw);
      }
      return {key: function (k) {
        if (k === K.left) turn(-6, 0);
        else if (k === K.right) turn(6, 0);
        else if (k === K.up) turn(0, 5);
        else if (k === K.down) turn(0, -5);
        else if (k === K.ok) { if (target) play(target); else if (playingStation) stopRadio(); draw(); }
        else return false;
        return true;
      }, stop: function () { cancelAnimationFrame(raf); }};
    });
  }

  function play(s) {
    stopAmbient();
    if (!audio) audio = new Audio();
    audio.src = s.u;
    audio.play();
    playingStation = s;
    More.island.set('radio', {priority: 1.5, icon: '📻', text: s.n, sub: s.c, right: 'eq', big: {title: s.n, sub: s.c + (s.t ? ' · ' + s.t : '')}});
    More.island.flash('radio', {icon: '📻', text: s.n, big: {title: s.n, sub: s.c}}, 5000);
  }

  function stopRadio() {
    if (audio) { audio.pause(); audio.src = ''; }
    playingStation = null;
    More.island.set('radio', null);
  }

  // MARK: - Ambient scenes, drawn and voiced here (no videos to fetch)

  var amb = null;   // {raf, ctx (audio)}

  function noise(ctx, seconds) {
    var len = ctx.sampleRate * seconds, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0), last = 0;
    for (var i = 0; i < len; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 3.5; }
    var src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    return src;
  }

  function ambient(kind) {
    stopRadio();
    open(function (b) {
      setClass(b, 'ambient', true);
      var c = el('canvas', 'scene', b), g = c.getContext('2d'), W = 1920, Hh = 1080;
      c.width = W / 2;
      c.height = Hh / 2;
      g.scale(0.5, 0.5);
      var A = window.AudioContext || window.webkitAudioContext, actx = null;
      try {
        actx = new A();
        var src = noise(actx, 4), f = actx.createBiquadFilter(), gain = actx.createGain();
        f.type = kind === 'fish' ? 'lowpass' : kind === 'fire' ? 'bandpass' : 'highpass';
        f.frequency.value = kind === 'fish' ? 300 : kind === 'fire' ? 600 : 1200;
        gain.gain.value = kind === 'fish' ? 0.25 : 0.35;
        src.connect(f); f.connect(gain); gain.connect(actx.destination);
        src.start();
        if (kind === 'fire') setTimeout(function () { crackle(actx); }, 200);
      } catch (e) {}
      var t = 0, parts = [], raf = 0;
      if (kind === 'fish') for (var i = 0; i < 14; i++) parts.push({x: Math.random() * W, y: 200 + Math.random() * 700, v: 0.6 + Math.random() * 1.6, s: 0.6 + Math.random() * 1.2, h: [18, 200, 330, 45, 280][i % 5], d: Math.random() < 0.5 ? -1 : 1});
      if (kind === 'rain') for (var j = 0; j < 160; j++) parts.push({x: Math.random() * W, y: Math.random() * Hh, r: 2 + Math.random() * 6, v: 0.3 + Math.random() * 2});
      function frame() {
        t += 1;
        if (kind === 'fire') {
          g.fillStyle = '#0A0503'; g.fillRect(0, 0, W, Hh);
          for (var k = 0; k < 90; k++) {
            var fx = 560 + Math.random() * 800, life = Math.random(), fy = 900 - life * 520 * (1 - Math.abs(fx - 960) / 520);
            var rad = 50 * (1 - life) + 10, gr = g.createRadialGradient(fx, fy, 0, fx, fy, rad);
            gr.addColorStop(0, 'rgba(255,' + Math.round(200 * (1 - life)) + ',60,0.5)');
            gr.addColorStop(1, 'rgba(255,60,0,0)');
            g.fillStyle = gr; g.beginPath(); g.arc(fx, fy, rad, 0, Math.PI * 2); g.fill();
          }
          g.fillStyle = '#2B1608'; g.fillRect(560, 900, 800, 60); g.fillRect(620, 940, 680, 50);
        } else if (kind === 'fish') {
          var sea = g.createLinearGradient(0, 0, 0, Hh);
          sea.addColorStop(0, '#0B4F6C'); sea.addColorStop(1, '#021E2F');
          g.fillStyle = sea; g.fillRect(0, 0, W, Hh);
          for (var r = 0; r < 6; r++) { g.fillStyle = 'rgba(255,255,255,0.03)'; g.beginPath(); g.moveTo(200 + r * 300 + Math.sin(t / 90 + r) * 60, 0); g.lineTo(320 + r * 300, 0); g.lineTo(100 + r * 300, Hh); g.lineTo(0 + r * 300, Hh); g.fill(); }
          parts.forEach(function (p) {
            p.x += p.v * p.d; if (p.x > W + 100) p.x = -100; if (p.x < -100) p.x = W + 100;
            var y = p.y + Math.sin(t / 40 + p.x / 200) * 12;
            g.save(); g.translate(p.x, y); g.scale(p.d * p.s, p.s);
            g.fillStyle = 'hsl(' + p.h + ',85%,60%)';
            g.beginPath(); g.ellipse(0, 0, 40, 18, 0, 0, Math.PI * 2); g.fill();
            g.beginPath(); g.moveTo(-34, 0); g.lineTo(-62, -18); g.lineTo(-62, 18); g.fill();
            g.fillStyle = '#000'; g.beginPath(); g.arc(22, -4, 3, 0, Math.PI * 2); g.fill();
            g.restore();
          });
          g.fillStyle = '#3B2F1E'; g.fillRect(0, 1020, W, 60);
        } else {
          var sky = g.createLinearGradient(0, 0, 0, Hh);
          sky.addColorStop(0, '#1B2735'); sky.addColorStop(1, '#090A0F');
          g.fillStyle = sky; g.fillRect(0, 0, W, Hh);
          for (var w = 0; w < 30; w++) { g.fillStyle = 'rgba(255,200,120,' + (0.05 + (w % 5) * 0.03) + ')'; g.fillRect((w * 137) % W, 600 + (w * 53) % 300, 14, 20); }
          parts.forEach(function (p) {
            p.y += p.v; if (p.y > Hh + 20) { p.y = -20; p.x = Math.random() * W; }
            g.fillStyle = 'rgba(200,220,255,0.35)'; g.beginPath(); g.arc(p.x, p.y, p.r, 0, Math.PI * 2); g.fill();
            g.fillStyle = 'rgba(255,255,255,0.5)'; g.beginPath(); g.arc(p.x - p.r / 3, p.y - p.r / 3, p.r / 3, 0, Math.PI * 2); g.fill();
          });
        }
        raf = requestAnimationFrame(frame);
      }
      frame();
      amb = {raf: raf, ctx: actx};
      return {key: function () { return false; }, stop: function () { cancelAnimationFrame(raf); stopAmbient(); }};
    });
  }

  function crackle(ctx) {
    (function pop() {
      if (!amb || amb.ctx !== ctx) return;
      try {
        var s = noise(ctx, 0.05), g = ctx.createGain();
        s.loop = false;
        g.gain.value = 0.2 + Math.random() * 0.4;
        s.connect(g); g.connect(ctx.destination); s.start();
      } catch (e) { return; }
      setTimeout(pop, 80 + Math.random() * 700);
    })();
  }

  function stopAmbient() {
    if (!amb) return;
    try { amb.ctx.close(); } catch (e) {}
    amb = null;
  }

  // MARK: - 2048

  function game2048() {
    open(function (b) {
      var grid = [], score = 0, best = stored('best2048') || 0, over = false;
      el('div', 'ftitle', b, '2048');
      var info = el('div', 'g2info', b);
      var board = el('div', 'g2board', b);
      el('div', 'hint', b, tr('Setas jogam · OK recomeça', 'Arrows play · OK restarts', 'Flechas juegan · OK reinicia'));
      function reset() { grid = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]; score = 0; over = false; add(); add(); render(); }
      function add() {
        var free = [];
        for (var i = 0; i < 16; i++) if (!grid[i]) free.push(i);
        if (free.length) grid[free[rnd(free.length)]] = Math.random() < 0.9 ? 2 : 4;
      }
      function line(idx) {
        var vals = idx.map(function (i) { return grid[i]; }).filter(function (v) { return v; }), out = [];
        for (var i = 0; i < vals.length; i++) {
          if (vals[i] === vals[i + 1]) { out.push(vals[i] * 2); score += vals[i] * 2; i++; } else out.push(vals[i]);
        }
        while (out.length < 4) out.push(0);
        var moved = false;
        idx.forEach(function (i, n) { if (grid[i] !== out[n]) moved = true; grid[i] = out[n]; });
        return moved;
      }
      function move(dir) {
        if (over) return;
        var moved = false;
        for (var r = 0; r < 4; r++) {
          var idx = [];
          for (var c = 0; c < 4; c++) {
            idx.push(dir === 'left' ? r * 4 + c : dir === 'right' ? r * 4 + 3 - c : dir === 'up' ? c * 4 + r : (3 - c) * 4 + r);
          }
          if (line(idx)) moved = true;
        }
        if (moved) add();
        if (score > best) { best = score; store('best2048', best); }
        over = !canMove();
        render();
      }
      function canMove() {
        for (var i = 0; i < 16; i++) {
          if (!grid[i]) return true;
          if (i % 4 < 3 && grid[i] === grid[i + 1]) return true;
          if (i < 12 && grid[i] === grid[i + 4]) return true;
        }
        return false;
      }
      function render() {
        info.textContent = tr('Pontos ', 'Score ', 'Puntos ') + score + '   ·   ' + tr('Recorde ', 'Best ', 'Récord ') + best + (over ? '   ·   ' + tr('Fim! OK recomeça', 'Game over! OK restarts', '¡Fin!') : '');
        board.innerHTML = '';
        grid.forEach(function (v) {
          var cell = el('div', 'g2cell v' + Math.min(v, 4096), board, v ? String(v) : '');
          if (v >= 1024) cell.style.fontSize = '48px';
        });
      }
      reset();
      return {key: function (k) {
        if (k === K.left) move('left'); else if (k === K.right) move('right'); else if (k === K.up) move('up'); else if (k === K.down) move('down');
        else if (k === K.ok) reset();
        else return false;
        return true;
      }};
    });
  }

  // MARK: - Start

  premieres();
  setInterval(premieres, 10 * 60000);
  Plus.onChange(premieres);

  return {
    whatToWatch: whatToWatch,
    stopRadio: stopRadio,
    relax: relax,
    isOpen: function () { return !!screen; },
    /** A key while Fun is open: Back closes it, the rest goes to the screen. Always handled while open. */
    key: function (k) {
      if (!screen) return false;
      if (k === K.back || k === 27 || k === 8) { close(); return true; }
      if (screen.key) screen.key(k);
      return true;
    }
  };
})();
