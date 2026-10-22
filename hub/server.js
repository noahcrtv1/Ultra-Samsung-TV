// Ultra Hub: the computer's side of the Ultra Samsung TV home screen.
//  - /api/tv/state     what the TV polls: the last reminder, the Mac's load and renders, Spotify, references, a cast
//  - /                 the phone page: remote control, typing into the TV, reminders, send to TV
//  - /yt.html          YouTube player page (YouTube refuses embeds from the TV app's file:// origin)
//  - /refs/*, /media/* references (~/Pictures/Referencias) and videos to send (~/Movies/TV)
'use strict';
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');
const WebSocket = require('ws');

const ROOT = __dirname;
const CONFIG_FILE = path.join(ROOT, 'config.json');
const STATE_FILE = path.join(ROOT, 'data', 'state.json');
const config = Object.assign({
  port: 3020,
  tvIp: '',   // the TV's IP, for the phone remote
  refsDir: path.join(os.homedir(), 'Pictures', 'Referencias'),
  mediaDir: path.join(os.homedir(), 'Movies', 'TV'),
  spotifyClientId: '',
  spotifyClientSecret: '',
}, readJson(CONFIG_FILE, {}));

fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
for (const d of [config.refsDir, config.mediaDir]) fs.mkdirSync(d, { recursive: true });

// Saved between runs: the TV's remote token, Spotify's refresh token, the last reminder.
const saved = readJson(STATE_FILE, {});
function save() { fs.writeFileSync(STATE_FILE, JSON.stringify(saved, null, 2)); }
function readJson(file, fallback) { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return fallback; } }

// MARK: - The Mac's load and what it's rendering

let cpuPrev = os.cpus();
const mac = { cpu: 0, ramUsed: 0, ramTotal: 0, jobs: [] };

// Exporters worth showing: name on screen → process name.
const RENDERERS = [
  ['Adobe Media Encoder', /Adobe Media Encoder/],
  ['Premiere Pro (exportando)', /Adobe Premiere Pro.*(Export|Render)/i],
  ['ConverterCRTV', /ConverterCRTV/],
  ['ffmpeg', /(^|\/)ffmpeg( |$)/],
  ['After Effects (render)', /aerender/],
  ['DaVinci Resolve', /Resolve/],
];

function sampleMac() {
  const now = os.cpus();
  let idle = 0, total = 0;
  now.forEach((c, i) => {
    const p = cpuPrev[i] ? cpuPrev[i].times : { user: 0, nice: 0, sys: 0, idle: 0, irq: 0 };
    const t = c.times;
    const dt = (t.user - p.user) + (t.nice - p.nice) + (t.sys - p.sys) + (t.idle - p.idle) + (t.irq - p.irq);
    idle += t.idle - p.idle;
    total += dt;
  });
  cpuPrev = now;
  mac.cpu = total ? Math.round(100 * (1 - idle / total)) : 0;
  mac.ramTotal = +(os.totalmem() / 1073741824).toFixed(1);
  // macOS counts cache as used; vm_stat's "pages free + inactive + speculative" is what's really available.
  execFile('vm_stat', (err, out) => {
    if (err) return;
    const page = +(/page size of (\d+)/.exec(out) || [0, 16384])[1];
    const n = (k) => +((new RegExp(k + ':\\s+(\\d+)').exec(out) || [0, 0])[1]);
    const free = (n('Pages free') + n('Pages inactive') + n('Pages speculative')) * page;
    mac.ramUsed = +((os.totalmem() - free) / 1073741824).toFixed(1);
  });
  execFile('ps', ['-axo', 'pcpu=,command='], { maxBuffer: 4 << 20 }, (err, out) => {
    if (err) return;
    const jobs = [];
    for (const [name, re] of RENDERERS) {
      const line = out.split('\n').find((l) => re.test(l) && parseFloat(l) > 5);
      if (line) jobs.push({ name, progress: -1, cpu: Math.round(parseFloat(line)) });
    }
    mac.jobs = jobs;
  });
}
sampleMac();
setInterval(sampleMac, 3000);

// MARK: - Spotify: what's playing on any device

let spotifyToken = null, spotifyTokenAt = 0;
const music = { playing: false };

function spotifyRedirect() { return `http://127.0.0.1:${config.port}/spotify/callback`; }

function post(url, body, headers) {
  return fetch(url, { method: 'POST', body, headers }).then((r) => r.json());
}

async function spotifyAccess() {
  if (!saved.spotifyRefresh || !config.spotifyClientId) return null;
  if (spotifyToken && Date.now() - spotifyTokenAt < 50 * 60000) return spotifyToken;
  const auth = Buffer.from(config.spotifyClientId + ':' + config.spotifyClientSecret).toString('base64');
  const r = await post('https://accounts.spotify.com/api/token',
    new URLSearchParams({ grant_type: 'refresh_token', refresh_token: saved.spotifyRefresh }),
    { Authorization: 'Basic ' + auth, 'Content-Type': 'application/x-www-form-urlencoded' });
  if (!r.access_token) return null;
  if (r.refresh_token) { saved.spotifyRefresh = r.refresh_token; save(); }
  spotifyToken = r.access_token;
  spotifyTokenAt = Date.now();
  return spotifyToken;
}

