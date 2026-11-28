import React, { useEffect, useMemo, useState } from "react";
import {
  Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle,
  Divider, IconButton, MenuItem, Paper, Select, Stack, Tab, Tabs, TextField, Typography
} from "@mui/material";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import ArrowUpwardRoundedIcon from "@mui/icons-material/ArrowUpwardRounded";
import ArrowDownwardRoundedIcon from "@mui/icons-material/ArrowDownwardRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import { useApp } from "../state/AppContext.jsx";
import { uid } from "../data/model.js";
import {
  SLOT_TYPES, WEEKDAYS, formatTimeRange, getWeekday, slotLabel, sortSlots, timeToMinutes
} from "../data/timetableConfig.js";
import { dateLabel, todayStr } from "../utils.js";

function emptySlot() {
  return { id: "slot_" + uid(), type: "course", label: "", start: "08:00", end: "08:45" };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function TemplateEditor({ value, onClose, onSave }) {
  const [form, setForm] = useState(value || { name: "", slots: [emptySlot()] });
  useEffect(() => { setForm(value ? clone(value) : { name: "", slots: [emptySlot()] }); }, [value]);
  const slots = form.slots || [];
  function setSlot(index, patch) {
    setForm((prev) => {
      const next = clone(prev);
      next.slots[index] = { ...next.slots[index], ...patch };
      return next;
    });
  }
  function addSlot() {
    setForm((prev) => {
      const next = clone(prev);
      const last = next.slots[next.slots.length - 1];
      let start = "08:00", end = "08:45";
      if (last && timeToMinutes(last.end) != null) {
        const s = timeToMinutes(last.end) + 10;
        start = String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0");
        end = String(Math.floor((s + 45) / 60)).padStart(2, "0") + ":" + String((s + 45) % 60).padStart(2, "0");
      }
      next.slots.push({ id: "slot_" + uid(), type: "course", label: "", start, end });
      return next;
    });
  }
  function removeSlot(index) {
    setForm((prev) => ({ ...prev, slots: prev.slots.filter((_, i) => i !== index) }));
  }
  function moveSlot(index, dir) {
    const target = index + dir;
    if (target < 0 || target >= slots.length) return;
    setForm((prev) => {
      const next = clone(prev);
      const tmp = next.slots[index];
      next.slots[index] = next.slots[target];
      next.slots[target] = tmp;
      return next;
    });
  }
  function save() {
    const name = String(form.name || "").trim();
    if (!name) return;
    const clean = sortSlots(slots.filter((s) => timeToMinutes(s.start) != null && timeToMinutes(s.end) != null && timeToMinutes(s.start) < timeToMinutes(s.end)));
    if (!clean.length) return;
    onSave({ id: form.id || ("tpl_" + uid()), name, slots: clean });
  }
  return (
    <Dialog open={!!value} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{form.id ? "编辑时刻表模板" : "新建时刻表模板"}</DialogTitle>
      <DialogContent>
        <TextField fullWidth margin="dense" label="模板名称" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="例如：工作日作息 / 周六作息" />
        <Typography sx={{ mt: 1.5, mb: 0.5, fontSize: 12, color: "#75666d", fontWeight: 700 }}>按时间顺序添加课程、课间、自习和午休</Typography>
        <Stack spacing={1}>
          {slots.map((slot, index) => (
            <Box key={slot.id} sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap", p: 1, border: "1px dashed #f0e2d6", borderRadius: 2 }}>
              <Select size="small" value={slot.type} onChange={(e) => {
                const type = e.target.value;
                setSlot(index, { type, label: type === "course" ? "" : (type === "break" ? "课间" : type === "selfstudy" ? "自习" : "午休") });
              }} sx={{ width: 100 }}>
                {Object.keys(SLOT_TYPES).map((key) => <MenuItem key={key} value={key}>{SLOT_TYPES[key].label}</MenuItem>)}
              </Select>
              <TextField size="small" type="time" label="开始" value={slot.start} onChange={(e) => setSlot(index, { start: e.target.value })} InputLabelProps={{ shrink: true }} sx={{ width: 130 }} />
              <TextField size="small" type="time" label="结束" value={slot.end} onChange={(e) => setSlot(index, { end: e.target.value })} InputLabelProps={{ shrink: true }} sx={{ width: 130 }} />
              {slot.type !== "course" ? (
                <TextField size="small" label="显示名称" value={slot.label || ""} onChange={(e) => setSlot(index, { label: e.target.value })} placeholder={SLOT_TYPES[slot.type].label} sx={{ width: 140 }} />
              ) : <Chip size="small" label="课程" color="primary" variant="outlined" />}
              <Box sx={{ flex: 1 }} />
              <IconButton size="small" onClick={() => moveSlot(index, -1)} disabled={index === 0}><ArrowUpwardRoundedIcon fontSize="small" /></IconButton>
              <IconButton size="small" onClick={() => moveSlot(index, 1)} disabled={index === slots.length - 1}><ArrowDownwardRoundedIcon fontSize="small" /></IconButton>
              <IconButton size="small" color="error" onClick={() => removeSlot(index)}><DeleteOutlineRoundedIcon fontSize="small" /></IconButton>
            </Box>
          ))}
        </Stack>
        <Button startIcon={<AddRoundedIcon />} sx={{ mt: 1.5 }} onClick={addSlot}>添加时刻</Button>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>取消</Button>
        <Button variant="contained" onClick={save}>保存模板</Button>
      </DialogActions>
    </Dialog>
  );
}

function SubjectDialog({ value, onClose, onSave }) {
  const [form, setForm] = useState(value || { name: "", teacher: "" });
  useEffect(() => { setForm(value || { name: "", teacher: "" }); }, [value]);
  return (
    <Dialog open={!!value} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{form.id ? "编辑科目" : "添加科目"}</DialogTitle>
      <DialogContent>
        <TextField fullWidth margin="dense" label="科目名称" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="例如：语文" />
        <TextField fullWidth margin="dense" label="授课老师" value={form.teacher} onChange={(e) => setForm({ ...form, teacher: e.target.value })} placeholder="例如：孟娜" />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>取消</Button>
        <Button variant="contained" onClick={() => onSave(form)}>保存</Button>
      </DialogActions>
    </Dialog>
  );
}

export default function TimetablePage() {
  const { store, update, toast, canEdit } = useApp();
  const canSet = canEdit("settings");
  const templates = store.timetableTemplates || [];
  const subjects = store.subjects || [];
  const weekTemplates = store.weekTemplates || {};
  const [tab, setTab] = useState("templates");
  const [templateEdit, setTemplateEdit] = useState(null);
  const [subjectEdit, setSubjectEdit] = useState(null);
  const [date, setDate] = useState(todayStr());
  const [dayOverride, setDayOverride] = useState("");
  const [dayCourses, setDayCourses] = useState({});
  const weekday = getWeekday(date);
  const weekdayLabel = (WEEKDAYS.find((w) => w.value === weekday) || WEEKDAYS[6]).label;
  const daySchedule = store.daySchedules && store.daySchedules[date];

  useEffect(() => {
    setDayOverride((daySchedule && daySchedule.templateId) || "");
    setDayCourses((daySchedule && daySchedule.courses) || {});
  }, [date, daySchedule]);

  const weekdayTemplateId = weekTemplates[String(weekday)] || "";
  const effectiveTemplateId = dayOverride || weekdayTemplateId;
  const effectiveTemplate = templates.find((t) => t.id === effectiveTemplateId) || null;
  const courseSlots = useMemo(() => (effectiveTemplate ? sortSlots(effectiveTemplate.slots).filter((s) => s.type === "course") : []), [effectiveTemplate]);

  function saveTemplate(template) {
    update((draft) => {
      const list = draft.timetableTemplates || [];
      const index = list.findIndex((t) => t.id === template.id);
      if (index >= 0) list[index] = template;
      else list.push(template);
      draft.timetableTemplates = list;
      return draft;
    });
    setTemplateEdit(null);
    toast("时刻表模板已保存", "⏱");
  }

  function deleteTemplate(template) {
    if (!window.confirm("删除模板「" + template.name + "」？已分配到该模板的周几会改为未分配。")) return;
    update((draft) => {
      draft.timetableTemplates = (draft.timetableTemplates || []).filter((t) => t.id !== template.id);
      Object.keys(draft.weekTemplates || {}).forEach((k) => {
        if (draft.weekTemplates[k] === template.id) delete draft.weekTemplates[k];
      });
      Object.keys(draft.daySchedules || {}).forEach((d) => {
        if (draft.daySchedules[d].templateId === template.id) draft.daySchedules[d].templateId = "";
      });
      return draft;
    });
    toast("模板已删除", "🗑");
  }

  function assignWeekday(day, templateId) {
    update((draft) => {
      draft.weekTemplates = draft.weekTemplates || {};
      if (templateId) draft.weekTemplates[String(day)] = templateId;
      else delete draft.weekTemplates[String(day)];
      return draft;
    });
  }

  function saveSubject(form) {
    const name = String(form.name || "").trim();
    if (!name) { toast("请填写科目名称", "📚"); return; }
    update((draft) => {
      draft.subjects = draft.subjects || [];
      if (form.id) {
        const hit = draft.subjects.find((s) => s.id === form.id);
        if (hit) { hit.name = name; hit.teacher = String(form.teacher || "").trim(); }
      } else {
        draft.subjects.push({ id: "sub_" + uid(), name, teacher: String(form.teacher || "").trim() });
      }
      return draft;
    });
    setSubjectEdit(null);
    toast("科目已保存", "📚");
  }

  function deleteSubject(subject) {
    if (!window.confirm("删除科目「" + subject.name + "」？已安排的每日课程会变为未选科目。")) return;
    update((draft) => {
      draft.subjects = (draft.subjects || []).filter((s) => s.id !== subject.id);
      Object.keys(draft.daySchedules || {}).forEach((d) => {
        const courses = draft.daySchedules[d].courses || {};
        Object.keys(courses).forEach((slotId) => { if (courses[slotId] === subject.id) delete courses[slotId]; });
      });
      return draft;
    });
    toast("科目已删除", "🗑");
  }

  function saveDay() {
    if (!effectiveTemplate) { toast("请先为这一天分配时刻表模板", "⏱"); return; }
    update((draft) => {
      draft.daySchedules = draft.daySchedules || {};
      if (!dayOverride && !Object.keys(dayCourses).length) delete draft.daySchedules[date];
      else draft.daySchedules[date] = { templateId: dayOverride || "", courses: dayCourses };
      return draft;
    });
    toast("当天课程已保存", "📅");
  }

  return (
    <>
      <Box className="page-hd">
        <Box className="ico blue">📅</Box>
        <Box><Typography component="h1">课程表</Typography><Typography component="p">自定义时刻表模板、每周安排、科目和每日课程</Typography></Box>
      </Box>

      <Tabs value={tab} onChange={(e, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab value="templates" label="时刻表模板" />
        <Tab value="week" label="每周安排" />
        <Tab value="subjects" label="科目列表" />
        <Tab value="day" label="每日课程" />
      </Tabs>

      {tab === "templates" ? (
        <>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5, flexWrap: "wrap" }}>
            <Typography sx={{ fontSize: 13, color: "#75666d", fontWeight: 700, flex: "1 1 300px", minWidth: 0 }}>模板包含「课程」「课间」「自习」「午休」，可创建多个并分配给学生每周的每一天。</Typography>
            {canSet ? <Button className="btn" sx={{ flexShrink: 0 }} startIcon={<AddRoundedIcon />} onClick={() => setTemplateEdit({ name: "", slots: [emptySlot()] })}>新建模板</Button> : null}
          </Box>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 2 }}>
            {templates.length ? templates.map((t) => (
              <Paper key={t.id} className="card" elevation={0} sx={{ p: 2 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <Typography sx={{ fontSize: 16, fontWeight: 900 }}>{t.name}</Typography>
                  <Chip size="small" label={t.slots.length + " 个时刻"} />
                  <Box sx={{ flex: 1 }} />
                  {canSet ? <IconButton size="small" onClick={() => setTemplateEdit(clone(t))}><EditRoundedIcon fontSize="small" /></IconButton> : null}
                  {canSet ? <IconButton size="small" color="error" onClick={() => deleteTemplate(t)}><DeleteOutlineRoundedIcon fontSize="small" /></IconButton> : null}
                </Box>
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.6, mt: 1 }}>
                  {sortSlots(t.slots).map((s) => (
                    <Chip key={s.id} size="small" label={(SLOT_TYPES[s.type] || SLOT_TYPES.course).label + " " + formatTimeRange(s.start, s.end) + (s.label && s.label !== (SLOT_TYPES[s.type] || SLOT_TYPES.course).label ? " · " + s.label : "")} sx={{ bgcolor: "#fffaf5" }} />
                  ))}
                </Box>
              </Paper>
            )) : <Paper className="card" elevation={0} sx={{ p: 3 }}><Typography sx={{ color: "#75666d", fontWeight: 600 }}>还没有时刻表模板，点击「新建模板」开始。</Typography></Paper>}
          </Box>
        </>
      ) : null}

      {tab === "week" ? (
        <Paper className="card" elevation={0} sx={{ p: 2 }}>
          <Typography sx={{ fontSize: 13, color: "#75666d", fontWeight: 700, mb: 1.5 }}>为每周的每一天选择一个时刻表模板；未分配时这一天不显示课程表。</Typography>
          <Stack spacing={1}>
            {WEEKDAYS.map((w) => (
              <Box key={w.value} sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap", p: 1, border: "1px dashed #f0e2d6", borderRadius: 2 }}>
                <Typography sx={{ width: 54, fontWeight: 800 }}>{w.label}</Typography>
                <Select size="small" value={weekTemplates[String(w.value)] || ""} disabled={!canSet} onChange={(e) => assignWeekday(w.value, e.target.value)} sx={{ minWidth: 230 }}>
                  <MenuItem value="">未分配（该天不显示课程表）</MenuItem>
                  {templates.map((t) => <MenuItem key={t.id} value={t.id}>{t.name}</MenuItem>)}
                </Select>
                <Typography sx={{ fontSize: 12, color: "#75666d" }}>
                  {weekTemplates[String(w.value)] ? "已分配：" + (templates.find((t) => t.id === weekTemplates[String(w.value)]) || {}).name : "未分配"}
                </Typography>
              </Box>
            ))}
          </Stack>
        </Paper>
      ) : null}

      {tab === "subjects" ? (
        <>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5, flexWrap: "wrap" }}>
            <Typography sx={{ fontSize: 13, color: "#75666d", fontWeight: 700, flex: "1 1 300px", minWidth: 0 }}>科目用于每日「课程」板块的选择，可填写授课老师。</Typography>
            {canSet ? <Button className="btn" sx={{ flexShrink: 0 }} startIcon={<AddRoundedIcon />} onClick={() => setSubjectEdit({ name: "", teacher: "" })}>添加科目</Button> : null}
          </Box>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr 1fr" }, gap: 1.5 }}>
            {subjects.length ? subjects.map((s) => (
              <Paper key={s.id} className="card" elevation={0} sx={{ p: 1.5, display: "flex", alignItems: "center", gap: 1 }}>
                <Chip size="small" label={s.name} color="primary" sx={{ fontWeight: 800 }} />
                <Typography sx={{ flex: 1, fontSize: 12, color: "#75666d" }}>{s.teacher || "未填写老师"}</Typography>
                {canSet ? <IconButton size="small" onClick={() => setSubjectEdit(clone(s))}><EditRoundedIcon fontSize="small" /></IconButton> : null}
                {canSet ? <IconButton size="small" color="error" onClick={() => deleteSubject(s)}><DeleteOutlineRoundedIcon fontSize="small" /></IconButton> : null}
              </Paper>
            )) : <Paper className="card" elevation={0} sx={{ p: 3, gridColumn: "1/-1" }}><Typography sx={{ color: "#75666d", fontWeight: 600 }}>还没有科目，点击「添加科目」开始。</Typography></Paper>}
          </Box>
        </>
      ) : null}

      {tab === "day" ? (
        <Paper className="card" elevation={0} sx={{ p: 2 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap", mb: 1.5 }}>
            <TextField size="small" type="date" label="选择日期" value={date} onChange={(e) => setDate(e.target.value)} InputLabelProps={{ shrink: true }} />
            <Typography sx={{ fontWeight: 800 }}>{dateLabel(date)} · {weekdayLabel}</Typography>
            <Box sx={{ flex: 1 }} />
            <Select
              size="small" displayEmpty value={dayOverride} disabled={!canSet}
              onChange={(e) => setDayOverride(e.target.value)}
              renderValue={(value) => value ? "当天使用：" + ((templates.find((t) => t.id === value) || {}).name || "") : "跟随" + weekdayLabel + "模板"}
              sx={{ minWidth: 250, flexShrink: 0 }}
            >
              <MenuItem value="">跟随{weekdayLabel}模板{weekdayTemplateId ? "（" + ((templates.find((t) => t.id === weekdayTemplateId) || {}).name || "") + "）" : "（未分配）"}</MenuItem>
              {templates.map((t) => <MenuItem key={t.id} value={t.id}>当天使用：{t.name}</MenuItem>)}
            </Select>
            {canSet ? <Button className="btn" sx={{ flexShrink: 0 }} onClick={saveDay}>保存当天课程</Button> : null}
          </Box>

          {!effectiveTemplate ? (
            <Alert severity="info" sx={{ borderRadius: 2 }}>这一天还没有分配时刻表模板。请到「每周安排」为{weekdayLabel}选择模板，或在上方为当天指定模板。</Alert>
          ) : (
            <>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                <Chip size="small" color="primary" label={"模板：" + effectiveTemplate.name} />
                <Typography sx={{ fontSize: 12, color: "#75666d" }}>为「课程」板块选择科目；课间、自习、午休按模板显示。</Typography>
              </Box>
              <Stack spacing={1}>
                {sortSlots(effectiveTemplate.slots).map((slot) => (
                  <Box key={slot.id} sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap", p: 1, border: "1px dashed #f0e2d6", borderRadius: 2, background: slot.type === "course" ? "#fffdfa" : "#fffaf5" }}>
                    <Chip size="small" label={slotLabel(slot)} sx={{ bgcolor: (SLOT_TYPES[slot.type] || SLOT_TYPES.course).color, color: "#fff", fontWeight: 800 }} />
                    <Typography sx={{ width: 110, fontSize: 12, fontWeight: 700, color: "#5d4a48" }}>{formatTimeRange(slot.start, slot.end)}</Typography>
                    {slot.type === "course" ? (
                      <Select size="small" value={dayCourses[slot.id] || ""} disabled={!canSet} onChange={(e) => setDayCourses((prev) => ({ ...prev, [slot.id]: e.target.value }))} sx={{ minWidth: 220 }} displayEmpty>
                        <MenuItem value="">未选科目</MenuItem>
                        {subjects.map((s) => <MenuItem key={s.id} value={s.id}>{s.name}{s.teacher ? "（" + s.teacher + "）" : ""}</MenuItem>)}
                      </Select>
                    ) : (
                      <Typography sx={{ fontSize: 12, color: "#75666d" }}>{slot.label || SLOT_TYPES[slot.type].label}</Typography>
                    )}
                  </Box>
                ))}
              </Stack>
              {!subjects.length ? <Typography sx={{ mt: 1, fontSize: 12, color: "#75666d" }}>还没有科目，请先到「科目列表」添加。</Typography> : null}
            </>
          )}
        </Paper>
      ) : null}

      <TemplateEditor value={templateEdit} onClose={() => setTemplateEdit(null)} onSave={saveTemplate} />
      <SubjectDialog value={subjectEdit} onClose={() => setSubjectEdit(null)} onSave={saveSubject} />
    </>
  );
}
