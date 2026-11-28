function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function sanitizePayload(payload) {
  const data = payload && typeof payload === "object" && !Array.isArray(payload) ? clone(payload) : {};
  if (data.settings && typeof data.settings === "object") {
    delete data.settings.adminPassword;
    delete data.settings.adminPasswordHash;
    delete data.settings.display;
  }
  return data;
}

function shortCodeFromName(name) {
  return String(name || "").replace(/[^0-9]/g, "").slice(0, 2) || "1";
}

function initialPayload(className) {
  return {
    settings: {
      className: className,
      classShort: shortCodeFromName(className),
      examDate: "",
      classSize: 0,
      eggText: "",
      guestPerms: {
        homework: false,
        echo: false,
        settings: false,
        students: false,
        links: false,
        remind: false,
        leave: true,
        journal: true,
        tools: true
      },
      homeSubjects: ["语文", "数学", "英语", "历史", "物理", "化学", "生物", "地理", "政治", "其他"],
      freshClass: true
    },
    homeworks: [],
    birthdays: [],
    teachers: [],
    links: [],
    leaves: [],
    reminders: [],
    messages: [],
    issues: [],
    swaps: [],
    expected: {},
    favorites: [],
    archive: {},
    quotes: [],
    quoteState: { date: "", index: 0, manual: -1 }
  };
}

function countArray(payload, key) {
  return Array.isArray(payload && payload[key]) ? payload[key].length : 0;
}

function stateSummary(payload) {
  const data = payload && typeof payload === "object" ? payload : {};
  return {
    homeworks: countArray(data, "homeworks"),
    students: countArray(data, "birthdays"),
    teachers: countArray(data, "teachers"),
    leaves: countArray(data, "leaves"),
    reminders: countArray(data, "reminders"),
    messages: countArray(data, "messages"),
    issues: countArray(data, "issues"),
    archivedDays: data.archive && typeof data.archive === "object" ? Object.keys(data.archive).length : 0,
    homeSubjects: data.settings && Array.isArray(data.settings.homeSubjects) ? data.settings.homeSubjects : []
  };
}

module.exports = { clone, sanitizePayload, initialPayload, stateSummary, shortCodeFromName };
