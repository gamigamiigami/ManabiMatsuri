// ============================================================================
// supabase.js — サーバとの唯一の窓口
// ============================================================================
//
// ■ 三つの決め事
//   1. **決して throw しない。** 全ての呼び出しは {ok, data, error} を返す。
//      会場の Wi-Fi は落ちる前提。例外で画面が白くなる事だけは避ける。
//   2. **CDN に実行時依存しない。** クライアントは js/vendor/supabase.js（UMD）を
//      同梱してある。第一回で「当日 CDN が詰まって全滅」を恐れた結論のまま。
//   3. **設定が空ならローカルモード。** CONFIG.SUPABASE.url が空文字なら
//      isConfigured() が false になり、api.* は即座に {ok:false, error:'local-mode'}。
//      呼び側（store.js）は失敗を普通の事として扱ふので、それだけで全部動く。
//
// ■ 表には直接触らせない
//   全テーブルは RLS 有効・ポリシー無しで、anon からは読めも書けもしない。
//   出入口は supabase/schema.sql の security definer な RPC だけ。
//   だから anon key が漏れても、他人の記録を書き換へる事はできない。
// ============================================================================

import { CONFIG } from './config.js';

let _client = null;
let _warned = false;

/** サーバ設定が入つてゐるか。false ならローカルモード。 */
export function isConfigured() {
  const s = CONFIG.SUPABASE || {};
  return Boolean(s.url && s.anonKey);
}

/**
 * クライアントは遅延生成する。
 * 読み込み直後に作らないのは、ローカルモードでは vendor の UMD が
 * 一度も要らないから（＝script タグを置き忘れても画面が死なない）。
 */
function client() {
  if (_client) return _client;
  if (!isConfigured()) return null;
  const lib = (typeof window !== 'undefined') ? window.supabase : null;
  if (!lib || typeof lib.createClient !== 'function') {
    if (!_warned) {
      _warned = true;
      console.warn('[supabase] vendor/supabase.js が読み込まれてゐない。ローカルモードで続行する。');
    }
    return null;
  }
  _client = lib.createClient(CONFIG.SUPABASE.url, CONFIG.SUPABASE.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _client;
}

/** 指定ミリ秒で諦める約束。中断できない fetch は放置するが、待たない。 */
function withTimeout(promise, ms) {
  return new Promise((resolve) => {
    let done = false;
    const t = setTimeout(() => {
      if (done) return;
      done = true;
      resolve({ ok: false, data: null, error: 'timeout' });
    }, ms);
    promise.then(
      (v) => { if (!done) { done = true; clearTimeout(t); resolve(v); } },
      (e) => { if (!done) { done = true; clearTimeout(t); resolve({ ok: false, data: null, error: String((e && e.message) || e) }); } }
    );
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * RPC を一回呼ぶ。決して throw しない。
 *   timeoutMs   … 4 秒。これ以上待つと参加者は「固まった」と感じて再読込する
 *   retries     … 1 回だけ。会場の無線は「一瞬切れて戻る」事が多いため
 *   retryDelayMs… 0.9 秒。連打で詰まらせない程度の間
 * 返り値: { ok:boolean, data:any, error:string|null }
 */
export async function rpc(name, args, opts = {}) {
  const { timeoutMs = 4000, retries = 1, retryDelayMs = 900 } = opts;
  if (!isConfigured()) return { ok: false, data: null, error: 'local-mode' };

  for (let attempt = 0; attempt <= retries; attempt++) {
    const c = client();
    if (!c) return { ok: false, data: null, error: 'no-client' };

    const once = (async () => {
      try {
        const { data, error } = await c.rpc(name, args || {});
        if (error) return { ok: false, data: null, error: error.message || String(error) };
        return { ok: true, data, error: null };
      } catch (e) {
        return { ok: false, data: null, error: String((e && e.message) || e) };
      }
    })();

    const res = await withTimeout(once, timeoutMs);
    if (res.ok) return res;
    // 最後の試行ならそのまま返す
    if (attempt === retries) return res;
    await sleep(retryDelayMs);
  }
  return { ok: false, data: null, error: 'unreachable' };
}

/**
 * 画面から直に呼ぶのはこの api だけ。
 * 引数名は schema.sql の関数定義（p_ 接頭辞）と一字一句合はせる事。
 * Supabase の RPC は名前付き引数なので、綴りが違ふと関数未検出で落ちる。
 */
export const api = {
  /** 状態文書を読む → {ok, data:{state, version, team}|null} */
  getState(pid) {
    return rpc('get_state', { p_pid: pid });
  },

  /** 状態文書を書く（upsert、version+1） */
  saveState(pid, state) {
    return rpc('save_state', { p_pid: pid, p_state: state });
  },

  /** 一回の解答を記録する。成否に関係なく残す（後で難易度を見直すため） */
  logAttempt({ pid, puzzleId, asTeam, answer, correct, via, clientAt }) {
    return rpc('log_attempt', {
      p_pid: pid,
      p_puzzle_id: puzzleId,
      p_as_team: asTeam || null,
      p_answer: answer == null ? null : String(answer),
      p_correct: Boolean(correct),
      p_via: via || null,
      p_client_at: clientAt || new Date().toISOString(),
    });
  },

  /**
   * 二人組を登録する。既にあれば existing:true で同じ行を返す
   * （＝どちらの端末から先に呼んでも同じ出題・同じ状態になる）。
   */
  linkPair({ pid, partnerPid, pool, questionId }) {
    return rpc('link_pair', {
      p_pid: pid,
      p_partner: partnerPid,
      p_pool: pool || null,
      p_question_id: questionId || null,
    });
  },

  /** 答へ合はせの成立を記録する → {verified_by:[…], already:boolean} */
  verifyPair({ pid, partnerPid }) {
    return rpc('verify_pair', { p_pid: pid, p_partner: partnerPid });
  },
};
