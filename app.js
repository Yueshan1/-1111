import { api } from "./api/index.js";

const $ = selector => document.querySelector(selector);
const TEST_MODE = import.meta.env?.VITE_TEST_MODE === "true";

const state = {
  me: null,
  view: "received",
  squareMode: "square",
  profileUserId: "",
  profile: null,
  sharedThread: null,
  returnView: "square",
  returnSquareMode: "list",
  previousView: "received",
  previousSquareMode: "square",
  threads: [],
  following: [],
  expanded: new Set(),
  visibleReplies: {},
  acting: "",
  reveal: "",
  revealKind: "",
  composing: false,
  answeringId: "",
  draft: "",
  replyDraft: "",
  searchQuery: "",
  nicknameDraft: "",
  noteUserId: "",
  noteValue: "",
  privateQuestion: false,
  recipients: [],
  recipientActivity: {},
  selectedRecipients: new Set(),
  userNames: {},
  menuOpen: false,
  sheetClosing: false,
  testUsers: []
};

let cardMotionTimer = null;
let revealTimer = null;
let viewSwitchTimers = [];
let loadSeq = 0;
let noteTap = { userId: "", time: 0 };

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, m => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[m]));
}

function actualUserName(userId, fallback = "") {
  return state.userNames?.[userId] || fallback || "";
}

function displayUserName(userId, fallback = "") {
  if (!userId) return fallback || "";
  const knownUser = [
    ...(state.recipients || []),
    ...(state.following || []),
    ...(state.testUsers || []),
    state.me
  ].find(user => user?.id === userId);
  return actualUserName(userId, fallback || knownUser?.nickname || knownUser?.remarkName || "");
}

function displayRecipientName(user) {
  return displayUserName(user?.id, user?.nickname || user?.remarkName || "");
}

function addRecipientOption(map, userId, input = {}) {
  if (!userId || userId === state.me?.id) return;
  const current = map.get(userId) || { id: userId, nickname: "", remarkName: "", lastActivityAt: 0, followedAt: 0 };
  const nickname = input.nickname || input.name || current.nickname || displayUserName(userId);
  const remarkName = input.remarkName || current.remarkName || "";
  const lastActivityAt = Math.max(current.lastActivityAt || 0, input.lastActivityAt || 0);
  const followedAt = Math.max(current.followedAt || 0, input.followedAt || 0);
  map.set(userId, { ...current, nickname, remarkName, lastActivityAt, followedAt });
}

function buildRecipientOptions({ recipients = [], following = [], receivedThreads = [], sentThreads = [] } = {}) {
  const map = new Map();
  [...recipients, ...following].forEach(user => addRecipientOption(map, user?.id, {
    nickname: user?.nickname,
    remarkName: user?.remarkName,
    followedAt: user?.followedAt || 0
  }));
  receivedThreads.forEach(thread => {
    addRecipientOption(map, thread.questionerId, {
      name: thread.questionerName,
      lastActivityAt: thread.updatedAt || thread.createdAt || 0
    });
  });
  sentThreads.forEach(thread => {
    (thread.targetUserIds || []).forEach((userId, index) => {
      addRecipientOption(map, userId, {
        name: thread.targetNames?.[index],
        lastActivityAt: thread.updatedAt || thread.createdAt || 0
      });
    });
  });
  const activity = {};
  const options = [...map.values()]
    .map(user => ({ ...user, nickname: displayUserName(user.id, user.nickname || user.remarkName || "") }))
    .filter(user => user.nickname || user.remarkName)
    .sort((a, b) =>
      (b.lastActivityAt || 0) - (a.lastActivityAt || 0)
      || (b.followedAt || 0) - (a.followedAt || 0)
      || displayRecipientName(a).localeCompare(displayRecipientName(b), "zh-Hans-CN")
    );
  options.forEach(user => {
    activity[user.id] = user.lastActivityAt || user.followedAt || 0;
  });
  return { options, activity };
}

function rememberUserName(user) {
  if (!user?.id || !user?.nickname) return;
  state.userNames[user.id] = user.nickname;
}

function rememberThreadUserNames(thread) {
  if (!thread) return;
  if (thread.questionerId && thread.questionerName) {
    state.userNames[thread.questionerId] = thread.questionerName;
  }
  (thread.targetUserIds || []).forEach((userId, index) => {
    const name = thread.targetNames?.[index];
    if (userId && name) state.userNames[userId] = name;
  });
  if (thread.answer?.ownerId && thread.answerOwnerName) {
    state.userNames[thread.answer.ownerId] = thread.answerOwnerName;
  }
  [thread.answer, ...(thread.answers || []), thread.viewerAnswer, ...(thread.replies || [])]
    .filter(Boolean)
    .forEach(item => {
      const name = item.ownerName || item.answerOwnerName || "";
      if (item.ownerId && name) state.userNames[item.ownerId] = name;
    });
}

function downloadTextFile(file) {
  const content = String(file?.content || "");
  const filename = file?.filename || "question-box-export.md";
  const mimeType = file?.mimeType || "text/markdown;charset=utf-8";
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}


function toast(message) {
  const el = $("#toast");
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove("show"), 1600);
}

function currentAnswer(thread) {
  if (!thread || !state.me?.loggedIn) return null;
  if (thread.viewerAnswer?.ownerId === state.me.id) return thread.viewerAnswer;
  if (thread.answer?.ownerId === state.me.id) return thread.answer;
  return null;
}

function canEditAnswer(thread) {
  const answer = currentAnswer(thread);
  return Boolean(answer?.text && Number(answer.version || 1) <= 1);
}

function canDeleteAnswer(thread) {
  return Boolean(currentAnswer(thread)?.text);
}

function canShowThirdLevel(thread) {
  return thread?.visibility !== "private";
}

function canAnswer(thread, mode = state.view) {
  if (mode === "profile" || mode === "square") {
    const ownerId = mode === "profile" ? state.profileUserId : socialCardOwnerId(thread, "square");
    return Boolean(
      state.me?.loggedIn
      && !currentAnswer(thread)?.text
      && thread.visibility !== "private"
      && ownerId !== state.me.id
    );
  }
  return Boolean(
    state.me?.loggedIn
    && !currentAnswer(thread)?.text
    && thread.questionerId !== state.me.id
    && (
      thread.targetUserIds?.includes(state.me.id)
      || ((mode === "square" || mode === "profile") && thread.visibility !== "private")
    )
  );
}

function modeKey(mode = state.view) {
  if (mode === "profile") return `profile:${state.profileUserId || "unknown"}`;
  return mode;
}

function threadKey(id, mode = state.view) {
  return `${modeKey(mode)}:${id}`;
}

function isThreadOpen(id, mode = state.view) {
  return state.expanded.has(threadKey(id, mode));
}

function setThreadOpen(id, mode = state.view, open = true) {
  const key = threadKey(id, mode);
  open ? state.expanded.add(key) : state.expanded.delete(key);
}

function visibleReplyCount(id, mode = state.view) {
  return state.visibleReplies[threadKey(id, mode)] || 0;
}

function setVisibleReplyCount(id, mode = state.view, count = 0) {
  state.visibleReplies[threadKey(id, mode)] = count;
}

function isSocialMode(mode = state.view) {
  return mode === "square" || mode === "profile";
}

function answerBelongsToCurrentUser(thread) {
  return Boolean(currentAnswer(thread)?.text);
}

function answerBelongsToUser(thread, userId = state.me?.id) {
  if (!thread || !userId) return false;
  if (thread.viewerAnswer?.ownerId === userId && thread.viewerAnswer?.text) return true;
  if (thread.answer?.ownerId === userId && thread.answer?.text) return true;
  return (thread.answers || []).some(answer => answer?.ownerId === userId && answer?.text);
}

function canAnswerAsUser(thread, userId = state.me?.id) {
  return Boolean(
    thread
    && userId
    && !answerBelongsToUser(thread, userId)
    && thread.questionerId !== userId
    && thread.targetUserIds?.includes(userId)
  );
}

function shouldUseReceivedThreeLayer(thread, mode = state.view, userId = state.me?.id) {
  return mode === "received" && (answerBelongsToUser(thread, userId) || canAnswerAsUser(thread, userId));
}

function shouldKeepReceivedAnswerOpen(thread, mode = state.view) {
  return shouldUseReceivedThreeLayer(thread, mode);
}

function sortReceivedThreads(threads, userId = state.me?.id) {
  return [...threads].sort((a, b) => {
    const aAnswered = answerBelongsToUser(a, userId) ? 1 : 0;
    const bAnswered = answerBelongsToUser(b, userId) ? 1 : 0;
    if (aAnswered !== bAnswered) return aAnswered - bAnswered;
    return (b.createdAt || 0) - (a.createdAt || 0);
  });
}

function syncReceivedDefaultOpen(threads, userId = state.me?.id) {
  threads.forEach(thread => {
    const threeLayer = shouldUseReceivedThreeLayer(thread, "received", userId);
    setThreadOpen(thread.id, "received", threeLayer);
    if (threeLayer) setVisibleReplyCount(thread.id, "received", 0);
  });
}

function syncProfileDefaultOpen(threads) {
  threads.forEach(thread => {
    setThreadOpen(thread.id, "profile", true);
    setVisibleReplyCount(thread.id, "profile", 0);
  });
}

function syncSocialDefaultOpen(threads, mode) {
  threads.forEach(thread => {
    setThreadOpen(thread.id, mode, true);
    if (!visibleReplyCount(thread.id, mode)) setVisibleReplyCount(thread.id, mode, 0);
  });
}

function syncSentDefaultOpen(threads) {
  threads.forEach(thread => {
    setThreadOpen(thread.id, "sent", true);
    if (!visibleReplyCount(thread.id, "sent")) setVisibleReplyCount(thread.id, "sent", 1);
  });
}

