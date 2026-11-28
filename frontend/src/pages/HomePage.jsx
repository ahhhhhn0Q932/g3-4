import React from "react";
import { useNavigate } from "react-router-dom";
import { Avatar, Box, Button, Paper, Stack, Typography } from "@mui/material";
import { useApp } from "../state/AppContext.jsx";
import { WEEK } from "../data/constants.js";
import {
  beijingDate, birthdayDisplayName, birthdaySorted, birthdayText, currentQuote,
  dateLabel, fmtSyncTime, leaveStat, pad, remindActive, subjectOnHome, todayStr
} from "../utils.js";
import {
  WEEKDAYS, SLOT_TYPES, customRowState, customTimetableState, formatTimeRange,
  getScheduleForDate, slotLabel, sortSlots
} from "../data/timetableConfig.js";

const SITE_START_MS = Date.UTC(2026, 10, 14, 20, 0, 0);

function TimetableCard() {
  const { store, now } = useApp();
  const navigate = useNavigate();
  const b = beijingDate(now);
  const minutes = b.getUTCHours() * 60 + b.getUTCMinutes();
  const date = todayStr();
  const schedule = getScheduleForDate(store, date);
  const state = schedule ? customTimetableState(store, date, minutes) : null;
  const visibleRows = schedule
    ? sortSlots(schedule.slots)
        .map((slot, index) => ({ slot, index }))
        .filter(({ slot, index }) => {
          const isBreakLike = slot.type === "break" || slot.type === "lunch";
          return !isBreakLike || (state && state.activeIndex === index);
        })
    : [];
  const weekdayLabel = schedule ? (WEEKDAYS.find((w) => w.value === schedule.weekday) || WEEKDAYS[6]).label : WEEK[b.getUTCDay()];

  return (
    <Paper className="card tt-card" elevation={0}>
      <Box className="tt-hd">
        <Typography component="span">📅 今日课表</Typography>
        <Box className="spacer" />
        <Typography component="span" className="tt-day">{weekdayLabel}</Typography>
      </Box>
      {!schedule ? (
        <Box className="tt-empty">
          还没有配置课程表
          <br />
          <Button size="small" onClick={() => navigate("/timetable")} sx={{ mt: 1 }}>去课程表设置 ›</Button>
        </Box>
      ) : (
        <>
          <Box className={"tt-now" + (state && state.kind === "active" ? " now" : "")}>
            <Box className="t1">{state ? state.title : "今日课程"}</Box>
            <Box className="t2">{state ? state.sub : ""}</Box>
          </Box>
          <Box className="tt-list">
            {visibleRows.map(({ slot, index }, visibleIndex) => {
              const rowState = customRowState(index, state);
              const label = slot.type === "course" ? slot.subjectName : (slot.label || slotLabel(slot));
              return (
                <Box key={slot.id || index} className={"tt-row" + (rowState === "进行中" ? " now" : rowState === "已结束" ? " done" : rowState === "下一项" ? " next" : "")}>
                  <span className="idx">{visibleIndex + 1}</span>
                  <span className="time">{formatTimeRange(slot.start, slot.end)}</span>
                  <span className="subj">
                    {label}
                    {slot.type !== "course" && label !== SLOT_TYPES[slot.type].label ? <span className="tt-tag">{SLOT_TYPES[slot.type].label}</span> : null}
                  </span>
                  <span className="state">{rowState}</span>
                </Box>
              );
            })}
          </Box>
          <Box className="tt-lunch">模板：{schedule.template.name}</Box>
        </>
      )}
    </Paper>
  );
}

