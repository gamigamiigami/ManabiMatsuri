// ============================================================================
// debug.js — 調査用の小窓（?debug=1 のときだけ現れる）
// ============================================================================
//
// ■ なぜ要るか
//   第一回の当日、係の人から「この子の進捗はどうなつてゐるのか」
//   「なぜ次へ進めないのか」と聞かれても、その場で覗く手立てが無かつた。
//   端末を借りて開発者ツールを開く訳にもいかない。
//   だから今回は最初から、URL に ?debug=1 を足すだけで
//   状態の中身と、進行を進める／戻す道具が出るやうにしてある。
//
// ■ 安全のための二重の鍵
//   CONFIG.DEBUG_ENABLED が真 かつ URL に ?debug=1 がある、の両方が必要。
//   参加者が偶然辿り着く事はまづ無い。
//   万一の懸念があるなら、当日の朝に DEBUG_ENABLED を false にすれば全部消える。
//
// ■ ここは「表示と操作」だけ
//   点数の計算も判定も一切しない。全て rules.js の関数を呼ぶ。
//   debug から進めた進捗と、普通に遊んで進めた進捗が食ひ違はない事が大事。
// ============================================================================

import { CONFIG, team as teamDef } from './config.js';
import { PUZZLES, PUZZLE_ORDER } from './puzzles.js';
import { totalPoints, applySolve, canResolveAsOther } from './rules.js';
import { saveState, clearAll, pendingCount, isLocalMode, getPid } from './store.js';
import { params, go } from './nav.js';

const CSS = `
.oc2-dbg{position:fixed;left:0;right:0;bottom:0;z-index:9999;max-height:52vh;overflow:auto;
  background:#14100c;color:#d7c497;font:11px/1.6 ui-monospace,Menlo,Consolas,monospace;
  border-top:1px solid #7a6a4c;padding:8px 10px 12px}
.oc2-dbg h4{margin:0 0 6px;font:12px/1.4 inherit;letter-spacing:.1em;color:#e8d9b4}
.oc2-dbg pre{margin:6px 0;white-space:pre-wrap;word-break:break-all;color:#a89670}
.oc2-dbg button{font:11px/1.4 inherit;background:#2d2416;color:#e3d3a6;border:1px solid #7a6a4c;
  padding:4px 8px;margin:2px 3px 2px 0;cursor:pointer}
.oc2-dbg button:active{background:#3c3220}
.oc2-dbg .oc2-dbg-close{position:absolute;right:8px;top:6px}
.oc2-dbg .oc2-dbg-row{margin:4px 0}
`;

function h(tag, attrs, text) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (k === 'class') el.className = v; else el.setAttribute(k, v);
  }
  if (text != null) el.textContent = text;
  return el;
}

/**
 * 状態を受け取り、隅に小窓を出す。出す条件を満たさなければ何もしない。
 * 呼び側は各ページの末尾で mountDebug(state) を一度呼ぶだけでよい。
 */
export function mountDebug(state) {
  if (typeof document === 'undefined') return;
  if (!CONFIG.DEBUG_ENABLED) return;
  if (params().debug !== '1') return;
  if (document.querySelector('.oc2-dbg')) return;

  const style = h('style');
  style.textContent = CSS;
  document.head.appendChild(style);

  const box = h('div', { class: 'oc2-dbg' });
  const close = h('button', { class: 'oc2-dbg-close' }, '閉');
  close.onclick = () => box.remove();
  box.appendChild(close);

  const mode = isLocalMode() ? 'local (SUPABASE 未設定)' : 'server';
  const t = state && teamDef(state.team);
  box.appendChild(h('h4', {}, `debug — ${mode}`));
  box.appendChild(h('div', { class: 'oc2-dbg-row' },
    `pid=${(state && state.pid) || getPid() || '(無し)'}  team=${(state && state.team) || '(無し)'}` +
    `${t ? ' / ' + t.name : ''}  points=${state ? totalPoints(state) : 0}  pending=${pendingCount()}`));

  if (state) {
    box.appendChild(h('div', { class: 'oc2-dbg-row' },
      `seals: own=${state.seals?.own ? '有' : '無'} other=${state.seals?.other ? '有' : '無'}` +
      `  canResolveAsOther=${canResolveAsOther(state)}`));
    box.appendChild(h('div', { class: 'oc2-dbg-row' },
      `solved: ${Object.keys(state.solved || {}).join(' ') || '(無し)'}`));
    box.appendChild(h('div', { class: 'oc2-dbg-row' },
      `links: ${Object.entries(state.links || {})
        .map(([k, v]) => `${k}[${v.pool}/${v.questionId}/${v.role}${v.verifiedAt ? '/済' : ''}]`)
        .join(' ') || '(無し)'}`));
  }

  // --- 進行を進める道具 ---
  const row = h('div', { class: 'oc2-dbg-row' });
  if (state) {
    for (const id of PUZZLE_ORDER) {
      if (!PUZZLES[id]) continue;
      const b = h('button', {}, '解: ' + id);
      b.onclick = () => {
        saveState(applySolve(state, { puzzleId: id, via: 'debug' }));
        location.reload();
      };
      row.appendChild(b);
    }
    const bo = h('button', {}, '解: crossword(other)');
    bo.onclick = () => {
      saveState(applySolve(state, { puzzleId: 'crossword', asOther: true, via: 'debug' }));
      location.reload();
    };
    row.appendChild(bo);
  }
  box.appendChild(row);

  const row2 = h('div', { class: 'oc2-dbg-row' });
  const dump = h('button', {}, '状態を出す');
  const pre = h('pre', {}, '');
  dump.onclick = () => {
    pre.textContent = pre.textContent ? '' : JSON.stringify(state, null, 1);
  };
  const reset = h('button', {}, 'ぜんぶ消す');
  reset.onclick = () => {
    if (!confirm('この端末の記録を消して入口へ戻る。よいか。')) return;
    clearAll();
    go('index.html');
  };
  row2.appendChild(dump);
  row2.appendChild(reset);
  box.appendChild(row2);
  box.appendChild(pre);

  document.body.appendChild(box);
}