function publicAnswerItems(thread) {
  const answers = [
    thread.answer,
    ...(thread.answers || [])
  ].filter(answer => answer?.text);
  const seen = new Set();
  return answers
    .filter(answer => {
      if (answer.ownerId === state.me?.id) return false;
      if (seen.has(answer.id)) return false;
      seen.add(answer.id);
      return true;
    })
    .map(answer => ({
      id: `${answer.id}:public-answer`,
      ownerId: answer.ownerId,
      ownerName: displayUserName(answer.ownerId, answer.ownerName || answer.answerOwnerName || thread.answerOwnerName || ""),
      text: answer.text
    }));
}

function allAnswerItems(thread) {
  const seen = new Set();
  return [
    thread?.answer,
    ...(thread?.answers || [])
  ]
    .filter(answer => answer?.text)
    .filter(answer => {
      if (seen.has(answer.id)) return false;
      seen.add(answer.id);
      return true;
    })
    .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))
    .map(answer => ({
      id: `${answer.id}:answer`,
      ownerId: answer.ownerId,
      ownerName: displayUserName(answer.ownerId, answer.ownerName || answer.answerOwnerName || thread.answerOwnerName || ""),
      text: answer.text,
      createdAt: answer.createdAt || answer.updatedAt || 0
    }));
}

function defaultReplyCount(thread, mode = state.view) {
  return publicAnswerItems(thread, mode).length ? 1 : 0;
}

function replyItems(thread, mode = state.view) {
  if (!thread) return [];
  const visibleReplies = (thread.replies || []).filter(reply => reply.ownerId !== "system");
  const normalReplies = isSocialMode(mode)
    ? visibleReplies.filter(reply => reply.ownerId !== state.me?.id)
    : visibleReplies;
  return [...publicAnswerItems(thread), ...normalReplies];
}

function sentAnswerItems(thread) {
  const seen = new Set();
  return [
    thread.answer,
    ...(thread.answers || [])
  ]
    .filter(answer => answer?.text)
    .filter(answer => {
      if (seen.has(answer.id)) return false;
      seen.add(answer.id);
      return true;
    })
    .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))
    .map(answer => ({
      id: answer.id,
      ownerId: answer.ownerId,
      ownerName: displayUserName(answer.ownerId, answer.ownerName || answer.answerOwnerName || thread.answerOwnerName || ""),
      text: answer.text
    }));
}

function sentAnswerOwnerName(thread, answer) {
  if (!answer?.ownerId) return "";
  const targetIndex = (thread.targetUserIds || []).indexOf(answer.ownerId);
  const targetName = targetIndex >= 0 ? thread.targetNames?.[targetIndex] : "";
  const knownUser = [
    ...(state.recipients || []),
    ...(state.following || []),
    ...(state.testUsers || []),
    state.me
  ].find(user => user?.id === answer.ownerId);
  return targetName
    || state.userNames?.[answer.ownerId]
    || answer.ownerName
    || answer.answerOwnerName
    || knownUser?.nickname
    || knownUser?.remarkName
    || "";
}

function answerByUser(thread, userId) {
  if (!thread || !userId) return null;
  if (thread.answer?.ownerId === userId && thread.answer?.text) return thread.answer;
  return (thread.answers || []).find(answer => answer?.ownerId === userId && answer?.text) || null;
}

function socialCardOwnerId(thread, mode = state.view) {
  if (mode === "profile") return state.profile?.user?.id || state.profileUserId;
  const followed = new Set((state.following || []).map(user => user.id));
  const followedAnswer = allAnswerItems(thread).find(answer => followed.has(answer.ownerId));
  return followedAnswer?.ownerId || thread?.answer?.ownerId || "";
}

function socialReplyItems(thread, ownerId) {
  const answers = allAnswerItems(thread).filter(answer => answer.ownerId !== ownerId);
  const replies = (thread?.replies || [])
    .filter(reply => reply.ownerId !== "system")
    .map(reply => ({
      id: reply.id,
      ownerId: reply.ownerId,
      ownerName: reply.ownerName || "",
      text: reply.text,
      createdAt: reply.createdAt || 0
    }));
  return [...answers, ...replies].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
}

function stackClass(thread, mode = state.view) {
  const classes = ["stamp-stack"];
  if (isThreadOpen(thread.id, mode)) classes.push("is-open");
  if (state.reveal === threadKey(thread.id, mode)) classes.push(`is-revealing-${state.revealKind}`);
  return classes.join(" ");
}

function stamp(kind, body, opts = {}) {
  const actionTop = opts.top ? `<button class="stamp-action action-top" type="button" data-act="${opts.topAct}" data-id="${opts.id}">${opts.top}</button>` : "";
  const actionLeft = opts.left ? `<button class="stamp-action action-left" type="button" data-act="${opts.leftAct}" data-id="${opts.id}">${opts.left}</button>` : "";
  const actionRight = opts.right ? `<button class="stamp-action action-right" type="button" data-act="${opts.rightAct}" data-id="${opts.id}">${opts.right}</button>` : "";
  const classes = ["stamp", opts.reply ? "reply" : "", state.acting === opts.motionKey ? "is-acting" : ""].filter(Boolean).join(" ");
  return `
    <article class="${classes}" data-id="${opts.id}" data-card-act="${opts.cardAct || "feedback"}">
      <div class="stamp-title">${kind}</div>
      ${actionTop}
      <div class="stamp-body">${esc(body)}</div>
      ${actionLeft}
      ${actionRight}
    </article>
  `;
}

function answerEditor(thread) {
  return `
    <article class="stamp reply" data-id="${thread.id}">
      <div class="stamp-title">答</div>
      <textarea class="inline-answer" maxlength="200">${esc(state.draft)}</textarea>
      <button class="stamp-action action-right" type="button" data-act="submit-inline-answer" data-id="${thread.id}">完</button>
    </article>
  `;
}

function answerPromptCard(thread) {
  return `
    <article class="stamp reply" data-id="${thread.id}" data-card-act="feedback">
      <div class="stamp-body"></div>
      <button class="stamp-action action-left" type="button" data-act="answer" data-id="${thread.id}">答</button>
    </article>
  `;
}

function shouldHideReplyName(mode) {
  return mode === "received" || mode === "square" || mode === "profile";
}

function replyList(thread, mode = state.view) {
  const replies = replyItems(thread, mode);
  const shown = visibleReplyCount(thread.id, mode);
  const lines = replies.slice(0, shown);
  const expanded = shown > 0;
  const allShown = shown >= replies.length;
  const shouldCollapse = expanded && allShown;
  const canAnswerThread = canAnswer(thread, mode) && !shouldUseReceivedThreeLayer(thread, mode);
  const canExpandReplies = replies.length > 0;
  const content = expanded ? lines.map(reply => `
        <div class="reply-line">
          ${shouldHideReplyName(mode) ? "" : `<button class="reply-name" type="button" data-act="reply-person" data-user="${esc(reply.ownerId)}">${esc(reply.ownerName)}</button>`}
          <span>${esc(reply.text)}</span>
        </div>
      `).join("") : "";
  return `
    <section class="sub-replies ${expanded ? "" : "is-collapsed"} ${canAnswerThread ? "has-answer-left" : "no-answer-left"}" data-id="${thread.id}" data-card-act="card-feedback">
      <div class="sub-replies-content">${content}</div>
      ${canAnswerThread ? `<button class="stamp-action action-left" type="button" data-act="answer" data-id="${thread.id}">答</button>` : ""}
      ${canExpandReplies ? `<button class="stamp-action action-right" type="button" data-act="${shouldCollapse ? "collapse-replies" : "expand-replies"}" data-id="${thread.id}">
        ${shouldCollapse ? "收" : "展"}
      </button>` : ""}
    </section>
  `;
}

function replyListView(thread, mode = state.view) {
  const replies = replyItems(thread, mode);
  const shown = visibleReplyCount(thread.id, mode);
  const lines = replies.slice(0, shown);
  const expanded = shown > 0;
  const allShown = shown >= replies.length;
  const shouldCollapse = expanded && allShown;
  const canAnswerThread = canAnswer(thread, mode) && !shouldUseReceivedThreeLayer(thread, mode);
  const canExpandReplies = replies.length > 0;
  const content = expanded ? lines.map(reply => `
        <div class="reply-line">
          ${shouldHideReplyName(mode) ? "" : `<button class="reply-name" type="button" data-act="reply-person" data-user="${esc(reply.ownerId)}">${esc(reply.ownerName)}</button>`}
          <span>${esc(reply.text)}</span>
        </div>
      `).join("") : "";
  return `
    <section class="sub-replies ${expanded ? "" : "is-collapsed"} ${canAnswerThread ? "has-answer-left" : "no-answer-left"}" data-id="${thread.id}" data-card-act="card-feedback">
      <div class="sub-replies-content">${content}</div>
      ${canAnswerThread ? `<button class="stamp-action action-left" type="button" data-act="answer" data-id="${thread.id}">答</button>` : ""}
      ${canExpandReplies ? `<button class="stamp-action action-right" type="button" data-act="${shouldCollapse ? "collapse-replies" : "expand-replies"}" data-id="${thread.id}">
        ${shouldCollapse ? "收" : "展"}
      </button>` : ""}
    </section>
  `;
}

function sentAnswersCard(thread) {
  const answers = sentAnswerItems(thread);
  const shown = Math.min(Math.max(visibleReplyCount(thread.id, "sent") || 1, 1), Math.max(answers.length, 1));
  const visibleAnswers = answers.slice(0, shown);
  const allShown = shown >= answers.length;
  const body = visibleAnswers.length
    ? visibleAnswers.map(answer => {
      const ownerName = sentAnswerOwnerName(thread, answer);
      return `<div class="sent-answer-line" data-act="reply-person" data-user="${esc(answer.ownerId)}"><span class="sent-answer-owner">${esc(ownerName)}</span><span class="sent-answer-text">${esc(answer.text)}</span></div>`;
    }).join("")
    : `<div class="reply-line"><span>暂无回答</span></div>`;
  return `
    <article class="stamp reply sent-answers" data-id="${thread.id}" data-card-act="feedback">
      <div class="stamp-title">答</div>
      <div class="stamp-body">${body}</div>
      ${answers.length > 1 ? `<button class="stamp-action action-right" type="button" data-act="${allShown ? "collapse-replies" : "expand-replies"}" data-id="${thread.id}">${allShown ? "收" : "展"}</button>` : ""}
    </article>
  `;
}

