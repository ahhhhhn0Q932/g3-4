import {
  ROSTER_NAMES, ROSTER_BIRTHDAYS, ROSTER_VERSION, BIRTHDAY_VERSION,
  DEFAULT_GUEST_PERMS, HOME_SUBJECT_ORDER, DEFAULT_HOME_SUBJECTS,
  DEFAULT_EGG_TEXT, QUOTES
} from "./constants.js";
import { defaultSubjects, defaultTimetableTemplates, SLOT_TYPES, timeToMinutes } from "./timetableConfig.js";

export function uid(){ return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

export function defaultQuotes(){
  return QUOTES.map(function(q, i){
    return { id: "q" + i, t: q.t, tag: q.tag || "其他", by: "" };
  });
}

function defaultStudents(){
return ROSTER_NAMES.map(function(n, i){
var b = ROSTER_BIRTHDAYS[n] || {};
return { id:"stu_" + (i + 1), name:n, md:b.md || "", year:b.year || 0, wish:"" };
});
}
function defaultTeachers(){
return [
{ id:"tea_chn", name:"孟娜", subject:"语文", role:"任课教师", md:"", year:0, wish:"" },
{ id:"tea_mat", name:"黄韡", subject:"数学", role:"任课教师", md:"", year:0, wish:"" },
{ id:"tea_eng", name:"陈莉", subject:"英语", role:"任课教师", md:"", year:0, wish:"" },
{ id:"tea_phy", name:"陈佳彬", subject:"物理", role:"任课教师", md:"", year:0, wish:"" },
{ id:"tea_chem", name:"赵瑞鑫", subject:"化学", role:"任课教师", md:"", year:0, wish:"" },
{ id:"tea_geo", name:"马晓琦", subject:"地理", role:"班主任", md:"", year:0, wish:"" }
];
}
/* 把名单一次导入学生档案：保留同名学生的生日/祝福，移除名单外旧测试数据 */
function applyRoster(s){
var old = {};
(s.birthdays || []).forEach(function(b){ if(b && b.name) old[b.name] = b; });
s.birthdays = ROSTER_NAMES.map(function(n, i){
var o = old[n], b = ROSTER_BIRTHDAYS[n] || {};
return {
id: (o && o.id) || ("stu_" + (i + 1)),
name: n,
md: (o && o.md) || b.md || "",
year: (o && o.year) || b.year || 0,
wish: (o && o.wish) || ""
};
});
s.settings.rosterVersion = ROSTER_VERSION;
s.settings.classSize = s.birthdays.length;
}
/* 只补生日，不替换名单；保留用户已填写的生日与祝福 */
function applyBirthdays(s){
var fixes = { "凌霄翩":"凌霄翮", "孙苡涵":"孙芑涵" };
(s.birthdays || []).forEach(function(b){
if(fixes[b.name]){
var oldName = b.name;
b.name = fixes[b.name];
(s.leaves || []).forEach(function(l){ if(l.name === oldName) l.name = b.name; });
}
var src = ROSTER_BIRTHDAYS[b.name];
if(!src) return;
if(!b.md) b.md = src.md;
if(!b.year) b.year = src.year;
});
s.settings.birthdayVersion = BIRTHDAY_VERSION;
}

function defaultLinks(){
return [{
id: "link_geo_review",
name: "地理一轮复习资料-百度网盘",
url: "https://pan.baidu.com/s/1sDsQZVdSMFN7oDLfB2fZTw?pwd=7269&qq-pf-to=pcqq.group"
}];
}
function defaultStore(){
return {
settings: { className:"高三(4)班", classShort:"4", examDate:"2027-06-07", classSize:ROSTER_NAMES.length, eggText:DEFAULT_EGG_TEXT, guestPerms:Object.assign({}, DEFAULT_GUEST_PERMS), homeSubjects:DEFAULT_HOME_SUBJECTS.slice(), rosterVersion:ROSTER_VERSION, birthdayVersion:BIRTHDAY_VERSION, freshClass:false },
homeworks: [], birthdays: defaultStudents(), teachers: defaultTeachers(), links: defaultLinks(), leaves: [], reminders: [], messages: [], issues: [], swaps: [],
expected: {},
favorites: [], archive: {}, quotes: defaultQuotes(),
quoteState: { date:"", index:0, manual:-1 },
subjects: defaultSubjects(),
timetableTemplates: defaultTimetableTemplates(),
weekTemplates: {},
daySchedules: {}
};
}
function normalize(obj){
var base = defaultStore();
if(!obj || typeof obj !== "object") return base;
var hadRoster = !!(obj.settings && obj.settings.rosterVersion === ROSTER_VERSION);
var hadBirthdayVersion = !!(obj.settings && obj.settings.birthdayVersion === BIRTHDAY_VERSION);
obj.settings = Object.assign({}, base.settings, obj.settings || {});
obj.settings.guestPerms = Object.assign({}, DEFAULT_GUEST_PERMS, obj.settings.guestPerms || {});
obj.settings.studentsLocked = !!obj.settings.studentsLocked;
/* 主页科目：只保留已知科目并统一顺序；旧数据或异常值回退为全部显示 */
var homeSubj = Array.isArray(obj.settings.homeSubjects) ? obj.settings.homeSubjects : null;
obj.settings.homeSubjects = homeSubj
? HOME_SUBJECT_ORDER.filter(function(s){ return homeSubj.indexOf(s) >= 0; })
: DEFAULT_HOME_SUBJECTS.slice();
if(!obj.settings.homeSubjects.length) obj.settings.homeSubjects = DEFAULT_HOME_SUBJECTS.slice();
if(!obj.settings.className || obj.settings.className.indexOf("\u9ad8\u4e8c") === 0){
obj.settings.className = "高三(4)班";
}
if(!obj.settings.classShort || obj.settings.classShort === "3") obj.settings.classShort = "4";
["homeworks","birthdays","leaves","reminders","messages","favorites","teachers","issues","swaps"].forEach(function(k){
obj[k] = Array.isArray(obj[k]) ? obj[k] : [];
});
if(!Array.isArray(obj.links)) obj.links = defaultLinks();
obj.links.forEach(function(l, i){
l.id = l.id || ("link_" + (i + 1) + "_" + uid());
l.name = String(l.name || "").trim();
l.url = String(l.url || "").trim();
if(l.url && !/^https?:\/\//i.test(l.url)) l.url = "https://" + l.url;
});
obj.links = obj.links.filter(function(l){ return !!l.name && /^https?:\/\//i.test(l.url); });
if(!obj.expected || typeof obj.expected !== "object" || Array.isArray(obj.expected)) obj.expected = {};
Object.keys(obj.expected).forEach(function(d){
if(!Array.isArray(obj.expected[d])) delete obj.expected[d];
});
var freshClass = !!obj.settings.freshClass;
if(!freshClass && !hadRoster) applyRoster(obj);
obj.birthdays.forEach(function(b, i){
if(!b.id) b.id = "stu_" + (i + 1);
b.name = String(b.name || "").trim();
b.md = String(b.md || "").trim();
b.wish = String(b.wish || "").trim();
b.locked = !!b.locked;
});
obj.birthdays = obj.birthdays.filter(function(b){ return !!b.name; });
if(!freshClass && !hadBirthdayVersion) applyBirthdays(obj);
if(!freshClass && !obj.teachers.length && !hadRoster) obj.teachers = defaultTeachers();
delete obj.settings.adminPassword;
delete obj.settings.adminPasswordHash;
obj.teachers.forEach(function(t, i){
if(!t.id) t.id = "tea_" + (i + 1);
t.name = String(t.name || "").trim();
t.subject = String(t.subject || "其他").trim();
t.role = String(t.role || "任课教师").trim();
t.md = String(t.md || "").trim();
t.wish = String(t.wish || "").trim();
});
obj.teachers = obj.teachers.filter(function(t){ return !!t.name; });
obj.issues.forEach(function(it, i){
if(!it || typeof it !== "object") return;
if(!it.id) it.id = "issue_" + (i + 1) + "_" + uid();
it.title = String(it.title || "").trim();
it.detail = String(it.detail || "").trim();
it.role = it.role === "admin" ? "admin" : "guest";
it.createdAt = Number(it.createdAt) || Date.now();
it.resolved = !!it.resolved;
it.replies = Array.isArray(it.replies) ? it.replies : [];
it.replies = it.replies.filter(function(r){ return r && typeof r === "object"; });
it.replies.forEach(function(r, j){
if(!r.id) r.id = "reply_" + (j + 1) + "_" + uid();
r.text = String(r.text || "").trim();
r.role = r.role === "admin" ? "admin" : "guest";
r.at = Number(r.at) || Date.now();
});
it.replies = it.replies.filter(function(r){ return !!r.text; });
});
obj.issues = obj.issues.filter(function(it){ return !!it.title; });
obj.swaps.forEach(function(s, i){
if(!s || typeof s !== "object") return;
if(!s.id) s.id = "swap_" + (i + 1) + "_" + uid();
s.type = s.type === "change" ? "change" : "swap";
s.dateA = String(s.dateA || "").slice(0,10);
s.dateB = String(s.dateB || "").slice(0,10);
s.periodA = parseInt(s.periodA, 10) || 1;
s.periodB = parseInt(s.periodB, 10) || 1;
s.createdAt = Number(s.createdAt) || Date.now();
});
obj.swaps = obj.swaps.filter(function(s){ return s && s.dateA && (s.type === "change" || s.dateB); });
obj.settings.classSize = obj.birthdays.length;
if(!Array.isArray(obj.quotes)) obj.quotes = defaultQuotes();
obj.quotes = obj.quotes.filter(function(q){ return q && String(q.t || "").trim(); });
obj.quotes.forEach(function(q, i){
if(!q.id) q.id = "q" + i + "_" + uid();
q.t = String(q.t || "").trim();
q.tag = q.tag || "其他";
q.by = String(q.by || "").trim();
});
obj.archive = (obj.archive && typeof obj.archive === "object") ? obj.archive : {};
obj.quoteState = Object.assign({}, base.quoteState, obj.quoteState || {});

/* 自定义课程表：科目、时刻表模板、每周模板分配、按天课程 */
if (!Array.isArray(obj.subjects)) obj.subjects = defaultSubjects();
obj.subjects = obj.subjects
  .filter(function (s) { return s && typeof s === "object" && String(s.name || "").trim(); })
  .map(function (s, i) {
    return {
      id: s.id || ("sub_" + (i + 1) + "_" + uid()),
      name: String(s.name || "").trim(),
      teacher: String(s.teacher || "").trim()
    };
  });
if (!Array.isArray(obj.timetableTemplates)) obj.timetableTemplates = defaultTimetableTemplates();
obj.timetableTemplates = obj.timetableTemplates
  .filter(function (t) { return t && typeof t === "object"; })
  .map(function (t, i) {
    const slots = (Array.isArray(t.slots) ? t.slots : [])
      .filter(function (slot) {
        return slot && SLOT_TYPES[slot.type] && timeToMinutes(slot.start) != null && timeToMinutes(slot.end) != null
          && timeToMinutes(slot.start) < timeToMinutes(slot.end);
      })
      .map(function (slot, j) {
        return {
          id: slot.id || ("slot_" + (i + 1) + "_" + (j + 1) + "_" + uid()),
          type: slot.type,
          label: String(slot.label || "").trim(),
          start: slot.start,
          end: slot.end
        };
      });
    return {
      id: t.id || ("tpl_" + (i + 1) + "_" + uid()),
      name: String(t.name || "").trim() || ("课程表 " + (i + 1)),
      slots: slots
    };
  });
if (!obj.weekTemplates || typeof obj.weekTemplates !== "object" || Array.isArray(obj.weekTemplates)) obj.weekTemplates = {};
Object.keys(obj.weekTemplates).forEach(function (key) {
  if (!/^[1-7]$/.test(key) || typeof obj.weekTemplates[key] !== "string") delete obj.weekTemplates[key];
});
if (!obj.daySchedules || typeof obj.daySchedules !== "object" || Array.isArray(obj.daySchedules)) obj.daySchedules = {};
Object.keys(obj.daySchedules).forEach(function (date) {
  const day = obj.daySchedules[date];
  if (!day || typeof day !== "object" || Array.isArray(day)) { delete obj.daySchedules[date]; return; }
  const courses = day.courses && typeof day.courses === "object" && !Array.isArray(day.courses) ? day.courses : {};
  obj.daySchedules[date] = {
    templateId: typeof day.templateId === "string" ? day.templateId : "",
    courses: courses
  };
});
return obj;
}

export {
  defaultStudents, defaultTeachers, applyRoster, applyBirthdays,
  defaultLinks, defaultStore, normalize
};
