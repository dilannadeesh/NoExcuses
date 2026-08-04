// The API lives alongside the frontend as Vercel serverless functions under
// /api, so same-origin relative paths work in both `vercel dev` and
// production, and the session cookie is sent automatically.
const BASE = import.meta.env.VITE_API_BASE || "/api";

class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(body.error || `Request failed: ${res.status}`, res.status);
  }
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  // Auth
  signup: (name, email, password) =>
    request("/auth/signup", { method: "POST", body: JSON.stringify({ name, email, password }) }),
  login: (email, password) =>
    request("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  logout: () => request("/auth/logout", { method: "POST" }),
  me: () => request("/auth/me"),
  forgotPassword: (email) =>
    request("/auth/forgot-password", { method: "POST", body: JSON.stringify({ email }) }),
  resetPassword: (token, password) =>
    request("/auth/reset-password", { method: "POST", body: JSON.stringify({ token, password }) }),

  // Groups
  listGroups: () => request("/groups"),
  createGroup: (name) => request("/groups", { method: "POST", body: JSON.stringify({ name }) }),
  getGroup: (id) => request(`/groups/${id}`),
  deleteGroup: (id) => request(`/groups/${id}`, { method: "DELETE" }),

  listMembers: (groupId) => request(`/groups/${groupId}/members`),
  addMember: (groupId, name, email) =>
    request(`/groups/${groupId}/members`, { method: "POST", body: JSON.stringify({ name, email }) }),
  removeMember: (groupId, memberId) =>
    request(`/groups/${groupId}/members/${memberId}`, { method: "DELETE" }),

  listGames: (groupId) => request(`/groups/${groupId}/games`),
  createGame: (groupId, payload) =>
    request(`/groups/${groupId}/games`, { method: "POST", body: JSON.stringify(payload) }),
  deleteGame: (gameId) => request(`/games/${gameId}`, { method: "DELETE" }),

  getAnalytics: (groupId) => request(`/groups/${groupId}/analytics`),
};

export { ApiError };
