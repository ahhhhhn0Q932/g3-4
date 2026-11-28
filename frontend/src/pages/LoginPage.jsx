import React, { useState } from "react";
import { Box, Button, Stack, TextField, Typography } from "@mui/material";
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
  const { loginClass, registerClass, appConfig } = useApp();
  const isLocal = appConfig.mode === "local";
  const firstSetup = isLocal && !appConfig.classExists;
  const visibleTabs = isLocal ? tabs.filter((t) => t.key !== "register") : tabs;
  const [tab, setTab] = useState("admin");
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState({ admin: "", member: "", register: "" });
  const [admin, setAdmin] = useState({ username: "", password: "" });
  const [member, setMember] = useState({ username: "", password: "" });
  const [reg, setReg] = useState({
    className: "", adminUsername: "", adminDisplayName: "", adminPassword: "", adminPassword2: "", registrationCode: ""
  });

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
          {firstSetup ? "本机单机模式 · 首次设置" : isLocal ? "本机单机模式 · 数据保存在本地 SQLite" : "班级数据由 MySQL 服务器统一保存"}
        </Typography>

        {firstSetup ? (
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
            <>本机单机模式 · 数据保存在本地 SQLite</>
          ) : (
            <><a href="#/super">总管理员控制台 →</a><br />总管理员账号只能通过后端控制台创建 · 数据保存到 MySQL</>
          )}
        </Typography>
      </Box>
    </Box>
  );
}