function sentThreadCard(thread) {
  const question = stamp("问", thread.questionText, {
    id: thread.id,
    top: "删",
    topAct: "delete-thread",
    cardAct: "feedback",
    motionKey: `${thread.id}:question`
  });
  return `
    <section class="${stackClass(thread, "sent")}" data-thread-id="${thread.id}" data-mode="sent">
      ${question}
      ${sentAnswersCard(thread)}
    </section>
  `;
}

function profileAnswerEditor(thread) {
  return `
    <section class="sub-replies profile-answer-editor" data-id="${thread.id}">
      <div class="stamp-title">答</div>
      <textarea class="inline-answer" maxlength="200">${esc(state.draft)}</textarea>
      <button class="stamp-action action-right" type="button" data-act="submit-inline-answer" data-id="${thread.id}">完</button>
    </section>
  `;
}

function profileReplyItems(thread, mode = "profile", ownerId = socialCardOwnerId(thread, mode)) {
  return socialReplyItems(thread, ownerId);
}

function profileReplyCard(thread, mode = "profile", ownerId = socialCardOwnerId(thread, mode)) {
  if (state.answeringId === thread.id) return profileAnswerEditor(thread);
  const replies = profileReplyItems(thread, mode, ownerId);
  const shown = visibleReplyCount(thread.id, mode);
  const lines = replies.slice(0, shown);
  const expanded = shown > 0;
  const allShown = shown >= replies.length;
  const shouldCollapse = expanded && allShown;
  const canEdit = canEditAnswer(thread);
  const canWrite = canAnswer(thread, mode);
  const actionText = canEdit ? "改" : (canWrite ? "答" : "");
  const content = expanded ? lines.map(reply => `
        <div class="reply-line">
          <span>${esc(reply.text)}</span>
        </div>
      `).join("") : "";
  return `
    <section class="sub-replies ${expanded ? "" : "is-collapsed"} ${actionText ? "has-answer-left" : "no-answer-left"}" data-id="${thread.id}" data-card-act="card-feedback">
      <div class="sub-replies-content">${content}</div>
      ${actionText ? `<button class="stamp-action action-left" type="button" data-act="answer" data-id="${thread.id}">${actionText}</button>` : ""}
      ${replies.length ? `<button class="stamp-action action-right" type="button" data-act="${shouldCollapse ? "collapse-replies" : "expand-replies"}" data-id="${thread.id}">
        ${shouldCollapse ? "收" : "展"}
      </button>` : ""}
    </section>
  `;
}

function profileThreadCard(thread, mode = "profile", ownerId = socialCardOwnerId(thread, mode)) {
  const profileAnswer = answerByUser(thread, ownerId);
  const question = stamp("问", thread.questionText, {
    id: thread.id,
    top: "转",
    topAct: "share-thread",
    cardAct: "feedback",
    motionKey: `${thread.id}:question`
  });
  const answer = stamp("答", profileAnswer?.text || "", {
    id: thread.id,
    reply: true,
    cardAct: "feedback",
    motionKey: `${thread.id}:answer`
  });
  return `
    <section class="${stackClass(thread, mode)}" data-thread-id="${thread.id}" data-mode="${mode}">
      ${question}
      ${answer}
      ${profileReplyCard(thread, mode, ownerId)}
    </section>
  `;
}

function threadCard(thread, mode = state.view) {
  if (mode === "sent") return sentThreadCard(thread);
  if (mode === "profile") return profileThreadCard(thread, "profile");
  if (mode === "square" && state.squareMode === "square") return profileThreadCard(thread, "square", socialCardOwnerId(thread, "square"));
  const expanded = isThreadOpen(thread.id, mode);
  const question = stamp("问", thread.questionText, {
    id: thread.id,
    top: mode === "sent" ? "删" : "转",
    topAct: mode === "sent" ? "delete-thread" : "share-thread",
    cardAct: "toggle-question",
    motionKey: `${thread.id}:question`
  });

  if (!expanded) {
    return `<section class="${stackClass(thread, mode)}" data-thread-id="${thread.id}" data-mode="${mode}">${question}</section>`;
  }

  const showReceivedPrompt = shouldUseReceivedThreeLayer(thread, mode) && canAnswer(thread, mode);
  const hasAnswerCard = state.answeringId === thread.id || answerBelongsToCurrentUser(thread) || showReceivedPrompt;
  const ownAnswer = currentAnswer(thread);
  const answerLeft = canEditAnswer(thread) ? "改" : (canAnswer(thread, mode) ? "答" : "");
  const answer = state.answeringId === thread.id
    ? answerEditor(thread)
    : showReceivedPrompt
      ? answerPromptCard(thread)
      : stamp("答", ownAnswer?.text || "还没回答，点“答”可以直接写回复。", {
      id: thread.id,
      reply: true,
      top: canDeleteAnswer(thread) ? "删" : "",
      topAct: "delete-answer",
      left: answerLeft,
      leftAct: "answer",
      cardAct: "toggle-answer",
      motionKey: `${thread.id}:answer`
    });

  return `
    <section class="${stackClass(thread, mode)}" data-thread-id="${thread.id}" data-mode="${mode}">
      ${question}
      ${!hasAnswerCard ? "" : answer}
      ${canShowThirdLevel(thread) ? replyListView(thread, mode) : ""}
    </section>
  `;
}

function squareSwitch() {
  return `
    <nav class="plaza-switch globe-tabs">
      <button class="${state.squareMode === "list" ? "active" : ""}" type="button" data-act="square-mode" data-mode="list">列表</button>
      <button class="${state.squareMode === "square" ? "active" : ""}" type="button" data-act="square-mode" data-mode="square">关注广场</button>
    </nav>
  `;
}

function followingList() {
  if (!state.me?.loggedIn) return `<p class="empty">登录后查看关注列表</p>`;
  if (!state.following.length) return `<p class="empty">暂无关注对象</p>`;
  return `
    <section class="follow-list directory-list">
      ${state.following.map(user => `
        <div class="follow-row directory-row">
          <span class="fusion-wrap dir-fusion">
            <svg aria-hidden="true"></svg>
            <button class="fusion-left" type="button" data-act="open-profile" data-user="${esc(user.id)}">${esc(user.nickname)}</button>
            <button class="fusion-right ${user.remarkName ? "" : "is-empty"}" type="button" data-note-user="${esc(user.id)}">${user.remarkName ? esc(user.remarkName) : "&nbsp;"}</button>
          </span>
        </div>
      `).join("")}
    </section>
  `;
}

function profileView() {
  const profile = state.profile;
  if (!profile) return `<p class="empty">主页加载中</p>`;
  const isSelf = state.me?.id === profile.user.id;
  const profileName = displayUserName(profile.user.id, profile.user.nickname);
  const query = state.searchQuery.trim();
  const threads = query
    ? profile.threads.filter(thread => thread.questionText.includes(query))
    : profile.threads;
  return `
    <section class="profile-panel">
      <div class="profile-head">
        <button class="profile-back" type="button" data-act="profile-back">‹</button>
        <nav class="profile-top-actions">
          ${isSelf ? "" : `<button class="follow-toggle ${profile.followed ? "following" : ""}" type="button" data-act="toggle-follow" data-user="${esc(profile.user.id)}">${profile.followed ? "已关注" : "关注"}</button>`}
          <button type="button" data-act="search">搜索</button>
          <button type="button" data-act="share-profile">分享</button>
        </nav>
        <div class="profile-username">${esc(profileName)}</div>
      </div>
      <section class="feed profile-feed">
        ${threads.length ? threads.map(thread => threadCard(thread, "profile")).join("") : `<p class="empty">${query ? "没有找到相关问题" : "暂无公开回答"}</p>`}
      </section>
    </section>
  `;
}

function sharedThreadView() {
  const thread = state.sharedThread;
  return `
    <section class="profile-panel thread-panel">
      <div class="profile-head thread-head">
        <button class="profile-back" type="button" data-act="thread-back">鈥?/button>
      </div>
      <section class="feed profile-feed">
        ${thread ? threadCard(thread, "thread") : `<p class="empty">鏈壘鍒拌繖寮犲崱鐗?/p>`}
      </section>
    </section>
  `;
}

function sharedThreadViewClean() {
  const thread = state.sharedThread;
  return `
    <section class="profile-panel thread-panel">
      <div class="profile-head thread-head">
        <button class="profile-back" type="button" data-act="thread-back">‹</button>
      </div>
      <section class="feed profile-feed">
        ${thread ? threadCard(thread, "thread") : `<p class="empty">未找到这张卡片</p>`}
      </section>
    </section>
  `;
}

function feedEnd() {
  return `<div class="feed-end" aria-hidden="true"></div>`;
}

function searchPage() {
  return `
    <section class="search-page">
      <button class="search-back" type="button" data-act="search-back">‹</button>
      <div class="search-panel">
        <input id="searchPanelInput" type="text" value="${esc(state.searchQuery)}" placeholder="搜索问答或粘贴链接" autofocus>
        <button class="search-confirm" type="button" data-act="search-confirm">确定</button>
      </div>
    </section>
  `;
}


