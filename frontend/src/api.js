// In production, set VITE_API_BASE in your deployment platform's env vars
// (e.g. Vercel project settings) to your deployed backend's URL, e.g.
// https://your-backend.onrender.com/api
const BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000/api";

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  listGroups: () => request("/groups"),
  createGroup: (name) => request("/groups", { method: "POST", body: JSON.stringify({ name }) }),
  getGroup: (id) => request(`/groups/${id}`),
  deleteGroup: (id) => request(`/groups/${id}`, { method: "DELETE" }),

  listMembers: (groupId) => request(`/groups/${groupId}/members`),
  addMember: (groupId, name) =>
    request(`/groups/${groupId}/members`, { method: "POST", body: JSON.stringify({ name }) }),
  removeMember: (groupId, playerId) =>
    request(`/groups/${groupId}/members/${playerId}`, { method: "DELETE" }),

  listGames: (groupId) => request(`/groups/${groupId}/games`),
  createGame: (groupId, payload) =>
    request(`/groups/${groupId}/games`, { method: "POST", body: JSON.stringify(payload) }),
  deleteGame: (gameId) => request(`/games/${gameId}`, { method: "DELETE" }),

  getAnalytics: (groupId) => request(`/groups/${groupId}/analytics`),
};
