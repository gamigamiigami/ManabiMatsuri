#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""パンフレット合わせの謎（重ね合わせ）の座標を計算・検証する。

    python3 tools/pamphlet/solve_overlay.py

出力された数値を js/letter-decor.js の puzzleLine プリセットと
tools/pamphlet/pamphlet.html の謎ブロックに書き写す。

────────────────────────────────────────────────────────────
仕組み
  ・スマホには「Xからの一通目の手紙」が出ている。手紙の中に
    2種類の魔法陣（六芒星の magicCircle と五芒星の magicCircle2）が
    透かしとして置いてある。
  ・パンフレットの折り線にも同じ2つの図形が、ちょうど半分だけ
    印刷されている。線より下は うしろに折りたたむので、
    折ったあとの紙のはしが、ちょうど図形を半分に切った線になる。
    （紙の下辺そのものを使うと、フチなし印刷できないプリンタで
    　図形の下半分が印刷されず重ねられない。切るのではなく折るのは、
    　裏面を切り落とさずに済ませるため）参加者は点線で下のはしをうしろに折り、紙を傾けて画面に置き、
    2つの図形がそれぞれ「1つの完全な図形」に見えるように合わせる。
    2点そろえば紙の位置・角度・拡大率が一意に決まる。
  ・その状態で矢印3本がさす文字を、折り線に沿って下から順に
    読むと「おやこ」になる。

座標系
  手紙の .letter-content の枠を基準にした正規化座標。
  u = x / 枠の幅、v = y / 枠の幅（縦も「幅」で割る＝等方）。
  枠は縦向きで常に 3:4 なので v は 0〜4/3 の範囲になる。

letter_chars.json
  手紙を実際に描画して測った全文字の位置。画面幅 360/390/412/430px
  の平均で、端末間のズレは最大 0.0024（印刷して 0.2mm）しかない。
  手紙の文面（js/puzzles.js の PROLOGUE）を変えたら
  measure_chars.mjs --write で取り直してから、このスクリプトを流すこと。
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
TARGET_CHARS = [("この学校", 0), ("でなやんで", 2), ("ずっとおもって", 3)]

# モチーフPNGの「実際にインクがある範囲」。画像は 2400x2400 だが絵が
# canvas いっぱいに描かれているとは限らない。ここを無視して canvas の
# 中心を線に合わせると図形が線からずれる（旧版で鍵だけ合わなかった原因）。
# 画面（手紙）側＝CSS背景に敷く細線SVGの実測値。
# 値は tools/pamphlet/measure_ink.py で測る（手で書かない）。
INK = {
    # 名前:         (中心x, 中心y, 幅, 高さ)  ※すべて canvas に対する比
    "magicCircle":  (0.5000, 0.5000, 0.9450, 0.9450),
    "magicCircle2": (0.5000, 0.5000, 0.9517, 0.9517),
}
# パンフレット側＝印刷用の -bold PNG の実測値。線を太くしてある分だけ
# インクの範囲がわずかに広い（中心は同じ）。PNG を焼き直したら
#   node tools/motifs/render_motif.mjs
#   python3 tools/pamphlet/measure_ink.py
# で測り直すこと。
INK_PNG = {
    "magicCircle":  (0.5000, 0.5000, 0.9450, 0.9450),
    "magicCircle2": (0.5000, 0.5000, 0.9583, 0.9583),
}

PAPER_ASPECT = 0.75          # 手紙の 幅 / 高さ
PAGE_W_PX, PAGE_W_MM = 1920, 297.0
PX_PER_MM = PAGE_W_PX / PAGE_W_MM
PANEL_W_PX = 640             # 三つ折り1面の幅
PAGE_H_PX = 1357

# ── 設計パラメータ ────────────────────────────────────────
# 折り線を対象文字からどれだけ離すか。文字の高さに対する比で持つ。
# 絶対値（旧: 0.038）で固定していると、手紙の文面を増減して文字が
# 小さくなったとたん矢印が長すぎて隣の文字を先に刺してしまう。
# 文字の大きさに追従させておけば、文面を書き換えても比率は保たれる。
EDGE_OFFSET_RATIO = 0.62   # 0.62 x 文字の高さ（旧 0.038 / 0.0614 と同じ比）
# 2つの魔法陣は同じ大きさにする。骨格（六芒星／五芒星）で区別できるので、
# 大きさまで変える必要はなく、そろっていたほうが刷ったときに自然。
CIRCLE_INK = 0.20     # 魔法陣の「インクの直径」（手紙の幅に対する比）
CIRCLE2_INK = 0.20    # 魔法陣その2の「インクの直径」（同上）
T_CIRCLE = -0.13      # 線に沿った魔法陣の位置（1文字目を 0 とする）
T_CIRCLE2 = 0.60      # 線に沿った魔法陣その2の位置
SPAN_MM = 62.0        # 印刷したとき、2つの図形の中心間を何mmにするか
ARROW_LEN_PX = 95     # 矢印の長さ
GLYPH_BOX = 0.80      # 当たり判定に使う文字の箱（字送り幅に対する比）

