/* Movie games and the penalty shootout for the Games menu. */
(function () {
  'use strict';

  var F = Fun.api, H = window.Home, el = H.el, setClass = H.setClass, K = TV.keys, U = Games.util;
  var rnd = F.rnd, shuffled = F.shuffled;

  /** Well-known movies with a poster and a release date: done(list). */
  function pool(done) {
    var out = [], left = 3;
    [['/movie/top_rated', 1 + rnd(8)], ['/movie/popular', 1 + rnd(5)], ['/movie/top_rated', 9 + rnd(8)]].forEach(function (q) {
      Data.tmdb(q[0] + '?language=' + I18N.locale() + '&page=' + q[1], function (e, r) {
        (r && r.results || []).forEach(function (o) { if (o.poster_path && o.release_date && o.vote_count > 300) out.push(o); });
        if (--left === 0) done(shuffled(out));
      });
    });
  }

  function poster(parent, o, cls) {
    var p = el('div', 'gposter ' + (cls || ''), parent);
    p.style.backgroundImage = 'url(' + F.img(o.poster_path, 'w500') + ')';
    return p;
  }

  // MARK: - Guess the year: ← → one year, ↑ ↓ ten, OK answers; up to 100 points a round

  function guessYear() {
    F.open(function (b) {
      el('div', 'ftitle', b, tr('Adivinhe o ano', 'Guess the year', 'Adivina el año'));
      F.loading();
      var list = [], round = 0, total = 0, year = 2000, answered = false, view;
      pool(function (l) { list = l; next(); });
      function next() {
        if (round === 5) {
          b.innerHTML = '';
          el('div', 'ftitle', b, tr('Fim!', 'Done!', '¡Fin!'));
          el('div', 'qscore', b, total + ' / 500');
          U.hint(b, tr('Recorde: ', 'Best: ', 'Récord: ') + U.best('year', total) + ' · ' + tr('OK joga de novo', 'OK plays again', 'OK otra vez'));
          answered = 'end';
          return;
        }
        round++; answered = false; year = 2000;
        b.innerHTML = '';
        el('div', 'ftitle', b, tr('Adivinhe o ano ', 'Guess the year ', 'Adivina el año ') + round + '/5 · ' + total + ' pts');
        view = {o: list.pop()};
        poster(b, view.o, 'left');
        el('div', 'gtitle', b, view.o.title);
        view.year = el('div', 'gyear', b, String(year));
        view.res = el('div', 'gresult', b, '');
        U.hint(b, tr('← → um ano · ↑ ↓ dez anos · OK responde', '← → one year · ↑ ↓ ten years · OK answers', '← → un año · OK responde'));
      }
      return {key: function (k) {
        if (answered === 'end') { if (k === K.ok) guessYear(); return true; }
        if (!view) return true;
        if (answered) { if (k === K.ok) next(); return true; }
        if (k === K.left) year--; else if (k === K.right) year++; else if (k === K.up) year += 10; else if (k === K.down) year -= 10;
        else if (k === K.ok) {
          var real = +view.o.release_date.slice(0, 4), diff = Math.abs(real - year), pts = Math.max(0, 100 - diff * 12);
          total += pts; answered = true;
          view.res.textContent = (diff === 0 ? '🎯 ' : '') + tr('Lançado em ', 'Released in ', 'Estrenado en ') + real + ' · +' + pts + ' pts · ' + tr('OK continua', 'OK next', 'OK sigue');
          return true;
        }
        year = Math.max(1920, Math.min(new Date().getFullYear(), year));
        view.year.textContent = String(year);
        return true;
      }};
    });
  }

  // MARK: - Guess by the sound: a trailer plays with no picture; 4 choices

  function bySound() {
    if (!Plus.trailerPage()) { H.toast(tr('Esse jogo precisa do Hub aberto no computador', 'This game needs the hub on your computer', 'Necesita el Hub')); return; }
    F.open(function (b) {
      el('div', 'ftitle', b, tr('Adivinhe pelo som', 'Guess by the sound', 'Adivina por el sonido'));
      F.loading();
      var list = [], round = 0, points = 0, opts = [], answer = 0, choice = 0, state = 'load', frame = null;
      pool(function (l) { list = l; next(); });
      function stopSound() { if (frame && frame.parentNode) frame.parentNode.removeChild(frame); frame = null; }
      function next() {
        stopSound();
        if (round === 5 || list.length < 4) {
          b.innerHTML = '';
          el('div', 'ftitle', b, tr('Fim!', 'Done!', '¡Fin!'));
          el('div', 'qscore', b, points + ' / 5');
          U.hint(b, tr('Recorde: ', 'Best: ', 'Récord: ') + U.best('sound', points) + ' · ' + tr('OK joga de novo', 'OK plays again', 'OK otra vez'));
          state = 'end';
          return;
        }
        opts = list.splice(0, 4);
        answer = rnd(4);
        var o = opts[answer];
        Plus.trailer({kind: 'movie', id: o.id}, function (key) {
          if (!key) { list.push.apply(list, opts.filter(function (x, i) { return i !== answer; })); next(); return; }
          round++; choice = 0; state = 'ask';
          b.innerHTML = '';
          el('div', 'ftitle', b, tr('Que filme é esse? ', 'Which movie? ', '¿Qué película? ') + round + '/5 · ' + points + ' pts');
          el('div', 'gwave', b, '🔊');
          frame = el('iframe', 'gsound', b);
          frame.setAttribute('allow', 'autoplay');
          frame.src = Plus.trailerPage() + '?v=' + encodeURIComponent(key) + '&sound=1';
          var row = el('div', 'qopts', b);
          opts.forEach(function (x) { el('div', 'qopt', row, x.title); });
          focus();
        });
      }
      function focus() { var o = b.querySelectorAll('.qopt'); for (var n = 0; n < o.length; n++) setClass(o[n], 'focus', n === choice); }
      return {key: function (k) {
        if (state === 'end') { if (k === K.ok) bySound(); return true; }
        if (state === 'shown') { if (k === K.ok) next(); return true; }
        if (state !== 'ask') return true;
        if (k === K.left) choice = Math.max(0, choice - 1);
        else if (k === K.right) choice = Math.min(3, choice + 1);
        else if (k === K.ok) {
          var o = b.querySelectorAll('.qopt');
          setClass(o[answer], 'right', true);
          if (choice === answer) points++; else setClass(o[choice], 'wrong', true);
          var p = poster(b, opts[answer], 'reveal');
          state = 'shown';
          U.info(b, tr('OK continua', 'OK next', 'OK sigue'));
          return true;
        }
        focus();
        return true;
      }, stop: stopSound};
    });
  }

  // MARK: - Higher or lower: is the next movie rated higher (↑) or lower (↓)?

  function higherLower() {
    F.open(function (b) {
      el('div', 'ftitle', b, tr('Mais ou menos', 'Higher or lower', 'Más o menos'));
      F.loading();
      var list = [], a, n, streak = 0, state = 'load';
      pool(function (l) { list = l; a = list.pop(); next(); });
      function card(o, showRate, side) {
        var c = el('div', 'hlcard ' + side, b);
        poster(c, o);
        el('div', 'hlname', c, o.title);
        el('div', 'hlrate', c, showRate ? '★ ' + o.vote_average.toFixed(1) : '?');
        return c;
      }
      function next() {
        n = list.pop();
        if (!n) { list = []; pool(function (l) { list = l; next(); }); return; }
        b.innerHTML = '';
        el('div', 'ftitle', b, tr('Mais ou menos · sequência ', 'Higher or lower · streak ', 'Más o menos · racha ') + streak);
        card(a, true, 'l');
        card(n, false, 'r');
        U.hint(b, tr('A nota do segundo é ↑ maior ou ↓ menor?', 'Is the second one rated ↑ higher or ↓ lower?', '¿↑ mayor o ↓ menor?'));
        state = 'ask';
      }
      return {key: function (k) {
        if (state === 'end') { if (k === K.ok) higherLower(); return true; }
        if (state !== 'ask' || (k !== K.up && k !== K.down)) return true;
        var right = k === K.up ? n.vote_average >= a.vote_average : n.vote_average <= a.vote_average;
        b.querySelector('.hlcard.r .hlrate').textContent = '★ ' + n.vote_average.toFixed(1);
        setClass(b.querySelector('.hlcard.r'), right ? 'ok' : 'bad', true);
        state = 'wait';
        setTimeout(function () {
          if (right) { streak++; a = n; next(); return; }
          U.info(b, tr('Errou! Sequência de ', 'Wrong! Streak of ', '¡Fallaste! Racha de ') + streak + ' · ' + tr('Recorde ', 'Best ', 'Récord ') + U.best('higher', streak) + ' · ' + tr('OK recomeça', 'OK restarts', 'OK reinicia'));
          state = 'end';
        }, 1100);
        return true;
      }};
    });
  }

  // MARK: - Hangman with movie titles

  function hangman() {
    F.open(function (b) {
      el('div', 'ftitle', b, tr('Forca de filmes', 'Movie hangman', 'Ahorcado de cine'));
      F.loading();
      var word = '', shown, guessed = {}, misses = 0, cur = 0, state = 'load', KEYS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
      pool(function (l) {
        var o = l.filter(function (x) { var t = U.plain(x.title).replace(/[^a-z0-9 ]/g, ''); return t.length >= 4 && t.length <= 24; })[0];
        if (!o) { F.show(null); return; }
        word = o.title;
        build();
      });
      var c, g, line, kb;
      function build() {
        b.innerHTML = '';
        el('div', 'ftitle', b, tr('Forca de filmes', 'Movie hangman', 'Ahorcado de cine'));
        c = U.canvas(b, 300, 340, 'hang'); g = c.getContext('2d');
        line = el('div', 'hword', b);
        kb = el('div', 'hkb', b);
        KEYS.forEach(function (ch) { el('div', 'hk', kb, ch); });
        state = 'play';
        render();
      }
      function letterOk(ch) { return U.plain(word).toUpperCase().indexOf(ch) >= 0; }
      function render() {
        var done = true;
        line.textContent = word.split('').map(function (ch) {
          var p = U.plain(ch).toUpperCase();
          if (!/[A-Z]/.test(p)) return ch;
          if (guessed[p] || state === 'lost') return ch.toUpperCase();
          done = false; return '_';
        }).join(' ');
        [].forEach.call(kb.children, function (k, i) {
          setClass(k, 'focus', i === cur);
          setClass(k, 'used', !!guessed[KEYS[i]]);
          setClass(k, 'hit', !!guessed[KEYS[i]] && letterOk(KEYS[i]));
        });
        // gallows + figure, one part per miss
        g.clearRect(0, 0, 300, 340); g.strokeStyle = '#FFF'; g.lineWidth = 8; g.lineCap = 'round';
        g.beginPath(); g.moveTo(30, 320); g.lineTo(200, 320); g.moveTo(70, 320); g.lineTo(70, 30); g.lineTo(210, 30); g.lineTo(210, 70); g.stroke();
        var parts = [function () { g.beginPath(); g.arc(210, 100, 30, 0, Math.PI * 2); g.stroke(); },
          function () { g.beginPath(); g.moveTo(210, 130); g.lineTo(210, 220); g.stroke(); },
          function () { g.beginPath(); g.moveTo(210, 150); g.lineTo(170, 190); g.stroke(); },
          function () { g.beginPath(); g.moveTo(210, 150); g.lineTo(250, 190); g.stroke(); },
          function () { g.beginPath(); g.moveTo(210, 220); g.lineTo(180, 280); g.stroke(); },
          function () { g.beginPath(); g.moveTo(210, 220); g.lineTo(240, 280); g.stroke(); }];
        for (var i = 0; i < misses; i++) parts[i]();
        if (done && state === 'play') { state = 'won'; U.best('hangman', (F.stored('best.hangman') || 0) + 1); }
        U.info(b, state === 'won' ? tr('Acertou! 🎉 OK joga de novo', 'You got it! 🎉 OK plays again', '¡Acertaste! 🎉') : state === 'lost' ? tr('Era esse! OK joga de novo', 'That was it! OK plays again', '¡Era esa!')
          : tr('Erros ', 'Misses ', 'Errores ') + misses + '/6');
      }
      return {key: function (k) {
        if (state === 'won' || state === 'lost') { if (k === K.ok) hangman(); return true; }
        if (state !== 'play') return true;
        if (k === K.left) cur = Math.max(0, cur - 1);
        else if (k === K.right) cur = Math.min(25, cur + 1);
        else if (k === K.up) cur = Math.max(0, cur - 9);
        else if (k === K.down) cur = Math.min(25, cur + 9);
        else if (k === K.ok) {
          var ch = KEYS[cur];
          if (!guessed[ch]) { guessed[ch] = true; if (!letterOk(ch)) { misses++; if (misses >= 6) state = 'lost'; } }
        } else if (k >= 65 && k <= 90) { var ch2 = String.fromCharCode(k); if (!guessed[ch2]) { guessed[ch2] = true; if (!letterOk(ch2)) { misses++; if (misses >= 6) state = 'lost'; } } }
        render();
        return true;
      }};
    });
  }

  // MARK: - Penalty shootout: you shoot (pick a corner), then you save (pick where to dive); best of 5, then sudden death

  var RIVALS = ['Palmeiras', 'São Paulo', 'Santos', 'Flamengo', 'Vasco', 'Grêmio', 'Inter', 'Cruzeiro', 'Atlético-MG', 'Boca Juniors'];

  function penalties() {
    F.open(function (b) {
      var T = CONFIG.team || {}, me = T.name || tr('Seu time', 'Your team', 'Tu equipo'), abbr = T.abbr || 'EU', rival = RIVALS[rnd(RIVALS.length)];
      el('div', 'ftitle', b, tr('Pênaltis', 'Penalties', 'Penales') + ': ' + me + ' × ' + rival);
      var c = U.canvas(b, 1400, 760), g = c.getContext('2d');
      c.style.top = '170px';
      var tip = el('div', 'hint', b, '');
      // Zones in the goal: 3 columns × 2 rows
      var GX = 300, GY = 120, GW = 800, GH = 330, zone = 1, phase = 'shoot', us = [], them = [], anim = null, raf = 0;
      function zoneXY(z) { return [GX + (z % 3 + 0.5) * GW / 3, GY + (Math.floor(z / 3) + 0.5) * GH / 2]; }
      function scoreLine() { return abbr + ' ' + us.filter(Boolean).length + ' × ' + them.filter(Boolean).length + ' ' + rival.slice(0, 3).toUpperCase(); }
      function marks(list) { var s = ''; for (var i = 0; i < Math.max(5, list.length); i++) s += i < list.length ? (list[i] ? '●' : '○') : '·'; return s; }
      function draw(t) {
        g.clearRect(0, 0, 1400, 760);
        var sky = g.createLinearGradient(0, 0, 0, 760); sky.addColorStop(0, '#0B1020'); sky.addColorStop(1, '#141A2E');
        g.fillStyle = sky; g.fillRect(0, 0, 1400, 760);
        g.fillStyle = '#23232C'; g.fillRect(0, 470, 1400, 290);   // a night pitch in greys (black and white team: no green)
        g.fillStyle = 'rgba(255,255,255,0.06)'; for (var s = 0; s < 7; s++) if (s % 2) g.fillRect(s * 200, 470, 200, 290);
        // net
        g.strokeStyle = 'rgba(255,255,255,0.18)'; g.lineWidth = 1;
        for (var x = GX; x <= GX + GW; x += 30) { g.beginPath(); g.moveTo(x, GY); g.lineTo(x, GY + GH); g.stroke(); }
        for (var y = GY; y <= GY + GH; y += 30) { g.beginPath(); g.moveTo(GX, y); g.lineTo(GX + GW, y); g.stroke(); }
        g.strokeStyle = '#FFF'; g.lineWidth = 12; g.beginPath(); g.moveTo(GX, GY + GH); g.lineTo(GX, GY); g.lineTo(GX + GW, GY); g.lineTo(GX + GW, GY + GH); g.stroke();
        // aim
        if (!anim && (phase === 'shoot' || phase === 'save')) {
          var a = zoneXY(zone);
          g.strokeStyle = phase === 'shoot' ? '#FFD60A' : '#64D2FF'; g.lineWidth = 6;
          g.beginPath(); g.arc(a[0], a[1], 46, 0, Math.PI * 2); g.stroke();
          g.beginPath(); g.moveTo(a[0] - 60, a[1]); g.lineTo(a[0] + 60, a[1]); g.moveTo(a[0], a[1] - 60); g.lineTo(a[0], a[1] + 60); g.stroke();
        }
        // keeper and ball
        var kp = anim ? anim.keeper : 1, k0 = zoneXY(1), k1 = zoneXY(kp), e = anim ? Math.min(1, t * 1.6) : 0;
        var kx = k0[0] + (k1[0] - k0[0]) * e, ky = GY + GH - 90 + (k1[1] - (GY + GH - 90)) * e * 0.8;
        g.save(); g.translate(kx, ky); g.rotate((k1[0] - k0[0]) / 400 * e);
        g.fillStyle = '#FF9F0A'; U.rr(g, -40, -60, 80, 120, 20); g.fill();
        g.fillStyle = '#FFE0B2'; g.beginPath(); g.arc(0, -84, 26, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#FF9F0A'; g.fillRect(-90, -50, 50, 18); g.fillRect(40, -50, 50, 18);
        g.restore();
        var bt = anim ? Math.min(1, t) : 0, b0 = [700, 690], b1 = anim ? zoneXY(anim.shot) : b0;
        var bx = b0[0] + (b1[0] - b0[0]) * bt, by = b0[1] + (b1[1] - b0[1]) * bt - Math.sin(bt * Math.PI) * 60, br = 30 - 12 * bt;
        g.fillStyle = '#FFF'; g.beginPath(); g.arc(bx, by, br, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#1C1C1E'; g.beginPath(); g.arc(bx, by, br * 0.38, 0, Math.PI * 2); g.fill();
        // score
        g.fillStyle = '#FFF'; g.font = '700 34px Inter, sans-serif'; g.textAlign = 'left';
        g.fillText(abbr + '  ' + marks(us), 40, 560); g.fillText(rival.slice(0, 3).toUpperCase() + '  ' + marks(them), 40, 610);
        g.textAlign = 'right'; g.font = '800 64px Inter, sans-serif'; g.fillText(scoreLine().replace(abbr + ' ', '').replace(' ' + rival.slice(0, 3).toUpperCase(), ''), 1360, 600);
        if (anim && t >= 1) {
          g.textAlign = 'center'; g.font = '800 80px Inter, sans-serif';
          g.fillStyle = '#FFF'; g.fillText(anim.goal ? 'GOL!' : anim.ours ? tr('DEFENDEU', 'SAVED', 'ATAJÓ') : tr('DEFESAÇA!', 'GREAT SAVE!', '¡ATAJADA!'), 700, 80);
        }
      }
      function decided() {
        var a = us.filter(Boolean).length, z = them.filter(Boolean).length, n = Math.max(us.length, them.length);
        if (n <= 5) {
          var leftUs = 5 - us.length, leftThem = 5 - them.length;
          if (a > z + leftThem || z > a + leftUs) return true;
          return us.length === 5 && them.length === 5 && a !== z;
        }
        return us.length === them.length && a !== z;
      }
      function kick(ours) {
        var shot = ours ? zone : rnd(6), keeper = ours ? (Math.random() < 0.3 ? shot : rnd(6)) : zone;
        // A shot to the keeper's zone is saved; the top corners miss now and then.
        var goal = shot !== keeper && !(Math.floor(shot / 3) === 0 && shot !== 1 && Math.random() < 0.12);
        anim = {shot: shot, keeper: keeper, goal: goal, ours: ours};
        var t0 = Date.now();
        cancelAnimationFrame(raf);
        (function frame() {
          var t = (Date.now() - t0) / 700;
          draw(t);
          if (t < 1.9) { raf = requestAnimationFrame(frame); return; }
          (ours ? us : them).push(goal);
          var line = scoreLine();
          More.island.set('shootout', {priority: 5, icon: '🥅', text: line, sub: tr('Pênaltis', 'Penalties', 'Penales'), right: marks(us).slice(0, 5)});
          if (goal && ours) More.test.goal(line);
          anim = null;
          if (decided()) {
            var won = us.filter(Boolean).length > them.filter(Boolean).length;
            phase = 'end';
            More.island.set('shootout', null);
            More.island.flash('shootout', {icon: won ? '🏆' : '😞', color: won ? '#000' : '#3D0B0B', text: line,
              big: {title: won ? tr('Vitória nos pênaltis!', 'Won on penalties!', '¡Ganó en penales!') : tr('Derrota nos pênaltis', 'Lost on penalties', 'Perdió en penales'), sub: line}}, 10000);
            if (won) U.best('penalties', (F.stored('best.penalties') || 0) + 1);
          } else phase = ours ? 'save' : 'shoot';
          zone = 1;
          prompt();
          draw(0);
        })();
      }
      function prompt() {
        tip.textContent = phase === 'shoot' ? tr('Sua cobrança: setas miram, OK chuta', 'Your kick: arrows aim, OK shoots', 'Tu penal: OK patea')
          : phase === 'save' ? tr('Defenda: setas escolhem o canto, OK pula', 'Save it: arrows pick a corner, OK dives', 'Ataja: OK salta')
          : tr('OK joga de novo · Vitórias: ', 'OK plays again · Wins: ', 'OK otra vez · Victorias: ') + (F.stored('best.penalties') || 0);
      }
      prompt();
      draw(0);
      return {key: function (k) {
        if (anim) return true;
        if (phase === 'end') { if (k === K.ok) penalties(); return true; }
        var col = zone % 3, row = Math.floor(zone / 3);
        if (k === K.left) col = Math.max(0, col - 1); else if (k === K.right) col = Math.min(2, col + 1);
        else if (k === K.up) row = 0; else if (k === K.down) row = 1;
        else if (k === K.ok) { kick(phase === 'shoot'); return true; }
        zone = row * 3 + col;
        draw(0);
        return true;
      }, stop: function () { cancelAnimationFrame(raf); More.island.set('shootout', null); }};
    });
  }

  Games.add('📅', tr('Adivinhe o ano', 'Guess the year', 'Adivina el año'), guessYear, 'year');
  Games.add('🔊', tr('Adivinhe pelo som', 'Guess by the sound', 'Por el sonido'), bySound, 'sound');
  Games.add('⭐', tr('Mais ou menos', 'Higher or lower', 'Más o menos'), higherLower, 'higher');
  Games.add('🪢', tr('Forca de filmes', 'Movie hangman', 'Ahorcado'), hangman, 'hangman');
  Games.add('🥅', tr('Pênaltis', 'Penalties', 'Penales') + ((CONFIG.team && CONFIG.team.nickname) ? ' do ' + CONFIG.team.nickname : ''), penalties, 'penalties');
})();
