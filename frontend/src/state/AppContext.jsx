import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { API_BASE, apiRequest, saveStoredSession, storedSession } from "../api.js";
import { defaultStore, normalize, uid } from "../data/model.js";
import { DEFAULT_UI_PREFS, UI_THEMES, DEFAULT_GUEST_PERMS } from "../data/constants.js";
import {
  canonicalJson, currentQuote, expectedIds, expectedStudents, homeSubjects, isEditingField,
  leaveStat, todayStr
} from "../utils.js";

export const CACHE_KEY = "gaoer3_classroom_v2";
export const UI_PREFS_KEY = "gaoer3_ui_prefs_v1";

const AppContext = createContext(null);

function loadCachedStore() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) return normalize(JSON.parse(raw));
  } catch (e) {
    /* ignore */
  }
  return normalize(defaultStore());
}

function loadPrefs() {
  try {
    const raw = localStorage.getItem(UI_PREFS_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      return {
        theme: UI_THEMES.some((t) => t.key === p.theme) ? p.theme : DEFAULT_UI_PREFS.theme,
        fontScale: Math.min(1.4, Math.max(0.8, Number(p.fontScale) || 1)),
        displayFontScale: Math.min(1.6, Math.max(0.8, Number(p.displayFontScale) || 1)),
        scrollOn: !!p.scrollOn,
        scrollSpeed: Math.min(100, Math.max(4, Number(p.scrollSpeed) || 24))
      };
    }
  } catch (e) {
    /* ignore */
  }
  return { ...DEFAULT_UI_PREFS };
}

