import { SUBJECTS, HOME_SUBJECT_ORDER, DEFAULT_HOME_SUBJECTS, TEACHER_SUBJECTS, LEAVE_PERIODS } from "./data/constants.js";

export function pad(n) {
  return n < 10 ? "0" + n : "" + n;
}

export function beijingDate(d) {
  return new Date((d ? d.getTime() : Date.now()) + 8 * 3600 * 1000);
}

export function todayStr(d) {
  const b = beijingDate(d);
  return b.getUTCFullYear() + "-" + pad(b.getUTCMonth() + 1) + "-" + pad(b.getUTCDate());
}

export function nowTime() {
  const b = beijingDate();
  return pad(b.getUTCHours()) + ":" + pad(b.getUTCMinutes());
}

export function parseDate(s) {
  if (!s) return null;
  const p = String(s).split("-");
  if (p.length < 3) return null;
  const y = parseInt(p[0], 10), m = parseInt(p[1], 10), dd = parseInt(p[2], 10);
  if (isNaN(y) || isNaN(m) || isNaN(dd)) return null;
  return new Date(y, m - 1, dd);
}

export function dayDiff(a, b) {
  const A = new Date(a.getFullYear(), a.getMonth(), a.getDate());
  const B = new Date(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((A - B) / 86400000);
}

export function subjectColor(name) {
  for (const s of SUBJECTS) if (s.name === name) return s.c;
  return "#ffb89a";
}

export function dateLabel(s) {
  const d = parseDate(s);
  if (!d) return s || "";
  return d.getMonth() + 1 + "月" + d.getDate() + "日";
}

export function remindDue(r) {
  return String((r && (r.due || r.date)) || "");
}

export function remindActive(r, date) {
  const d = date || todayStr();
  const due = remindDue(r);
  return !!(r && r.date && r.date <= d && due && due >= d);
}

export function relDay(s) {
  const d = parseDate(s);
  if (!d) return "";
  const diff = dayDiff(d, new Date());
  if (diff === 0) return "今天";
  if (diff === -1) return "昨天";
  if (diff === 1) return "明天";
  if (diff < 0) return Math.abs(diff) + "天前";
  return diff + "天后";
}

export function fmtSyncTime(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  if (isNaN(d.getTime())) return "";
  const b = beijingDate(d);
  if (todayStr(d) === todayStr()) return pad(b.getUTCHours()) + ":" + pad(b.getUTCMinutes()) + ":" + pad(b.getUTCSeconds());
  return b.getUTCMonth() + 1 + "-" + pad(b.getUTCDate()) + " " + pad(b.getUTCHours()) + ":" + pad(b.getUTCMinutes());
}

export function expectedIds(store, dateStr) {
  const raw = store.expected && store.expected[dateStr];
  if (Array.isArray(raw)) {
    const seen = {}, ids = [];
    raw.forEach((id) => {
      if (!seen[id] && studentById(store, id)) { seen[id] = 1; ids.push(id); }
    });
    return ids;
  }
  return studentSorted(store).map((s) => s.id);
}

export function expectedStudents(store, dateStr) {
  return expectedIds(store, dateStr).map((id) => studentById(store, id)).filter(Boolean);
}

export function activeLeaveNames(store, dateStr) {
  const seen = {};
  (store.leaves || []).forEach((l) => {
    if (l.date === dateStr && !l.returned) seen[l.name] = true;
  });
  return seen;
}

export function leaveStat(store, dateStr) {
  const students = expectedStudents(store, dateStr);
  const names = {};
  students.forEach((s) => { names[s.name] = true; });
  const list = (store.leaves || []).filter((l) => l.date === dateStr && names[l.name]);
  const seen = {}, outNames = [];
  list.forEach((l) => {
    if (l.returned) return;
    if (!seen[l.name]) { seen[l.name] = 1; outNames.push(l.name); }
  });
  const out = outNames.length;
  return {
    total: students.length,
    present: Math.max(0, students.length - out),
    out,
    names: outNames,
    all: list,
    expected: students
  };
}

export function periodRangeText(values) {
  const idx = [];
  (values || []).forEach((v) => {
    const i = LEAVE_PERIODS.indexOf(v);
    if (i >= 0 && idx.indexOf(i) < 0) idx.push(i);
  });
  idx.sort((a, b) => a - b);
  if (!idx.length) return "";
  const out = [];
  let start = idx[0], prev = idx[0];
  for (let n = 1; n < idx.length; n += 1) {
    if (idx[n] === prev + 1) { prev = idx[n]; continue; }
    out.push(start === prev ? LEAVE_PERIODS[start] : LEAVE_PERIODS[start] + "~" + LEAVE_PERIODS[prev]);
    start = prev = idx[n];
  }
  out.push(start === prev ? LEAVE_PERIODS[start] : LEAVE_PERIODS[start] + "~" + LEAVE_PERIODS[prev]);
  return out.join("、");
}

export function homeSubjects(store) {
  const list = store && store.settings && store.settings.homeSubjects;
  if (!Array.isArray(list) || !list.length) return DEFAULT_HOME_SUBJECTS.slice();
  const out = HOME_SUBJECT_ORDER.filter((s) => list.indexOf(s) >= 0);
  return out.length ? out : DEFAULT_HOME_SUBJECTS.slice();
}

export function subjectOnHome(store, name) {
  return homeSubjects(store).indexOf(name) >= 0;
}

export function homeSubjectList(store, extra) {
  const out = homeSubjects(store);
  (extra || []).forEach((k) => {
    if (HOME_SUBJECT_ORDER.indexOf(k) < 0 && out.indexOf(k) < 0) out.push(k);
  });
  return out;
}

export function daysToBirthday(md, today) {
  if (!md) return 9999;
  const p = String(md).split("-");
  const m = parseInt(p[0], 10), d = parseInt(p[1], 10);
  if (isNaN(m) || isNaN(d)) return 9999;
  const y = today.getFullYear();
  let target = new Date(y, m - 1, d);
  const base = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  let diff = Math.round((target - base) / 86400000);
  if (diff < 0) {
    target = new Date(y + 1, m - 1, d);
    diff = Math.round((target - base) / 86400000);
  }
  return diff;
}

let STUDENT_COLLATOR = null;
try {
  STUDENT_COLLATOR = new Intl.Collator("zh-Hans-CN", { sensitivity: "base" });
} catch (e) {
  STUDENT_COLLATOR = null;
}

export function studentNameCompare(a, b) {
  const an = String((a && a.name) || ""), bn = String((b && b.name) || "");
  if (STUDENT_COLLATOR) return STUDENT_COLLATOR.compare(an, bn);
  return an.localeCompare(bn, "zh-Hans-CN");
}

export function studentSorted(store) {
  return (store.birthdays || []).slice().sort(studentNameCompare);
}

export function studentById(store, id) {
  return (store.birthdays || []).find((b) => b.id === id) || null;
}

export function birthdayText(md) {
  if (!md) return "生日未填";
  const p = String(md).split("-");
  return parseInt(p[0], 10) + "月" + parseInt(p[1], 10) + "日";
}

export function birthdaySorted(store) {
  const today = new Date();
  const list = [];
  (store.birthdays || []).forEach((b) => {
    if (b.md) list.push({ b, days: daysToBirthday(b.md, today), kind: "student" });
  });
  (store.teachers || []).forEach((t) => {
    if (t.md) list.push({ b: t, days: daysToBirthday(t.md, today), kind: "teacher" });
  });
  return list.sort((x, y) => (x.days - y.days) || studentNameCompare(x.b, y.b));
}

export function birthdayDisplayName(item) {
  const name = String((item.b && item.b.name) || "");
  return item.kind === "teacher" ? name + "老师" : name;
}

export function teacherSubjectRank(subject) {
  const i = TEACHER_SUBJECTS.indexOf(subject);
  return i < 0 ? 99 : i;
}

export function teacherNameCompare(a, b) {
  return studentNameCompare(a, b);
}

export function teacherSorted(store) {
  return (store.teachers || []).slice().sort((a, b) => {
    return (teacherSubjectRank(a.subject) - teacherSubjectRank(b.subject)) || teacherNameCompare(a, b);
  });
}

export function currentQuote(store) {
  const qs = store.quoteState || {};
  const list = store.quotes || [];
  if (!list.length) return { q: null, idx: 0 };
  const today = todayStr();
  let idx;
  if (qs.date !== today) {
    idx = Math.floor(Math.random() * list.length);
    return { q: list[idx], idx, fresh: { date: today, index: idx, manual: -1 } };
  }
  idx = (typeof qs.manual === "number" && qs.manual >= 0) ? qs.manual : qs.index;
  if (typeof idx !== "number" || isNaN(idx) || idx < 0 || idx >= list.length) idx = 0;
  return { q: list[idx], idx };
}

export function canonicalJson(value) {
  const sort = (v) => {
    if (Array.isArray(v)) return v.map(sort);
    if (v && typeof v === "object") {
      const out = {};
      Object.keys(v).sort().forEach((k) => { out[k] = sort(v[k]); });
      return out;
    }
    return v;
  };
  try { return JSON.stringify(sort(value)); } catch (e) { return ""; }
}

export function isEditingField() {
  const ae = document.activeElement;
  return !!(ae && /^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName));
}

export function dateHasRecord(store, d) {
  let hit = false;
  (store.homeworks || []).forEach((h) => { if (h.date === d) hit = true; });
  if (!hit) (store.leaves || []).forEach((l) => { if (l.date === d) hit = true; });
  if (!hit) (store.reminders || []).forEach((r) => { if (r.date === d) hit = true; });
  if (!hit) (store.messages || []).forEach((m) => { if (m.date === d) hit = true; });
  if (!hit) (store.swaps || []).forEach((s) => { if (s.dateA === d || s.dateB === d) hit = true; });
  if (!hit) {
    const snap = store.archive && store.archive[d];
    if (snap) {
      hit = (snap.homeworks || []).length || (snap.leaves || []).length || (snap.reminders || []).length
        || (snap.messages || []).length || (snap.birthdays || []).length || (snap.swaps || []).length;
    }
  }
  return !!hit;
}
