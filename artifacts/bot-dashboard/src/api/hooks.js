import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

async function apiFetch(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw err;
  }
  return res.json();
}

export const QK = {
  health: () => ["/api/healthz"],
  accounts: () => ["/api/bot/accounts"],
  accountCommands: (userid) => ["/api/bot/accounts", userid, "commands"],
  stats: () => ["/api/bot/stats"],
  commands: () => ["/api/bot/commands"],
  activity: () => ["/api/bot/activity"],
  games: () => ["/api/games"],
  gamePlayers: (id) => ["/api/games", id, "players"],
};

export function useHealthCheck(opts = {}) {
  return useQuery({
    queryKey: QK.health(),
    queryFn: () => apiFetch("/api/healthz"),
    ...opts.query,
  });
}

export function useGetBotAccounts(opts = {}) {
  return useQuery({
    queryKey: QK.accounts(),
    queryFn: () => apiFetch("/api/bot/accounts"),
    ...opts.query,
  });
}

export function useGetBotStats(opts = {}) {
  return useQuery({
    queryKey: QK.stats(),
    queryFn: () => apiFetch("/api/bot/stats"),
    ...opts.query,
  });
}

export function useGetBotCommands(opts = {}) {
  return useQuery({
    queryKey: QK.commands(),
    queryFn: () => apiFetch("/api/bot/commands"),
    ...opts.query,
  });
}

export function useGetBotActivity(opts = {}) {
  return useQuery({
    queryKey: QK.activity(),
    queryFn: () => apiFetch("/api/bot/activity"),
    ...opts.query,
  });
}

export function useBotLogin() {
  return useMutation({
    mutationFn: ({ data }) =>
      apiFetch("/api/bot/login", {
        method: "POST",
        body: JSON.stringify(data),
      }),
  });
}

export function useBotLogout() {
  return useMutation({
    mutationFn: ({ userid }) =>
      apiFetch(`/api/bot/accounts/${userid}`, { method: "DELETE" }),
  });
}

export function useGetAccountCommands(userid, opts = {}) {
  return useQuery({
    queryKey: QK.accountCommands(userid),
    queryFn: () => apiFetch(`/api/bot/accounts/${userid}/commands`),
    enabled: !!userid,
    ...opts.query,
  });
}

export function useUpdateAccountCommands() {
  return useMutation({
    mutationFn: ({ userid, commands, handleEvent }) =>
      apiFetch(`/api/bot/accounts/${userid}/commands`, {
        method: "PUT",
        body: JSON.stringify({ commands, handleEvent }),
      }),
  });
}

export function useGetGames(opts = {}) {
  return useQuery({
    queryKey: QK.games(),
    queryFn: () => apiFetch("/api/games"),
    ...opts.query,
  });
}

export function useCreateGame() {
  return useMutation({
    mutationFn: ({ data }) =>
      apiFetch("/api/games", {
        method: "POST",
        body: JSON.stringify(data),
      }),
  });
}

export function useDeleteGame() {
  return useMutation({
    mutationFn: ({ id }) =>
      apiFetch(`/api/games/${id}`, { method: "DELETE" }),
  });
}

export function useGetGamePlayers(id, opts = {}) {
  return useQuery({
    queryKey: QK.gamePlayers(id),
    queryFn: () => apiFetch(`/api/games/${id}/players`),
    ...opts.query,
  });
}

export function useRegisterForGame() {
  return useMutation({
    mutationFn: ({ id, data }) =>
      apiFetch(`/api/games/${id}/register`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
  });
}

export function useClaimGameReward() {
  return useMutation({
    mutationFn: ({ id, data }) =>
      apiFetch(`/api/games/${id}/claim`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
  });
}