function editNotePage() {
  const target = state.following.find(user => user.id === state.noteUserId);
  return `
    <section class="search-page import-page">
      <button class="search-close" type="button" data-act="edit-note-back">×</button>
      <div class="import-title">备注</div>
      <div class="search-panel import-panel">
        <input id="editNoteInput" type="text" value="${esc(state.noteValue)}" placeholder="输入备注名" autofocus>
        <button class="search-confirm" type="button" data-act="edit-note-confirm" data-user="${esc(state.noteUserId)}">完成</button>
      </div>
      ${target ? `<p class="empty" style="margin-top:22px;">${esc(target.nickname)}</p>` : ""}
    </section>
  `;
}

function editProfilePage() {
  return `
    <section class="search-page import-page">
      <button class="search-back" type="button" data-act="edit-profile-back">‹</button>
      <div class="search-panel import-panel">
        <input id="editProfileInput" type="text" value="${esc(state.nicknameDraft)}" maxlength="24" autofocus>
        <button class="search-confirm" type="button" data-act="edit-profile-confirm">完成</button>
      </div>
    </section>
  `;
}

function feedContent() {
  if (state.view === "search") return searchPage();
  if (state.view === "edit-profile") return editProfilePage();
  if (state.view === "edit-note") return editNotePage();
  if (state.view === "profile") return profileView();
  if (state.view === "thread") return sharedThreadViewClean();
  if (state.view === "square" && state.squareMode === "list") return followingList();
  return `
    <section class="feed">
      ${state.threads.length ? state.threads.map(thread => threadCard(thread, state.view)).join("") + feedEnd() : `<p class="empty">${state.me?.loggedIn ? "暂无内容" : "登录后查看内容"}</p>`}
    </section>
  `;
}

function topContent() {
  const meName = state.me?.loggedIn ? state.me.nickname : "未登录";
  if (state.view === "profile" || state.view === "thread" || state.view === "search" || state.view === "edit-profile") return "";
  if (state.view === "square") return squareSwitch();
  return `
    <header class="topbar">
      <button class="brand" type="button" data-act="open-menu">${esc(meName)}</button>
      <nav class="top-actions">
        <button type="button" data-act="search">搜索</button>
        <button type="button" data-act="share-profile">分享</button>
      </nav>
    </header>
    <section class="${state.view === "sent" ? "tabs sent" : "tabs"}">
      <button class="tab-pill" type="button" data-act="view" data-view="received">收到</button>
      <button class="tab-pill" type="button" data-act="view" data-view="sent">发出</button>
    </section>
  `;
}

function mainScreen() {
  const utilityView = state.view === "search" || state.view === "edit-profile";
  const personalActive = state.view !== "square" && state.view !== "profile" && state.view !== "thread" ? "active" : "";
  const squareActive = state.view === "square" || state.view === "profile" ? "active" : "";
  return `
    <section id="screen" class="screen ${utilityView ? "search-screen" : ""}">
      ${topContent()}
      ${feedContent()}
    </section>
    ${utilityView ? "" : `
    <nav class="bottom-nav" aria-label="底部导航">
      <button class="${personalActive}" type="button" data-act="view" data-view="received">个人</button>
      <button class="${squareActive}" type="button" data-act="view" data-view="square">广场</button>
      <button class="ask-tab" type="button" data-act="compose">提问</button>
    </nav>
    `}
    ${testSwitcher()}
  `;
}

function testSwitcher() {
  if (!TEST_MODE) return "";
  return `
    <section class="test-switcher" aria-label="LAN test account switcher">
      ${(state.testUsers || []).map(user => `
        <button class="${state.me?.id === user.id ? "active" : ""}" type="button" data-act="test-switch-user" data-user="${esc(user.id)}">${esc(user.nickname)}</button>
      `).join("")}
      <button class="danger" type="button" data-act="test-reset">重置</button>
    </section>
  `;
}

function sheet() {
  if (!state.composing) return "";
  return `
    <div class="sheet-backdrop ${state.sheetClosing ? "is-closing" : ""}">
      <section class="sheet">
        <div class="grab"></div>
        <div class="sheet-head">
          <h2>匿名提问</h2>
          <button class="close" type="button" data-act="close-sheet">×</button>
        </div>
        <div class="compose-box">
          <textarea class="textarea compose-text" maxlength="999" placeholder="写下你想问的任意问题...">${esc(state.draft)}</textarea>
          <div class="compose-tools">
            <button class="private-toggle ${state.privateQuestion ? "active" : ""}" type="button" data-act="toggle-private" aria-pressed="${state.privateQuestion}">设为私密</button>
          </div>
          <span class="question-length" aria-live="polite">${Math.min(state.draft.length, 999)}</span>
        </div>
        <div class="choose">选择发送对象（多选）</div>
        <div class="recipient-list">
          ${state.recipients.map(user => {
            const name = displayRecipientName(user);
            return `
            <button class="chip ${state.selectedRecipients.has(user.id) ? "active" : ""}" type="button" data-act="toggle-recipient" data-id="${user.id}" aria-pressed="${state.selectedRecipients.has(user.id)}">
              <span class="chip-label">${esc(name)}</span>
            </button>
          `;
          }).join("") || `<span style="color:#aaa;font-weight:800;">暂无已关注对象</span>`}
        </div>
        <div class="chips-progress" role="scrollbar" aria-orientation="horizontal" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" tabindex="0"><span></span></div>
        <button class="send" type="button" data-act="submit-question">发送</button>
      </section>
    </div>
  `;
}

function menu() {
  return `
    <aside class="menu ${state.menuOpen ? "open" : ""}">
      <button class="menu-close" type="button" data-act="close-menu">›</button>
      <div class="menu-brand">
        <div class="menu-logo">${esc(state.me?.loggedIn ? state.me.nickname : "未登录")}</div>
        ${state.me?.loggedIn ? `<button class="menu-small" type="button" data-act="edit-profile">修改</button>` : ""}
      </div>
      <nav class="menu-list">
        <button type="button" data-act="${state.me?.loggedIn ? "logout" : "login"}">${state.me?.loggedIn ? "退出登录" : "账号登录"}</button>
        <button type="button" data-act="export-data">数据导出</button>
        <button type="button" data-act="delete-account">删除账号</button>
        <button type="button" data-act="legal">隐私与协议</button>
        <button type="button" data-act="support">联系客服</button>
      </nav>
    </aside>
  `;
}

function initBottomRubberBand() {
  const screen = $("#screen");
  if (!screen || screen.dataset.rubberReady === "true") return;
  screen.dataset.rubberReady = "true";
  let startY = 0;
  let rubber = 0;

  const atBottom = () => screen.scrollTop + screen.clientHeight >= screen.scrollHeight - 2;
  const setRubber = value => {
    rubber = Math.max(0, value);
    screen.style.setProperty("--rubber-y", `${rubber}px`);
  };
  const release = () => {
    if (!rubber) return;
    screen.style.transition = "transform 620ms cubic-bezier(.12,.92,.18,1), filter 620ms cubic-bezier(.18,.88,.16,1)";
    setRubber(0);
    window.setTimeout(() => {
      screen.style.transition = "";
    }, 650);
  };
  const pullFrom = clientY => {
    const dragUp = startY - clientY;
    if (dragUp <= 6 || !atBottom()) return false;
    const max = screen.clientHeight / 2;
    const eased = max * (1 - Math.exp(-dragUp / (max * .62)));
    screen.style.transition = "none";
    setRubber(Math.min(max, eased));
    return true;
  };

  screen.addEventListener("touchstart", event => {
    if (event.touches.length !== 1) return;
    startY = event.touches[0].clientY;
  }, { passive: true });

  screen.addEventListener("touchmove", event => {
    if (event.touches.length !== 1) return;
    if (pullFrom(event.touches[0].clientY)) event.preventDefault();
  }, { passive: false });

  screen.addEventListener("touchend", release, { passive: true });
  screen.addEventListener("touchcancel", release, { passive: true });

  screen.addEventListener("wheel", event => {
    if (event.deltaY <= 0 || !atBottom()) return;
    const max = screen.clientHeight / 2;
    screen.style.transition = "none";
    setRubber(Math.min(max, rubber + event.deltaY * .42));
    event.preventDefault();
    clearTimeout(initBottomRubberBand.wheelTimer);
    initBottomRubberBand.wheelTimer = setTimeout(release, 120);
  }, { passive: false });
}

function render() {
  const app = $("#app");
  app.className = `app-shell${state.menuOpen ? " menu-open" : ""}`;
  app.innerHTML = `${mainScreen()}${sheet()}${menu()}`;
  initFusionBubbles();
  initRecipientScroller();
  initBottomRubberBand();
}

function renderFeedOnly() {
  const current = document.querySelector(".feed, .follow-list, .profile-panel, .search-page");
  if (!current) {
    render();
    return;
  }
  const template = document.createElement("template");
  template.innerHTML = feedContent().trim();
  const next = template.content.firstElementChild;
  if (next) current.replaceWith(next);
  initFusionBubbles();
  initBottomRubberBand();
}

function fusionBuildPath(lw, rw, h) {
  const outer = 10;
  const inner = 5;
  const fillet = 5;
  const joinX = lw;
  const right = lw + rw;
  const leftDent = joinX - (inner + fillet);
  const rightDent = joinX + (inner + fillet);
  const midLeft = leftDent + fillet;
  const midRight = rightDent - fillet;
  const d = [
    `M 0,${outer}`,
    `A ${outer},${outer} 0 0,1 ${outer},0`,
    `L ${leftDent},0`,
    `A ${fillet},${fillet} 0 0,1 ${midLeft},${fillet}`,
    `A ${inner},${inner} 0 0,0 ${midRight},${fillet}`,
    `A ${fillet},${fillet} 0 0,1 ${rightDent},0`,
    `L ${right - outer},0`,
    `A ${outer},${outer} 0 0,1 ${right},${outer}`,
    `L ${right},${h - outer}`,
    `A ${outer},${outer} 0 0,1 ${right - outer},${h}`,
    `L ${rightDent},${h}`,
    `A ${fillet},${fillet} 0 0,1 ${midRight},${h - fillet}`,
    `A ${inner},${inner} 0 0,0 ${midLeft},${h - fillet}`,
    `A ${fillet},${fillet} 0 0,1 ${leftDent},${h}`,
    `L ${outer},${h}`,
    `A ${outer},${outer} 0 0,1 0,${h - outer}`,
    "Z"
  ].join(" ");
  return { d, w: right, h };
}

