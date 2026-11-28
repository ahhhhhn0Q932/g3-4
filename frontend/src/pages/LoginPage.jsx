import React, { useState } from "react";
import { Box, Button, Checkbox, FormControlLabel, Stack, TextField, Typography } from "@mui/material";
import LockOpenRoundedIcon from "@mui/icons-material/LockOpenRounded";
import AddHomeRoundedIcon from "@mui/icons-material/AddHomeRounded";
import PersonOutlineRoundedIcon from "@mui/icons-material/PersonOutlineRounded";
import { useApp } from "../state/AppContext.jsx";

const tabs = [
  { key: "admin", label: "班级管理员", icon: <LockOpenRoundedIcon fontSize="small" /> },
  { key: "member", label: "普通账号", icon: <PersonOutlineRoundedIcon fontSize="small" /> },
  { key: "register", label: "注册班级", icon: <AddHomeRoundedIcon fontSize="small" /> }
];

export default function LoginPage() {
  const { loginClass, registerClass, appConfig, configureStorage, refreshConfig } = useApp();
  const isLocal = appConfig.mode === "local";
  const needsStorage = isLocal && !appConfig.storageConfigured;
  const storageError = isLocal && appConfig.storageConfigured ? (appConfig.storageError || "") : "";
  const firstSetup = isLocal && appConfig.storageConfigured && !appConfig.classExists;
  const visibleTabs = isLocal ? tabs.filter((t) => t.key !== "register") : tabs;
  const [tab, setTab] = useState("admin");
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState({ admin: "", member: "", register: "" });
  const [admin, setAdmin] = useState({ username: "", password: "" });
  const [member, setMember] = useState({ username: "", password: "" });
  const [reg, setReg] = useState({
    className: "", adminUsername: "", adminDisplayName: "", adminPassword: "", adminPassword2: "", registrationCode: ""
  });
  const [storageChoice, setStorageChoice] = useState("sqlite");
  const [db, setDb] = useState({ host: "", port: "5432", database: "postgres", user: "postgres", password: "", ssl: true });
  const [storageErr, setStorageErr] = useState("");

  const setError = (key, message) => setErr((prev) => ({ ...prev, [key]: message }));

  async function submitAdmin(e) {
    e.preventDefault();
    setError("admin", "");
    if (!admin.username || !admin.password) {
      setError("admin", "请输入管理员账号和密码");
      return;
    }
    setBusy("admin");
    try {
      await loginClass(admin.username.trim(), admin.password);
    } catch (e2) {
      setError("admin", e2.message || "登录失败");
    } finally {
      setBusy("");
    }
  }

  async function submitMember(e) {
    e.preventDefault();
    setError("member", "");
    if (!member.username || !member.password) {
      setError("member", "请输入普通账号和密码");
      return;
    }
    setBusy("member");
    try {
      await loginClass(member.username.trim(), member.password);
    } catch (e2) {
      setError("member", e2.message || "登录失败");
    } finally {
      setBusy("");
    }
  }

  async function submitStorage(e) {
    e.preventDefault();
    setStorageErr("");
    if (storageChoice === "supabase") {
      if (!db.host.trim() || !db.database.trim() || !db.user.trim() || !db.password) {
        setStorageErr("请填写完整的数据库地址、库名、用户名和密码");
        return;
      }
      const port = Number(db.port);
      if (!Number.isInteger(port) || port < 1 || port > 65535) {
        setStorageErr("数据库端口不正确");
        return;
      }
    }
    if (!window.confirm("存储方式选定后不可更改，确定使用" + (storageChoice === "supabase" ? " Supabase " : "本地 SQLite ") + "吗？")) return;
    setBusy("storage");
    try {
      await configureStorage(storageChoice === "supabase" ? {
        mode: "supabase",
        supabase: {
          host: db.host.trim(), port: Number(db.port), database: db.database.trim(),
          user: db.user.trim(), password: db.password, ssl: !!db.ssl
        }
      } : { mode: "sqlite" });
    } catch (e2) {
      setStorageErr(e2.message || "连接失败");
    } finally {
      setBusy("");
    }
  }

  async function submitRegister(e) {
    e.preventDefault();
    setError("register", "");
    if (!isLocal && !reg.registrationCode.trim()) { setError("register", "请填写总管理员提供的注册码"); return; }
    if (!reg.className.trim()) { setError("register", "请填写班级名称"); return; }
    if (Array.from(reg.className.trim()).length > 10) { setError("register", "班级名称最多 10 个字符"); return; }
    if (reg.adminPassword !== reg.adminPassword2) { setError("register", "两次输入的密码不一致"); return; }
    setBusy("register");
    try {
      const payload = {
        className: reg.className.trim(),
        adminUsername: reg.adminUsername.trim(),
        adminDisplayName: reg.adminDisplayName.trim(),
        adminPassword: reg.adminPassword
      };
      if (!isLocal) payload.registrationCode = reg.registrationCode.trim().toUpperCase();
      await registerClass(payload);
    } catch (e2) {
      setError("register", e2.message || "注册失败");
    } finally {
      setBusy("");
    }
  }

  return (
    <Box className="login-gate">
      <Box className="login-card">
        <Box className="login-logo">班</Box>
        <Typography component="h1">班级管理系统</Typography>
        <Typography className="login-sub">
          {needsStorage ? "本机单机模式 · 选择数据存储方式" : storageError ? "本机单机模式 · 数据库连接异常" : firstSetup ? "本机单机模式 · 首次设置" : isLocal ? "本机单机模式 · " + (appConfig.storageMode === "supabase" ? "Supabase 数据库" : "本地 SQLite") : "班级数据由 MySQL 服务器统一保存"}
        </Typography>

        {needsStorage ? (
          <Box className="login-panel on" component="form" id="localStorageForm" onSubmit={submitStorage}>
            <Typography className="login-hint">请选择数据存储方式。选定后会写入本机配置并锁定，不能再次更改。</Typography>
            <Box className="storage-options">
              <Box
                className={"storage-option" + (storageChoice === "sqlite" ? " on" : "")}
                role="button" tabIndex={0}
                onClick={() => setStorageChoice("sqlite")}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setStorageChoice("sqlite"); }}
              >
                <span className="storage-ico">💾</span>
                <span><b>本地 SQLite</b><i>数据保存在这台电脑，不需要数据库账号</i></span>
              </Box>
              <Box
                className={"storage-option" + (storageChoice === "supabase" ? " on" : "")}
                role="button" tabIndex={0}
                onClick={() => setStorageChoice("supabase")}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setStorageChoice("supabase"); }}
              >
                <span className="storage-ico" style={{ fontWeight: 900, color: "#3fa383" }}>S</span>
                <span><b>Supabase</b><i>连接 Supabase PostgreSQL，数据存到远端数据库</i></span>
              </Box>
            </Box>
            {storageChoice === "supabase" ? (
              <>
                <Typography className="login-hint" sx={{ mt: 1.5 }}>Supabase 数据库连接信息（在 Dashboard → Connect 中查看）</Typography>
                <Box className="login-grid">
                  <Box>
                    <Typography className="fl" component="label">数据库地址</Typography>
                    <TextField fullWidth size="small" value={db.host} onChange={(e) => setDb({ ...db, host: e.target.value })} placeholder="db.xxxx.supabase.co" />
                  </Box>
                  <Box>
                    <Typography className="fl" component="label">端口</Typography>
                    <TextField fullWidth size="small" type="number" value={db.port} onChange={(e) => setDb({ ...db, port: e.target.value })} placeholder="5432" />
                  </Box>
                </Box>
                <Box className="login-grid">
                  <Box>
                    <Typography className="fl" component="label">数据库名</Typography>
                    <TextField fullWidth size="small" value={db.database} onChange={(e) => setDb({ ...db, database: e.target.value })} placeholder="postgres" />
                  </Box>
                  <Box>
                    <Typography className="fl" component="label">数据库用户名</Typography>
                    <TextField fullWidth size="small" value={db.user} onChange={(e) => setDb({ ...db, user: e.target.value })} placeholder="postgres" />
                  </Box>
                </Box>
                <Typography className="fl" component="label">数据库密码</Typography>
                <TextField fullWidth size="small" type="password" value={db.password} onChange={(e) => setDb({ ...db, password: e.target.value })} placeholder="数据库连接密码（不是 Supabase 登录密码）" />
                <FormControlLabel
                  sx={{ mt: 0.5 }}
                  control={<Checkbox size="small" checked={db.ssl} onChange={(e) => setDb({ ...db, ssl: e.target.checked })} />}
                  label={<Typography sx={{ fontSize: 12, fontWeight: 700 }}>使用 SSL（Supabase 默认需要）</Typography>}
                />
                <Typography className="login-hint">连接成功后会在数据库中创建班级数据表；数据库密码只保存在本机配置文件中。</Typography>
              </>
            ) : null}
            <Typography className="login-err">{storageErr}</Typography>
            <Button className="btn login-submit" type="submit" disabled={busy === "storage"}>
              {busy === "storage" ? "正在测试连接…" : "测试连接并锁定存储方式"}
            </Button>
          </Box>
        ) : storageError ? (
          <Box className="login-panel on" id="localStorageError">
            <Typography className="login-hint">存储方式已经锁定，但数据库连接失败：</Typography>
            <Typography sx={{ fontSize: 12, color: "#b23f3f", fontWeight: 700, lineHeight: 1.7, wordBreak: "break-word" }}>{storageError}</Typography>
            <Button className="btn login-submit" sx={{ mt: 1.5 }} onClick={refreshConfig}>重试连接</Button>
            <Typography className="login-hint">如连接地址或密码填错，需要停止服务后删除 backend/data/local-storage.json 重新选择存储方式。</Typography>
          </Box>
        ) : firstSetup ? (
          <Box className="login-panel on" component="form" id="localSetupForm" onSubmit={submitRegister}>
            <Typography className="login-hint">本机只能创建一个班级。创建后，本机将不再显示注册入口。</Typography>
            <Typography className="fl" component="label">班级名称（最多 10 个字符）</Typography>
            <TextField
              fullWidth size="small" inputProps={{ maxLength: 10 }} value={reg.className}
              onChange={(e) => setReg({ ...reg, className: e.target.value })}
              placeholder="例如：高三(4)班"
            />
            <Box className="login-grid">
              <Box>
                <Typography className="fl" component="label">主账号（管理员）</Typography>
                <TextField
                  fullWidth size="small" value={reg.adminUsername} autoComplete="username"
                  onChange={(e) => setReg({ ...reg, adminUsername: e.target.value })}
                  placeholder="3-32 位字母/数字/下划线"
                />
              </Box>
              <Box>
                <Typography className="fl" component="label">显示名称（选填）</Typography>
                <TextField
                  fullWidth size="small" value={reg.adminDisplayName}
                  onChange={(e) => setReg({ ...reg, adminDisplayName: e.target.value })}
                  placeholder="例如：张老师"
                />
              </Box>
            </Box>
            <Box className="login-grid">
              <Box>
                <Typography className="fl" component="label">密码</Typography>
                <TextField
                  fullWidth size="small" type="password" value={reg.adminPassword} autoComplete="new-password"
                  onChange={(e) => setReg({ ...reg, adminPassword: e.target.value })}
                  placeholder="至少 6 位"
                />
              </Box>
              <Box>
                <Typography className="fl" component="label">确认密码</Typography>
                <TextField
                  fullWidth size="small" type="password" value={reg.adminPassword2} autoComplete="new-password"
                  onChange={(e) => setReg({ ...reg, adminPassword2: e.target.value })}
                  placeholder="再次输入密码"
                />
              </Box>
            </Box>
            <Typography className="login-err">{err.register}</Typography>
            <Button className="btn login-submit" type="submit" disabled={busy === "register"}>
              {busy === "register" ? "创建中…" : "创建本机班级并进入"}
            </Button>
          </Box>
        ) : (
          <>
            <Stack direction="row" className="login-tabs" role="tablist" style={{ gridTemplateColumns: `repeat(${visibleTabs.length}, 1fr)` }}>
              {visibleTabs.map((t) => (
                <Button
                  key={t.key}
                  className={"login-tab" + (tab === t.key ? " on" : "")}
                  onClick={() => setTab(t.key)}
                  startIcon={t.icon}
                  disableRipple
                >
                  {t.label}
                </Button>
              ))}
            </Stack>

            {tab === "admin" && (
              <Box className="login-panel on" component="form" id="classLoginForm" onSubmit={submitAdmin}>
                <Typography className="fl" component="label">管理员账号</Typography>
                <TextField
                  fullWidth size="small" value={admin.username} autoComplete="username"
                  onChange={(e) => setAdmin({ ...admin, username: e.target.value })}
                  placeholder="请输入班级管理员账号"
                />
                <Typography className="fl" component="label">管理员密码</Typography>
                <TextField
                  fullWidth size="small" type="password" value={admin.password} autoComplete="current-password"
                  onChange={(e) => setAdmin({ ...admin, password: e.target.value })}
                  placeholder="请输入管理员密码"
                />
                <Typography className="login-err">{err.admin}</Typography>
                <Button className="btn login-submit" type="submit" disabled={busy === "admin"}>
                  {busy === "admin" ? "登录中…" : "登录班级"}
                </Button>
              </Box>
            )}

            {tab === "member" && (
              <Box className="login-panel on" component="form" id="memberLoginForm" onSubmit={submitMember}>
                <Typography className="fl" component="label">普通账号</Typography>
                <TextField
                  fullWidth size="small" value={member.username} autoComplete="username"
                  onChange={(e) => setMember({ ...member, username: e.target.value })}
                  placeholder="请输入普通账号"
                />
                <Typography className="fl" component="label">密码</Typography>
                <TextField
                  fullWidth size="small" type="password" value={member.password} autoComplete="current-password"
                  onChange={(e) => setMember({ ...member, password: e.target.value })}
                  placeholder="请输入密码"
                />
                <Typography className="login-hint">普通账号只能查看班级信息，不能修改作业、生日、课程表等内容。</Typography>
                <Typography className="login-err">{err.member}</Typography>
                <Button className="btn login-submit" type="submit" disabled={busy === "member"}>
                  {busy === "member" ? "登录中…" : "以普通账号进入"}
                </Button>
              </Box>
            )}

            {!isLocal && tab === "register" && (
              <Box className="login-panel on" component="form" id="registerForm" onSubmit={submitRegister}>
                <Typography className="fl" component="label">注册码（由总管理员提供）</Typography>
                <TextField
                  fullWidth size="small" value={reg.registrationCode} autoComplete="off"
                  inputProps={{ maxLength: 32, style: { textTransform: "uppercase", letterSpacing: 1.2 } }}
                  onChange={(e) => setReg({ ...reg, registrationCode: e.target.value.toUpperCase() })}
                  placeholder="请输入注册码"
                />
                <Typography className="fl" component="label">班级名称（最多 10 个字符）</Typography>
                <TextField
                  fullWidth size="small" inputProps={{ maxLength: 10 }} value={reg.className}
                  onChange={(e) => setReg({ ...reg, className: e.target.value })}
                  placeholder="例如：高三(4)班"
                />
                <Box className="login-grid">
                  <Box>
                    <Typography className="fl" component="label">管理员账号</Typography>
                    <TextField
                      fullWidth size="small" value={reg.adminUsername} autoComplete="username"
                      onChange={(e) => setReg({ ...reg, adminUsername: e.target.value })}
                      placeholder="3-32 位字母/数字/下划线"
                    />
                  </Box>
                  <Box>
                    <Typography className="fl" component="label">显示名称（选填）</Typography>
                    <TextField
                      fullWidth size="small" value={reg.adminDisplayName}
                      onChange={(e) => setReg({ ...reg, adminDisplayName: e.target.value })}
                      placeholder="例如：张老师"
                    />
                  </Box>
                </Box>
                <Box className="login-grid">
                  <Box>
                    <Typography className="fl" component="label">管理员密码</Typography>
                    <TextField
                      fullWidth size="small" type="password" value={reg.adminPassword} autoComplete="new-password"
                      onChange={(e) => setReg({ ...reg, adminPassword: e.target.value })}
                      placeholder="至少 6 位"
                    />
                  </Box>
                  <Box>
                    <Typography className="fl" component="label">确认密码</Typography>
                    <TextField
                      fullWidth size="small" type="password" value={reg.adminPassword2} autoComplete="new-password"
                      onChange={(e) => setReg({ ...reg, adminPassword2: e.target.value })}
                      placeholder="再次输入密码"
                    />
                  </Box>
                </Box>
                <Typography className="login-err">{err.register}</Typography>
                <Button className="btn login-submit" type="submit" disabled={busy === "register"}>
                  {busy === "register" ? "注册中…" : "注册班级并进入"}
                </Button>
              </Box>
            )}
          </>
        )}

        <Typography className="login-foot">
          {isLocal ? (
            <>本机单机模式 · {needsStorage ? "请选择存储方式" : storageError ? "数据库异常" : appConfig.storageMode === "supabase" ? "Supabase 数据库" : "本地 SQLite"}</>
          ) : (
            <><a href="#/super">总管理员控制台 →</a><br />总管理员账号只能通过后端控制台创建 · 数据保存到 MySQL</>
          )}
        </Typography>
      </Box>
    </Box>
  );
}
