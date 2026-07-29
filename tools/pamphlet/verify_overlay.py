#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""重ね合わせを実際の描画で検証する。

    node tools/pamphlet/shoot_overlay.mjs <dir>
    python3 tools/pamphlet/verify_overlay.py <dir>

手紙の便箋とパンフレットA1面のスクリーンショットを、solve_overlay.py が
出した角度・倍率どおりに重ねた合成画像 overlay.png を作る。
図形が1つにつながって見えれば成功。数字が合っていても、モチーフPNGの
インク範囲を測り間違えていると必ずここでズレて見える。
"""

import math
import os
import sys

from PIL import Image

import solve_overlay as S

HERE = os.path.dirname(os.path.abspath(__file__))


def main(d):
    letter = Image.open(os.path.join(d, "letter.png")).convert("RGBA")
    panel = Image.open(os.path.join(d, "panel.png")).convert("RGBA")

    # ── solve_overlay.py と同じ計算で、線の向きと基準点を出す ──
    tg = [S.find(*k) for k in S.TARGET_CHARS]
    a, c = tg[0], tg[-1]
    dx, dy = c["u"] - a["u"], c["v"] - a["v"]
    ln = math.hypot(dx, dy)
    ux, uy = dx / ln, dy / ln
    nx, ny = S.PAPER_SIDE * -uy, S.PAPER_SIDE * ux
    px = a["u"] - S.EDGE_OFFSET * nx
    py = a["v"] - S.EDGE_OFFSET * ny
    phi = math.atan2(ny, nx)

    W = letter.width                      # uv 1.0 にあたる画素数（手紙側）
    uv_px = (S.SPAN_MM / (S.T_BOOK - S.T_CIRCLE)) * S.PX_PER_MM   # パンフレット側
    s = W / uv_px                         # パンフレット1px → 手紙の何px

    # パンフレットの (X, Y) → 手紙の (x, y)
    #   紙のローカル +x は法線 (nx, ny)、+y は線に沿う (ux, uy) に対応する
    def to_letter(X, Y):
        ex, ey = X - S.EDGE_X_PX, Y - S.T0_Y_PX
        return (px * W + s * (ex * nx + ey * ux),
                py * W + s * (ex * ny + ey * uy))

    # PIL の affine は「出力→入力」の逆写像を渡す
    m00, m10 = s * nx, s * ny
    m01, m11 = s * ux, s * uy
    tx = px * W - m00 * S.EDGE_X_PX - m01 * S.T0_Y_PX
    ty = py * W - m10 * S.EDGE_X_PX - m11 * S.T0_Y_PX
    det = m00 * m11 - m01 * m10
    i00, i01 = m11 / det, -m01 / det
    i10, i11 = -m10 / det, m00 / det
    itx = -(i00 * tx + i01 * ty)
    ity = -(i10 * tx + i11 * ty)

    warped = panel.transform(letter.size, Image.AFFINE,
                             (i00, i01, itx, i10, i11, ity),
                             resample=Image.BICUBIC)
    out = Image.alpha_composite(letter, warped)
    out.save(os.path.join(d, "overlay.png"))

    print("手紙 %dx%d ／ パンフレット1px = 手紙 %.3fpx ／ 紙の傾き %.2f°"
          % (letter.width, letter.height, s, math.degrees(phi)))
    for name, X, Y in (("魔法陣", S.EDGE_X_PX, S.T0_Y_PX + S.T_CIRCLE * uv_px),
                       ("本",     S.EDGE_X_PX, S.T0_Y_PX + S.T_BOOK * uv_px)):
        x, y = to_letter(X, Y)
        print("  %s の中心 → 手紙上 (%.1f, %.1f) px = uv (%.4f, %.4f)"
              % (name, x, y, x / W, y / W))
    print("合成:", os.path.join(d, "overlay.png"))


if __name__ == "__main__":
    main(sys.argv[1])
