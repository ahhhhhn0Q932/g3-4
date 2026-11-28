import React, { useEffect, useState } from "react";
import {
  Avatar, Box, Button, Checkbox, Chip, Dialog, DialogActions, DialogContent, DialogTitle,
  IconButton, MenuItem, Paper, Select, Slider, TextField, Typography
} from "@mui/material";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import { useApp } from "../state/AppContext.jsx";
import { apiRequest } from "../api.js";
import {
  AVATAR_COLORS, HOME_SUBJECT_ORDER, TEACHER_ROLES,
  TEACHER_SUBJECTS, UI_THEMES
} from "../data/constants.js";
import {
  birthdayText, daysToBirthday, studentSorted, teacherSorted
} from "../utils.js";

function AccountDialog({ value, readOnly, onClose, onSave }) {
  const [form, setForm] = useState(value || { id: "", type: "member", username: "", displayName: "", password: "" });
  useEffect(() => {
    setForm(value || { id: "", type: "member", username: "", displayName: "", password: "" });
  }, [value]);
  const isEdit = !!form.id;
  const typeLabel = form.type === "admin" ? "班级管理员" : "普通账号";
  return (
    <Dialog open={!!value} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{isEdit ? "修改账号" : "注册账号"}</DialogTitle>
      <DialogContent>
        {readOnly ? <Typography sx={{ mb: 1, fontSize: 12, color: "#a85232", fontWeight: 700 }}>主账号信息只能由主账号修改。</Typography> : null}
        <Select fullWidth size="small" value={form.type} disabled={isEdit || readOnly} onChange={(e) => setForm({ ...form, type: e.target.value })} sx={{ mt: 1 }}>
          <MenuItem value="admin">班级管理员</MenuItem>
          <MenuItem value="member">普通账号（只读）</MenuItem>
        </Select>
        <TextField fullWidth margin="dense" label="账号" placeholder="登录账号" value={form.username} disabled={readOnly} onChange={(e) => setForm({ ...form, username: e.target.value })} />
        <TextField fullWidth margin="dense" label="显示名称" placeholder="显示名称" value={form.displayName} disabled={readOnly} onChange={(e) => setForm({ ...form, displayName: e.target.value })} />
        <TextField fullWidth margin="dense" type="password" label={isEdit ? "新密码（留空不修改）" : "密码"} value={form.password} disabled={readOnly} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder={isEdit ? "留空则不修改密码" : "至少 6 位"} />
        <Typography sx={{ mt: 1, fontSize: 11.5, color: "#75666d", lineHeight: 1.7 }}>
          {typeLabel}{isEdit ? "" : "注册后可登录班级"}。普通账号只能查看班级信息，不能修改作业、生日、课程表等任何内容。
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>取消</Button>
        <Button variant="contained" disabled={readOnly} onClick={() => onSave(form)}>保存</Button>
      </DialogActions>
    </Dialog>
  );
}

function StudentDialog({ value, onClose, onSave }) {
  const [form, setForm] = useState(value || { name: "", md: "", year: "", wish: "" });
  useEffect(() => { setForm(value || { name: "", md: "", year: "", wish: "" }); }, [value]);
  return (
    <Dialog open={!!value} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{form.id ? "修改学生档案" : "添加学生"}</DialogTitle>
      <DialogContent>
        <TextField fullWidth margin="dense" label="姓名" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <TextField fullWidth margin="dense" label="生日（MM-DD）" placeholder="例如 09-01" value={form.md} onChange={(e) => setForm({ ...form, md: e.target.value })} />
        <TextField fullWidth margin="dense" label="出生年份（选填）" value={form.year || ""} onChange={(e) => setForm({ ...form, year: e.target.value })} />
        <TextField fullWidth margin="dense" label="生日祝福" multiline minRows={2} value={form.wish || ""} onChange={(e) => setForm({ ...form, wish: e.target.value })} />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>取消</Button>
        <Button variant="contained" onClick={() => onSave(form)}>保存</Button>
      </DialogActions>
    </Dialog>
  );
}

