import { TIMETABLE } from "./constants.js";
import { pad, parseDate, todayStr, dateLabel } from "../utils.js";

export const TT_WEEK_PERIODS = [
  { n: 1, start: 7 * 60 + 50, end: 8 * 60 + 35 },
  { n: 2, start: 8 * 60 + 45, end: 9 * 60 + 30 },
  { n: 3, start: 10 * 60 + 5, end: 10 * 60 + 50 },
  { n: 4, start: 11 * 60, end: 11 * 60 + 45 },
  { n: 5, start: 13 * 60 + 20, end: 14 * 60 + 5 },
  { n: 6, start: 14 * 60 + 15, end: 15 * 60 },
  { n: 7, start: 15 * 60 + 15, end: 16 * 60 },
  { n: 8, start: 16 * 60 + 10, end: 16 * 60 + 55 },
  { n: 9, start: 16 * 60 + 55, end: 17 * 60 + 40 }
];

export const TT_SAT_PERIODS = [
  { n: 1, start: 7 * 60 + 40, end: 9 * 60 },
  { n: 2, start: 9 * 60 + 10, end: 10 * 60 + 30 },
  { n: 3, start: 10 * 60 + 40, end: 12 * 60 },
  { n: 4, start: 13 * 60 + 30, end: 14 * 60 + 30 },
  { n: 5, start: 14 * 60 + 40, end: 15 * 60 + 40 },
  { n: 6, start: 15 * 60 + 50, end: 16 * 60 + 50 }
];

export function ttClock(minutes) {
  return pad(Math.floor(minutes / 60)) + ":" + pad(minutes % 60);
}

export function ttDayName(w) {
  return ["周日", "周一", "周二", "周三", "周四", "周五", "周六"][w] || "";
}

export function ttPeriods(w) {
  return w === 6 ? TT_SAT_PERIODS : TT_WEEK_PERIODS;
}

export function ttBaseSubject(dateStr, idx) {
  const d = parseDate(dateStr);
  if (!d) return "";
  const day = TIMETABLE[d.getDay()] || [];
  return day[idx] || "";
}

export function ttSubjectAt(store, dateStr, idx) {
  let subj = ttBaseSubject(dateStr, idx);
  let tag = "";
  const list = (store.swaps || []).filter((s) => s.dateA === dateStr || s.dateB === dateStr)
    .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  list.forEach((s) => {
    if (s.type === "swap") {
      if (dateStr === s.dateA && idx === s.periodA - 1) { subj = ttBaseSubject(s.dateB, s.periodB - 1); tag = "调课"; }
      else if (dateStr === s.dateB && idx === s.periodB - 1) { subj = ttBaseSubject(s.dateA, s.periodA - 1); tag = "调课"; }
    } else if (s.subject) {
      if (dateStr === s.dateA && idx === s.periodA - 1) { subj = s.subject; tag = "改课"; }
    } else if (dateStr === s.dateB && idx === s.periodB - 1) {
      subj = ttBaseSubject(s.dateA, s.periodA - 1); tag = "调课";
    } else if (dateStr === s.dateA && idx === s.periodA - 1) {
      subj = "自习"; tag = "调课";
    }
  });
  return { subject: subj || "—", tag };
}

export function nextTeachingDate() {
  const d = new Date();
  while (d.getDay() === 0) d.setDate(d.getDate() + 1);
  return todayStr(d);
}

export function swapSummary(s) {
  const a = dateLabel(s.dateA) + " 第" + s.periodA + "节 " + (ttBaseSubject(s.dateA, s.periodA - 1) || "—");
  if (s.type === "change" && s.subject) return "改课：" + a + " → " + s.subject;
  if (s.type === "change") {
    const b0 = dateLabel(s.dateB) + " 第" + s.periodB + "节 " + (ttBaseSubject(s.dateB, s.periodB - 1) || "—");
    return "改课：" + a + " ⇢ " + b0;
  }
  const b = dateLabel(s.dateB) + " 第" + s.periodB + "节 " + (ttBaseSubject(s.dateB, s.periodB - 1) || "—");
  return "对调：" + a + " ⇄ " + b;
}

