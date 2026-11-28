const host = typeof window !== "undefined" && window.location.hostname
  ? (window.location.hostname === "0.0.0.0" ? "127.0.0.1" : window.location.hostname)
  : "127.0.0.1";

const isViteDev = typeof window !== "undefined" && window.location.port === "5173";

export const API_BASE =
  (typeof window !== "undefined" && window.CLASSPANEL_CONFIG && window.CLASSPANEL_CONFIG.apiBase) ||
  (isViteDev ? "http://" + host + ":3001/api" : "/api");

export const SESSION_KEY = "classpanel_session_v2";

export function storedSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

export function saveStoredSession(session) {
  try {
    if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else localStorage.removeItem(SESSION_KEY);
  } catch (e) {
    /* ignore */
  }
}

export async function apiRequest(path, options = {}) {
  const headers = { "Content-Type": "application/json" };
  if (!options.public && options.token) headers.Authorization = "Bearer " + options.token;
  let res;
  try {
    res = await fetch(API_BASE + path, {
      method: options.method || "GET",
      headers,
      cache: "no-store",
      body: options.body === undefined ? undefined : JSON.stringify(options.body)
    });
  } catch (e) {
    const err = new Error("无法连接后端服务，请确认 " + API_BASE + " 已启动");
    err.status = 0;
    throw err;
  }
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch (e) {
    data = text;
  }
  if (!res.ok) {
    const err = new Error((data && (data.message || data.error)) || "HTTP " + res.status);
    err.status = res.status;
    err.data = data;
    if (res.status === 401) err.unauthorized = true;
    throw err;
  }
  return data;
}