async function sampleMusic() {
  try {
    const token = await spotifyAccess();
    if (!token) { music.playing = false; return; }
    const r = await fetch('https://api.spotify.com/v1/me/player/currently-playing', { headers: { Authorization: 'Bearer ' + token } });
    if (r.status !== 200) { music.playing = false; return; }
    const j = await r.json();
    const item = j.item || {};
    Object.assign(music, {
      playing: !!j.is_playing,
      title: item.name || '',
      artist: (item.artists || []).map((a) => a.name).join(', ') || (item.show && item.show.name) || '',
      art: ((item.album && item.album.images) || item.images || [])[0]?.url || '',
    });
  } catch (e) { music.playing = false; }
}
setInterval(sampleMusic, 5000);

async function spotifyControl(action) {
  const token = await spotifyAccess();
  if (!token) return;
  const map = { pause: ['PUT', 'pause'], play: ['PUT', 'play'], next: ['POST', 'next'], previous: ['POST', 'previous'] };
  const m = map[action];
  if (m) await fetch('https://api.spotify.com/v1/me/player/' + m[1], { method: m[0], headers: { Authorization: 'Bearer ' + token } });
  setTimeout(sampleMusic, 600);
}

// MARK: - References: images in ~/Pictures/Referencias, six a day

const IMG = /\.(jpe?g|png|webp|gif)$/i;
function refs() {
  let files = [];
  try { files = fs.readdirSync(config.refsDir).filter((f) => IMG.test(f)); } catch (e) {}
  const day = Math.floor(Date.now() / 86400000);
  files.sort((a, b) => hash(a + day) - hash(b + day));
  return files.slice(0, 6).map((f) => '/refs/' + encodeURIComponent(f));
}
function hash(s) { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0; return h; }

// MARK: - The TV's remote: Samsung's WebSocket API (asks on the TV once, then keeps a token)

function remoteUrl() {
  const name = Buffer.from('Ultra Hub').toString('base64');
  return `wss://${config.tvIp}:8002/api/v2/channels/samsung.remote.control?name=${name}` + (saved.tvToken ? '&token=' + saved.tvToken : '');
}

let tv = null, tvReady = false, tvQueue = [];
function tvSocket() {
  if (tv) return;
  tv = new WebSocket(remoteUrl(), { rejectUnauthorized: false });
  tv.on('message', (data) => {
    let m = {};
    try { m = JSON.parse(data); } catch (e) {}
    if (m.event === 'ms.channel.connect') {
      if (m.data && m.data.token) { saved.tvToken = m.data.token; save(); }
      tvReady = true;
      tvQueue.splice(0).forEach((x) => tv.send(x));
    }
  });
  const drop = () => { tv = null; tvReady = false; };
  tv.on('close', drop);
  tv.on('error', drop);
}

function tvSend(msg) {
  const s = JSON.stringify(msg);
  if (tv && tvReady) tv.send(s); else { tvQueue.push(s); tvSocket(); }
}

function tvKey(key) {
  tvSend({ method: 'ms.remote.control', params: { Cmd: 'Click', DataOfCmd: key, Option: 'false', TypeOfRemote: 'SendRemoteKey' } });
}

// Typing into the TV's on-screen keyboard (a field must be focused on the TV).
function tvText(text) {
  tvSend({ method: 'ms.remote.control', params: { Cmd: Buffer.from(text).toString('base64'), DataOfCmd: 'base64', TypeOfRemote: 'SendInputString' } });
  setTimeout(() => tvSend({ method: 'ms.remote.control', params: { TypeOfRemote: 'SendInputEnd' } }), 300);
}

// MARK: - HTTP

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.mp4': 'video/mp4',
  '.mov': 'video/quicktime', '.m4v': 'video/mp4', '.webm': 'video/webm', '.json': 'application/json' };

function send(res, code, body, type) {
  res.writeHead(code, { 'Content-Type': type || 'application/json', 'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type', 'Cache-Control': 'no-store' });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}