# 紙をどちら側に置くか。-1 は「紙が左下、文字が右上」。
# 三つ折りの折り目（A1面の右辺）を使うと、こちらのほうが紙の傾きが
# -45.7°（軽く左に傾けるだけ）で自然になる。+1 だと 134°＝ほぼ逆さま。
PAPER_SIDE = -1

# 折り目は A1面（運営からのメッセージ）の右辺＝三つ折りの折り目そのもの。
# 紙の中央なので、フチなし印刷でなくても確実に印刷できる。
EDGE_X_PX = 640       # A1面の右辺（面の幅と同じ＝折り目）
T0_Y_PX = 850         # 折り目上で t=0（1文字目の矢印）が来る y


def find(sub, off):
    i = TEXT.index(sub)
    return CHARS[i + off]


# 折り線の逃がし幅は、いま測った文字の大きさから決まる。
# verify_overlay.py も同じ値を使うので、モジュールの定数として持たせる。
EDGE_OFFSET = EDGE_OFFSET_RATIO * find(*TARGET_CHARS[0])["h"]


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
    tg = [find(*k) for k in TARGET_CHARS]
    print("対象の文字:", "".join(t["ch"] for t in tg))
    for t in tg:
        print("  「%s」 u=%.4f v=%.4f  大きさ %.4f x %.4f" % (t["ch"], t["u"], t["v"], t["w"], t["h"]))

    print("折り線の逃がし幅: %.4f（文字の高さ %.4f x %.2f）"
          % (EDGE_OFFSET, tg[0]["h"], EDGE_OFFSET_RATIO))

    # ── 1. 折り線の向き ──────────────────────────────
    a, c = tg[0], tg[-1]
    dx, dy = c["u"] - a["u"], c["v"] - a["v"]
    ln = math.hypot(dx, dy)
    ux, uy = dx / ln, dy / ln              # 線に沿った単位ベクトル
    nx, ny = PAPER_SIDE * -uy, PAPER_SIDE * ux   # 法線（文字が見える側を向く）
    theta = math.atan2(dy, dx)
    print("\n折り線の角度: %.2f°" % math.degrees(theta))
    dev = (tg[1]["u"] - a["u"]) * nx + (tg[1]["v"] - a["v"]) * ny
    print("真ん中の文字の直線からのズレ: %.4f（文字の高さ %.4f）" % (dev, tg[1]["h"]))

    # ── 2. 線を文字の外側へ平行移動 ──────────────────────
    px, py = a["u"] - EDGE_OFFSET * nx, a["v"] - EDGE_OFFSET * ny
    along = lambda p: (p["u"] - px) * ux + (p["v"] - py) * uy
    perp = lambda p: (p["u"] - px) * nx + (p["v"] - py) * ny

    # ── 3. 矢印の向きを決める ────────────────────────────
    # 候補A: 折り線に垂直（＝紙の上では真下）
    # 候補B: 画面の真下（＝紙の上では折り線から 90°-角度 だけ傾く）
    # 文字は斜め45°の格子状に並んでいるので、向きによっては隣の文字に
    # 先に当たってしまう。手紙の全文字と当たり判定して安全なほうを選ぶ。
    best = None
    for label, (dxx, dyy) in (("線に垂直", (nx, ny)), ("画面の真下", (0.0, 1.0))):
        rows, ok = [], True
        for t in tg:
            # 矢印の始点＝対象文字の中心から逆向きに戻って折り線と交わる点
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
    SHAPES = (("魔法陣",    "magicCircle",  T_CIRCLE,  CIRCLE_INK),
              ("魔法陣その2", "magicCircle2", T_CIRCLE2, CIRCLE2_INK))

    print("\n図形の中心（インクの中心）")
    for label, _n, t0, ink in SHAPES:
        c = at(t0)
        print("  %-7s t=%+.2f (%.5f, %.5f) インク直径 %.3f" % (label, t0, *c, ink))

    # どちらも円なので、はみ出しも文字との衝突も「中心からの距離」だけで見る。
    ok = True
    for label, _n, t0, ink in SHAPES:
        c, r = at(t0), ink / 2
        if not (r <= c[0] <= 1 - r and r <= c[1] <= 1 / PAPER_ASPECT - r):
            print("  !! %sが紙からはみ出す" % label); ok = False
        for t in tg:
            half = math.hypot(t["w"], t["h"]) / 2
            if math.hypot(t["u"] - c[0], t["v"] - c[1]) < r + half:
                print("  !! %sが「%s」に重なる" % (label, t["ch"])); ok = False
    # 2つの陣どうしが重なっていないか（線の上に並ぶので中心間距離で足りる）
    if abs(T_CIRCLE2 - T_CIRCLE) < (CIRCLE_INK + CIRCLE2_INK) / 2:
        print("  !! 2つの魔法陣が重なる"); ok = False
    print("  はみ出し・衝突チェック:", "OK" if ok else "NG")

    # ── 5. CSS の background-size / position に変換 ───────
    # background-position: p%  →  canvas の左端 = p * (枠 - canvas)
    #   インク中心 c = p*(1-s) + s*f   （f は canvas 内のインク中心比）
    #   ⇒ p = (c - s*f) / (1 - s)
    print("\n── js/letter-decor.js の puzzleLine に貼る ──")
    for _label, name, t0, ink_w in SHAPES:
        centre = at(t0)
        fx, fy, iw, _ = INK[name]
        s = ink_w / iw
        hcf = s * PAPER_ASPECT
        p_x = (centre[0] - s * fx) / (1 - s)
        p_y = (centre[1] * PAPER_ASPECT - hcf * fy) / (1 - hcf)
        print('    "%s|%.2f%% auto|%.3f%% %.3f%%",' % (name, s * 100, p_x * 100, p_y * 100))

    # ── 6. パンフレット側（px） ──────────────────────────
    # 折り目は A1面の右辺（縦線）。面は overflow:hidden なので、
    # 図形は折り目でちょうど半分に切り取られて印刷される。
    # 参加者は A2・A3 をうしろに折り返し、A1面を表にして画面に置く。
    span = T_CIRCLE2 - T_CIRCLE
    w_mm = SPAN_MM / span                     # 手紙の幅を何mmとして刷るか
    uv_px = w_mm * PX_PER_MM                  # uv の 1.0 が何px か
    print("\n── tools/pamphlet/pamphlet.html に貼る ──")
    print("手紙の幅を %.2fmm として印刷（uv 1.0 = %.1fpx）" % (w_mm, uv_px))
    print("魔法陣のインク直径 %.1fmm ／ 魔法陣その2 %.1fmm"
          % (CIRCLE_INK * w_mm, CIRCLE2_INK * w_mm))
    print("折り目 x = %dpx（A1面の右辺＝三つ折りの折り目）" % EDGE_X_PX)

    # 紙をどれだけ回して置くか。紙のローカル系で「文字が見える側」は +x。
    # それが手紙側の法線 (nx, ny) に一致するように回す。
    phi = math.atan2(ny, nx)
    print("紙の傾き %.2f°（図形にはこの逆 rotate(%.2fdeg) をかける）"
          % (math.degrees(phi), -math.degrees(phi)))
    # 紙のローカル +y が手紙の u 方向に対応するか検算
    chk = (-math.sin(phi) * ux + math.cos(phi) * uy)
    if chk < 0:
        print("  !! 向きが反転している。along の符号を見直すこと")

    # 折り目に沿った位置（t が大きいほど紙の下）
    def edge_y(t):
        return T0_Y_PX + t * uv_px

    # 円は回しても大きさが変わらないので、半径をそのまま足せばよい
    lo = edge_y(T_CIRCLE) - CIRCLE_INK * uv_px / 2
    hi = edge_y(T_CIRCLE2) + CIRCLE2_INK * uv_px / 2
    print("図形の占める範囲 y %.1f〜%.1f（%.1fmm）" % (lo, hi, (hi - lo) / PX_PER_MM))
    if lo < 0 or hi > PAGE_H_PX:
        print("  !! 面(高さ%dpx)からはみ出す" % PAGE_H_PX)

    print("\n図形（div の left/top・表示サイズ・回転）")
    print("  transform: rotate(%.2fdeg) を必ずかけること" % -math.degrees(phi))
    for _label, name, t, ink_w in SHAPES:
        # ここはパンフレットに刷る PNG の話なので、太線版の実測値を使う
        fx, fy, iw, ih = INK_PNG[name]
        canvas = ink_w / iw * uv_px
        cy = edge_y(t)
        print("  %-13s left:%.1fpx top:%.1fpx size:%.1fpx  transform-origin:%.2f%% %.2f%%"
              % (name, EDGE_X_PX - canvas * fx, cy - canvas * fy, canvas, fx * 100, fy * 100))
        w, h = ink_w * uv_px, ink_w * ih / iw * uv_px
        ca, sa = abs(math.cos(phi)), abs(math.sin(phi))
        bw2, bh2 = (w * ca + h * sa) / 2, (w * sa + h * ca) / 2
        print("     回転後 x %.1f〜%.1f ／ y %.1f〜%.1f（折り目から左へ %.1fmm）"
              % (EDGE_X_PX - bw2, EDGE_X_PX + bw2, cy - bh2, cy + bh2, bw2 / PX_PER_MM))
        if EDGE_X_PX - bw2 < 0:
            print("     !! 面の左端をはみ出す")

    print("\n矢印（折り目に垂直＝紙の上では右向き、先端が折り目上）")
    for ch, tx, ty, k, _f, _d, _s, _g in rows:
        t_along = ((tx - px) * ux + (ty - py) * uy)
        ay = edge_y(t_along)
        print("  %s  x1=%.1f y1=%.1f → x2=%d y2=%.1f   （文字までの残り %.1fmm）"
              % (ch, EDGE_X_PX - ARROW_LEN_PX, ay, EDGE_X_PX, ay, k * uv_px / PX_PER_MM))

    order = sorted(tg, key=lambda t: -along(t))
    print("\n読む順: 折り目に沿って下(右)から → %s" % "".join(t["ch"] for t in order))


if __name__ == "__main__":
    main()
