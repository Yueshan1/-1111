// mockApi is the local-only Demo data layer.
// It is intentionally populated with fake users, questions, answers, follows,
// reports and exports for UI migration and local testing.
// Do not treat this file as production data or a real multi-user backend.
const now = Date.now();

const db = {
  currentUserId: "u_vv",
  users: [
    { id: "u_vv", nickname: "VV", email: "vv@example.com", createdAt: now - 86400000 * 30 },
    { id: "u_bob", nickname: "Bob", email: "bob@example.com", createdAt: now - 86400000 * 22 },
    { id: "u_alice", nickname: "Alice", email: "alice@example.com", createdAt: now - 86400000 * 20 },
    { id: "u_herry", nickname: "herry", email: "herry@example.com", createdAt: now - 86400000 * 16 },
    { id: "u_mina", nickname: "Mina", email: "mina@example.com", createdAt: now - 86400000 * 14 },
    { id: "u_chen", nickname: "陈一", email: "chen@example.com", createdAt: now - 86400000 * 13 },
    { id: "u_sam", nickname: "Sam", email: "sam@example.com", createdAt: now - 86400000 * 12 },
    { id: "u_nora", nickname: "Nora", email: "nora@example.com", createdAt: now - 86400000 * 11 },
    { id: "u_lin", nickname: "林夏", email: "lin@example.com", createdAt: now - 86400000 * 10 },
    { id: "u_zoe", nickname: "Zoe", email: "zoe@example.com", createdAt: now - 86400000 * 9 },
    { id: "u_kai", nickname: "Kai", email: "kai@example.com", createdAt: now - 86400000 * 8 },
    { id: "u_yuki", nickname: "Yuki", email: "yuki@example.com", createdAt: now - 86400000 * 7 },
    { id: "u_moon", nickname: "月白", email: "moon@example.com", createdAt: now - 86400000 * 6 }
  ],
  follows: [
    { followerId: "u_vv", followeeId: "u_bob", remarkName: "", createdAt: now - 7200000, interactions: 18 },
    { followerId: "u_vv", followeeId: "u_alice", remarkName: "Alice", createdAt: now - 6700000, interactions: 12 },
    { followerId: "u_vv", followeeId: "u_herry", remarkName: "某人", createdAt: now - 6200000, interactions: 33 },
    { followerId: "u_vv", followeeId: "u_mina", remarkName: "", createdAt: now - 5900000, interactions: 9 },
    { followerId: "u_vv", followeeId: "u_chen", remarkName: "", createdAt: now - 5600000, interactions: 8 },
    { followerId: "u_vv", followeeId: "u_sam", remarkName: "", createdAt: now - 5300000, interactions: 7 },
    { followerId: "u_vv", followeeId: "u_nora", remarkName: "", createdAt: now - 5000000, interactions: 6 },
    { followerId: "u_vv", followeeId: "u_lin", remarkName: "", createdAt: now - 4700000, interactions: 5 },
    { followerId: "u_vv", followeeId: "u_zoe", remarkName: "", createdAt: now - 4400000, interactions: 4 },
    { followerId: "u_vv", followeeId: "u_kai", remarkName: "", createdAt: now - 4100000, interactions: 3 },
    { followerId: "u_vv", followeeId: "u_yuki", remarkName: "", createdAt: now - 3800000, interactions: 2 },
    { followerId: "u_vv", followeeId: "u_moon", remarkName: "", createdAt: now - 3500000, interactions: 1 }
  ],
  threads: [
    {
      id: "t_1",
      traceCode: "QB-20260615-0001",
      questionText: "局限性，多好的一个词啊。\n这回彻底远离了，这个世界一点也不好玩儿，\n地球online要下线了",
      questionerId: "u_bob",
      targetUserIds: ["u_vv"],
      visibility: "public",
      createdAt: now - 7200000,
      updatedAt: now - 6800000,
      answer: { id: "a_1", threadId: "t_1", ownerId: "u_vv", text: "没那么悲观\n要下早就下了", version: 1, createdAt: now - 6900000, updatedAt: now - 6800000 },
      replies: [
        { id: "r_1", threadId: "t_1", ownerId: "u_herry", text: "美美苟了一个赛季", createdAt: now - 6500000 },
        { id: "r_2", threadId: "t_1", ownerId: "u_alice", text: "看见极品单字 id 就抢了", createdAt: now - 6400000 }
      ],
      reports: []
    },
    {
      id: "t_2",
      traceCode: "QB-20260615-0002",
      questionText: "如果只能问一个匿名问题，你会问什么？",
      questionerId: "u_alice",
      targetUserIds: ["u_vv"],
      visibility: "public",
      createdAt: now - 3600000,
      updatedAt: now - 3600000,
      answer: null,
      replies: [],
      reports: []
    },
    {
      id: "t_3",
      traceCode: "QB-20260615-0003",
      questionText: "放假干什么",
      questionerId: "u_vv",
      targetUserIds: ["u_bob", "u_alice"],
      visibility: "public",
      createdAt: now - 5400000,
      updatedAt: now - 5100000,
      answer: { id: "a_3", threadId: "t_3", ownerId: "u_bob", text: "睡觉，然后出门玩。", version: 1, createdAt: now - 5200000, updatedAt: now - 5100000 },
      answers: [{ id: "a_3_alice", threadId: "t_3", ownerId: "u_alice", text: "我会把手机关掉，睡到自然醒。", version: 1, createdAt: now - 5150000, updatedAt: now - 5050000 }],
      replies: [],
      reports: []
    },
    {
      id: "t_4",
      traceCode: "QB-20260615-0004",
      questionText: "这是一个私密问题",
      questionerId: "u_vv",
      targetUserIds: ["u_herry"],
      visibility: "private",
      createdAt: now - 3000000,
      updatedAt: now - 3000000,
      answer: { id: "a_4", threadId: "t_4", ownerId: "u_herry", text: "我会认真回答，但这条只留给我们两个人看。", version: 1, createdAt: now - 2900000, updatedAt: now - 2800000 },
      replies: [],
      reports: []
    },
    {
      id: "t_5",
      traceCode: "QB-20260615-0005",
      questionText: "推荐一部电影",
      questionerId: "u_vv",
      targetUserIds: ["u_herry"],
      visibility: "public",
      createdAt: now - 2600000,
      updatedAt: now - 2300000,
      answer: { id: "a_5", threadId: "t_5", ownerId: "u_herry", text: "《肖申克的救赎》，看了很多遍。", version: 1, createdAt: now - 2400000, updatedAt: now - 2300000 },
      replies: [{ id: "r_5", threadId: "t_5", ownerId: "u_vv", text: "经典", createdAt: now - 2200000 }],
      reports: []
    },
    {
      id: "t_6",
      traceCode: "QB-20260615-0006",
      questionText: "如果有一个下午可以完全自由支配，你们会怎么安排？",
      questionerId: "u_herry",
      targetUserIds: ["u_vv", "u_bob"],
      visibility: "public",
      createdAt: now - 1800000,
      updatedAt: now - 1500000,
      answer: { id: "a_6_bob", threadId: "t_6", ownerId: "u_bob", text: "我会找一家很安静的咖啡店，把一直没看的书看完。", version: 1, createdAt: now - 1600000, updatedAt: now - 1500000 },
      answers: [],
      replies: [],
      reports: []
    }
  ],
  blocks: [],
  hiddenThreads: [],
  auditLogs: []
};

