import React, { useMemo, useState } from "react";
import {
  Box, Button, Dialog, IconButton, MenuItem, Paper, Select, TextField, Typography
} from "@mui/material";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import { useApp } from "../state/AppContext.jsx";
import { beijingDate, fmtSyncTime, pad, teacherSorted, studentSorted } from "../utils.js";

const TAGS = ["励志", "学习", "坚持", "心态", "班级", "自省", "其他"];

function LuckyStar() {
  const { store, toast } = useApp();
  const [group, setGroup] = useState("student");
  const [result, setResult] = useState("");
  const [last, setLast] = useState("");
  function pick() {
    let pool = [];
    if (group === "student") pool = studentSorted(store).map((s) => s.name);
    else if (group === "teacher") pool = teacherSorted(store).map((t) => t.name + "老师");
    else pool = [...studentSorted(store).map((s) => s.name), ...teacherSorted(store).map((t) => t.name + "老师")];
    pool = pool.filter(Boolean);
    if (!pool.length) { toast("当前范围还没有名单，去「设置」补充学生或教师档案吧", "👥"); return; }
    let next = pool[Math.floor(Math.random() * pool.length)];
    let guard = 0;
    while (pool.length > 1 && next === last && guard < 20) { next = pool[Math.floor(Math.random() * pool.length)]; guard += 1; }
    setLast(next); setResult(next);
    toast("幸运星：" + next, "⭐");
  }
  return (
    <Paper className="card" elevation={0}>
      <Box className="card-hd"><Box className="ico sun">⭐</Box><Typography component="h2">幸运星</Typography><Box className="spacer" /><Typography className="sub">随机抽取</Typography></Box>
      <Box className="lucky-form">
        <Select size="small" fullWidth value={group} onChange={(e) => setGroup(e.target.value)}>
          <MenuItem value="student">抽学生</MenuItem>
          <MenuItem value="teacher">抽老师</MenuItem>
          <MenuItem value="all">学生 + 老师</MenuItem>
        </Select>
        <Button className="btn" onClick={pick}>抽一个</Button>
      </Box>
      <Box sx={{ minHeight: 90, display: "grid", placeItems: "center", borderRadius: 3, background: "#fffaf5", border: "1px dashed #efdcd4", p: 2 }}>
        <Typography sx={{ fontSize: result ? 28 : 13, fontWeight: 900, color: result ? "#a85232" : "#77676e" }}>{result || "点击按钮开始抽取"}</Typography>
      </Box>
    </Paper>
  );
}

function RandomNumber() {
  const [min, setMin] = useState("1");
  const [max, setMax] = useState("100");
  const [result, setResult] = useState("");
  const { toast } = useApp();
  function pick() {
    let a = parseInt(min, 10), b = parseInt(max, 10);
    if (isNaN(a) || isNaN(b)) { toast("请输入有效的数字范围", "🔢"); return; }
    if (a > b) [a, b] = [b, a];
    setResult(String(Math.floor(Math.random() * (b - a + 1)) + a));
  }
  return (
    <Paper className="card" elevation={0}>
      <Box className="card-hd"><Box className="ico sun">🔢</Box><Typography component="h2">随机数</Typography><Box className="spacer" /><Typography className="sub">可设置范围</Typography></Box>
      <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1 }}>
        <TextField size="small" label="最小值" value={min} onChange={(e) => setMin(e.target.value)} />
        <TextField size="small" label="最大值" value={max} onChange={(e) => setMax(e.target.value)} />
      </Box>
      <Button className="btn" sx={{ mt: 1.5 }} onClick={pick}>生成随机数</Button>
      <Box sx={{ mt: 1.5, minHeight: 70, display: "grid", placeItems: "center", borderRadius: 3, background: "#fffaf5", border: "1px dashed #efdcd4" }}>
        <Typography sx={{ fontSize: 30, fontWeight: 900, color: "#a85232" }}>{result || "—"}</Typography>
      </Box>
    </Paper>
  );
}

