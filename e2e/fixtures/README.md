# Test media

`quiet-sage.webm` is an original two-second, silent 64 × 64 sage-colored video generated for Komolu's browser tests. It contains no third-party artwork or recording and is distributed under the repository's MIT license.

Reproduce it with FFmpeg:

```bash
ffmpeg -f lavfi -i color=c=0x476857:s=64x64:r=10:d=2 -an -c:v libvpx -b:v 20k -metadata title='Komolu original test fixture' e2e/fixtures/quiet-sage.webm
```
