"""What the LG (webos/build.py) and Samsung (tizen/build.py) packages share: the settings and the web app's files.

The settings come from config.properties, the same file as the Android build. --generic leaves it out (the GitHub
release is built that way): no TMDB key, and the TV's time zone picks the city, the currency and the region.
"""
import json
import os
import re
import shutil
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

GENERIC = {'tmdbKey': '', 'tmdbRegion': '', 'latitude': '', 'longitude': '', 'city': '', 'language': 'auto',
           'currency': '', 'temperature': 'auto', 'showCrypto': True, 'hideAnimation': False}


def config_from_args(args):
    """The settings for these command-line arguments (--generic, --config PATH or config.properties)."""
    if '--generic' in args:
        return dict(GENERIC)
    path = os.path.join(ROOT, 'config.properties')
    if '--config' in args:
        path = os.path.abspath(args[args.index('--config') + 1])
    return read_config(path)


def read_config(path):
    if not os.path.exists(path):
        shutil.copy(os.path.join(ROOT, 'config.example.properties'), path)
        print('Created config.properties: add your TMDB key and your city there (optional), then build again.')
    values = {}
    with open(path, encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith('#') or '=' not in line:
                continue
            key, value = line.split('=', 1)
            values[key.strip()] = value.strip().strip('"')

    def number(key, default):
        v = values.get(key, '') or default
        if not re.match(r'^-?\d+(\.\d+)?$', v):
            sys.exit('config.properties: %s must be a number (got "%s")' % (key, v))
        return v

    return {
        'tmdbKey': values.get('tmdb_key', ''),
        'tmdbRegion': values.get('tmdb_region', 'US') or 'US',
        'latitude': number('latitude', '40.7128'),
        'longitude': number('longitude', '-74.0060'),
        'city': values.get('city', ''),
        'language': values.get('language', 'auto') or 'auto',
        'currency': values.get('currency', 'USD') or 'USD',
        'temperature': values.get('temperature', 'auto') or 'auto',
        'showCrypto': values.get('show_crypto', 'true').lower() != 'false',
        'hideAnimation': values.get('hide_animation', 'false').lower() == 'true',
        'hubUrl': values.get('hub_url', '').rstrip('/'),
        'name': values.get('name', ''),
        'team': {
            'espnId': values.get('team_espn_id', ''),
            'abbr': values.get('team_abbr', ''),
            'name': values.get('team_name', ''),
            'nickname': values.get('team_nickname', ''),
            'leagues': [x.strip() for x in values.get('team_leagues', 'bra.1').split(',') if x.strip()],
            'scheduleUrl': values.get('team_schedule_url', ''),
        },
        'wifiSsid': values.get('wifi_ssid', ''),
        'trailerPage': values.get('trailer_page', ''),
        'voiceMonkeyUrl': values.get('voice_monkey_url', ''),
        'voiceMonkeyGoalUrl': values.get('voice_monkey_goal_url', ''),
        'voiceMonkeyPregameUrl': values.get('voice_monkey_pregame_url', ''),
        'wifiPassword': values.get('wifi_password', ''),
    }


def wifi_qr(config):
    """The guests' Wi-Fi as a QR code (PNG bytes), from wifi_ssid/wifi_password; None without them.
    The password only goes into the picture, never into config.js."""
    ssid = config.get('wifiSsid')
    password = config.pop('wifiPassword', '')
    if not ssid:
        return None
    import io
    import qrcode
    def esc(v):
        return re.sub(r'([\\;,:"])', r'\\\1', v)
    text = 'WIFI:T:%s;S:%s;P:%s;;' % ('WPA' if password else 'nopass', esc(ssid), esc(password))
    img = qrcode.make(text, box_size=12, border=2)
    buf = io.BytesIO()
    img.save(buf, format='PNG')
    return buf.getvalue()


def coins():
    """The coins' logos from the Android app's vector drawables, as SVG paths (BTC, ETH, SOL, USDT)."""
    out = []
    for name in ('btc', 'eth', 'sol', 'usdt'):
        with open(os.path.join(ROOT, 'app', 'res', 'drawable', 'coin_%s.xml' % name), encoding='utf-8') as f:
            out.append(re.findall(r'android:pathData="([^"]+)"', f.read()))
    return out


def files(config, made_by):
    """The web app's files, {path inside the app: bytes}: web/, the settings, the app's symbols and font."""
    out = {}
    web = os.path.join(ROOT, 'web')
    for name in sorted(os.listdir(web)):
        if os.path.isdir(os.path.join(web, name)):
            continue
        with open(os.path.join(web, name), 'rb') as f:
            out[name] = f.read()
    icons = os.path.join(web, 'icons')
    for name in sorted(os.listdir(icons)):
        with open(os.path.join(icons, name), 'rb') as f:
            out['icons/' + name] = f.read()
    config = dict(config)
    wifi = wifi_qr(config)   # takes the password out of config
    if wifi:
        out['wifi-qr.png'] = wifi
    out['config.js'] = ('/* Generated by %s. */\nwindow.CONFIG = %s;\n'
                        % (made_by, json.dumps(config, ensure_ascii=False))).encode('utf-8')
    out['coins.js'] = ('window.COINS = %s;\n' % json.dumps(coins())).encode('utf-8')
    symbols = os.path.join(ROOT, 'app', 'assets', 'symbols')
    for name in sorted(os.listdir(symbols)):
        if name.endswith('.png') or name.startswith('LICENSE'):
            with open(os.path.join(symbols, name), 'rb') as f:
                out['symbols/' + name] = f.read()
    for name in ('InterVariable.ttf', 'OFL.txt'):
        with open(os.path.join(ROOT, 'app', 'assets', 'fonts', name), 'rb') as f:
            out['fonts/' + name] = f.read()
    return out


def preview(app, out_dir):
    """Leaves the app's files in out_dir, to open index.html in a browser."""
    if os.path.isdir(out_dir):
        shutil.rmtree(out_dir)
    for path, content in app.items():
        target = os.path.join(out_dir, path)
        os.makedirs(os.path.dirname(target), exist_ok=True)
        with open(target, 'wb') as f:
            f.write(content)