function TeacherDialog({ value, onClose, onSave }) {
  const [form, setForm] = useState(value || { name: "", subject: "语文", role: "任课教师", md: "", year: "", wish: "" });
  useEffect(() => { setForm(value || { name: "", subject: "语文", role: "任课教师", md: "", year: "", wish: "" }); }, [value]);
  return (
    <Dialog open={!!value} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{form.id ? "修改教师档案" : "添加教师"}</DialogTitle>
      <DialogContent>
        <TextField fullWidth margin="dense" label="姓名" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <Select fullWidth margin="dense" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} sx={{ mt: 1 }}>
          {TEACHER_SUBJECTS.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
        </Select>
        <Select fullWidth value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} sx={{ mt: 1 }}>
          {TEACHER_ROLES.map((r) => <MenuItem key={r} value={r}>{r}</MenuItem>)}
        </Select>
        <TextField fullWidth margin="dense" label="生日（MM-DD）" value={form.md} onChange={(e) => setForm({ ...form, md: e.target.value })} />
        <TextField fullWidth margin="dense" label="出生年份（选填）" value={form.year || ""} onChange={(e) => setForm({ ...form, year: e.target.value })} />
        <TextField fullWidth margin="dense" label="生日祝福" multiline minRows={2} value={form.wish || ""} onChange={(e) => setForm({ ...form, wish: e.target.value })} />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>取消</Button>
        <Button variant="contained" onClick={() => onSave(form)}>保存</Button>
      </DialogActions>
    </Dialog>
  );
}

