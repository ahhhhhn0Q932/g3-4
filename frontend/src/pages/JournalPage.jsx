import React, { useMemo, useState } from "react";
import { Box, Button, IconButton, Paper, TextField, Typography } from "@mui/material";
import ChevronLeftRoundedIcon from "@mui/icons-material/ChevronLeftRounded";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import { useApp } from "../state/AppContext.jsx";
import { WEEK } from "../data/constants.js";
import { dateHasRecord, dateLabel, parseDate, relDay, subjectColor, todayStr } from "../utils.js";
import { ttBaseSubject } from "../data/timetable.js";

const CAL_WEEK = ["日", "一", "二", "三", "四", "五", "六"];

function snapshotFor(store, date) {
  const archived = store.archive && store.archive[date];
  if (archived) return archived;
  const d = parseDate(date);
  const md = d ? String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0") : "";
  return {
    homeworks: (store.homeworks || []).filter((h) => h.date === date),
    leaves: (store.leaves || []).filter((l) => l.date === date),
    reminders: (store.reminders || []).filter((r) => r.date === date),
    messages: (store.messages || []).filter((m) => m.date === date),
    birthdays: (store.birthdays || []).filter((b) => b.md === md).map((b) => b.name),
    swaps: (store.swaps || []).filter((s) => s.dateA === date || s.dateB === date).map((s) => ({
      summary: (s.type === "change" ? "改课：" : "对调：") + dateLabel(s.dateA) + " 第" + s.periodA + "节 → " + (s.subject || dateLabel(s.dateB) + " 第" + s.periodB + "节")
    }))
  };
}

function JournalCalendar({ selected, onSelect }) {
  const { store } = useApp();
  const sd = parseDate(selected) || new Date();
  const [cursor, setCursor] = useState({ y: sd.getFullYear(), m: sd.getMonth() });
  const y = cursor.y, m = cursor.m;
  const firstDow = new Date(y, m, 1).getDay();
  const days = new Date(y, m + 1, 0).getDate();
  const today = todayStr();
  const cells = [];
  for (let b = 0; b < firstDow; b += 1) cells.push(null);
  for (let d = 1; d <= days; d += 1) {
    const ds = y + "-" + String(m + 1).padStart(2, "0") + "-" + String(d).padStart(2, "0");
    cells.push({ d, ds, has: dateHasRecord(store, ds) });
  }
  const shift = (n) => {
    let mm = m + n, yy = y;
    yy += Math.floor(mm / 12); mm = ((mm % 12) + 12) % 12;
    setCursor({ y: yy, m: mm });
  };
  return (
    <Box className="cal-card mini journal-cal">
      <Box className="cal-top">
        <Box className="cal-mon">{y} 年 {m + 1} 月</Box>
        <Box className="cal-nav">
          <IconButton size="small" onClick={() => shift(-1)}><ChevronLeftRoundedIcon fontSize="small" /></IconButton>
          <IconButton size="small" onClick={() => shift(1)}><ChevronRightRoundedIcon fontSize="small" /></IconButton>
        </Box>
      </Box>
      <Box className="cal-grid">
        {CAL_WEEK.map((w) => <span className="cal-wd" key={w}>{w}</span>)}
        {cells.map((c, i) => c ? (
          <Button key={c.ds} className={"cal-day" + (c.ds === today ? " today" : "") + (c.ds === selected ? " sel" : "")} onClick={() => onSelect(c.ds)} disableRipple>
            {c.d}{c.has ? <span className="cal-dot" /> : null}
          </Button>
        ) : <span className="cal-day blank" key={"b" + i} />)}
      </Box>
      <Box className="cal-foot">
        <span>{selected === today ? "今天 " + dateLabel(today) : "回看 " + dateLabel(selected)}</span>
        {selected === today ? <span>点日期回看</span> : <Button size="small" onClick={() => onSelect(today)}>回到今天</Button>}
      </Box>
    </Box>
  );
}