export default function HomePage() {
  const { store, session, isAdmin, isMember, now, server, toast, nextQuote, favQuote, pullNow } = useApp();
  const navigate = useNavigate();
  const bj = beijingDate(now);
  const hour = bj.getUTCHours();
  const greet = hour < 6 ? "夜深了" : hour < 9 ? "早上好" : hour < 12 ? "上午好" : hour < 14 ? "午安" : hour < 18 ? "下午好" : hour < 22 ? "晚上好" : "夜深了";
  const className = (store.settings && store.settings.className) || "班级";
  const quote = currentQuote(store);
  const hasQuote = !!(quote.q && quote.q.t);
  const isFav = hasQuote && (store.favorites || []).indexOf(quote.q.t) >= 0;
  const sorted = birthdaySorted(store);
  const todays = sorted.filter((x) => x.days === 0);
  const upcoming = sorted.filter((x) => x.days > 0 && x.days <= 60).slice(0, 6);
  const today = todayStr();
  const hwToday = (store.homeworks || []).filter((x) => x.date === today && !x.done && subjectOnHome(store, x.subject)).length;
  const lvToday = leaveStat(store, today).out;
  const rmToday = (store.reminders || []).filter((x) => remindActive(x, today) && !x.done).length;
  const remTodayList = (store.reminders || []).filter((x) => remindActive(x, today))
    .sort((a, b) => (a.done ? 1 : 0) - (b.done ? 1 : 0) || (a.created || 0) - (b.created || 0));

  const exam = store.settings.examDate ? new Date(store.settings.examDate + "T00:00:00") : null;
  const left = exam ? Math.round((new Date(exam.getFullYear(), exam.getMonth(), exam.getDate()) - new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate())) / 86400000) : null;
  const examLabel = exam ? exam.getFullYear() + " 年 " + (exam.getMonth() + 1) + " 月 " + exam.getDate() + " 日" : "去设置里填写高考日期";
  let examNum = "—", examSub = "还没有设置高考日期";
  if (left !== null) {
    if (left > 0) { examNum = left + "天"; examSub = "距离高考"; }
    else if (left === 0) { examNum = "今天"; examSub = "高考加油，稳住就是胜利"; }
    else { examNum = "已结束"; examSub = "距离高考已过去 " + Math.abs(left) + " 天"; }
  }

  const uptimeDiff = Math.max(0, now.getTime() - SITE_START_MS);
  const upDays = Math.floor(uptimeDiff / 86400000);
  const upHrs = Math.floor((uptimeDiff % 86400000) / 3600000);
  const upMins = Math.floor((uptimeDiff % 3600000) / 60000);
  const upSecs = Math.floor((uptimeDiff % 60000) / 1000);
  const uptime = "已运行 " + upDays + " 天 " + upHrs + " 小时 " + upMins + " 分 " + upSecs + " 秒";

  const toc = [
    { to: "/board", icon: "📋", t: "总览", d: "作业录入、请假、提醒一屏看全", n: hwToday ? hwToday + " 项待完成" : "", c: "#e2eefc", g: "#5a8fd8" },
    { to: "/leave", icon: "🌿", t: "请假", d: "自习课请假名单与销假", n: lvToday ? lvToday + " 人请假" : "", c: "#ddf6ee", g: "#1f9d7d" },
    { to: "/remind", icon: "🔔", t: "提醒", d: "班主任今日事项提醒", n: rmToday ? rmToday + " 条未完成" : "", c: "#fff4d6", g: "#9c6a12" }
  ];

  return (
    <Box className="home-layout">
      <Box className="home-main">
        <Paper className="hero" elevation={0}>
          <Box className="hero-in">
            <Typography className="hero-greet">{greet}，{className}</Typography>
            <Typography className={"hero-quote" + (hasQuote ? "" : " empty")}>
              {hasQuote ? quote.q.t : "回声洞还没有句子，去工具箱写一句吧。"}
            </Typography>
            {hasQuote && quote.q.by ? <Typography className="hero-by">—— {quote.q.by}</Typography> : null}
            <Box className="hero-meta">
              {hasQuote ? (
                <>
                  <Box component="span" className="quote-tag">{quote.q.tag || "其他"}</Box>
                  <Button className="qbtn" size="small" onClick={nextQuote}>换一句 ↻</Button>
                  <Button className={"qbtn" + (isFav ? " on" : "")} size="small" onClick={favQuote}>{isFav ? "♥ 已收藏" : "♡ 收藏"}</Button>
                  <Typography component="span" sx={{ ml: "auto", fontSize: 11, color: "#75604f", fontWeight: 700 }}>
                    {quote.idx + 1} / {store.quotes.length}
                  </Typography>
                </>
              ) : isMember ? null : (
                <Button className="qbtn" size="small" onClick={() => navigate("/tools")}>去回声洞添加 ›</Button>
              )}
            </Box>
          </Box>
        </Paper>

        <Box className="bday-row">
          {todays.length ? (
            <Paper className="bday-hero" elevation={0}>
              <Typography className="bh-label">🎉 BIRTHDAY · {todays.length > 1 ? "今天有 " + todays.length + " 人生日" : "今天是" + birthdayDisplayName(todays[0]) + "的生日"}</Typography>
              <Typography className="bh-names">{todays.map(birthdayDisplayName).join("、")} 生日快乐</Typography>
              <Typography className="bh-wish">{todays[0].b.wish || "生日快乐！愿你所求皆如愿，所行皆坦途。"}</Typography>
              <Button className="btn tiny" onClick={() => toast("生日快乐 🎂", "🎊")}>🎊 一起庆祝</Button>
            </Paper>
          ) : (
            <Paper className="bday-none" elevation={0}>
              <Typography>🎈 今天没有生日安排</Typography>
              <Typography component="b" sx={{ display: "block", mt: 0.5 }}>
                {upcoming[0] ? "距离 " + birthdayDisplayName(upcoming[0]) + " 的生日还有 " + upcoming[0].days + " 天" : "还没有填写生日"}
              </Typography>
            </Paper>
          )}
          <Paper className="bday-up" elevation={0}>
            <Typography className="bu-hd">近期生日 · 未来 60 天</Typography>
            <Box className="bu-list">
              {upcoming.length ? upcoming.map((it, i) => {
                const col = ["#ff9a8b", "#ffb36b", "#7fd8c4", "#8fc9ff", "#c3b4f5", "#f2a2c0"][i % 6];
                return (
                  <Box className="bday-item" key={it.kind + it.b.id}>
                    <Avatar className="avatar" sx={{ bgcolor: col, width: 32, height: 32, fontSize: 14 }}>
                      {String(it.b.name || "?").slice(-1)}
                    </Avatar>
                    <Box className="bday-info">
                      <Box className="bday-name">{it.b.name}</Box>
                      <Box className="bday-date">{(it.kind === "teacher" ? "教师 · " : "") + birthdayText(it.b.md)}</Box>
                    </Box>
                    <span className="bday-days">{it.days} 天后</span>
                  </Box>
                );
              }) : <Box className="mini-empty">未来 60 天没有生日安排</Box>}
            </Box>
          </Paper>
        </Box>

        <Box className="home-pair">
          <Paper className="card daily-card exam" elevation={0}>
            <Box className="daily-hd"><span>⏳ 高考倒计时</span><Box className="spacer" /><span>{examLabel}</span></Box>
            <Box className="exam-body">
              <Box className="exam-num">{examNum}</Box>
              <Box className="exam-sub">{examSub}</Box>
            </Box>
            {left === null ? <Box className="exam-note"><Button size="small" onClick={() => navigate("/settings")}>去设置 ›</Button></Box> : null}
          </Paper>

          <Paper className="card daily-card clock" elevation={0}>
            <Box className="daily-hd"><span>🛰️ 运行状态</span><Box className="spacer" /><span>服务器</span></Box>
            <Box className="clock-body">
              <Box className="clock-up clock-up-big">{uptime}</Box>
              <Box className="clock-cloud">
                <span className={"sync-dot " + (!session ? "off" : server.error ? "err" : server.lastSync ? "ok" : "off")} />
                <span>{!session ? "未登录" : server.error ? "服务器异常" : server.lastSync ? "服务器正常 · " + fmtSyncTime(server.lastSync) : "等待同步"}</span>
              </Box>
              <Box className="clock-sub">北京时间 <b>{pad(bj.getUTCHours())}:{pad(bj.getUTCMinutes())}:{pad(bj.getUTCSeconds())}</b></Box>
              <Box className="clock-date">{bj.getUTCFullYear()}年{bj.getUTCMonth() + 1}月{bj.getUTCDate()}日 · {WEEK[bj.getUTCDay()]}</Box>
              <Button size="small" sx={{ mt: 1 }} onClick={() => pullNow(true)}>刷新服务器数据</Button>
            </Box>
          </Paper>

          <Paper className="card daily-card remind" elevation={0}>
            <Box className="daily-hd">
              <span>🔔 每日提醒</span><Box className="spacer" />
              <Button size="small" onClick={() => navigate("/remind")}>{isAdmin ? "管理 ›" : "查看 ›"}</Button>
            </Box>
            <Box className="remind-list">
              {remTodayList.length ? remTodayList.slice(0, 6).map((r) => (
                <Box className="remind-line" key={r.id}>
                  <span className="rdot" />
                  <span>{r.text}</span>
                </Box>
              )) : <Box className="remind-empty">今天没有提醒</Box>}
            </Box>
          </Paper>
        </Box>

        <Box className="toc-hd"><h2>目录</h2><span>想去哪儿，点一下</span></Box>
        <Box className="toc">
          {toc.map((x) => (
            <Box className="toc-item" key={x.to} onClick={() => navigate(x.to)} style={{ "--tc": x.c, "--tg": x.g }}>
              <Box className="toc-ico">{x.icon}</Box>
              <h3>{x.t}</h3>
              <p>{x.d}</p>
              <Box className="go">进入 →</Box>
              {x.n ? <Box className="cnt">{x.n}</Box> : null}
            </Box>
          ))}
        </Box>
      </Box>
      <Box className="home-side">
        <TimetableCard />
      </Box>
    </Box>
  );
}
