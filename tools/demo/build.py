#!/usr/bin/env python3
"""Builds the web demo of Free My TV Clássico into out/demo: the same web app with recorded TMDB answers
(fixtures.json → fixtures.js) instead of a key, an on-screen remote, and nothing secret from config.properties.

    python3 tools/demo/build.py FIXTURES.json [--neutral]
"""
import json
import os
import shutil
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, os.path.join(ROOT, 'tools'))
import webapp  # noqa: E402

OUT = os.path.join(ROOT, 'out', 'demo')
SECRET = ('voiceMonkeyUrl', 'voiceMonkeyGoalUrl', 'voiceMonkeyPregameUrl', 'hubUrl', 'wifiSsid', 'wifiPassword')


def main():
    config = webapp.config_from_args([])
    for k in SECRET:
        config[k] = ''
    # --neutral: nothing personal (a generic city, no name, no team). Without it the name, city and team stay.
    if '--neutral' in sys.argv:
      config.update({'name': '', 'city': 'São Paulo', 'latitude': '-23.5505', 'longitude': '-46.6333',
                     'team': {'espnId': '', 'abbr': '', 'name': '', 'nickname': '', 'leagues': [], 'scheduleUrl': ''}})
    config['tmdbKey'] = 'demo'   # the picks only run with a key; demo.js answers for TMDB
    config['trailerPage'] = 'yt.html'
    app = webapp.files(config, 'tools/demo/build.py')
    assert 'wifi-qr.png' not in app
    with open([a for a in sys.argv[1:] if not a.startswith('--')][0], encoding='utf-8') as f:
        fixtures = json.load(f)
    app['fixtures.js'] = ('window.FIXTURES = %s;\n' % json.dumps(fixtures, ensure_ascii=False, separators=(',', ':'))).encode('utf-8')
    for name in ('demo.js', 'demo.css'):
        with open(os.path.join(HERE, name), 'rb') as f:
            app[name] = f.read()
    with open(os.path.join(ROOT, 'hub', 'public', 'yt.html'), 'rb') as f:
        app['yt.html'] = f.read()
    html = app['index.html'].decode('utf-8')
    html = html.replace('<title>Free My TV</title>', '<title>Ultra Samsung TV</title>\n<link rel="stylesheet" href="demo.css">')
    html = html.replace('<script src="config.js"></script>', '<script src="config.js"></script>\n<script src="fixtures.js"></script>\n<script src="demo.js"></script>')
    html = html.replace('<script src="$WEBAPIS/webapis/webapis.js"></script>\n', '')
    app['index.html'] = html.encode('utf-8')
    if os.path.isdir(OUT):
        shutil.rmtree(OUT)
    for path, data in app.items():
        dest = os.path.join(OUT, path)
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        with open(dest, 'wb') as f:
            f.write(data)
    print('Built out/demo (%d files, %d KB)' % (len(app), sum(len(v) for v in app.values()) // 1024))


if __name__ == '__main__':
    main()
