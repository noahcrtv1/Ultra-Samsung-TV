/*
 * More: the Dynamic Island (one black pill at the top that everything reports to), your team (next game, pre-game,
 * live score, goals, the table), the welcome screen, severe weather and rain on screen, the night summary, the
 * forgotten-TV switch-off and the mood tint from the focused title's genre. Loaded after home.js, which hands over
 * what it needs as window.Home.
 */
var More = (function () {
  'use strict';

  var H = window.Home;
  var $ = H.$, el = H.el, setClass = H.setClass;

  function store(key, value) { try { localStorage.setItem('fmtv.more.' + key, JSON.stringify(value)); } catch (e) {} }
  function stored(key) { try { return JSON.parse(localStorage.getItem('fmtv.more.' + key)); } catch (e) { return null; } }
  function today() { var d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
  function hhmm(t) { return Data.time(t); }

  function get(url, done) {
    var x = new XMLHttpRequest();
    x.open('GET', url, true);
    x.timeout = 10000;
    x.onload = function () { try { done(x.status === 200 ? JSON.parse(x.responseText) : null); } catch (e) { done(null); } };
    x.onerror = x.ontimeout = function () { done(null); };
    x.send();
  }

  function ping(url) {
    if (!url) return;
    try { var x = new XMLHttpRequest(); x.open('GET', url, true); x.send(); } catch (e) {}
  }

  // MARK: - Dynamic Island

  /*
   * Activities: {id, priority, art (image url) | icon (emoji), text, right ('eq' or short text), color,
   * big: {title, sub}}. The highest priority one sits in the pill; a flash opens the island big for a few seconds.
   */
  var activities = {}, flashing = null, flashTimer = 0, shownKey = '';
  // Settings: 'on', 'important' (games, goals, weather, the night summary, premieres) or 'off'.
  var mode = stored('islandMode') || 'on', IMPORTANT = {game: 1, goal: 1, storm: 1, night: 1, premiere: 1};
  var hidden = {}, focused = false, expanded = false, idx = 0, act = 0;

  function allowed(id) { return mode === 'on' || (mode === 'important' && IMPORTANT[id]); }

  function set(id, a) {
    if (a) { a.id = id; activities[id] = a; } else delete activities[id];
    render();
  }

  function flash(id, a, ms) {
    if (!allowed(id)) return;
    delete hidden[id];   // something new: a hidden activity comes back
    a.id = id;
    flashing = a;
    clearTimeout(flashTimer);
    flashTimer = setTimeout(function () { flashing = null; render(); }, ms || 6000);
    render();
    H.wake();
  }

  /** What the island can show now, most important first. */
  function list() {
    var out = [];
    for (var k in activities) if (activities.hasOwnProperty(k) && allowed(k) && !hidden[k]) out.push(activities[k]);
    out.sort(function (a, b) { return b.priority - a.priority; });
    return out;
  }

  /** The buttons an opened activity offers; "Ocultar" is always last. */
  function actions(a) {
    var out = [];
    if (a.id === 'music') {
      var playing = (Plus.hub().music || {}).playing;
      out.push(['⏮', function () { Plus.hubPost('/api/music', {action: 'previous'}); }]);
      out.push([playing ? '❚❚' : '▶', function () { Plus.hubPost('/api/music', {action: playing ? 'pause' : 'play'}); }]);
      out.push(['⏭', function () { Plus.hubPost('/api/music', {action: 'next'}); }]);
    } else if (a.id === 'radio') {
      out.push(['■ ' + tr('Parar', 'Stop', 'Parar'), function () { if (window.Fun) Fun.stopRadio(); }]);
    } else if (a.id === 'game' && game) {
      var where = watchOn(game);
      if (where) out.push(['📺 ' + tr('Assistir: ', 'Watch: ', 'Ver: ') + where.label, where.run]);
    }
    out.push([tr('Ocultar', 'Hide', 'Ocultar'), function () { hidden[a.id] = true; collapse(); }]);
    return out;
  }

  // MARK: - Liquid entrance: the pill flows out of the top edge at its own size on a neck that pinches and snaps

  var fx = null, fxRaf = 0, fxBusy = false;

  function fxEase(t) { return 1 - Math.pow(1 - t, 3); }
  function fxBack(t) { var s = 1.7; t -= 1; return t * t * ((s + 1) * t + s) + 1; }
  function fxClamp(t) { return t < 0 ? 0 : t > 1 ? 1 : t; }

  /** One frame of the flow at t (0 → 1), for a pill pw × ph whose top rests at py. */
  function fxDraw(t, pw, ph, py) {
    var g = fx.getContext('2d'), CX = 960, half = pw / 2, r = Math.min(ph, 52) / 2;
    g.clearRect(0, 0, 1920, 260);
    g.fillStyle = '#000';
    var b = fxClamp(t / 0.62), y = -ph + (py + ph) * fxBack(b);
    var pinch = fxClamp((t - 0.15) / 0.45), snap = fxClamp((t - 0.55) / 0.35);
    if (snap < 1) {
      var waist = half * (1 - 0.92 * fxEase(pinch)), mid = Math.max(4, y * 0.5);
      g.beginPath();
      if (!snap) {
        g.moveTo(CX - half, -2);
        g.bezierCurveTo(CX - half, mid * 0.6, CX - waist, mid * 0.6, CX - waist, mid);
        g.bezierCurveTo(CX - waist, mid + (y - mid) * 0.5, CX - half + r * 0.4, y - 2, CX - half + r, y + 2);
        g.lineTo(CX + half - r, y + 2);
        g.bezierCurveTo(CX + half - r * 0.4, y - 2, CX + waist, mid + (y - mid) * 0.5, CX + waist, mid);
        g.bezierCurveTo(CX + waist, mid * 0.6, CX + half, mid * 0.6, CX + half, -2);
        g.closePath();
        g.fill();
      } else {
        var up = mid * (1 - fxEase(snap)), uw = waist * (1 - snap * 0.5), k = 1 - snap;
        g.moveTo(CX - half * k, -2);
        g.bezierCurveTo(CX - half * k, up * 0.6, CX - uw, up * 0.7, CX, up);
        g.bezierCurveTo(CX + uw, up * 0.7, CX + half * k, up * 0.6, CX + half * k, -2);
        g.closePath();
        g.fill();
        var bump = (y - mid) * 0.5 * (1 - fxEase(snap));
        g.beginPath();
        g.moveTo(CX - half + r, y + 2);
        g.bezierCurveTo(CX - uw * 1.4, y, CX - uw * 0.6, y - bump, CX, y - bump);
        g.bezierCurveTo(CX + uw * 0.6, y - bump, CX + uw * 1.4, y, CX + half - r, y + 2);
        g.closePath();
        g.fill();
      }
    }
    var land = fxClamp((t - 0.5) / 0.5), wob = Math.sin(land * Math.PI * 2.5) * (1 - land) * 7, h = ph - wob * 0.6, rad = Math.min(h / 2, ph > 60 ? 46 : h / 2);
    var x = CX - half - wob, w = pw + wob * 2, top = y + wob * 0.3;
    g.beginPath();
    g.moveTo(x + rad, top);
    g.arcTo(x + w, top, x + w, top + h, rad);
    g.arcTo(x + w, top + h, x, top + h, rad);
    g.arcTo(x, top + h, x, top, rad);
    g.arcTo(x, top, x + w, top, rad);
    g.closePath();
    g.fill();
  }

  /** Runs the flow in (dir 1) or back up into the edge (dir -1), then done(). */
  function fxRun(dir, pw, ph, done) {
    fx = fx || $('islandfx');
    cancelAnimationFrame(fxRaf);
    fxBusy = true;
    var t0 = Date.now(), dur = dir > 0 ? 1000 : 650;
    (function frame() {
      var t = fxClamp((Date.now() - t0) / dur);
      fxDraw(dir > 0 ? t : 1 - t, pw, ph, 18);
      if (t < 1) { fxRaf = requestAnimationFrame(frame); return; }
      fxBusy = false;
      if (dir < 0) fx.getContext('2d').clearRect(0, 0, 1920, 260);
      if (done) done();
    })();
  }

  var shownOn = false;

  function render() {
    var box = $('island'), items = list();
    if (focused && !items.length) { unfocus(); return; }
    idx = Math.min(idx, Math.max(0, items.length - 1));
    var a = focused ? items[idx] : flashing || items[0], big = expanded || (!focused && !!flashing);
    setClass(box, 'focus', focused);
    if (!a) {
      shownKey = '';
      if (shownOn) {
        shownOn = false;
        var bigNow = hasBig(box);
        setClass(box, 'on', false);
        fxRun(-1, bigNow ? 640 : 300, bigNow ? 132 : 52);
      }
      return;
    }
    if (!shownOn) {
      // Entering: the liquid flows out first, the pill (with its content) appears where it lands.
      shownOn = true;
      var willBig = expanded || (!focused && !!flashing);
      fxRun(1, willBig ? 640 : 300, willBig ? 132 : 52, function () {
        setClass(box, 'on', shownOn);
        fx.getContext('2d').clearRect(0, 0, 1920, 260);
      });
    } else if (!fxBusy) setClass(box, 'on', true);
    var acts = expanded ? actions(a) : [];
    var key = JSON.stringify(a) + big + focused + act + acts.length + items.length + idx;
    if (key === shownKey) return;
    shownKey = key;
    box.innerHTML = '';
    box.style.background = a.color || '';
    var lead = el('div', 'art', box);
    if (a.art) lead.style.backgroundImage = 'url(' + a.art + ')';
    else { setClass(lead, 'icon', true); lead.textContent = a.icon || '•'; }
    var t = el('div', 'txt', box);
    el('div', 'song', t, big && a.big ? a.big.title : a.text);
    el('div', 'artist', t, big && a.big ? a.big.sub || '' : a.sub || '');
    if (a.right === 'eq') {
      var eq = el('div', 'eq', box);
      for (var i = 0; i < 4; i++) el('i', '', eq);
    } else if (a.right) el('div', 'right', box, a.right);
    if (focused && items.length > 1 && !expanded) el('div', 'dots', box, (idx + 1) + '/' + items.length);
    if (expanded) {
      var row = el('div', 'acts', box);
      acts.forEach(function (x, n) {
        var b = el('div', 'iact' + (n === act ? ' focus' : ''), row, x[0]);
        b.onclick = function () { act = n; x[1](); render(); };
      });
    }
    setClass(box, 'big', big);
    setClass(box, 'open', expanded);
  }

  function hasBig(b) { return (' ' + b.className + ' ').indexOf(' big ') >= 0; }

  function collapse() { expanded = false; act = 0; shownKey = ''; render(); if (!list().length) unfocus(); }

  function unfocus() {
    focused = false;
    expanded = false;
    shownKey = '';
    setClass($('island'), 'focus', false);
    render();
    H.backToTop();
  }

  /** ↑ from the top row: the island takes the focus (when there's something in it). */
  function focusIsland() {
    if (!list().length) return false;
    focused = true;
    expanded = false;
    idx = 0;
    act = 0;
    flashing = null;
    shownKey = '';
    render();
    return true;
  }

  function islandKey(k) {
    var K = TV.keys, items = list(), a = items[idx];
    if (!a) { unfocus(); return; }
    if (k === K.left || k === K.right) {
      var d = k === K.left ? -1 : 1;
      if (expanded) act = Math.max(0, Math.min(actions(a).length - 1, act + d));
      else idx = (idx + d + items.length) % items.length;
    } else if (k === K.ok) {
      if (!expanded) { expanded = true; act = 0; }
      else { var x = actions(a)[act]; if (x) x[1](); }
    } else if (k === K.back || k === 27 || k === 8) {
      if (expanded) { collapse(); return; }
      unfocus();
      return;
    } else if (k === K.down) { unfocus(); return; }
    shownKey = '';
    render();
  }

  /** Music from the Mac hub (Spotify): a new song opens the island for a moment. */
  var lastSong = '';
  function music() {
    var m = Plus.hub().music || {};
    if (!m.playing) { set('music', null); return; }
    var a = {priority: 1, art: m.art, text: m.title, sub: m.artist, right: 'eq', big: {title: m.title, sub: m.artist}};
    set('music', a);
    var k = m.title + m.artist;
    if (k !== lastSong) { lastSong = k; flash('music', a, 6000); }
  }

  // MARK: - Your team (ESPN's public scoreboard)

  // The team comes from config.properties (team_espn_id, team_abbr, team_name, team_nickname, team_leagues,
  // team_schedule_url); without team_espn_id everything about games stays off.
  var T = CONFIG.team || {}, TEAM = String(T.espnId || ''), ABBR = T.abbr || 'TIME', TEAM_NAME = T.name || '';
  var NICK = T.nickname || TEAM_NAME, LEAGUES = T.leagues && T.leagues.length ? T.leagues : ['bra.1'];
  var ESPN = 'https://site.api.espn.com/apis/site/v2/sports/soccer/';
  var game = null, nextGames = stored('nextGames') || [], table = stored('table') || null, gameTimer = 0, score = stored('score') || {};

  // Where each game is on (Globo, Premiere, sportv, globoplay, Ge TV…), from the team's ge.globo schedule page: it
  // comes inside the page as JSON (window.dataSportsSchedule). By local date, "2026-11-04" → ['Premiere', 'Globo', …].
  var channels = stored('channels') || {};

  function refreshChannels() {
    var at = stored('channelsAt') || 0;
    if (Date.now() - at < 6 * 3600000 && Object.keys(channels).length) return;
    var x = new XMLHttpRequest();
    if (!T.scheduleUrl) return;
    x.open('GET', T.scheduleUrl, true);
    x.timeout = 15000;
    x.onload = function () {
      try {
        var s = x.responseText, i = s.indexOf('scheduleTeam: ');
        if (i < 0) return;
        var text = s.slice(i + 14), depth = 0, end = 0;
        for (var n = 0; n < text.length; n++) {
          var ch = text.charAt(n);
          if (ch === '"') { n++; while (n < text.length && text.charAt(n) !== '"') { if (text.charAt(n) === '\\') n++; n++; } }
          else if (ch === '{') depth++;
          else if (ch === '}') { depth--; if (!depth) { end = n + 1; break; } }
        }
        var obj = JSON.parse(text.slice(0, end)), out = {};
        (obj.teamAgenda.future || []).concat(obj.teamAgenda.now || []).forEach(function (e) {
          var m = e.match;
          if (!m || !m.startDate) return;
          out[m.startDate] = (m.liveWatchSources || []).map(function (w) { return w.name; }).filter(function (nm) { return !/cartola/i.test(nm); });
        });
        channels = out;
        store('channels', channels);
        store('channelsAt', Date.now());
      } catch (e) {}
    };
    x.send();
  }

  function localDay(t) { var d = new Date(t); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function channelsFor(g) { return channels[localDay(g.at)] || []; }

  /** Where to watch it on this TV: the antenna for Globo, else the app that carries it. */
  var WATCH = [[/^globo$/i, 'live'], [/sportv|premiere|globoplay/i, 'globoplay'], [/ge tv|caz|youtube/i, 'youtube'],
    [/prime|amazon/i, 'prime'], [/disney|espn/i, 'disney'], [/max|tnt/i, 'max'], [/paramount/i, 'paramount']];
  function watchOn(g) {
    var list = channelsFor(g);
    for (var w = 0; w < WATCH.length; w++) {
      for (var i = 0; i < list.length; i++) {
        if (!WATCH[w][0].test(list[i])) continue;
        if (WATCH[w][1] === 'live') return {label: tr('Globo (antena)', 'Globo (antenna)', 'Globo (antena)'), run: H.openLive};
        var app = Data.appFor(WATCH[w][1]);
        if (app) return {label: list[i] + ' · ' + app.title, run: (function (a) { return function () { H.launch(a.id, a.title); }; })(app)};
      }
    }
    return null;
  }

  function side(c, home) {
    for (var i = 0; i < c.competitors.length; i++) if ((c.competitors[i].homeAway === 'home') === home) return c.competitors[i];
    return c.competitors[home ? 0 : 1];
  }

  function parseEvent(e, league) {
    var c = e.competitions[0], h = side(c, true), a = side(c, false), st = c.status || e.status || {};
    var us = h.team.id === TEAM ? h : a, them = us === h ? a : h;
    var tv = '';
    try { tv = (c.broadcasts || []).map(function (b) { return (b.names || []).join(', '); }).join(', ') || (c.geoBroadcasts || []).map(function (b) { return b.media.shortName; }).join(', '); } catch (x) {}
    return {
      id: e.id, at: Date.parse(e.date), league: league, name: e.name,
      state: st.type ? st.type.state : 'pre', clock: st.displayClock || '', detail: st.type ? st.type.shortDetail : '',
      us: {abbr: ABBR, score: +(us.score && us.score.displayValue !== undefined ? us.score.displayValue : us.score) || 0, logo: us.team.logo},
      them: {abbr: them.team.abbreviation, name: them.team.shortDisplayName || them.team.displayName,
        score: +(them.score && them.score.displayValue !== undefined ? them.score.displayValue : them.score) || 0, logo: them.team.logo},
      home: us === h, tv: tv
    };
  }

  /** Next games, from each competition's schedule (twice a day). */
  function refreshSchedule() {
    if (!TEAM) return;
    var at = stored('scheduleAt') || 0;
    if (Date.now() - at < 12 * 3600000 && nextGames.length) return;
    var found = [], left = LEAGUES.length;
    LEAGUES.forEach(function (lg) {
      get(ESPN + lg + '/teams/' + TEAM + '/schedule?fixture=true', function (r) {
        (r && r.events || []).forEach(function (e) { try { found.push(parseEvent(e, lg)); } catch (x) {} });
        if (--left) return;
        found.sort(function (a, b) { return a.at - b.at; });
        nextGames = found.filter(function (g) { return g.at > Date.now() - 3 * 3600000; }).slice(0, 5);
        store('nextGames', nextGames);
        store('scheduleAt', Date.now());
      });
    });
    get('https://site.api.espn.com/apis/v2/sports/soccer/bra.1/standings', function (r) {
      try {
        var entries = r.children[0].standings.entries, rows = [];
        entries.forEach(function (en) {
          var stat = {};
          en.stats.forEach(function (s) { stat[s.name] = s.value; });
          rows.push({id: en.team.id, name: en.team.shortDisplayName, abbr: en.team.abbreviation, rank: stat.rank, points: stat.points, played: stat.gamesPlayed});
        });
        rows.sort(function (a, b) { return a.rank - b.rank; });
        table = rows;
        store('table', table);
      } catch (x) {}
    });
  }

  /** Today's game, from the live scoreboards: every minute near kickoff, every 20 s while it's on. */
  function pollGame() {
    clearTimeout(gameTimer);
    if (!TEAM) return;
    var soon = nextGames.filter(function (g) { return g.at - Date.now() < 30 * 60000 && Date.now() - g.at < 3 * 3600000; })[0];
    if (!soon) { set('game', null); gameTimer = setTimeout(pollGame, 5 * 60000); return; }
    get(ESPN + soon.league + '/scoreboard', function (r) {
      var e = r && (r.events || []).filter(function (x) { return x.id === soon.id; })[0];
      if (e) { try { onGame(parseEvent(e, soon.league)); } catch (x) {} } else onGame(soon);
      gameTimer = setTimeout(pollGame, game && game.state === 'in' ? 20000 : 60000);
    });
  }

  var GREEN = '#0B0B0B';

  function onGame(g) {
    var was = game;
    game = g;
    if (channelsFor(g).length) g.tv = channelsFor(g).join(', ');
    var vs = (g.home ? ABBR + ' × ' + g.them.abbr : g.them.abbr + ' × ' + ABBR);
    if (g.state === 'pre') {
      var min = Math.max(0, Math.round((g.at - Date.now()) / 60000));
      set('game', {priority: 4, art: g.them.logo, text: vs + (min ? ' em ' + min + ' min' : ' agora'), right: '⚽', sub: g.tv,
        big: {title: 'Pré-jogo: ' + vs, sub: (g.tv ? g.tv + ' · ' : '') + hhmm(g.at)}});
      if (min <= 10 && stored('pregame') !== g.id) {
        store('pregame', g.id);
        ping(CONFIG.voiceMonkeyPregameUrl);
        flash('game', activities.game, 10000);
      }
      return;
    }
    var line = g.home ? ABBR + ' ' + g.us.score + ' × ' + g.them.score + ' ' + g.them.abbr : g.them.abbr + ' ' + g.them.score + ' × ' + g.us.score + ' ' + ABBR;
    if (g.state === 'in') {
      set('game', {priority: 6, art: g.them.logo, text: line, right: g.clock || g.detail, color: GREEN, big: {title: line, sub: g.detail}});
      if (!was || was.state === 'pre') flash('game', {icon: '⚽', text: 'Começou!', big: {title: 'Começou: ' + vs, sub: g.tv ? 'Passa em ' + g.tv : ''}}, 8000);
    } else {
      set('game', {priority: 2, art: g.them.logo, text: line, right: 'Fim', big: {title: 'Fim de jogo', sub: line}});
      if (was && was.state === 'in') flash('game', {icon: g.us.score > g.them.score ? '🏆' : g.us.score === g.them.score ? '🤝' : '😞', text: 'Fim: ' + line,
        big: {title: g.us.score > g.them.score ? tr('Vitória do ', 'Win for ', 'Victoria del ') + NICK + '!' : g.us.score === g.them.score ? 'Empate' : 'Derrota', sub: line}}, 12000);
      setTimeout(function () { if (game === g) set('game', null); }, 2 * 3600000);
    }
    // Goals: compared with the last score seen for this game (kept across reloads).
    var old = score[g.id];
    if (old && g.us.score > old.us) goal(line);
    else if (old && g.them.score > old.them) flash('goal', {icon: '😬', text: 'Gol do ' + g.them.abbr, big: {title: 'Gol do ' + g.them.name, sub: line}}, 7000);
    score = {};
    score[g.id] = {us: g.us.score, them: g.them.score};
    store('score', score);
  }

  function goal(line) {
    flash('goal', {icon: '⚽', color: '#000', text: 'GOOOOL!', big: {title: tr('GOOOOOL DO ', 'GOOOOOAL ', 'GOOOOOL DEL ') + NICK.toUpperCase() + '!', sub: line}}, 12000);
    setClass(document.body, 'goal', true);
    setTimeout(function () { setClass(document.body, 'goal', false); }, 6000);
    roar();
    ping(CONFIG.voiceMonkeyGoalUrl);
  }

  /** A crowd roar, synthesized (filtered noise swelling and fading): no sound file to ship. */
  function roar() {
    try {
      var A = window.AudioContext || window.webkitAudioContext, ctx = new A(), len = ctx.sampleRate * 5;
      var buf = ctx.createBuffer(2, len, ctx.sampleRate);
      for (var c = 0; c < 2; c++) {
        var d = buf.getChannelData(c), last = 0;
        for (var i = 0; i < len; i++) { last = (last + 0.04 * (Math.random() * 2 - 1)) / 1.04; d[i] = last * 3.5; }
      }
      var src = ctx.createBufferSource(), band = ctx.createBiquadFilter(), gain = ctx.createGain();
      src.buffer = buf;
      band.type = 'bandpass';
      band.frequency.value = 900;
      band.Q.value = 0.6;
      gain.gain.setValueAtTime(0.001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.9, ctx.currentTime + 0.6);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 5);
      src.connect(band);
      band.connect(gain);
      gain.connect(ctx.destination);
      src.start();
      setTimeout(function () { try { ctx.close(); } catch (e) {} }, 5500);
    } catch (e) {}
  }

  /** The drawer's team panel: the table around your team and the next games. */
  function panel() {
    H.openPanel(function (box) {
      el('div', 'title', box, TEAM_NAME);
      var me = table && table.filter(function (r) { return r.id === TEAM; })[0];
      if (me) el('div', 'line', box, me.rank + 'º no Brasileirão · ' + me.points + ' pts em ' + me.played + ' jogos');
      if (table && me) {
        var list = el('div', 'tbl', box), from = Math.max(0, Math.min(table.length - 5, me.rank - 3));
        table.slice(from, from + 5).forEach(function (r) {
          var row = el('div', 'trow' + (r.id === TEAM ? ' me' : ''), list);
          el('span', 'pos', row, r.rank + 'º');
          el('span', 'tn', row, r.name);
          el('span', 'pts', row, r.points + ' pts');
        });
      }
      el('div', 'sub', box, 'Próximos jogos');
      nextGames.slice(0, 3).forEach(function (g) {
        var d = new Date(g.at);
        var day = d.toLocaleDateString(I18N.locale(), {weekday: 'short', day: 'numeric', month: 'short'});
        var ch = channelsFor(g);
        el('div', 'small', box, day + ' ' + hhmm(g.at) + ' · ' + (g.home ? ABBR + ' × ' + g.them.name : g.them.name + ' × ' + ABBR) + (ch.length ? ' · ' + ch.join(', ') : ''));
      });
      if (!nextGames.length) el('div', 'small', box, 'Sem jogos marcados (ou sem internet)');
    });
  }

  // MARK: - Weather: severe weather on the island, rain on screen

  var stormShown = stored('stormShown') || 0;

  function weather() {
    var w = Data.weatherNow();
    if (!w) return;
    var raining = (w.code >= 51 && w.code <= 67) || (w.code >= 80 && w.code <= 82) || w.code >= 95;
    setClass(document.body, 'raining', raining);
    setClass(document.body, 'storming', w.code >= 95);
    if (w.storm) {
      var s = w.storm, what = s.kind === 'storm' ? 'Tempestade' : s.kind === 'rain' ? 'Chuva forte (' + Math.round(s.mm) + ' mm/h)' : 'Ventos de ' + Math.round(s.kmh) + ' km/h';
      var a = {priority: 3, icon: s.kind === 'wind' ? '💨' : '⛈', text: what + ' às ' + Data.hour(s.at), color: '#3A1F00',
        big: {title: 'Alerta: ' + what.toLowerCase(), sub: 'Previsão para ' + Data.hour(s.at) + ' em ' + Data.city}};
      set('storm', a);
      if (stormShown !== s.at) { stormShown = s.at; store('stormShown', s.at); flash('storm', a, 10000); }
    } else set('storm', null);
  }

  // MARK: - Welcome (first time the screen is seen each day, 5 s) and the night summary (23 h)

  function welcome(tries) {
    if (stored('welcomed') === today()) return;
    tries = tries || 0;
    if (!Data.weatherNow() && tries < 8) { setTimeout(function () { welcome(tries + 1); }, 1000); return; }
    store('welcomed', today());
    var w = Data.weatherNow(), v = Plus.verse(), box = $('welcome');
    box.innerHTML = '';
    el('div', 'hello', box, H.greeting());
    var d = new Date();
    el('div', 'date', box, d.toLocaleDateString(I18N.locale(), {weekday: 'long', day: 'numeric', month: 'long'}) + ' · ' + hhmm(d.getTime()));
    var row = el('div', 'tiles', box);
    if (w) {
      var t = el('div', 'wtile', row);
      el('div', 'big', t, Data.degrees(w.temp));
      el('div', 'small', t, Data.condition(w.code, w.isDay) + ' · ' + Data.degrees(w.max) + ' / ' + Data.degrees(w.min));
    }
    var g = nextGames.filter(function (x) { return new Date(x.at).toDateString() === d.toDateString(); })[0];
    if (g) {
      if (channelsFor(g).length) g.tv = channelsFor(g).join(', ');
      var t2 = el('div', 'wtile', row);
      el('div', 'big', t2, '⚽ ' + hhmm(g.at));
      el('div', 'small', t2, (g.home ? ABBR + ' × ' + g.them.name : g.them.name + ' × ' + ABBR) + (g.tv ? ' · ' + g.tv : ''));
    }
    var vv = el('div', 'verse', box);
    el('div', 'text', vv, '“' + v.text + '”');
    el('div', 'ref', vv, v.ref);
    el('div', 'bar', box);
    setClass(box, 'on', true);
    welcomeTimer = setTimeout(hideWelcome, 5000);
  }
  var welcomeTimer = 0;
  function hideWelcome() { clearTimeout(welcomeTimer); setClass($('welcome'), 'on', false); }
  function welcomeOn() { var b = $('welcome'); return b && (' ' + b.className + ' ').indexOf(' on ') >= 0; }

  function nightSummary() {
    var d = new Date();
    if (d.getHours() !== 23 || stored('night') === today()) return;
    store('night', today());
    var w = Data.weatherNow(), parts = [];
    if (game && new Date(game.at).toDateString() === d.toDateString() && game.state === 'post') {
      parts.push((game.home ? ABBR + ' ' + game.us.score + '×' + game.them.score + ' ' + game.them.abbr : game.them.abbr + ' ' + game.them.score + '×' + game.us.score + ' ' + ABBR));
    }
    if (w && w.tomorrow) parts.push('Amanhã ' + Data.degrees(w.tomorrow.max) + ' / ' + Data.degrees(w.tomorrow.min));
    var nx = nextGames.filter(function (g) { return g.at > Date.now(); })[0];
    if (nx) parts.push('Próximo jogo ' + new Date(nx.at).toLocaleDateString(I18N.locale(), {weekday: 'short'}) + ' ' + hhmm(nx.at));
    flash('night', {icon: '🌙', text: 'Resumo da noite', big: {title: 'Resumo da noite', sub: parts.join(' · ') || 'Boa noite!'}}, 15000);
  }

  // MARK: - The forgotten TV: 20 minutes without the remote on the home screen → "Still there?" → off in 60 s

  var IDLE_OFF = 20 * 60000, offTimer = 0, offLeft = 0;

  function checkIdle() {
    if (offTimer || document.hidden || H.playing() || !Plus.hubUrl('/')) return;
    if (Date.now() - H.idleAt() < IDLE_OFF) return;
    checkIdleNow();
  }

  function checkIdleNow() {
    offLeft = 60;
    var box = $('stillthere');
    setClass(box, 'on', true);
    (function tick() {
      box.innerHTML = '';
      el('div', 'q', box, 'Ainda está aí?');
      el('div', 'n', box, 'A TV desliga em ' + offLeft + ' s');
      el('div', 'small', box, 'Aperte qualquer botão para continuar');
      if (offLeft-- <= 0) { cancelOff(); Plus.hubPost('/api/key', {key: 'KEY_POWER'}); return; }
      offTimer = setTimeout(tick, 1000);
    })();
  }

  function cancelOff() {
    clearTimeout(offTimer);
    offTimer = 0;
    setClass($('stillthere'), 'on', false);
  }

  // MARK: - Mood: the focused title's genre tints the background

  var MOODS = [[27, 'horror'], [53, 'horror'], [35, 'comedy'], [10751, 'family'], [16, 'family'], [878, 'scifi'], [10765, 'scifi'],
    [14, 'scifi'], [10749, 'romance'], [28, 'action'], [10759, 'action'], [12, 'action'], [10752, 'action'], [18, 'drama'], [99, 'docs']];

  function mood(p) {
    var name = '';
    for (var i = 0; p && p.genres && i < MOODS.length && !name; i++) if (p.genres.indexOf(MOODS[i][0]) >= 0) name = MOODS[i][1];
    var b = document.body;
    b.className = b.className.replace(/\s*mood-\w+/g, '') + (name ? ' mood-' + name : '');
  }

  // MARK: - Start

  function tick() {
    weather();
    nightSummary();
    checkIdle();
  }

  (function drops() {
    var r = $('rain');
    for (var i = 0; i < 40; i++) {
      var d = el('i', '', r);
      d.style.left = Math.round(Math.random() * 2000) + 'px';
      d.style.webkitAnimationDelay = d.style.animationDelay = (-Math.random() * 1.2).toFixed(2) + 's';
      d.style.webkitAnimationDuration = d.style.animationDuration = (0.7 + Math.random() * 0.5).toFixed(2) + 's';
      d.style.opacity = (0.4 + Math.random() * 0.6).toFixed(2);
    }
  })();

  refreshSchedule();
  refreshChannels();
  setTimeout(pollGame, 3000);
  setInterval(function () { refreshSchedule(); refreshChannels(); }, 3600000);
  setInterval(tick, 15000);
  setTimeout(tick, 2000);
  setTimeout(function () { welcome(0); }, 1500);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) setTimeout(function () { welcome(0); }, 800); });
  Plus.onHub(music);
  Data.onChange(weather);

  return {
    island: {set: set, flash: flash},
    focusIsland: focusIsland,
    islandMode: function () { return mode; },
    setIslandMode: function (m) { mode = m; store('islandMode', m); shownKey = ''; render(); },
    team: TEAM ? panel : null,
    teamName: TEAM_NAME,
    mood: mood,
    /** A key press: true when it was used here (closing the welcome screen or keeping the TV on). */
    key: function (k) {
      if (offTimer) { cancelOff(); return true; }
      if (focused) { islandKey(k); return true; }
      if (welcomeOn()) { hideWelcome(); return true; }
      return false;
    },
    test: {goal: goal, onGame: onGame, stillThere: function () { offTimer = 0; checkIdleNow(); }, weather: weather, welcome: function () { store('welcomed', ''); welcome(0); }, night: function () { store('night', ''); nightSummary(); }}
  };
})();
