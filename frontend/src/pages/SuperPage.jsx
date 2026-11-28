import React, { useEffect, useMemo, useState } from "react";
import {
  Alert, Box, Button, Chip, CircularProgress, Dialog, DialogActions,
  DialogContent, DialogTitle, IconButton, InputAdornment, MenuItem, Paper, Select,
  Snackbar, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TextField, Typography
} from "@mui/material";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import LogoutRoundedIcon from "@mui/icons-material/LogoutRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import { apiRequest } from "../api.js";

const SUPER_KEY = "classpanel_super_session_v2";

function useSuperSession() {
  const [session, setSession] = useState(() => {
    try { const raw = localStorage.getItem(SUPER_KEY); return raw ? JSON.parse(raw) : null; } catch (e) { return null; }
  });
  const save = (value) => {
    setSession(value);
    try {
      if (value) localStorage.setItem(SUPER_KEY, JSON.stringify(value));
      else localStorage.removeItem(SUPER_KEY);
    } catch (e) { /* ignore */ }
  };
  return [session, save];
}

function SuperLogin({ onLogin }) {
  const [form, setForm] = useState({ username: "", password: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  async function submit(e) {
    e.preventDefault();
    setErr("");
    if (!form.username || !form.password) { setErr("请输入账号和密码"); return; }
    setBusy(true);
    try {
      const data = await apiRequest("/auth/super/login", { public: true, method: "POST", body: form });
      onLogin(data);
    } catch (e2) {
      setErr(e2.message || "登录失败");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Box sx={{ minHeight: "100vh", display: "grid", placeItems: "center", p: 2 }}>
      <Paper className="login-card" elevation={0} sx={{ width: "min(430px,100%)", p: 4, borderRadius: 5 }}>
        <Box sx={{ width: 54, height: 54, borderRadius: 3, display: "grid", placeItems: "center", background: "linear-gradient(140deg,#ff9d7d,#ffcf6b)", color: "#fff", fontWeight: 900, fontSize: 22, mb: 2 }}>总</Box>
        <Typography variant="h5" sx={{ fontWeight: 900 }}>总管理员控制台</Typography>
        <Typography sx={{ mt: 0.5, mb: 2, color: "#75666d", fontSize: 12.5, fontWeight: 600, lineHeight: 1.7 }}>
          查看并管理所有班级。总管理员账号只能通过后端控制台注册。
        </Typography>
        <Box component="form" onSubmit={submit}>
          <TextField fullWidth size="small" label="总管理员账号" margin="dense" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} autoComplete="username" />
          <TextField fullWidth size="small" label="密码" type="password" margin="dense" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} autoComplete="current-password" />
          <Typography sx={{ minHeight: 18, mt: 0.5, color: "#d9697a", fontSize: 12, fontWeight: 700 }}>{err}</Typography>
          <Button fullWidth variant="contained" type="submit" disabled={busy} sx={{ mt: 1.5, py: 1 }}>{busy ? "登录中…" : "登录控制台"}</Button>
        </Box>
        <Typography sx={{ mt: 2, color: "#77676e", fontSize: 11, lineHeight: 1.8, textAlign: "center", fontWeight: 600 }}>
          注册命令：<code>cd backend &amp;&amp; npm run super:create</code><br />前端没有注册总管理员的入口
        </Typography>
      </Paper>
    </Box>
  );
}

function StatCard({ label, value, unit }) {
  return (
    <Paper elevation={0} sx={{ p: 2, border: "1px solid #f0e2d6", borderRadius: 3, background: "rgba(255,253,248,.95)" }}>
      <Typography sx={{ color: "#75666d", fontSize: 11.5, fontWeight: 700 }}>{label}</Typography>
      <Typography sx={{ mt: 0.5, fontSize: 28, fontWeight: 900, color: "#4f3a35" }}>{value}<Box component="span" sx={{ fontSize: 12, color: "#77676e", ml: 0.5 }}>{unit}</Box></Typography>
    </Paper>
  );
}

export default function SuperPage() {
  const [session, saveSession] = useSuperSession();
  const [checking, setChecking] = useState(!!session);
  const [stats, setStats] = useState({});
  const [classes, setClasses] = useState([]);
  const [codes, setCodes] = useState([]);
  const [codeForm, setCodeForm] = useState({ note: "", maxUses: 1, expiresInDays: 7 });
  const [codesLoading, setCodesLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState({ open: false, msg: "" });
  const [detail, setDetail] = useState(null);

  function notify(msg) { setToast({ open: true, msg }); }

  function codeStatusText(c) {
    if (c.status === "revoked") return "已撤销";
    if (c.status === "expired") return "已过期";
    if (c.status === "used_up") return "次数已用完";
    return "可用";
  }

  async function copyCode(code) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) await navigator.clipboard.writeText(code);
      else {
        const ta = document.createElement("textarea");
        ta.value = code; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); ta.remove();
      }
      notify("注册码已复制");
    } catch (e) { notify("复制失败，请手动选择注册码"); }
  }

  async function createCode() {
    if (!session) return;
    setCodesLoading(true);
    try {
      const data = await apiRequest("/super/registration-codes", {
        method: "POST",
        token: session.token,
        body: {
          note: codeForm.note.trim(),
          maxUses: Number(codeForm.maxUses),
          expiresInDays: Number(codeForm.expiresInDays) === 0 ? null : Number(codeForm.expiresInDays)
        }
      });
      setCodeForm((prev) => ({ ...prev, note: "" }));
      await loadAll();
      notify("注册码已创建：" + data.code.code);
      copyCode(data.code.code);
    } catch (e) {
      notify("创建失败：" + e.message);
    } finally {
      setCodesLoading(false);
    }
  }

  async function revokeCode(c) {
    if (!window.confirm("确定撤销注册码 " + c.code + " 吗？撤销后不能再用于注册班级。")) return;
    try {
      await apiRequest("/super/registration-codes/" + c.id, { method: "DELETE", token: session.token });
      await loadAll();
      notify("注册码已撤销");
    } catch (e) { notify("撤销失败：" + e.message); }
  }

  async function api(path, options = {}) {
    return apiRequest(path, { ...options, token: session && session.token });
  }

  useEffect(() => {
    if (!session) { setChecking(false); return; }
    apiRequest("/auth/me", { token: session.token }).then((me) => {
      if (me.role !== "super_admin") throw new Error("不是总管理员身份");
      const merged = { ...session, role: me.role, account: me.account };
      saveSession(merged);
      setChecking(false);
      loadAll(merged);
    }).catch(() => {
      saveSession(null);
      setChecking(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadAll(current = session) {
    if (!current) return;
    setLoading(true);
    try {
      const [ov, list, codeData] = await Promise.all([
        apiRequest("/super/overview", { token: current.token }),
        apiRequest("/super/classes", { token: current.token }),
        apiRequest("/super/registration-codes", { token: current.token })
      ]);
      setStats(ov.stats || {});
      setClasses(Array.isArray(list.classes) ? list.classes : []);
      setCodes(Array.isArray(codeData.codes) ? codeData.codes : []);
    } catch (e) {
      if (e.status === 401) { saveSession(null); setChecking(false); }
      else notify("加载失败：" + e.message);
    } finally {
      setLoading(false);
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return classes;
    return classes.filter((c) => String(c.name || "").toLowerCase().indexOf(q) >= 0
      || String(c.admin_username || "").toLowerCase().indexOf(q) >= 0
      || String(c.admin_display_name || "").toLowerCase().indexOf(q) >= 0);
  }, [classes, search]);

  function fmt(v) {
    if (!v) return "—";
    const d = new Date(v);
    if (isNaN(d.getTime())) return String(v);
    return d.toLocaleString("zh-CN", { hour12: false });
  }

  async function openDetail(id) {
    try {
      const data = await api("/super/classes/" + id);
      setDetail(data);
    } catch (e) { notify("加载详情失败：" + e.message); }
  }

  async function rename(c) {
    const value = window.prompt("输入新的班级名称（最多 10 个字符）", c.name);
    if (value === null) return;
    const name = String(value).trim();
    if (!name) { notify("班级名称不能为空"); return; }
    if (Array.from(name).length > 10) { notify("班级名称最多 10 个字符"); return; }
    try { await api("/super/classes/" + c.id, { method: "PATCH", body: { name } }); notify("班级名称已更新"); setDetail(null); loadAll(); }
    catch (e) { notify("修改失败：" + e.message); }
  }

  async function toggle(c) {
    const next = c.status === "active" ? "disabled" : "active";
    if (!window.confirm(next === "disabled" ? "确定停用该班级？停用后班级管理员和令牌登录客户端都无法访问。" : "确定重新启用该班级？")) return;
    try { await api("/super/classes/" + c.id, { method: "PATCH", body: { status: next } }); notify(next === "disabled" ? "班级已停用" : "班级已启用"); setDetail(null); loadAll(); }
    catch (e) { notify("操作失败：" + e.message); }
  }

  async function resetPassword(c) {
    const value = window.prompt("为班级「" + c.name + "」设置新的管理员密码（至少 6 位）", "");
    if (value === null) return;
    if (String(value).trim().length < 6) { notify("密码至少 6 个字符"); return; }
    try { await api("/super/classes/" + c.id + "/reset-admin-password", { method: "POST", body: { password: String(value).trim() } }); notify("管理员密码已重置"); setDetail(null); }
    catch (e) { notify("重置失败：" + e.message); }
  }

  async function remove(c) {
    const value = window.prompt("删除后班级数据、管理员和令牌都会永久删除。\n请输入班级名称「" + c.name + "」确认删除：", "");
    if (value === null) return;
    if (String(value).trim() !== c.name) { notify("班级名称不匹配，已取消删除"); return; }
    try { await api("/super/classes/" + c.id, { method: "DELETE" }); notify("班级已删除"); setDetail(null); loadAll(); }
    catch (e) { notify("删除失败：" + e.message); }
  }

  async function exportClass(c) {
    try {
      const data = await api("/classes/" + c.id + "/state");
      const blob = new Blob([JSON.stringify(data.payload || {}, null, 2)], { type: "application/json;charset=utf-8" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = c.name + "_数据.json";
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      notify("班级数据已导出");
    } catch (e) { notify("导出失败：" + e.message); }
  }

  if (checking) {
    return <Box sx={{ minHeight: "100vh", display: "grid", placeItems: "center" }}><CircularProgress sx={{ color: "#ff9d7d" }} /></Box>;
  }
  if (!session) {
    return (
      <SuperLogin onLogin={(data) => { saveSession(data); setChecking(false); loadAll(data); }} />
    );
  }

  const d = detail;
  return (
    <Box sx={{ maxWidth: 1440, mx: "auto", p: { xs: 2, md: 3 } }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap", mb: 2 }}>
        <Box sx={{ width: 46, height: 46, borderRadius: 2.5, display: "grid", placeItems: "center", background: "linear-gradient(140deg,#ff9d7d,#ffcf6b)", color: "#fff", fontWeight: 900 }}>总</Box>
        <Box>
          <Typography sx={{ fontSize: 20, fontWeight: 900 }}>总管理员控制台</Typography>
          <Typography sx={{ fontSize: 11.5, color: "#75666d", fontWeight: 600 }}>ClassPanel · MySQL · 全部班级</Typography>
        </Box>
        <Box sx={{ flex: 1 }} />
        <Typography sx={{ fontSize: 12, color: "#7b6660", fontWeight: 700 }}>{session.account && (session.account.displayName || session.account.username)}</Typography>
        <Button className="btn ghost tiny" startIcon={<RefreshRoundedIcon />} onClick={() => loadAll()}>刷新</Button>
        <Button className="btn ghost tiny" startIcon={<LogoutRoundedIcon />} onClick={() => { saveSession(null); setChecking(false); }}>退出登录</Button>
      </Box>

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(5,1fr)" }, gap: 1.5, mb: 2 }}>
        <StatCard label="班级总数" value={stats.classes_total || 0} unit="个" />
        <StatCard label="正常运行" value={stats.classes_active || 0} unit="个" />
        <StatCard label="已停用" value={stats.classes_disabled || 0} unit="个" />
        <StatCard label="有效令牌" value={stats.tokens_active || 0} unit="个" />
        <StatCard label="可用注册码" value={stats.registration_codes_active || 0} unit="个" />
      </Box>

      <Paper elevation={0} sx={{ mb: 2, p: 2, border: "1px solid #f0e2d6", borderRadius: 3, background: "rgba(255,253,248,.96)" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap", mb: 1.2 }}>
          <Typography sx={{ fontSize: 16, fontWeight: 900 }}>注册码</Typography>
          <Typography sx={{ fontSize: 11.5, color: "#75666d", fontWeight: 600 }}>创建后发给需要注册班级的老师；可限制次数和有效期</Typography>
          <Box sx={{ flex: 1 }} />
          <Chip size="small" label={"可用 " + (stats.registration_codes_active || 0) + " 个"} />
        </Box>
        <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", alignItems: "center", mb: 1.5 }}>
          <TextField size="small" placeholder="备注（选填），例如：高三班主任" value={codeForm.note} onChange={(e) => setCodeForm({ ...codeForm, note: e.target.value })} sx={{ flex: 1, minWidth: 200 }} />
          <Select size="small" value={codeForm.maxUses} onChange={(e) => setCodeForm({ ...codeForm, maxUses: e.target.value })} sx={{ width: 140 }}>
            <MenuItem value={1}>1 次</MenuItem>
            <MenuItem value={2}>2 次</MenuItem>
            <MenuItem value={5}>5 次</MenuItem>
            <MenuItem value={10}>10 次</MenuItem>
            <MenuItem value={0}>不限次数</MenuItem>
          </Select>
          <Select size="small" value={codeForm.expiresInDays} onChange={(e) => setCodeForm({ ...codeForm, expiresInDays: e.target.value })} sx={{ width: 130 }}>
            <MenuItem value={1}>1 天</MenuItem>
            <MenuItem value={7}>7 天</MenuItem>
            <MenuItem value={30}>30 天</MenuItem>
            <MenuItem value={90}>90 天</MenuItem>
            <MenuItem value={0}>永久有效</MenuItem>
          </Select>
          <Button variant="contained" onClick={createCode} disabled={codesLoading}>{codesLoading ? "创建中…" : "创建注册码"}</Button>
        </Box>
        <Stack spacing={0.75} sx={{ maxHeight: 260, overflow: "auto", pr: 0.5 }}>
          {codes.length ? codes.map((c) => (
            <Box key={c.id} sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap", p: 1, border: "1px dashed #f0e2d6", borderRadius: 2 }}>
              <Typography sx={{ fontFamily: "ui-monospace,Menlo,monospace", fontWeight: 900, letterSpacing: 1, color: c.status === "active" ? "#5a4038" : "#75666d" }}>{c.code}</Typography>
              <Chip size="small" label={codeStatusText(c)} color={c.status === "active" ? "success" : c.status === "expired" ? "warning" : "default"} />
              <Typography sx={{ fontSize: 11.5, color: "#75666d" }}>已用 {c.usedCount} / {c.maxUses === 0 ? "不限" : c.maxUses}</Typography>
              <Typography sx={{ fontSize: 11.5, color: "#75666d" }}>{c.permanent ? "永久" : "至 " + fmt(c.expiresAt)}</Typography>
              {c.note ? <Typography sx={{ fontSize: 11.5, color: "#6f5d56" }}>{c.note}</Typography> : null}
              <Box sx={{ flex: 1 }} />
              <Button size="small" variant="outlined" onClick={() => copyCode(c.code)}>复制</Button>
              {c.status === "active" ? <Button size="small" variant="outlined" color="error" onClick={() => revokeCode(c)}>撤销</Button> : null}
            </Box>
          )) : <Typography sx={{ fontSize: 12, color: "#75666d", py: 1 }}>还没有注册码，创建后即可注册班级。</Typography>}
        </Stack>
      </Paper>

      <Paper elevation={0} sx={{ border: "1px solid #f0e2d6", borderRadius: 3, overflow: "hidden", background: "rgba(255,253,248,.96)" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, p: 2, borderBottom: "1px solid #f5e9df", flexWrap: "wrap" }}>
          <Typography sx={{ fontSize: 16, fontWeight: 900 }}>班级列表</Typography>
          <Box sx={{ flex: 1 }} />
          <TextField size="small" placeholder="搜索班级名称 / 管理员账号" value={search} onChange={(e) => setSearch(e.target.value)} InputProps={{ startAdornment: <InputAdornment position="start"><SearchRoundedIcon fontSize="small" /></InputAdornment> }} sx={{ width: 280 }} />
        </Box>
        <TableContainer sx={{ maxHeight: "65vh" }}>
          <Table stickyHeader size="small">
            <TableHead>
              <TableRow>
                {["班级", "管理员", "学生 / 作业", "有效令牌", "状态", "最后更新", "操作"].map((h) => <TableCell key={h} sx={{ fontWeight: 800, background: "#fffaf5", color: "#6f5d56", fontSize: 11.5 }}>{h}</TableCell>)}
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.map((c) => (
                <TableRow key={c.id} hover>
                  <TableCell>
                    <Typography sx={{ fontWeight: 800, fontSize: 13.5 }}>{c.name}</Typography>
                    <Typography sx={{ color: "#75666d", fontSize: 11, fontWeight: 600 }}>#{c.id} · 创建于 {fmt(c.created_at)}</Typography>
                  </TableCell>
                  <TableCell><Typography sx={{ fontSize: 12.5 }}>{c.admin_username || "—"}</Typography><Typography sx={{ color: "#75666d", fontSize: 11 }}>{c.admin_display_name || ""}</Typography></TableCell>
                  <TableCell><Chip size="small" label={(c.students_count || 0) + " 学生"} sx={{ mr: 0.5 }} /><Chip size="small" label={(c.homeworks_count || 0) + " 作业"} /></TableCell>
                  <TableCell><Chip size="small" label={(c.active_tokens || 0) + " 个"} /></TableCell>
                  <TableCell>{c.status === "active" ? <Chip size="small" color="success" label="正常" /> : <Chip size="small" color="error" label="已停用" />}</TableCell>
                  <TableCell><Typography sx={{ fontSize: 11.5 }}>{fmt(c.state_updated_at || c.updated_at)}</Typography><Typography sx={{ color: "#75666d", fontSize: 10.5 }}>rev {c.revision || 0}</Typography></TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={0.5} useFlexGap flexWrap="wrap">
                      <Button size="small" variant="outlined" onClick={() => openDetail(c.id)}>详情</Button>
                      <Button size="small" variant="outlined" onClick={() => rename(c)}>改名</Button>
                      <Button size="small" variant="outlined" onClick={() => toggle(c)}>{c.status === "active" ? "停用" : "启用"}</Button>
                      <Button size="small" variant="outlined" onClick={() => resetPassword(c)}>重置密码</Button>
                      <Button size="small" variant="outlined" color="error" onClick={() => remove(c)}>删除</Button>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
              {!filtered.length ? <TableRow><TableCell colSpan={7}><Box sx={{ py: 4, textAlign: "center", color: "#75666d", fontSize: 13 }}>{loading ? "加载中…" : "没有匹配的班级"}</Box></TableCell></TableRow> : null}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <Dialog open={!!d} onClose={() => setDetail(null)} maxWidth="md" fullWidth>
        {d ? (
          <>
            <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Box><Typography sx={{ fontSize: 18, fontWeight: 900 }}>{d["class"].name}</Typography><Typography sx={{ fontSize: 12, color: "#75666d" }}>班级编号 #{d["class"].id} · {d["class"].status === "active" ? "正常运行" : "已停用"}</Typography></Box>
              <Box sx={{ flex: 1 }} />
              <IconButton onClick={() => setDetail(null)}><CloseRoundedIcon /></IconButton>
            </DialogTitle>
            <DialogContent dividers>
              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(3,1fr)" }, gap: 1.5 }}>
                <StatCard label="班级管理员" value={d.admin ? d.admin.username : "—"} unit="" />
                <StatCard label="学生人数" value={d.summary.students || 0} unit="人" />
                <StatCard label="作业条数" value={d.summary.homeworks || 0} unit="条" />
                <StatCard label="教师人数" value={d.summary.teachers || 0} unit="人" />
                <StatCard label="请假记录" value={d.summary.leaves || 0} unit="条" />
                <StatCard label="留言条数" value={d.summary.messages || 0} unit="条" />
              </Box>
              <Typography sx={{ mt: 2, mb: 0.5, fontWeight: 800, fontSize: 13 }}>班级设置</Typography>
              <Stack spacing={0.5}>
                <Typography sx={{ fontSize: 12 }}>高考日期：{d.settings.examDate || "未设置"}</Typography>
                <Typography sx={{ fontSize: 12 }}>主页科目：{(d.summary.homeSubjects || []).join("、") || "—"}</Typography>
                <Typography sx={{ fontSize: 12 }}>最后登录：{fmt(d.admin && d.admin.lastLoginAt)}</Typography>
                <Typography sx={{ fontSize: 12 }}>数据版本：rev {d.revision || 0} · {fmt(d.stateUpdatedAt)}</Typography>
              </Stack>
              <Typography sx={{ mt: 2, mb: 0.5, fontWeight: 800, fontSize: 13 }}>令牌登录（最近 100 个，仅客户端使用）</Typography>
              <Stack spacing={0.5}>
                {d.tokens.length ? d.tokens.map((t) => (
                  <Box key={t.id} sx={{ display: "flex", justifyContent: "space-between", gap: 1, p: 1, border: "1px dashed #f0e2d6", borderRadius: 2, fontSize: 12 }}>
                    <span>{t.label || "未命名令牌"}</span>
                    <span style={{ color: "#75666d" }}>{t.revoked ? "已撤销" : t.expired ? "已过期" : t.permanent ? "永久有效" : "有效至 " + fmt(t.expiresAt)}</span>
                  </Box>
                )) : <Typography sx={{ fontSize: 12, color: "#75666d" }}>还没有生成令牌</Typography>}
              </Stack>
              <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1, mt: 2, flexWrap: "wrap" }}>
                <Button variant="outlined" onClick={() => exportClass(d["class"])}>导出班级数据</Button>
                <Button variant="outlined" onClick={() => rename(d["class"])}>修改名称</Button>
                <Button variant="outlined" onClick={() => toggle(d["class"])}>{d["class"].status === "active" ? "停用班级" : "启用班级"}</Button>
                <Button variant="outlined" onClick={() => resetPassword(d["class"])}>重置管理员密码</Button>
                <Button variant="outlined" color="error" onClick={() => remove(d["class"])}>删除班级</Button>
              </Box>
            </DialogContent>
          </>
        ) : null}
      </Dialog>

      <Snackbar open={toast.open} autoHideDuration={2400} onClose={() => setToast({ open: false, msg: "" })} anchorOrigin={{ vertical: "bottom", horizontal: "center" }}>
        <Alert severity="info" variant="filled" icon={false} sx={{ borderRadius: 3, fontWeight: 700, bgcolor: "#5d4a48", color: "#fff" }}>{toast.msg}</Alert>
      </Snackbar>
    </Box>
  );
}