function renderFusionBubble(wrap) {
  const svg = wrap.querySelector("svg");
  const left = wrap.querySelector(".fusion-left");
  const right = wrap.querySelector(".fusion-right");
  if (!svg || !left || !right) return;
  const lw = left.getBoundingClientRect().width;
  const rw = right.getBoundingClientRect().width;
  const h = Math.max(left.getBoundingClientRect().height, right.getBoundingClientRect().height);
  if (!lw || !rw || !h) return;
  const pathData = fusionBuildPath(lw, rw, h);
  svg.setAttribute("viewBox", `0 0 ${pathData.w} ${pathData.h}`);
  svg.removeAttribute("width");
  svg.removeAttribute("height");
  let path = svg.querySelector("path");
  if (!path) {
    path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    svg.appendChild(path);
  }
  path.setAttribute("d", pathData.d);
}

function initFusionBubbles() {
  document.querySelectorAll(".dir-fusion").forEach(renderFusionBubble);
}

function initRecipientScroller() {
  const list = document.querySelector(".recipient-list");
  const track = document.querySelector(".chips-progress");
  const thumb = track?.querySelector("span");
  if (!list || !track || !thumb) return;

  const sync = () => {
    const maxScroll = Math.max(list.scrollWidth - list.clientWidth, 0);
    const trackWidth = track.clientWidth;
    const thumbWidth = maxScroll ? Math.max(trackWidth * (list.clientWidth / list.scrollWidth), 36) : trackWidth;
    const maxThumbX = Math.max(trackWidth - thumbWidth, 0);
    const thumbX = maxScroll ? (list.scrollLeft / maxScroll) * maxThumbX : 0;
    thumb.style.width = `${thumbWidth}px`;
    thumb.style.transform = `translateX(${thumbX}px)`;
    track.setAttribute("aria-valuenow", String(maxScroll ? Math.round((list.scrollLeft / maxScroll) * 100) : 0));
    track.setAttribute("aria-disabled", String(!maxScroll));
    track.classList.toggle("is-disabled", !maxScroll);
  };

  const scrollFromThumbX = thumbLeft => {
    const rect = track.getBoundingClientRect();
    const maxScroll = Math.max(list.scrollWidth - list.clientWidth, 0);
    const thumbWidth = thumb.getBoundingClientRect().width;
    const maxThumbX = Math.max(rect.width - thumbWidth, 0);
    if (!maxScroll || !maxThumbX) return;
    const ratio = Math.min(Math.max(thumbLeft / maxThumbX, 0), 1);
    list.scrollLeft = ratio * maxScroll;
    sync();
  };

  let dragging = false;
  let dragOffset = 0;
  list.addEventListener("scroll", sync, { passive: true });
  track.addEventListener("pointerdown", event => {
    if (track.classList.contains("is-disabled")) return;
    const trackRect = track.getBoundingClientRect();
    const thumbRect = thumb.getBoundingClientRect();
    dragging = true;
    track.classList.add("is-dragging");
    track.setPointerCapture?.(event.pointerId);
    dragOffset = event.target === thumb ? event.clientX - thumbRect.left : thumbRect.width / 2;
    scrollFromThumbX(event.clientX - trackRect.left - dragOffset);
  });
  track.addEventListener("pointermove", event => {
    if (!dragging) return;
    const trackRect = track.getBoundingClientRect();
    scrollFromThumbX(event.clientX - trackRect.left - dragOffset);
  });
  track.addEventListener("pointerup", event => {
    dragging = false;
    track.classList.remove("is-dragging");
    track.releasePointerCapture?.(event.pointerId);
  });
  track.addEventListener("pointercancel", () => {
    dragging = false;
    track.classList.remove("is-dragging");
  });
  track.addEventListener("keydown", event => {
    const step = Math.max(list.clientWidth * .35, 48);
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      list.scrollLeft -= step;
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      list.scrollLeft += step;
    }
  });
  sync();
}

async function load() {
  const seq = ++loadSeq;
  const view = state.view;
  const squareMode = state.squareMode;
  const profileUserId = state.profileUserId;
  const me = await api.getMe();
  const testUsers = TEST_MODE && api.listTestUsers ? await api.listTestUsers() : [];
  let recipients = [];
  let following = [];
  let receivedThreads = [];
  let sentThreads = [];
  if (me.loggedIn) {
    [recipients, following, receivedThreads, sentThreads] = await Promise.all([
      api.listRecipients(),
      api.listFollowing ? api.listFollowing() : [],
      api.listThreads({ bucket: "received" }),
      api.listThreads({ bucket: "sent" })
    ]);
  }
  const recipientList = buildRecipientOptions({ recipients, following, receivedThreads, sentThreads });
  let profile = null;
  let threads = [];

  if (view === "profile" && profileUserId) {
    profile = await api.getProfile(profileUserId);
    threads = profile.threads;
    syncProfileDefaultOpen(threads);
  } else if (view === "square") {
    threads = squareMode === "square" ? await api.listThreads({ bucket: "square" }) : [];
    if (squareMode === "square") syncSocialDefaultOpen(threads, "square");
  } else if (!["search", "edit-profile", "edit-note"].includes(view) && me.loggedIn) {
    threads = view === "sent" ? sentThreads : receivedThreads;
    if (view === "received") {
      threads = sortReceivedThreads(threads, me.id);
      syncReceivedDefaultOpen(threads, me.id);
    } else if (view === "sent") {
      syncSentDefaultOpen(threads);
    }
  }

  if (seq !== loadSeq) return;
  state.me = me;
  state.testUsers = testUsers;
  state.recipients = recipientList.options;
  state.recipientActivity = recipientList.activity;
  state.following = following;
  state.profile = profile;
  state.threads = threads;
  [me, profile?.user, ...testUsers, ...recipients, ...following].forEach(rememberUserName);
  threads.forEach(rememberThreadUserNames);
  render();
}

async function loadWithFeedReorderAnimation() {
  const before = new Map();
  document.querySelectorAll(".feed .stamp-stack[data-thread-id]").forEach(stack => {
    before.set(stack.dataset.threadId, stack.getBoundingClientRect());
  });
  const scrollHost = $("#screen");
  const scrollTop = scrollHost?.scrollTop || 0;
  await load();
  const nextScrollHost = $("#screen");
  if (nextScrollHost) nextScrollHost.scrollTop = scrollTop;
  const afterStacks = Array.from(document.querySelectorAll(".feed .stamp-stack[data-thread-id]"));
  afterStacks.forEach(stack => {
    const oldRect = before.get(stack.dataset.threadId);
    const newRect = stack.getBoundingClientRect();
    const dy = oldRect ? oldRect.top - newRect.top : 18;
    if (Math.abs(dy) < 0.5 && oldRect) return;
    stack.style.transition = "none";
    stack.style.transform = `translate3d(0, ${dy}px, 0)`;
    if (!oldRect) stack.style.opacity = "0";
    stack.style.willChange = "transform, opacity";
    requestAnimationFrame(() => {
      stack.style.transition = "transform 520ms cubic-bezier(.2,.92,.16,1), opacity 260ms ease";
      stack.style.transform = "";
      stack.style.opacity = "";
      window.setTimeout(() => {
        stack.style.transition = "";
        stack.style.transform = "";
        stack.style.opacity = "";
        stack.style.willChange = "";
      }, 560);
    });
  });
}

function findThread(id) {
  return state.threads.find(thread => thread.id === id) || state.profile?.threads?.find(thread => thread.id === id) || (state.sharedThread?.id === id ? state.sharedThread : null);
}

function replaceThreadInList(list, thread) {
  if (!Array.isArray(list)) return false;
  const index = list.findIndex(item => item.id === thread.id);
  if (index < 0) return false;
  list[index] = thread;
  return true;
}

function replaceThreadInState(thread) {
  replaceThreadInList(state.threads, thread);
  replaceThreadInList(state.profile?.threads, thread);
  if (state.sharedThread?.id === thread.id) state.sharedThread = thread;
}

function stackMode(stack) {
  return stack?.dataset.mode || state.view;
}

function renderedThreadStack(thread, mode = state.view) {
  const template = document.createElement("template");
  template.innerHTML = threadCard(thread, mode).trim();
  return template.content.querySelector(".stamp-stack");
}

function stackBodyNodes(thread, mode = state.view) {
  const nextStack = renderedThreadStack(thread, mode);
  return nextStack ? Array.from(nextStack.children).slice(1) : [];
}

function syncQuestionCard(stack, thread, mode = stackMode(stack)) {
  const current = stack?.querySelector(".stamp:not(.reply)");
  const next = renderedThreadStack(thread, mode)?.querySelector(".stamp:not(.reply)");
  if (current && next) current.innerHTML = next.innerHTML;
}

function syncAnswerCard(stack, thread, mode = stackMode(stack)) {
  const current = stack?.querySelector(".stamp.reply");
  const next = renderedThreadStack(thread, mode)?.querySelector(".stamp.reply");
  if (current && next) {
    const acting = current.classList.contains("is-acting");
    current.className = next.className;
    if (acting) current.classList.add("is-acting");
    current.innerHTML = next.innerHTML;
    current.dataset.id = next.dataset.id;
    current.dataset.cardAct = next.dataset.cardAct;
  }
}

function syncSubRepliesCard(stack, thread, mode = stackMode(stack)) {
  const current = stack?.querySelector(".sub-replies");
  const next = renderedThreadStack(thread, mode)?.querySelector(".sub-replies");
  if (!current || !next) return;
  const acting = current.classList.contains("is-acting");
  current.className = next.className;
  if (acting) current.classList.add("is-acting");
  current.innerHTML = next.innerHTML;
  current.dataset.id = next.dataset.id;
  current.dataset.cardAct = next.dataset.cardAct;
}