export function ttStateAt(store, w, minutes) {
  if (w === 0) return { kind: "weekend", idx: -1, next: -1, title: "周末没有课", sub: "今天没有课程安排，好好休息" };
  const periods = ttPeriods(w);
  const first = periods[0], last = periods[periods.length - 1];
  if (minutes < first.start) return { kind: "before", idx: -1, next: 0, title: "早间", sub: "第一节课 " + ttClock(first.start) + " 开始" };
  for (let i = 0; i < periods.length; i += 1) {
    const p = periods[i];
    if (minutes >= p.start && minutes < p.end) {
      const liveSub = ttSubjectAt(store, todayStr(), i).subject;
      return { kind: "class", idx: i, next: -1, title: "上课中 · 第" + (i + 1) + "节 " + liveSub, sub: ttClock(p.start) + "–" + ttClock(p.end) + " · 还剩 " + (p.end - minutes) + " 分钟", remain: p.end - minutes };
    }
  }
  if (minutes >= last.end) return { kind: "after", idx: -1, next: -1, title: "今日课程已结束", sub: ttClock(last.end) + " 放学 · 晚自习不显示" };
  const lunch = w === 6
    ? { start: 12 * 60, nap: 12 * 60 + 40, napEnd: 13 * 60 + 25, next: 3 }
    : { start: 11 * 60 + 45, nap: 12 * 60 + 40, napEnd: 13 * 60 + 10, next: 4 };
  if (minutes >= lunch.start && minutes < periods[lunch.next].start) {
    const nxLunch = periods[lunch.next];
    if (minutes < lunch.nap) return { kind: "break", idx: -1, next: lunch.next, title: "午餐", sub: "12:40 开始午休" };
    if (minutes < lunch.napEnd) return { kind: "break", idx: -1, next: lunch.next, title: "午休", sub: ttClock(lunch.nap) + "–" + ttClock(lunch.napEnd) + " · 距第" + (lunch.next + 1) + "节 " + ttClock(nxLunch.start) + " 还有 " + (nxLunch.start - minutes) + " 分钟" };
    return { kind: "break", idx: -1, next: lunch.next, title: "课间休息", sub: "距第" + (lunch.next + 1) + "节 " + ttClock(nxLunch.start) + " 还有 " + (nxLunch.start - minutes) + " 分钟", remain: nxLunch.start - minutes };
  }
  for (let j = 1; j < periods.length; j += 1) {
    const nx = periods[j], pv = periods[j - 1];
    if (minutes >= pv.end && minutes < nx.start) {
      let label = "课间休息";
      if (nx.start === 10 * 60 + 5) label = "大课间";
      return { kind: "break", idx: -1, next: j, title: label, sub: "距第" + (j + 1) + "节 " + ttClock(nx.start) + " 还有 " + (nx.start - minutes) + " 分钟", remain: nx.start - minutes };
    }
  }
  return { kind: "before", idx: -1, next: 0, title: "早间", sub: "第一节课 " + ttClock(first.start) + " 开始" };
}

export function ttRowClass(store, i, st) {
  if (!st) return "";
  if (st.kind === "class") {
    if (i === st.idx) return " now";
    if (i < st.idx) return " done";
    return "";
  }
  if (st.kind === "break") {
    if (i === st.next) return " next";
    if (i < st.next) return " done";
  }
  return "";
}

export function ttRowState(i, st) {
  if (!st) return "";
  if (st.kind === "class") {
    if (i === st.idx) return "进行中";
    if (i < st.idx) return "已结束";
  }
  if (st.kind === "break") {
    if (i === st.next) return "下一节";
    if (i < st.next) return "已结束";
  }
  if (st.kind === "before" && i === 0) return "下一节";
  if (st.kind === "after") return "已结束";
  return "";
}
