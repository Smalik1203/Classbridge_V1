// src/components/timetable/ManageTab.jsx
import React, { useEffect, useMemo, useState } from 'react';
import {
  Card, Table, Tag, Typography, Space, Button, Popconfirm,
  message, Drawer, Form, Select, Input, InputNumber, Empty, Modal, DatePicker, Checkbox, Radio, Tooltip, Row, Col
} from 'antd';
import {
  ClockCircleOutlined, BookOutlined, TeamOutlined, EditOutlined,
  PlusCircleOutlined, DeleteOutlined, CopyOutlined, ThunderboltOutlined,
  SettingOutlined, FileTextOutlined, InfoCircleOutlined, EyeOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { supabase } from '../../config/supabaseClient';
import { getUserRole, getSchoolCode } from '../../utils/metadata';
import EmptyState from '../../ui/EmptyState';

const { Text, Title } = Typography;
const { TextArea } = Input;

const STATUS_COLOR = { pending: '#9CA3AF', in_progress: '#F59E0B', completed: '#16A34A' };
const DURATION_OPTIONS = [30, 35, 40, 45, 50, 60];

/* ---------- Time helpers ---------- */
function toMin(hhmm) {
  if (!hhmm) return 0;
  const [h, m] = String(hhmm).split(':').map(n => parseInt(n, 10));
  return (h || 0) * 60 + (m || 0);
}
function fromMin(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  const hh = String(h).padStart(2, '0');
  const mm = String(m).padStart(2, '0');
  return `${hh}:${mm}:00`;
}
function overlap(a1, a2, b1, b2) { return Math.max(a1, b1) < Math.min(a2, b2); }

/**
 * parseWorkdayTime:
 * Accepts inputs like "930", "9:30", "9.30", "9a", "2p", "12p", "12a", "13", "1330"
 * Returns { ok: true, d: dayjs, hhmmss: "HH:mm:00" } OR { ok: false, msg }
 */
function parseWorkdayTime(raw) {
  if (raw == null) return { ok: false, msg: 'Time required' };
  let s = String(raw).trim().toLowerCase();
  if (!s) return { ok: false, msg: 'Time required' };

  // detect am/pm
  const hasAm = /a/.test(s);
  const hasPm = /p/.test(s);
  // keep digits
  const digits = (s.match(/\d+/g) || []).join('');
  if (!digits) return { ok: false, msg: 'Invalid time' };

  let h = 0, m = 0;
  if (digits.length <= 2) {
    // "9" or "09" -> 9:00
    h = parseInt(digits, 10);
    m = 0;
  } else if (digits.length === 3) {
    // "930" -> 9:30
    h = parseInt(digits.slice(0, 1), 10);
    m = parseInt(digits.slice(1), 10);
  } else {
    // take last 2 as minutes, rest as hour: "1230" -> 12:30, "0830" -> 08:30
    const mm = digits.slice(-2);
    const hh = digits.slice(0, -2);
    h = parseInt(hh, 10);
    m = parseInt(mm, 10);
  }

  if (Number.isNaN(h) || Number.isNaN(m)) return { ok: false, msg: 'Invalid time' };
  if (m < 0 || m > 59) return { ok: false, msg: 'Minutes must be 00–59' };

  // 12h adjustment when am/pm present
  if (hasAm || hasPm) {
    h = h % 12; // 12 -> 0 first
    if (hasPm) h += 12; // 1p -> 13, 12p -> 12 (since h was 0 after % 12, then +12 = 12)
  }
  if (h < 0 || h > 23) return { ok: false, msg: 'Hour must be 0–23' };

  const hh = String(h).padStart(2, '0');
  const mm = String(m).padStart(2, '0');
  const hhmmss = `${hh}:${mm}:00`;
  const d = dayjs(hhmmss, 'HH:mm:ss', true);
  if (!d.isValid()) return { ok: false, msg: 'Invalid time' };
  return { ok: true, d, hhmmss };
}

/* A compact, mobile-friendly "workday" time input */
function SmartTimeInput({ value, onChange, placeholder = 'e.g., 930 / 2p', width = 140 }) {
  return (
    <Input
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
      placeholder={placeholder}
      style={{ width }}
      allowClear
    />
  );
}

export default function ManageTab({
  classId,
  date,                    // dayjs
  subjects = [],
  admins = [],
  daySlots = [],           // timetable_slots for that date
  chaptersById = new Map(),
  syllabusContentMap = new Map(), // For resolving new syllabus structure names
  refreshDay,              // () => void
}) {
  const [msg, ctx] = message.useMessage();
  const dateStr = useMemo(() => date.format('YYYY-MM-DD'), [date]);

  // me (for created_by/school_code)
  const [me, setMe] = useState(null);
  const [userLoading, setUserLoading] = useState(true);
  useEffect(() => { (async () => {
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) return;
      
      // Try admin table first; fallback to users table for superadmins without admin row
      let meRow = null;
      const { data: adminRow, error: adminErr } = await supabase
        .from('admin').select('id, role, school_code').eq('id', auth.user.id).maybeSingle();
      if (adminRow) {
        meRow = adminRow;
      } else {
        const { data: userRow, error: userErr } = await supabase
          .from('users').select('role, school_code').eq('id', auth.user.id).maybeSingle();
        if (userErr) throw userErr;
        meRow = {
          id: auth.user.id,
          role: userRow?.role || getUserRole(auth.user) || null,
          school_code: userRow?.school_code || getSchoolCode(auth.user) || null,
        };
      }
      if (meRow?.school_code) {
        setMe(meRow);
      } else {
        console.error('No school_code found for user:', meRow);
      }
    } catch (error) {
      console.error('Error loading user context:', error);
    } finally {
      setUserLoading(false);
    }
  })(); }, []);

  const subjectName = (id) => subjects.find(s => s.id === id)?.subject_name || '—';
  const adminName = (id) => admins.find(a => a.id === id)?.full_name || '—';

  const rows = useMemo(() => {
    const safe = Array.isArray(daySlots) ? daySlots : [];
    return [...safe].sort((a, b) => {
      const as = a?.start_time || '';
      const bs = b?.start_time || '';
      return as > bs ? 1 : as < bs ? -1 : 0;
    }).map(r => ({ key: r.id, ...r }));
  }, [daySlots]);

  /** ---------- Drawer (Add/Edit) ---------- **/
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerBusy, setDrawerBusy] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form] = Form.useForm();
  const [duration, setDuration] = useState(40); // minutes

  // Smart time strings (workday text input)
  const [startStr, setStartStr] = useState('');
  const [endStr, setEndStr] = useState('');

  // compute a good "next gap"
  const suggestNextTime = () => {
    const sorted = [...(daySlots || [])].sort((a,b) => (a.start_time > b.start_time ? 1 : -1));
    const last = sorted.filter(s => s.end_time).slice(-1)[0];
    const nowStart = last ? toMin(last.end_time) : toMin('09:00:00');
    const nowEnd = nowStart + duration;
    return { start: fromMin(nowStart), end: fromMin(nowEnd) };
  };

  const openAdd = (type) => {
    setEditing(null);
    form.resetFields();
    const nextNo = (daySlots.reduce((m, it) => Math.max(m, it.period_number || 0), 0) || 0) + 1;
    const s = suggestNextTime();
    setStartStr(s.start.slice(0,5)); // "HH:mm"
    setEndStr(s.end.slice(0,5));
    form.setFieldsValue({
      slot_type: type,
      period_number: nextNo,
      name: type === 'break' ? 'Break' : undefined,
      subject_id: undefined,
      teacher_id: undefined,
      syllabus_item_id: undefined,
      syllabus_chapter_id: undefined,
      syllabus_topic_id: undefined,
      plan_text: '',
    });
    
    // Reset syllabus selection
    setSelectedChapterId(null);
    setTopicOptions([]);
    setDrawerOpen(true);
  };

  const openEdit = async (row) => {
    setEditing(row);
    setStartStr(String(row.start_time || '').slice(0,5));
    setEndStr(String(row.end_time || '').slice(0,5));
    
    // Load syllabus content for the subject if it's a period
    if (row.slot_type === 'period' && row.subject_id) {
      await loadSyllabusOptions(row.subject_id);
      
      // Set the selected chapter and load its topics
      if (row.syllabus_chapter_id) {
        setSelectedChapterId(row.syllabus_chapter_id);
        await loadTopicsForChapter(row.syllabus_chapter_id);
      }
    }

    form.setFieldsValue({
      slot_type: row.slot_type || 'period',
      period_number: row.period_number,
      name: row.name || undefined,
      subject_id: row.subject_id || undefined,
      teacher_id: row.teacher_id || undefined,
      syllabus_item_id: row.syllabus_item_id || undefined,
      syllabus_chapter_id: row.syllabus_chapter_id || undefined,
      syllabus_topic_id: row.syllabus_topic_id || undefined,
      plan_text: row.plan_text || '',
    });
    setDrawerOpen(true);
  };

  // Syllabus content (chapters and topics) - subject dependent
  const [syllabusLoading, setSyllabusLoading] = useState(false);
  const [topicsLoading, setTopicsLoading] = useState(false);
  const [chapterOptions, setChapterOptions] = useState([]);
  const [topicOptions, setTopicOptions] = useState([]);
  const [selectedChapterId, setSelectedChapterId] = useState(null);
  const [localSyllabusContentMap, setLocalSyllabusContentMap] = useState(new Map()); // For resolving names
  
  // Load syllabus content for all existing slots to populate the display
  useEffect(() => {
    const loadAllSyllabusContent = async () => {
      if (!classId || !daySlots?.length) return;
      
      
      try {
        // Get all unique subject IDs from existing slots
        const subjectIds = [...new Set(daySlots
          .filter(slot => slot.slot_type === 'period' && slot.subject_id)
          .map(slot => slot.subject_id)
        )];
        
        if (subjectIds.length === 0) return;
        
        // Load syllabus content for each subject
        const allContentMap = new Map();
        
        for (const subjectId of subjectIds) {
          try {
            // Get syllabus for this subject
            const { data: syl } = await supabase
              .from('syllabi')
              .select('id')
              .eq('class_instance_id', classId)
              .eq('subject_id', subjectId)
              .maybeSingle();
            
            if (!syl) continue;
            
            // Get chapters
            const { data: chapters } = await supabase
              .from('syllabus_chapters')
              .select('id, chapter_no, title')
              .eq('syllabus_id', syl.id)
              .order('chapter_no');
            
            // Get topics
            const { data: topics } = await supabase
              .from('syllabus_topics')
              .select('id, topic_no, title, chapter_id')
              .eq('syllabus_id', syl.id)
              .order('topic_no');
            
            // Build content map
            (chapters || []).forEach(chapter => {
              allContentMap.set(`chapter_${chapter.id}`, {
                type: 'chapter',
                chapterId: chapter.id,
                chapterNo: chapter.chapter_no,
                title: chapter.title
              });
            });
            
            (topics || []).forEach(topic => {
              const chapter = chapters?.find(c => c.id === topic.chapter_id);
              allContentMap.set(`topic_${topic.id}`, {
                type: 'topic',
                topicId: topic.id,
                topicNo: topic.topic_no,
                title: topic.title,
                chapterId: topic.chapter_id,
                chapterNo: chapter?.chapter_no,
                chapterTitle: chapter?.title
              });
            });
          } catch (error) {
            console.error(`Error loading syllabus for subject ${subjectId}:`, error);
          }
        }
        
        setLocalSyllabusContentMap(allContentMap);
        // console.log('Loaded syllabus content for all subjects:', allContentMap);
      } catch (error) {
        console.error('Error loading all syllabus content:', error);
      }
    };
    
    loadAllSyllabusContent();
  }, [classId, daySlots]);
  
  const loadSyllabusOptions = async (subject_id) => {
    if (!subject_id || !classId) {
      setChapterOptions([]);
      setTopicOptions([]);
      setLocalSyllabusContentMap(new Map());
      return;
    }
    
    try {
      setSyllabusLoading(true);
      setSelectedChapterId(null);
      setTopicOptions([]);
      
      // First try to get existing syllabus
      let { data: syl, error: sylQueryError } = await supabase
        .from('syllabi').select('id').eq('class_instance_id', classId).eq('subject_id', subject_id).eq('school_code', schoolCode).maybeSingle();
      
      if (sylQueryError) {
        console.error('Error querying syllabus:', sylQueryError);
        setChapterOptions([]);
        setLocalSyllabusContentMap(new Map());
        return;
      }
      
      // If no syllabus exists, create one automatically
      if (!syl) {
        try {
          const { data: newSyl, error: sylError } = await supabase
            .from('syllabi')
            .insert({
              class_instance_id: classId,
              subject_id: subject_id,
              created_by: me?.id
            })
            .select('id')
            .single();
          
          if (sylError) {
            console.error('Error creating syllabus:', sylError);
            setChapterOptions([]);
            setLocalSyllabusContentMap(new Map());
            return;
          }
          
          syl = newSyl;
        } catch (error) {
          console.error('Error creating syllabus:', error);
          setChapterOptions([]);
          setLocalSyllabusContentMap(new Map());
          return;
        }
      }
      
      // Get chapters
      const { data: chapters, error: chaptersError } = await supabase
        .from('syllabus_chapters')
        .select('id, chapter_no, title, description')
        .eq('syllabus_id', syl.id)
        .order('chapter_no');
      
      if (chaptersError) {
        console.error('Error fetching chapters:', chaptersError);
        setChapterOptions([]);
        setLocalSyllabusContentMap(new Map());
        return;
      }
      
      // Create chapter options
      const chapterOpts = (chapters || []).map(chapter => ({
        value: chapter.id,
        label: `Chapter ${chapter.chapter_no}: ${chapter.title}`,
        chapterNo: chapter.chapter_no,
        title: chapter.title
      }));
      
      setChapterOptions(chapterOpts);
      
      // Build content map for display
      const contentMap = new Map();
      (chapters || []).forEach(chapter => {
        contentMap.set(`chapter_${chapter.id}`, {
          type: 'chapter',
          chapterId: chapter.id,
          chapterNo: chapter.chapter_no,
          title: chapter.title
        });
      });
      
      setLocalSyllabusContentMap(contentMap);
    } catch (error) {
      console.error('Error in loadSyllabusOptions:', error);
      setChapterOptions([]);
      setLocalSyllabusContentMap(new Map());
    } finally { 
      setSyllabusLoading(false); 
    }
  };

  const loadTopicsForChapter = async (chapterId) => {
    if (!chapterId) {
      setTopicOptions([]);
      return;
    }
    
    try {
      setTopicsLoading(true);
      
      const { data: topics, error } = await supabase
        .from('syllabus_topics')
        .select('id, topic_no, title, description')
        .eq('chapter_id', chapterId)
        .order('topic_no');
      
      if (error) {
        console.error('Error fetching topics:', error);
        setTopicOptions([]);
        return;
      }
      
      const topicOpts = (topics || []).map(topic => ({
        value: topic.id,
        label: `Topic ${topic.topic_no}: ${topic.title}`,
        topicNo: topic.topic_no,
        title: topic.title
      }));
      
      setTopicOptions(topicOpts);
      
      // Update content map with topics
      const newContentMap = new Map(localSyllabusContentMap);
      const chapterContent = localSyllabusContentMap.get(`chapter_${chapterId}`);
      (topics || []).forEach(topic => {
        newContentMap.set(`topic_${topic.id}`, {
          type: 'topic',
          chapterId: chapterId,
          topicId: topic.id,
          topicNo: topic.topic_no,
          title: topic.title,
          chapterNo: chapterContent?.chapterNo,
          chapterTitle: chapterContent?.title
        });
      });
      setLocalSyllabusContentMap(newContentMap);
    } catch (error) {
      console.error('Error in loadTopicsForChapter:', error);
      setTopicOptions([]);
    } finally {
      setTopicsLoading(false);
    }
  };

  // When duration or start changes, recompute end (like “workday” behavior)
  useEffect(() => {
    const p = parseWorkdayTime(startStr);
    if (p.ok) {
      const sMin = toMin(p.hhmmss);
      const e = fromMin(sMin + Number(duration || 0));
      setEndStr(e.slice(0,5));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duration]);

  const onStartChange = (val) => {
    setStartStr(val);
    const p = parseWorkdayTime(val);
    if (p.ok) {
      const sMin = toMin(p.hhmmss);
      const e = fromMin(sMin + Number(duration || 0));
      setEndStr(e.slice(0,5));
    }
  };

  const clickUseNextGap = () => {
    const s = suggestNextTime();
    setStartStr(s.start.slice(0,5));
    setEndStr(s.end.slice(0,5));
  };

  const saveSlot = async () => {
    try {
      const v = await form.validateFields();

      // parse start/end strings
      const ps = parseWorkdayTime(startStr);
      const pe = parseWorkdayTime(endStr);
      if (!ps.ok) { msg.error(`Start: ${ps.msg}`); return; }
      if (!pe.ok) { msg.error(`End: ${pe.msg}`); return; }

      if (pe.d.valueOf() <= ps.d.valueOf()) {
        msg.error('End time must be after Start time');
        return;
      }

      // overlap check (same date/class)
      const ns = ps.hhmmss, ne = pe.hhmmss;
      const sMin = toMin(ns), eMin = toMin(ne);
      const currentId = editing?.id;
      for (const r of daySlots) {
        if (currentId && r.id === currentId) continue;
        if (overlap(sMin, eMin, toMin(r.start_time), toMin(r.end_time))) {
          msg.error('Time overlaps an existing slot');
          return;
        }
      }

      if (!me?.school_code || !me?.id) {
        console.error('User context missing:', { me, school_code: me?.school_code, id: me?.id });
        msg.error('User context missing. Please refresh the page or contact your administrator.');
        return;
      }

      const payload = {
        school_code: me.school_code,
        class_instance_id: classId,
        class_date: dateStr,
        period_number: Number(v.period_number),
        slot_type: v.slot_type,
        name: v.slot_type === 'break' ? (v.name || 'Break') : null,
        start_time: ns,
        end_time: ne,
        subject_id: v.slot_type === 'period' ? v.subject_id : null,
        teacher_id: v.slot_type === 'period' ? v.teacher_id : null,
        syllabus_item_id: v.slot_type === 'period' ? (v.syllabus_item_id || null) : null,
        plan_text: v.slot_type === 'period' ? (v.plan_text || null) : null,
        status: 'planned',
        created_by: me.id,
      };

      // Add new syllabus columns only if they have values (graceful handling of missing columns)
      if (v.slot_type === 'period') {
        if (v.syllabus_chapter_id) {
          payload.syllabus_chapter_id = v.syllabus_chapter_id;
        }
        if (v.syllabus_topic_id) {
          payload.syllabus_topic_id = v.syllabus_topic_id;
        }
      }
      
      // Debug: Log what we're saving
      // console.log('Saving payload:', payload);

      setDrawerBusy(true);
      if (editing?.id) {
        const { error } = await supabase.from('timetable_slots').update(payload).eq('id', editing.id);
        if (error) {
          console.error('Update error:', error);
          throw error;
        }
        msg.success('Updated');
      } else {
        const { error } = await supabase
          .from('timetable_slots')
          .upsert(payload, { onConflict: 'class_instance_id,class_date,period_number' });
        if (error) {
          console.error('Upsert error:', error);
          throw error;
        }
        msg.success('Added');
      }
      setDrawerOpen(false);
      refreshDay?.();
    } catch (e) {
      if (e?.errorFields) return; // form validation errors already displayed
      msg.error(e?.message || 'Save failed');
    } finally { setDrawerBusy(false); }
  };

  const removeSlot = async (row) => {
    try {
      const { error } = await supabase.from('timetable_slots').delete().eq('id', row.id);
      if (error) throw error;
      message.success('Deleted');
      refreshDay?.();
    } catch (e) { message.error(e?.message || 'Delete failed'); }
  };

  /** ---------- Copy From Date ---------- **/
  const [copyOpen, setCopyOpen] = useState(false);
  const [copyBusy, setCopyBusy] = useState(false);
  const [copyForm] = Form.useForm();
  const [batchModal, setBatchModal] = useState({ visible: false, loading: false });
  const [batchForm] = Form.useForm();

  const openCopy = () => {
    copyForm.resetFields();
    copyForm.setFieldsValue({
      source_date: date.clone().subtract(1, 'day'),
      include_breaks: true,
      include_lessons: true,
      mode: 'replace',
    });
    setCopyOpen(true);
  };

  const doCopy = async () => {
    try {
      const v = await copyForm.validateFields();
      const src = v.source_date?.format('YYYY-MM-DD');
      if (!src) { msg.error('Pick a source date'); return; }

      setCopyBusy(true);
      // 1) fetch source
      const { data: srcRows, error: sErr } = await supabase
        .from('timetable_slots')
        .select(`
          id, school_code, class_instance_id, class_date, period_number,
          slot_type, name, start_time, end_time,
          subject_id, teacher_id, syllabus_item_id, syllabus_chapter_id, syllabus_topic_id, plan_text, status
        `)
        .eq('class_instance_id', classId)
        .eq('class_date', src)
        .order('start_time', { ascending: true });
      if (sErr) throw sErr;

      const rows = (srcRows || []).filter(r => {
        if (r.slot_type === 'break') return !!v.include_breaks;
        return !!v.include_lessons;
      });

      if (!rows.length) { msg.info('Nothing to copy from source date'); setCopyOpen(false); return; }

      if (v.mode === 'replace') {
        const { error: delErr } = await supabase
          .from('timetable_slots').delete()
          .eq('class_instance_id', classId).eq('class_date', dateStr);
        if (delErr) throw delErr;
      }

      // 2) upsert rows for target date
      const payloads = rows.map(r => {
        const payload = {
          school_code: me?.school_code || r.school_code,
          class_instance_id: classId,
          class_date: dateStr,
          period_number: r.period_number,
          slot_type: r.slot_type,
          name: r.slot_type === 'break' ? (r.name || 'Break') : null,
          start_time: r.start_time,
          end_time: r.end_time,
          subject_id: r.slot_type === 'period' ? r.subject_id : null,
          teacher_id: r.slot_type === 'period' ? r.teacher_id : null,
          syllabus_item_id: r.slot_type === 'period' ? r.syllabus_item_id : null,
          plan_text: r.slot_type === 'period' ? r.plan_text : null,
          status: r.status || 'planned',
          created_by: me?.id || r.created_by || null,
        };

        // Only add new columns if they exist in the source data
        if (r.slot_type === 'period') {
          if (r.syllabus_chapter_id) {
            payload.syllabus_chapter_id = r.syllabus_chapter_id;
          }
          if (r.syllabus_topic_id) {
            payload.syllabus_topic_id = r.syllabus_topic_id;
          }
        }

        return payload;
      });

      const { error: upErr } = await supabase
        .from('timetable_slots')
        .upsert(payloads, { onConflict: 'class_instance_id,class_date,period_number' });
      if (upErr) throw upErr;

      msg.success(`Copied ${payloads.length} slot(s)`);
      setCopyOpen(false);
      refreshDay?.();
    } catch (e) {
      if (e?.errorFields) return;
      msg.error(e?.message || 'Copy failed');
    } finally { setCopyBusy(false); }
  };

  /** ---------- Batch Entry ---------- **/
  const openBatchModal = () => {
    batchForm.resetFields();
    const initialValues = {
      start_time: '09:00',
      duration: 40,
      periods_count: 8,
      break_after_periods: [3, 6], // Break after 3rd and 6th periods
      break_duration: 15
    };
    batchForm.setFieldsValue(initialValues);
    setBatchModal({ visible: true, loading: false });
    
    // Initialize preview
    setTimeout(() => {
      const previewElement = document.getElementById('schedule-preview');
      if (previewElement) {
        previewElement.textContent = generatePreview(initialValues);
      }
    }, 100);
  };

  // Generate preview of the schedule
  const generatePreview = (values) => {
    if (!values) return '';
    
    const { start_time, duration, periods_count, break_after_periods, break_duration } = values;
    if (!start_time || !duration || !periods_count) return 'Fill in the form to see preview';
    
    let currentTime = dayjs(`2000-01-01 ${start_time}`);
    let preview = '';
    let periodNumber = 1;
    
    for (let i = 1; i <= periods_count; i++) {
      const start = currentTime.format('HH:mm');
      const end = currentTime.add(duration, 'minute').format('HH:mm');
      
      preview += `Period ${periodNumber}: ${start} - ${end}\n`;
      currentTime = currentTime.add(duration, 'minute');
      periodNumber++;
      
      // Add break if needed
      if (break_after_periods && break_after_periods.includes(i)) {
        const breakStart = currentTime.format('HH:mm');
        const breakEnd = currentTime.add(break_duration || 15, 'minute').format('HH:mm');
        preview += `Break: ${breakStart} - ${breakEnd}\n`;
        currentTime = currentTime.add(break_duration || 15, 'minute');
      }
    }
    
    return preview;
  };

  const doBatchCreate = async () => {
    try {
      const v = await batchForm.validateFields();
      setBatchModal({ visible: true, loading: true });

      const startTime = toMin(v.start_time + ':00');
      const periodDuration = v.duration;
      const breakDuration = v.break_duration;
      const periodsCount = v.periods_count;
      const breakAfterPeriods = v.break_after_periods || [];

      const slots = [];
      let currentTime = startTime;
      let periodNumber = 1;

      for (let i = 0; i < periodsCount; i++) {
        // Add period
        const periodStart = fromMin(currentTime);
        const periodEnd = fromMin(currentTime + periodDuration);
        
        const periodSlot = {
          school_code: me.school_code,
          class_instance_id: classId,
          class_date: dateStr,
          period_number: periodNumber,
          slot_type: 'period',
          name: null,
          start_time: periodStart,
          end_time: periodEnd,
          subject_id: null, // Will be filled by user later
          teacher_id: null,
          syllabus_item_id: null,
          plan_text: null,
          status: 'planned',
          created_by: me.id,
        };
        
        // Only add new columns if they exist in the database
        // syllabus_chapter_id: null,
        // syllabus_topic_id: null,
        
        slots.push(periodSlot);

        currentTime += periodDuration;
        periodNumber++;

        // Add break if needed
        if (breakAfterPeriods.includes(i + 1) && i < periodsCount - 1) {
          const breakStart = fromMin(currentTime);
          const breakEnd = fromMin(currentTime + breakDuration);
          
          const breakSlot = {
            school_code: me.school_code,
            class_instance_id: classId,
            class_date: dateStr,
            period_number: periodNumber,
            slot_type: 'break',
            name: i === 2 ? 'Lunch Break' : 'Break',
            start_time: breakStart,
            end_time: breakEnd,
            subject_id: null,
            teacher_id: null,
            syllabus_item_id: null,
            plan_text: null,
            status: 'planned',
            created_by: me.id,
          };
          
          // Only add new columns if they exist in the database
          // syllabus_chapter_id: null,
          // syllabus_topic_id: null,
          
          slots.push(breakSlot);

          currentTime += breakDuration;
          periodNumber++;
        }
      }

      const { error } = await supabase
        .from('timetable_slots')
        .upsert(slots, { onConflict: 'class_instance_id,class_date,period_number' });
      
      if (error) throw error;

      msg.success(`Created ${slots.length} slots (${periodsCount} periods + ${breakAfterPeriods.length} breaks)`);
      setBatchModal({ visible: false, loading: false });
      refreshDay?.();
    } catch (e) {
      if (e?.errorFields) return;
      msg.error(e?.message || 'Batch creation failed');
      setBatchModal({ visible: true, loading: false });
    }
  };

  /** ---------- Columns ---------- **/
  const columns = [
    {
      title: 'Slot', key: 'slot', width: 180,
      responsive: ['xs', 'sm', 'md', 'lg', 'xl', 'xxl'],
      render: (_, r) => {
        if (r.slot_type === 'break') {
          return <Tag color="gold">{r.name || 'Break'}</Tag>;
        }
        return <Text strong>Period #{r.period_number}</Text>;
      }
    },
    {
      title: 'Time', key: 'time', width: 160,
      responsive: ['xs', 'sm', 'md', 'lg', 'xl', 'xxl'],
      render: (_, r) => (<Space size={6}><ClockCircleOutlined /><span>{String(r.start_time).slice(0,5)}–{String(r.end_time).slice(0,5)}</span></Space>)
    },
    {
      title: 'Subject', key: 'subject', width: 220,
      responsive: ['sm', 'md', 'lg', 'xl', 'xxl'],
      render: (_, r) => r.slot_type === 'period'
        ? (r.subject_id ? <Space size={6}><BookOutlined /><span>{subjectName(r.subject_id)}</span></Space> : <Tag>Unassigned</Tag>)
        : <Text type="secondary">—</Text>
    },
    {
      title: 'Teacher', key: 'teacher', width: 220,
      responsive: ['md', 'lg', 'xl', 'xxl'],
      render: (_, r) => r.slot_type === 'period'
        ? (r.teacher_id ? <Space size={6}><TeamOutlined /><span>{adminName(r.teacher_id)}</span></Space> : <Text type="secondary">—</Text>)
        : <Text type="secondary">—</Text>
    },
    {
      title: 'Chapter', key: 'chapter', width: 200,
      responsive: ['md', 'lg', 'xl', 'xxl'],
      render: (_, r) => {
        if (r.slot_type === 'break') return <Text type="secondary">—</Text>;
        
        // Check for new syllabus structure first
        if (r.syllabus_topic_id) {
          const topicContent = localSyllabusContentMap.get(`topic_${r.syllabus_topic_id}`);
          if (topicContent) {
            return (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Tag color="green" style={{ fontSize: '9px', margin: 0, padding: '1px 6px', lineHeight: '16px' }}>Ch{topicContent.chapterNo}</Tag>
                <Text style={{ fontSize: '11px', color: '#1890ff', fontWeight: 500 }}>
                  {topicContent.chapterTitle}
                </Text>
              </div>
            );
          }
          // Try to get from parent syllabusContentMap
          const parentTopicContent = syllabusContentMap.get(`topic_${r.syllabus_topic_id}`);
          if (parentTopicContent) {
            return (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Tag color="green" style={{ fontSize: '9px', margin: 0, padding: '1px 6px', lineHeight: '16px' }}>Ch{parentTopicContent.chapterNo}</Tag>
                <Text style={{ fontSize: '11px', color: '#1890ff', fontWeight: 500 }}>
                  {parentTopicContent.chapterTitle}
                </Text>
              </div>
            );
          }
          return <Tag color="orange">Content not loaded</Tag>;
        } else if (r.syllabus_chapter_id) {
          const chapterContent = localSyllabusContentMap.get(`chapter_${r.syllabus_chapter_id}`);
          if (chapterContent) {
            return (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Tag color="green" style={{ fontSize: '9px', margin: 0, padding: '1px 6px', lineHeight: '16px' }}>Ch{chapterContent.chapterNo}</Tag>
                <Text style={{ fontSize: '11px', color: '#1890ff', fontWeight: 500 }}>
                  {chapterContent.title}
                </Text>
              </div>
            );
          }
          // Try to get from parent syllabusContentMap
          const parentChapterContent = syllabusContentMap.get(`chapter_${r.syllabus_chapter_id}`);
          if (parentChapterContent) {
            return (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Tag color="green" style={{ fontSize: '9px', margin: 0, padding: '1px 6px', lineHeight: '16px' }}>Ch{parentChapterContent.chapterNo}</Tag>
                <Text style={{ fontSize: '11px', color: '#1890ff', fontWeight: 500 }}>
                  {parentChapterContent.title}
                </Text>
              </div>
            );
          }
          return <Tag color="orange">Chapter not loaded</Tag>;
        }
        
        // Fallback to old structure
        const chId = r.syllabus_item_id;
        if (!chId) {
          return (
            <Tag color="red" style={{ fontSize: '11px' }}>
              Click Edit to assign
            </Tag>
          );
        }
        const ch = chaptersById.get(chId);
        if (!ch) {
          return <Tag color="red">Chapter Missing</Tag>;
        }
        const color = STATUS_COLOR[ch.status || 'pending'];
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Tag color={color} style={{ fontSize: '9px', margin: 0, padding: '1px 6px', lineHeight: '16px' }}>Ch{ch.unit_no}</Tag>
            <Text style={{ fontSize: '11px', color: '#1890ff', fontWeight: 500 }}>
              {ch.title}
            </Text>
          </div>
        );
      }
    },
    {
      title: 'Sub Topic', key: 'subtopic', width: 200,
      responsive: ['lg', 'xl', 'xxl'],
      render: (_, r) => {
        if (r.slot_type === 'break') return <Text type="secondary">—</Text>;
        
        // Check for new syllabus structure first
        if (r.syllabus_topic_id) {
          const topicContent = localSyllabusContentMap.get(`topic_${r.syllabus_topic_id}`);
          if (topicContent) {
            return (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Tag color="blue" style={{ fontSize: '9px', margin: 0, padding: '1px 6px', lineHeight: '16px' }}>T{topicContent.topicNo}</Tag>
                <Text style={{ fontSize: '11px', color: '#52c41a' }}>
                  {topicContent.title}
                </Text>
              </div>
            );
          }
          // Try to get from parent syllabusContentMap
          const parentTopicContent = syllabusContentMap.get(`topic_${r.syllabus_topic_id}`);
          if (parentTopicContent) {
            return (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Tag color="blue" style={{ fontSize: '9px', margin: 0, padding: '1px 6px', lineHeight: '16px' }}>T{parentTopicContent.topicNo}</Tag>
                <Text style={{ fontSize: '11px', color: '#52c41a' }}>
                  {parentTopicContent.title}
                </Text>
              </div>
            );
          }
          return <Tag color="orange">Content not loaded</Tag>;
        } else if (r.syllabus_chapter_id) {
          return <Text style={{ fontSize: '10px', color: '#999' }}>No specific topic</Text>;
        }
        
        // Fallback to old structure
        if (r.syllabus_item_id) {
          return <Text style={{ fontSize: '10px', color: '#999' }}>No subtopics (old structure)</Text>;
        }
        return <Text style={{ fontSize: '10px', color: '#999' }}>No Topic</Text>;
      }
    },
    {
      title: 'Actions', key: 'actions', width: 140,
      responsive: ['xs', 'sm', 'md', 'lg', 'xl', 'xxl'],
      render: (_, r) => (
        <Space>
          <Tooltip title={`Edit ${r.slot_type === 'period' ? 'period' : 'break'}`}>
            <Button type="text" icon={<EditOutlined />} onClick={() => openEdit(r)} />
          </Tooltip>
          <Popconfirm title="Delete slot?" onConfirm={() => removeSlot(r)}>
            <Tooltip title={`Delete ${r.slot_type === 'period' ? 'period' : 'break'}`}>
              <Button type="text" danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      )
    }
  ];

  // Show loading state while user context is being loaded
  if (userLoading) {
    return (
      <Card style={{ marginTop: 8, textAlign: 'center', padding: '40px 20px' }}>
        <div>Loading user context...</div>
      </Card>
    );
  }

  // Show error if user context is missing
  if (!me?.school_code) {
    return (
      <Card style={{ marginTop: 8, textAlign: 'center', padding: '40px 20px' }}>
        <div style={{ color: '#ff4d4f' }}>
          <div style={{ fontSize: '16px', marginBottom: '8px' }}>User Context Missing</div>
          <div style={{ fontSize: '14px', color: '#666' }}>
            Unable to load your user information. Please refresh the page or contact your administrator.
          </div>
        </div>
      </Card>
    );
  }

  return classId ? (
    <>
      {ctx}
      <Card
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <BookOutlined style={{ color: '#1890ff' }} />
            <div>
              <div style={{ fontSize: '16px', fontWeight: 600, color: '#262626' }}>Timetable Management</div>
              <div style={{ fontSize: '12px', color: '#8c8c8c', fontWeight: 'normal' }}>
                Create and manage periods with syllabus content
              </div>
            </div>
          </div>
        }
        extra={
          <Space wrap>
            {/* Secondary Actions - Outlined */}
            <Tooltip title="Create multiple periods at once with automatic scheduling">
              <Button 
                type="default" 
                icon={<ThunderboltOutlined />} 
                onClick={openBatchModal} 
                size="middle"
                style={{ fontSize: '14px', height: '40px' }}
              >
                Quick Generate
              </Button>
            </Tooltip>
            <Tooltip title="Copy timetable from another date">
              <Button 
                type="default" 
                icon={<CopyOutlined />} 
                onClick={openCopy} 
                size="middle"
                style={{ fontSize: '14px', height: '40px' }}
              >
                Copy From Date
              </Button>
            </Tooltip>
            
            {/* Primary Actions - Solid */}
            <Tooltip title="Add a new teaching period">
              <Button 
                type="primary" 
                icon={<PlusCircleOutlined />} 
                onClick={() => openAdd('period')}
                size="middle"
                style={{ fontSize: '14px', height: '40px' }}
              >
                Add Period
              </Button>
            </Tooltip>
            <Tooltip title="Add a break or recess period">
              <Button 
                type="primary" 
                icon={<TeamOutlined />} 
                onClick={() => openAdd('break')}
                size="middle"
                style={{ fontSize: '14px', height: '40px' }}
              >
                Add Break
              </Button>
            </Tooltip>
          </Space>
        }
        style={{ marginTop: 8 }}
      >
        <Table
          rowKey="key"
          columns={columns}
          dataSource={rows}
          pagination={false}
          bordered
          scroll={{ x: 1200 }}
          rowClassName={(r, index) => {
            if (r.slot_type === 'break') return 'row-break';
            return index % 2 === 0 ? 'row-period-even' : 'row-period-odd';
          }}
          size="small"
          responsive={true}
          locale={{ 
            emptyText: (
              <EmptyState
                type="timetable"
                onAction={() => openAdd('period')}
                secondaryActionText="Add Break"
                onSecondaryAction={() => openAdd('break')}
              />
            )
          }}
        />
      </Card>

      {/* Enhanced Drawer for Add/Edit */}
      <Drawer
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <BookOutlined style={{ color: '#1890ff' }} />
            <div>
              <div style={{ fontSize: '16px', fontWeight: 600 }}>
                {editing
                  ? (editing.slot_type === 'break'
                      ? `Edit Break • ${String(editing.start_time).slice(0,5)}–${String(editing.end_time).slice(0,5)}`
                      : `Edit Period #${editing.period_number}`)
                  : 'Add New Period'}
              </div>
              <div style={{ fontSize: '12px', color: '#666', fontWeight: 'normal' }}>
                {editing ? 'Update period details and syllabus content' : 'Create a new period with syllabus content'}
              </div>
            </div>
          </div>
        }
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={Math.min(520, Math.floor(window.innerWidth * 0.96))}
        destroyOnClose
        footer={
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            padding: '12px 0',
            borderTop: '1px solid #f0f0f0'
          }}>
            <Text type="secondary" style={{ fontSize: '12px' }}>
              {editing ? 'Update period details' : 'Create new period'}
            </Text>
            <Space>
              <Button onClick={() => setDrawerOpen(false)} size="middle" style={{ fontSize: '13px', height: '32px' }}>Cancel</Button>
              <Button type="primary" loading={drawerBusy} onClick={saveSlot} size="middle" style={{ fontSize: '13px', height: '32px' }}>
                {editing ? 'Update' : 'Create'}
              </Button>
            </Space>
          </div>
        }
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{ slot_type: 'period', period_number: 1 }}
        >
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            {/* Basic Information Section */}
            <div>
              <Title level={5} style={{ margin: '0 0 16px 0', color: '#1890ff' }}>
                <SettingOutlined style={{ marginRight: 8 }} />
                Basic Information
              </Title>
              <Space wrap>
                <Form.Item label="Type" name="slot_type" rules={[{ required: true }]} style={{ minWidth: 180 }}>
                  <Select
                    options={[{ value: 'period', label: 'Period' }, { value: 'break', label: 'Break' }]}
                    onChange={() => {
                      // clear fields when switching types
                      form.setFieldsValue({ subject_id: undefined, teacher_id: undefined, syllabus_item_id: undefined, plan_text: '' });
                      setSelectedChapterId(null);
                      setTopicOptions([]);
                    }}
                  />
                </Form.Item>
                <Form.Item label="Period #" name="period_number" rules={[{ required: true, message: 'Enter period number' }]} style={{ minWidth: 180 }}>
                  <InputNumber min={1} style={{ width: 140 }} />
                </Form.Item>
              </Space>
            </div>

            {/* Time Section */}
            <div>
              <Title level={5} style={{ margin: '0 0 16px 0', color: '#1890ff' }}>
                <ClockCircleOutlined style={{ marginRight: 8 }} />
                Time Schedule
              </Title>
              <Space wrap align="end">
                <Form.Item label="Start Time" required style={{ minWidth: 180 }}>
                  <SmartTimeInput value={startStr} onChange={onStartChange} placeholder="e.g., 930 / 2p" />
                </Form.Item>
                <Form.Item label="Duration" style={{ minWidth: 160 }}>
                  <Select
                    style={{ width: 140 }}
                    value={duration}
                    onChange={(v) => setDuration(v)}
                    options={DURATION_OPTIONS.map(x => ({ value: x, label: `${x} min` }))}
                  />
                </Form.Item>
                <Form.Item label="End Time" required style={{ minWidth: 180 }}>
                  <SmartTimeInput value={endStr} onChange={setEndStr} placeholder="auto or edit" />
                </Form.Item>
                <Tooltip title="Automatically fill the next available time slot">
                  <Button onClick={clickUseNextGap} icon={<ThunderboltOutlined />}>
                    Auto-fill next slot
                  </Button>
                </Tooltip>
              </Space>
            </div>

            {/* Break-only */}
            <Form.Item noStyle shouldUpdate>
              {({ getFieldValue }) =>
                getFieldValue('slot_type') === 'break' ? (
                  <div>
                    <Title level={5} style={{ margin: '0 0 16px 0', color: '#1890ff' }}>
                      <TeamOutlined style={{ marginRight: 8 }} />
                      Break Details
                    </Title>
                    <Form.Item label="Break Name" name="name" rules={[{ required: true, message: 'Enter break name' }]}>
                      <Input placeholder="e.g., Lunch, Recess, Assembly" size="large" />
                    </Form.Item>
                  </div>
                ) : null
              }
            </Form.Item>

            {/* Period-only */}
            <Form.Item noStyle shouldUpdate>
              {({ getFieldValue }) =>
                getFieldValue('slot_type') === 'period' ? (
                  <div>
                    <Title level={5} style={{ margin: '0 0 16px 0', color: '#1890ff' }}>
                      <BookOutlined style={{ marginRight: 8 }} />
                      Period Details
                    </Title>
                    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                      <Form.Item label="Subject" name="subject_id" rules={[{ required: true, message: 'Select a subject' }]}>
                        <Select
                          showSearch 
                          placeholder="Select subject"
                          size="large"
                          options={(subjects || []).map(s => ({ label: s.subject_name, value: s.id }))}
                          optionFilterProp="label"
                          onChange={async (sid) => {
                            form.setFieldValue('syllabus_item_id', undefined);
                            form.setFieldValue('syllabus_chapter_id', undefined);
                            form.setFieldValue('syllabus_topic_id', undefined);
                            setSelectedChapterId(null);
                            setTopicOptions([]);
                            await loadSyllabusOptions(sid);
                          }}
                        />
                      </Form.Item>
                      <Form.Item label="Teacher" name="teacher_id" rules={[{ required: true, message: 'Select a teacher' }]}>
                        <Select
                          showSearch 
                          placeholder="Select teacher"
                          size="large"
                          options={(admins || []).map(a => ({ label: a.full_name, value: a.id }))}
                          optionFilterProp="label"
                        />
                      </Form.Item>
                      
                      {/* Chapter Selection */}
                      <Form.Item label="Chapter" name="syllabus_chapter_id">
                        <Select
                          showSearch
                          placeholder="Select a chapter"
                          size="large"
                          value={selectedChapterId}
                          loading={syllabusLoading}
                          optionFilterProp="label"
                          notFoundContent="No chapters available. Create in Syllabus."
                                                      onChange={(chapterId) => {
                              setSelectedChapterId(chapterId);
                              form.setFieldValue('syllabus_chapter_id', chapterId);
                              form.setFieldValue('syllabus_topic_id', null);
                              form.setFieldValue('syllabus_item_id', null);
                              // Load topics for selected chapter
                              loadTopicsForChapter(chapterId);
                            }}
                          options={chapterOptions}
                        />
                      </Form.Item>

                      {/* Topic Selection */}
                      <Form.Item label="Topic (optional)" name="syllabus_topic_id">
                        <Select
                          showSearch
                          placeholder="Select a specific topic (optional)"
                          size="large"
                          loading={topicsLoading}
                          optionFilterProp="label"
                          notFoundContent={selectedChapterId ? "No topics available for this chapter" : "Select a chapter first"}
                          disabled={!selectedChapterId}
                                                      onChange={(topicId) => {
                              form.setFieldValue('syllabus_topic_id', topicId);
                              form.setFieldValue('syllabus_item_id', null);
                            }}
                          options={topicOptions}
                        />
                      </Form.Item>
                      
                      <Form.Item label="Lesson Notes" name="plan_text">
                        <TextArea 
                          autoSize={{ minRows: 3, maxRows: 6 }} 
                          placeholder="Add notes about what you'll be teaching, activities, or important points for this period..."
                          style={{ fontSize: '14px' }}
                        />
                      </Form.Item>
                    </Space>
                  </div>
                ) : null
              }
            </Form.Item>
          </Space>
        </Form>
      </Drawer>

      {/* Copy From Date modal */}
      <Modal
        title="Copy Timetable From Date"
        open={copyOpen}
        onCancel={() => setCopyOpen(false)}
        onOk={doCopy}
        okText="Copy"
        confirmLoading={copyBusy}
      >
        <Form
          form={copyForm}
          layout="vertical"
          initialValues={{ include_breaks: true, include_lessons: true, mode: 'replace' }}
        >
          <Form.Item label="Source date" name="source_date" rules={[{ required: true, message: 'Pick a date' }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="What to copy">
            <Checkbox.Group style={{ width: '100%' }}>
              <Space direction="vertical">
                <Form.Item name="include_lessons" valuePropName="checked" noStyle>
                  <Checkbox>Lessons (subject/teacher/chapter/description)</Checkbox>
                </Form.Item>
                <Form.Item name="include_breaks" valuePropName="checked" noStyle>
                  <Checkbox>Breaks</Checkbox>
                </Form.Item>
              </Space>
            </Checkbox.Group>
          </Form.Item>
          <Form.Item label="Conflict handling" name="mode">
            <Radio.Group>
              <Space direction="vertical">
                <Radio value="replace">Replace current day (clear then copy)</Radio>
                <Radio value="merge">Merge (update/insert by period number)</Radio>
              </Space>
            </Radio.Group>
          </Form.Item>
        </Form>
      </Modal>

      {/* Batch Entry Modal */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <ThunderboltOutlined style={{ color: '#1890ff' }} />
            <div>
              <div style={{ fontSize: '16px', fontWeight: 600 }}>Quick Generate Timetable</div>
              <div style={{ fontSize: '12px', color: '#666', fontWeight: 'normal' }}>
                Create multiple periods at once with automatic scheduling
              </div>
            </div>
          </div>
        }
        open={batchModal.visible}
        onCancel={() => setBatchModal({ visible: false, loading: false })}
        onOk={doBatchCreate}
        okText="Generate Timetable"
        confirmLoading={batchModal.loading}
        width={600}
      >
        <Form
          form={batchForm}
          layout="vertical"
          onValuesChange={(changedValues, allValues) => {
            // Update preview when form values change
            const previewElement = document.getElementById('schedule-preview');
            if (previewElement) {
              previewElement.textContent = generatePreview(allValues);
            }
          }}
          initialValues={{
            start_time: '09:00',
            duration: 40,
            periods_count: 8,
            break_after_periods: [3, 6],
            break_duration: 15
          }}
        >
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <div>
              <Title level={5} style={{ margin: '0 0 16px 0', color: '#1890ff' }}>
                <ClockCircleOutlined style={{ marginRight: 8 }} />
                Schedule Settings
              </Title>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item label="Start Time" name="start_time" rules={[{ required: true }]}>
                    <Input placeholder="09:00" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item label="Period Duration (min)" name="duration" rules={[{ required: true }]}>
                    <Select options={[30, 35, 40, 45, 50, 60].map(x => ({ value: x, label: `${x} min` }))} />
                  </Form.Item>
                </Col>
              </Row>
            </div>

            <div>
              <Title level={5} style={{ margin: '0 0 16px 0', color: '#1890ff' }}>
                <BookOutlined style={{ marginRight: 8 }} />
                Period Configuration
              </Title>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item label="Number of Periods" name="periods_count" rules={[{ required: true }]}>
                    <InputNumber min={1} max={12} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item label="Break Duration (min)" name="break_duration" rules={[{ required: true }]}>
                    <Select options={[10, 15, 20, 30].map(x => ({ value: x, label: `${x} min` }))} />
                  </Form.Item>
                </Col>
              </Row>
            </div>

            <div>
              <Title level={5} style={{ margin: '0 0 16px 0', color: '#1890ff' }}>
                <TeamOutlined style={{ marginRight: 8 }} />
                Break Schedule
              </Title>
              <Form.Item 
                label="Add breaks after which periods?" 
                name="break_after_periods"
                extra="Select periods after which you want breaks (e.g., after 3rd and 6th periods)"
              >
                <Select
                  mode="multiple"
                  placeholder="Select periods"
                  options={Array.from({ length: 8 }, (_, i) => ({ 
                    value: i + 1, 
                    label: `After Period ${i + 1}` 
                  }))}
                />
              </Form.Item>
            </div>

            <div>
              <Title level={5} style={{ margin: '0 0 16px 0', color: '#1890ff' }}>
                <EyeOutlined style={{ marginRight: 8 }} />
                Preview Schedule
              </Title>
              <div style={{ 
                padding: '16px', 
                background: '#f8f9fa', 
                border: '1px solid #e9ecef', 
                borderRadius: '6px',
                maxHeight: '200px',
                overflowY: 'auto'
              }}>
                <div id="schedule-preview" style={{ fontSize: '12px', lineHeight: '1.6' }}>
                  {/* Preview will be generated here */}
                </div>
              </div>
            </div>

            <div style={{ 
              padding: '12px', 
              background: '#f6ffed', 
              border: '1px solid #b7eb8f', 
              borderRadius: '6px' 
            }}>
              <Text type="secondary" style={{ fontSize: '12px' }}>
                <InfoCircleOutlined style={{ marginRight: 4 }} />
                This will create empty periods that you can later assign subjects and teachers to. 
                Breaks will be automatically named (e.g., "Lunch Break" after 3rd period).
              </Text>
            </div>
          </Space>
        </Form>
      </Modal>
      
      {/* Enhanced Table Styles */}
      <style>{`
        /* Reduce row height */
        .ant-table-tbody > tr > td {
          padding: 8px 12px !important;
          height: 40px !important;
        }
        .ant-table-thead > tr > th {
          padding: 8px 12px !important;
          height: 40px !important;
          font-size: 13px !important;
          font-weight: 500 !important;
          color: #666 !important;
        }
        
        /* Zebra striping */
        .row-period-even td { 
          background: #fafafa !important; 
        }
        .row-period-odd td { 
          background: #ffffff !important; 
        }
        .row-break td { 
          background: #fff7e6 !important; 
          border-bottom: 2px solid #f0f0f0 !important;
        }
        
        /* Hover effects */
        .row-period-even:hover td {
          background-color: #f0f9ff !important;
          border-color: #91d5ff !important;
        }
        .row-period-odd:hover td {
          background-color: #f0f9ff !important;
          border-color: #91d5ff !important;
        }
        .row-break:hover td {
          background-color: #fff7e6 !important;
          border-color: #ffd591 !important;
        }
      `}</style>
    </>
  ) : (
    <Card style={{ marginTop: 12 }}><Text type="secondary">Select a class to manage this date.</Text></Card>
  );
}
