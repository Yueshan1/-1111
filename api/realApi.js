const API_BASE_URL = (import.meta.env?.VITE_API_BASE_URL || "").replace(/\/+$/, "");
const AUTH_TOKEN_KEY = "question-box.authToken";

function authToken() {
  try {
    return localStorage.getItem(AUTH_TOKEN_KEY) || "";
  } catch {
    return "";
  }
}

function saveAuthToken(token) {
  try {
    if (token) localStorage.setItem(AUTH_TOKEN_KEY, token);
    else localStorage.removeItem(AUTH_TOKEN_KEY);
  } catch {
    // localStorage may be blocked in some embedded WebViews; cookie sessions still work.
  }
}

function buildUrl(path, query = {}) {
  const url = new URL(`${API_BASE_URL}${path}`, window.location.origin);
  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    if (Array.isArray(value)) {
      value.forEach(item => url.searchParams.append(key, item));
      return;
    }
    url.searchParams.set(key, value);
  });
  return url.toString();
}

async function readResponse(response) {
  if (response.status === 204) return true;
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) return response.json();
  return response.text();
}

function errorFromPayload(response, payload) {
  const code = payload?.error?.code || payload?.code || payload?.message || `http-${response.status}`;
  const error = new Error(code);
  error.status = response.status;
  error.payload = payload;
  return error;
}

async function request(path, { method = "GET", query, body } = {}) {
  const headers = { Accept: "application/json" };
  const token = authToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";

  const response = await fetch(buildUrl(path, query), {
    method,
    headers,
    credentials: "include",
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const payload = await readResponse(response);
  if (!response.ok) throw errorFromPayload(response, payload);
  if (payload && typeof payload === "object" && "data" in payload) return payload.data;
  return payload;
}

function normalizeUser(user) {
  return user ? { ...user, loggedIn: user.loggedIn !== false } : { loggedIn: false };
}

function idFrom(input, key) {
  return typeof input === "object" ? input?.[key] : input;
}

function textFrom(input, fallback) {
  return typeof input === "object" ? input?.text : fallback;
}

export const realApi = {
  async getMe() {
    return normalizeUser(await request("/me"));
  },

  async updateMe(input = {}) {
    return normalizeUser(await request("/me", { method: "PATCH", body: input }));
  },

  async login(email = "") {
    const auth = await request("/auth/login", { method: "POST", body: { email } });
    saveAuthToken(auth?.token || "");
    return normalizeUser(auth?.user || auth?.me || auth);
  },

  async logout() {
    try {
      await request("/auth/logout", { method: "POST" });
    } finally {
      saveAuthToken("");
    }
    return { loggedIn: false };
  },

  async listRecipients() {
    return request("/recipients");
  },

  async listFollowing() {
    return request("/follows");
  },

  async listThreads({ bucket = "received", query = "" } = {}) {
    return request("/threads", { query: { bucket, query } });
  },

  async getProfile(userId) {
    return request(`/users/${encodeURIComponent(userId)}/profile`);
  },

  async getThread(idOrTraceCode) {
    return request(`/threads/${encodeURIComponent(idOrTraceCode)}`);
  },

  async createQuestion({ text, targetUserIds, visibility = "public" }) {
    return request("/questions", {
      method: "POST",
      body: { text, targetUserIds, visibility }
    });
  },

  async deleteThread(input) {
    const threadId = idFrom(input, "threadId");
    return request(`/threads/${encodeURIComponent(threadId)}`, { method: "DELETE" });
  },

  async upsertAnswer(input, maybeText) {
    const threadId = idFrom(input, "threadId");
    const text = textFrom(input, maybeText);
    return request(`/threads/${encodeURIComponent(threadId)}/answer`, {
      method: "POST",
      body: { text }
    });
  },

  async deleteAnswer(input) {
    const threadId = idFrom(input, "threadId");
    return request(`/threads/${encodeURIComponent(threadId)}/answer`, { method: "DELETE" });
  },

  async createReply(input, maybeText) {
    const threadId = idFrom(input, "threadId");
    const text = textFrom(input, maybeText);
    return request(`/threads/${encodeURIComponent(threadId)}/replies`, {
      method: "POST",
      body: { text }
    });
  },

  async followUser(input) {
    const userId = idFrom(input, "userId");
    return request(`/follows/${encodeURIComponent(userId)}`, { method: "POST" });
  },

  async unfollowUser(input) {
    const userId = idFrom(input, "userId");
    return request(`/follows/${encodeURIComponent(userId)}`, { method: "DELETE" });
  },

  async updateFollowRemark(input, maybeRemarkName) {
    const userId = idFrom(input, "userId");
    const remarkName = typeof input === "object" ? input?.remarkName : maybeRemarkName;
    return request(`/follows/${encodeURIComponent(userId)}`, {
      method: "PATCH",
      body: { remarkName }
    });
  },

  async reportThread(input, maybeReason) {
    const threadId = idFrom(input, "threadId");
    const reason = typeof input === "object" ? input?.reason : maybeReason;
    return request(`/threads/${encodeURIComponent(threadId)}/report`, {
      method: "POST",
      body: { reason }
    });
  },

  async blockUser(input) {
    const userId = idFrom(input, "userId");
    return request(`/users/${encodeURIComponent(userId)}/block`, { method: "POST" });
  },

  async deleteAccount() {
    try {
      return await request("/me", { method: "DELETE" });
    } finally {
      saveAuthToken("");
    }
  },

  async exportData() {
    return request("/exports", { method: "POST" });
  },

  /** @deprecated Data import has been removed from the product. */
  async importData() {
    throw new Error("data-import-disabled");
  },

  createShare(type, id) {
    return `qb://share/${type}/${encodeURIComponent(id)}`;
  },

  resolveShare(code) {
    const value = String(code || "").trim();
    const match = value.match(/^qb:\/\/share\/(profile|thread)\/(.+)$/);
    return match ? { type: match[1], id: decodeURIComponent(match[2]) } : null;
  }
};
