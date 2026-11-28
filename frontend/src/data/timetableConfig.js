import { HOME_SUBJECT_ORDER } from "./constants.js";
import { pad, parseDate } from "../utils.js";

export const SLOT_TYPES = {
  course: { label: "课程", color: "#5b9bd5" },
  break: { label: "课间", color: "#e0a93f" },
  selfstudy: { label: "自习", color: "#7b83d6" },
  lunch: { label: "午休", color: "#4fb79a" }
};

export const WEEKDAYS = [
  { value: 1, label: "周一" },
  { value: 2, label: "周二" },
  { value: 3, label: "周三" },
  { value: 4, label: "周四" },
  { value: 5, label: "周五" },
  { value: 6, label: "周六" },
  { value: 7, label: "周日" }
];

export function defaultSubjects() {
  return [];
}

function clock(minutes) {
  return pad(Math.floor(minutes / 60)) + ":" + pad(minutes % 60);
}

function buildSlots(periods, prefix) {
  const slots = [];
  periods.forEach((p, i) => {
    slots.push({
      id: prefix + "_course_" + (i + 1),
      type: "course",
      label: "",
      start: clock(p.start),
      end: clock(p.end)
    });
    const next = periods[i + 1];
    if (!next) return;
    const gap = next.start - p.end;
    if (gap >= 10) {
      const isLunch = p.end <= 12 * 60 + 30 && next.start >= 13 * 60;
      slots.push({
        id: prefix + "_gap_" + (i + 1),
        type: isLunch ? "lunch" : "break",
        label: isLunch ? "午休" : (gap >= 20 ? "大课间" : "课间"),
        start: clock(p.end),
        end: clock(next.start)
      });
    }
  });
  return slots;
}

export function defaultTimetableTemplates() {
  return [];
}

export function timeToMinutes(value) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(value || ""));
  if (!m) return null;
  const h = Number(m[1]), mi = Number(m[2]);
  if (h < 0 || h > 23 || mi < 0 || mi > 59) return null;
  return h * 60 + mi;
}

export function formatTimeRange(start, end) {
  return String(start || "") + "–" + String(end || "");
}

export function getWeekday(dateStr) {
  const d = parseDate(dateStr);
  if (!d) return 7;
  const w = d.getDay();
  return w === 0 ? 7 : w;
}

export function sortSlots(slots) {
  return (slots || []).slice().sort((a, b) => {
    const am = timeToMinutes(a.start);
    const bm = timeToMinutes(b.start);
    return (am == null ? 99999 : am) - (bm == null ? 99999 : bm);
  });
}

export function getTemplate(store, dateStr) {
  const weekday = getWeekday(dateStr);
  const day = store.daySchedules && store.daySchedules[dateStr];
  const override = day && day.templateId;
  const id = override || (store.weekTemplates && store.weekTemplates[String(weekday)]) || "";
  if (!id) return null;
  return (store.timetableTemplates || []).find((t) => t.id === id) || null;
}

export function getScheduleForDate(store, dateStr) {
  const weekday = getWeekday(dateStr);
  const day = (store.daySchedules && store.daySchedules[dateStr]) || {};
  const template = getTemplate(store, dateStr);
  if (!template) return null;
  const subjects = store.subjects || [];
  const courseMap = day.courses || {};
  const slots = sortSlots(template.slots).map((slot) => {
    const subject = slot.type === "course" ? subjects.find((s) => s.id === courseMap[slot.id]) || null : null;
    return { ...slot, subject, subjectName: subject ? subject.name : "未选科目" };
  });
  return { template, weekday, slots, day };
}

export function customTimetableState(store, dateStr, minutes) {
  const schedule = getScheduleForDate(store, dateStr);
  if (!schedule || !schedule.slots.length) return null;
  const slots = schedule.slots;
  const first = slots[0];
  const last = slots[slots.length - 1];
  const firstStart = timeToMinutes(first.start);
  const lastEnd = timeToMinutes(last.end);
  if (firstStart == null || lastEnd == null) return null;
  if (minutes < firstStart) {
    return { kind: "before", activeIndex: -1, nextIndex: 0, title: "早间", sub: "第一项 " + first.start + " 开始" };
  }
  for (let i = 0; i < slots.length; i += 1) {
    const slot = slots[i];
    const start = timeToMinutes(slot.start);
    const end = timeToMinutes(slot.end);
    if (start == null || end == null) continue;
    if (minutes >= start && minutes < end) {
      const type = SLOT_TYPES[slot.type] || SLOT_TYPES.course;
      const title = slot.type === "course" ? "上课中 · " + slot.subjectName : (slot.label || type.label);
      return {
        kind: "active", activeIndex: i, nextIndex: -1, slot,
        title,
        sub: slot.start + "–" + slot.end + " · 还剩 " + (end - minutes) + " 分钟"
      };
    }
  }
  if (minutes >= lastEnd) {
    return { kind: "after", activeIndex: -1, nextIndex: -1, title: "今日课程已结束", sub: last.end + " 放学" };
  }
  for (let i = 0; i < slots.length; i += 1) {
    const nextStart = timeToMinutes(slots[i].start);
    if (nextStart != null && minutes < nextStart) {
      return {
        kind: "between", activeIndex: -1, nextIndex: i, slot: slots[i],
        title: "课间休息",
        sub: "距 " + (slots[i].type === "course" ? slots[i].subjectName : (slots[i].label || SLOT_TYPES[slots[i].type].label)) + " " + slots[i].start + " 还有 " + (nextStart - minutes) + " 分钟"
      };
    }
  }
  return { kind: "between", activeIndex: -1, nextIndex: -1, title: "课间休息", sub: "" };
}

export function customRowState(i, state) {
  if (!state) return "";
  if (state.activeIndex === i) return "进行中";
  if (state.activeIndex >= 0 && i < state.activeIndex) return "已结束";
  if (state.nextIndex === i) return "下一项";
  if (state.kind === "after") return "已结束";
  return "";
}

export function slotLabel(slot) {
  return (SLOT_TYPES[slot.type] || SLOT_TYPES.course).label;
}
