#!/usr/bin/env python3
"""Fetch the exact licensed public previews recorded in the shipped manifest.
Usage: python3 scripts/audio/fetch.py /tmp/komolu-audio-sources
No account, API key, original-download endpoint or runtime CDN is used.
"""
import hashlib
import json
import pathlib
import sys
import urllib.request

root = pathlib.Path(__file__).resolve().parents[2]
out = pathlib.Path(sys.argv[1])
out.mkdir(parents=True, exist_ok=True)
manifest = json.loads((root / 'public/audio/manifest.json').read_text())
for item in manifest:
    name = item['id']
    encoded = urllib.request.urlopen(item['preview'][0], timeout=30).read()
    if hashlib.sha256(encoded).hexdigest() != item['sourceSha256']:
        raise ValueError(f'{name}: upstream preview changed; review before redistribution')
    html = urllib.request.urlopen(item['page'], timeout=30).read()
    if b'creativecommons.org/publicdomain/zero/1.0/' not in html:
        raise ValueError(f'{name}: license must be reviewed again')
    (out / f'{name}.mp3').write_bytes(encoded)
    (out / f'{name}.html').write_bytes(html)
(out / 'sources.json').write_text(json.dumps(manifest, indent=2) + '\n')
print('Verified sources downloaded. Run scripts/audio/prepare.py with this folder.')