// Files inside dir only (no ../), with Range for videos.
function file(req, res, dir, name) {
  const p = path.resolve(dir, decodeURIComponent(name));
  if (!p.startsWith(path.resolve(dir) + path.sep)) return send(res, 403, { error: 'no' });
  fs.stat(p, (err, st) => {
    if (err || !st.isFile()) return send(res, 404, { error: 'not found' });
    const type = TYPES[path.extname(p).toLowerCase()] || 'application/octet-stream';
    const range = /bytes=(\d*)-(\d*)/.exec(req.headers.range || '');
    if (range) {
      const start = range[1] ? +range[1] : 0, end = range[2] ? +range[2] : st.size - 1;
      res.writeHead(206, { 'Content-Type': type, 'Content-Range': `bytes ${start}-${end}/${st.size}`, 'Accept-Ranges': 'bytes',
        'Content-Length': end - start + 1, 'Access-Control-Allow-Origin': '*' });
      fs.createReadStream(p, { start, end }).pipe(res);
    } else {
      res.writeHead(200, { 'Content-Type': type, 'Content-Length': st.size, 'Accept-Ranges': 'bytes', 'Access-Control-Allow-Origin': '*' });
      fs.createReadStream(p).pipe(res);
    }
  });
}

function body(req) {
  return new Promise((ok) => {
    let b = '';
    req.on('data', (c) => { b += c; if (b.length > 1e5) req.destroy(); });
    req.on('end', () => { try { ok(JSON.parse(b || '{}')); } catch (e) { ok({}); } });
  });
}

function media() {
  try { return fs.readdirSync(config.mediaDir).filter((f) => /\.(mp4|m4v|mov|webm)$/i.test(f)).sort(); } catch (e) { return []; }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const p = url.pathname;
  if (req.method === 'OPTIONS') return send(res, 204, '');

  if (p === '/api/tv/state') {
    return send(res, 200, { reminder: saved.reminder || null, mac, music, refs: refs(), cast: saved.cast || null, at: Date.now() });
  }
  if (p === '/api/reminder' && req.method === 'POST') {
    const b = await body(req);
    const text = String(b.text || '').trim().slice(0, 200);
    if (!text) return send(res, 400, { error: 'empty' });
    saved.reminder = { text, from: String(b.from || '').slice(0, 30), at: Date.now() };
    save();
    return send(res, 200, { ok: true });
  }
  if (p === '/api/key' && req.method === 'POST') { const b = await body(req); if (/^KEY_[A-Z0-9_]+$/.test(b.key)) tvKey(b.key); return send(res, 200, { ok: true }); }
  if (p === '/api/text' && req.method === 'POST') { const b = await body(req); if (b.text) tvText(String(b.text).slice(0, 500)); return send(res, 200, { ok: true }); }
  if (p === '/api/music' && req.method === 'POST') { const b = await body(req); await spotifyControl(b.action); return send(res, 200, { ok: true }); }
  if (p === '/api/media') return send(res, 200, media());
  if (p === '/api/cast' && req.method === 'POST') {
    const b = await body(req);
    let cast = null;
    const yt = /(?:youtu\.be\/|v=|shorts\/)([\w-]{11})/.exec(b.url || '');
    if (yt) cast = { kind: 'youtube', id: yt[1] };
    else if (b.file && media().includes(b.file)) cast = { kind: 'video', url: '/media/' + encodeURIComponent(b.file), title: b.file };
    else if (b.stop) cast = { kind: 'stop' };
    if (!cast) return send(res, 400, { error: 'unknown' });
    cast.at = Date.now();
    saved.cast = cast;
    save();
    return send(res, 200, { ok: true });
  }
  if (p === '/spotify/login') {
    if (!config.spotifyClientId) return send(res, 200, 'Ponha spotifyClientId e spotifyClientSecret em config.json e reinicie.', 'text/plain; charset=utf-8');
    const q = new URLSearchParams({ response_type: 'code', client_id: config.spotifyClientId, redirect_uri: spotifyRedirect(),
      scope: 'user-read-currently-playing user-read-playback-state user-modify-playback-state' });
    res.writeHead(302, { Location: 'https://accounts.spotify.com/authorize?' + q });
    return res.end();
  }
  if (p === '/spotify/callback') {
    const auth = Buffer.from(config.spotifyClientId + ':' + config.spotifyClientSecret).toString('base64');
    const r = await post('https://accounts.spotify.com/api/token',
      new URLSearchParams({ grant_type: 'authorization_code', code: url.searchParams.get('code') || '', redirect_uri: spotifyRedirect() }),
      { Authorization: 'Basic ' + auth, 'Content-Type': 'application/x-www-form-urlencoded' });
    if (r.refresh_token) { saved.spotifyRefresh = r.refresh_token; save(); spotifyToken = null; }
    return send(res, 200, r.refresh_token ? 'Spotify conectado. Pode fechar.' : 'Não deu: ' + JSON.stringify(r), 'text/plain; charset=utf-8');
  }
  if (p.startsWith('/refs/')) return file(req, res, config.refsDir, p.slice(6));
  if (p.startsWith('/media/')) return file(req, res, config.mediaDir, p.slice(7));
  return file(req, res, path.join(ROOT, 'public'), p === '/' ? 'index.html' : p.slice(1));
});

server.listen(config.port, '0.0.0.0', () => console.log('Ultra Hub on :' + config.port));
