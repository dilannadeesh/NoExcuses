// The API lives alongside the frontend as Vercel serverless functions under
// /api, so same-origin relative paths work in both `vercel dev` and
// production, and the session cookie is sent automatically.
const BASE = import.meta.env.VITE_API_BASE || "/api";

import { trackApi } from "./lib/analytics";

class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function request(path, options = {}, meta = {}) {
  const method = (options.method || "GET").toUpperCase();
  const started = performance.now();
  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      headers: { "Content-Type": "application/json" },
      ...options,
    });
  } catch (err) {
    // offline / DNS / blocked -- the browser throws before any HTTP status
    trackApi({ method, path, status: 0, ms: performance.now() - started, networkError: true, ...meta });
    throw err;
  }
  trackApi({ method, path, status: res.status, ms: performance.now() - started, ...meta });
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
  setRankingMethod: (id, rankingMethod) =>
    request(`/groups/${id}`, { method: "PATCH", body: JSON.stringify({ ranking_method: rankingMethod }) }),
  deleteGroup: (id) => request(`/groups/${id}`, { method: "DELETE" }),
  // Today's games: the group admin sets/clears the plan; every member can read it.
  getGroupWithSchedule: (id) => request(`/groups/${id}?include=schedule`),
  saveSchedule: (id, schedule) =>
    request(`/groups/${id}`, { method: "PATCH", body: JSON.stringify({ schedule }) }, { scheduleChange: "save" }),
  clearSchedule: (id) =>
    request(`/groups/${id}`, { method: "PATCH", body: JSON.stringify({ schedule: null }) }, { scheduleChange: "clear" }),

  listMembers: (groupId) => request(`/groups/${groupId}/members`),
  addMember: (groupId, name, email) =>
    request(`/groups/${groupId}/members`, { method: "POST", body: JSON.stringify({ name, email }) }),
  removeMember: (groupId, memberId) =>
    request(`/groups/${groupId}/members/${memberId}`, { method: "DELETE" }),

  listGames: (groupId) => request(`/groups/${groupId}/games`),
  createGame: (groupId, payload) =>
    request(`/groups/${groupId}/games`, { method: "POST", body: JSON.stringify(payload) }),
  getGame: (gameId) => request(`/games/${gameId}`),
  updateGame: (gameId, payload) =>
    request(`/games/${gameId}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deleteGame: (gameId) => request(`/games/${gameId}`, { method: "DELETE" }),

  getAnalytics: (groupId) => request(`/groups/${groupId}/analytics`),

  // Tournaments
  listTournaments: (groupId) => request(`/groups/${groupId}/tournaments`),
  createTournament: (groupId, payload) =>
    request(`/groups/${groupId}/tournaments`, { method: "POST", body: JSON.stringify(payload) }),
  getTournament: (idOrSlug) => request(`/tournaments/${idOrSlug}`),
  generateFixtures: (id) => request(`/tournaments/${id}`, { method: "POST" }),
  recordFixtureResult: (tournamentId, fixtureId, payload) =>
    request(`/tournaments/${tournamentId}/fixtures/${fixtureId}`, { method: "POST", body: JSON.stringify(payload) }),

  // Personal cross-group stats
  getMyStats: () => request("/me"),

  // Super admin
  adminListUsers: () => request("/admin/users"),
  adminCreateUser: (name, email) =>
    request("/admin/users", { method: "POST", body: JSON.stringify({ name, email }) }),
  adminUpdateUser: (id, payload) =>
    request(`/admin/users/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  adminDeleteUser: (id) => request(`/admin/users/${id}`, { method: "DELETE" }),
  adminCreateGroup: (name, ownerId) =>
    request("/admin/groups", { method: "POST", body: JSON.stringify({ name, owner_id: ownerId }) }),
  adminUpdateGroup: (id, payload) =>
    request(`/admin/groups/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
};

export { ApiError };
