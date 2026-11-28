import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Box, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, InputBase, Paper, TextField, Typography } from "@mui/material";
import ChevronLeftRoundedIcon from "@mui/icons-material/ChevronLeftRounded";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import { useApp } from "../state/AppContext.jsx";
import { WEEK } from "../data/constants.js";

const CAL_WEEK = ["日","一","二","三","四","五","六"];
import {
  dateHasRecord, dateLabel, homeSubjectList, leaveStat, parseDate, remindActive, subjectColor, studentSorted, todayStr
} from "../utils.js";

function Calendar({ selected, onSelect }) {
  const { store } = useApp();
  const base = parseDate(selected) || new Date();
  const [cursor, setCursor] = useState({ y: base.getFullYear(), m: base.getMonth() });
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
    yy += Math.floor(mm / 12);
    mm = ((mm % 12) + 12) % 12;
    setCursor({ y: yy, m: mm });
  };
  return (
    <Paper className="card cal-card mini area-cal" elevation={0}>
      <Box className="cal-top">
        <Box className="cal-mon">{y} 年 {m + 1} 月</Box>
        <Box className="cal-nav">
          <IconButton size="small" onClick={() => shift(-1)} aria-label="上个月"><ChevronLeftRoundedIcon fontSize="small" /></IconButton>
          <IconButton size="small" onClick={() => shift(1)} aria-label="下个月"><ChevronRightRoundedIcon fontSize="small" /></IconButton>
        </Box>
      </Box>
      <Box className="cal-grid">
        {CAL_WEEK.map((w) => <span className="cal-wd" key={w}>{w}</span>)}
        {cells.map((c, i) => c ? (
          <Button
            key={c.ds}
            className={"cal-day" + (c.ds === today ? " today" : "") + (c.ds === selected ? " sel" : "")}
            onClick={() => onSelect(c.ds)}
            title={dateLabel(c.ds) + (c.has ? " · 有记录" : "")}
            disableRipple
          >
            {c.d}
            {c.has ? <span className="cal-dot" /> : null}
          </Button>
        ) : <span className="cal-day blank" key={"b" + i} />)}
      </Box>
      <Box className="cal-foot">
        <span>{selected === today ? "今天 " + dateLabel(today) : "回看 " + dateLabel(selected)}</span>
        {selected === today ? <span>点日期回看</span> : <Button size="small" onClick={() => onSelect(today)}>回到今天</Button>}
      </Box>
    </Paper>
  );
}

function HomeworkItem({ hw, editable }) {
  const { editHomework, delHomework } = useApp();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(hw.title);
  const due = hw.due || hw.date || "";
  const over = due && due !== hw.date && due < todayStr();
  const save = () => {
    setEditing(false);
    const next = title.trim();
    if (next && next !== hw.title) editHomework(hw.id, { title: next });
    else setTitle(hw.title);
  };
  return (
    <Box className="hw-item" style={{ "--c": subjectColor(hw.subject) }}>
      <Box className="hw-body">
        {editable ? (
          <InputBase
            className="hw-title-input"
            value={title}
            multiline
            onChange={(e) => setTitle(e.target.value)}
            onFocus={() => setEditing(true)}
            onBlur={save}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); e.currentTarget.blur(); } }}
            placeholder="写作业内容"
          />
        ) : <Box className="hw-title">{hw.title}</Box>}
        {hw.note ? <Box className="hw-note">{hw.note}</Box> : null}
      </Box>
      <Box className="hw-meta">
        {hw.minutes ? <span className="hw-chip">⏱ {hw.minutes} 分钟</span> : null}
        {due && due !== hw.date ? <span className={"hw-chip due" + (over ? " over" : "")}>截止 {dateLabel(due)}</span> : null}
      </Box>
      {editable ? (
        <IconButton className="hw-del" size="small" onClick={() => delHomework(hw.id)} title="删除"><CloseRoundedIcon fontSize="small" /></IconButton>
      ) : null}
    </Box>
  );
}

function AddPanel({ subject, onClose }) {
  const { addHomework } = useApp();
  const [title, setTitle] = useState("");
  const [minutes, setMinutes] = useState("");
  const [dueOn, setDueOn] = useState(false);
  const [due, setDue] = useState(todayStr());
  const submit = () => {
    if (!title.trim()) return;
    addHomework(subject, title, minutes, dueOn ? due : todayStr());
    onClose();
  };
  return (
    <Box className="hw-add-panel">
      <InputBase
        className="hw-add-title"
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submit(); } }}
        placeholder={"写" + subject + "作业内容，回车添加"}
      />
      <Box className="hw-add-fields">
        <label>建议时长 <InputBase type="number" value={minutes} onChange={(e) => setMinutes(e.target.value)} placeholder="30" sx={{ width: 56, border: "1px solid #ecd9cd", borderRadius: 1, px: 0.5 }} /> 分钟</label>
        <label><Checkbox size="small" checked={dueOn} onChange={(e) => setDueOn(e.target.checked)} /> 截止日期</label>
        <TextField type="date" size="small" value={due} disabled={!dueOn} onChange={(e) => setDue(e.target.value)} sx={{ width: 150 }} />
      </Box>
      <Box className="hw-add-actions">
        <Button className="hw-mini cancel" size="small" onClick={onClose}>取消</Button>
        <Button className="hw-mini add" size="small" onClick={submit}>添加</Button>
      </Box>
    </Box>
  );
}

