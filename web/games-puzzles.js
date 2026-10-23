/* Puzzles for the Games menu: Memory (movie posters), Sudoku, Solitaire (Klondike). */
(function () {
  'use strict';

  var F = Fun.api, H = window.Home, el = H.el, setClass = H.setClass, K = TV.keys, U = Games.util;
  var rnd = F.rnd, shuffled = F.shuffled;

  // MARK: - Memory: 8 pairs of posters, face down; OK flips

  function memory() {
    F.open(function (b) {
      el('div', 'ftitle', b, tr('Memória', 'Memory', 'Memoria'));
      F.loading();
      var cards = [], cur = 0, open = [], moves = 0, pairs = 0, lock = false, t0 = 0;
      Data.tmdb('/movie/popular?language=' + I18N.locale() + '&page=' + (1 + rnd(5)), function (e, r) {
        var posters = shuffled((r && r.results || []).filter(function (o) { return o.poster_path; })).slice(0, 8);
        if (posters.length < 8) { F.show(null); return; }
        shuffled(posters.concat(posters)).forEach(function (o) { cards.push({poster: o.poster_path, title: o.title, up: false, done: false}); });
        build();
      });
      var grid;
      function build() {
        b.innerHTML = '';
        el('div', 'ftitle', b, tr('Memória', 'Memory', 'Memoria'));
        grid = el('div', 'mgrid', b);
        cards.forEach(function (cd) {
          var c = el('div', 'mcard', grid), inner = el('div', 'minner', c);
          el('div', 'mback', inner, '🎬');
          var front = el('div', 'mfront', inner);
          front.style.backgroundImage = 'url(' + F.img(cd.poster, 'w342') + ')';
          cd.el = c;
        });
        t0 = Date.now();
        render();
      }
      function render() {
        cards.forEach(function (cd, i) { setClass(cd.el, 'up', cd.up || cd.done); setClass(cd.el, 'done', cd.done); setClass(cd.el, 'focus', i === cur); });
        var secs = Math.round((Date.now() - t0) / 1000);
        U.info(b, tr('Jogadas ', 'Moves ', 'Jugadas ') + moves + '  ·  ' + tr('Pares ', 'Pairs ', 'Pares ') + pairs + '/8'
          + (pairs === 8 ? '  ·  ' + tr('Completou em ', 'Done in ', 'Completado en ') + secs + 's! ' + tr('OK joga de novo', 'OK plays again', 'OK otra vez') : ''));
      }
      function flip() {
        var cd = cards[cur];
        if (lock || !cd || cd.up || cd.done) return;
        cd.up = true; open.push(cd);
        if (open.length === 2) {
          moves++;
          lock = true;
          setTimeout(function () {
            if (open[0].poster === open[1].poster) { open[0].done = open[1].done = true; pairs++; if (pairs === 8) U.best('memory', Math.max(1, 100 - moves)); }
            else { open[0].up = open[1].up = false; }
            open = []; lock = false; render();
          }, 900);
        }
        render();
      }
      return {key: function (k) {
        if (!grid) return true;
        if (k === K.left) cur = Math.max(0, cur - 1);
        else if (k === K.right) cur = Math.min(15, cur + 1);
        else if (k === K.up) cur = Math.max(0, cur - 4);
        else if (k === K.down) cur = Math.min(15, cur + 4);
        else if (k === K.ok) { if (pairs === 8) memory(); else flip(); return true; }
        render();
        return true;
      }};
    });
  }

  // MARK: - Sudoku: OK cycles the number in a cell, or the remote's number keys type it

  function solved() {
    var g = [];
    for (var i = 0; i < 81; i++) g.push(0);
    function ok(i, n) {
      var r = Math.floor(i / 9), c = i % 9, br = r - r % 3, bc = c - c % 3;
      for (var k = 0; k < 9; k++) if (g[r * 9 + k] === n || g[k * 9 + c] === n || g[(br + Math.floor(k / 3)) * 9 + bc + k % 3] === n) return false;
      return true;
    }
    (function fill(i) {
      if (i === 81) return true;
      var nums = shuffled([1, 2, 3, 4, 5, 6, 7, 8, 9]);
      for (var k = 0; k < 9; k++) { if (ok(i, nums[k])) { g[i] = nums[k]; if (fill(i + 1)) return true; g[i] = 0; } }
      return false;
    })(0);
    return g;
  }

  function sudoku(level) {
    if (!level) {
      F.menu('Sudoku', [['🙂', tr('Fácil', 'Easy', 'Fácil'), 36], ['🤔', tr('Médio', 'Medium', 'Medio'), 46], ['😈', tr('Difícil', 'Hard', 'Difícil'), 54]].map(function (o) {
        return {emoji: o[0], label: o[1], run: function () { sudoku(o[2]); }};
      }), 3);
      return;
    }
    F.open(function (b) {
      el('div', 'ftitle', b, 'Sudoku');
      U.hint(b, tr('Setas andam · OK troca o número (ou as teclas numéricas) · 0 apaga', 'Arrows move · OK cycles the number (or number keys) · 0 clears', 'OK cambia el número'));
      var sol = solved(), given = sol.slice(), cur = 40, t0 = Date.now();
      shuffled(sol.map(function (_, i) { return i; })).slice(0, level).forEach(function (i) { given[i] = 0; });
      var fixed = given.map(function (v) { return v > 0; }), board = given.slice();
      var grid = el('div', 'sgrid', b), cells = [];
      for (var i = 0; i < 81; i++) {
        var c = el('div', 'scell' + (fixed[i] ? ' fixed' : ''), grid);
        if (i % 9 === 2 || i % 9 === 5) setClass(c, 'br', true);
        if (Math.floor(i / 9) === 2 || Math.floor(i / 9) === 5) setClass(c, 'bb', true);
        cells.push(c);
      }
      function clash(i) {
        var v = board[i];
        if (!v) return false;
        var r = Math.floor(i / 9), c = i % 9, br = r - r % 3, bc = c - c % 3;
        for (var k = 0; k < 9; k++) {
          var a = r * 9 + k, b2 = k * 9 + c, d = (br + Math.floor(k / 3)) * 9 + bc + k % 3;
          if ((a !== i && board[a] === v) || (b2 !== i && board[b2] === v) || (d !== i && board[d] === v)) return true;
        }
        return false;
      }
      function render() {
        var done = board.every(function (v, i) { return v === sol[i]; });
        cells.forEach(function (c, i) {
          c.textContent = board[i] || '';
          setClass(c, 'focus', i === cur);
          setClass(c, 'bad', !fixed[i] && clash(i));
          setClass(c, 'same', board[cur] && board[i] === board[cur] && i !== cur);
        });
        var left = board.filter(function (v) { return !v; }).length;
        U.info(b, done ? tr('Resolvido em ', 'Solved in ', 'Resuelto en ') + Math.round((Date.now() - t0) / 60000) + ' min! 🎉' : left + tr(' casas vazias', ' empty', ' vacías'));
      }
      render();
      return {key: function (k) {
        if (k === K.left) cur = cur % 9 ? cur - 1 : cur;
        else if (k === K.right) cur = cur % 9 < 8 ? cur + 1 : cur;
        else if (k === K.up) cur = cur >= 9 ? cur - 9 : cur;
        else if (k === K.down) cur = cur < 72 ? cur + 9 : cur;
        else if (k === K.ok && !fixed[cur]) board[cur] = (board[cur] + 1) % 10;
        else if (k >= 48 && k <= 57 && !fixed[cur]) board[cur] = k - 48;
        render();
        return true;
      }};
    });
  }

  // MARK: - Solitaire (Klondike, draw one)

  var SUITS = ['♠', '♥', '♦', '♣'];

  function solitaire() {
    F.open(function (b) {
      el('div', 'ftitle', b, tr('Paciência', 'Solitaire', 'Solitario'));
      U.hint(b, tr('Setas escolhem · ↑↓ na pilha escolhem quantas cartas · OK pega e solta · OK no monte vira carta', 'Arrows pick · ↑↓ in a column pick how many · OK takes and drops', 'OK toma y suelta'));
      var CW = 150, CH = 210, GAP = 40, X0 = (1920 - (7 * CW + 6 * GAP)) / 2;
      var c = U.canvas(b, 1920, 880), g = c.getContext('2d');
      c.style.top = '170px';
      c.style.left = '0px';
      var deck = [];
      SUITS.forEach(function (s, si) { for (var v = 1; v <= 13; v++) deck.push({s: si, v: v, up: false}); });
      deck = shuffled(deck);
      var tab = [], stock, waste = [], found = [[], [], [], []];
      for (var col = 0; col < 7; col++) { tab.push(deck.splice(0, col + 1)); tab[col][col].up = true; }
      stock = deck;
      // Cursor: row 0 = stock, waste, (gap), 4 foundations at columns 0,1,3..6; row 1 = the 7 columns (depth = cards taken).
      var row = 1, col2 = 0, depth = 1, held = null, moves = 0;
      function red(cd) { return cd.s === 1 || cd.s === 2; }
      function label(v) { return v === 1 ? 'A' : v === 11 ? 'J' : v === 12 ? 'Q' : v === 13 ? 'K' : String(v); }
      function card(x, y, cd, hl) {
        g.save();
        g.shadowColor = 'rgba(0,0,0,0.4)'; g.shadowBlur = 10; g.shadowOffsetY = 4;
        g.fillStyle = cd && cd.up ? '#F7F7F9' : '#2C4A8A';
        U.rr(g, x, y, CW, CH, 14); g.fill();
        g.restore();
        if (cd && cd.up) {
          g.fillStyle = red(cd) ? '#D70015' : '#1C1C1E';
          g.font = '700 34px Inter, sans-serif'; g.textAlign = 'left'; g.textBaseline = 'top';
          g.fillText(label(cd.v) + SUITS[cd.s], x + 12, y + 10);
          g.font = '64px Inter, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
          g.fillText(SUITS[cd.s], x + CW / 2, y + CH / 2 + 16);
        } else if (cd) {
          g.strokeStyle = 'rgba(255,255,255,0.25)'; g.lineWidth = 3; U.rr(g, x + 10, y + 10, CW - 20, CH - 20, 10); g.stroke();
        }
        if (hl) { g.strokeStyle = '#FFD60A'; g.lineWidth = 6; U.rr(g, x - 3, y - 3, CW + 6, CH + 6, 16); g.stroke(); }
      }
      function slot(x, y, text) {
        g.strokeStyle = 'rgba(255,255,255,0.25)'; g.lineWidth = 3; U.rr(g, x, y, CW, CH, 14); g.stroke();
        if (text) { g.fillStyle = 'rgba(255,255,255,0.3)'; g.font = '56px Inter, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, x + CW / 2, y + CH / 2); }
      }
      function colX(i) { return X0 + i * (CW + GAP); }
      function topPile(i) { return i === 0 ? stock : i === 1 ? waste : i >= 3 ? found[i - 3] : null; }
      function faceUp(col) { var t = tab[col], n = 0; for (var i = t.length - 1; i >= 0 && t[i].up; i--) n++; return n; }
      function draw() {
        g.clearRect(0, 0, 1920, 880);
        g.fillStyle = '#0E3B2A'; U.rr(g, X0 - 30, 0, 7 * CW + 6 * GAP + 60, 880, 30); g.fill();
        // top row
        if (stock.length) card(colX(0), 20, {up: false}); else slot(colX(0), 20, '↺');
        if (waste.length) card(colX(1), 20, waste[waste.length - 1]); else slot(colX(1), 20);
        for (var f = 0; f < 4; f++) { var p = found[f]; if (p.length) card(colX(3 + f), 20, p[p.length - 1]); else slot(colX(3 + f), 20, SUITS[f]); }
        // columns
        for (var i = 0; i < 7; i++) {
          var t = tab[i];
          if (!t.length) slot(colX(i), 270);
          for (var j = 0; j < t.length; j++) {
            var isHeld = held && held.from === 'tab' && held.col === i && j >= t.length - held.n;
            var lifted = isHeld ? -18 : 0;
            card(colX(i), 270 + j * 44 + lifted, t[j], row === 1 && col2 === i && j >= t.length - depth);
          }
        }
        if (row === 0) { var pile = topPile(col2); g.strokeStyle = '#FFD60A'; g.lineWidth = 6; U.rr(g, colX(col2) - 3, 17, CW + 6, CH + 6, 16); g.stroke(); }
        if (row === 1 && !tab[col2].length) { g.strokeStyle = '#FFD60A'; g.lineWidth = 6; U.rr(g, colX(col2) - 3, 267, CW + 6, CH + 6, 16); g.stroke(); }
        var won = found.every(function (p) { return p.length === 13; });
        U.info(b, (held ? tr('Segurando ', 'Holding ', 'Tomaste ') + held.n + tr(' carta(s) — escolha onde soltar', ' card(s) — choose where', ' carta(s)') : tr('Jogadas ', 'Moves ', 'Jugadas ') + moves) + (won ? '  ·  ' + tr('Você venceu! 🎉', 'You won! 🎉', '¡Ganaste! 🎉') : ''));
      }
      function cardsAt(from, col, n) {
        if (from === 'tab') return tab[col].slice(tab[col].length - n);
        var p = topPile(col); return p.slice(p.length - 1);
      }
      function canPut(cards, toRow, toCol) {
        var c0 = cards[0];
        if (toRow === 0) {
          if (toCol < 3 || cards.length !== 1) return false;
          var f = found[toCol - 3], top = f[f.length - 1];
          return top ? top.s === c0.s && c0.v === top.v + 1 : c0.v === 1;
        }
        var t = tab[toCol], last = t[t.length - 1];
        return last ? last.up && red(last) !== red(c0) && c0.v === last.v - 1 : c0.v === 13;
      }
      function take() {
        if (row === 0) {
          if (col2 === 0) {   // the stock: turn one card, or turn the waste back
            if (stock.length) { var cd = stock.pop(); cd.up = true; waste.push(cd); }
            else { stock = waste.reverse().map(function (x) { x.up = false; return x; }); waste = []; }
            moves++;
            return;
          }
          var p = topPile(col2);
          if (p && p.length) held = {from: 'top', col: col2, n: 1};
          return;
        }
        if (tab[col2].length && depth <= faceUp(col2)) held = {from: 'tab', col: col2, n: depth};
      }
      function drop() {
        var cards = cardsAt(held.from, held.col, held.n);
        var same = (held.from === 'tab' && row === 1 && col2 === held.col) || (held.from === 'top' && row === 0 && col2 === held.col);
        if (!same && canPut(cards, row, col2)) {
          if (held.from === 'tab') tab[held.col].splice(tab[held.col].length - held.n, held.n); else topPile(held.col).pop();
          (row === 0 ? found[col2 - 3] : tab[col2]).push.apply(row === 0 ? found[col2 - 3] : tab[col2], cards);
          if (held.from === 'tab') { var t = tab[held.col]; if (t.length && !t[t.length - 1].up) t[t.length - 1].up = true; }
          moves++;
        }
        held = null;
        depth = 1;
      }
      draw();
      return {key: function (k) {
        if (k === K.left) { col2 = Math.max(0, col2 - 1); if (row === 0 && col2 === 2) col2 = 1; depth = 1; }
        else if (k === K.right) { col2 = Math.min(6, col2 + 1); if (row === 0 && col2 === 2) col2 = 3; depth = 1; }
        else if (k === K.up) { if (row === 1 && !held && depth < faceUp(col2)) depth++; else { row = 0; if (col2 === 2) col2 = 1; } }
        else if (k === K.down) { if (row === 1 && depth > 1) depth--; else row = 1; }
        else if (k === K.ok) { if (held) drop(); else take(); }
        draw();
        return true;
      }};
    });
  }

  Games.add('🃏', tr('Memória', 'Memory', 'Memoria'), memory, 'memory');
  Games.add('🧩', 'Sudoku', function () { sudoku(); });
  Games.add('♠️', tr('Paciência', 'Solitaire', 'Solitario'), solitaire);
})();