const clone = value => JSON.parse(JSON.stringify(value));
const wait = value => new Promise(resolve => setTimeout(() => resolve(clone(value)), 70));

function currentUser() {
  return db.users.find(user => user.id === db.currentUserId) || null;
}

function isThreadHiddenForCurrentUser(threadId) {
  return db.hiddenThreads.some(item => item.userId === db.currentUserId && item.threadId === threadId);
}

function userName(id) {
  if (id === "system") return "状态";
  return db.users.find(user => user.id === id)?.nickname || "匿名";
}

function followedUserIds() {
  if (!db.currentUserId) return [];
  return db.follows.filter(follow => follow.followerId === db.currentUserId).map(follow => follow.followeeId);
}

function recentContactIds() {
  if (!db.currentUserId) return [];
  const ids = new Set();
  db.threads.forEach(thread => {
    if (thread.questionerId === db.currentUserId) {
      (thread.targetUserIds || []).forEach(id => ids.add(id));
    }
    if ((thread.targetUserIds || []).includes(db.currentUserId)) {
      ids.add(thread.questionerId);
    }
  });
  ids.delete(db.currentUserId);
  return [...ids];
}

function writeAudit(action, thread, beforeSnapshot, afterSnapshot) {
  db.auditLogs.push({
    id: `audit_${Date.now()}_${db.auditLogs.length}`,
    traceCode: thread?.traceCode || "",
    actorId: db.currentUserId || "guest",
    action,
    beforeSnapshot: beforeSnapshot ? clone(beforeSnapshot) : null,
    afterSnapshot: afterSnapshot ? clone(afterSnapshot) : null,
    createdAt: Date.now()
  });
}