function LinksCard() {
  const { store, canEdit, toast, addLink, delLink } = useApp();
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const editable = canEdit("links");
  function submit() {
    if (!name.trim() || !url.trim()) { toast("请填写链接名称和网址", "🔗"); return; }
    addLink(name, url);
    setName(""); setUrl("");
    toast("链接已添加", "🔗");
  }
  return (
    <Paper className="card" elevation={0}>
      <Box className="card-hd"><Box className="ico blue">🔗</Box><Typography component="h2">常用链接</Typography><Box className="spacer" /><Typography className="sub">{store.links.length} 个</Typography></Box>
      {editable ? (
        <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1.6fr auto", gap: 1, mb: 1.5 }}>
          <TextField size="small" placeholder="名称" value={name} onChange={(e) => setName(e.target.value)} />
          <TextField size="small" placeholder="网址" value={url} onChange={(e) => setUrl(e.target.value)} />
          <Button className="btn tiny" onClick={submit}>添加</Button>
        </Box>
      ) : null}
      <Box sx={{ display: "grid", gap: 1 }}>
        {store.links.length ? store.links.map((l) => (
          <Box key={l.id} sx={{ display: "flex", alignItems: "center", gap: 1, p: 1.2, border: "1px dashed #efdcd4", borderRadius: 2 }}>
            <a href={l.url} target="_blank" rel="noreferrer" style={{ flex: 1, color: "#5a4038", fontWeight: 800, textDecoration: "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.name}</a>
            {editable ? <IconButton size="small" onClick={() => delLink(l.id)}><CloseRoundedIcon fontSize="small" /></IconButton> : null}
          </Box>
        )) : <Box className="mini-empty">还没有常用链接</Box>}
      </Box>
    </Paper>
  );
}

function EchoCard() {
  const { store, canEdit, toast, addQuote, delQuote } = useApp();
  const editable = canEdit("echo");
  const [text, setText] = useState("");
  const [tag, setTag] = useState("励志");
  const [by, setBy] = useState("");
  function submit() {
    if (!text.trim()) { toast("写一句想说的话吧", "💬"); return; }
    addQuote(text, tag, by);
    setText(""); setBy("");
    toast("已加入回声洞", "💬");
  }
  return (
    <Paper className="card echo-card" elevation={0}>
      <Box className="card-hd"><Box className="ico purple">💬</Box><Typography component="h2">回声洞</Typography><Box className="spacer" /><Typography className="sub">{store.quotes.length} 句</Typography></Box>
      <Box className="echo-grid" style={{ gridTemplateColumns: editable ? undefined : "1fr" }}>
        {editable ? (
          <Box className="echo-form">
            <TextField fullWidth multiline minRows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="写一句激励的话…" />
            <Box className="echo-row">
              <Select size="small" value={tag} onChange={(e) => setTag(e.target.value)}>
                {TAGS.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
              </Select>
              <TextField size="small" value={by} onChange={(e) => setBy(e.target.value)} placeholder="署名（选填）" />
            </Box>
            <Button className="btn" onClick={submit}>加入回声洞</Button>
            <Typography className="echo-tip">只读账号只能查看；管理员可添加、删除。</Typography>
          </Box>
        ) : null}
        <Box>
          <Box className="echo-list-hd"><span>全部句子</span><Box className="spacer" /><span>{store.quotes.length}</span></Box>
          <Box className="echo-list">
            {store.quotes.length ? store.quotes.map((q) => (
              <Box className="echo-item" key={q.id}>
                <Box className="q">{q.t}<Box className="meta"><span className="tag">{q.tag || "其他"}</span>{q.by ? <span className="by">—— {q.by}</span> : null}</Box></Box>
                {editable ? <IconButton size="small" onClick={() => delQuote(q.id)}><CloseRoundedIcon fontSize="small" /></IconButton> : null}
              </Box>
            )) : <Box className="echo-empty">回声洞还没有句子</Box>}
          </Box>
        </Box>
      </Box>
    </Paper>
  );
}

function IssuesCard() {
  const { store, isAdmin, isMember, toast, addIssue, delIssue, replyIssue, resolveIssue } = useApp();
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");
  const [replyText, setReplyText] = useState({});
  const open = store.issues.filter((i) => !i.resolved);
  const done = store.issues.filter((i) => i.resolved);
  function submit() {
    if (!title.trim()) { toast("请填写反馈标题", "📮"); return; }
    addIssue(title, detail);
    setTitle(""); setDetail("");
    toast("反馈已提交", "📮");
  }
  function reply(it) {
    const text = (replyText[it.id] || "").trim();
    if (!text) return;
    replyIssue(it.id, text);
    setReplyText((prev) => ({ ...prev, [it.id]: "" }));
  }
  const list = [...open, ...done];
  return (
    <Paper className="card issue-card" elevation={0}>
      <Box className="card-hd"><Box className="ico mint">📮</Box><Typography component="h2">反馈</Typography><Box className="spacer" /><Typography className="sub">共 {open.length} 条待处理</Typography></Box>
      <Box className="issue-layout">
        {isMember ? (
          <Box className="perm-note" sx={{ alignSelf: "start" }}>普通账号只能查看反馈，不能提交、删除或回复。</Box>
        ) : (
          <Box className="issue-form">
            <Typography className="fl" component="label">标题</Typography>
            <TextField fullWidth size="small" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="一句话说明问题或建议" />
            <Typography className="fl" component="label" sx={{ mt: 1 }}>详细说明（选填）</Typography>
            <TextField fullWidth multiline minRows={3} value={detail} onChange={(e) => setDetail(e.target.value)} placeholder="补充复现步骤、期望结果等…" />
            <Button className="btn" sx={{ mt: 1 }} onClick={submit}>＋ 提交反馈</Button>
            <Typography className="issue-tip">所有人都可以提交和删除；管理员可以回复，并勾选解决。</Typography>
          </Box>
        )}
        <Box>
          <Box className="issue-board-hd"><span>反馈清单</span><Box className="spacer" /><span>待处理 {open.length} · 已解决 {done.length}</span></Box>
          <Box className="issue-list">
            {list.length ? list.map((it) => (
              <Box className={"issue-item" + (it.resolved ? " resolved" : "")} key={it.id}>
                <Box className="issue-top">
                  {isAdmin ? (
                    <Button className={"issue-check" + (it.resolved ? " on" : "")} size="small" onClick={() => resolveIssue(it.id)}>{it.resolved ? "✓" : ""}</Button>
                  ) : <span className={"issue-check" + (it.resolved ? " on" : "")}>{it.resolved ? "✓" : ""}</span>}
                  <Box className="issue-head">
                    <Box className={"issue-title" + (it.resolved ? " done" : "")}>{it.title}</Box>
                    <Box className="issue-sub">
                      <span className={"issue-status" + (it.resolved ? " done" : "")}>{it.resolved ? "已解决" : "待处理"}</span>
                      <span>{it.role === "admin" ? "管理员" : "访客"} · {fmtSyncTime(it.createdAt)}</span>
                    </Box>
                  </Box>
                  {!isMember ? <IconButton size="small" className="issue-del" onClick={() => delIssue(it.id)}><CloseRoundedIcon fontSize="small" /></IconButton> : null}
                </Box>
                {it.detail ? <Box className="issue-detail">{it.detail}</Box> : null}
                {it.replies.length ? <Box className="issue-replies">{it.replies.map((r) => <Box className="issue-reply" key={r.id}><span className="who">{r.role === "admin" ? "管理员" : "访客"}：</span>{r.text}<span className="when">{fmtSyncTime(r.at)}</span></Box>)}</Box> : null}
                {isAdmin ? (
                  <Box className="issue-reply-box">
                    <TextField size="small" fullWidth value={replyText[it.id] || ""} onChange={(e) => setReplyText({ ...replyText, [it.id]: e.target.value })} placeholder="回复…" />
                    <Button className="btn tiny" onClick={() => reply(it)}>回复</Button>
                  </Box>
                ) : null}
              </Box>
            )) : <Box className="echo-empty">还没有反馈</Box>}
          </Box>
        </Box>
      </Box>
    </Paper>
  );
}

function ClockCard() {
  const { store, now } = useApp();
  const [open, setOpen] = useState(false);
  const bj = beijingDate(now);
  const exam = store.settings.examDate ? new Date(store.settings.examDate + "T00:00:00") : null;
  const left = exam ? Math.ceil((exam - new Date()) / 86400000) : null;
  const time = pad(bj.getUTCHours()) + ":" + pad(bj.getUTCMinutes()) + ":" + pad(bj.getUTCSeconds());
  return (
    <Paper className="card" elevation={0}>
      <Box className="card-hd"><Box className="ico sun">⏰</Box><Typography component="h2">课堂时钟</Typography><Box className="spacer" /><Typography className="sub">北京时间</Typography></Box>
      <Box sx={{ textAlign: "center", py: 2 }}>
        <Typography sx={{ fontSize: 34, fontWeight: 900, color: "#5a4a6e", letterSpacing: 1 }}>{time}</Typography>
        <Typography sx={{ fontSize: 12, color: "#75666d", fontWeight: 700 }}>{bj.getUTCFullYear()}年{bj.getUTCMonth() + 1}月{bj.getUTCDate()}日</Typography>
        <Button className="btn" sx={{ mt: 1.5 }} onClick={() => setOpen(true)}>打开全屏时钟</Button>
      </Box>
      <Dialog open={open} onClose={() => setOpen(false)} fullScreen>
        <Box sx={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "linear-gradient(135deg,#fff8ef,#eefaf5)", position: "relative" }}>
          <IconButton sx={{ position: "absolute", top: 20, right: 20 }} onClick={() => setOpen(false)}><CloseRoundedIcon /></IconButton>
          <Box sx={{ textAlign: "center" }}>
            <Typography sx={{ fontSize: "clamp(72px,18vw,220px)", fontWeight: 900, color: "#5a4a6e", lineHeight: 1, letterSpacing: 2 }}>{time}</Typography>
            <Typography sx={{ mt: 1, fontSize: 18, fontWeight: 700, color: "#75666d" }}>{bj.getUTCFullYear()}年{bj.getUTCMonth() + 1}月{bj.getUTCDate()}日</Typography>
            {left !== null ? <Typography sx={{ mt: 2, fontSize: 22, fontWeight: 800, color: "#a85232" }}>距离高考 {left} 天</Typography> : null}
          </Box>
        </Box>
      </Dialog>
    </Paper>
  );
}

export default function ToolsPage() {
  return (
    <>
      <Box className="page-hd">
        <Box className="ico purple">🧰</Box>
        <Box><Typography component="h1">工具箱</Typography><Typography component="p">幸运星、随机数、常用链接、回声洞、反馈与课堂时钟</Typography></Box>
      </Box>
      <Box className="tools-grid">
        <LuckyStar />
        <RandomNumber />
        <LinksCard />
        <ClockCard />
        <EchoCard />
        <IssuesCard />
      </Box>
    </>
  );
}
