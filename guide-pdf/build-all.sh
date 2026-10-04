#!/bin/sh
# Rebuild every language of the guide PDF and its cover image.
#   guide-pdf/build-all.sh            (from the repo root, with Docker)
# Needs the Playwright image; PW_MODULE points at a playwright install inside it.
set -e
IMG=mcr.microsoft.com/playwright:v1.49.1-noble
OUT=${OUT:-/tmp/guide-build}
mkdir -p "$OUT"
for l in en es ca fr it de; do
  rm -rf "$OUT/$l"
  docker run --rm -v "$PWD":/work -v "$OUT":/out -w /work -e PW_MODULE=${PW_MODULE:-playwright} $IMG \
    sh -c "[ -d node_modules/playwright ] || npm i --no-save playwright@1.49.1 >/dev/null 2>&1; node guide-pdf/build.mjs $l /out/$l" | grep -E '^(MISSING|FIT)' || true
  if [ "$l" = en ]; then dest=assets/guide/landing-in-barcelona.pdf; else dest=assets/guide/landing-in-barcelona.$l.pdf; fi
  python3 guide-pdf/merge.py "$OUT/$l" "$dest" "Landing in Barcelona 2026/27 ($l)"
done
python3 - <<'PY'
import pymupdf
from PIL import Image
for l in ['en','es','ca','fr','it','de']:
    src = 'assets/guide/landing-in-barcelona.pdf' if l == 'en' else f'assets/guide/landing-in-barcelona.{l}.pdf'
    d = pymupdf.open(src); z = 1200 / d[0].rect.width
    d[0].get_pixmap(matrix=pymupdf.Matrix(z, z)).save('/tmp/cover.png')
    im = Image.open('/tmp/cover.png').convert('RGB')
    im.resize((1200, round(1200 * im.height / im.width)), Image.LANCZOS).save('assets/guide/cover.png' if l == 'en' else f'assets/guide/cover-{l}.png', optimize=True)
PY
