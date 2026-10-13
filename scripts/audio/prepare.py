#!/usr/bin/env python3
"""Rebuild loops from licensed public previews in a local source folder.
Usage: python3 scripts/audio/prepare.py /tmp/komolu-audio-sources
Requires NumPy and FFmpeg. Never runs during the application build.
"""
import hashlib
import json
import pathlib
import subprocess
import sys

import numpy as np

root = pathlib.Path(__file__).resolve().parents[2]
source = pathlib.Path(sys.argv[1])
manifest = []
starts = {
    'rain': 8, 'fire': 12, 'forest': 4, 'waves': 45,
    'wind': 69, 'thunder': 187, 'cafe': 141,
}
rate = 32_000

for item in json.loads((source / 'sources.json').read_text()):
    name = item['id']
    original = source / f'{name}.mp3'
    raw = subprocess.check_output([
        'ffmpeg', '-v', 'error', '-ss', str(starts[name]), '-i', str(original),
        '-t', '22', '-ar', str(rate), '-ac', '2', '-f', 'f32le', '-',
    ])
    samples = np.frombuffer(raw, dtype='<f4').reshape(-1, 2).copy()
    if samples.shape[0] != 22 * rate:
        raise ValueError(f'{name}: incomplete excerpt')
    samples -= samples.mean(axis=0)

    # Overlap tail and head. The loop boundary joins adjacent original samples,
    # instead of fading both sides to zero and causing a periodic volume dip.
    fade = 2 * rate
    t = np.arange(fade) / fade * np.pi / 2
    cross = (samples[-fade:] * np.cos(t)[:, None]
             + samples[:fade] * np.sin(t)[:, None])
    loop = np.concatenate((samples[fade:-fade], cross))

    # Memoryless soft peak control avoids pumping around drops/crackles.
    # Isolated transients must not dictate the ambient bed's playback level.
    target = 10 ** (-22 / 20)
    gain = target / np.sqrt(np.mean(loop ** 2))
    for _ in range(8):
        shaped = 0.5 * np.tanh(loop * gain / 0.5)
        gain *= target / np.sqrt(np.mean(shaped ** 2))
    loop = 0.5 * np.tanh(loop * gain / 0.5)

    output = root / 'public/audio' / f'{name}.flac'
    subprocess.run([
        'ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ar', str(rate),
        '-ac', '2', '-i', '-', '-c:a', 'flac', '-sample_fmt', 's16',
        '-compression_level', '8', '-map_metadata', '-1', str(output),
    ], input=loop.astype('<f4').tobytes(), check=True)

    html = (source / f'{name}.html').read_bytes()
    manifest.append({
        **item,
        'retrieved': '2026-10-13',
        'inputKind': 'public MP3 preview; original download requires account',
        'sourceSha256': hashlib.sha256(original.read_bytes()).hexdigest(),
        'licensePageSha256': hashlib.sha256(html).hexdigest(),
        'asset': f'audio/{name}.flac',
        'assetSha256': hashlib.sha256(output.read_bytes()).hexdigest(),
        'bytes': output.stat().st_size,
        'sampleRate': rate,
        'channels': 2,
        'frames': len(loop),
        'duration': len(loop) / rate,
        'excerptStart': starts[name],
        'excerptSeconds': 22,
        'crossfadeSeconds': 2,
        'gain': float(gain),
        'peakTreatment': 'memoryless tanh ceiling 0.5 (-6.02 dBFS), RMS -22 dBFS',
        'rmsDbFS': float(20 * np.log10(np.sqrt(np.mean(loop ** 2)))),
        'peakDbFS': float(20 * np.log10(np.max(np.abs(loop)))),
        'seamStep': float(np.max(np.abs(loop[-1] - loop[0]))),
    })

(root / 'public/audio/manifest.json').write_text(
    json.dumps(manifest, ensure_ascii=False, indent=2) + '\n'
)
print(json.dumps([
    {key: item[key] for key in ['id', 'bytes', 'rmsDbFS', 'peakDbFS', 'seamStep']}
    for item in manifest
], indent=2))