function measureSubRepliesTarget(stack, thread, mode = stackMode(stack)) {
  const current = stack?.querySelector(".sub-replies");
  const next = renderedThreadStack(thread, mode)?.querySelector(".sub-replies");
  if (!current || !next) return current?.getBoundingClientRect().height || 0;
  const clone = next.cloneNode(true);
  const rect = current.getBoundingClientRect();
  clone.style.position = "absolute";
  clone.style.visibility = "hidden";
  clone.style.pointerEvents = "none";
  clone.style.left = "-9999px";
  clone.style.top = "0";
  clone.style.width = `${rect.width}px`;
  clone.style.height = "auto";
  clone.classList.remove("is-resizing");
  document.body.appendChild(clone);
  const height = clone.getBoundingClientRect().height;
  clone.remove();
  return height;
}

function clearStackBody(stack) {
  stack?.querySelectorAll(":scope > .stamp.reply, :scope > .sub-replies").forEach(node => node.remove());
}

function clearStackRevealClasses(stack) {
  stack?.classList.remove("is-collapsing", "is-revealing-open", "is-revealing-replies", "is-sub-replies-resizing");
}

function animateFollowingStacks(anchorStack, mutation) {
  const stacks = Array.from(document.querySelectorAll(".screen .stamp-stack"));
  const startIndex = stacks.indexOf(anchorStack);
  if (startIndex < 0) {
    if (mutation) mutation();
    return;
  }
  const following = stacks.slice(startIndex + 1);
  const firstRects = following.map(el => el.getBoundingClientRect());
  if (mutation) mutation();
  following.forEach((el, index) => {
    const dy = firstRects[index].top - el.getBoundingClientRect().top;
    if (Math.abs(dy) < 0.5) return;
    el.style.transition = "none";
    el.style.transform = `translate3d(0, ${dy}px, 0)`;
    el.style.willChange = "transform";
    requestAnimationFrame(() => {
      el.style.transition = "transform 430ms cubic-bezier(.2,.92,.16,1)";
      el.style.transform = "";
      window.setTimeout(() => {
        el.style.transition = "";
        el.style.transform = "";
        el.style.willChange = "";
      }, 460);
    });
  });
}

function resizeSubReplies(stack, id, mutation) {
  const item = findThread(id);
  const mode = stackMode(stack);
  const sub = stack?.querySelector(".sub-replies");
  if (!stack || !item || !sub) {
    if (mutation) mutation();
    return;
  }
  const start = sub.getBoundingClientRect().height;
  const wasExpanded = !sub.classList.contains("is-collapsed");
  if (mutation) mutation();
  const end = measureSubRepliesTarget(stack, item, mode);
  const nextCollapsed = visibleReplyCount(id, mode) === 0;
  const collapsing = nextCollapsed && wasExpanded;
  const expanding = !nextCollapsed && !wasExpanded;
  stack.classList.add("is-sub-replies-resizing");
  sub.style.height = `${start}px`;
  sub.style.minHeight = "0px";
  sub.style.overflow = "hidden";
  if (!collapsing) {
    syncSubRepliesCard(stack, item, mode);
  }
  const nextSub = stack.querySelector(".sub-replies");
  if (!nextSub) return;
  nextSub.style.height = `${start}px`;
  nextSub.style.minHeight = "0px";
  nextSub.style.overflow = "hidden";
  nextSub.classList.add("is-resizing");
  if (expanding) {
    nextSub.style.padding = "10px 14px";
  }
  if (collapsing) {
    nextSub.style.padding = "18px 15px 14px";
    nextSub.classList.add("is-collapsing-content");
  }
  nextSub.getBoundingClientRect();
  requestAnimationFrame(() => {
    if (expanding) {
      nextSub.style.padding = "18px 15px 14px";
    }
    if (collapsing) {
      nextSub.style.padding = "10px 14px";
    }
    nextSub.style.height = `${end}px`;
    window.setTimeout(() => {
      if (collapsing) {
        syncSubRepliesCard(stack, item, mode);
      }
      nextSub.style.transition = "none";
      nextSub.style.height = "";
      nextSub.style.minHeight = "";
      nextSub.style.padding = "";
      nextSub.style.overflow = "";
      nextSub.classList.remove("is-resizing");
      nextSub.classList.remove("is-collapsing-content");
      stack.classList.remove("is-sub-replies-resizing");
      nextSub.offsetHeight;
      nextSub.style.transition = "";
    }, 460);
  });
}

function syncStackBody(stack, id, kind = "open") {
  const item = findThread(id);
  const mode = stackMode(stack);
  if (!stack || !item) return;
  animateFollowingStacks(stack, () => {
    syncQuestionCard(stack, item, mode);
    clearStackBody(stack);
    stackBodyNodes(item, mode).forEach(node => stack.appendChild(node));
    stack.classList.add("is-open", `is-revealing-${kind}`);
  });
  clearTimeout(revealTimer);
  revealTimer = setTimeout(() => clearStackRevealClasses(stack), kind === "open" ? 340 : 520);
}

function syncAnswerStackBody(stack, id) {
  const item = findThread(id);
  const mode = stackMode(stack);
  if (!stack || !item) return;
  animateFollowingStacks(stack, () => {
    syncAnswerCard(stack, item, mode);
    syncSubRepliesCard(stack, item, mode);
    stack.classList.add("is-open", "is-revealing-replies");
  });
  clearTimeout(revealTimer);
  revealTimer = setTimeout(() => clearStackRevealClasses(stack), 520);
}

function collapseStackBody(stack, id) {
  if (!stack) return;
  const item = findThread(id);
  const mode = stackMode(stack);
  if (!item) return;
  setThreadOpen(id, mode, false);
  setVisibleReplyCount(id, mode, 0);
  clearTimeout(revealTimer);
  animateFollowingStacks(stack, () => {
    stack.classList.remove("is-open", "is-revealing-open", "is-revealing-replies");
    syncQuestionCard(stack, item, mode);
    clearStackBody(stack);
    clearStackRevealClasses(stack);
  });
}

function motionKey(card) {
  if (!card?.dataset?.id) return "";
  if (card.classList.contains("reply")) return `${card.dataset.id}:answer`;
  if (card.classList.contains("sub-replies")) return `${card.dataset.id}:replies`;
  return `${card.dataset.id}:question`;
}

function motionSource(source) {
  return source?.closest?.(".stamp, .sub-replies") || source;
}

function runCardMotion(source, afterLift, releaseDelay = 230) {
  const card = motionSource(source);
  clearTimeout(cardMotionTimer);
  state.acting = motionKey(card);
  if (card) {
    card.classList.remove("is-acting");
    card.offsetHeight;
    card.classList.add("is-acting");
  }
  cardMotionTimer = setTimeout(async () => {
    if (afterLift) await afterLift();
    cardMotionTimer = setTimeout(() => {
      state.acting = "";
      document.querySelectorAll(".is-acting").forEach(el => el.classList.remove("is-acting"));
    }, releaseDelay);
  }, 110);
}

function mutateWithCardMotion(source, mutation, releaseDelay = 230) {
  if (mutation) mutation();
}

function clearViewSwitchTimers() {
  viewSwitchTimers.forEach(timer => clearTimeout(timer));
  viewSwitchTimers = [];
}

function queueViewSwitchTimer(callback, delay) {
  const timer = setTimeout(() => {
    viewSwitchTimers = viewSwitchTimers.filter(item => item !== timer);
    callback();
  }, delay);
  viewSwitchTimers.push(timer);
}

function switchPersonalView(nextView, button) {
  const tabs = button?.closest(".tabs");
  clearViewSwitchTimers();
  loadSeq += 1;
  const seq = loadSeq;
  const visualView = tabs?.classList.contains("sent") ? "sent" : "received";
  if (!tabs) {
    state.view = nextView;
    state.profileUserId = "";
    load();
    return;
  }
  if (visualView === nextView && state.view === nextView) {
    runCardMotion(button);
    return;
  }
  const pills = tabs?.querySelectorAll(".tab-pill") || [];
  pills.forEach(pill => pill.classList.add("is-switching"));
  button?.classList.add("is-pressing");
  tabs.classList.toggle("sent", nextView === "sent");

  queueViewSwitchTimer(() => {
    button?.classList.remove("is-pressing");
  }, 120);

  queueViewSwitchTimer(async () => {
    const me = await api.getMe();
    let threads = me.loggedIn ? await api.listThreads({ bucket: nextView }) : [];
    if (seq !== loadSeq) return;
    if (nextView === "received") {
      threads = sortReceivedThreads(threads, me.id);
      syncReceivedDefaultOpen(threads, me.id);
    }
    if (nextView === "sent") syncSentDefaultOpen(threads);
    state.me = me;
    state.view = nextView;
    state.profileUserId = "";
    state.profile = null;
    state.threads = threads;
    rememberUserName(me);
    threads.forEach(rememberThreadUserNames);
    renderFeedOnly();
  }, 120);

  queueViewSwitchTimer(() => {
    pills.forEach(pill => pill.classList.remove("is-switching", "is-pressing"));
  }, 680);
}

function closeSheetAnimated() {
  if (!state.composing) {
    removeActiveSheet();
    return;
  }
  state.sheetClosing = true;
  render();
  setTimeout(() => {
    state.composing = false;
    state.draft = "";
    state.privateQuestion = false;
    state.sheetClosing = false;
    render();
  }, 220);
}

function removeActiveSheet() {
  document.querySelector(".sheet-backdrop")?.remove();
}

function sizeNoteInput(input) {
  if (!input) return;
  renderFusionBubble(input.closest(".dir-fusion"));
}

