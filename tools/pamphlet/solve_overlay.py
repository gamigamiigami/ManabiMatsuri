#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""パンフレット合わせの謎（重ね合わせ）の座標を計算・検証する。

    python3 tools/pamphlet/solve_overlay.py

出力された数値を js/letter-decor.js の puzzleLine プリセットと
tools/pamphlet/pamphlet.html の謎ブロックに書き写す。

────────────────────────────────────────────────────────────
仕組み
  ・スマホには「Xからの一通目の手紙」が出ている。手紙の中に
    魔法陣と鍵の透かしが2つ置いてある。
  ・パンフレットの切り取り線にも同じ2つの図形が、ちょうど半分だけ
    印刷されている。参加者は点線で切って紙を傾けて画面に置き、
    2つの図形がそれぞれ「1つの完全な図形」に見えるように合わせる。
    2点そろえば紙の位置・角度・拡大率が一意に決まる。
  ・その状態で矢印3本がさす文字を、切り取り線に沿って下から順に
    読むと「おやこ」になる。

座標系
  手紙の .letter-content の枠を基準にした正規化座標。
  u = x / 枠の幅、v = y / 枠の幅（縦も「幅」で割る＝等方）。
  枠は縦向きで常に 3:4 なので v は 0〜4/3 の範囲になる。

letter_chars.json
  手紙を実際に描画して測った全186文字の位置。画面幅 360/390/412/430px
  の平均で、端末間のズレは最大 0.0017（印刷して 0.1mm）しかない。
  ※ 手紙は「開いた状態」で測ること。封筒を閉じたままだと行間が
    違う値になり、0.015 ほどずれる。
