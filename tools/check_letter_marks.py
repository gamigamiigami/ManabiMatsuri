# letter.html の MARKS を、手紙の本文に当てて結果を確かめる
import io, re, sys, json
s = io.open('js/puzzles.js', encoding='utf-8').read()
m = re.search(r'const PROLOGUE =\n(.*?);\n', s, re.S)
raw = ''.join(re.findall(r'"((?:[^"\\]|\\.)*)"', m.group(1))).replace('\\n', '\n')
lines = raw.split('\n')
sign = [i for i, l in enumerate(lines) if l.startswith('──')][0]
body = '\n'.join(lines[:sign]).rstrip('\n')
flat = body.replace('\n', '')

h = io.open('letter.html', encoding='utf-8').read()
block = re.search(r'var MARKS = \[(.*?)\n  \];', h, re.S).group(1)
marks = re.findall(r'\["((?:[^"\\]|\\.)*)",\s*(\d+),\s*"(mk-\w+)"\]', block)

ANSWERS = ["この学校", "でなやんで", "ずっとおもって"]
color = {}
ng = []
for pat, off, cls in marks:
    at = flat.find(pat)
    if at < 0:
        ng.append("見つからない: " + pat); continue
    if flat.find(pat, at + 1) >= 0:
        ng.append("2か所以上ある: " + pat)
    idx = at + int(off)
    if idx in color:
        ng.append("同じ文字を2回指定: " + pat)
    color[idx] = (cls, pat)

ai = [(i, flat[i]) for i in sorted(color) if color[i][0] == "mk-ai"]
shu = [(i, flat[i]) for i in sorted(color) if color[i][0] == "mk-shu"]
print("朱赤（矢印と同じ色）%2d字: %s" % (len(ai), "".join(c for _, c in ai)))
print("藍  （かく乱）      %2d字: %s" % (len(shu), "".join(c for _, c in shu)))

got = []
for pat, off, cls in marks:
    if pat in ANSWERS:
        got.append((ANSWERS.index(pat), flat[flat.find(pat) + int(off)], cls))
got.sort()
print("答えの3文字:", "".join(c for _, c, _ in got), "／ 色:", set(c for _, _, c in got))
if "".join(c for _, c, _ in got) != "こやお":
    ng.append("答えの3文字が こやお になっていない")
if any(c != "mk-ai" for _, _, c in got):
    ng.append("答えが矢印と同じ色になっていない")
print("\n問題:", ng if ng else "なし")
sys.exit(1 if ng else 0)