function startInlineNoteEdit(button) {
  if (!button || !state.me?.loggedIn) return;
  const userId = button.dataset.noteUser;
  const user = state.following.find(item => item.id === userId);
  if (!user) return;
  const input = document.createElement("input");
  input.className = "fusion-right fusion-note-input";
  input.type = "text";
  input.maxLength = 40;
  input.value = user.remarkName || "";
  input.placeholder = "  ";
  let finished = false;
  const finish = async save => {
    if (finished) return;
    finished = true;
    const value = input.value.trim();
    if (save) {
      await api.updateFollowRemark(userId, value);
      user.remarkName = value;
    }
    const next = document.createElement("button");
    next.className = `fusion-right ${user.remarkName ? "" : "is-empty"}`;
    next.type = "button";
    next.dataset.noteUser = userId;
    next.innerHTML = user.remarkName ? esc(user.remarkName) : "&nbsp;&nbsp;";
    input.replaceWith(next);
    renderFusionBubble(next.closest(".dir-fusion"));
  };
  input.addEventListener("blur", () => finish(true));
  input.addEventListener("input", () => sizeNoteInput(input));
  input.addEventListener("keydown", event => {
    if (event.key === "Enter") {
      event.preventDefault();
      input.blur();
    }
    if (event.key === "Escape") {
      event.preventDefault();
      finish(false);
    }
  });
  button.replaceWith(input);
  sizeNoteInput(input);
  input.focus();
  input.select();
}

async function submitQuestion() {
  const text = $(".textarea")?.value.trim();
  if (!text) return toast("先写一个问题");
  if (!state.selectedRecipients.size) return toast("至少选择一个发送对象");
  try {
    await api.createQuestion({
      text,
      targetUserIds: [...state.selectedRecipients],
      visibility: state.privateQuestion ? "private" : "public"
    });
    state.composing = false;
    state.privateQuestion = false;
    state.draft = "";
    state.view = "sent";
    await load();
    toast("已发送");
  } catch (err) {
    toast(err.message === "login-required" ? "请先登录" : "只能发送给已关注对象");
  }
}

async function submitAnswer(threadId = "", modeOverride = "") {
  const text = ($(".inline-answer")?.value ?? state.draft ?? "").trim();
  const id = threadId || state.answeringId;
  if (!id) return toast("没有找到要修改的回答");
  const mode = modeOverride || state.view;
  const stack = document.querySelector(`.stamp-stack[data-thread-id="${CSS.escape(id)}"][data-mode="${CSS.escape(mode)}"]`);
  if (!text) {
    state.answeringId = "";
    state.draft = "";
    const thread = findThread(id);
    if (stack && thread) {
      syncAnswerCard(stack, thread, mode);
      syncSubRepliesCard(stack, thread, mode);
    } else {
      render();
    }
    return;
  }
  const updated = await api.upsertAnswer(id, text);
  replaceThreadInState(updated);
  state.answeringId = "";
  state.draft = "";
  removeActiveSheet();
  setThreadOpen(id, mode, true);
  if (mode === "profile" || mode === "square") {
    setVisibleReplyCount(id, mode, profileReplyItems(updated, mode, socialCardOwnerId(updated, mode)).length);
  } else {
    setVisibleReplyCount(id, mode, mode === "received" ? 0 : defaultReplyCount(updated, mode));
  }
  if (mode === "received") {
    await loadWithFeedReorderAnimation();
    toast("回答完成");
    return;
  }
  if (stack) {
    syncStackBody(stack, id, "replies");
  } else {
    render();
  }
  toast("回答完成");
}

document.addEventListener("input", event => {
  if (event.target.matches(".textarea")) {
    state.draft = event.target.value.slice(0, 999);
    if (event.target.value !== state.draft) event.target.value = state.draft;
    const lengthCounter = event.target.closest(".compose-box")?.querySelector(".question-length");
    if (lengthCounter) lengthCounter.textContent = `${state.draft.length}`;
  }
  if (event.target.matches(".inline-answer")) {
    state.draft = event.target.value.slice(0, 200);
  }
  if (event.target.matches(".reply-textarea")) {
    state.replyDraft = event.target.value.slice(0, 200);
  }
  if (event.target.matches("#searchPanelInput")) {
    state.searchQuery = event.target.value.slice(0, 120);
  }
  if (event.target.matches("#editProfileInput")) {
    state.nicknameDraft = event.target.value.slice(0, 24);
  }
  if (event.target.matches("#editNoteInput")) {
    state.noteValue = event.target.value.slice(0, 40);
  }
});

