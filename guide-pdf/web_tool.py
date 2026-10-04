"""Build src/lib/guide/i18n/web-<locale>.json from numbered translations.
   python3 guide-pdf/web_tool.py <todo.json> <locale> <translations.txt>
todo.json is the list of English strings the PDF dictionaries do not cover (see README).
Each line of the translations file is  N|translation  (N is the 1-based index in the list).
Refuses a translation whose inline markup (**bold**, *italic*, [link](/path)) differs from the source."""
import json, re, sys
todo = json.load(open(sys.argv[1])); locale = sys.argv[2]
tr = {}
for line in open(sys.argv[3], encoding='utf8'):
    line = line.rstrip('\n')
    if not line.strip(): continue
    n, _, t = line.partition('|'); tr[int(n)] = t
def shape(s):
    return (s.count('**'), len(re.findall(r'(?<!\*)\*(?!\*)', s)), sorted(re.findall(r'\]\((/[^)]*)\)', s)))
out, bad, missing = {}, [], []
for i, en in enumerate(todo, 1):
    if i not in tr: missing.append(i); continue
    if shape(en) != shape(tr[i]): bad.append((i, shape(en), shape(tr[i]))); continue
    out[en] = tr[i]
print(locale, 'translated', len(out), 'missing', missing, 'bad', len(bad))
for b in bad: print('  bad markup', b)
json.dump(out, open(f'src/lib/guide/i18n/web-{locale}.json', 'w'), ensure_ascii=False, indent=1)
