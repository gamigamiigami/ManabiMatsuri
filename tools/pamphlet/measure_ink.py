#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""重ね合わせ用モチーフPNGの「インクのある範囲」を測る。

    python3 tools/pamphlet/measure_ink.py magicCircle magicCircle2

出力をそのまま solve_overlay.py の INK / INK_PNG に貼る。

なぜ必要か
  PNG は 2400x2400 の正方形だが、絵が canvas いっぱいに描かれているとは
  限らない。canvas の中心を折り線に合わせると、絵の中心は線からずれる。
  重ね合わせの謎では、そのズレがそのまま「図形が半分でつながらない」に
  なるので、インクの範囲を実測して中心と大きさを出す。

  INK     … 手紙側（薄い線の PNG＝ CSS 背景に敷く SVG と同じ幾何）
  INK_PNG … パンフレット側（-bold PNG。線が太いぶんインクがわずかに広い）
"""

import sys
import os

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "../.."))


def ink_box(path):
    img = Image.open(path).convert("RGBA")
    W, H = img.size
    box = img.split()[-1].getbbox()          # 透明でない範囲
    if box is None:
        raise SystemExit("インクが無い: " + path)
    x0, y0, x1, y1 = box
    return ((x0 + x1) / 2 / W, (y0 + y1) / 2 / H, (x1 - x0) / W, (y1 - y0) / H)


def main(names):
    for label, suffix in (("INK", ""), ("INK_PNG", "-bold")):
        print(label + " = {")
        for n in names:
            p = os.path.join(ROOT, "images/motifs", n + suffix + ".png")
            cx, cy, w, h = ink_box(p)
            print('    "%s":%s (%.4f, %.4f, %.4f, %.4f),'
                  % (n, " " * max(0, 12 - len(n)), cx, cy, w, h))
        print("}")


if __name__ == "__main__":
    main(sys.argv[1:] or ["magicCircle", "magicCircle2"])
