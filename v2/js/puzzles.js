// ============================================================================
// puzzles.js — 謎文と答へ（全て仮。文言は後日そのまま差し替へる）
// ============================================================================
//
// ■ ここに置く物／置かぬ物
//   置く: 謎の見出し・畳面（スマホ画面）に出す案内・答へ・方眼の形・符牒の半分。
//   置かぬ: 組の名（config.js の TEAMS から引く）、点数（config.js の POINTS）、
//           正誤の判定方法（rules.js）。答へ合はせの規則をここに書いてはならない。
//
// ■ 答へを平文で持つことについて
//   第一回と同じ判断。ソースを覗けば答へは見える。
//   だが会場は「紙の謎をその場で解く」催しであり、
//   端末側で厳密に隠す実利より、通信が切れても判定が止まらぬ事の方が重い。
//   （サーバは記録と重複防止のみを担ふ。rules.js が唯一の判定処である。）
//
// ============================================================================
// ■■ 文言を入れる人へ — 何をどこに書けばよいか ■■
// ============================================================================
//
// 【1】PUZZLES … 単独フェーズの謎。key が内部 id で、参加者には決して見せない。
//      掲示 QR は sheet.html?q=<この key>&room=<室 key>、
//      カメラが使へぬ人向けの三桁番号は config.js の MANUAL_CODES が対応表。
//
//      {
//        id:        key と同じ文字列（照合用。必ず一致させる）
//        kind:      'sheet'（紙の謎の案内）| 'grid'（方眼つき）
//        title:     畳面の見出し。例 '資料 一の三の答'
//        subtitle:  紙側の呼び名。例 '一の三'（無くてよい）
//        room:      既定の設置室 key（?room が無いときの表示ヒント。推測に使はぬ）
//        guidance:  一行〜二行の案内。「答は紙にある」事を必ず匂はせる
//        length:    答への文字数（かな枠の数。今回は全て 4）
//        answers:   { team1:'よにひ', team2:'…' } … 組ごとに違ふ答へ
//                   もしくは 'よにひ' … 両組で同じ答へ
//                   ※ 必ず「ひらがな」で書く。判定は rules.normalizeWord が
//                     片仮名・全角空白・中黒などを吸収するので、
//                     ここは素直に平かなだけを並べればよい。
//        grantsSeal:      'own' | 'other' | null … 正解でどの證を出すか
//        reSolveGrantsSeal: 解き直し（as=other）で出す證。crossword だけが持つ
//        points:    通常は CONFIG.POINTS.solo。ここでは触らない
//      }
//
//      必須の三つ:
//        warmup    … 最初の一問。正解で「自分の組の證」が出る（grantsSeal:'own'）
//        crossword … 方眼の謎。一度目は證を出さない（grantsSeal:null）。
//                    folio の目立たぬリンクから解き直すと
//                    「相手の組の證」が出る（reSolveGrantsSeal:'other'）。
//        solo1..3  … 各室に散らす普通の一問。MANUAL_CODES と対応させる
//
// 【2】CROSSWORD … 方眼の見た目。crossword.html が描く「参考 UI」であり、
//      解くのは紙の側。行列は 0 始まり。'r,c' の文字列を鍵にする。
//        cols/rows    … 5×5
//        blocks       … 黒マス [[r,c], ...]
//        prefilled    … 既に刷られてゐる字 { '0,0':'ほ', ... }
//        answerCells  … 浮かび上がる四字の位置（左上から読む順に並べる）
//        clue         … 一行の手掛かり
//        answerLength … 4（PUZZLES.crossword.length と揃へる）
//      組ごとに別の盤面を置く（team1 / team2）。
//
// 【3】TOGETHER … 協力フェーズの符牒。
//      same  … 同じ組どうしで組んだとき引く札。ちょうど 5 枚。
//      cross … 異なる組どうしで組んだとき引く札。ちょうど 10 枚。
//      一枚は { id, halves:{ A:'…', B:'…' }, answer:'…' }。
//      A と B は「それぞれの端末に別々に出る半分」。
//      二人が声に出して読み合はせ、**両方が同じ answer を打ち込む**。
//      すなはち answer は「A と B を合はせて初めて出る一つの答へ」であり、
//      A 側の答へ・B 側の答へ、といふ区別は無い。
//      id は保存済みの状態文書に載るので、当日以降は変へないこと
//      （枚数と id を保つ限り、halves と answer は自由に差し替へてよい）。
//
//      ※ どの札が出るかはサーバに聞かずに決まる。
//        並べ替へた二つの ID から作る鍵の ハッシュ % 枚数（rules.pickTogether）。
//        だから **枚数を変へると、その場に居る二人の出題がずれる**。
//        当日の運用中に same/cross の要素数を増減させてはならない。
// ============================================================================

import { CONFIG } from './config.js';