export default function SettingsPage() {
  const {
    store, isAdmin, canEdit, toast, saveSettings, saveHomeSubjects,
    addStudent, editStudent, delStudent, addTeacher, editTeacher, delTeacher,
    changePassword,
    uiPrefs, setPref, session, isMain, isMember
  } = useApp();
  const canSet = canEdit("settings");
  const canStudents = canEdit("students");
  const lockedAll = !!store.settings.studentsLocked;
  const students = studentSorted(store);
  const teachers = teacherSorted(store);

  const [className, setClassName] = useState(store.settings.className || "");
  const [examDate, setExamDate] = useState(store.settings.examDate || "");
  const [studentEdit, setStudentEdit] = useState(null);
  const [teacherEdit, setTeacherEdit] = useState(null);
  const [subjects, setSubjects] = useState(store.settings.homeSubjects || []);
  const [pwd, setPwd] = useState({ old: "", next: "", confirm: "" });
  const [accounts, setAccounts] = useState([]);
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [accountEdit, setAccountEdit] = useState(null);
  const currentUsername = (session && session.account && session.account.username) || "";

  async function loadAccounts() {
    if (!isAdmin || !session || !session.class) return;
    setAccountsLoading(true);
    try {
      const data = await apiRequest("/classes/" + session.class.id + "/accounts", { token: session.token });
      setAccounts(Array.isArray(data.accounts) ? data.accounts : []);
    } catch (e) {
      toast("账号列表加载失败：" + (e.message || e), "⚠️");
    } finally {
      setAccountsLoading(false);
    }
  }

  function canModifyAccount(acc) {
    return isMain || (acc.type === "admin" && acc.username === currentUsername);
  }

  async function saveAccount(form) {
    if (!session || !session.class) return;
    const username = String(form.username || "").trim();
    const displayName = String(form.displayName || "").trim();
    const password = String(form.password || "");
    if (!username) { toast("请填写账号", "👤"); return; }
    try {
      if (form.id) {
        const body = { username, displayName };
        if (password) body.password = password;
        await apiRequest("/classes/" + session.class.id + "/accounts/" + form.type + "/" + form.id, { method: "PATCH", token: session.token, body });
      } else {
        if (password.length < 6) { toast("密码至少 6 个字符", "🔒"); return; }
        await apiRequest("/classes/" + session.class.id + "/accounts", { method: "POST", token: session.token, body: { role: form.type, username, displayName, password } });
      }
      setAccountEdit(null);
      await loadAccounts();
      toast("账号已保存", "👤");
    } catch (e) {
      toast("保存失败：" + (e.message || e), "⚠️");
    }
  }

  async function deleteAccount(acc) {
    if (!session || !session.class) return;
    if (!window.confirm("确定删除账号 " + acc.username + " 吗？删除后该账号将无法登录。")) return;
    try {
      await apiRequest("/classes/" + session.class.id + "/accounts/" + acc.type + "/" + acc.id, { method: "DELETE", token: session.token });
      await loadAccounts();
      toast("账号已删除", "🗑");
    } catch (e) {
      toast("删除失败：" + (e.message || e), "⚠️");
    }
  }

  useEffect(() => {
    if (isAdmin && session) loadAccounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, session && session.token]);

  useEffect(() => { setClassName(store.settings.className || ""); setExamDate(store.settings.examDate || ""); }, [store.settings.className, store.settings.examDate]);
  useEffect(() => { setSubjects(store.settings.homeSubjects || []); }, [store.settings.homeSubjects]);


  function saveClassInfo() {
    if (!canSet) return;
    if (!className.trim()) { toast("班级名称不能为空", "🏫"); return; }
    if (Array.from(className.trim()).length > 10) { toast("班级名称最多 10 个字符", "🏫"); return; }
    saveSettings({ className: className.trim(), examDate });
    toast("设置已保存", "⚙️");
  }

  function saveSubj() {
    if (!canSet) return;
    if (!subjects.length) { toast("请至少选择一个主页显示科目", "📚"); return; }
    saveHomeSubjects(subjects);
    toast("主页科目已保存", "📚");
  }

  function submitStudent(form) {
    if (!form.name.trim()) { toast("请填写学生姓名", "👥"); return; }
    const payload = { name: form.name.trim(), md: form.md.trim(), year: Number(form.year) || 0, wish: form.wish || "" };
    if (form.id) editStudent(form.id, payload); else addStudent(payload);
    setStudentEdit(null);
    toast("学生档案已保存", "👥");
  }

  function submitTeacher(form) {
    if (!form.name.trim()) { toast("请填写教师姓名", "👩‍🏫"); return; }
    const payload = { name: form.name.trim(), subject: form.subject, role: form.role, md: form.md.trim(), year: Number(form.year) || 0, wish: form.wish || "" };
    if (form.id) editTeacher(form.id, payload); else addTeacher(payload);
    setTeacherEdit(null);
    toast("教师档案已保存", "👩‍🏫");
  }

  async function submitPassword() {
    if (!isAdmin) return;
    if (pwd.next.length < 6 || pwd.next.length > 72) { toast("新密码需为 6-72 个字符", "🔒"); return; }
    if (pwd.next !== pwd.confirm) { toast("两次输入的新密码不一致", "🔒"); return; }
    try {
      await changePassword(pwd.old, pwd.next);
      setPwd({ old: "", next: "", confirm: "" });
    } catch (e) { toast(e.message || "密码修改失败", "🔒"); }
  }

  return (
    <>
      <Box className="page-hd">
        <Box className="ico orange">⚙️</Box>
        <Box><Typography component="h1">设置</Typography><Typography component="p">{canSet ? "班级信息、档案与权限" : isMember ? "普通账号 · 设置只读" : "访客模式 · 设置只读"}</Typography></Box>
      </Box>

      <Box className="settings-grid" sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2 }}>
        <Paper className="card" elevation={0}>
          <Box className="card-hd"><Box className="ico orange">🏫</Box><Typography component="h2">班级信息</Typography></Box>
          <Box sx={{ display: "grid", gap: 1.5 }}>
            <TextField size="small" label="班级名称" value={className} inputProps={{ maxLength: 10 }} disabled={!canSet} onChange={(e) => setClassName(e.target.value)} />
            <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.5 }}>
              <TextField size="small" type="date" label="高考日期" value={examDate} disabled={!canSet} onChange={(e) => setExamDate(e.target.value)} InputLabelProps={{ shrink: true }} />
              <Box className="stu-total-box"><b>{students.length}</b><span>人 · 学生档案自动统计</span></Box>
            </Box>
          </Box>
          {canSet ? <Button className="btn" sx={{ mt: 1.5 }} onClick={saveClassInfo}>保存设置</Button> : null}
        </Paper>

        <Paper className="card" elevation={0}>
          <Box className="card-hd"><Box className="ico blue">👥</Box><Typography component="h2">学生档案</Typography><Box className="spacer" /><Typography className="sub">{students.length} 人{lockedAll ? " · 已锁定" : ""}</Typography></Box>
          <Box className="btn-row" sx={{ mb: 1 }}>
            {canStudents && !lockedAll ? <Button className="btn tiny" onClick={() => setStudentEdit({ name: "", md: "", year: "", wish: "" })}>＋ 添加学生</Button> : null}
            {canSet ? <Button className="btn ghost tiny" onClick={() => saveSettings({ studentsLocked: !lockedAll })}>{lockedAll ? "解除锁定" : "全班锁定"}</Button> : null}
          </Box>
          <Box className="stu-list">
            {students.length ? students.map((b, i) => {
              const days = b.md ? daysToBirthday(b.md, new Date()) : 9999;
              return (
                <Box className="stu-row" key={b.id}>
                  <Avatar className="avatar" sx={{ bgcolor: AVATAR_COLORS[i % AVATAR_COLORS.length], width: 34, height: 34, fontSize: 14 }}>{String(b.name || "?").slice(-1)}</Avatar>
                  <Box className="stu-main">
                    <Box className="stu-name">{b.name}{lockedAll ? <span className="stu-lock">全班锁定</span> : null}</Box>
                    <Box className="stu-bd">{birthdayText(b.md)}{b.md ? " · " + (days === 0 ? "今天生日" : days + " 天后") : ""}</Box>
                  </Box>
                  {canStudents ? (
                    <Box className="stu-actions">
                      <IconButton size="small" onClick={() => setStudentEdit({ ...b, year: b.year || "" })}>✎</IconButton>
                      {!lockedAll ? <IconButton size="small" onClick={() => delStudent(b.id)}><CloseRoundedIcon fontSize="small" /></IconButton> : null}
                    </Box>
                  ) : null}
                </Box>
              );
            }) : <Box className="j-empty">还没有学生档案</Box>}
          </Box>
        </Paper>
      </Box>

      <Paper className="card" elevation={0} sx={{ mt: 2 }}>
        <Box className="card-hd"><Box className="ico purple">👩‍🏫</Box><Typography component="h2">教师档案</Typography><Box className="spacer" /><Typography className="sub">{teachers.length} 人</Typography></Box>
        <Box className="btn-row" sx={{ mb: 1 }}>
          {canSet ? <Button className="btn tiny" onClick={() => setTeacherEdit({ name: "", subject: "语文", role: "任课教师", md: "", year: "", wish: "" })}>＋ 添加教师</Button> : null}
        </Box>
        <Box className="teacher-list">
          {teachers.length ? teachers.map((t, i) => (
            <Box className="teacher-row" key={t.id}>
              <Avatar className="avatar" sx={{ bgcolor: AVATAR_COLORS[i % AVATAR_COLORS.length], width: 34, height: 34, fontSize: 14 }}>{String(t.name || "?").slice(-1)}</Avatar>
              <Box className="teacher-main">
                <Box className="teacher-line">
                  <span className="teacher-name">{t.name}</span>
                  <span className="teacher-sub" style={{ background: "#f3e7dc" }}>{t.subject}</span>
                  {t.role === "班主任" ? <span className="teacher-role">班主任</span> : null}
                </Box>
                <Box className="teacher-bd">{birthdayText(t.md)}</Box>
              </Box>
              {canSet ? (
                <Box className="teacher-actions">
                  <IconButton size="small" onClick={() => setTeacherEdit({ ...t, year: t.year || "" })}>✎</IconButton>
                  <IconButton size="small" onClick={() => delTeacher(t.id)}><CloseRoundedIcon fontSize="small" /></IconButton>
                </Box>
              ) : null}
            </Box>
          )) : <Box className="j-empty">还没有教师档案</Box>}
        </Box>
      </Paper>

      {isAdmin ? (
        <Paper className="card" elevation={0} sx={{ mt: 2 }}>
          <Box className="card-hd"><Box className="ico purple">👤</Box><Typography component="h2">账号管理</Typography><Box className="spacer" /><Typography className="sub">主账号 · 管理员 · 普通账号</Typography></Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap", mb: 1.2 }}>
            <Typography className="sync-desc" sx={{ mb: 0, flex: 1 }}>
              第一个注册的班级管理员是主账号，不可删除，且只有主账号能修改其他账号的信息和密码。普通账号只能查看班级信息。
            </Typography>
            <Button className="btn tiny" onClick={() => setAccountEdit({ id: "", type: "member", username: "", displayName: "", password: "" })}>＋ 注册账号</Button>
          </Box>
          <Box sx={{ display: "grid", gap: 1 }}>
            {accountsLoading ? <Box className="mini-empty">正在加载账号…</Box> : accounts.length ? accounts.map((acc) => {
              const canMod = canModifyAccount(acc);
              const isSelf = acc.type === "admin" && acc.username === currentUsername;
              return (
                <Box key={acc.type + acc.id} sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap", p: 1, border: "1px dashed #f0e2d6", borderRadius: 2 }}>
                  <Avatar sx={{ width: 32, height: 32, fontSize: 13, bgcolor: acc.isMain ? "#a85232" : acc.type === "admin" ? "#5b9bd5" : "#7fbf5f" }}>{String(acc.displayName || acc.username || "?").slice(0, 1).toUpperCase()}</Avatar>
                  <Box sx={{ minWidth: 160 }}>
                    <Typography sx={{ fontSize: 13, fontWeight: 800, color: "#4a3d44" }}>{acc.displayName || acc.username}{isSelf ? "（当前账号）" : ""}</Typography>
                    <Typography sx={{ fontSize: 11.5, color: "#75666d" }}>@{acc.username}</Typography>
                  </Box>
                  {acc.isMain ? <Chip size="small" label="主账号" color="warning" /> : acc.type === "admin" ? <Chip size="small" label="管理员" color="primary" /> : <Chip size="small" label="普通账号" color="success" />}
                  <Typography sx={{ fontSize: 11, color: "#75666d" }}>最近登录：{acc.lastLoginAt ? new Date(acc.lastLoginAt).toLocaleString("zh-CN", { hour12: false }) : "从未"}</Typography>
                  <Box sx={{ flex: 1 }} />
                  <Button size="small" variant="outlined" disabled={!canMod} onClick={() => setAccountEdit({ ...acc, password: "" })}>修改</Button>
                  <Button size="small" variant="outlined" color="error" disabled={acc.isMain || isSelf} onClick={() => deleteAccount(acc)}>删除</Button>
                </Box>
              );
            }) : <Box className="mini-empty">账号列表为空</Box>}
          </Box>
          {!isMain ? <Typography className="pref-note">只有主账号可以修改其他账号；你可以注册和删除账号，也可以修改自己的账号。</Typography> : null}
        </Paper>
      ) : null}

      <Paper className="card" elevation={0} sx={{ mt: 2 }}>
        <Box className="card-hd"><Box className="ico blue">📚</Box><Typography component="h2">主页显示科目</Typography><Box className="spacer" /><Typography className="sub">已选 {subjects.length} / {HOME_SUBJECT_ORDER.length}</Typography></Box>
        <Typography className="sync-desc">勾选需要在主页显示的科目，未勾选的科目不会出现在今日总览、历史回看和显示模式中（作业数据仍会保留）。</Typography>
        <Box className="perm-grid">
          {HOME_SUBJECT_ORDER.map((s) => (
            <label className="perm-item" key={s}>
              <Checkbox size="small" checked={subjects.indexOf(s) >= 0} disabled={!canSet} onChange={(e) => setSubjects((prev) => e.target.checked ? [...prev, s] : prev.filter((x) => x !== s))} />
              <span><b>{s}</b><i>{s === "其他" ? "自定义科目与旧数据归档" : "主页作业分组"}</i></span>
            </label>
          ))}
        </Box>
        {canSet ? (
          <Box className="btn-row" sx={{ mt: 1.5 }}>
            <Button className="btn ghost tiny" onClick={() => setSubjects(HOME_SUBJECT_ORDER.slice())}>全选</Button>
            <Button className="btn ghost tiny" onClick={() => setSubjects([])}>清空</Button>
            <Button className="btn" onClick={saveSubj}>保存主页科目</Button>
          </Box>
        ) : null}
        <Typography className="pref-note">主页始终按「语文 → 数学 → 英语 → 历史 → 物理 → 化学 → 生物 → 地理 → 政治 → 其他」的固定顺序排列。</Typography>
      </Paper>

      {isAdmin ? (
        <Paper className="card" elevation={0} sx={{ mt: 2 }}>
          <Box className="card-hd"><Box className="ico orange">🔐</Box><Typography component="h2">管理员密码</Typography><Box className="spacer" /><Typography className="sub">由后端数据库保存</Typography></Box>
          <Box className="pwd-grid">
            <TextField size="small" type="password" label="当前密码" value={pwd.old} onChange={(e) => setPwd({ ...pwd, old: e.target.value })} />
            <TextField size="small" type="password" label="新密码" value={pwd.next} onChange={(e) => setPwd({ ...pwd, next: e.target.value })} placeholder="至少 6 位" />
            <TextField size="small" type="password" label="确认新密码" value={pwd.confirm} onChange={(e) => setPwd({ ...pwd, confirm: e.target.value })} />
          </Box>
          <Button className="btn" sx={{ mt: 1.5 }} onClick={submitPassword}>修改密码</Button>
          <Typography className="echo-tip">密码只以哈希形式保存在后端数据库，修改后立即生效。</Typography>
        </Paper>
      ) : null}

      <Paper className="card" elevation={0} sx={{ mt: 2 }}>
        <Box className="card-hd"><Box className="ico purple">🔠</Box><Typography component="h2">显示与字体</Typography><Box className="spacer" /><Typography className="sub">仅本机</Typography></Box>
        <Box className="pref-grid">
          <Box className="pref-row">
            <label>主题色</label>
            <Select size="small" value={uiPrefs.theme} onChange={(e) => setPref("theme", e.target.value)}>
              {UI_THEMES.map((t) => <MenuItem key={t.key} value={t.key}>{t.name}</MenuItem>)}
            </Select>
          </Box>
          <Box className="pref-row">
            <label>全局字号 {Math.round(uiPrefs.fontScale * 100)}%</label>
            <Slider min={0.8} max={1.4} step={0.05} value={uiPrefs.fontScale} onChange={(e, v) => setPref("fontScale", v)} />
          </Box>
          <Box className="pref-row">
            <label>显示模式字号 {Math.round(uiPrefs.displayFontScale * 100)}%</label>
            <Slider min={0.8} max={1.6} step={0.05} value={uiPrefs.displayFontScale} onChange={(e, v) => setPref("displayFontScale", v)} />
          </Box>
          <Box className="pref-row">
            <label>显示模式滚动</label>
            <label className="pref-check"><Checkbox size="small" checked={uiPrefs.scrollOn} onChange={(e) => setPref("scrollOn", e.target.checked)} /> 自动循环滚动</label>
          </Box>
          <Box className="pref-row">
            <label>滚动速度 {uiPrefs.scrollSpeed} px/s</label>
            <Slider min={4} max={100} step={2} value={uiPrefs.scrollSpeed} onChange={(e, v) => setPref("scrollSpeed", v)} />
          </Box>
        </Box>
        <Typography className="pref-note">显示模式字号只在「今日总览 · 显示模式」生效。显示设置只保存在本机。</Typography>
      </Paper>

      <AccountDialog value={accountEdit} readOnly={accountEdit ? !canModifyAccount(accountEdit) : false} onClose={() => setAccountEdit(null)} onSave={saveAccount} />
      <StudentDialog value={studentEdit} onClose={() => setStudentEdit(null)} onSave={submitStudent} />
      <TeacherDialog value={teacherEdit} onClose={() => setTeacherEdit(null)} onSave={submitTeacher} />
    </>
  );
}
