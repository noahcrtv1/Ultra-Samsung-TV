/*
 * Games, played with the remote (arrows, OK, Back), inside the Fun layer:
 *  arcade: Snake, Tetris, Minesweeper, 2048 · puzzles: Memory, Sudoku, Solitaire
 *  movies: Guess the year, Guess by the sound, Higher or lower, Hangman · team: Penalty shootout
 *  with phones (through the hub): group quiz, draw and guess
 */
var Games = (function () {
  'use strict';

  var F = Fun.api, H = window.Home, el = H.el, setClass = H.setClass, K = TV.keys;
  var rnd = F.rnd, shuffled = F.shuffled;

  function best(name, score) {
    var b = F.stored('best.' + name) || 0;
    if (score !== undefined && score > b) { b = score; F.store('best.' + name, b); }
    return b;
  }

  function canvas(b, w, h, cls) {
    var c = el('canvas', 'gcanvas ' + (cls || ''), b);
    c.width = w;
    c.height = h;
    c.style.width = w + 'px';
    c.style.height = h + 'px';
    c.style.left = (1920 - w) / 2 + 'px';
    return c;
  }

  function rr(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }

  function info(b, text) {
    var i = b.querySelector('.ginfo') || el('div', 'ginfo', b);
    i.textContent = text;
    return i;
  }

  function hint(b, text) { el('div', 'hint', b, text); }

  /** Plain text for comparing answers: lowercase, no accents, no punctuation. */
  function plain(s) {
    return (s || '').toLowerCase().replace(/[áàâãä]/g, 'a').replace(/[éèêë]/g, 'e').replace(/[íìîï]/g, 'i')
      .replace(/[óòôõö]/g, 'o').replace(/[úùûü]/g, 'u').replace(/ç/g, 'c').replace(/ñ/g, 'n');
  }

  // MARK: - Snake

  function snake() {
    F.open(function (b) {
      el('div', 'ftitle', b, 'Snake');
      var COLS = 24, ROWS = 14, S = 50, c = canvas(b, COLS * S, ROWS * S), g = c.getContext('2d');
      c.style.top = '200px';
      hint(b, tr('Setas guiam · OK pausa/recomeça', 'Arrows steer · OK pauses/restarts', 'Flechas guían · OK pausa'));
      var body, dir, nextDir, food, score, timer = 0, dead, paused;
      function reset() {
        body = [[6, 7], [5, 7], [4, 7]]; dir = [1, 0]; nextDir = dir; score = 0; dead = false; paused = false;
        place(); draw(); loop();
      }
      function place() {
        do { food = [rnd(COLS), rnd(ROWS)]; } while (body.some(function (p) { return p[0] === food[0] && p[1] === food[1]; }));
      }
      function loop() {
        clearTimeout(timer);
        if (dead || paused) return;
        timer = setTimeout(function () { step(); loop(); }, Math.max(60, 140 - score * 3));
      }
      function step() {
        dir = nextDir;
        var h = [body[0][0] + dir[0], body[0][1] + dir[1]];
        if (h[0] < 0 || h[1] < 0 || h[0] >= COLS || h[1] >= ROWS || body.some(function (p) { return p[0] === h[0] && p[1] === h[1]; })) {
          dead = true; best('snake', score); draw(); return;
        }
        body.unshift(h);
        if (h[0] === food[0] && h[1] === food[1]) { score++; place(); } else body.pop();
        draw();
      }
      function draw() {
        g.fillStyle = '#121218'; g.fillRect(0, 0, c.width, c.height);
        g.fillStyle = 'rgba(255,255,255,0.03)';
        for (var x = 0; x < COLS; x++) for (var y = 0; y < ROWS; y++) if ((x + y) % 2) g.fillRect(x * S, y * S, S, S);
        g.fillStyle = '#FF453A'; g.beginPath(); g.arc(food[0] * S + S / 2, food[1] * S + S / 2, S * 0.36, 0, Math.PI * 2); g.fill();
        body.forEach(function (p, i) {
          g.fillStyle = i ? 'hsl(' + (200 + i * 3) + ',80%,' + Math.max(40, 65 - i) + '%)' : '#FFF';
          rr(g, p[0] * S + 3, p[1] * S + 3, S - 6, S - 6, 12); g.fill();
        });
        info(b, tr('Pontos ', 'Score ', 'Puntos ') + score + '  ·  ' + tr('Recorde ', 'Best ', 'Récord ') + best('snake') + (dead ? '  ·  ' + tr('Fim! OK recomeça', 'Game over! OK restarts', '¡Fin!') : paused ? '  ·  ' + tr('Pausado', 'Paused', 'Pausa') : ''));
      }
      reset();
      return {key: function (k) {
        var d = k === K.left ? [-1, 0] : k === K.right ? [1, 0] : k === K.up ? [0, -1] : k === K.down ? [0, 1] : null;
        if (d && !(d[0] === -dir[0] && d[1] === -dir[1])) nextDir = d;
        else if (k === K.ok) { if (dead) reset(); else { paused = !paused; draw(); loop(); } }
        return true;
      }, stop: function () { clearTimeout(timer); }};
    });
  }

  // MARK: - Tetris

  var SHAPES = {I: [[0, 1], [1, 1], [2, 1], [3, 1]], O: [[1, 0], [2, 0], [1, 1], [2, 1]], T: [[1, 0], [0, 1], [1, 1], [2, 1]],
    S: [[1, 0], [2, 0], [0, 1], [1, 1]], Z: [[0, 0], [1, 0], [1, 1], [2, 1]], J: [[0, 0], [0, 1], [1, 1], [2, 1]], L: [[2, 0], [0, 1], [1, 1], [2, 1]]};
  var COLORS = {I: '#5AC8FA', O: '#FFD60A', T: '#BF5AF2', S: '#30D158', Z: '#FF453A', J: '#0A84FF', L: '#FF9F0A'};

  function tetris() {
    F.open(function (b) {
      el('div', 'ftitle', b, 'Tetris');
      var W = 10, Hh = 20, S = 40, c = canvas(b, W * S + 260, Hh * S), g = c.getContext('2d');
      c.style.top = '170px';
      hint(b, tr('← → movem · ↑ gira · ↓ desce · OK derruba', '← → move · ↑ rotate · ↓ drop · OK hard drop', '← → mueven · ↑ gira · OK cae'));
      var grid, piece, next, score, lines, timer = 0, over;
      function newPiece(t) {
        var cells = SHAPES[t].map(function (p) { return [p[0], p[1]]; });
        return {t: t, cells: cells, x: 3, y: 0};
      }
      function bag() { return 'IOTSZJL'.charAt(rnd(7)); }
      function reset() {
        grid = []; for (var y = 0; y < Hh; y++) { grid.push([]); for (var x = 0; x < W; x++) grid[y].push(null); }
        score = 0; lines = 0; over = false; piece = newPiece(bag()); next = bag(); draw(); loop();
      }
      function fits(p, dx, dy, cells) {
        return (cells || p.cells).every(function (q) {
          var x = p.x + q[0] + dx, y = p.y + q[1] + dy;
          return x >= 0 && x < W && y < Hh && (y < 0 || !grid[y][x]);
        });
      }
      function rotate() {
        if (piece.t === 'O') return;
        var r = piece.cells.map(function (q) { return [2 - q[1] + (piece.t === 'I' ? 1 : 0) - 1, q[0]]; });
        var minX = Math.min.apply(null, r.map(function (q) { return q[0]; }));
        if (minX < 0) r = r.map(function (q) { return [q[0] - minX, q[1]]; });
        [0, -1, 1, -2, 2].some(function (kick) { if (fits(piece, kick, 0, r)) { piece.cells = r; piece.x += kick; return true; } return false; });
      }
      function lock() {
        piece.cells.forEach(function (q) { var y = piece.y + q[1]; if (y >= 0) grid[y][piece.x + q[0]] = piece.t; else over = true; });
        var cleared = 0;
        for (var y = Hh - 1; y >= 0; y--) {
          if (grid[y].every(function (v) { return v; })) { grid.splice(y, 1); grid.unshift(new Array(W).fill ? new Array(W).fill(null) : [null, null, null, null, null, null, null, null, null, null]); cleared++; y++; }
        }
        lines += cleared;
        score += [0, 100, 300, 500, 800][cleared] * (1 + Math.floor(lines / 10));
        piece = newPiece(next); next = bag();
        if (!fits(piece, 0, 0)) over = true;
        if (over) best('tetris', score);
      }
      function fall() { if (fits(piece, 0, 1)) piece.y++; else lock(); }
      function loop() {
        clearTimeout(timer);
        if (over) { draw(); return; }
        timer = setTimeout(function () { fall(); draw(); loop(); }, Math.max(90, 650 - Math.floor(lines / 10) * 60));
      }
      function cell(x, y, t, ghost) {
        g.fillStyle = ghost ? 'rgba(255,255,255,0.12)' : COLORS[t];
        rr(g, x * S + 2, y * S + 2, S - 4, S - 4, 7); g.fill();
        if (!ghost) { g.fillStyle = 'rgba(255,255,255,0.22)'; g.fillRect(x * S + 6, y * S + 5, S - 12, 5); }
      }
      function draw() {
        g.fillStyle = '#121218'; g.fillRect(0, 0, c.width, c.height);
        g.fillStyle = '#1C1C24'; g.fillRect(0, 0, W * S, Hh * S);
        for (var y = 0; y < Hh; y++) for (var x = 0; x < W; x++) if (grid[y][x]) cell(x, y, grid[y][x]);
        var gy = 0; while (fits(piece, 0, gy + 1)) gy++;
        piece.cells.forEach(function (q) { cell(piece.x + q[0], piece.y + q[1] + gy, piece.t, true); });
        piece.cells.forEach(function (q) { if (piece.y + q[1] >= 0) cell(piece.x + q[0], piece.y + q[1], piece.t); });
        g.fillStyle = '#FFF'; g.font = '600 26px Inter, sans-serif';
        var x0 = W * S + 40;
        g.fillText(tr('Próxima', 'Next', 'Siguiente'), x0, 40);
        SHAPES[next].forEach(function (q) { g.fillStyle = COLORS[next]; rr(g, x0 + q[0] * 34, 60 + q[1] * 34, 30, 30, 6); g.fill(); });
        g.fillStyle = '#FFF';
        g.fillText(tr('Pontos', 'Score', 'Puntos'), x0, 200); g.font = '700 40px Inter, sans-serif'; g.fillText(score, x0, 246);
        g.font = '600 26px Inter, sans-serif'; g.fillText(tr('Linhas', 'Lines', 'Líneas') + ' ' + lines, x0, 300);
        g.fillText(tr('Recorde', 'Best', 'Récord') + ' ' + best('tetris'), x0, 340);
        if (over) { g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(0, 0, W * S, Hh * S); g.fillStyle = '#FFF'; g.font = '700 40px Inter, sans-serif'; g.fillText(tr('Fim!', 'Game over', '¡Fin!'), 110, 380); g.font = '500 24px Inter, sans-serif'; g.fillText(tr('OK recomeça', 'OK restarts', 'OK reinicia'), 120, 420); }
      }
      reset();
      return {key: function (k) {
        if (over) { if (k === K.ok) reset(); return true; }
        if (k === K.left && fits(piece, -1, 0)) piece.x--;
        else if (k === K.right && fits(piece, 1, 0)) piece.x++;
        else if (k === K.up) rotate();
        else if (k === K.down) { fall(); score += 1; }
        else if (k === K.ok) { while (fits(piece, 0, 1)) { piece.y++; score += 2; } lock(); loop(); }
        draw();
        return true;
      }, stop: function () { clearTimeout(timer); }};
    });
  }

  // MARK: - Minesweeper: OK opens, OK twice quickly (or holding it) plants a flag

  function mines() {
    F.open(function (b) {
      el('div', 'ftitle', b, tr('Campo minado', 'Minesweeper', 'Buscaminas'));
      var W = 14, Hh = 8, N = 18, S = 86, c = canvas(b, W * S, Hh * S), g = c.getContext('2d');
      c.style.top = '200px';
      hint(b, tr('OK abre · OK duas vezes marca bandeira 🚩', 'OK opens · OK twice plants a flag 🚩', 'OK abre · OK dos veces: bandera'));
      var cells, cx, cy, over, won, started, t0, okTimer = 0, okAt = 0;
      function reset() {
        cells = []; for (var i = 0; i < W * Hh; i++) cells.push({mine: false, open: false, flag: false, n: 0});
        cx = 6; cy = 3; over = false; won = false; started = false; draw();
      }
      function lay(safe) {
        var spots = shuffled(cells.map(function (_, i) { return i; }).filter(function (i) {
          var x = i % W, y = Math.floor(i / W); return Math.abs(x - safe % W) > 1 || Math.abs(y - Math.floor(safe / W)) > 1;
        })).slice(0, N);
        spots.forEach(function (i) { cells[i].mine = true; });
        cells.forEach(function (cl, i) { cl.n = around(i).filter(function (j) { return cells[j].mine; }).length; });
        started = true; t0 = Date.now();
      }
      function around(i) {
        var x = i % W, y = Math.floor(i / W), out = [];
        for (var dx = -1; dx <= 1; dx++) for (var dy = -1; dy <= 1; dy++) {
          var nx = x + dx, ny = y + dy;
          if ((dx || dy) && nx >= 0 && ny >= 0 && nx < W && ny < Hh) out.push(ny * W + nx);
        }
        return out;
      }
      function open(i) {
        var cl = cells[i];
        if (cl.open || cl.flag) return;
        cl.open = true;
        if (cl.mine) { over = true; cells.forEach(function (x) { if (x.mine) x.open = true; }); return; }
        if (!cl.n) around(i).forEach(open);
      }
      function check() {
        if (!over && cells.every(function (cl) { return cl.mine || cl.open; })) {
          won = true; over = true;
          var secs = Math.round((Date.now() - t0) / 1000), prev = F.stored('best.mines');
          if (!prev || secs < prev) F.store('best.mines', secs);
        }
      }
      var NUM = ['', '#0A84FF', '#30D158', '#FF453A', '#5E5CE6', '#FF9F0A', '#64D2FF', '#FFF', '#8E8E93'];
      function draw() {
        g.fillStyle = '#121218'; g.fillRect(0, 0, c.width, c.height);
        cells.forEach(function (cl, i) {
          var x = (i % W) * S, y = Math.floor(i / W) * S;
          g.fillStyle = cl.open ? (cl.mine ? '#5A1414' : '#22222A') : '#3A3A46';
          rr(g, x + 3, y + 3, S - 6, S - 6, 12); g.fill();
          g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '700 40px Inter, sans-serif';
          if (cl.open && cl.mine) g.fillText('💣', x + S / 2, y + S / 2 + 2);
          else if (cl.open && cl.n) { g.fillStyle = NUM[cl.n]; g.fillText(cl.n, x + S / 2, y + S / 2 + 2); }
          else if (cl.flag) g.fillText('🚩', x + S / 2, y + S / 2 + 2);
        });
        g.strokeStyle = '#FFF'; g.lineWidth = 5; rr(g, cx * S + 2, cy * S + 2, S - 4, S - 4, 14); g.stroke();
        var flags = cells.filter(function (cl) { return cl.flag; }).length;
        info(b, '💣 ' + (N - flags) + '  ·  ' + (won ? tr('Venceu! ', 'You won! ', '¡Ganaste! ') + Math.round((Date.now() - t0) / 1000) + 's' : over ? tr('Boom! OK recomeça', 'Boom! OK restarts', '¡Boom!') : '')
          + '  ·  ' + tr('Recorde ', 'Best ', 'Récord ') + (F.stored('best.mines') ? F.stored('best.mines') + 's' : '—'));
      }
      reset();
      return {key: function (k) {
        if (k === K.left) cx = Math.max(0, cx - 1);
        else if (k === K.right) cx = Math.min(W - 1, cx + 1);
        else if (k === K.up) cy = Math.max(0, cy - 1);
        else if (k === K.down) cy = Math.min(Hh - 1, cy + 1);
        else if (k === K.ok) {
          if (over) { reset(); return true; }
          var i = cy * W + cx, now = Date.now();
          if (now - okAt < 380) {   // a second OK (or the key repeating while held): flag instead of opening
            clearTimeout(okTimer); okAt = 0;
            if (!cells[i].open) cells[i].flag = !cells[i].flag;
            draw();
            return true;
          }
          okAt = now;
          okTimer = setTimeout(function () {
            okAt = 0;
            if (!started) lay(i);
            open(i); check(); draw();
          }, 380);
          return true;
        }
        draw();
        return true;
      }};
    });
  }

  // MARK: - Menu

  var LIST = [];
  function add(emoji, label, run, key) { LIST.push({emoji: emoji, label: label, run: run, key: key}); }

  function menu() {
    F.menu(tr('Jogos', 'Games', 'Juegos'), LIST.map(function (g) {
      var b = g.key ? best(g.key) : 0;
      return {emoji: g.emoji, label: g.label, sub: b ? tr('Recorde: ', 'Best: ', 'Récord: ') + b : '', run: g.run};
    }), 5, true);
  }

  add('🐍', 'Snake', snake, 'snake');
  add('🧱', 'Tetris', tetris, 'tetris');
  add('💣', tr('Campo minado', 'Minesweeper', 'Buscaminas'), mines);
  add('🔢', '2048', F.game2048);

  return {menu: menu, add: add, util: {best: best, canvas: canvas, rr: rr, info: info, hint: hint, plain: plain}};
})();