export function AppProvider({ children }) {
  const [store, setStore] = useState(loadCachedStore);
  const [session, setSession] = useState(storedSession);
  const [ready, setReady] = useState(false);
  const [appConfig, setAppConfig] = useState({ mode: "cloud", classExists: null, className: null, storageConfigured: false, storageMode: null, storage: null, storageError: "" });
  const [configReady, setConfigReady] = useState(false);
  const [uiPrefs, setUiPrefs] = useState(loadPrefs);
  const [server, setServer] = useState({ revision: 0, lastSync: 0, error: "" });
  const [tokens, setTokens] = useState([]);
  const [tokensLoading, setTokensLoading] = useState(false);
  const [toastState, setToastState] = useState({ open: false, msg: "", icon: "" });
  const [boardDisplay, setBoardDisplay] = useState(false);
  const [boardHwLayout, setBoardHwLayout] = useState("list");
  const [boardDate, setBoardDate] = useState("");
  const [now, setNow] = useState(() => new Date());

  const storeRef = useRef(store);
  const sessionRef = useRef(session);
  const dirtyRef = useRef(false);
  const pushTimerRef = useRef(null);
  const pushingRef = useRef(false);
  const pullingRef = useRef(false);
  const applyingRef = useRef(false);
  const pollRef = useRef(null);
  const toastTimerRef = useRef(null);
  const revisionRef = useRef(0);

  useEffect(() => { storeRef.current = store; }, [store]);
  useEffect(() => { sessionRef.current = session; }, [session]);

  const cacheStore = useCallback((value) => {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(value)); } catch (e) { /* ignore */ }
  }, []);

  const toast = useCallback((msg, icon = "") => {
    setToastState({ open: true, msg: String(msg || ""), icon: icon || "" });
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToastState((s) => ({ ...s, open: false })), 2400);
  }, []);

  const applyServerPayload = useCallback((payload, revision) => {
    const next = normalize(payload || {});
    const changed = canonicalJson(next) !== canonicalJson(storeRef.current);
    applyingRef.current = true;
    storeRef.current = next;
    setStore(next);
    cacheStore(next);
    applyingRef.current = false;
    revisionRef.current = Math.max(revisionRef.current, Number(revision) || 0);
    setServer((s) => ({
      revision: Math.max(s.revision, Number(revision) || 0),
      lastSync: Date.now(),
      error: ""
    }));
    if (sessionRef.current && sessionRef.current.class && next.settings && next.settings.className) {
      const updated = { ...sessionRef.current, class: { ...sessionRef.current.class, name: next.settings.className } };
      sessionRef.current = updated;
      setSession(updated);
      saveStoredSession(updated);
    }
    return changed;
  }, [cacheStore]);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const loadServerState = useCallback(async (currentSession) => {
    const s = currentSession || sessionRef.current;
    if (!s || !s.class) return null;
    const data = await apiRequest("/classes/" + s.class.id + "/state", { token: s.token });
    applyServerPayload(data.payload, data.revision);
    return data;
  }, [applyServerPayload]);

  const pushNow = useCallback(async (show = false) => {
    const s = sessionRef.current;
    if (!s || !s.class || s.role === "class_member") return false;
    if (pushingRef.current) { dirtyRef.current = true; return false; }
    const payload = JSON.parse(JSON.stringify(storeRef.current));
    if (payload.settings) {
      delete payload.settings.adminPassword;
      delete payload.settings.adminPasswordHash;
    }
    pushingRef.current = true;
    dirtyRef.current = false;
    try {
      const data = await apiRequest("/classes/" + s.class.id + "/state", {
        method: "PUT",
        token: s.token,
        body: { payload }
      });
      revisionRef.current = Math.max(revisionRef.current, Number(data.revision) || 0);
      setServer((prev) => ({ ...prev, revision: Number(data.revision) || prev.revision, lastSync: Date.now(), error: "" }));
      const incoming = normalize(data.payload || {});
      if (canonicalJson(incoming) !== canonicalJson(storeRef.current)) {
        applyServerPayload(data.payload, data.revision);
      }
      if (show) toast("已保存到服务器", "☁️");
      return true;
    } catch (err) {
      if (err && err.unauthorized) {
        saveStoredSession(null);
        setSession(null);
        setServer((prev) => ({ ...prev, error: "登录已失效" }));
        return false;
      }
      setServer((prev) => ({ ...prev, error: err.message || "保存失败" }));
      dirtyRef.current = true;
      if (show) toast("服务器保存失败：" + (err.message || err), "⚠️");
      return false;
    } finally {
      pushingRef.current = false;
      if (dirtyRef.current && sessionRef.current) {
        setTimeout(() => pushNow(false), 5000);
      }
    }
  }, [applyServerPayload, toast]);

  const schedulePush = useCallback(() => {
    const s = sessionRef.current;
    if (!s || s.role === "class_member") return;
    dirtyRef.current = true;
    if (pushTimerRef.current) clearTimeout(pushTimerRef.current);
    pushTimerRef.current = setTimeout(() => {
      pushTimerRef.current = null;
      if (dirtyRef.current) pushNow(false);
    }, 700);
  }, [pushNow]);

  const update = useCallback((mutator, options = {}) => {
    const prev = storeRef.current;
    const draft = JSON.parse(JSON.stringify(prev));
    const next = typeof mutator === "function" ? mutator(draft) : draft;
    storeRef.current = next;
    setStore(next);
    cacheStore(next);
    if (!options.noPush) schedulePush();
    return next;
  }, [cacheStore, schedulePush]);

  const pullNow = useCallback(async (force = false) => {
    const s = sessionRef.current;
    if (!s || !s.class || pullingRef.current || pushingRef.current) return false;
    if (!force && (isEditingField() || dirtyRef.current)) return false;
    pullingRef.current = true;
    try {
      const data = await apiRequest("/classes/" + s.class.id + "/state", { token: s.token });
      setServer((prev) => ({ ...prev, lastSync: Date.now(), error: "" }));
      if (Number(data.revision) > revisionRef.current || force) {
        applyServerPayload(data.payload, data.revision);
      }
      return true;
    } catch (err) {
      if (err && err.unauthorized) {
        saveStoredSession(null);
        setSession(null);
      }
      setServer((prev) => ({ ...prev, error: err.message || "刷新失败" }));
      return false;
    } finally {
      pullingRef.current = false;
    }
  }, [applyServerPayload]);

  const refreshConfig = useCallback(async () => {
    try {
      const data = await apiRequest("/config", { public: true });
      setAppConfig({
        mode: data && data.mode === "local" ? "local" : "cloud",
        classExists: data && data.mode === "local" ? !!data.classExists : null,
        className: data && data.mode === "local" ? (data.className || "") : null,
        storageConfigured: data && data.mode === "local" ? !!data.storageConfigured : true,
        storageMode: data && data.mode === "local" ? (data.storageMode || null) : null,
        storage: data && data.mode === "local" ? (data.storage || null) : null,
        storageError: data && data.mode === "local" ? (data.storageError || "") : ""
      });
    } catch (e) {
      setAppConfig((prev) => (prev.mode ? prev : { mode: "cloud", classExists: null, className: null }));
    } finally {
      setConfigReady(true);
    }
  }, []);

  useEffect(() => { refreshConfig(); }, [refreshConfig]);

  const startPolling = useCallback(() => {
    stopPolling();
    pollRef.current = setInterval(() => {
      if (!document.hidden && sessionRef.current) pullNow(false);
    }, 15000);
  }, [pullNow, stopPolling]);

  const finishLogin = useCallback(async (data) => {
    saveStoredSession(data);
    sessionRef.current = data;
    setSession(data);
    try {
      await loadServerState(data);
    } catch (err) {
      if (err && err.unauthorized) {
        saveStoredSession(null);
        setSession(null);
        throw err;
      }
      toast("读取班级数据失败：" + (err.message || err), "⚠️");
    }
    startPolling();
    setReady(true);
  }, [loadServerState, startPolling, toast]);

  const configureStorage = useCallback(async (payload) => {
    const data = await apiRequest("/local/storage", { public: true, method: "POST", body: payload });
    await refreshConfig();
    toast(data.storage && data.storage.mode === "supabase" ? "已连接 Supabase，存储方式已锁定" : "已选择本地 SQLite，存储方式已锁定", "💾");
    return data;
  }, [refreshConfig, toast]);

  const loginClass = useCallback(async (username, password) => {
    const data = await apiRequest("/auth/class/login", { public: true, method: "POST", body: { username, password } });
    await finishLogin(data);
    toast(data.role === "class_member" ? "已进入普通账号模式" : "已进入班级管理员模式", "🔓");
  }, [finishLogin, toast]);

  const loginGuest = useCallback(async (accessToken) => {
    const data = await apiRequest("/auth/guest", { public: true, method: "POST", body: { accessToken } });
    await finishLogin(data);
    toast("已使用访客令牌进入", "👀");
  }, [finishLogin, toast]);

  const registerClass = useCallback(async (payload) => {
    const data = await apiRequest("/classes/register", { public: true, method: "POST", body: payload });
    await finishLogin(data);
    setAppConfig((prev) => ({ ...prev, classExists: true, className: data.class ? data.class.name : prev.className }));
    toast("班级注册成功", "🏫");
  }, [finishLogin, toast]);

  const logout = useCallback(async () => {
    if (dirtyRef.current) await pushNow(false);
    stopPolling();
    saveStoredSession(null);
    sessionRef.current = null;
    setSession(null);
    setTokens([]);
    setReady(true);
    refreshConfig();
    toast("已退出登录", "👋");
  }, [pushNow, refreshConfig, stopPolling, toast]);

  const restoreAuth = useCallback(async () => {
    const s = storedSession();
    if (!s || !s.token) { setReady(true); return; }
    sessionRef.current = s;
    setSession(s);
    try {
      const me = await apiRequest("/auth/me", { token: s.token });
      const merged = { ...s, role: me.role, class: me.class, account: me.account, tokenInfo: me.tokenInfo };
      saveStoredSession(merged);
      sessionRef.current = merged;
      setSession(merged);
      await loadServerState(merged);
      startPolling();
    } catch (err) {
      saveStoredSession(null);
      sessionRef.current = null;
      setSession(null);
    } finally {
      setReady(true);
    }
  }, [loadServerState, startPolling]);

  useEffect(() => { restoreAuth(); return stopPolling; }, [restoreAuth, stopPolling]);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    document.documentElement.style.setProperty("--fs-base", String(uiPrefs.fontScale));
    document.documentElement.style.setProperty("--dfs", String(uiPrefs.displayFontScale));
    document.body.classList.remove("theme-warm", "theme-mint", "theme-sky", "theme-rose", "theme-violet");
    document.body.classList.add("theme-" + (uiPrefs.theme || "warm"));
    document.body.classList.toggle("board-display", !!boardDisplay);
    try { localStorage.setItem(UI_PREFS_KEY, JSON.stringify(uiPrefs)); } catch (e) { /* ignore */ }
  }, [uiPrefs, boardDisplay]);

  useEffect(() => {
    const s = sessionRef.current;
    if (!s || !storeRef.current.quotes || !storeRef.current.quotes.length) return;
    const q = currentQuote(storeRef.current);
    if (q.fresh) update((draft) => { draft.quoteState = q.fresh; return draft; });
  }, [session, store.quotes.length, update]);

  const setPref = useCallback((key, value) => {
    setUiPrefs((prev) => {
      const next = { ...prev, [key]: value };
      if (key === "fontScale") next.fontScale = Math.min(1.4, Math.max(0.8, Number(value) || 1));
      if (key === "displayFontScale") next.displayFontScale = Math.min(1.6, Math.max(0.8, Number(value) || 1));
      if (key === "scrollSpeed") next.scrollSpeed = Math.min(100, Math.max(4, Number(value) || 24));
      return next;
    });
  }, []);

  const role = session
    ? (session.role === "class_admin" ? "admin" : session.role === "class_member" ? "member" : "guest")
    : null;
  const isAdmin = role === "admin";
  const isMember = role === "member";
  const isMain = !!(session && session.isMain);
  const guestPerm = useCallback((key) => {
    const p = (storeRef.current.settings && storeRef.current.settings.guestPerms) || {};
    return p[key] !== undefined ? !!p[key] : !!DEFAULT_GUEST_PERMS[key];
  }, []);
  const canEdit = useCallback((key) => {
    if (isAdmin) return true;
    if (isMember) return false;
    return guestPerm(key);
  }, [isAdmin, isMember, guestPerm]);

  const settings = store.settings || {};
  const className = settings.className || "班级";
  const classShort = settings.classShort || String(className).replace(/[^0-9]/g, "").slice(0, 2) || "1";

  const saveSettings = useCallback((patch) => {
    update((draft) => {
      draft.settings = { ...draft.settings, ...patch };
      draft.settings.classShort = String(draft.settings.className || "").replace(/[^0-9]/g, "").slice(0, 2) || "1";
      draft.settings.classSize = (draft.birthdays || []).length;
      return draft;
    });
    if (patch.className && sessionRef.current && sessionRef.current.class) {
      const updated = { ...sessionRef.current, class: { ...sessionRef.current.class, name: patch.className } };
      sessionRef.current = updated;
      setSession(updated);
      saveStoredSession(updated);
    }
  }, [update]);

  const saveGuestPerms = useCallback((perms) => {
    update((draft) => {
      draft.settings.guestPerms = { ...DEFAULT_GUEST_PERMS, ...perms };
      return draft;
    });
  }, [update]);

  const saveHomeSubjects = useCallback((subjects) => {
    update((draft) => {
      draft.settings.homeSubjects = homeSubjects({ settings: { homeSubjects: subjects } });
      return draft;
    });
  }, [update]);

  const addHomework = useCallback((subject, title, minutes, due) => {
    const t = todayStr();
    update((draft) => {
      draft.homeworks.push({
        id: uid(), subject, title: String(title || "").trim(), note: "",
        minutes: Number(minutes) || 0, due: due || t, done: false,
        date: t, created: Date.now(), createdLabel: "今天 布置"
      });
      return draft;
    });
  }, [update]);

  const editHomework = useCallback((id, patch) => {
    update((draft) => {
      const h = draft.homeworks.find((x) => x.id === id);
      if (h) Object.assign(h, patch);
      return draft;
    });
  }, [update]);

  const delHomework = useCallback((id) => {
    update((draft) => { draft.homeworks = draft.homeworks.filter((x) => x.id !== id); return draft; });
  }, [update]);

  const addLeave = useCallback((payload) => {
    update((draft) => {
      draft.leaves.push({ id: uid(), date: todayStr(), returned: false, created: Date.now(), ...payload });
      return draft;
    });
  }, [update]);

  const toggleLeave = useCallback((id) => {
    update((draft) => {
      const l = draft.leaves.find((x) => x.id === id);
      if (l) l.returned = !l.returned;
      return draft;
    });
  }, [update]);

  const delLeave = useCallback((id) => {
    update((draft) => { draft.leaves = draft.leaves.filter((x) => x.id !== id); return draft; });
  }, [update]);

  const addReminder = useCallback((text, due) => {
    update((draft) => {
      draft.reminders.push({ id: uid(), text: String(text || "").trim(), date: todayStr(), due: due || todayStr(), done: false, created: Date.now() });
      return draft;
    });
  }, [update]);

  const toggleReminder = useCallback((id) => {
    update((draft) => {
      const r = draft.reminders.find((x) => x.id === id);
      if (r) r.done = !r.done;
      return draft;
    });
  }, [update]);

  const delReminder = useCallback((id) => {
    update((draft) => { draft.reminders = draft.reminders.filter((x) => x.id !== id); return draft; });
  }, [update]);

  const addMessage = useCallback((text, who) => {
    const b = new Date(Date.now() + 8 * 3600 * 1000);
    update((draft) => {
      draft.messages.push({ id: uid(), who: String(who || "").trim(), text: String(text || "").trim(), date: todayStr(), time: String(b.getUTCHours()).padStart(2, "0") + ":" + String(b.getUTCMinutes()).padStart(2, "0"), created: Date.now() });
      return draft;
    });
  }, [update]);

  const delMessage = useCallback((id) => {
    update((draft) => { draft.messages = draft.messages.filter((x) => x.id !== id); return draft; });
  }, [update]);

  const addQuote = useCallback((text, tag, by) => {
    update((draft) => {
      draft.quotes.push({ id: "q_" + uid(), t: String(text || "").trim(), tag: tag || "其他", by: String(by || "").trim() });
      return draft;
    });
  }, [update]);

  const delQuote = useCallback((id) => {
    update((draft) => { draft.quotes = draft.quotes.filter((q) => q.id !== id); return draft; });
  }, [update]);

  const nextQuote = useCallback(() => {
    update((draft) => {
      const n = draft.quotes.length;
      if (n < 2) return draft;
      const cur = currentQuote(draft);
      let next = cur.idx;
      let guard = 0;
      while (next === cur.idx && guard < 20) { next = Math.floor(Math.random() * n); guard += 1; }
      draft.quoteState = { ...draft.quoteState, date: todayStr(), manual: next };
      return draft;
    });
  }, [update]);

  const favQuote = useCallback(() => {
    update((draft) => {
      const q = currentQuote(draft).q;
      if (!q) return draft;
      const i = draft.favorites.indexOf(q.t);
      if (i >= 0) draft.favorites.splice(i, 1); else draft.favorites.push(q.t);
      return draft;
    });
  }, [update]);

  const addLink = useCallback((name, url) => {
    let finalUrl = String(url || "").trim();
    if (finalUrl && !/^https?:\/\//i.test(finalUrl)) finalUrl = "https://" + finalUrl;
    update((draft) => {
      draft.links.push({ id: "link_" + uid(), name: String(name || "").trim(), url: finalUrl });
      return draft;
    });
  }, [update]);

  const delLink = useCallback((id) => {
    update((draft) => { draft.links = draft.links.filter((l) => l.id !== id); return draft; });
  }, [update]);

  const addIssue = useCallback((title, detail) => {
    update((draft) => {
      draft.issues.push({ id: "issue_" + uid(), title: String(title || "").trim(), detail: String(detail || "").trim(), role: isAdmin ? "admin" : "guest", createdAt: Date.now(), resolved: false, replies: [] });
      return draft;
    });
  }, [isAdmin, update]);

  const delIssue = useCallback((id) => {
    update((draft) => { draft.issues = draft.issues.filter((i) => i.id !== id); return draft; });
  }, [update]);

  const replyIssue = useCallback((id, text) => {
    update((draft) => {
      const it = draft.issues.find((i) => i.id === id);
      if (it) it.replies.push({ id: "reply_" + uid(), text: String(text || "").trim(), role: isAdmin ? "admin" : "guest", at: Date.now() });
      return draft;
    });
  }, [isAdmin, update]);

  const resolveIssue = useCallback((id) => {
    update((draft) => {
      const it = draft.issues.find((i) => i.id === id);
      if (it) it.resolved = !it.resolved;
      return draft;
    });
  }, [update]);

  const addStudent = useCallback((payload) => {
    update((draft) => {
      draft.birthdays.push({ id: "stu_" + uid(), name: String(payload.name || "").trim(), md: String(payload.md || "").trim(), year: Number(payload.year) || 0, wish: String(payload.wish || "").trim(), locked: false });
      draft.settings.classSize = draft.birthdays.length;
      return draft;
    });
  }, [update]);

  const editStudent = useCallback((id, patch) => {
    update((draft) => {
      const s = draft.birthdays.find((x) => x.id === id);
      if (s) Object.assign(s, patch);
      return draft;
    });
  }, [update]);

  const delStudent = useCallback((id) => {
    update((draft) => { draft.birthdays = draft.birthdays.filter((b) => b.id !== id); draft.settings.classSize = draft.birthdays.length; return draft; });
  }, [update]);

  const addTeacher = useCallback((payload) => {
    update((draft) => {
      draft.teachers.push({ id: "tea_" + uid(), name: String(payload.name || "").trim(), subject: payload.subject || "其他", role: payload.role || "任课教师", md: String(payload.md || "").trim(), year: Number(payload.year) || 0, wish: String(payload.wish || "").trim() });
      return draft;
    });
  }, [update]);

  const editTeacher = useCallback((id, patch) => {
    update((draft) => {
      const t = draft.teachers.find((x) => x.id === id);
      if (t) Object.assign(t, patch);
      return draft;
    });
  }, [update]);

  const delTeacher = useCallback((id) => {
    update((draft) => { draft.teachers = draft.teachers.filter((t) => t.id !== id); return draft; });
  }, [update]);

  const addSwap = useCallback((swap) => {
    update((draft) => {
      draft.swaps.push({ id: "swap_" + uid(), createdAt: Date.now(), ...swap });
      return draft;
    });
  }, [update]);

  const delSwap = useCallback((id) => {
    update((draft) => { draft.swaps = draft.swaps.filter((s) => s.id !== id); return draft; });
  }, [update]);

  const setExpected = useCallback((dateStr, ids) => {
    update((draft) => {
      draft.expected[dateStr] = ids;
      return draft;
    });
  }, [update]);

  const exportData = useCallback(() => {
    const blob = new Blob([JSON.stringify(storeRef.current, null, 2)], { type: "application/json;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "班级小屋备份_" + todayStr() + ".json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    toast("已导出备份文件", "💾");
  }, [toast]);

  const importData = useCallback((file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const obj = JSON.parse(ev.target.result);
        update(() => normalize(obj));
        toast("数据已导入", "📥");
        resolve(true);
      } catch (e) {
        reject(e);
      }
    };
    reader.onerror = reject;
    reader.readAsText(file, "utf-8");
  }), [toast, update]);

  const resetAll = useCallback(() => {
    const name = (storeRef.current.settings && storeRef.current.settings.className) || "班级";
    const fresh = !!(storeRef.current.settings && storeRef.current.settings.freshClass);
    update(() => {
      const s = normalize(defaultStore());
      s.settings.className = name;
      s.settings.classShort = String(name).replace(/[^0-9]/g, "").slice(0, 2) || "1";
      if (fresh) {
        s.settings.freshClass = true;
        s.settings.rosterVersion = "";
        s.settings.birthdayVersion = "";
        s.birthdays = [];
        s.teachers = [];
        s.links = [];
        s.quotes = [];
        s.settings.classSize = 0;
      }
      return s;
    });
    toast("已清空全部数据", "🧹");
  }, [toast, update]);

  const refreshTokens = useCallback(async () => {
    const s = sessionRef.current;
    if (!s || !s.class || !isAdmin) return;
    setTokensLoading(true);
    try {
      const data = await apiRequest("/classes/" + s.class.id + "/tokens", { token: s.token });
      setTokens(Array.isArray(data.tokens) ? data.tokens : []);
    } catch (err) {
      toast("令牌加载失败：" + (err.message || err), "⚠️");
    } finally {
      setTokensLoading(false);
    }
  }, [isAdmin, toast]);

  const createToken = useCallback(async (label, days) => {
    const s = sessionRef.current;
    if (!s || !s.class) return null;
    const data = await apiRequest("/classes/" + s.class.id + "/tokens", {
      method: "POST",
      token: s.token,
      body: { label, expiresInDays: days === 0 ? null : Number(days) }
    });
    await refreshTokens();
    toast("访客令牌已生成", "🎟️");
    return data.token;
  }, [refreshTokens, toast]);

  const revokeToken = useCallback(async (id) => {
    const s = sessionRef.current;
    if (!s || !s.class) return;
    await apiRequest("/classes/" + s.class.id + "/tokens/" + id, { method: "DELETE", token: s.token });
    await refreshTokens();
    toast("令牌已撤销", "🚫");
  }, [refreshTokens, toast]);

  const changePassword = useCallback(async (currentPassword, newPassword) => {
    const s = sessionRef.current;
    if (!s || !s.class) throw new Error("未登录");
    await apiRequest("/classes/" + s.class.id + "/password", {
      method: "POST",
      token: s.token,
      body: { currentPassword, newPassword }
    });
    toast("管理员密码已修改", "🔐");
  }, [toast]);

  const value = useMemo(() => ({
    store, session, role, isAdmin, isMember, isMain, ready, appConfig, configReady, refreshConfig, uiPrefs, server, now,
    boardDisplay, setBoardDisplay, boardHwLayout, setBoardHwLayout, boardDate, setBoardDate,
    tokens, tokensLoading, toastState, setToastState,
    className, classShort,
    loginClass, loginGuest, registerClass, logout, configureStorage,
    update, saveSettings, saveGuestPerms, saveHomeSubjects,
    addHomework, editHomework, delHomework,
    addLeave, toggleLeave, delLeave,
    addReminder, toggleReminder, delReminder,
    addMessage, delMessage,
    addQuote, delQuote, nextQuote, favQuote,
    addLink, delLink,
    addIssue, delIssue, replyIssue, resolveIssue,
    addStudent, editStudent, delStudent,
    addTeacher, editTeacher, delTeacher,
    addSwap, delSwap, setExpected,
    exportData, importData, resetAll,
    refreshTokens, createToken, revokeToken, changePassword,
    setPref, toast, canEdit, guestPerm,
    pullNow, pushNow,
    leaveStat: (dateStr) => leaveStat(storeRef.current, dateStr || todayStr()),
    expectedIds: (dateStr) => expectedIds(storeRef.current, dateStr || todayStr()),
    expectedStudents: (dateStr) => expectedStudents(storeRef.current, dateStr || todayStr()),
    apiBase: API_BASE
  }), [
    store, session, role, isAdmin, isMember, isMain, ready, appConfig, configReady, refreshConfig, uiPrefs, server, now, boardDisplay, boardHwLayout,
    boardDate, tokens, tokensLoading, toastState, className, classShort,
    loginClass, loginGuest, registerClass, logout, configureStorage, update, saveSettings, saveGuestPerms,
    saveHomeSubjects, addHomework, editHomework, delHomework, addLeave, toggleLeave, delLeave,
    addReminder, toggleReminder, delReminder, addMessage, delMessage, addQuote, delQuote,
    nextQuote, favQuote, addLink, delLink, addIssue, delIssue, replyIssue, resolveIssue,
    addStudent, editStudent, delStudent, addTeacher, editTeacher, delTeacher, addSwap, delSwap,
    setExpected, exportData, importData, resetAll, refreshTokens, createToken, revokeToken,
    changePassword, setPref, toast, canEdit, guestPerm, pullNow, pushNow
  ]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