────────────────────────────────────────────────────────────
"""

import json
import math
import os

HERE = os.path.dirname(os.path.abspath(__file__))
CHARS = json.load(open(os.path.join(HERE, "letter_chars.json"), encoding="utf-8"))
TEXT = "".join(c["ch"] for c in CHARS)

# 対象の3文字を、前後の文字列で一意に指定する
TARGET_KEYS = [("この学校", 0), ("でなやんで", 2), ("ずっとおもって", 3)]

# モチーフPNGの「実際にインクがある範囲」。画像は 2400x2400 だが絵が
# canvas いっぱいに描かれているとは限らない。ここを無視して canvas の
# 中心を線に合わせると図形が線からずれる（旧版で鍵だけ合わなかった原因）。
INK = {
    # 名前:         (中心x, 中心y, 幅, 高さ)  ※すべて canvas に対する比
    "magicCircle":  (0.4998, 0.4998, 0.9450, 0.9450),
    "keyWatermark": (0.5298, 0.5256, 0.6867, 0.4417),
}

PAPER_ASPECT = 0.75          # 手紙の 幅 / 高さ
PAGE_W_PX, PAGE_W_MM = 1920, 297.0
PX_PER_MM = PAGE_W_PX / PAGE_W_MM
PANEL_W_PX = 640             # 三つ折り1面の幅
PAGE_H_PX = 1357

# ── 設計パラメータ ────────────────────────────────────────
EDGE_OFFSET = 0.038   # 切り取り線を対象文字からどれだけ離すか（uv単位）
CIRCLE_INK = 0.27     # 魔法陣の「インクの直径」（手紙の幅に対する比）
KEY_INK_W = 0.32      # 鍵の「インクの幅」（同上）
T_CIRCLE = -0.19      # 線に沿った魔法陣の位置（1文字目を 0 とする）
T_KEY = 0.75          # 線に沿った鍵の位置
SPAN_MM = 62.0        # 印刷したとき、2つの図形の中心間を何mmにするか
CUT_INSET_PX = 42     # 紙の下辺から切り取り線までの距離（px）
ARROW_LEN_PX = 95     # 矢印の長さ
GLYPH_BOX = 0.80      # 当たり判定に使う文字の箱（字送り幅に対する比）


def find(sub, off):
    i = TEXT.index(sub)
    return CHARS[i + off]


def ray_hit(px, py, dx, dy, ch):
    """点(px,py)から向き(dx,dy)の半直線が文字の箱に入る距離。入らなければ None。"""
    hw, hh = ch["w"] * GLYPH_BOX / 2, ch["h"] * GLYPH_BOX / 2
    tmin, tmax = 0.0, float("inf")
    for p, d, lo, hi in ((px, dx, ch["u"] - hw, ch["u"] + hw),
                         (py, dy, ch["v"] - hh, ch["v"] + hh)):
        if abs(d) < 1e-12:
            if p < lo or p > hi:
                return None
            continue
        t1, t2 = (lo - p) / d, (hi - p) / d
        if t1 > t2:
            t1, t2 = t2, t1
        tmin, tmax = max(tmin, t1), min(tmax, t2)
        if tmin > tmax:
            return None
    return tmin


def main():
    tg = [find(*k) for k in TARGET_KEYS]
    print("対象の文字:", "".join(t["ch"] for t in tg))
    for t in tg:
        print("  「%s」 u=%.4f v=%.4f  大きさ %.4f x %.4f" % (t["ch"], t["u"], t["v"], t["w"], t["h"]))

    # ── 1. 切り取り線の向き ──────────────────────────────
    a, c = tg[0], tg[-1]
    dx, dy = c["u"] - a["u"], c["v"] - a["v"]
    ln = math.hypot(dx, dy)
    ux, uy = dx / ln, dy / ln              # 線に沿った単位ベクトル
    nx, ny = -uy, ux                        # 法線（画面に残る側 ＝ 左下向き）
    theta = math.atan2(dy, dx)
    print("\n切り取り線の角度: %.2f°" % math.degrees(theta))
    dev = (tg[1]["u"] - a["u"]) * nx + (tg[1]["v"] - a["v"]) * ny
    print("真ん中の文字の直線からのズレ: %.4f（文字の高さ %.4f）" % (dev, tg[1]["h"]))

    # ── 2. 線を文字の外側へ平行移動 ──────────────────────
    px, py = a["u"] - EDGE_OFFSET * nx, a["v"] - EDGE_OFFSET * ny
    along = lambda p: (p["u"] - px) * ux + (p["v"] - py) * uy
    perp = lambda p: (p["u"] - px) * nx + (p["v"] - py) * ny

    # ── 3. 矢印の向きを決める ────────────────────────────
    # 候補A: 切り取り線に垂直（＝紙の上では真下）
    # 候補B: 画面の真下（＝紙の上では切り取り線から 90°-角度 だけ傾く）
    # 文字は斜め45°の格子状に並んでいるので、向きによっては隣の文字に
    # 先に当たってしまう。全186文字と当たり判定して安全なほうを選ぶ。
    best = None
    for label, (dxx, dyy) in (("線に垂直", (nx, ny)), ("画面の真下", (0.0, 1.0))):
        rows, ok = [], True
        for t in tg:
            # 矢印の始点＝対象文字の中心から逆向きに戻って切り取り線と交わる点
            k = ((t["u"] - px) * nx + (t["v"] - py) * ny) / (dxx * nx + dyy * ny)
            tipx, tipy = t["u"] - k * dxx, t["v"] - k * dyy
            hits = sorted(
                ((d, ch) for ch in CHARS
                 for d in [ray_hit(tipx, tipy, dxx, dyy, ch)] if d is not None),
                key=lambda z: z[0])
            first = hits[0][1]["ch"] if hits else "－"
            second = ("%s(%.3f)" % (hits[1][1]["ch"], hits[1][0])) if len(hits) > 1 else "なし"
            good = bool(hits) and hits[0][1] is t
            ok &= good
            rows.append((t["ch"], tipx, tipy, k, first, hits[0][0] if hits else 0, second, good))
        print("\n矢印の向き【%s】 → %s" % (label, "OK" if ok else "NG"))
        for ch, tx, ty, k, first, d0, second, good in rows:
            print("   %s 先端(%.4f, %.4f) 長さ%.4f  最初にあたる「%s」%.4f %s ／次 %s"
                  % (ch, tx, ty, k, first, d0, "○" if good else "×", second))
        if ok and best is None:
            best = (label, (dxx, dyy), rows)
    if best is None:
        print("\n!! どの向きでも矢印が別の文字を指してしまう。EDGE_OFFSET か文面を調整すること。")
        return
    label, (adx, ady), rows = best
    print("\n採用する矢印の向き: %s" % label)

    # ── 4. 図形を線の上に置く ────────────────────────────
    at = lambda t: (px + t * ux, py + t * uy)
    c_circle, c_key = at(T_CIRCLE), at(T_KEY)
    r = CIRCLE_INK / 2
    key_h = KEY_INK_W * INK["keyWatermark"][3] / INK["keyWatermark"][2]
    key_half_line = (KEY_INK_W * abs(ux) + key_h * abs(uy)) / 2

    print("\n図形の中心（インクの中心）")
    print("  魔法陣 t=%+.2f (%.5f, %.5f) インク直径 %.3f" % (T_CIRCLE, *c_circle, CIRCLE_INK))
    print("  鍵     t=%+.2f (%.5f, %.5f) インク %.3f x %.3f" % (T_KEY, *c_key, KEY_INK_W, key_h))

    ok = True
    if not (r <= c_circle[0] <= 1 - r and r <= c_circle[1] <= 1 / PAPER_ASPECT - r):
        print("  !! 魔法陣が紙からはみ出す"); ok = False
    if not (KEY_INK_W / 2 <= c_key[0] <= 1 - KEY_INK_W / 2
            and key_h / 2 <= c_key[1] <= 1 / PAPER_ASPECT - key_h / 2):
        print("  !! 鍵が紙からはみ出す"); ok = False
    for t in tg:
        half = math.hypot(t["w"], t["h"]) / 2
        if math.hypot(t["u"] - c_circle[0], t["v"] - c_circle[1]) < r + half:
            print("  !! 魔法陣が「%s」に重なる" % t["ch"]); ok = False
        if abs(along(t) - T_KEY) < key_half_line + half and abs(perp(t)) < key_h / 2 + half:
            print("  !! 鍵が「%s」に重なる" % t["ch"]); ok = False
    print("  はみ出し・衝突チェック:", "OK" if ok else "NG")

    # ── 5. CSS の background-size / position に変換 ───────
    # background-position: p%  →  canvas の左端 = p * (枠 - canvas)
    #   インク中心 c = p*(1-s) + s*f   （f は canvas 内のインク中心比）
    #   ⇒ p = (c - s*f) / (1 - s)
    print("\n── js/letter-decor.js の puzzleLine に貼る ──")
    for name, centre, ink_w in (("magicCircle", c_circle, CIRCLE_INK),
                                ("keyWatermark", c_key, KEY_INK_W)):
        fx, fy, iw, _ = INK[name]
        s = ink_w / iw
        hcf = s * PAPER_ASPECT
        p_x = (centre[0] - s * fx) / (1 - s)
        p_y = (centre[1] * PAPER_ASPECT - hcf * fy) / (1 - hcf)
        print('    "%s|%.2f%% auto|%.3f%% %.3f%%",' % (name, s * 100, p_x * 100, p_y * 100))

    # ── 6. パンフレット側（px） ──────────────────────────
    span = T_KEY - T_CIRCLE
    w_mm = SPAN_MM / span                     # 手紙の幅を何mmとして刷るか
    uv_px = w_mm * PX_PER_MM                  # uv の 1.0 が何px か
    print("\n── tools/pamphlet/pamphlet.html に貼る ──")
    print("手紙の幅を %.2fmm として印刷（uv 1.0 = %.1fpx）" % (w_mm, uv_px))
    print("魔法陣のインク直径 %.1fmm ／ 鍵のインク %.1f x %.1fmm"
          % (CIRCLE_INK * w_mm, KEY_INK_W * w_mm, key_h * w_mm))

    left = (T_CIRCLE - r) * uv_px
    right = (T_KEY + key_half_line) * uv_px
    margin = (PANEL_W_PX - (right - left)) / 2
    if margin < 0:
        print("  !! 図形が1面(%dpx)に収まらない: %.1fpx 必要" % (PANEL_W_PX, right - left))
    x0 = margin - left                        # t=0 が来るパネル内 x 座標
    cut_y = PAGE_H_PX - CUT_INSET_PX
    print("全体の幅 %.1fpx (%.1fmm) ／ 左右の余白 %.1fmm"
          % (right - left, (right - left) / PX_PER_MM, margin / PX_PER_MM))
    print("切り取り線 y = %dpx（紙の下辺から %.1fmm 上）" % (cut_y, CUT_INSET_PX / PX_PER_MM))

    print("\n図形（div の left/top と表示サイズ）")
    for name, t, ink_w in (("magicCircle", T_CIRCLE, CIRCLE_INK),
                           ("keyWatermark", T_KEY, KEY_INK_W)):
        fx, fy, iw, _ = INK[name]
        canvas = ink_w / iw * uv_px
        cx = x0 + t * uv_px
        print("  %-13s left:%.1fpx top:%.1fpx size:%.1fpx"
              % (name, cx - canvas * fx, cut_y - canvas * fy, canvas))

    # 矢印：紙の上での向き（切り取り線を +x、画面に残る側を +y とするローカル系）
    la = math.atan2(adx * nx + ady * ny, adx * ux + ady * uy)   # +x からの角度
    print("\n矢印（先端が切り取り線上・紙の上では水平から %.2f° 下向き）"
          % math.degrees(la))
    for ch, tx, ty, k, _f, _d, _s, _g in rows:
        t_along = ((tx - px) * ux + (ty - py) * uy)
        ax = x0 + t_along * uv_px
        bx = ax - ARROW_LEN_PX * math.cos(la)
        by = cut_y - ARROW_LEN_PX * math.sin(la)
        print("  %s  x1=%.1f y1=%.1f → x2=%.1f y2=%d   （文字までの残り %.1fmm）"
              % (ch, bx, by, ax, cut_y, k * uv_px / PX_PER_MM))

    order = sorted(tg, key=lambda t: -along(t))
    print("\n読む順: 切り取り線に沿って下(右)から → %s" % "".join(t["ch"] for t in order))


if __name__ == "__main__":
    main()
