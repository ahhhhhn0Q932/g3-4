import React, { useMemo, useState } from "react";
import {
  Box, Button, Checkbox, Chip, MenuItem, Paper, Select, TextField, Typography
} from "@mui/material";
import { useApp } from "../state/AppContext.jsx";
import { LEAVE_PERIODS, WEEK } from "../data/constants.js";
import { beijingDate, dateLabel, expectedStudents, leaveStat, periodRangeText, todayStr } from "../utils.js";

export default function LeavePage() {
  const { store, isAdmin, isMember, canEdit, toast, addLeave, toggleLeave, delLeave } = useApp();
  const today = todayStr();
  const canLeave = canEdit("leave");
  const [filterDate, setFilterDate] = useState(today);
  const [expanded, setExpanded] = useState(false);
  const [picked, setPicked] = useState([]);
  const [periods, setPeriods] = useState([]);
  const [reason, setReason] = useState("病假");
  const [reasonOther, setReasonOther] = useState("");
  const [search, setSearch] = useState("");

  const students = expectedStudents(store, today);
  const lv = leaveStat(store, filterDate);
  const dayList = lv.all;
  const filteredStudents = students.filter((s) => !search || s.name.indexOf(search) >= 0);
  const history = useMemo(() => (store.leaves || []).slice().sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    return (b.created || 0) - (a.created || 0);
  }), [store.leaves]);

  function togglePick(id) {
    setPicked((prev) => prev.indexOf(id) >= 0 ? prev.filter((x) => x !== id) : [...prev, id]);
  }
  function togglePeriod(p) {
    setPeriods((prev) => prev.indexOf(p) >= 0 ? prev.filter((x) => x !== p) : [...prev, p]);
  }
  function submit() {
    if (!picked.length) { toast("请选择请假学生，可多选", "👥"); return; }
    if (!periods.length) { toast("请选择请假节次，可多选或全选", "🕒"); return; }
    let finalReason = reason;
    if (reason === "其他") {
      finalReason = reasonOther.trim();
      if (!finalReason) { toast("原因选择了“其他”，请填写具体理由", "✍️"); return; }
    }
    const period = periodRangeText(periods);
    const expectedNames = {};
    expectedStudents(store, today).forEach((s) => { expectedNames[s.name] = true; });
    let added = 0;
    picked.forEach((id, idx) => {
      const stu = students.find((s) => s.id === id);
      if (!stu || !expectedNames[stu.name]) return;
      const dup = (store.leaves || []).some((l) => {
        if (l.returned || l.date !== today || l.name !== stu.name) return false;
        const old = Array.isArray(l.periods) ? l.periods : [l.period];
        return periods.some((p) => old.indexOf(p) >= 0);
      });
      if (dup) return;
      addLeave({ name: stu.name, period, periods: periods.slice(), reason: finalReason, date: today, created: Date.now() + added + idx });
      added += 1;
    });
    if (!added) { toast("所选同学今天这些节次已经登记过了", "🌿"); return; }
    setPicked([]); setPeriods([]); setReasonOther("");
    toast("已登记 " + added + " 人：" + period, "🌿");
  }

  return (
    <>
      <Box className="page-hd">
        <Box className="ico mint">🌿</Box>
        <Box><Typography component="h1">请假登记</Typography><Typography component="p">按节次登记，支持连续选择与全选</Typography></Box>
        <Box className="spacer" />
        <Typography sx={{ fontSize: 12, color: "#75666d", fontWeight: 700 }}>{dateLabel(today)} {WEEK[beijingDate().getUTCDay()]}</Typography>
      </Box>

      {canLeave ? (
        <Paper className="card" elevation={0} sx={{ mb: 2 }}>
          <Box className="card-hd"><Box className="ico mint">✍️</Box><Typography component="h2">新登记</Typography></Box>
          <Typography className="fl" component="label">请假学生（可多选）</Typography>
          <TextField fullWidth size="small" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="输入姓名快速筛选…" />
          <Box className="stu-picker" sx={{ display: "flex", flexWrap: "wrap", gap: 1, mt: 1 }}>
            {filteredStudents.map((s) => (
              <Chip
                key={s.id}
                label={s.name}
                color={picked.indexOf(s.id) >= 0 ? "primary" : "default"}
                onClick={() => togglePick(s.id)}
                sx={{ fontWeight: 700 }}
              />
            ))}
            {!filteredStudents.length ? <Box className="mini-empty">应到名单为空，请先在总览调整应到学生</Box> : null}
          </Box>
          <Box className="form-grid" sx={{ mt: 1.5 }}>
            <Box className="full">
              <Typography className="fl" component="label">原因</Typography>
              <Select size="small" fullWidth value={reason} onChange={(e) => setReason(e.target.value)}>
                {["病假", "事假", "就诊", "竞赛集训", "体训", "其他"].map((r) => <MenuItem key={r} value={r}>{r}</MenuItem>)}
              </Select>
              {reason === "其他" ? <TextField fullWidth size="small" sx={{ mt: 1 }} value={reasonOther} onChange={(e) => setReasonOther(e.target.value)} placeholder="请输入具体请假理由" /> : null}
            </Box>
          </Box>
          <Box className="period-block">
            <Typography className="fl" component="label">节次（可多选）</Typography>
            <Box className="period-picker">
              {LEAVE_PERIODS.map((p) => (
                <Chip key={p} label={p} color={periods.indexOf(p) >= 0 ? "primary" : "default"} onClick={() => togglePeriod(p)} sx={{ fontWeight: 700 }} />
              ))}
            </Box>
            <Box className="period-bar">
              <Button size="small" className="btn ghost tiny" onClick={() => setPeriods(LEAVE_PERIODS.slice())}>全选</Button>
              <Button size="small" className="btn ghost tiny" onClick={() => setPeriods([])}>清空</Button>
              <Typography className="period-sum">{periods.length ? periodRangeText(periods) + "（共 " + periods.length + " 节）" : "未选择节次"}</Typography>
            </Box>
          </Box>
          <Box className="btn-row" sx={{ mt: 1.5 }}>
            <Button className="btn mint" onClick={submit}>＋ 登记请假</Button>
            <Typography sx={{ fontSize: 11.5, color: "#77676e", fontWeight: 600 }}>点姓名卡片切换选择 · 重复节次会自动跳过</Typography>
          </Box>
        </Paper>
       ) : <Box className="perm-note">👀 {isMember ? "普通账号只能查看请假信息，不能登记或修改。" : "当前为只读模式，不能登记或修改请假。"}</Box>}

      <Paper className="card" elevation={0} sx={{ mb: 2 }}>
        <Box className="card-hd">
          <Box className="ico orange">📅</Box><Typography component="h2">{dateLabel(filterDate)} 出勤与请假</Typography>
          <Box className="spacer" />
          <TextField type="date" size="small" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} sx={{ width: 160 }} />
        </Box>
        <Box className="lv-stat big">
          <Box className="stat"><b>{lv.total}</b><span>应到</span></Box>
          <Box className="stat"><b>{lv.present}</b><span>实到</span></Box>
          <Box className={lv.out ? "warn" : "ok"}><b>{lv.out}</b><span>请假</span></Box>
        </Box>
        {dayList.length ? (
          <Box className="leave-today-grid">
            {(expanded ? dayList : dayList.slice(0, 10)).map((l) => (
              <Box className={"leave-card" + (l.returned ? " ret" : "")} key={l.id}
                onClick={() => { if (canLeave) toggleLeave(l.id); }}
                title={canLeave ? "点击切换销假状态" : "只读"}>
                <span className="dot" /><span>{l.name}</span>
                <span className="rs">{l.period} · {l.reason}</span>
                {l.returned ? <span className="tag-pill">已销假</span> : <span className="tag-pill" style={{ background: "#fff0e6", color: "#b25a22" }}>请假中</span>}
                {canLeave ? <Button className="x" size="small" onClick={(e) => { e.stopPropagation(); delLeave(l.id); }}>✕</Button> : null}
              </Box>
            ))}
          </Box>
        ) : <Box className="mini-empty">这一天没有请假记录 ✅</Box>}
        {dayList.length > 10 ? <Button className="leave-more" size="small" onClick={() => setExpanded(!expanded)}>{expanded ? "收起" : "展开全部 " + dayList.length + " 人"}</Button> : null}
      </Paper>

      <Paper className="card" elevation={0}>
        <Box className="card-hd"><Box className="ico purple">🗂️</Box><Typography component="h2">历史记录</Typography><Box className="spacer" /><Typography className="sub">共 {store.leaves.length} 条</Typography></Box>
        {history.length ? (
          <table className="lv-table">
            <thead><tr><th>日期</th><th>姓名</th><th>节次</th><th>原因</th><th>状态</th><th /></tr></thead>
            <tbody>
              {history.slice(0, 80).map((l) => (
                <tr key={l.id}>
                  <td style={{ whiteSpace: "nowrap", color: "#75666d" }}>{dateLabel(l.date)}</td>
                  <td>{l.name}</td><td>{l.period}</td>
                  <td><span className="tag-pill">{l.reason}</span></td>
                  <td style={{ fontSize: 11, fontWeight: 800, color: l.returned ? "#3fa383" : "#b25a22" }}>{l.returned ? "已销假" : "未销假"}</td>
                  <td style={{ textAlign: "right" }}>{canLeave ? <Button size="small" className="hw-del" sx={{ opacity: 1 }} onClick={() => delLeave(l.id)}>✕</Button> : null}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <Box className="empty"><span className="big">🗂️</span>还没有请假记录</Box>}
      </Paper>
    </>
  );
}
