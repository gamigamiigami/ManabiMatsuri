// ========================================
// チームデータの保存（localStorage）と GAS への送信
// ========================================

const Store = {
  KEY: "fuin_team_v1",

  // 保存データの形:
  // {
  //   teamId: "T…",
  //   teamName: "○○チーム",
  //   playerName: "あなたの名前（任意）",
  //   registeredAt: "ISO日時",
  //   points: {
  //     1: { firstViewedAt, solvedAt, wrong, hintClicked, hintAutoShown },
  //     ...
  //   }
  // }

  load() {
    try {
      return JSON.parse(localStorage.getItem(this.KEY)) || null;
    } catch (e) {
      return null;
    }
  },

  save(team) {
    localStorage.setItem(this.KEY, JSON.stringify(team));
  },

  register(teamName, playerName) {
    const team = {
      teamId:
        "T" +
        Date.now().toString(36) +
        Math.random().toString(36).slice(2, 6),
      teamName: teamName,
      playerName: playerName || "",
      registeredAt: new Date().toISOString(),
      points: {},
    };
    this.save(team);
    this.send(team, "register", null, { playerName: team.playerName });
    return team;
  },

  point(team, p) {
    if (!team.points[p]) {
      team.points[p] = {
        firstViewedAt: null,
        solvedAt: null,
        wrong: 0,
        hintClicked: false,
        hintAutoShown: false,
      };
    }
    return team.points[p];
  },

  solvedCount(team) {
    return POINT_ORDER.filter((p) => team.points[p] && team.points[p].solvedAt)
      .length;
  },

  stars(team) {
    return POINT_ORDER.map((p) =>
      team.points[p] && team.points[p].solvedAt ? "★" : "☆"
    ).join("");
  },

  send(team, type, point, detail) {
    if (!CONFIG.GAS_URL) return;
    const body = JSON.stringify({
      teamId: team.teamId,
      teamName: team.teamName,
      type: type,
      point: point,
      detail: detail || {},
      clientAt: new Date().toISOString(),
    });
    try {
      fetch(CONFIG.GAS_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: body,
        keepalive: true,
      }).catch(() => {});
    } catch (e) {
      /* オフライン等でも無視して続行 */
    }
  },
};