document.addEventListener("click", async event => {
  if (event.target.classList?.contains("sheet-backdrop")) {
    closeSheetAnimated();
    return;
  }
  const noteTarget = event.target.closest("[data-note-user]");
  if (noteTarget) {
    event.preventDefault();
    event.stopPropagation();
    noteTap = { userId: "", time: 0 };
    startInlineNoteEdit(noteTarget);
    return;
  }
  const direct = event.target.closest("[data-act]");
  const card = !direct ? event.target.closest("[data-card-act]") : null;
  if (card) {
    const id = card.dataset.id;
    const action = card.dataset.cardAct;
    const stack = card.closest(".stamp-stack");
    const mode = stackMode(stack);
    if (action === "toggle-question") {
      const thread = findThread(id);
      if (shouldKeepReceivedAnswerOpen(thread, mode)) {
        if (!isThreadOpen(id, mode)) {
          setThreadOpen(id, mode, true);
          setVisibleReplyCount(id, mode, 0);
          syncStackBody(stack, id, "open");
        } else {
          runCardMotion(card);
        }
        return;
      }
      const isOpen = isThreadOpen(id, mode);
      mutateWithCardMotion(card, () => {
        if (isOpen) {
          collapseStackBody(stack, id);
        } else {
          setThreadOpen(id, mode, true);
          setVisibleReplyCount(id, mode, defaultReplyCount(thread, mode));
          syncStackBody(stack, id, "open");
        }
      }, isOpen ? 140 : 230);
    }
    if (action === "toggle-answer") {
      const current = visibleReplyCount(id, mode);
      const total = replyItems(findThread(id), mode).length;
      resizeSubReplies(stack, id, () => {
        setVisibleReplyCount(id, mode, current ? 0 : Math.min(1, total));
      });
    }
    if ((action === "card-feedback" || action === "feedback") && !card.classList.contains("reply") && !card.classList.contains("sub-replies")) {
      runCardMotion(card);
    }
    return;
  }

  const btn = direct;
  if (!btn) return;
  const act = btn.dataset.act;
  const id = btn.dataset.id;

  if (act === "view") {
    if ((btn.dataset.view === "received" || btn.dataset.view === "sent") && btn.classList.contains("tab-pill")) {
      switchPersonalView(btn.dataset.view, btn);
      return;
    }
    state.view = btn.dataset.view;
    if (state.view === "square") state.squareMode = "square";
    state.profileUserId = "";
    state.profile = null;
    state.threads = [];
    render();
    await load();
  }
  if (act === "square-mode") {
    state.view = "square";
    state.squareMode = btn.dataset.mode;
    state.profileUserId = "";
    await load();
  }
  if (act === "open-profile") {
    state.returnView = state.view;
    state.returnSquareMode = state.squareMode;
    state.view = "profile";
    state.profileUserId = btn.dataset.user;
    state.searchQuery = "";
    await load();
  }
  if (act === "profile-back") {
    state.view = state.returnView || "square";
    state.squareMode = state.returnSquareMode || "list";
    state.profileUserId = "";
    await load();
  }
  if (act === "thread-back") {
    state.view = state.returnView || "square";
    state.squareMode = state.returnSquareMode || "square";
    state.sharedThread = null;
    await load();
  }
  if (act === "toggle-follow") {
    if (!state.me?.loggedIn) return toast("请先登录");
    const userId = btn.dataset.user;
    const followed = state.profile?.followed;
    followed ? await api.unfollowUser(userId) : await api.followUser(userId);
    await load();
    toast(followed ? "已取消关注" : "已关注");
  }
  if (act === "open-menu") {
    state.menuOpen = true;
    $("#app")?.classList.add("menu-open");
    $(".menu")?.classList.add("open");
  }
  if (act === "close-menu") {
    state.menuOpen = false;
    $("#app")?.classList.remove("menu-open");
    $(".menu")?.classList.remove("open");
  }
  if (act === "compose") {
    if (!state.me?.loggedIn) return toast("请先登录");
    state.composing = true;
    state.sheetClosing = false;
    state.selectedRecipients = new Set(state.recipients[0] ? [state.recipients[0].id] : []);
    state.draft = "";
    render();
    $(".textarea")?.focus();
  }
  if (act === "toggle-recipient") {
    state.selectedRecipients.has(id) ? state.selectedRecipients.delete(id) : state.selectedRecipients.add(id);
    btn.classList.toggle("active", state.selectedRecipients.has(id));
    btn.setAttribute("aria-pressed", String(state.selectedRecipients.has(id)));
  }
  if (act === "toggle-private") {
    state.privateQuestion = !state.privateQuestion;
    btn.classList.toggle("active", state.privateQuestion);
    btn.setAttribute("aria-pressed", String(state.privateQuestion));
  }
  if (act === "edit-note") {
    if (!state.me?.loggedIn) return toast("请先登录");
    const userId = btn.dataset.user;
    const user = state.following.find(item => item.id === userId);
    state.previousView = state.view;
    state.previousSquareMode = state.squareMode;
    state.noteUserId = userId;
    state.noteValue = user?.remarkName || "";
    state.view = "edit-note";
    render();
    setTimeout(() => $("#editNoteInput")?.focus(), 30);
  }
  if (act === "edit-note-back") {
    state.noteUserId = "";
    state.noteValue = "";
    state.view = state.previousView || "square";
    state.squareMode = state.previousSquareMode || "list";
    await load();
  }
  if (act === "edit-note-confirm") {
    if (!state.me?.loggedIn) return toast("请先登录");
    const userId = btn.dataset.user;
    await api.updateFollowRemark(userId, ($("#editNoteInput")?.value || state.noteValue).trim());
    state.noteUserId = "";
    state.noteValue = "";
    state.view = state.previousView || "square";
    state.squareMode = state.previousSquareMode || "list";
    await load();
    toast("备注已保存");
  }
  if (act === "answer") {
    if (!state.me?.loggedIn) return toast("请先登录");
    const thread = findThread(id);
    if (currentAnswer(thread)?.text && !canEditAnswer(thread)) return toast("只能修改一次");
    state.answeringId = id;
    const stack = btn.closest(".stamp-stack");
    const mode = stackMode(stack);
    setThreadOpen(id, mode, true);
    state.draft = currentAnswer(thread)?.text || "";
    if (stack && thread) {
      syncAnswerCard(stack, thread, mode);
      syncSubRepliesCard(stack, thread, mode);
      stack.classList.add("is-open");
      stack.querySelector(".inline-answer")?.focus();
    } else {
      render();
      $(".inline-answer")?.focus();
    }
  }
  if (act === "submit-inline-answer") {
    await submitAnswer(id, stackMode(btn.closest(".stamp-stack")));
  }
  if (act === "submit-question") await submitQuestion();
  if (act === "close-sheet") {
    closeSheetAnimated();
  }
  if (act === "delete-thread") {
    if (state.view !== "sent") return;
    if (confirm("确定删除这条发出的问题吗？")) {
      await api.deleteThread(id);
      state.expanded.delete(threadKey(id, "sent"));
      await load();
      toast("已删除");
    }
    return;
  }

  if (act === "delete-answer") {
    try {
      await api.deleteAnswer(id);
      await load();
      toast("卡片已删除");
    } catch {
      toast("删除失败");
    }
  }
  if (act === "expand-replies") {
    const stack = btn.closest(".stamp-stack");
    const mode = stackMode(stack);
    const thread = findThread(id);
    if (mode === "sent") {
      setVisibleReplyCount(id, mode, sentAnswerItems(thread).length || 1);
      syncAnswerCard(stack, thread, mode);
      return;
    }
    if (mode === "profile") {
      resizeSubReplies(stack, id, () => {
        setVisibleReplyCount(id, mode, profileReplyItems(thread, mode, socialCardOwnerId(thread, mode)).length);
      });
      return;
    }
    if (mode === "square") {
      resizeSubReplies(stack, id, () => {
        setVisibleReplyCount(id, mode, profileReplyItems(thread, mode, socialCardOwnerId(thread, mode)).length);
      });
      return;
    }
    const reveal = () => resizeSubReplies(stack, id, () => {
      setVisibleReplyCount(id, mode, Math.min(visibleReplyCount(id, mode) + 3, replyItems(thread, mode).length));
    });
    reveal();
  }
  if (act === "collapse-replies") {
    const stack = btn.closest(".stamp-stack");
    const mode = stackMode(stack);
    if (mode === "sent") {
      setVisibleReplyCount(id, mode, 1);
      syncAnswerCard(stack, findThread(id), mode);
      return;
    }
    resizeSubReplies(stack, id, () => {
      setVisibleReplyCount(id, mode, 0);
    });
  }
  if (act === "reply-thread") {
    if (!state.me?.loggedIn) return toast("请先登录");
    const sub = btn.closest(".sub-replies");
    const stack = btn.closest(".stamp-stack");
    const mode = stackMode(stack);
    if (!sub) return;
    if (sub.querySelector(".reply-textarea")) {
      sub.querySelector(".reply-textarea").focus();
      return;
    }
    if (sub.classList.contains("is-collapsed")) {
      const thread = findThread(id);
      const total = (mode === "profile" || mode === "square")
        ? profileReplyItems(thread, mode, socialCardOwnerId(thread, mode)).length
        : replyItems(thread, mode).length;
      setVisibleReplyCount(id, mode, Math.min(3, total));
      syncSubRepliesCard(stack, thread, mode);
      sub.classList.remove("is-collapsed");
    }
    state.replyDraft = "";
    const content = sub.querySelector(".sub-replies-content") || sub;
    content.innerHTML = `
      <textarea class="reply-textarea" maxlength="200" placeholder="写下你的评论..."></textarea>
      <button class="stamp-action action-right" type="button" data-act="finish-reply" data-id="${id}">完</button>
    `;
    setTimeout(() => sub.querySelector(".reply-textarea")?.focus(), 40);
  }
  if (act === "finish-reply") {
    const sub = btn.closest(".sub-replies");
    const stack = btn.closest(".stamp-stack");
    const mode = stackMode(stack);
    const text = sub?.querySelector(".reply-textarea")?.value.trim();
    if (!text) return toast("先写下评论");
    try {
      const updated = await api.createReply(id, text);
      replaceThreadInState(updated);
      const visibleTotal = (mode === "profile" || mode === "square")
        ? profileReplyItems(updated, mode, socialCardOwnerId(updated, mode)).length
        : (updated.replies?.length || 0);
      setVisibleReplyCount(id, mode, visibleTotal);
      state.replyDraft = "";
      if (mode === "profile" || mode === "square") {
        if (stack) syncSubRepliesCard(stack, updated, mode);
      } else {
        await load();
      }
      toast("回复完成");
    } catch {
      toast("请先登录");
    }
  }
  if (act === "reply-person") {
    const userId = btn.dataset.user;
    if (!userId || userId === "system" || userId === "anonymous") return toast("这条回复没有公开主页");
    state.returnView = state.view;
    state.returnSquareMode = state.squareMode;
    state.view = "profile";
    state.profileUserId = userId;
    state.searchQuery = "";
    await load();
  }
  if (act === "share-thread") {
    await navigator.clipboard?.writeText(api.createShare("thread", id));
    toast("问答链接已复制");
  }
  if (act === "share-profile") {
    if (!state.me?.loggedIn) return toast("请先登录");
    const profileId = state.view === "profile" ? state.profileUserId : state.me.id;
    await navigator.clipboard?.writeText(api.createShare("profile", profileId));
    toast("主页链接已复制");
  }
  if (act === "search") {
    state.previousView = state.view;
    state.previousSquareMode = state.squareMode;
    state.searchQuery = "";
    state.view = "search";
    render();
    setTimeout(() => $("#searchPanelInput")?.focus(), 30);
  }
  if (act === "search-back") {
    state.searchQuery = "";
    state.view = state.previousView || "received";
    state.squareMode = state.previousSquareMode || state.squareMode;
    await load();
  }
  if (act === "search-confirm") {
    const value = ($("#searchPanelInput")?.value || state.searchQuery).trim();
    if (!value) return toast("先输入搜索内容");
    if (state.previousView === "profile") {
      state.searchQuery = value;
      state.view = "profile";
      await load();
      return;
    }
    const share = api.resolveShare(value);
    if (share?.type === "profile") {
      state.view = "profile";
      state.profileUserId = share.id;
      state.searchQuery = "";
      await load();
    } else if (share?.type === "thread") {
      try {
        state.sharedThread = await api.getThread(share.id);
      } catch {
        state.sharedThread = null;
      }
      state.returnView = state.previousView || "square";
      state.returnSquareMode = state.previousSquareMode || "square";
      state.view = "thread";
      state.searchQuery = "";
      render();
    } else {
      state.searchQuery = value;
      state.view = state.previousView || "received";
      state.squareMode = state.previousSquareMode || state.squareMode;
      await load();
    }
  }
  if (act === "login") {
    await api.login();
    state.menuOpen = false;
    await load();
    toast("已登录");
  }
  if (act === "logout") {
    await api.logout();
    state.view = "received";
    state.menuOpen = false;
    await load();
    toast("已退出登录");
  }
  if (act === "export-data") {
    if (!state.me?.loggedIn) return toast("????");
    const doc = await api.exportData();
    downloadTextFile(doc);
    state.menuOpen = false;
    render();
    toast("???????");
  }
  if (act === "report") {
    await api.reportThread(id, "用户举报");
    toast("已举报");
  }
  if (act === "block-user") toast("屏蔽入口已预留");
  if (act === "delete-account") {
    if (!state.me?.loggedIn) return toast("请先登录");
    await api.deleteAccount();
    state.menuOpen = false;
    await load();
    toast("账号已删除");
  }
  if (act === "legal") toast("隐私政策与用户协议入口已预留");
  if (act === "support") toast("客服邮箱：support@example.com");
  if (act === "edit-profile") {
    if (!state.me?.loggedIn) return toast("请先登录");
    state.previousView = state.view;
    state.previousSquareMode = state.squareMode;
    state.nicknameDraft = "";
    state.menuOpen = false;
    state.view = "edit-profile";
    render();
    setTimeout(() => $("#editProfileInput")?.focus(), 30);
  }
  if (act === "edit-profile-back") {
    state.nicknameDraft = "";
    state.view = state.previousView || "received";
    state.squareMode = state.previousSquareMode || state.squareMode;
    await load();
  }
  if (act === "edit-profile-confirm") {
    if (!state.me?.loggedIn) return toast("请先登录");
    const input = $("#editProfileInput");
    const nickname = (input ? input.value : state.nicknameDraft).trim();
    if (!nickname) return toast("昵称不能为空");
    await api.updateMe({ nickname });
    state.nicknameDraft = "";
    state.view = state.previousView || "received";
    state.squareMode = state.previousSquareMode || state.squareMode;
    await load();
    toast("昵称已修改");
  }
  if (act === "test-switch-user") {
    if (!TEST_MODE || !api.switchTestUser) return;
    await api.switchTestUser(btn.dataset.user);
    state.menuOpen = false;
    state.view = "received";
    state.squareMode = "square";
    await load();
    toast("测试账号已切换");
  }
  if (act === "test-reset") {
    if (!TEST_MODE || !api.resetTestData) return;
    await api.resetTestData();
    state.expanded.clear();
    state.visibleReplies = {};
    await load();
    toast("测试数据已重置");
  }
});

load();
