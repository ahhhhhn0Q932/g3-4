import React from "react";
import { NavLink, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { Alert, Avatar, Box, Button, Snackbar, Stack, Typography } from "@mui/material";
import { useApp } from "../state/AppContext.jsx";
import { beijingDate, fmtSyncTime, pad } from "../utils.js";
import HomePage from "../pages/HomePage.jsx";
import BoardPage from "../pages/BoardPage.jsx";
import TimetablePage from "../pages/TimetablePage.jsx";
import LeavePage from "../pages/LeavePage.jsx";
import RemindPage from "../pages/RemindPage.jsx";
import JournalPage from "../pages/JournalPage.jsx";
import ToolsPage from "../pages/ToolsPage.jsx";
import SettingsPage from "../pages/SettingsPage.jsx";
import DevPage from "../pages/DevPage.jsx";

const NAV = [
  { to: "/home", label: "首页" },
  { to: "/board", label: "总览" },
  { to: "/timetable", label: "课表" },
  { to: "/leave", label: "请假" },
  { to: "/remind", label: "提醒" },
  { to: "/journal", label: "日志" },
  { to: "/tools", label: "工具" },
  { to: "/settings", label: "设置" },
  { to: "/dev", label: "开发" }
];

export default function AppShell() {
  const { store, session, isAdmin, isMember, isMain, classShort, now, toastState, setToastState, server, logout, appConfig } = useApp();
  const location = useLocation();
  const navigate = useNavigate();
  const bj = beijingDate(now);
  const classLabel = (store.settings && store.settings.className) || "班级";

  React.useEffect(() => {
    if (location.pathname === "/" || location.pathname === "") navigate("/home", { replace: true });
  }, [location.pathname, navigate]);

  return (
    <Box className="shell">
      <Box className="topbar">
        <Box className="topbar-in">
          <Box className="brand" component={NavLink} to="/home">
            <Avatar className="badge-logo" id="brandBadge" sx={{ width: 42, height: 42, fontWeight: 900, background: "linear-gradient(140deg,#ff9d7d,#ffcf6b)", color: "#fff" }}>
              {classShort}
            </Avatar>
            <Box>
              <Typography className="nm" id="brandName">{classLabel}</Typography>
              <Typography className="tm">CLASS HOME</Typography>
            </Box>
          </Box>
          <Stack direction="row" className="nav" id="nav" spacing={0.5}>
            {NAV.map((item) => (
              <Button
                key={item.to}
                component={NavLink}
                to={item.to}
                className={location.pathname === item.to ? "on" : ""}
                disableRipple
              >
                {item.label}
              </Button>
            ))}
          </Stack>
          <Box className="top-clock">
            <Typography className="t" id="topTime">{pad(bj.getUTCHours())}:{pad(bj.getUTCMinutes())}</Typography>
            <Typography className="d" id="topDate">{bj.getUTCMonth() + 1}/{bj.getUTCDate()} {["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"][bj.getUTCDay()]}</Typography>
          </Box>
        </Box>
      </Box>

      <Box id="page">
        <Routes>
          <Route path="/home" element={<HomePage />} />
          <Route path="/board" element={<BoardPage />} />
          <Route path="/timetable" element={<TimetablePage />} />
          <Route path="/leave" element={<LeavePage />} />
          <Route path="/remind" element={<RemindPage />} />
          <Route path="/journal" element={<JournalPage />} />
          <Route path="/tools" element={<ToolsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/dev" element={<DevPage />} />
          <Route path="*" element={<HomePage />} />
        </Routes>
      </Box>

      <Box className="footbar">
        <Typography component="span">
          💗 <span id="footClass">{classLabel}</span> ·{" "}
          <span className={"role-tag " + (isAdmin ? "admin" : "guest")} id="footRole">
            {isAdmin ? (isMain ? "班级主账号" : "班级管理员") : isMember ? "普通账号" : "访客"}
          </span>{" "}
          · {appConfig.mode === "local" ? "数据保存在本机 SQLite" : "数据由 MySQL 服务器统一保存"} · 本机保留缓存
        </Typography>
        {session && (
          <Typography component="span" sx={{ ml: "auto", fontSize: 11, color: "#77676e" }}>
            服务器 {server.lastSync ? fmtSyncTime(server.lastSync) : "等待同步"}
            {server.error ? " · 异常" : ""}
          </Typography>
        )}
      </Box>

      <Snackbar
        open={!!toastState.open}
        autoHideDuration={2400}
        onClose={() => setToastState((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity="info" variant="filled" icon={false} sx={{ borderRadius: 3, fontWeight: 700, bgcolor: "#5d4a48", color: "#fff" }}>
          {toastState.icon ? toastState.icon + " " : ""}{toastState.msg}
        </Alert>
      </Snackbar>
    </Box>
  );
}