export default function BoardPage() {
  const {
    store, isAdmin, isMember, canEdit, boardDisplay, setBoardDisplay, boardHwLayout, setBoardHwLayout,
    boardDate, setBoardDate, toast, toggleReminder, setExpected, expectedIds
  } = useApp();
  const navigate = useNavigate();
  const today = todayStr();
  const selected = boardDate || today;
  const isToday = selected === today;
  const editable = canEdit("homework") && isToday;
  const canRemind = canEdit("remind");
  const [addPanel, setAddPanel] = useState("");
  const [rosterOpen, setRosterOpen] = useState(false);
  const [rosterIds, setRosterIds] = useState([]);

  const activeHw = useMemo(() => {
    if (!isToday) return (store.homeworks || []).filter((h) => h.date === selected);
    return (store.homeworks || []).filter((h) => {
      if (!h.date) return false;
      const due = h.due || h.date;
      return h.date <= today && due >= today;
    });
  }, [store.homeworks, selected, today, isToday]);

  const grouped = useMemo(() => {
    const groups = {}, order = [];
    activeHw.slice().sort((a, b) => (a.created || 0) - (b.created || 0)).forEach((h) => {
      if (!groups[h.subject]) { groups[h.subject] = []; order.push(h.subject); }
      groups[h.subject].push(h);
    });
    const subjects = homeSubjectList(store, order);
    return { groups, subjects };
  }, [activeHw, store]);

  const lv = leaveStat(store, selected);
  const remDay = (store.reminders || []).filter((r) => isToday ? remindActive(r, selected) : r.date === selected)
    .sort((a, b) => (a.done ? 1 : 0) - (b.done ? 1 : 0) || (a.created || 0) - (b.created || 0));

  const subjectGroups = grouped.subjects.filter((sub) => {
    if (boardDisplay && !(grouped.groups[sub] || []).length) return false;
    return isToday || (grouped.groups[sub] || []).length;
  });

  const renderGroup = (sub) => {
    const list = grouped.groups[sub] || [];
    return (
      <Box className="subj-group" key={sub} style={{ "--c": subjectColor(sub) }}>
        <Box className="subj-chip">{sub}</Box>
        <Box className="subj-main">
          {list.map((hw) => <HomeworkItem key={hw.id} hw={hw} editable={editable} />)}
          {editable && addPanel === sub ? (
            <AddPanel subject={sub} onClose={() => setAddPanel("")} />
          ) : editable ? (
            <Box className="hw-tail">
              <IconButton className="hw-add-btn" size="small" onClick={() => setAddPanel(sub)} title={"添加" + sub + "作业"}>
                <AddRoundedIcon fontSize="small" />
              </IconButton>
            </Box>
          ) : null}
        </Box>
      </Box>
    );
  };

  return (
    <>
      <Box className="page-hd">
        <Box className="ico blue" title="今日总览">📋</Box>
        <Box>
          <Typography component="h1">{isToday ? "今日总览" : "历史回看"}</Typography>
          <Typography component="p">{dateLabel(selected)} {WEEK[parseDate(selected) ? parseDate(selected).getDay() : new Date().getDay()]} · {isToday ? "作业 / 请假 / 提醒一屏看全" : "正在查看这天的作业、请假与提醒"}</Typography>
        </Box>
        <Box className="spacer" />
        <Button className="btn display-mode-btn" onClick={() => setBoardDisplay(!boardDisplay)}>🖥 显示模式</Button>
        {isToday ? (
          editable ? <Typography className="hd-tip">点作业文字直接改 · 点 ＋ 添加作业</Typography> : <Typography className="hd-tip">{isMember ? "普通账号 · 作业只读" : "只读模式 · 作业只读"}</Typography>
        ) : (
          <Button className="btn ghost tiny" onClick={() => setBoardDate("")}>← 回到今天</Button>
        )}
      </Box>
      {boardDisplay ? (
        <Box className="board-tools">
          <Button className="btn ghost tiny" onClick={() => setBoardHwLayout(boardHwLayout === "cards" ? "list" : "cards")}>
            {boardHwLayout === "cards" ? "列表视图" : "卡片视图"}
          </Button>
          <Button className="btn ghost tiny" onClick={() => { setBoardDisplay(false); setBoardHwLayout("list"); }}>✕ 退出显示模式</Button>
        </Box>
      ) : null}
      <Box className="board-grid">
        <Paper className="card area-hw" elevation={0}>
          <Box className="card-hd">
            <Box className="ico blue">📚</Box>
            <Typography component="h2">每日作业</Typography>
            <Box className="spacer" />
            <Typography component="span" className="sub">{isToday ? (editable ? "按科目分组" : "按科目分组 · 只读") : "历史记录 · 只读"}</Typography>
          </Box>
          <Box className={boardDisplay ? "hw-list" : ""}>
            {boardHwLayout === "cards" && boardDisplay ? (
              <Box className="hw-card-grid">
                {subjectGroups.filter((s) => (grouped.groups[s] || []).length).map((sub) => (
                  <Box className="hw-card" key={sub} style={{ "--c": subjectColor(sub) }}>
                    <Box className="hw-card-hd"><span className="hw-card-sub">{sub}</span><span className="hw-card-cnt">{(grouped.groups[sub] || []).length} 项作业</span></Box>
                    <Box className="hw-card-body">{(grouped.groups[sub] || []).map((hw) => <HomeworkItem key={hw.id} hw={hw} editable={editable} />)}</Box>
                  </Box>
                ))}
              </Box>
            ) : subjectGroups.length ? subjectGroups.map(renderGroup) : (
              <Box className="empty"><span className="big">📚</span>{isToday ? "今天没有作业" : "这天没有主页显示的作业"}</Box>
            )}
          </Box>
          {isToday && !boardDisplay ? <Box className="hw-weekend-note">📌 周末作业请标注好截止日期</Box> : null}
        </Paper>

        {!boardDisplay ? <Calendar selected={selected} onSelect={(d) => setBoardDate(d === today ? "" : d)} /> : null}

        <Paper className="card area-remind mini" elevation={0}>
          <Box className="card-hd">
            <Box className="ico sun">🔔</Box>
            <Typography component="h2">每日提醒</Typography>
            <Box className="spacer" />
            <Button size="small" onClick={() => navigate("/remind")}>{canRemind ? "管理 ›" : "查看 ›"}</Button>
          </Box>
          {remDay.length ? (
            <Box className="remind-list">
              {remDay.map((r) => (
                <Box className={"remind-item" + (r.done ? " done" : "")} key={r.id} onClick={() => { if (isToday && canRemind) toggleReminder(r.id); }}>
                  <span className="rd" />
                  <span className="rm-text">{r.text}</span>
                  {r.due && r.due !== r.date ? <span className="rm-due-tip">截止 {dateLabel(r.due)}</span> : null}
                </Box>
              ))}
            </Box>
          ) : <Box className="mini-empty">{isToday ? "班主任还没有发布当前提醒" : "这天没有提醒"}</Box>}
        </Paper>

        <Paper className="card area-leave mini" elevation={0}>
          <Box className="card-hd">
            <Box className="ico mint">🌿</Box>
            <Typography component="h2">请假</Typography>
            <Box className="spacer" />
            {isAdmin && isToday ? <Button size="small" onClick={() => { setRosterIds(expectedIds(selected)); setRosterOpen(true); }}>调整应到</Button> : null}
            <Button size="small" onClick={() => navigate("/leave")}>登记 ›</Button>
          </Box>
          <Box className="lv-stat">
            <Box className="stat"><b>{lv.total}</b><span>应到</span></Box>
            <Box className="stat"><b>{lv.present}</b><span>实到</span></Box>
            <Box className={lv.out ? "warn" : "ok"}><b>{lv.out}</b><span>请假</span></Box>
          </Box>
          {lv.all.length ? (
            <Box className="leave-list">
              {lv.all.map((l) => (
                <Box className={"leave-chip" + (l.returned ? " ret" : "")} key={l.id}>
                  <span className="dot" /><span className="nm">{l.name}</span><span className="rs">{l.period}</span>
                </Box>
              ))}
            </Box>
          ) : <Box className="mini-empty">{lv.total ? "全员到齐 ✅" : "应到名单为空"}</Box>}
        </Paper>
      </Box>

      <Dialog open={rosterOpen} onClose={() => setRosterOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>调整应到名单</DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: 12, color: "#75666d", mb: 1 }}>勾选当天应到的学生；未勾选的学生不参与当天出勤统计。</Typography>
          <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0.5, maxHeight: "55vh", overflow: "auto" }}>
            {studentSorted(store).map((s) => (
              <label key={s.id} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 13, padding: "3px 4px", borderBottom: "1px dashed #f3e7dc" }}>
                <Checkbox size="small" checked={rosterIds.indexOf(s.id) >= 0} onChange={(e) => setRosterIds((prev) => e.target.checked ? [...prev, s.id] : prev.filter((x) => x !== s.id))} />
                {s.name}
              </label>
            ))}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRosterIds(studentSorted(store).map((s) => s.id))}>全选</Button>
          <Button onClick={() => setRosterIds([])}>清空</Button>
          <Button onClick={() => setRosterOpen(false)}>取消</Button>
          <Button variant="contained" onClick={() => { setExpected(selected, rosterIds); setRosterOpen(false); toast("应到名单已更新", "👥"); }}>保存</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