function presentThread(thread) {
  const answers = [
    thread.answer,
    ...(thread.answers || [])
  ].filter(Boolean).map(answer => ({ ...clone(answer), ownerName: userName(answer.ownerId) }));
  const viewerAnswer = answers.find(answer => answer.ownerId === db.currentUserId) || null;
  return {
    ...clone(thread),
    questionerName: userName(thread.questionerId),
    targetNames: thread.targetUserIds.map(userName),
    answer: thread.answer ? { ...clone(thread.answer), ownerName: userName(thread.answer.ownerId) } : null,
    answers,
    viewerAnswer,
    answerOwnerName: thread.answer ? userName(thread.answer.ownerId) : "",
    replies: thread.replies.filter(reply => reply.ownerId !== "system").map(reply => ({ ...clone(reply), ownerName: userName(reply.ownerId) }))
  };
}

function filterQuery(threads, query = "") {
  const keyword = query.trim();
  if (!keyword) return threads;
  return threads.filter(thread => `${thread.questionText} ${thread.answer?.text || ""}`.includes(keyword));
}

function publicAnsweredBy(userId) {
  return db.threads.filter(thread =>
    thread.visibility !== "private" &&
    !isThreadHiddenForCurrentUser(thread.id) &&
    [thread.answer, ...(thread.answers || [])].some(answer => answer?.ownerId === userId && answer?.text)
  );
}


function pad2(value) {
  return String(value).padStart(2, "0");
}

