# Preparing bundled audio

The distributed FLAC files are derivatives of the **public MP3 previews**, not the original WAVs (original download requires a Freesound account). Exact page, preview URL, author, CC0 URL, retrieval date and SHA-256 are in `public/audio/manifest.json`. These are seven separate author uploads whose own pages displayed **Creative Commons 0** on 2026-10-13. `public/audio/CREDITS.txt` accompanies the static build.

To rebuild, with Python 3, NumPy and FFmpeg available:

```sh
python3 scripts/audio/fetch.py /tmp/komolu-audio-sources
python3 scripts/audio/prepare.py /tmp/komolu-audio-sources
```

Fetching fails if the preview checksum or the license changes. Public upstream endpoints may become unavailable: do not substitute another upload without reviewing its license and updating the manifest. Pages are dynamic; their observed HTML hashes are evidence of the retrieved page, not a required stable identifier. Never publish the downloaded HTML: it contains unrelated site metadata.

Preparation selects a 22-second excerpt, resamples to stereo 32 kHz, removes DC, overlaps the last and first two seconds using sine/cosine gains, applies a memoryless soft peak ceiling and matches RMS to -22 dBFS. The resulting 20-second loop is encoded as 16-bit FLAC (no extra lossy encoding or encoder padding). This avoids a periodic dip to silence. Isolated rain drops and fire crackles required peak control; a plain peak normalization reduced their beds to about -44 dBFS. The soft ceiling changes transients without an envelope follower that could pump the ambience.

The manifest captures the exact excerpt, gain, treatment, RMS, peak and final checksum. FFmpeg versions may produce different compressed bytes while preserving PCM. Output is loaded only from the deployed site's origin. No fetch script or upstream URL is used at runtime.

These controls and browser decoding checks are **not a human listening test**. The café is a real room recording with voices in the background; confirming that no words are intelligible remains a listening-review requirement. Do not label an unfamiliar language as inherently unintelligible.
