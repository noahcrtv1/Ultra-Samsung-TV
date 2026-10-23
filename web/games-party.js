/*
 * Party games with phones (through the hub): the TV hosts, everyone plays from their phone at <hub>/party.
 *  Group quiz: a movie still, 4 titles on each phone, points for the right one.
 *  Draw and guess: one phone draws a movie title, the drawing shows on the TV live, the others type guesses.
 */
(function () {
  'use strict';

  var F = Fun.api, H = window.Home, el = H.el, setClass = H.setClass, K = TV.keys, U = Games.util;
  var rnd = F.rnd, shuffled = F.shuffled;

  function call(path, body, done) {
    var x = new XMLHttpRequest();
    x.open(body ? 'POST' : 'GET', Plus.hubUrl(path), true);
    x.timeout = 4000;
    if (body) x.setRequestHeader('Content-Type', 'application/json');
    x.onload = function () { try { if (done) done(JSON.parse(x.responseText)); } catch (e) { if (done) done(null); } };
    x.onerror = x.ontimeout = function () { if (done) done(null); };
    x.send(body ? JSON.stringify(body) : null);
  }

  function needsHub() {
    if (Plus.hubUrl('/')) return false;
    H.toast(tr('Jogos em grupo precisam do Hub aberto no computador', 'Group games need the hub on your computer', 'Necesita el Hub'));
    return true;
  }

  function scoreboard(parent, players, highlight) {
    var list = el('div', 'pscore', parent);
    Object.keys(players || {}).map(function (n) { return [n, players[n].score || 0]; }).sort(function (a, b) { return b[1] - a[1]; })
      .forEach(function (p, i) {
        var r = el('div', 'prow' + (highlight && highlight[p[0]] ? ' got' : ''), list);
        el('span', 'pn', r, (i === 0 && p[1] ? '👑 ' : '') + p[0]);
        el('span', 'pp', r, String(p[1]));
      });
    return list;
  }

  /** The lobby: the address for phones, who has joined; OK starts with done(players). */
  function lobby(b, title, min, done) {
    var timer = 0, players = {}, stopped = false;
    call('/api/party/host', {mode: null, reset: true});
    function draw() {
      b.innerHTML = '';
      el('div', 'ftitle', b, title);
      el('div', 'plink', b, tr('No celular, abra ', 'On your phone, open ', 'En el celular, abre ') + Plus.hubUrl('/party').replace(/^https?:\/\//, ''));
      el('div', 'psub', b, tr('Mesmo Wi-Fi da TV. Cada um digita o nome e entra.', 'Same Wi-Fi as the TV. Everyone types a name and joins.', 'Misma Wi-Fi.'));
      scoreboard(b, players);
      var n = Object.keys(players).length;
      U.hint(b, n >= min ? tr('OK começa com ', 'OK starts with ', 'OK empieza con ') + n + tr(' jogador(es)', ' player(s)', ' jugador(es)') : tr('Esperando jogadores…', 'Waiting for players…', 'Esperando…'));
    }
    (function poll() {
      call('/api/party/tv', null, function (s) {
        if (stopped) return;   // an answer that arrives after the game started
        if (s && JSON.stringify(s.players) !== JSON.stringify(players)) { players = s.players || {}; draw(); }
        timer = setTimeout(poll, 1000);
      });
    })();
    draw();
    return {key: function (k) {
      if (k === K.ok && Object.keys(players).length >= min) { stopped = true; clearTimeout(timer); done(players); }
      return true;
    }, stop: function () { stopped = true; clearTimeout(timer); }};
  }

  // MARK: - Group quiz

  function groupQuiz() {
    if (needsHub()) return;
    F.open(function (b) {
      var screen = lobby(b, tr('Quiz em grupo', 'Group quiz', 'Quiz en grupo'), 1, start), timer = 0, poll = 0;
      var stills = [], players, round = 0, ROUNDS = 6, answer, opts, ends;
      Data.tmdb('/movie/popular?language=' + I18N.locale() + '&page=' + (1 + rnd(4)), function (e, r) {
        (r && r.results || []).forEach(function (o) { if (o.backdrop_path) stills.push(o); });
        Data.tmdb('/movie/top_rated?language=' + I18N.locale() + '&page=' + (1 + rnd(6)), function (e2, r2) {
          (r2 && r2.results || []).forEach(function (o) { if (o.backdrop_path) stills.push(o); });
          stills = shuffled(stills);
        });
      });
      function start(p) { screen.stop(); players = p; next(); }
      function next() {
        clearTimeout(timer); clearTimeout(poll);
        if (round === ROUNDS || stills.length < 4) return podium();
        round++;
        opts = stills.splice(0, 4); answer = rnd(4);
        var q = {text: tr('Que filme é esse?', 'Which movie is this?', '¿Qué película es?'), options: opts.map(function (o) { return o.title; })};
        call('/api/party/host', {mode: 'quiz', round: round, question: q, players: players});
        ends = Date.now() + 20000;
        b.innerHTML = '';
        el('div', 'ftitle', b, tr('Rodada ', 'Round ', 'Ronda ') + round + '/' + ROUNDS);
        var still = el('div', 'qimg', b);
        still.style.backgroundImage = 'url(' + F.img(opts[answer].backdrop_path, 'w1280') + ')';
        var row = el('div', 'qopts', b);
        opts.forEach(function (o) { el('div', 'qopt', row, o.title); });
        var clock = el('div', 'pclock', b, '20'), who = el('div', 'pwho', b, '');
        (function tick() {
          call('/api/party/tv', null, function (s) {
            var answered = s ? Object.keys(s.answers || {}) : [], total = Object.keys(players).length, left = Math.max(0, Math.ceil((ends - Date.now()) / 1000));
            clock.textContent = left;
            who.textContent = answered.length + '/' + total + tr(' responderam', ' answered', ' respondieron');
            if (left === 0 || (answered.length >= total && total)) reveal(s ? s.answers : {});
            else poll = setTimeout(tick, 700);
          });
        })();
      }
      function reveal(answers) {
        var o = b.querySelectorAll('.qopt'), got = {};
        setClass(o[answer], 'right', true);
        Object.keys(answers || {}).forEach(function (n) { if (answers[n] === answer && players[n]) { players[n].score = (players[n].score || 0) + 100; got[n] = true; } });
        call('/api/party/scores', {players: players});
        call('/api/party/host', {mode: null, round: round, players: players});
        var sb = scoreboard(b, players, got);
        setClass(sb, 'side', true);
        timer = setTimeout(next, 4500);
      }
      function podium() {
        call('/api/party/host', {mode: null, players: players});
        b.innerHTML = '';
        el('div', 'ftitle', b, tr('Resultado', 'Results', 'Resultado'));
        scoreboard(b, players);
        U.hint(b, tr('OK joga de novo', 'OK plays again', 'OK otra vez'));
        round = -1;
      }
      return {key: function (k) {
        if (round === 0) return screen.key(k);
        if (round === -1 && k === K.ok) groupQuiz();
        return true;
      }, stop: function () { clearTimeout(timer); clearTimeout(poll); screen.stop(); call('/api/party/host', {mode: null}); }};
    });
  }

  // MARK: - Draw and guess

  function drawGuess() {
    if (needsHub()) return;
    F.open(function (b) {
      var screen = lobby(b, tr('Desenhe e adivinhe', 'Draw and guess', 'Dibuja y adivina'), 2, start), poll = 0, timer = 0;
      var words = [], players, order, round = 0, word, drawn = 0, ends, c, g, seen = 0;
      Data.tmdb('/movie/popular?language=' + I18N.locale() + '&page=' + (1 + rnd(3)), function (e, r) {
        words = shuffled((r && r.results || []).map(function (o) { return o.title; }).filter(function (t) { return t.length <= 22; }));
      });
      function start(p) { screen.stop(); players = p; order = shuffled(Object.keys(players)); next(); }
      function next() {
        clearTimeout(poll); clearTimeout(timer);
        if (round >= order.length * 2 || !words.length) return podium();
        var drawer = order[round % order.length];
        round++;
        word = words.pop();
        call('/api/party/host', {mode: 'draw', round: round, drawer: drawer, word: word, players: players});
        ends = Date.now() + 75000; seen = 0;
        b.innerHTML = '';
        el('div', 'ftitle', b, drawer + tr(' está desenhando…', ' is drawing…', ' está dibujando…'));
        c = U.canvas(b, 1120, 700, 'board'); g = c.getContext('2d');
        c.style.top = '180px'; c.style.left = '110px';
        g.fillStyle = '#FFF'; g.fillRect(0, 0, 1120, 700);
        el('div', 'phint', b, word.replace(/[^\s]/g, '_ ').trim());
        var side = el('div', 'pguess', b), clock = el('div', 'pclock', b, '75');
        (function tick() {
          call('/api/party/tv', null, function (s) {
            if (s) {
              if (s.strokes.length < drawn) { g.fillStyle = '#FFF'; g.fillRect(0, 0, 1120, 700); drawn = 0; }
              s.strokes.slice(drawn).forEach(function (st) {
                g.strokeStyle = st.c; g.lineWidth = st.w * 1.4; g.lineCap = 'round'; g.lineJoin = 'round';
                g.beginPath();
                st.p.forEach(function (q, i) { if (i) g.lineTo(q[0] * 1120, q[1] * 700); else g.moveTo(q[0] * 1120, q[1] * 700); });
                g.stroke();
              });
              drawn = s.strokes.length;
              var winner = null;
              s.guesses.slice(seen).forEach(function (q) {
                var ok = U.plain(q.text).replace(/[^a-z0-9]/g, '') === U.plain(word).replace(/[^a-z0-9]/g, '');
                el('div', 'pg' + (ok ? ' ok' : ''), side, q.name + ': ' + (ok ? '✅ ' + tr('acertou!', 'got it!', '¡acertó!') : q.text));
                if (ok && !winner) winner = q.name;
              });
              seen = s.guesses.length;
              while (side.children.length > 12) side.removeChild(side.firstChild);
              var left = Math.max(0, Math.ceil((ends - Date.now()) / 1000));
              clock.textContent = left;
              if (winner || left === 0) return reveal(winner, drawer);
            }
            poll = setTimeout(tick, 700);
          });
        })();
      }
      function reveal(winner, drawer) {
        if (winner) { players[winner].score = (players[winner].score || 0) + 100; players[drawer].score = (players[drawer].score || 0) + 50; }
        call('/api/party/host', {mode: null, round: round, players: players});
        b.querySelector('.phint').textContent = word;
        var got = {}; if (winner) { got[winner] = true; got[drawer] = true; }
        setClass(scoreboard(b, players, got), 'side', true);
        timer = setTimeout(next, 5000);
      }
      function podium() {
        call('/api/party/host', {mode: null, players: players});
        b.innerHTML = '';
        el('div', 'ftitle', b, tr('Resultado', 'Results', 'Resultado'));
        scoreboard(b, players);
        U.hint(b, tr('OK joga de novo', 'OK plays again', 'OK otra vez'));
        round = -1;
      }
      return {key: function (k) {
        if (round === 0) return screen.key(k);
        if (round === -1 && k === K.ok) drawGuess();
        return true;
      }, stop: function () { clearTimeout(poll); clearTimeout(timer); screen.stop(); call('/api/party/host', {mode: null}); }};
    });
  }

  Games.add('🙋', tr('Quiz em grupo', 'Group quiz', 'Quiz en grupo'), groupQuiz);
  Games.add('✏️', tr('Desenhe e adivinhe', 'Draw and guess', 'Dibuja y adivina'), drawGuess);
})();
