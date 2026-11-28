import React, { useRef } from "react";
import { Box, Button, Paper, Typography } from "@mui/material";
import { useApp } from "../state/AppContext.jsx";
import { CHANGELOG, GITHUB_URL } from "../data/constants.js";

export default function DevPage() {
  const {
    store, session, isAdmin, server, apiBase, toast, exportData, importData, resetAll,
    pullNow, pushNow, logout, appConfig
  } = useApp();
  const fileRef = useRef(null);
  const serverDot = !session ? "off" : server.error ? "err" : server.lastSync ? "ok" : "off";
  const serverText = !session ? "未登录" : server.error ? "异常" : server.lastSync ? "正常" : "待同步";
  const isLocal = appConfig.mode === "local";

  async function onFile(e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file) return;
    try {
      await importData(file);
    } catch (err) {
      toast("导入失败：文件格式不正确", "⚠️");
    }
  }

  return (
    <>
      <Box className="page-hd">
        <Box className="ico purple">🛠️</Box>
        <Box><Typography component="h1">开发</Typography><Typography component="p">服务器状态、数据管理与版本记录</Typography></Box>
      </Box>

      <Box className="dev-stats" sx={{ mb: 2 }}>
        <Box className="dev-stat"><span>当前版本</span><b>{CHANGELOG[0].ver}<span className="beta-badge">Beta</span><small>{CHANGELOG[0].date}</small></b></Box>
        <Box className="dev-stat"><span>服务器状态</span><b><span className={"sync-dot " + serverDot} />{serverText}</b></Box>
        <Box className="dev-stat"><span>班级编号</span><b>{session && session.class ? "#" + session.class.id : "—"}<small>{session && session.class ? session.class.name : "未登录"}</small></b></Box>
        <Box className="dev-stat"><span>待处理反馈</span><b>{store.issues.filter((i) => !i.resolved).length}<small>已解决 {store.issues.filter((i) => i.resolved).length}</small></b></Box>
      </Box>

      <Paper className="card sync-card" elevation={0}>
        <Box className="card-hd"><Box className="ico blue">🔄</Box><Typography component="h2">服务器与数据</Typography><Box className="spacer" /><Typography className="sub">{isLocal ? "SQLite · 本机单机" : "MySQL · 前后端分离"}</Typography></Box>
        <Typography className="sync-desc">班级数据通过后端 API 保存到{isLocal ? "本机 SQLite" : " MySQL Community"}。当前接口：<b style={{ color: "#6b5a52" }}>{apiBase}</b>。页面每 15 秒自动检查服务器更新。</Typography>
        <Box className="btn-row">
          <Button className="btn ghost tiny" onClick={exportData}>导出全部数据</Button>
          {isAdmin ? <Button className="btn ghost tiny" onClick={() => fileRef.current && fileRef.current.click()}>导入数据</Button> : null}
          {isAdmin ? <Button className="btn ghost tiny" onClick={() => { if (window.confirm("确定清空本班全部数据吗？建议先导出备份。")) resetAll(); }} sx={{ color: "#d9697a", borderColor: "#f6d6da" }}>清空全部</Button> : null}
          <input ref={fileRef} type="file" accept=".json" hidden onChange={onFile} />
        </Box>
        <Box className="sync-row" sx={{ mt: 1.5 }}>
          <Button className="btn" onClick={() => pullNow(true)}>立即刷新</Button>
          {isAdmin ? <Button className="btn ghost tiny" onClick={() => { pushNow(true); }}>立即上传</Button> : null}
          <Button className="btn ghost tiny" onClick={() => { if (window.confirm("确定退出登录吗？")) logout(); }}>退出登录</Button>
          <Typography className="sync-state">本地缓存 {server.lastSync ? "已同步" : "等待同步"}{server.error ? " · " + server.error : ""}</Typography>
        </Box>
        <Box className="sync-local"><span>当前班级</span><b>{session && session.class ? "#" + session.class.id + " · " + session.class.name : "未登录"}</b><i>登录身份：{isAdmin ? "班级管理员" : "只读账号"} · 数据由{isLocal ? "本机 SQLite" : "后端 MySQL"}统一保存</i></Box>
        <Typography sx={{ fontSize: 11.5, color: "#75666d", fontWeight: 600, mt: 1.5, lineHeight: 1.8 }}>
          已归档 <b style={{ color: "#a85232" }}>{Object.keys(store.archive).length} 天</b>　·　
          作业 {store.homeworks.length} 条　·　请假 {store.leaves.length} 条　·　提醒 {store.reminders.length} 条　·　留言 {store.messages.length} 条
        </Typography>
      </Paper>

      <Paper className="card maint-card" elevation={0} sx={{ mt: 2 }}>
        <Box className="card-hd"><Box className="ico purple">🛠️</Box><Typography component="h2">维护</Typography><Box className="spacer" /><Typography className="sub">更新日志 · 代码仓库</Typography></Box>
        <Box className="maint-notice apology"><b>致歉</b>因维护差错与服务器异常导致数据丢失，特此道歉</Box>
        <Box className="maint-notice recruit"><b>招募</b>现在招募有能力维护的人员，有意向者请加QQ群：1137173812</Box>
        <Box className="maint-repo" sx={{ mt: 1 }}>
          <Box className="repo-meta"><b>GitHub 仓库</b><span>源码、更新日志与部署</span></Box>
          <Button className="repo-link" href={GITHUB_URL} target="_blank" rel="noopener noreferrer">GitHub</Button>
        </Box>
        <Box className="changelog">
          {CHANGELOG.map((c) => (
            <Box className="cl-item" key={c.ver}>
              <Box className="cl-head"><span className="cl-ver">{c.ver}</span><b>{c.title}</b><span className="cl-date">{c.date}</span></Box>
              <ul className="cl-list">{c.items.map((it, i) => <li key={i}>{it}</li>)}</ul>
            </Box>
          ))}
        </Box>
      </Paper>
    </>
  );
}
