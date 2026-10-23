/*
 * The home screen for web-app TVs (LG webOS, Samsung Tizen), with the Android app's design and behavior (HomeView):
 *  - top: the "For You" title and the tabs (Explore, Movies, Shows); icon-only glass buttons at the right (Live TV,
 *    HDMI Inputs, Settings) and the crypto quotes at the end of the tab row;
 *  - three picks for this hour in the selected tab; the background is the first one's photo, blurred and almost white;
 *  - the glass shelf with the apps; ↓ opens the drawer (inputs, shortcuts, weather, prices); ↑ or Back closes it;
 *  - a night look from sunset to sunrise; a screensaver after a few idle minutes.
 * The remote's arrows, OK and Back move the focus; a pointer (LG's Magic Remote) focuses what it points at.
 */
(function () {
  'use strict';

  function $(id) { return document.getElementById(id); }

  function el(tag, cls, parent, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    if (parent) parent.appendChild(e);
    return e;
  }

  function sym(name, parent, size) {
    var s = el('span', 'sym', parent);
    s.style.webkitMaskImage = 'url(symbols/' + name + '.png)';
    s.style.maskImage = 'url(symbols/' + name + '.png)';
    if (size) { s.style.width = size + 'px'; s.style.height = size + 'px'; }
    return s;
  }

  function coin(i, parent) {
    var c = window.COINS && window.COINS[i];
    if (!c) return;
    var ns = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 32 32');
    for (var k = 0; k < c.length; k++) {
      var p = document.createElementNS(ns, 'path');
      p.setAttribute('d', c[k]);
      p.setAttribute('fill-rule', 'evenodd');
      svg.appendChild(p);
    }
    parent.appendChild(svg);
  }

  function hasClass(e, c) { return (' ' + e.className + ' ').indexOf(' ' + c + ' ') >= 0; }
  function setClass(e, c, on) {
    if (!e) return;
    if (on && !hasClass(e, c)) e.className = (e.className + ' ' + c).replace(/^\s+/, '');
    else if (!on && hasClass(e, c)) e.className = (' ' + e.className + ' ').replace(' ' + c + ' ', ' ').replace(/^\s+|\s+$/g, '');
  }

  var stage = $('stage'), body = document.body;

  /** The 1920 × 1080 stage fills the window (on the TV it already is 1920 × 1080). */
  function fit() {
    var s = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
    stage.style.webkitTransform = stage.style.transform = s === 1 ? '' : 'scale(' + s + ')';
  }

  // MARK: - Apps on the shelf

  /** Shelf apps in this order when installed, like the Android app: key, LG app id, name on the TV, brand gradient. */
  var SHELF = [
    ['netflix', /^netflix$/, /netflix/i, ['#0A0A0A', '#000000']],
    ['youtube', /youtube/, /^youtube$/i, ['#1C1C1E', '#09090A']],
    ['prime', /^amazon$|primevideo$|AmazonIgnition/, /prime video|amazon (prime )?video/i, ['#2AA8FF', '#0A68D4']],
    ['disney', /disney/, /disney/i, ['#173584', '#08143F']],
    ['max', /(^|\.)hbo|hbo(go|now|max)|wbd|beamctv/i, /^(hbo )?max$|hbo max/i, ['#5C30E8', '#221684']],
    ['appletv', /appletv|apple\.tv/, /apple tv/i, ['#1C1C1E', '#000000']],
    ['hulu', /^hulu/, /hulu/i, ['#1CE783', '#0B8F4E']],
    ['paramount', /paramount|cbs/, /paramount/i, ['#0064FF', '#002A86']],
    ['peacock', /peacock/, /peacock/i, ['#1C1C1E', '#000000']],
    ['nfl', /nfl/, /^nfl/i, ['#013369', '#00163D']],
    ['globoplay', /globoplay/, /globoplay/i, ['#FF8A1F', '#FF2D5A']],
    ['spotify', /spotify/, /spotify/i, ['#1DB954', '#0F7A36']]
  ];
  var MAX_SHELF = 8;

  function shelfKey(app) {
    for (var i = 0; i < SHELF.length; i++) if (SHELF[i][1].test(app.id) || SHELF[i][2].test(app.title)) return SHELF[i];
    return null;
  }

  function darken(hex, f) {
    var m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
    if (!m) return '#161618';
    var n = parseInt(m[1], 16), r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    return 'rgb(' + Math.round(r * f) + ',' + Math.round(g * f) + ',' + Math.round(b * f) + ')';
  }

  /** A name that fits the tile on one line (the font shrinks for long names). */
  function wordFit(title, width, max) {
    return Math.max(18, Math.min(max, Math.floor(width * 0.8 / (Math.max(4, title.length) * 0.56))));
  }

  /** An app's face: its own icon on its brand color (or its name, when the icon can't be read). */
  // 16:9 art for the shelf apps (their own icon, its background carried out to the edges), so every tile matches
  // whatever icon the TV hands out: on Samsung some are wordmarks, some small square icons, some missing.
  var TILE_ART = {netflix: 1, youtube: 1, prime: 1, disney: 1, max: 1, appletv: 1, hulu: 1, paramount: 1, peacock: 1,
    globoplay: 1, spotify: 1};

  function face(app, box, wordSize) {
    var k = shelfKey(app);
    var top = k ? k[3][0] : app.color ? darken(app.color, 0.92) : '#2A2A2E';
    var bottom = k ? k[3][1] : app.color ? darken(app.color, 0.62) : '#161618';
    box.style.background = '-webkit-linear-gradient(top, ' + top + ', ' + bottom + ')';
    box.style.background = 'linear-gradient(' + top + ', ' + bottom + ')';
    var word = el('div', 'word', box, app.title);
    if (wordSize) word.style.fontSize = wordSize + 'px';
    if (k && TILE_ART[k[0]]) {
      var art = new Image(), url = 'icons/tile-' + k[0] + '.png';
      word.style.visibility = 'hidden';
      art.onload = function () {
        box.style.backgroundImage = 'url("' + url + '")';
        box.style.backgroundSize = 'cover';
        box.style.backgroundPosition = 'center';
      };
      art.onerror = function () { word.style.visibility = ''; };
      art.src = url;
      return;
    }
    if (app.icon) {
      var img = el('img', '', box);
      word.style.visibility = 'hidden';
      img.onerror = function () { img.parentNode.removeChild(img); word.style.visibility = ''; };
      img.src = app.icon;
    }
  }

  var apps = [], shelf = [], others = [], inputs = [];

  function pickShelf() {
    var chosen = Prefs.shelf(), out = [];
    if (chosen) {
      for (var i = 0; i < chosen.length && out.length < MAX_SHELF; i++) {
        for (var j = 0; j < apps.length; j++) if (apps[j].id === chosen[i]) out.push(apps[j]);
      }
    } else {
      for (var s = 0; s < SHELF.length && out.length < MAX_SHELF; s++) {
        for (var a = 0; a < apps.length; a++) {
          if ((SHELF[s][1].test(apps[a].id) || SHELF[s][2].test(apps[a].title)) && out.indexOf(apps[a]) < 0) { out.push(apps[a]); break; }
        }
      }
      if (!out.length) out = apps.slice(0, MAX_SHELF);
    }
    shelf = out;
    others = apps.filter(function (x) { return shelf.indexOf(x) < 0; });
  }

  // MARK: - Focus

  var Z = {TOP: 'top', CARDS: 'cards', SHELF: 'shelf', DRAWER: 'drawer', APPS: 'apps', SETTINGS: 'settings', EDIT: 'edit',
    DETAIL: 'detail', PANEL: 'panel', SEARCH: 'search'};
  var NT = 5;   // tabs: Explore, Movies, Shows, What's New, My List
  var st = {zone: Z.SHELF, top: 0, tab: 0, card: 0, shelf: 0, drawer: 0, grid: 0, row: 0, edit: 0, action: 0, sRow: 0, sCol: 0};
  var buttonDefs = [];
  var cards = [];

  function sheetOpen() { return st.zone === Z.APPS || st.zone === Z.SETTINGS || st.zone === Z.EDIT || st.zone === Z.DETAIL || st.zone === Z.PANEL || st.zone === Z.SEARCH; }

  function updateFocus() {
    var i, list;
    list = $('tabs').children;
    for (i = 0; i < list.length; i++) {
      setClass(list[i], 'on', i === st.tab);
      setClass(list[i], 'focus', st.zone === Z.TOP && st.top === i);
    }
    list = $('buttons').children;
    for (i = 0; i < list.length; i++) setClass(list[i], 'focus', st.zone === Z.TOP && st.top === NT + i);
    setClass($('quotes'), 'hide', st.zone === Z.TOP && st.top >= NT);
    setClass($('top'), 'top-buttons', st.zone === Z.TOP && st.top >= NT);
    list = $('cards').children;
    for (i = 0; i < list.length; i++) setClass(list[i], 'focus', st.zone === Z.CARDS && st.card === i);
    list = $('tiles').children;
    for (i = 0; i < list.length; i++) setClass(list[i], 'focus', st.zone === Z.SHELF && st.shelf === i);
    list = document.querySelectorAll('#drawer .key');
    for (i = 0; i < list.length; i++) setClass(list[i], 'focus', st.zone === Z.DRAWER && st.drawer === i);
    list = document.querySelectorAll('#apps .cell');
    for (i = 0; i < list.length; i++) setClass(list[i], 'focus', st.zone === Z.APPS && st.grid === i);
    var rows = Math.max(1, Math.ceil(others.length / 5)), r = Math.floor(st.grid / 5), first = Math.max(0, Math.min(rows - 3, r - 1));
    $('apps').lastChild.style.webkitTransform = $('apps').lastChild.style.transform = 'translateY(' + (-first * 239) + 'px)';
    focusRows($('settings'), st.row, st.zone === Z.SETTINGS);
    focusRows($('shelfedit'), st.edit, st.zone === Z.EDIT);
    focusDetail();
    cardFocused();
    setClass(body, 'drawer-open', st.zone === Z.DRAWER);
  }

  function focusRows(sheet, index, on) {
    var rows = sheet.querySelectorAll('.row');
    for (var i = 0; i < rows.length; i++) setClass(rows[i], 'focus', on && i === index);
    var holder = sheet.querySelector('.rows');
    if (!holder) return;
    var visible = 7, first = Math.max(0, Math.min(rows.length - visible, index - 3));
    holder.style.webkitTransform = holder.style.transform = 'translateY(' + (-first * 78) + 'px)';
  }

  function nearest(nodes, x) {
    var best = 0, bestD = 1e9;
    for (var i = 0; i < nodes.length; i++) {
      var r = nodes[i].getBoundingClientRect(), d = Math.abs((r.left + r.right) / 2 - x);
      if (d < bestD) { bestD = d; best = i; }
    }
    return best;
  }

  function centerX(node) {
    if (!node) return 960;
    var r = node.getBoundingClientRect();
    return (r.left + r.right) / 2;
  }

  // MARK: - Top: title, tabs, buttons, quotes

  var TAB_KIND = [null, 'movie', 'tv'];

  /** "Boa noite, Ana" (with name= in config.properties), or "Para você" without a name. */
  function greeting() {
    var name = (CONFIG.name || '').trim();
    if (!name) return tr('Para você', 'For You', 'Para ti');
    var h = new Date().getHours();
    var g = h >= 5 && h < 12 ? tr('Bom dia', 'Good morning', 'Buenos días') : h >= 12 && h < 18 ? tr('Boa tarde', 'Good afternoon', 'Buenas tardes')
      : tr('Boa noite', 'Good evening', 'Buenas noches');
    return g + ', ' + name;
  }

  // The verse sits right after the title, whatever its length.
  function setTitle() {
    var t = $('title'), v = $('verse');
    t.textContent = greeting();
    var left = 76 + t.offsetWidth + 56;
    v.style.left = left + 'px';
    v.style.width = Math.max(200, 1310 - left) + 'px';
  }

  function renderTop() {
    setTitle();
    var tabs = $('tabs');
    tabs.innerHTML = '';
    var names = [tr('Explorar', 'Explore', 'Explorar'), tr('Filmes', 'Movies', 'Películas'), tr('Séries', 'Shows', 'Series'),
      tr('Novidades', "What's New", 'Novedades'), tr('Minha lista', 'My List', 'Mi lista')];
    for (var i = 0; i < NT; i++) {
      var t = el('button', 'tab', tabs, names[i]);
      hover(t, Z.TOP, i);
    }
    var buttons = $('buttons');
    buttons.innerHTML = '';
    buttonDefs = [['memory', tr('Liberar memória', 'Free memory', 'Liberar memoria'), freeMemory],
      ['shuffle', tr('O que ver hoje?', 'What to watch?', '¿Qué ver hoy?'), function () { if (window.Fun) Fun.whatToWatch(); else shuffle(); }]];
    buttonDefs.push(['popcorn', tr('Modo pipoca', 'Movie night', 'Modo palomitas'), popcorn]);
    buttonDefs.push(['live_tv', tr('TV aberta', 'Live TV', 'TV en vivo'), function () { var live = liveTV(); if (live) launcher(live.id, tr('TV aberta', 'Live TV', 'TV en vivo'))(); }]);
    buttonDefs.push(['hdmi', tr('Entradas HDMI', 'HDMI Inputs', 'Entradas HDMI'), function () { st.zone = Z.SHELF; openDrawer(); st.drawer = 1 < drawerInputs ? 1 : 0; updateFocus(); }]);
    buttonDefs.push(['settings', tr('Ajustes', 'Settings', 'Ajustes'), openSettings]);
    var nb = buttonDefs.length;
    for (var b = 0; b < nb; b++) {
      var r = el('button', 'round' + (b === nb - 1 ? ' last' : ''), buttons);
      r.style.left = (1772 - 88 * (nb - 1 - b)) + 'px';
      sym(buttonDefs[b][0], r);
      el('div', 'tip', r, buttonDefs[b][1]);
      hover(r, Z.TOP, NT + b);
    }
    var v = Plus.verse();
    $('verse').innerHTML = '';
    el('span', 'text', $('verse'), '“' + v.text + '”');
    el('span', 'ref', $('verse'), v.ref);
  }

  function renderQuotes() {
    var q = $('quotes'), coins = Data.activeCoins();
    q.innerHTML = '';
    for (var i = 0; i < coins.length; i++) {
      var item = el('span', 'q', q);
      coin(coins[i], item);
      el('span', '', item, Data.compact(Data.prices[coins[i]]));
    }
  }

  // MARK: - Picks and background

  function tabPicks() {
    if (st.tab === 3) return Plus.news();
    if (st.tab === 4) return [{search: true, id: 'search', kind: 'search', title: tr('Pesquisar', 'Search', 'Buscar'),
      meta: tr('Ache um filme ou série para guardar', 'Find a movie or show to keep', 'Busca una película o serie')}].concat(Plus.myList());
    var list = Data.picks(TAB_KIND[st.tab]);
    var live = st.tab === 0 && liveCard();
    if (live) list = [live].concat(list);
    return list;
  }

  function renderCards() {
    var list = tabPicks();
    var holder = $('cards');
    setClass(body, 'no-picks', !list.length && st.tab < 3);
    $('empty').textContent = list.length || st.tab < 3 ? '' : st.tab === 3
      ? tr('Buscando as novidades da semana…', "Looking for this week's releases…", 'Buscando las novedades…')
      : tr('Abra um título e escolha “Minha lista” para guardar aqui. Séries seguidas avisam episódio novo.',
        'Open a title and choose “My List” to keep it here. Followed shows tell you about new episodes.',
        'Abre un título y elige “Mi lista” para guardarlo aquí.');
    var same = list.length === cards.length;
    for (var i = 0; same && i < list.length; i++) same = list[i].id === cards[i].id && list[i].backdrop === cards[i].backdrop && list[i].meta === cards[i].meta;
    if (same && holder.children.length === list.length) return;
    cards = list;
    holder.innerHTML = '';
    for (var c = 0; c < list.length; c++) {
      var p = list[c], card = el('div', 'card', holder);

      var img = el('div', 'img', card);
      if (p.search) { setClass(card, 'search', true); sym('search', img, 96); }
      else if (p.live) setClass(card, 'live', true);
      else img.style.backgroundImage = 'url(' + Data.image(p.backdrop, c === 0 ? 'w1280' : 'w780') + ')';
      el('div', 'name', card, p.title);
      if (p.meta) el('div', 'meta', card, p.meta);
      if (Plus.inList(p) && Plus.inList(p).fresh) el('div', 'badge', card, tr('Novo episódio', 'New episode', 'Nuevo episodio'));
      hover(card, Z.CARDS, c);
    }
    st.card = Math.min(st.card, Math.max(0, list.length - 1));
    scrollCards();
    if (!list.length && st.zone === Z.CARDS) st.zone = Z.SHELF;
    var first = list.filter(function (x) { return x.backdrop; })[0];
    backdrop(first ? Data.image(first.backdrop, 'w300') : '');
    updateFocus();
    placeLive();
  }

  var bgUrl = null, bgFront = 'bgA';

  /** The first pick's photo as the background: drawn tiny and stretched, it's already as soft as a heavy blur. */
  function backdrop(url) {
    if (url === bgUrl) return;
    bgUrl = url;
    var next = bgFront === 'bgA' ? 'bgB' : 'bgA';
    if (!url) {
      setClass($('bgA'), 'on', false);
      setClass($('bgB'), 'on', false);
      return;
    }
    var img = new Image();
    img.onload = function () {
      if (bgUrl !== url) return;
      var canvas = $(next), ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      setClass(canvas, 'on', true);
      setClass($(bgFront), 'on', false);
      bgFront = next;
    };
    img.src = url;
  }

  function renderClock() {
    var d = new Date(), c = $('clock');
    c.firstChild.textContent = Data.time(d.getTime());
    try {
      c.lastChild.textContent = d.toLocaleDateString(I18N.locale(), {weekday: 'long', day: 'numeric', month: 'long'});
    } catch (e) {
      c.lastChild.textContent = d.toDateString();
    }
  }

  // MARK: - System stats: the TV's RAM and CPU load, from tizen.systeminfo (absent in the browser preview).

  function renderStats() {
    var info = window.tizen && tizen.systeminfo, box = $('stats');
    if (!info || !info.getTotalMemory) return;
    var gb = function (b) { return (b / 1073741824).toFixed(1); };
    var total = info.getTotalMemory(), used = total - info.getAvailableMemory();
    box.style.right = (80 + $('quotes').offsetWidth + ($('quotes').offsetWidth ? 40 : 0)) + 'px';
    info.getPropertyValue('CPU', function (cpu) {
      box.textContent = 'RAM ' + gb(used) + ' / ' + gb(total) + ' GB  ·  CPU ' + Math.round(cpu.load * 100) + '%';
    }, function () {
      box.textContent = 'RAM ' + gb(used) + ' / ' + gb(total) + ' GB';
    });
  }

  // Closes every other app the TV keeps running, through the TV's own Smart View API (as phones close apps).
  function freeMemory() {
    var info = window.tizen && tizen.systeminfo, before = info && info.getAvailableMemory ? info.getAvailableMemory() : 0;
    var ids = apps.map(function (a) { return a.id; }), left = ids.length;
    if (/netflix/i.test(ids.join(' '))) { ids.push('11101200001'); left++; }
    function done() {
      if (--left > 0) return;
      setTimeout(function () {
        renderStats();
        var freed = before && info.getAvailableMemory() - before;
        toast(freed > 0 ? tr('Memória liberada: ', 'Memory freed: ', 'Memoria liberada: ') + Math.round(freed / 1048576) + ' MB'
          : tr('Apps fechados', 'Apps closed', 'Apps cerradas'));
      }, 1500);
    }
    if (!left) { toast(tr('Apps fechados', 'Apps closed', 'Apps cerradas')); return; }
    ids.forEach(function (id) {
      try {
        var xhr = new XMLHttpRequest();
        xhr.open('DELETE', 'http://127.0.0.1:8001/api/v2/applications/' + encodeURIComponent(id));
        xhr.timeout = 3000;
        xhr.onload = xhr.onerror = xhr.ontimeout = done;
        xhr.send();
      } catch (e) { done(); }
    });
  }

  // MARK: - Theme from the poster, and the trailer inside the focused card

  var trailerTimer = 0, trailerCard = -1, focusedKey = '', bgTimer = 0;

  function stopCardTrailer() {
    clearTimeout(trailerTimer);
    var old = document.querySelector('#cards iframe');
    if (old) old.parentNode.removeChild(old);
    trailerCard = -1;
  }

  /** YouTube's player, muted and without its controls (the remote can't reach them anyway). */
  function youtube(key, sound) {
    // YouTube refuses to play inside a page without an origin (file://, error 153): the player sits in a page served
    // over http (the Mac hub's yt.html, or trailer_page), which passes YouTube its origin.
    var page = Plus.trailerPage();
    if (!page) return null;
    var f = document.createElement('iframe');
    f.className = 'yt';
    f.setAttribute('allow', 'autoplay; encrypted-media');
    f.setAttribute('frameborder', '0');
    f.src = page + '?v=' + encodeURIComponent(key) + (sound ? '&sound=1' : '');
    return f;
  }

  /**
   * The focused card is the wide one (the first, when the focus is elsewhere), the rest are tall; the row scrolls so
   * the wide card starts where the first one does.
   */
  function scrollCards() {
    var nodes = $('cards').children, wide = st.zone === Z.CARDS ? st.card : 0, x = 80, wideX = 80;
    for (var i = 0; i < nodes.length; i++) {
      var w = i === wide ? 1040 : 320;
      if (i === wide) wideX = x;
      nodes[i].style.left = x + 'px';
      nodes[i].style.width = w + 'px';
      setClass(nodes[i], 'wide', i === wide);
      x += w + 40;
    }
    var shift = Math.max(0, Math.min(wideX - 80, x - 40 + 80 - 1920));
    var h = $('cards');
    h.style.webkitTransform = h.style.transform = shift ? 'translateX(' + -shift + 'px)' : '';
    if (wide || shift) hideLive(); else placeLive();
  }

  function cardFocused() {
    scrollCards();
    var p = st.zone === Z.CARDS ? cards[st.card] : null, k = p ? p.kind + ':' + p.id + ':' + st.card : '';
    if (k === focusedKey) return;
    focusedKey = k;
    stopCardTrailer();
    if (!p || p.live || p.search) return;
    // The background takes the focused poster's colors and genre, once the focus rests (not on every press).
    clearTimeout(bgTimer);
    bgTimer = setTimeout(function () {
      if (p.backdrop) backdrop(Data.image(p.backdrop, 'w300'));
      if (window.More) More.mood(p);
    }, 450);
    // Trailers play only on the title's page: a YouTube player inside the card cost the TV too much memory.
  }

  // MARK: - A title's page: trailer behind, synopsis, where it is, My List

  var detailActions = [], detailPick = null;

  function openDetail(p) {
    stopCardTrailer();
    hideLive();
    detailPick = p;
    if (window.More) More.mood(p);
    var d = $('detail');
    d.innerHTML = '';
    var bg = el('div', 'bg', d);
    if (p.backdrop) bg.style.backgroundImage = 'url(' + Data.image(p.backdrop, 'original') + ')';
    var video = el('div', 'video', d);
    el('div', 'shade', d);
    var info = el('div', 'info', d);
    el('div', 'name', info, p.title);
    if (p.meta) el('div', 'meta', info, p.meta);
    var about = el('div', 'about', info, '');
    // Where it is: the services here (the TV's or not) and where to rent or buy.
    var whereBox = el('div', 'where', info);
    function showWhere() {
      whereBox.innerHTML = '';
      var w = p.where;
      if (!w) return;
      if (w.flat.length) el('div', '', whereBox, tr('Onde ver: ', 'Streaming on: ', 'Dónde ver: ') + w.flat.slice(0, 5).join(' · '));
      if (w.rent.length) el('div', 'rent', whereBox, tr('Alugar ou comprar: ', 'Rent or buy: ', 'Alquilar o comprar: ') + w.rent.slice(0, 4).join(' · '));
      if (!w.flat.length && !w.rent.length) el('div', 'rent', whereBox, tr('Ainda em nenhum streaming no Brasil', 'Not streaming here yet', 'Aún no está en streaming'));
    }
    if (p.where) showWhere();
    else Data.details(p, function () { if (detailPick === p) { showWhere(); if (!future && p.released > Data.day(0)) addPremiere(); } });
    var future = p.released && p.released > Data.day(0);
    Plus.overview(p, function (text) {
      if (detailPick !== p) return;
      about.textContent = text.length > 330 ? text.slice(0, text.lastIndexOf(' ', 320)) + '…' : text;
    });
    var row = el('div', 'actions', info);
    var app = Data.appFor(p.app);
    detailActions = [];
    if (app) detailActions.push({label: tr('Assistir no ', 'Watch on ', 'Ver en ') + (p.service || app.title), symbol: 'play',
      run: function () { Plus.seen(p); launcher(app.id, app.title)(); }});
    detailActions.push({label: tr('Trailer com som', 'Trailer with sound', 'Tráiler con sonido'), symbol: 'movie', run: function () {
      Plus.trailer(p, function (key) {
        var f = key && youtube(key, true);
        if (!f) { toast(key ? tr('Trailers precisam do Ultra Hub aberto no Mac', 'Trailers need Ultra Hub on the Mac', 'Los tráileres necesitan Ultra Hub')
          : tr('Sem trailer para este título', 'No trailer for this title', 'Sin tráiler')); return; }
        video.innerHTML = '';
        video.appendChild(f);
        setClass(d, 'playing', true);
      });
    }});
    var label = function () {
      return Plus.inList(p) ? (p.kind === 'tv' ? tr('Seguindo', 'Following', 'Siguiendo') : tr('Na minha lista', 'In My List', 'En mi lista'))
        : (p.kind === 'tv' ? tr('Seguir série', 'Follow show', 'Seguir serie') : tr('Minha lista', 'My List', 'Mi lista'));
    };
    var listAction = {label: label(), symbol: 'bookmark', run: function () {
      var added = Plus.toggle(p);
      listAction.node.lastChild.textContent = label();
      toast(added ? (p.kind === 'tv' ? tr('Aviso quando sair episódio novo', "You'll hear about new episodes", 'Te aviso de episodios nuevos')
        : tr('Guardado na Minha lista', 'Saved to My List', 'Guardado en Mi lista')) : tr('Tirado da lista', 'Removed from the list', 'Quitado de la lista'));
    }};
    detailActions.push(listAction);
    function addPremiere() {
      if (detailActions.some(function (x) { return x.premiere; })) return;
      var lab = function () { return Plus.premiere(p) ? tr('Contando os dias', 'Counting down', 'Contando los días') : tr('Avisar estreia', 'Count down to it', 'Avisar estreno'); };
      var act = {premiere: true, label: lab(), symbol: 'bell', run: function () {
        var on = Plus.togglePremiere(p);
        act.node.lastChild.textContent = lab();
        toast(on ? tr('A ilha conta os dias até ', 'The island counts down to ', 'La isla cuenta los días hasta ') + Data.date(p.released) : tr('Contagem removida', 'Countdown removed', 'Cuenta quitada'));
      }};
      detailActions.push(act);
      var b = el('button', 'act', row);
      sym(act.symbol, b);
      el('span', '', b, act.label);
      act.node = b;
      hover(b, Z.DETAIL, detailActions.length - 1);
    }
    var built = detailActions.length;
    for (var i = 0; i < built; i++) {
      var b = el('button', 'act', row);
      sym(detailActions[i].symbol, b);
      el('span', '', b, detailActions[i].label);
      detailActions[i].node = b;
      hover(b, Z.DETAIL, i);
    }
    if (future) addPremiere();
    st.zone = Z.DETAIL;
    st.action = 0;
    setClass(d, 'open', true);
    updateFocus();
    // The trailer starts muted behind the page after a moment, as on Apple TV.
    setTimeout(function () {
      if (detailPick !== p || st.zone !== Z.DETAIL) return;
      Plus.trailer(p, function (key) {
        var f = key && detailPick === p && !video.firstChild && youtube(key, false);
        if (f) { video.appendChild(f); setTimeout(function () { if (detailPick === p) setClass(d, 'teaser', true); }, 1500); }
      });
    }, 1800);
  }

  function closeDetail() {
    detailPick = null;
    var d = $('detail');
    setClass(d, 'open', false);
    setClass(d, 'playing', false);
    setClass(d, 'teaser', false);
    setTimeout(function () { if (!detailPick) d.innerHTML = ''; }, 400);
  }

  function focusDetail() {
    for (var i = 0; i < detailActions.length; i++) if (detailActions[i].node) setClass(detailActions[i].node, 'focus', st.zone === Z.DETAIL && st.action === i);
  }

  function shuffle() {
    toast(tr('Sorteando… 🎲', 'Picking… 🎲', 'Sorteando… 🎲'));
    Plus.shuffle(function (p) {
      if (!p) { toast(tr('Ainda sem títulos para sortear', 'Nothing to pick from yet', 'Aún no hay títulos')); return; }
      setClass($('toast'), 'on', false);
      openDetail(p);
    });
  }

  // Movie night: other apps closed and the Alexa routine (lights down), when it's set up.
  function popcorn() {
    freeMemory();
    if (Plus.popcorn()) toast(tr('Modo pipoca: Alexa avisada, apps fechados 🍿', 'Movie night: Alexa told, apps closed 🍿', 'Modo palomitas 🍿'));
    else toast(tr('Apps fechados. Para a Alexa apagar a luz, ponha voice_monkey_url no config.', 'Apps closed. Set voice_monkey_url for Alexa.', 'Apps cerradas.'));
  }

  // MARK: - The HDMI on screen, live inside the first card (Samsung)

  var liveOn = false;

  function liveSource() {
    if (!window.tizen || !tizen.tvwindow) return null;
    var src = null, res = null;
    try { src = tizen.tvwindow.getSource(); } catch (e) {}
    try { res = tizen.tvwindow.getVideoResolution(); } catch (e) {}
    if (!src || src.type !== 'HDMI' || src.signal === false || !res || !res.width) return null;
    return src;
  }

  function liveCard() {
    var src = liveSource();
    if (!src) return null;
    var name = src.name && !/^HDMI/i.test(src.name) ? src.name : 'HDMI ' + src.number;
    return {live: true, id: 'live:' + src.number, kind: 'live', title: name + tr(' ao vivo', ' live', ' en vivo'),
      meta: tr('OK abre em tela cheia', 'OK opens it full screen', 'OK lo abre en pantalla completa'), sourceId: 'source:HDMI:' + src.number};
  }

  function placeLive() {
    var want = cards[0] && cards[0].live && !saverOn && !sheetOpen() && !document.hidden;
    if (!want) { hideLive(); return; }
    if (liveOn) return;
    try {
      tizen.tvwindow.show(function () { liveOn = true; }, function () { liveOn = false; },
          ['207px', '262px', '786px', '442px'], 'MAIN');
    } catch (e) {}
  }

  function hideLive() {
    if (!liveOn) return;
    liveOn = false;
    try { tizen.tvwindow.hide(function () {}, function () {}); } catch (e) {}
  }

  // MARK: - Panels: guests' Wi-Fi, the Mac, a reminder

  function openPanel(build) {
    hideLive();
    stopCardTrailer();
    var box = $('panel').firstChild;
    box.innerHTML = '';
    build(box);
    el('div', 'hint', box, tr('OK ou Voltar fecha', 'OK or Back closes', 'OK o Atrás cierra'));
    st.zone = Z.PANEL;
    setClass($('panel'), 'open', true);
    updateFocus();
  }

  function wifiPanel() {
    openPanel(function (box) {
      el('div', 'title', box, tr('Wi-Fi para visitas', 'Guest Wi-Fi', 'Wi-Fi para visitas'));
      var img = el('img', 'qr', box);
      img.src = 'wifi-qr.png';
      el('div', 'line', box, Plus.wifiSsid());
      el('div', 'small', box, tr('Aponte a câmera do celular para o código', "Point the phone's camera at the code", 'Apunta la cámara del celular'));
    });
  }

  function macPanel() {
    openPanel(function (box) {
      var h = Plus.hub();
      el('div', 'title', box, 'Mac');
      if (!h.online) { el('div', 'line', box, tr('O Mac não respondeu. O Ultra Hub está aberto?', "The Mac didn't answer. Is Ultra Hub open?", 'El Mac no respondió.')); return; }
      var m = h.mac || {};
      el('div', 'line', box, 'CPU ' + (m.cpu || 0) + '%  ·  RAM ' + (m.ramUsed || 0) + ' / ' + (m.ramTotal || 0) + ' GB');
      (m.jobs || []).forEach(function (j) {
        el('div', 'line', box, j.name + (j.progress >= 0 ? '  ' + j.progress + '%' : tr('  em andamento', '  running', '  en curso')));
      });
      if (!(m.jobs || []).length) el('div', 'small', box, tr('Nenhum render ou exportação agora', 'No render or export now', 'Ningún render ahora'));
    });
  }

  Plus.onReminder(function (r) {
    poke();
    var b = $('reminder');
    b.innerHTML = '';
    el('div', 'from', b, (r.from ? r.from + ' · ' : '') + Data.time(r.at));
    el('div', 'text', b, r.text);
    setClass(b, 'on', true);
    clearTimeout(b.timer);
    b.timer = setTimeout(function () { setClass(b, 'on', false); }, 30000);
  });

  // MARK: - From the Mac: music playing, videos sent to the TV

  Plus.onCast(function (c) {
    var player = $('player');
    player.innerHTML = '';
    if (c.kind === 'stop') { closePlayer(); return; }
    poke();
    hideLive();
    stopCardTrailer();
    if (c.kind === 'youtube') {
      var f = youtube(c.id, true);
      if (f) player.appendChild(f);
    } else if (c.kind === 'video') {
      var v = el('video', '', player);
      v.src = Plus.hubUrl(c.url);
      v.autoplay = true;
      v.controls = false;
      v.onended = closePlayer;
    }
    setClass(player, 'on', true);
  });

  function playerOn() { return hasClass($('player'), 'on'); }

  function closePlayer() {
    var player = $('player');
    setClass(player, 'on', false);
    player.innerHTML = '';
    placeLive();
  }

  // MARK: - Search: an on-screen keyboard for the remote (or the phone typing into the field), results from TMDB

  var KEYS = [
    ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'],
    ['k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't'],
    ['u', 'v', 'w', 'x', 'y', 'z', '1', '2', '3', '4'],
    ['5', '6', '7', '8', '9', '0', '-', ':', '&', '?'],
    ['␣', '⌫', tr('Limpar', 'Clear', 'Borrar'), tr('Teclado TV', 'TV keyboard', 'Teclado TV')]
  ];
  var query = '', results = [], searchTimer = 0;

  function openSearch() {
    stopCardTrailer();
    hideLive();
    var box = $('search');
    box.innerHTML = '';
    el('div', 'title', box, tr('Pesquisar', 'Search', 'Buscar'));
    var field = el('input', 'field', box);
    field.value = query;
    field.setAttribute('placeholder', tr('Nome do filme ou série', 'Movie or show name', 'Película o serie'));
    // Text typed from the phone (Ultra Hub) lands here when the field has focus.
    field.oninput = function () { query = field.value; runSearch(); };
    el('div', 'voice', box, tr('🎤 Segure o botão do microfone do controle e fale o nome', '🎤 Hold the remote\'s mic button and say the name',
      '🎤 Mantén el botón del micrófono y di el nombre'));
    var kb = el('div', 'kb', box);
    for (var r = 0; r < KEYS.length; r++) {
      var row = el('div', 'krow', kb);
      for (var c = 0; c < KEYS[r].length; c++) {
        var k = el('button', 'k' + (KEYS[r][c].length > 1 ? ' wide' : ''), row, KEYS[r][c]);
        (function (r, c, k) {
          k.onmouseover = function () { st.sRow = r; st.sCol = c; focusSearch(); };
          k.onclick = function () { typeKey(KEYS[r][c]); };
        })(r, c, k);
      }
    }
    el('div', 'hits', box);
    st.zone = Z.SEARCH;
    st.sRow = 0;
    st.sCol = 0;
    setClass(box, 'open', true);
    renderHits();
    focusSearch();
    listenVoice();
  }

  /** Samsung's voice interaction: what's said into the remote's mic comes as a search term. */
  var voiceReady = false;
  function listenVoice() {
    var vi = window.webapis && webapis.voiceinteraction;
    if (!vi || voiceReady) return;
    try {
      vi.setCallback({
        onupdatestate: function () { return 'List'; },
        onsearch: function (terms) {
          var t = '';
          try { t = webapis.voiceinteraction.getDataFromSearchTerm(terms, 'SEARCH_TERM_UTTERANCE') || ''; } catch (e) {}
          if (!t && terms && terms.utterance) t = terms.utterance;
          if (!t) return false;
          if (st.zone !== Z.SEARCH) openSearch();
          query = String(t).toLowerCase();
          $('search').querySelector('.field').value = query;
          runSearch();
          return true;
        }
      });
      vi.listen();
      voiceReady = true;
    } catch (e) {}
  }

  function typeKey(k) {
    if (k === '⌫') query = query.slice(0, -1);
    else if (k === '␣') query += ' ';
    else if (k === tr('Teclado TV', 'TV keyboard', 'Teclado TV')) { $('search').querySelector('.field').focus(); return; }
    else if (k.length > 1) query = '';
    else query += k;
    $('search').querySelector('.field').value = query;
    runSearch();
  }

  function runSearch() {
    clearTimeout(searchTimer);
    var q = query.replace(/^\s+|\s+$/g, '');
    if (q.length < 2) { results = []; renderHits(); return; }
    searchTimer = setTimeout(function () {
      Plus.search(q, function (list) {
        if (q !== query.replace(/^\s+|\s+$/g, '')) return;
        results = list;
        renderHits();
      });
    }, 450);
  }

  function renderHits() {
    var hits = $('search').querySelector('.hits');
    if (!hits) return;
    hits.innerHTML = '';
    if (!results.length) {
      el('div', 'none', hits, query.length < 2 ? tr('Digite pelo menos 2 letras', 'Type at least 2 letters', 'Escribe al menos 2 letras')
        : tr('Nada encontrado (ainda)', 'Nothing found (yet)', 'Nada encontrado'));
    }
    for (var i = 0; i < results.length; i++) {
      var h = el('div', 'hit', hits);
      var im = el('div', 'img', h);
      im.style.backgroundImage = 'url(' + Data.image(results[i].backdrop, 'w300') + ')';
      el('div', 'name', h, results[i].title);
      el('div', 'kind', h, results[i].kind === 'tv' ? tr('Série', 'Show', 'Serie') : tr('Filme', 'Movie', 'Película'));
      (function (i, h) {
        h.onmouseover = function () { st.sRow = -1; st.sCol = i; focusSearch(); };
        h.onclick = function () { setClass($('search'), 'open', false); openDetail(results[i]); };
      })(i, h);
    }
    if (st.sRow < 0 && st.sCol >= results.length) { st.sRow = 0; st.sCol = 0; }
    focusSearch();
  }

  function focusSearch() {
    var box = $('search'), rows = box.querySelectorAll('.krow'), hits = box.querySelectorAll('.hit');
    for (var r = 0; r < rows.length; r++) {
      for (var c = 0; c < rows[r].children.length; c++) setClass(rows[r].children[c], 'focus', st.zone === Z.SEARCH && st.sRow === r && st.sCol === c);
    }
    for (var i = 0; i < hits.length; i++) setClass(hits[i], 'focus', st.zone === Z.SEARCH && st.sRow < 0 && st.sCol === i);
  }

  // MARK: - Shelf

  function renderShelf() {
    var n = shelf.length, gap = 48, pad = 40;
    // 16:9 tiles, as on Android: never taller than 126, and the glass keeps its bottom edge.
    var tw = Math.min(126 * 16 / 9, (1760 - Math.max(0, n - 1) * gap) / Math.max(1, n)), th = tw * 9 / 16;
    var width = n * tw + Math.max(0, n - 1) * gap, left = (1920 - width) / 2;
    var platter = $('platter');
    platter.style.display = n ? '' : 'none';
    platter.style.left = (left - pad) + 'px';
    platter.style.width = (width + 2 * pad) + 'px';
    platter.style.top = (814 + 126 - th) + 'px';
    platter.style.height = (th + 2 * pad) + 'px';
    $('quotes').style.right = (1920 - left - width) + 'px';
    var tiles = $('tiles');
    tiles.innerHTML = '';
    for (var i = 0; i < n; i++) {
      var t = el('div', 'tile', tiles);
      t.style.left = (left + i * (tw + gap)) + 'px';
      t.style.top = (854 + 126 - th) + 'px';
      t.style.width = tw + 'px';
      t.style.height = th + 'px';
      face(shelf[i], t, wordFit(shelf[i].title, tw, 30));
      hover(t, Z.SHELF, i);
    }
    st.shelf = Math.min(st.shelf, Math.max(0, n - 1));
  }

  // MARK: - Drawer

  var drawerItems = [], drawerInputs = 0;

  function renderDrawer() {
    var d = $('drawer');
    d.innerHTML = '';
    drawerItems = [];
    for (var i = 0; i < inputs.length; i++) {
      var x = inputs[i];
      drawerItems.push({label: x.label || tr('TV aberta', 'Live TV', 'TV en vivo'), symbol: x.symbol, off: !x.connected, run: launcher(x.id, x.label)});
    }
    drawerInputs = drawerItems.length;
    drawerItems.push({label: tr('Todos os Apps', 'All Apps', 'Todas las apps'), symbol: 'apps', run: openApps});
    if (Plus.hasWifi()) drawerItems.push({label: tr('Wi-Fi visita', 'Guest Wi-Fi', 'Wi-Fi visita'), symbol: 'wifi', run: wifiPanel});
    if (Plus.hubUrl('/')) drawerItems.push({label: 'Mac', symbol: 'computer', run: macPanel});
    drawerItems.push({label: tr('Vitrine', 'Showcase', 'Vitrina'), symbol: 'slideshow', run: function () { closeDrawer(); showSaver(); }});
    drawerItems.push({label: tr('Diversão', 'Fun', 'Diversión'), symbol: 'sparkles', run: function () { closeDrawer(); if (window.Fun) Fun.relax(); }});
    if (window.More && More.team) drawerItems.push({label: More.teamName, symbol: 'sports_soccer', run: More.team});
    drawerItems.push({label: tr('Ajustes do Início', 'Home Settings', 'Ajustes de inicio'), symbol: 'settings', run: openSettings});
    drawerItems.push({label: tr('Ajustes da TV', 'TV Settings', 'Ajustes del TV'), symbol: 'tv_settings', run: tvSettings});
    var n = drawerItems.length, gap = 18, groupGap = 56, groups = drawerInputs > 0 && drawerInputs < n ? 2 : 1;
    var tw = Math.min(230, (1760 - Math.max(0, n - groups) * gap - (groups - 1) * groupGap) / Math.max(1, n));
    var xPos = 80;
    for (var k = 0; k < n; k++) {
      if (k === drawerInputs && k > 0) {
        xPos += groupGap - gap;
        el('div', 'row-title', d, tr('Atalhos', 'Shortcuts', 'Accesos directos')).style.left = (xPos + 4) + 'px';
      }
      if (k === 0 && drawerInputs) el('div', 'row-title', d, tr('Entradas', 'Inputs', 'Entradas')).style.left = '84px';
      var item = drawerItems[k], key = el('div', 'key glass' + (item.off ? ' off' : ''), d);
      key.style.left = xPos + 'px';
      key.style.width = tw + 'px';
      sym(item.symbol, key);
      el('div', 'label', key, item.label);
      hover(key, Z.DRAWER, k);
      xPos += tw + gap;
    }
    renderPanels();
    updateFocus();
  }

  function renderPanels() {
    var d = $('drawer');
    var old = d.querySelectorAll('.panel');
    for (var o = 0; o < old.length; o++) d.removeChild(old[o]);
    var wx = Prefs.weather(), coins = Data.activeCoins(), qt = coins.length > 0;
    var split = 80 + 1760 * 0.585;
    if (wx) {
      var w = el('div', 'panel glass', d);
      w.id = 'weather';
      w.style.left = '80px';
      w.style.width = ((qt ? split - 16 : 1840) - 80) + 'px';
      renderWeather(w);
    }
    if (qt) {
      var q = el('div', 'panel glass', d);
      q.id = 'prices';
      var left = wx ? split + 16 : 80;
      q.style.left = left + 'px';
      q.style.width = (1840 - left) + 'px';
      renderPrices(q, coins);
    }
  }

  function renderWeather(card) {
    el('div', 'head', card, Data.city || tr('Clima', 'Weather', 'Clima'));
    var w = Data.weather;
    if (!w) {
      el('div', 'cond', card, tr('Sem dados do clima agora.', 'No weather data right now.', 'No hay datos del clima ahora.')).style.top = '96px';
      return;
    }
    var now = el('div', 'now', card);
    sym(Data.symbol(w.code, w.isDay), now);
    el('span', 'temp', now, Data.degrees(w.temp));
    el('div', 'cond', card, Data.condition(w.code, w.isDay));
    el('div', 'range', card, I18N.lang === 'ru' ? 'Макс. ' + Data.degrees(w.max) + '   Мин. ' + Data.degrees(w.min) : tr('Máx. ' + Data.degrees(w.max) + '   Mín. ' + Data.degrees(w.min), 'H:' + Data.degrees(w.max) + '   L:' + Data.degrees(w.min),
        'Máx. ' + Data.degrees(w.max) + '   Mín. ' + Data.degrees(w.min)));
    el('div', 'split', card);
    var hours = el('div', 'hours', card), width = parseFloat(card.style.width) - 30 - 422, hw = width / 6;
    for (var i = 0; i < w.hours.length && i < 6; i++) {
      var h = el('div', 'hour', hours), x = w.hours[i];
      h.style.left = (hw * i) + 'px';
      h.style.width = hw + 'px';
      el('div', 't', h, Data.hour(x.at));
      sym(Data.symbol(x.code, x.day), h);
      el('div', 'd', h, Data.degrees(x.temp));
    }
    var sun = el('div', 'sun', card);
    if (w.sunrise) { var a = el('span', '', sun); sym('sunrise', a); a.appendChild(document.createTextNode(tr('Nascer ', 'Sunrise ', 'Amanecer ') + Data.time(w.sunrise))); }
    if (w.sunset) { var b = el('span', '', sun); sym('sunset', b); b.appendChild(document.createTextNode(tr('Pôr do sol ', 'Sunset ', 'Atardecer ') + Data.time(w.sunset))); }
  }

  function renderPrices(card, coins) {
    el('div', 'head', card, tr('Cotações', 'Crypto', 'Cripto'));
    var stale = Data.staleness(Data.pricesAt, 5 * 60000);
    el('div', 'side', card, stale || tr('variação em 24 h', '24h change', 'variación en 24 h'));
    for (var j = 0; j < coins.length; j++) {
      var i = coins[j], row = el('div', 'coin', card);
      row.style.top = (86 + 52 * j) + 'px';
      coin(i, row);
      el('span', 'n', row, Data.coinName(i));
      el('span', 'p', row, Data.money(Data.prices[i]));
      var ch = Data.changes[i];
      if (!isNaN(ch)) el('span', 'c ' + (ch >= 0 ? 'up' : 'down'), row, Data.change(ch));
    }
  }

  function openDrawer() {
    if (!drawerItems.length) return;
    var tiles = $('tiles').children;
    st.zone = Z.DRAWER;
    st.drawer = Math.min(drawerItems.length - 1, nearest(document.querySelectorAll('#drawer .key'), centerX(tiles[st.shelf])));
    updateFocus();
  }

  function closeDrawer() {
    var keys = document.querySelectorAll('#drawer .key');
    st.zone = Z.SHELF;
    if (shelf.length) st.shelf = nearest($('tiles').children, centerX(keys[st.drawer]));
    updateFocus();
  }

  // MARK: - All Apps

  function renderApps() {
    var sheet = $('apps');
    sheet.firstChild.textContent = tr('Todos os Apps', 'All Apps', 'Todas las apps');
    var grid = sheet.lastChild;
    grid.innerHTML = '';
    for (var i = 0; i < others.length; i++) {
      var r = Math.floor(i / 5), c = i % 5, cell = el('div', 'cell', grid);
      cell.style.left = (130 + c * 340) + 'px';
      cell.style.top = (196 + r * 239) + 'px';
      face(others[i], el('div', 'face', cell), wordFit(others[i].title, 300, 34));
      el('div', 'label', cell, others[i].title);
      hover(cell, Z.APPS, i);
    }
  }

  function openApps() {
    renderApps();
    st.zone = Z.APPS;
    st.grid = 0;
    setClass($('apps'), 'open', true);
    updateFocus();
  }

  function closeSheets() {
    var from = st.zone;
    if (from === Z.DETAIL) closeDetail();
    setClass($('search'), 'open', false);
    setClass($('panel'), 'open', false);
    setClass($('apps'), 'open', false);
    setClass($('settings'), 'open', false);
    setClass($('shelfedit'), 'open', false);
    st.zone = (from === Z.DETAIL || from === Z.SEARCH) && cards.length ? Z.CARDS : Z.SHELF;
    updateFocus();
    placeLive();
  }

  // MARK: - Home Settings

  function settingRows() {
    var lang = Prefs.language(), unit = Prefs.temperature(), theme = Prefs.theme();
    var auto = tr('Automático', 'Automatic', 'Automático'), on = tr('Ligado', 'On', 'Activado'), off = tr('Desligado', 'Off', 'Desactivado');
    var rows = [
      {label: tr('Idioma', 'Language', 'Idioma'), value: lang === 'ru' ? 'Русский' : lang === 'de' ? 'Deutsch' : lang === 'pt' ? 'Português' : lang === 'en' ? 'English' : lang === 'es' ? 'Español' : auto,
        step: function (d) { cycle('language', ['auto', 'de', 'en', 'es', 'pt', 'ru'], lang, d); I18N.set(Prefs.language()); renderAll(); }},
      {label: tr('Temperatura', 'Temperature', 'Temperatura'), value: unit === 'C' ? '°C' : unit === 'F' ? '°F' : auto,
        step: function (d) { cycle('temperature', ['auto', 'C', 'F'], unit, d); renderPanels(); }},
      {label: tr('Tema', 'Theme', 'Tema'), value: theme === 'light' ? tr('Claro', 'Light', 'Claro') : theme === 'dark' ? tr('Escuro', 'Dark', 'Oscuro') : auto,
        step: function (d) { cycle('theme', ['auto', 'light', 'dark'], theme, d); checkNight(); }},
      {label: tr('Widget do clima', 'Weather widget', 'Widget del clima'), toggle: Prefs.weather(),
        step: function () { Prefs.set('weather', !Prefs.weather()); renderPanels(); }},
      {label: tr('Widget de cotações', 'Quotes widget', 'Widget de cotizaciones'), toggle: Prefs.quotes(),
        step: function () { Prefs.set('quotes', !Prefs.quotes()); Data.settingsChanged(); }}
    ];
    var names = ['Bitcoin', 'Ethereum', 'Solana', tr('Dólar', 'Dollar', 'Dólar')];
    var count = Data.currency === 'BRL' ? 4 : 3;
    for (var i = 0; i < count; i++) {
      (function (i) {
        rows.push({label: names[i], toggle: Prefs.quotes() && Prefs.coin(i), dim: !Prefs.quotes(),
          step: function () { if (Prefs.quotes()) { Prefs.setCoin(i, !Prefs.coin(i)); Data.settingsChanged(); } }});
      })(i);
    }
    if (window.More) {
      var im = More.islandMode();
      rows.push({label: 'Dynamic Island', value: im === 'off' ? off : im === 'important' ? tr('Só importantes', 'Important only', 'Solo importantes') : on,
        step: function (d) { var v = ['on', 'important', 'off'], i = v.indexOf(More.islandMode()); More.setIslandMode(v[(i + (d || 1) + 3) % 3]); }});
    }
    rows.push({label: tr('Prateleira', 'Shelf', 'Estante'), value: '›', step: function (d) { if (d >= 0) openShelfEdit(); }});
    rows.push({label: tr('Ajustes da TV', 'TV Settings', 'Ajustes del TV'), value: '›', step: function (d) { if (d >= 0) tvSettings(); }});
    return rows;
  }

  function cycle(name, values, current, d) {
    var i = values.indexOf(current);
    Prefs.set(name, values[(i + (d || 1) + values.length) % values.length]);
  }

  var rowsNow = [];

  function renderSettings() {
    var box = $('settings').firstChild;
    box.innerHTML = '';
    var title = el('div', 'title', box);
    sym('settings', title);
    title.appendChild(document.createTextNode(tr('Ajustes do Início', 'Home Settings', 'Ajustes de inicio')));
    var list = el('div', 'list', box), holder = el('div', 'rows', list);
    rowsNow = settingRows();
    list.style.height = Math.min(rowsNow.length, 7) * 78 + 'px';
    for (var i = 0; i < rowsNow.length; i++) {
      var r = rowsNow[i], row = el('div', 'row' + (r.dim ? ' dim' : ''), holder, r.label);
      if (r.toggle !== undefined) setClass(el('div', 'toggle', row), 'on', r.toggle);
      else {
        var v = el('span', 'value', row);
        if (r.value === '›') v.textContent = '›';
        else { el('span', 'chev', v, '‹'); v.appendChild(document.createTextNode(r.value)); el('span', 'chev', v, '›'); }
      }
      hover(row, Z.SETTINGS, i);
    }
    el('div', 'hint', box, tr('OK ou as setas mudam o valor.', 'OK or the arrows change the value.', 'OK o las flechas cambian el valor.'));
    updateFocus();
  }

  function openSettings() {
    st.zone = Z.SETTINGS;
    st.row = 0;
    renderSettings();
    setClass($('settings'), 'open', true);
    updateFocus();
  }

  // MARK: - Shelf editor: which apps, in what order

  function ordinal(n) {
    if (I18N.lang === 'ru') return n + '-е';
    if (I18N.lang === 'de') return n + '.';
    if (I18N.lang !== 'en') return n + 'º';
    var s = ['th', 'st', 'nd', 'rd'], v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  }

  function editList() {
    var ids = shelf.map(function (a) { return a.id; });
    return {ids: ids, rows: apps.slice().sort(function (a, b) {
      var ia = ids.indexOf(a.id), ib = ids.indexOf(b.id);
      if (ia >= 0 || ib >= 0) return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
      return a.title.toLowerCase() < b.title.toLowerCase() ? -1 : 1;
    })};
  }

  function renderShelfEdit() {
    var box = $('shelfedit').firstChild, e = editList();
    box.innerHTML = '';
    var title = el('div', 'title', box);
    sym('apps', title);
    title.appendChild(document.createTextNode(tr('Prateleira', 'Shelf', 'Estante')));
    var list = el('div', 'list', box), holder = el('div', 'rows', list);
    list.style.height = Math.min(e.rows.length, 7) * 78 + 'px';
    for (var i = 0; i < e.rows.length; i++) {
      var a = e.rows[i], at = e.ids.indexOf(a.id), row = el('div', 'row', holder, a.title);
      el('span', 'value', row, at >= 0 ? tr('Na prateleira · ', 'On · ', 'En el estante · ') + ordinal(at + 1) : tr('Fora', 'Off', 'Fuera'));
      hover(row, Z.EDIT, i);
    }
    el('div', 'hint', box, tr('OK põe ou tira · ← → mudam a ordem', 'OK adds or removes · ← → change the order', 'OK pone o quita · ← → cambian el orden'));
    updateFocus();
  }

  function openShelfEdit() {
    setClass($('settings'), 'open', false);
    st.zone = Z.EDIT;
    st.edit = 0;
    renderShelfEdit();
    setClass($('shelfedit'), 'open', true);
    updateFocus();
  }

  function editShelf(dx) {
    var e = editList(), app = e.rows[st.edit];
    if (!app) return;
    var ids = e.ids.slice(), at = ids.indexOf(app.id);
    if (dx === 0) {
      if (at >= 0) ids.splice(at, 1);
      else if (ids.length < MAX_SHELF) ids.push(app.id);
      else { toast(tr('A prateleira cabe até ' + MAX_SHELF + ' apps.', 'The shelf holds up to ' + MAX_SHELF + ' apps.', 'El estante tiene hasta ' + MAX_SHELF + ' apps.')); return; }
    } else {
      if (at < 0) return;
      var to = Math.max(0, Math.min(ids.length - 1, at + dx));
      ids.splice(at, 1);
      ids.splice(to, 0, app.id);
    }
    Prefs.set('shelf', ids);
    pickShelf();
    renderShelf();
    var again = editList();
    for (var i = 0; i < again.rows.length; i++) if (again.rows[i].id === app.id) st.edit = i;
    renderShelfEdit();
  }

  // MARK: - Opening things

  function launcher(id, name) {
    return function () {
      TV.launch(id, null, function (ok) {
        if (!ok) toast(tr('Não deu para abrir ', "Couldn't open ", 'No se pudo abrir ') + (name || id));
      });
    };
  }

  function tvSettings() {
    TV.settings(function (ok) {
      if (!ok) toast(tr('Não deu para abrir os Ajustes da TV', "Couldn't open TV Settings", 'No se pudieron abrir los Ajustes del TV'));
    });
  }

  function liveTV() {
    for (var i = 0; i < inputs.length; i++) if (inputs[i].key === 'live') return inputs[i];
    return null;
  }

  function activate() {
    switch (st.zone) {
      case Z.TOP:
        if (st.top < NT) return;
        if (buttonDefs[st.top - NT]) buttonDefs[st.top - NT][2]();
        return;
      case Z.CARDS:
        var p = cards[st.card];
        if (p && p.live) { hideLive(); var src = liveTV(); TV.launch(p.sourceId || (src && src.id), null, function () {}); return; }
        if (p && p.search) { openSearch(); return; }
        if (p) openDetail(p);
        return;
      case Z.SEARCH:
        if (st.sRow < 0) { if (results[st.sCol]) { var hit = results[st.sCol]; setClass($('search'), 'open', false); openDetail(hit); } return; }
        typeKey(KEYS[st.sRow][st.sCol]);
        return;
      case Z.DETAIL:
        if (detailActions[st.action]) detailActions[st.action].run();
        return;
      case Z.PANEL:
        closeSheets();
        return;
      case Z.SHELF:
        if (shelf[st.shelf]) launcher(shelf[st.shelf].id, shelf[st.shelf].title)();
        return;
      case Z.DRAWER:
        if (drawerItems[st.drawer]) drawerItems[st.drawer].run();
        return;
      case Z.APPS:
        if (others[st.grid]) launcher(others[st.grid].id, others[st.grid].title)();
        return;
      case Z.SETTINGS:
        if (rowsNow[st.row]) { rowsNow[st.row].step(1); if (st.zone === Z.SETTINGS) renderSettings(); }
        return;
      case Z.EDIT:
        editShelf(0);
        return;
    }
  }

  function selectTab(i) {
    if (i === st.tab) return;
    st.tab = i;
    renderCards();
  }

  function move(dx, dy) {
    var tiles = $('tiles').children, cardNodes = $('cards').children;
    switch (st.zone) {
      case Z.SHELF:
        if (dx) st.shelf = Math.max(0, Math.min(shelf.length - 1, st.shelf + dx));
        else if (dy > 0) { openDrawer(); return; }
        else if (dy < 0) {
          if (cards.length) { st.zone = Z.CARDS; st.card = nearest(cardNodes, centerX(tiles[st.shelf])); }
          else { st.zone = Z.TOP; st.top = st.tab; }
        }
        break;
      case Z.CARDS:
        if (dx) st.card = Math.max(0, Math.min(cards.length - 1, st.card + dx));
        else if (dy < 0) { st.zone = Z.TOP; st.top = st.tab; }
        else if (shelf.length) { st.zone = Z.SHELF; st.shelf = nearest(tiles, centerX(cardNodes[st.card])); }
        break;
      case Z.TOP:
        if (dx) {
          st.top = Math.max(0, Math.min(NT + buttonDefs.length - 1, st.top + dx));
          if (st.top < NT) selectTab(st.top);   // as on Apple TV: focusing a tab selects it
        } else if (dy < 0) {
          if (window.More && More.focusIsland()) { st.zone = 'island'; }
        } else if (dy > 0) {
          if (cards.length) { st.zone = Z.CARDS; st.card = Math.min(cards.length - 1, st.top < NT ? 0 : cards.length - 1); }
          else st.zone = Z.SHELF;
        }
        break;
      case Z.DRAWER:
        if (dx) st.drawer = Math.max(0, Math.min(drawerItems.length - 1, st.drawer + dx));
        else if (dy < 0) { closeDrawer(); return; }
        break;
      case Z.APPS:
        var g = st.grid + dx + dy * 5;
        if (g >= 0 && g < others.length && (dx === 0 || Math.floor(g / 5) === Math.floor(st.grid / 5))) st.grid = g;
        break;
      case Z.SETTINGS:
        if (dy) st.row = Math.max(0, Math.min(rowsNow.length - 1, st.row + dy));
        else if (dx && rowsNow[st.row]) {
          var r = rowsNow[st.row];
          if (r.value !== '›') { r.step(dx); renderSettings(); }
        }
        break;
      case Z.EDIT:
        if (dy) st.edit = Math.max(0, Math.min(apps.length - 1, st.edit + dy));
        else if (dx) editShelf(dx);
        break;
      case Z.DETAIL:
        if (dx) st.action = Math.max(0, Math.min(detailActions.length - 1, st.action + dx));
        break;
      case Z.SEARCH:
        if (st.sRow < 0) {
          if (dx) st.sCol = Math.max(0, Math.min(results.length - 1, st.sCol + dx));
          else if (dy < 0) { st.sRow = KEYS.length - 1; st.sCol = Math.min(st.sCol, KEYS[st.sRow].length - 1); }
        } else if (dx) st.sCol = Math.max(0, Math.min(KEYS[st.sRow].length - 1, st.sCol + dx));
        else if (dy < 0 && st.sRow > 0) { st.sRow--; st.sCol = Math.min(st.sCol, KEYS[st.sRow].length - 1); }
        else if (dy > 0 && st.sRow < KEYS.length - 1) { st.sRow++; st.sCol = Math.min(st.sCol, KEYS[st.sRow].length - 1); }
        else if (dy > 0 && results.length) { st.sRow = -1; st.sCol = 0; }
        focusSearch();
        return;
    }
    updateFocus();
  }

  function back() {
    if (playerOn()) { closePlayer(); return; }
    if (st.zone === Z.EDIT) { setClass($('shelfedit'), 'open', false); openSettings(); st.row = rowsNow.length - 2; updateFocus(); return; }
    if (st.zone === Z.DETAIL && hasClass($('detail'), 'playing')) { setClass($('detail'), 'playing', false); $('detail').querySelector('.video').innerHTML = ''; return; }
    if (sheetOpen()) { closeSheets(); return; }
    if (st.zone === Z.DRAWER) { closeDrawer(); return; }
    if (st.zone !== Z.SHELF && shelf.length) { st.zone = Z.SHELF; updateFocus(); return; }
    TV.back();
  }

  /** The pointer focuses what it's over (the Magic Remote, or a mouse when previewing). */
  function hover(node, zone, index) {
    node.onmouseover = function () {
      if (saverOn || (sheetOpen() !== (zone === Z.APPS || zone === Z.SETTINGS || zone === Z.EDIT || zone === Z.DETAIL))) return;
      if (zone === Z.DRAWER && st.zone !== Z.DRAWER) return;
      if (zone !== Z.DRAWER && st.zone === Z.DRAWER && zone !== Z.SHELF) return;
      if (zone === Z.SHELF && st.zone === Z.DRAWER) closeDrawer();
      st.zone = zone;
      if (zone === Z.TOP) { st.top = index; if (index < NT) selectTab(index); }
      else if (zone === Z.DETAIL) st.action = index;
      else if (zone === Z.CARDS) st.card = index;
      else if (zone === Z.SHELF) st.shelf = index;
      else if (zone === Z.DRAWER) st.drawer = index;
      else if (zone === Z.APPS) st.grid = index;
      else if (zone === Z.SETTINGS) st.row = index;
      else if (zone === Z.EDIT) st.edit = index;
      updateFocus();
    };
    node.onclick = function () { node.onmouseover(); activate(); };
  }

  // MARK: - Toast

  var toastTimer = 0;
  function toast(text) {
    var t = $('toast');
    t.textContent = text;
    setClass(t, 'on', true);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { setClass(t, 'on', false); }, 6000);
  }

  // MARK: - Night, clock, screensaver

  function checkNight() {
    setClass(body, 'night', Data.isNight(Date.now()));
  }

  var saverOn = false, idleAt = Date.now(), saverIndex = 0, saverTimer = 0, SAVER_AFTER = 5 * 60000;

  function showSaver() {
    hideLive();
    stopCardTrailer();
    var photos = Data.showcase().filter(function (p) { return p.backdrop && Data.appFor(p.app); });
    var refs = Plus.hub().refs || [];
    for (var r = 0; r < refs.length; r++) photos.splice(Math.min(photos.length, r * 2 + 1), 0, {ref: Plus.hubUrl(refs[r]), title: tr('Referência do dia', 'Reference of the day', 'Referencia del día')});
    saverOn = true;
    var s = $('saver');
    s.innerHTML = '';
    var a = el('div', 'photo', s), b = el('div', 'photo', s);
    el('div', 'shade', s);
    var clock = el('div', 'clock', s);
    el('div', 'time', clock);
    el('div', 'date', clock);
    el('div', 'title', clock);
    var vv = Plus.verse(), verse = el('div', 'verse', s);
    el('div', 'text', verse, '“' + vv.text + '”');
    el('div', 'ref', verse, vv.ref);
    var front = a;
    function next() {
      if (!saverOn) return;
      var p = photos.length ? photos[saverIndex++ % photos.length] : null;
      var back = front === a ? b : a;
      if (p) {
        back.style.backgroundImage = 'url(' + (p.ref || Data.image(p.backdrop, 'original')) + ')';
        back.style.webkitTransform = back.style.transform = 'scale(1.0)';
        clock.lastChild.textContent = p.title + (p.service ? '  ·  ' + tr('na ', 'on ', 'en ') + p.service : '');
        setTimeout(function () {
          setClass(back, 'on', true);
          setClass(front, 'on', false);
          back.style.webkitTransform = back.style.transform = 'scale(1.08) translateX(-1.5%)';
          front = back;
        }, 60);
      }
      tickSaverClock(clock);
      saverTimer = setTimeout(next, 12000);
    }
    setClass(s, 'on', true);
    next();
  }

  function tickSaverClock(clock) {
    var d = new Date();
    clock.firstChild.textContent = Data.time(d.getTime()).replace(/ (AM|PM)$/, '');
    try {
      clock.children[1].textContent = d.toLocaleDateString(I18N.locale(), {weekday: 'long', day: 'numeric', month: 'long'});
    } catch (e) {
      clock.children[1].textContent = d.toDateString();
    }
  }

  function hideSaver() {
    saverOn = false;
    clearTimeout(saverTimer);
    setClass($('saver'), 'on', false);
    placeLive();
  }

  function poke() {
    idleAt = Date.now();
    if (saverOn) { hideSaver(); return true; }
    return false;
  }

  // MARK: - Keys

  function onKey(e) {
    var k = e.keyCode;
    if (poke()) { e.preventDefault(); return; }   // the first press only wakes the screen
    if (window.Fun && Fun.key(k)) { e.preventDefault(); return; }
    if (window.More && More.key(k)) { e.preventDefault(); return; }
    if (k === TV.keys.left) move(-1, 0);
    else if (k === TV.keys.right) move(1, 0);
    else if (k === TV.keys.up) move(0, -1);
    else if (k === TV.keys.down) move(0, 1);
    else if (k === TV.keys.ok && playerOn()) { var vid = $('player').querySelector('video'); if (vid) { if (vid.paused) vid.play(); else vid.pause(); } }
    else if (k === TV.keys.ok) activate();
    else if (k === TV.keys.back || k === 27 || k === 8) back();
    else return;
    e.preventDefault();
  }
  document.addEventListener('keydown', onKey);
  document.addEventListener('mousemove', function () { poke(); });

  // MARK: - Start

  function renderAll() {
    renderTop();
    renderQuotes();
    cards = [];
    renderCards();
    renderShelf();
    renderDrawer();
    renderClock();
    checkNight();
    if (st.zone === Z.SETTINGS) renderSettings();
    updateFocus();
  }

  function loadApps(done) {
    TV.apps(function (list) {
      apps = list;
      Data.setApps(apps);
      pickShelf();
      TV.inputs(function (list2) {
        inputs = list2;
        if (done) done();
      });
    });
  }

  /** Back to the home screen (the app was opened again): the shelf, everything closed, the first tab. */
  function reset() {
    hideSaver();
    closeSheets();
    st.zone = Z.SHELF;
    st.shelf = 0;
    if (st.tab !== 0) { st.tab = 0; renderCards(); }
    updateFocus();
  }

  Plus.onChange(renderCards);
  var hubWas = false;
  Plus.onHub(function () { var on = Plus.hub().online; if (on !== hubWas) { hubWas = on; renderDrawer(); } });
  Data.onChange(function () {
    Plus.refresh();
    renderQuotes();
    renderCards();
    renderPanels();
    checkNight();
  });

  function reopened() {
    // LG: with handlesRelaunch the app has to come to the front itself, or opening it again while it runs shows nothing.
    if (window.PalmSystem && window.PalmSystem.activate) window.PalmSystem.activate();
    reset();
    loadApps(function () { renderShelf(); renderDrawer(); Data.refresh(); });
  }

  window.addEventListener('resize', fit);
  document.addEventListener('webOSRelaunch', reopened);   // LG: opened again while running
  window.addEventListener('appcontrol', reopened);        // Samsung: the same
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { hideSaver(); hideLive(); stopCardTrailer(); return; }
    idleAt = Date.now();
    loadApps(function () { renderShelf(); renderDrawer(); updateFocus(); Data.refresh(); });
  });

  I18N.set(Prefs.language());
  fit();
  renderTop();
  loadApps(function () {
    renderAll();
    Data.refresh();
  });
  renderStats();
  // In the background (another app in front) nothing here runs: the app stays resident but idle.
  setInterval(function () { if (!document.hidden) renderStats(); }, 10000);
  setInterval(function () {
    if (document.hidden) return;
    setTitle();
    renderClock();
    checkNight();
    Data.refresh();
    if (!saverOn && !sheetOpen() && Date.now() - idleAt > SAVER_AFTER) showSaver();
    if (saverOn) tickSaverClock($('saver').querySelector('.clock'));
  }, 30000);

  // What more.js builds on.
  window.Home = {$: $, el: el, setClass: setClass, greeting: greeting, openPanel: openPanel, toast: toast,
    openDetail: openDetail, wake: poke,
    backToTop: function () { if (st.zone === 'island') { st.zone = Z.TOP; updateFocus(); } },
    openLive: function () { var live = liveTV(); if (live) launcher(live.id, tr('TV aberta', 'Live TV', 'TV en vivo'))(); },
    launch: function (id, title) { launcher(id, title)(); }, playing: function () { return playerOn(); }, idleAt: function () { return idleAt; }};

  // For the browser preview and tests.
  window.FreeMyTV = {press: function (k) { onKey({keyCode: k, preventDefault: function () {}}); }, state: st, move: move, activate: activate, back: back, showSaver: showSaver, hideSaver: hideSaver, toast: toast};
})();
