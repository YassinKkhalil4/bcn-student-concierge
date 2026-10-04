"""Translation workflow for the guide PDF.

  python3 guide-pdf/i18n_tool.py todo   <units.json> <outdir>      numbered English list + sidecar
  python3 guide-pdf/i18n_tool.py build  <outdir> <locale> <file>   "N|translation" lines -> src/lib/guide/i18n/pdf-<locale>.json

Inline <span style="..."> in a unit is shown as <x>..</x> so a translator never has to copy CSS;
<b>, <i> and <br> stay as they are. build puts the original tags back and refuses a translation
whose tags do not match its source, so a translation cannot break a page.
"""
import json, re, sys, os

def explode(unit):
    spans = re.findall(r'<span[^>]*>', unit)
    t = unit
    for i, s in enumerate(spans):
        t = t.replace(s, f'<x{i}>' if len(spans) > 1 else '<x>', 1)
    t = t.replace('</span>', '</x>')
    return t, spans

def tags(t):
    return sorted(re.findall(r'</?(?:b|i|br|x\d?)\s*/?>', t))

if sys.argv[1] == 'todo':
    units = json.load(open(sys.argv[2]))
    seen, order = set(), []
    for page in sorted(units):
        for u in units[page]:
            if u not in seen:
                seen.add(u); order.append(u)
    out = sys.argv[3]; os.makedirs(out, exist_ok=True)
    side = []
    with open(f'{out}/todo.txt', 'w') as f:
        for n, u in enumerate(order, 1):
            t, spans = explode(u)
            side.append({'n': n, 'unit': u, 'spans': spans})
            f.write(f'{n}|{t}\n')
    json.dump(side, open(f'{out}/sidecar.json', 'w'))
    print(len(order), 'units')
else:
    out, locale, src = sys.argv[2], sys.argv[3], sys.argv[4]
    side = {s['n']: s for s in json.load(open(f'{out}/sidecar.json'))}
    tr = {}
    for line in open(src, encoding='utf8'):
        line = line.rstrip('\n')
        if not line.strip(): continue
        n, _, t = line.partition('|')
        tr[int(n)] = t
    missing = [n for n in side if n not in tr]
    bad = []
    d = {}
    for n, s in side.items():
        if n not in tr: continue
        t = tr[n]
        src_t, spans = explode(s['unit'])
        if tags(t) != tags(src_t):
            bad.append((n, tags(src_t), tags(t))); continue
        for i, sp in enumerate(spans):
            t = t.replace(f'<x{i}>' if len(spans) > 1 else '<x>', sp)
        t = t.replace('</x>', '</span>')
        d[s['unit']] = t
    print(locale, 'translated', len(d), 'missing', len(missing), 'bad', len(bad))
    for b in bad[:20]: print('  bad tags', b)
    if missing[:20]: print('  missing', missing[:20])
    path = f'src/lib/guide/i18n/pdf-{locale}.json'
    json.dump(d, open(path, 'w'), ensure_ascii=False, indent=1)
