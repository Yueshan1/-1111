// lanApi is only for same-Wi-Fi multi-device testing.
// It talks to test-server/lan-mock-server.mjs and keeps the selected test
// account in the browser, so four devices can use four different accounts.

const apiPort = import.meta.env?.VITE_LAN_API_PORT || "8787";
const apiBase = (
  import.meta.env?.VITE_LAN_API_URL ||
  `${window.location.protocol}//${window.location.hostname}:${apiPort}`
).replace(/\/$/, "");

const userKey = "question-box-lan-current-user-id";
const loggedOutValue = "__logged_out__";

function currentUserId() {
  const value = localStorage.getItem(userKey);
  if (value === loggedOutValue) return "";
  return value || "u_vv";
}

function setCurrentUserId(userId) {
  if (userId) localStorage.setItem(userKey, userId);
  else localStorage.setItem(userKey, loggedOutValue);
}

async function request(path, options = {}) {
  const response = await fetch(`${apiBase}${path}`, {
    ...options,
    headers: {
      "content-type": "application/json",
      "x-user-id": currentUserId(),
      ...(options.headers || {})
    }
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || `LAN API ${response.status}`);
  }
  return payload;
}

function body(data) {
  return JSON.stringify(data || {});
}

export const lanApi = {
  async getMe() {
    return request("/me");
  },

  async updateMe(input = {}) {
    return request("/me", {
      method: "PATCH",
      body: body({ nickname: input.nickname })
    });
  },

  async login(email = "vv@example.com") {
    const result = await request("/auth/login", {
      method: "POST",
      body: body({ email })
    });
    setCurrentUserId(result.id);
    return result;
  },

  async logout() {
    setCurrentUserId("");
    return { loggedIn: false };
  },

  async listRecipients() {
    return request("/recipients");
  },

  async listFollowing() {
    return request("/following");
  },

  async listThreads(params = {}) {
    const search = new URLSearchParams();
    if (params.bucket) search.set("bucket", params.bucket);
    if (params.query) search.set("query", params.query);
    return request(`/threads?${search.toString()}`);
  },

  async getProfile(userId) {
    return request(`/users/${encodeURIComponent(userId)}/home`);
  },

  async getThread(idOrTraceCode) {
    return request(`/threads/${encodeURIComponent(idOrTraceCode)}`);
  },

  async createQuestion(data) {
    return request("/questions", {
      method: "POST",
      body: body(data)
    });
  },

  async deleteThread(input) {
    const threadId = typeof input === "object" ? input.threadId : input;
    return request(`/threads/${encodeURIComponent(threadId)}`, { method: "DELETE" });
  },

  async upsertAnswer(input, maybeText) {
    const threadId = typeof input === "object" ? input.threadId : input;
    const text = typeof input === "object" ? input.text : maybeText;
    return request(`/threads/${encodeURIComponent(threadId)}/answer`, {
      method: "POST",
      body: body({ text })
    });
  },

  async deleteAnswer(input) {
    const threadId = typeof input === "object" ? input.threadId : input;
    return request(`/threads/${encodeURIComponent(threadId)}/answer`, {
      method: "DELETE"
    });
  },

  async createReply(input, maybeText) {
    const threadId = typeof input === "object" ? input.threadId : input;
    const text = typeof input === "object" ? input.text : maybeText;
    return request(`/threads/${encodeURIComponent(threadId)}/replies`, {
      method: "POST",
      body: body({ text })
    });
  },

  async followUser(input) {
    const userId = typeof input === "object" ? input.userId : input;
    return request(`/follows/${encodeURIComponent(userId)}`, { method: "POST" });
  },

  async unfollowUser(input) {
    const userId = typeof input === "object" ? input.userId : input;
    return request(`/follows/${encodeURIComponent(userId)}`, { method: "DELETE" });
  },

  async updateFollowRemark(input, maybeRemarkName) {
    const userId = typeof input === "object" ? input.userId : input;
    const remarkName = typeof input === "object" ? input.remarkName : maybeRemarkName;
    return request(`/follows/${encodeURIComponent(userId)}/remark`, {
      method: "PATCH",
      body: body({ remarkName })
    });
  },

  async reportThread(input, maybeReason) {
    const threadId = typeof input === "object" ? input.threadId : input;
    const reason = typeof input === "object" ? input.reason : maybeReason;
    return request(`/threads/${encodeURIComponent(threadId)}/reports`, {
      method: "POST",
      body: body({ reason })
    });
  },

  async blockUser(input) {
    const userId = typeof input === "object" ? input.userId : input;
    return request(`/blocks/${encodeURIComponent(userId)}`, { method: "POST" });
  },

  async deleteAccount() {
    return request("/me", { method: "DELETE" });
  },

  async exportData() {
    return request("/exports", { method: "POST" });
  },

  /** @deprecated Data import has been removed from the product. Kept only for legacy callers. */
  async importData() {
    console.warn("[question-box] importData() is deprecated and disabled. Exported Markdown documents cannot be imported.");
    throw new Error("data-import-disabled");
  },

  async listTestUsers() {
    return request("/test/users");
  },

  async switchTestUser(userId) {
    const result = await request("/test/switch-user", {
      method: "POST",
      body: body({ userId })
    });
    setCurrentUserId(result.id);
    return result;
  },

  async resetTestData() {
    return request("/test/reset", { method: "POST" });
  },

  createShare(type, id) {
    return `qb://share/${type}/${encodeURIComponent(id)}`;
  },

  resolveShare(code) {
    const match = String(code || "").trim().match(/^qb:\/\/share\/(profile|thread)\/(.+)$/);
    return match ? { type: match[1], id: decodeURIComponent(match[2]) } : null;
  }
};

export const api = lanApi;
