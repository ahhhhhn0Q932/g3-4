const DEFAULT_GUEST_PERMS = {
  homework: false,
  echo: false,
  settings: false,
  students: false,
  links: false,
  remind: false,
  leave: true,
  journal: true,
  tools: true
};

const FIELD_PERMISSIONS = {
  homeworks: "homework",
  quotes: "echo",
  favorites: "echo",
  reminders: "remind",
  swaps: "remind",
  leaves: "leave",
  messages: "journal",
  birthdays: "students",
  links: "links",
  issues: null,
  archive: null,
  quoteState: null
};

function guestPerms(payload) {
  const raw = payload && payload.settings && payload.settings.guestPerms;
  return Object.assign({}, DEFAULT_GUEST_PERMS, raw && typeof raw === "object" ? raw : {});
}

/**
 * 访客提交的是整份班级数据。服务端只接收其权限允许的字段，
 * 其余字段一律保留数据库中的当前值，避免访客覆盖班级管理员的数据。
 */
function buildGuestPayload(currentPayload, incomingPayload) {
  const current = currentPayload && typeof currentPayload === "object" ? currentPayload : {};
  const incoming = incomingPayload && typeof incomingPayload === "object" ? incomingPayload : {};
  const perms = guestPerms(current);
  const output = Object.assign({}, current);

  Object.keys(FIELD_PERMISSIONS).forEach((field) => {
    const permission = FIELD_PERMISSIONS[field];
    if (permission === null) {
      if (field !== "settings" && incoming[field] !== undefined) output[field] = incoming[field];
      return;
    }
    if (perms[permission] && incoming[field] !== undefined) output[field] = incoming[field];
  });

  // 设置项仅管理员可改；学生人数是自动统计值，学生权限开放时允许随之更新
  const currentSettings = current.settings && typeof current.settings === "object" ? current.settings : {};
  const incomingSettings = incoming.settings && typeof incoming.settings === "object" ? incoming.settings : {};
  const nextSettings = Object.assign({}, currentSettings);
  if (perms.students && incomingSettings.classSize !== undefined) {
    nextSettings.classSize = incomingSettings.classSize;
  }
  output.settings = nextSettings;

  return output;
}

module.exports = { DEFAULT_GUEST_PERMS, FIELD_PERMISSIONS, guestPerms, buildGuestPayload };