function formatDateTime(value) {
  const date = new Date(value || Date.now());
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

function exportFilename(date = new Date()) {
  return `question-box-export-${date.getFullYear()}${pad2(date.getMonth() + 1)}${pad2(date.getDate())}-${pad2(date.getHours())}${pad2(date.getMinutes())}.md`;
}

function md(value) {
  return String(value ?? "").replace(/\r\n/g, "\n").trim() || "暂无";
}

function threadAnswers(thread) {
  return [thread.answer, ...(thread.answers || [])].filter(Boolean);
}

function visibleReplies(thread) {
  return (thread.replies || []).filter(reply => reply.ownerId !== "system").map(reply => `- ${md(reply.text)}`).join("\n") || "暂无回复";
}

function currentUserAnswer(thread, userId = db.currentUserId) {
  return threadAnswers(thread).find(answer => answer.ownerId === userId) || null;
}

function threadStatus(thread) {
  return threadAnswers(thread).some(answer => answer.text) ? "已回答" : "未回答";
}

function buildExportDocument() {
  const exportedAt = new Date();
  const user = currentUser();
  if (!user) throw new Error("login-required");
  const following = db.follows.filter(follow => follow.followerId === user.id);
  const followingIds = new Set(following.map(follow => follow.followeeId));
  const received = db.threads
    .filter(thread => thread.targetUserIds.includes(user.id))
    .sort((a, b) => (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt));
  const sent = db.threads
    .filter(thread => thread.questionerId === user.id)
    .sort((a, b) => (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt));
  const publicVisible = db.threads
    .filter(thread => thread.visibility !== "private" && threadAnswers(thread).some(answer => answer.ownerId === user.id || followingIds.has(answer.ownerId)))
    .sort((a, b) => (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt));

  const lines = [];
  lines.push("# 提问箱个人数据导出文档", "", "> 本文件为个人数据导出文档，仅用于查看、留存和备份。  ", "> 本文件不支持重新导入 APP，也不具备恢复账号数据的功能。", "", "---", "");
  lines.push("## 一、导出信息", "", `- 导出时间：${formatDateTime(exportedAt)}`, `- 导出账号：${md(user.nickname)}`, `- 用户 ID：${user.id}`, "- 导出范围：当前账号可见的问答数据", "- 文档用途：个人留存", "- 是否支持导入：不支持", "", "---", "");
  lines.push("## 二、账号信息", "", `- 昵称：${md(user.nickname)}`, `- 用户 ID：${user.id}`, `- 关注人数：${following.length}`, "- 被关注状态：以 APP 当前数据为准", "", "---", "");
  lines.push("## 三、我收到的问题", "");
  if (!received.length) lines.push("暂无收到的问题。", "");
  received.forEach((thread, index) => {
    const answer = currentUserAnswer(thread, user.id);
    lines.push(`### ${index + 1}. 问题：${md(thread.questionText)}`, "", `- 问题 ID：${thread.id}`, `- 提问时间：${formatDateTime(thread.createdAt)}`, "- 提问方式：匿名", `- 可见性：${thread.visibility === "private" ? "私密" : "公开"}`, `- 当前状态：${threadStatus(thread)}`, "", "**我的回答：**", "", answer?.text ? md(answer.text) : "暂无回答", "", "**回复记录：**", "", visibleReplies(thread), "", "---", "");
  });
  lines.push("## 四、我发出的问题", "");
  if (!sent.length) lines.push("暂无发出的问题。", "");
  sent.forEach((thread, index) => {
    const targetNames = thread.targetUserIds.map(userName).join("、") || "暂无接收人";
    const answers = threadAnswers(thread).map(answer => `- ${userName(answer.ownerId)}：${md(answer.text)}`).join("\n") || "暂无回答";
    lines.push(`### ${index + 1}. 发给 ${targetNames}：${md(thread.questionText)}`, "", `- 问题 ID：${thread.id}`, `- 发出时间：${formatDateTime(thread.createdAt)}`, `- 接收人：${targetNames}`, `- 可见性：${thread.visibility === "private" ? "私密" : "公开"}`, `- 当前状态：${threadStatus(thread)}`, "", "**对方回答：**", "", answers, "", "**回复记录：**", "", visibleReplies(thread), "", "---", "");
  });
  lines.push("## 五、公开问答记录", "", "> 以下内容为当前账号可见范围内的公开问答记录。  ", "> 私密问答不会作为公开内容展示。", "");
  if (!publicVisible.length) lines.push("暂无公开问答记录。", "");
  publicVisible.forEach((thread, index) => {
    const answer = threadAnswers(thread).find(item => item.ownerId === user.id || followingIds.has(item.ownerId)) || threadAnswers(thread)[0];
    lines.push(`### ${index + 1}. ${userName(answer?.ownerId)} 回答的问题`, "", `**问题：** ${md(thread.questionText)}  `, `**回答者：** ${userName(answer?.ownerId)}  `, "**可见性：** 公开  ", "**回答：**", "", answer?.text ? md(answer.text) : "暂无回答", "", "---", "");
  });
  lines.push("## 六、关注列表", "", "| 用户 | 用户 ID | 备注 |", "|---|---|---|");
  if (following.length) {
    following.forEach(follow => lines.push(`| ${md(userName(follow.followeeId))} | ${follow.followeeId} | ${md(follow.remarkName || userName(follow.followeeId))} |`));
  } else {
    lines.push("| 暂无 | - | - |");
  }
  lines.push("", "---", "", "## 七、说明", "", "1. 本文档仅包含当前账号有权限查看的数据。", "2. 私密内容仅在当前账号可见范围内导出。", "3. 本文档不包含系统内部追溯信息。", "4. 本文档不包含后台管理数据。", "5. 本文档不包含认证凭据、一次性校验信息、会话信息或调试字段。", "6. 本文档不支持重新导入 APP。", "7. 如果需要删除账号或清除数据，请以后续正式版 APP 中的账号删除功能为准。", "", "---", "", "文档生成结束。", "");
  return {
    filename: exportFilename(exportedAt),
    mimeType: "text/markdown;charset=utf-8",
    content: lines.join("\n")
  };
}
export const mockApi = {
  async getMe() {
    const user = currentUser();
    return wait(user ? { ...user, loggedIn: true } : { loggedIn: false });
  },

  async updateMe(input = {}) {
    const user = currentUser();
    if (!user) throw new Error("login-required");
    const nickname = String(input.nickname || "").trim();
    if (!nickname) throw new Error("nickname-required");
    user.nickname = nickname.slice(0, 24);
    return wait({ ...user, loggedIn: true });
  },

  async login(email = "vv@example.com") {
    const user = db.users.find(item => item.email === email) || db.users[0];
    db.currentUserId = user.id;
    return this.getMe();
  },

  async logout() {
    db.currentUserId = null;
    return wait({ loggedIn: false });
  },

  async listRecipients() {
    const ids = new Set(followedUserIds());
    return wait(db.users.filter(user => ids.has(user.id)).map(user => ({
      id: user.id,
      nickname: user.nickname,
      remarkName: db.follows.find(f => f.followerId === db.currentUserId && f.followeeId === user.id)?.remarkName || ""
    })));
  },

  async listFollowing() {
    if (!db.currentUserId) return wait([]);
    return wait(
      db.follows
        .filter(follow => follow.followerId === db.currentUserId)
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
        .map(follow => {
          const user = db.users.find(item => item.id === follow.followeeId);
          return user ? {
            id: user.id,
            nickname: user.nickname,
            remarkName: follow.remarkName || "",
            followedAt: follow.createdAt
          } : null;
        })
        .filter(Boolean)
    );
  },

  async listThreads({ bucket = "received", query = "" } = {}) {
    const me = currentUser();
    const currentId = me?.id || "";
    const following = new Set(followedUserIds());
    let threads = [];

    if (bucket === "sent") {
      threads = db.threads.filter(thread => thread.questionerId === currentId);
    } else if (bucket === "square") {
      threads = db.threads.filter(thread =>
        thread.visibility !== "private" &&
        [thread.answer, ...(thread.answers || [])].filter(Boolean).some(answer =>
          answer?.ownerId !== currentId &&
          following.has(answer.ownerId)
        )
      );
    } else {
      threads = db.threads.filter(thread => thread.targetUserIds.includes(currentId));
    }
    threads = threads.filter(thread => !isThreadHiddenForCurrentUser(thread.id));

    return wait(
      filterQuery(threads, query)
        .sort((a, b) => (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt))
        .map(thread => {
          const item = presentThread(thread);
          if (bucket === "square") {
            item.replies = item.replies.filter(reply => reply.ownerId !== currentId);
          }
          return item;
        })
    );
  },

  async getProfile(userId) {
    const user = db.users.find(item => item.id === userId);
    if (!user) throw new Error("not-found");
    return wait({
      user: clone(user),
      followed: followedUserIds().includes(userId),
      threads: publicAnsweredBy(userId).sort((a, b) => (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt)).map(presentThread)
    });
  },

  async getThread(idOrTraceCode) {
    const thread = db.threads.find(item => item.id === idOrTraceCode || item.traceCode === idOrTraceCode);
    if (!thread) throw new Error("not-found");
    return wait(presentThread(thread));
  },

  async createQuestion({ text, targetUserIds, visibility = "public" }) {
    if (!db.currentUserId) throw new Error("login-required");
    const allowed = new Set([...followedUserIds(), ...recentContactIds()]);
    const targets = targetUserIds.filter(id => allowed.has(id));
    if (!targets.length) throw new Error("target-required");
    const time = Date.now();
    const thread = {
      id: `t_${time}`,
      traceCode: `QB-${time}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      questionText: text,
      questionerId: db.currentUserId,
      targetUserIds: targets,
      visibility,
      createdAt: time,
      updatedAt: time,
      answer: null,
      replies: [],
      reports: []
    };
    db.threads.unshift(thread);
    writeAudit("thread.create", thread, null, thread);
    return wait(presentThread(thread));
  },

  async deleteThread(input) {
    const threadId = typeof input === "object" ? input.threadId : input;
    const idx = db.threads.findIndex(item => item.id === threadId);
    if (idx < 0) throw new Error("not-found");
    const thread = db.threads[idx];
    if (thread.questionerId !== db.currentUserId) throw new Error("forbidden");
    const before = clone(thread);
    db.threads.splice(idx, 1);
    writeAudit("thread.delete", before, before, null);
    return wait(true);
  },

  async upsertAnswer(input, maybeText) {
    if (!db.currentUserId) throw new Error("login-required");
    const threadId = typeof input === "object" ? input.threadId : input;
    const text = typeof input === "object" ? input.text : maybeText;
    const thread = db.threads.find(item => item.id === threadId);
    if (!thread) throw new Error("not-found");
    const before = clone(thread);
    const time = Date.now();
    thread.answers ||= [];
    const currentPrimary = thread.answer?.ownerId === db.currentUserId ? thread.answer : null;
    const currentExtra = thread.answers.find(answer => answer.ownerId === db.currentUserId);
    const answer = currentPrimary || currentExtra || {
      id: `a_${threadId}_${db.currentUserId}`,
      threadId,
      ownerId: db.currentUserId,
      version: 0,
      createdAt: time
    };
    answer.text = text;
    answer.version = (answer.version || 0) + 1;
    answer.updatedAt = time;

    if (currentPrimary) {
      thread.answer = answer;
    } else if (currentExtra) {
      Object.assign(currentExtra, answer);
    } else if (!thread.answer && thread.targetUserIds.includes(db.currentUserId)) {
      thread.answer = answer;
    } else {
      thread.answers.push(answer);
    }

    thread.updatedAt = time;
    writeAudit("answer.upsert", thread, before, thread);
    return wait(presentThread(thread));
  },

  async deleteAnswer(input) {
    if (!db.currentUserId) throw new Error("login-required");
    const threadId = typeof input === "object" ? input.threadId : input;
    const thread = db.threads.find(item => item.id === threadId);
    if (!thread) throw new Error("not-found");
    if (!db.hiddenThreads.some(item => item.userId === db.currentUserId && item.threadId === threadId)) {
      db.hiddenThreads.push({ userId: db.currentUserId, threadId, createdAt: Date.now() });
    }
    writeAudit("thread.hide", thread, clone(thread), { userId: db.currentUserId, threadId });
    return wait(true);
  },

  async createReply(input, maybeText) {
    if (!db.currentUserId) throw new Error("login-required");
    const threadId = typeof input === "object" ? input.threadId : input;
    const text = typeof input === "object" ? input.text : maybeText;
    const thread = db.threads.find(item => item.id === threadId);
    if (!thread) throw new Error("not-found");
    const reply = { id: `r_${Date.now()}`, threadId, ownerId: db.currentUserId, text, createdAt: Date.now() };
    thread.replies.push(reply);
    thread.updatedAt = reply.createdAt;
    writeAudit("reply.create", thread, null, reply);
    return wait(presentThread(thread));
  },

  async followUser(input) {
    if (!db.currentUserId) throw new Error("login-required");
    const userId = typeof input === "object" ? input.userId : input;
    if (!db.follows.some(follow => follow.followerId === db.currentUserId && follow.followeeId === userId)) {
      db.follows.push({ followerId: db.currentUserId, followeeId: userId, remarkName: "", interactions: 0, createdAt: Date.now() });
    }
    return wait(true);
  },

  async unfollowUser(input) {
    const userId = typeof input === "object" ? input.userId : input;
    const idx = db.follows.findIndex(follow => follow.followerId === db.currentUserId && follow.followeeId === userId);
    if (idx >= 0) db.follows.splice(idx, 1);
    return wait(true);
  },

  async updateFollowRemark(input, maybeRemarkName) {
    if (!db.currentUserId) throw new Error("login-required");
    const userId = typeof input === "object" ? input.userId : input;
    const remarkName = typeof input === "object" ? input.remarkName : maybeRemarkName;
    let follow = db.follows.find(item => item.followerId === db.currentUserId && item.followeeId === userId);
    if (!follow) {
      follow = { followerId: db.currentUserId, followeeId: userId, remarkName: "", interactions: 0, createdAt: Date.now() };
      db.follows.push(follow);
    }
    follow.remarkName = String(remarkName || "").trim();
    return wait(true);
  },

  async reportThread(input, maybeReason) {
    const threadId = typeof input === "object" ? input.threadId : input;
    const reason = typeof input === "object" ? input.reason : maybeReason;
    const thread = db.threads.find(item => item.id === threadId);
    if (!thread) throw new Error("not-found");
    thread.reports.push({ reporterId: db.currentUserId || "guest", reason, createdAt: Date.now() });
    writeAudit("thread.report", thread, null, { reason });
    return wait(true);
  },

  async blockUser(input) {
    if (!db.currentUserId) throw new Error("login-required");
    const userId = typeof input === "object" ? input.userId : input;
    if (!db.blocks.some(block => block.blockerId === db.currentUserId && block.blockedId === userId)) {
      db.blocks.push({ blockerId: db.currentUserId, blockedId: userId, createdAt: Date.now() });
    }
    return wait(true);
  },

  async deleteAccount() {
    if (!db.currentUserId) throw new Error("login-required");
    const deletedId = db.currentUserId;
    db.currentUserId = null;
    writeAudit("user.delete", { traceCode: `USER-${deletedId}` }, { id: deletedId }, null);
    return wait({ deleted: true });
  },

  async exportData() {
    return wait(buildExportDocument());
  },

  /** @deprecated Data import has been removed from the product. Kept only for legacy callers. */
  async importData() {
    console.warn("[question-box] importData() is deprecated and disabled. Exported Markdown documents cannot be imported.");
    throw new Error("data-import-disabled");
  },

  createShare(type, id) {
    return `qb://share/${type}/${encodeURIComponent(id)}`;
  },

  resolveShare(code) {
    const match = String(code || "").trim().match(/^qb:\/\/share\/(profile|thread)\/(.+)$/);
    return match ? { type: match[1], id: decodeURIComponent(match[2]) } : null;
  }
};

export const api = mockApi;