export default function JournalPage() {
  const { store, isMember, canEdit, toast, addMessage, delMessage } = useApp();
  const today = todayStr();
  const [selected, setSelected] = useState(today);
  const [text, setText] = useState("");
  const canJournal = canEdit("journal");
  const snap = useMemo(() => snapshotFor(store, selected), [store, selected]);
  const dt = parseDate(selected);
  const isToday = selected === today;
  const messages = snap.messages || [];

  function submit() {
    if (!text.trim()) { toast("说点什么再发送吧", "💬"); return; }
    addMessage(text.trim(), "");
    setText("");
    toast("留言已发送", "💬");
  }

  return (
    <>
      <Box className="page-hd">
        <Box className="ico purple">📔</Box>
        <Box>
          <Typography component="h1">{isToday ? "班级日志" : "班级日志 · 历史回看"}</Typography>
          <Typography component="p">{isToday ? "每天的作业、请假、提醒自动存档，还能写点心里话" : "正在查看 " + dateLabel(selected) + " 的作业、请假、提醒与留言"}</Typography>
        </Box>
        <Box className="spacer" />
        {!isToday ? <Button className="btn ghost tiny" onClick={() => setSelected(today)}>← 回到今天</Button> : null}
      </Box>
      <Box className="journal-grid">
        <Paper className="card" elevation={0} sx={{ p: 2 }}>
          <Box className="card-hd"><Box className="ico purple">🗓️</Box><Typography component="h2">我的日子</Typography></Box>
          <JournalCalendar selected={selected} onSelect={setSelected} />
        </Paper>
        <Box>
          <Paper className="card" elevation={0} sx={{ mb: 2 }}>
            <Box className="journal-day-hd">
              <Box>
                <Box className="big">{dt ? dt.getFullYear() + "." + (dt.getMonth() + 1) + "." + dt.getDate() : selected}</Box>
                <Box className="wk">{dt ? WEEK[dt.getDay()] + " · " : ""}{isToday ? "今天" : relDay(selected)}</Box>
              </Box>
              <Box sx={{ flex: 1 }} />
              <Typography sx={{ fontSize: 11, color: "#77676e", fontWeight: 700 }}>
                作业 {snap.homeworks.length} · 请假 {snap.leaves.length} · 提醒 {snap.reminders.length} · 调课 {(snap.swaps || []).length} · 留言 {messages.length}
              </Typography>
            </Box>
            <Box className="jsec"><Box className="jsec-t"><i style={{ background: "#5b9bd5" }} />作业</Box>
              {snap.homeworks.length ? snap.homeworks.map((h) => (
                <Box className="sc-line" key={h.id} sx={{ mb: 0.5 }}>
                  <span style={{ background: subjectColor(h.subject), color: "#fff", fontSize: 10, fontWeight: 800, padding: "1px 7px", borderRadius: 6, flex: "none" }}>{h.subject}</span>
                  <span className="tx">{h.title}</span>
                </Box>
              )) : <Box className="j-empty">当天没有布置作业</Box>}
            </Box>
            <Box className="jsec"><Box className="jsec-t"><i style={{ background: "#4fb79a" }} />请假</Box>
              {snap.leaves.length ? snap.leaves.map((l, i) => (
                <Box className="sc-line" key={l.id || i} sx={{ mb: 0.5 }}><span className="tx">{l.name} · {l.period} · {l.reason}</span></Box>
              )) : <Box className="j-empty">当天全员到齐</Box>}
            </Box>
            <Box className="jsec"><Box className="jsec-t"><i style={{ background: "#f0b34a" }} />每日提醒</Box>
              {snap.reminders.length ? snap.reminders.map((r, i) => (
                <Box className="sc-line" key={r.id || i} sx={{ mb: 0.5 }}><span className="tx">{r.done ? "✓ " : ""}{r.text}</span></Box>
              )) : <Box className="j-empty">当天没有提醒</Box>}
            </Box>
            <Box className="jsec"><Box className="jsec-t"><i style={{ background: "#c58bd8" }} />调课</Box>
              {(snap.swaps || []).length ? snap.swaps.map((s, i) => (
                <Box className="sc-line" key={i} sx={{ mb: 0.5 }}><span className="swap-tag" style={{ marginRight: 6 }}>调课</span><span className="tx">{s.summary}</span></Box>
              )) : <Box className="j-empty">当天没有调课</Box>}
            </Box>
            <Box className="jsec" style={{ marginBottom: 0 }}><Box className="jsec-t"><i style={{ background: "#dc5b8a" }} />生日</Box>
              {snap.birthdays.length ? <Box className="sc-line"><span className="tx">🎂 {snap.birthdays.join("、")} 生日快乐</span></Box> : <Box className="j-empty">当天没有生日</Box>}
            </Box>
          </Paper>

          <Paper className="card" elevation={0}>
            <Box className="card-hd"><Box className="ico purple">💬</Box><Typography component="h2">留言板</Typography><Box className="spacer" /><Typography className="sub">{dateLabel(selected)}</Typography></Box>
            {canJournal ? (
              <Box className="msg-form">
                <TextField fullWidth multiline minRows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder="写点什么吧：今天的心情、想对同学说的话、班里发生的小事…" />
                <Button className="btn purple" onClick={submit} sx={{ alignSelf: "stretch" }}>发送</Button>
              </Box>
             ) : <Box className="perm-note">👀 {isMember ? "普通账号只能查看班级日志，不能留言。" : "当前为只读模式，不能留言。"}</Box>}
            <Box className="msg-list">
              {messages.length ? messages.map((m) => (
                <Box className="msg-item" key={m.id}>
                  <Box className="msg-top"><span className="msg-who">{m.who || "留言"}</span><span className="msg-time">{m.time || ""}</span></Box>
                  <Box className="msg-tx">{m.text}</Box>
                  {canJournal ? <Button size="small" className="hw-del" sx={{ opacity: 1 }} onClick={() => delMessage(m.id)}>✕</Button> : null}
                </Box>
              )) : <Box className="j-empty">这一天还没有留言</Box>}
            </Box>
          </Paper>
        </Box>
      </Box>
    </>
  );
}
