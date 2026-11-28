import React, { useMemo, useState } from "react";
import { Box, Button, Checkbox, MenuItem, Paper, Select, Tab, Tabs, TextField, Typography } from "@mui/material";
import { useApp } from "../state/AppContext.jsx";
import { TIMETABLE, SUBJECTS } from "../data/constants.js";
import { dateLabel, parseDate, remindActive, todayStr } from "../utils.js";
import { nextTeachingDate, swapSummary, ttBaseSubject } from "../data/timetable.js";

function periodOptions(dateStr) {
  const d = parseDate(dateStr);
  if (!d) return [];
  const day = TIMETABLE[d.getDay()] || [];
  return day.map((sub, i) => ({ value: i + 1, label: "第" + (i + 1) + "节 · " + sub }));
}

export default function RemindPage() {
  const { store, isMember, canEdit, toast, addReminder, toggleReminder, delReminder, addSwap, delSwap } = useApp();
  const canRemind = canEdit("remind");
  const [tab, setTab] = useState("normal");
  const [text, setText] = useState("");
  const [dueOn, setDueOn] = useState(false);
  const [due, setDue] = useState(todayStr());
  const [swapType, setSwapType] = useState("swap");
  const dA0 = nextTeachingDate();
  const [dateA, setDateA] = useState(dA0);
  const [periodA, setPeriodA] = useState(1);
  const [dateB, setDateB] = useState(dA0);
  const [periodB, setPeriodB] = useState(1);
  const [newSubject, setNewSubject] = useState("语文");

  const reminders = useMemo(() => (store.reminders || []).slice().sort((a, b) => (b.created || 0) - (a.created || 0)), [store.reminders]);
  const current = reminders.filter((r) => remindActive(r, todayStr()));
  const history = reminders.filter((r) => !remindActive(r, todayStr()));
  const swaps = (store.swaps || []).slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  function submitReminder() {
    const lines = text.split(/\n+/).map((s) => s.trim()).filter(Boolean);
    if (!lines.length) { toast("写点提醒内容吧", "🔔"); return; }
    const finalDue = dueOn && due ? due : todayStr();
    lines.forEach((line) => addReminder(line, finalDue >= todayStr() ? finalDue : todayStr()));
    setText(""); setDueOn(false);
    toast("已发布 " + lines.length + " 条提醒", "🔔");
  }

  function submitSwap() {
    if (!canRemind) return;
    if (swapType === "change") {
      addSwap({ type: "change", dateA, periodA, dateB: dateA, periodB: periodA, subject: newSubject });
      toast("改课已保存", "🔁");
      return;
    }
    if (dateA === dateB && periodA === periodB) { toast("对调的两节课不能相同", "🔁"); return; }
    addSwap({ type: "swap", dateA, periodA, dateB, periodB });
    toast("调课已保存", "🔁");
  }

  return (
    <>
      <Box className="page-hd">
        <Box className="ico sun">🔔</Box>
        <Box><Typography component="h1">每日提醒</Typography><Typography component="p">{canRemind ? "班主任发布 · 今日提醒会显示在总览页" : isMember ? "普通账号 · 今日提醒与历史提醒只读" : "只读模式 · 今日提醒与历史提醒只读"}</Typography></Box>
      </Box>
      <Tabs value={tab} onChange={(e, v) => setTab(v)} className="remind-tabs" sx={{ mb: 1.5 }}>
        <Tab value="normal" label="普通提醒" />
        <Tab value="swap" label="调课提醒" />
      </Tabs>

      {tab === "normal" ? (
        <>
          {canRemind ? (
            <Paper className="card" elevation={0} sx={{ mb: 2 }}>
              <Box className="card-hd"><Box className="ico orange">✍️</Box><Typography component="h2">发布提醒</Typography></Box>
              <TextField fullWidth multiline minRows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder="例如：明天交物理实验报告；周五下午体检记得空腹；今天值日组留下扫地…" />
              <Box className="btn-row" sx={{ mt: 1.5 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: "#6f5d56" }}>
                  <Checkbox size="small" checked={dueOn} onChange={(e) => setDueOn(e.target.checked)} /> 设置截止日期
                </label>
                <TextField type="date" size="small" value={due} disabled={!dueOn} onChange={(e) => setDue(e.target.value)} sx={{ width: 160 }} />
                <Button className="btn" onClick={submitReminder}>＋ 发布提醒</Button>
              </Box>
            </Paper>
           ) : <Box className="perm-note">👀 {isMember ? "普通账号只能查看每日提醒。" : "当前为只读模式，不能发布或修改提醒。"}</Box>}

          <Paper className="card" elevation={0} sx={{ mb: 2 }}>
            <Box className="card-hd"><Box className="ico sun">🔔</Box><Typography component="h2">当前提醒</Typography><Box className="spacer" /><Typography className="sub">{current.length} 条</Typography></Box>
            {current.length ? current.map((r) => (
              <Box className={"remind-item" + (r.done ? " done" : "")} key={r.id} onClick={() => canRemind && toggleReminder(r.id)}>
                <span className="rd" /><span className="rm-text">{r.text}</span>
                {r.due && r.due !== r.date ? <span className="rm-due-tip">截止 {dateLabel(r.due)}</span> : null}
                {canRemind ? <Button size="small" className="hw-del" sx={{ opacity: 1 }} onClick={(e) => { e.stopPropagation(); delReminder(r.id); }}>✕</Button> : null}
              </Box>
            )) : <Box className="mini-empty">当前没有提醒</Box>}
          </Paper>

          <Paper className="card" elevation={0}>
            <Box className="card-hd"><Box className="ico purple">🗂️</Box><Typography component="h2">历史提醒</Typography><Box className="spacer" /><Typography className="sub">{history.length} 条</Typography></Box>
            {history.length ? history.map((r) => (
              <Box className="remind-item" key={r.id}>
                <span className="rd" /><span className="rm-text">{r.text}</span>
                <span className="rm-due-tip">{dateLabel(r.date)}</span>
                {canRemind ? <Button size="small" className="hw-del" sx={{ opacity: 1 }} onClick={() => delReminder(r.id)}>✕</Button> : null}
              </Box>
            )) : <Box className="mini-empty">暂无历史提醒</Box>}
          </Paper>
        </>
      ) : (
        <>
          {canRemind ? (
            <Paper className="card swap-card" elevation={0} sx={{ mb: 2 }}>
              <Box className="card-hd"><Box className="ico sun">🔁</Box><Typography component="h2">调课 / 改课</Typography><Box className="spacer" /><Typography className="sub">按课程表选择，保存后自动更新当天课表</Typography></Box>
              <Box className="swap-form">
                <Box>
                  <Typography className="fl" component="label">方式</Typography>
                  <Select fullWidth size="small" value={swapType} onChange={(e) => setSwapType(e.target.value)}>
                    <MenuItem value="swap">对调两节课</MenuItem>
                    <MenuItem value="change">改课（修改某节科目）</MenuItem>
                  </Select>
                </Box>
                <Box>
                  <Typography className="fl" component="label">日期</Typography>
                  <TextField fullWidth size="small" type="date" value={dateA} onChange={(e) => setDateA(e.target.value)} />
                </Box>
                <Box>
                  <Typography className="fl" component="label">节次</Typography>
                  <Select fullWidth size="small" value={periodA} onChange={(e) => setPeriodA(Number(e.target.value))}>
                    {periodOptions(dateA).map((o) => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
                  </Select>
                </Box>
                {swapType === "swap" ? (
                  <>
                    <Box>
                      <Typography className="fl" component="label">对调日期</Typography>
                      <TextField fullWidth size="small" type="date" value={dateB} onChange={(e) => setDateB(e.target.value)} />
                    </Box>
                    <Box>
                      <Typography className="fl" component="label">对调节次</Typography>
                      <Select fullWidth size="small" value={periodB} onChange={(e) => setPeriodB(Number(e.target.value))}>
                        {periodOptions(dateB).map((o) => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
                      </Select>
                    </Box>
                  </>
                ) : (
                  <Box>
                    <Typography className="fl" component="label">新科目</Typography>
                    <Select fullWidth size="small" value={newSubject} onChange={(e) => setNewSubject(e.target.value)}>
                      {SUBJECTS.filter((s) => s.name !== "其他").map((s) => <MenuItem key={s.name} value={s.name}>{s.name}</MenuItem>)}
                    </Select>
                  </Box>
                )}
              </Box>
              <Box className="btn-row" sx={{ mt: 1.5 }}>
                <Button className="btn tiny" onClick={submitSwap}>保存调课</Button>
                <Typography className="swap-hint">保存后会同步到课表、班级日志和服务器</Typography>
              </Box>
            </Paper>
           ) : <Box className="perm-note">👀 {isMember ? "普通账号只能查看调课记录。" : "当前为只读模式，不能修改调课记录。"}</Box>}

          <Paper className="card" elevation={0}>
            <Box className="card-hd"><Box className="ico purple">📋</Box><Typography component="h2">调课 / 改课记录</Typography><Box className="spacer" /><Typography className="sub">{swaps.length} 条</Typography></Box>
            {swaps.length ? swaps.map((s) => (
              <Box className="swap-item" key={s.id}>
                <span className="swap-tag">{s.type === "change" ? "改课" : "调课"}</span>
                <Box className="swap-txt">{swapSummary(s)}</Box>
                {canRemind ? <Button size="small" className="hw-del" sx={{ opacity: 1 }} onClick={() => delSwap(s.id)}>✕</Button> : null}
              </Box>
            )) : <Box className="empty"><span className="big">🔁</span>还没有调课 / 改课记录</Box>}
          </Paper>
        </>
      )}
    </>
  );
}