export const PUZZLES = {
  warmup: {
    id: 'warmup',
    kind: 'sheet',
    title: '最初の一枚',
    subtitle: '一の一',
    room: 'team1room',
    guidance: '配られた紙の隅に、薄く番號が振つてある。順に讀めば四文字。',
    length: 4,
    answers: { team1: 'ひらきど', team2: 'ひらきど' },
    grantsSeal: 'own',
    points: CONFIG.POINTS.solo,
  },

  solo1: {
    id: 'solo1',
    kind: 'sheet',
    title: '書架の隙',
    subtitle: '一の二',
    room: 'library',
    guidance: '背表紙の一字づつが、貸出票の數字の順に並ぶ。',
    length: 4,
    answers: { team1: 'あかつき', team2: 'ゆふぐれ' },
    grantsSeal: null,
    points: CONFIG.POINTS.solo,
  },

  solo2: {
    id: 'solo2',
    kind: 'sheet',
    title: '標本の札',
    subtitle: '一の三',
    room: 'specimen',
    guidance: '硝子瓶の札は、學名の頭字だけが墨で濃い。',
    length: 4,
    answers: { team1: 'とりのは', team2: 'とりのは' },
    grantsSeal: null,
    points: CONFIG.POINTS.solo,
  },

  solo3: {
    id: 'solo3',
    kind: 'sheet',
    title: '廊下の掲示',
    subtitle: '一の四',
    room: 'specimen',
    guidance: '古い時間割の、消し忘れた欄をつなぐ。',
    length: 4,
    answers: { team1: 'みなもと', team2: 'みなもと' },
    grantsSeal: null,
    points: CONFIG.POINTS.solo,
  },

  crossword: {
    id: 'crossword',
    kind: 'grid',
    title: '方眼の書き寫し',
    subtitle: '二の一',
    room: 'library',
    guidance: '盤面に書き寫し、色の付いた四つの枡を上から讀む。',
    length: 4,
    answers: { team1: 'ひかりの', team2: 'かげろふ' },
    // 一度目は證を出さない。folio の目立たぬリンクから解き直したときだけ
    // 「相手の組の證」が出る。この二段構へが第三フェーズへの入口になる。
    grantsSeal: null,
    reSolveGrantsSeal: 'other',
    points: CONFIG.POINTS.solo,
  },
};

// 単独フェーズの並び（folio や debug の表示順）。
export const PUZZLE_ORDER = ['warmup', 'solo1', 'solo2', 'solo3', 'crossword'];

// ---------------------------------------------------------------------------
// 方眼（仮の盤面。文字の整合は取れてゐない — 形と雰囲気だけの見本）
// ---------------------------------------------------------------------------
export const CROSSWORD = {
  team1: {
    cols: 5,
    rows: 5,
    blocks: [[0, 4], [1, 1], [2, 3], [3, 0], [4, 2]],
    prefilled: { '0,0': 'ほ', '1,3': 'く', '2,1': 'ら', '3,2': 'の', '4,4': 'み' },
    answerCells: ['0,2', '1,4', '3,3', '4,1'],
    clue: '校舎で最も古い木の下に、印がある。',
    answerLength: 4,
  },
  team2: {
    cols: 5,
    rows: 5,
    blocks: [[0, 1], [1, 4], [2, 2], [3, 0], [4, 3]],
    prefilled: { '0,3': 'た', '1,0': 'み', '2,4': 'ら', '3,1': 'く', '4,2': 'ほ' },
    answerCells: ['0,0', '2,1', '3,4', '4,0'],
    clue: '水を汲む場所の、二つ目の柱を見よ。',
    answerLength: 4,
  },
};

// ---------------------------------------------------------------------------
// 協力フェーズの符牒
//   same  … 5 枚（増減厳禁）
//   cross … 10 枚（増減厳禁）
// ---------------------------------------------------------------------------
export const TOGETHER = {
  // 符牒の答へも四文字で揃へてある（かな枠の数がぶれると入力欄が作り直しになるため）。
  answerLength: 4,

  same: [
    { id: 's1', halves: { A: '三　七　？', B: '？　は　五の倍' }, answer: 'じゆうご' },
    { id: 's2', halves: { A: '北の窓　二つ目', B: '硝子に映る字を逆に' }, answer: 'かがみど' },
    { id: 's3', halves: { A: '鐘は三度鳴る', B: '三度目の後の一字' }, answer: 'ゆふぐれ' },
    { id: 's4', halves: { A: '階を上る數だけ', B: '書架の段を下る' }, answer: 'つりあひ' },
    { id: 's5', halves: { A: '雨の日は閉づ', B: '晴れの日は開く扉' }, answer: 'あまどい' },
  ],
  cross: [
    { id: 'c01', halves: { A: '朔の夜に一つ', B: '望の夜に十五' }, answer: 'つきよみ' },
    { id: 'c02', halves: { A: '左の柱の彫り', B: '右の柱の缺け' }, answer: 'ついたち' },
    { id: 'c03', halves: { A: '古井戸の底に', B: '空を映す圓' }, answer: 'みなわそ' },
    { id: 'c04', halves: { A: '第一の扉は西', B: '第二の扉は東' }, answer: 'ひがしに' },
    { id: 'c05', halves: { A: '筆は硯に伏せ', B: '紙は風に伏す' }, answer: 'すずりば' },
    { id: 'c06', halves: { A: '數へ歌の三', B: '數へ歌の八' }, answer: 'とをあま' },
    { id: 'c07', halves: { A: '燈は北に置け', B: '影は南に伸ぶ' }, answer: 'ほくしん' },
    { id: 'c08', halves: { A: '標本の第七', B: '書庫の第七' }, answer: 'ななふし' },
    { id: 'c09', halves: { A: '春の字を一つ', B: '秋の字を一つ' }, answer: 'はるあき' },
    { id: 'c10', halves: { A: '鍵は二本ある', B: '錠は一つしかない' }, answer: 'あはせか' },
  ],
};
