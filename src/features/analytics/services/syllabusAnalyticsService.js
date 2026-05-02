// src/features/analytics/services/syllabusAnalyticsService.js
//
// Syllabus analytics queries — direct table aggregation since no
// dedicated RPCs exist for syllabus rollups. Every query is scoped to
// the AY by joining on class_instances.academic_year_id (syllabi rows
// belong to a class, classes belong to an AY).
//
// Tables touched:
//   syllabi (id, class_instance_id, subject_id)
//   syllabus_chapters (id, syllabus_id, chapter_no, title)
//   syllabus_topics (id, chapter_id, topic_no, title)
//   syllabus_progress (school_code, class_instance_id, subject_id,
//                      syllabus_chapter_id, syllabus_topic_id, taught_at)

import { supabase } from '@/config/supabaseClient';
import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';
import { getClassInstanceIdsForAy, getAyDateRange } from './ayScope';

dayjs.extend(utc);
dayjs.extend(timezone);

const IST = 'Asia/Kolkata';
const fmt = (d) => dayjs(d).tz(IST).format('YYYY-MM-DD');

async function resolveDateRange({ ayId, startDate, endDate }) {
  if (startDate && endDate) return { start: fmt(startDate), end: fmt(endDate) };
  if (ayId) {
    const r = await getAyDateRange(ayId);
    if (r?.start && r?.end) return { start: r.start, end: r.end };
  }
  const today = dayjs().tz(IST);
  return { start: today.subtract(29, 'day').format('YYYY-MM-DD'), end: today.format('YYYY-MM-DD') };
}

// Page through Supabase to defeat the 1000-row default. Returns all rows.
async function fetchAll(builder, label = 'rows') {
  const PAGE = 1000;
  let from = 0;
  let all = [];
  while (true) {
    const { data, error } = await builder.range(from, from + PAGE - 1);
    if (error) {
      console.warn(`[syllabusAnalytics] ${label} fetch error`, error);
      return all;
    }
    if (!data || data.length === 0) break;
    all = all.concat(data);
    if (data.length < PAGE) break;
    from += PAGE;
    if (from > 50000) break;
  }
  return all;
}

// ────────────────────────────────────────────────────────────────────────────
// Core fetch — pulls everything needed for the page in 4 parallel calls.
// Returns a normalised shape. Other functions are pure aggregators on top.
// ────────────────────────────────────────────────────────────────────────────
async function fetchScope({ schoolCode, ayId, classInstanceId, subjectId }) {
  const classIds = (classInstanceId && classInstanceId !== 'all')
    ? [classInstanceId]
    : await getClassInstanceIdsForAy(schoolCode, ayId);

  if (classIds.length === 0) {
    return { classIds: [], syllabi: [], chapters: [], topics: [], progress: [], subjectsById: new Map(), classesById: new Map() };
  }

  // Syllabi for these classes (optionally filtered to a single subject)
  let syllabiQ = supabase
    .from('syllabi')
    .select('id, class_instance_id, subject_id')
    .in('class_instance_id', classIds);
  if (subjectId && subjectId !== 'all') syllabiQ = syllabiQ.eq('subject_id', subjectId);
  const syllabi = await fetchAll(syllabiQ, 'syllabi');
  const syllabusIds = syllabi.map((s) => s.id);

  if (syllabusIds.length === 0) {
    return { classIds, syllabi: [], chapters: [], topics: [], progress: [], subjectsById: new Map(), classesById: new Map() };
  }

  // Chapters first (we need their ids to fetch topics).
  const chapters = await fetchAll(
    supabase.from('syllabus_chapters')
      .select('id, syllabus_id, chapter_no, title')
      .in('syllabus_id', syllabusIds),
    'chapters',
  );
  const chapterIds = chapters.map((c) => c.id);

  // Parallel: topics (chunked), progress, subjects, classes
  const [topics, progress, subjectsRes, classesRes] = await Promise.all([
    (async () => {
      if (chapterIds.length === 0) return [];
      const out = [];
      const CHUNK = 200;
      for (let i = 0; i < chapterIds.length; i += CHUNK) {
        const slice = chapterIds.slice(i, i + CHUNK);
        const rows = await fetchAll(
          supabase.from('syllabus_topics')
            .select('id, chapter_id, topic_no, title')
            .in('chapter_id', slice),
          'topics',
        );
        out.push(...rows);
      }
      return out;
    })(),
    (async () => {
      // syllabus_progress is keyed on class + subject; range may be unbounded
      // so we filter by class_instance_id and (optionally) subject.
      let q = supabase
        .from('syllabus_progress')
        .select('id, class_instance_id, subject_id, syllabus_chapter_id, syllabus_topic_id, taught_at')
        .in('class_instance_id', classIds);
      if (subjectId && subjectId !== 'all') q = q.eq('subject_id', subjectId);
      return fetchAll(q, 'progress');
    })(),
    (async () => {
      const subjectIds = Array.from(new Set(syllabi.map((s) => s.subject_id).filter(Boolean)));
      if (subjectIds.length === 0) return [];
      const { data, error } = await supabase
        .from('subjects')
        .select('id, subject_name')
        .in('id', subjectIds);
      if (error) {
        console.warn('[syllabusAnalytics] subjects fetch error', error);
        return [];
      }
      return data || [];
    })(),
    (async () => {
      const { data, error } = await supabase
        .from('class_instances')
        .select('id, grade, section')
        .in('id', classIds);
      if (error) return [];
      return data || [];
    })(),
  ]);

  const subjectsById = new Map(subjectsRes.map((s) => [s.id, s]));
  const classesById = new Map(classesRes.map((c) => [c.id, c]));
  return { classIds, syllabi, chapters, topics, progress, subjectsById, classesById };
}

// ────────────────────────────────────────────────────────────────────────────
// 1. Headline KPIs
// ────────────────────────────────────────────────────────────────────────────
export async function getHeadlineKpis({ schoolCode, ayId, classInstanceId, subjectId }) {
  const empty = {
    totalChapters: 0, completedChapters: 0,
    totalTopics: 0, completedTopics: 0,
    overallPct: 0, chapterPct: 0,
    syllabusCount: 0, subjectCount: 0, classCount: 0,
    onTrackSubjects: 0, atRiskSubjects: 0,
    lastTaughtAt: null,
  };
  if (!schoolCode || !ayId) return empty;

  const { syllabi, chapters, topics, progress } = await fetchScope({
    schoolCode, ayId, classInstanceId, subjectId,
  });
  if (syllabi.length === 0) return empty;

  const taughtChapters = new Set();
  const taughtTopics = new Set();
  let lastTaughtAt = null;
  progress.forEach((p) => {
    if (p.syllabus_chapter_id) taughtChapters.add(p.syllabus_chapter_id);
    if (p.syllabus_topic_id) taughtTopics.add(p.syllabus_topic_id);
    if (p.taught_at && (!lastTaughtAt || p.taught_at > lastTaughtAt)) lastTaughtAt = p.taught_at;
  });

  const totalChapters = chapters.length;
  const completedChapters = chapters.filter((c) => taughtChapters.has(c.id)).length;
  const totalTopics = topics.length;
  const completedTopics = topics.filter((t) => taughtTopics.has(t.id)).length;

  const overallPct = totalTopics > 0
    ? Math.round((completedTopics / totalTopics) * 1000) / 10
    : (totalChapters > 0 ? Math.round((completedChapters / totalChapters) * 1000) / 10 : 0);
  const chapterPct = totalChapters > 0
    ? Math.round((completedChapters / totalChapters) * 1000) / 10
    : 0;

  // Per-syllabus completion to count on-track / at-risk
  const topicsByChapter = new Map();
  topics.forEach((t) => {
    const arr = topicsByChapter.get(t.chapter_id) || [];
    arr.push(t);
    topicsByChapter.set(t.chapter_id, arr);
  });
  const chaptersBySyllabus = new Map();
  chapters.forEach((c) => {
    const arr = chaptersBySyllabus.get(c.syllabus_id) || [];
    arr.push(c);
    chaptersBySyllabus.set(c.syllabus_id, arr);
  });
  let onTrackSubjects = 0;
  let atRiskSubjects = 0;
  syllabi.forEach((s) => {
    const ch = chaptersBySyllabus.get(s.id) || [];
    let total = 0, done = 0;
    ch.forEach((c) => {
      const tps = topicsByChapter.get(c.id) || [];
      total += tps.length;
      done += tps.filter((t) => taughtTopics.has(t.id)).length;
    });
    if (total === 0) return;
    const pct = (done / total) * 100;
    if (pct >= 60) onTrackSubjects += 1;
    else if (pct < 30) atRiskSubjects += 1;
  });

  return {
    totalChapters, completedChapters,
    totalTopics, completedTopics,
    overallPct, chapterPct,
    syllabusCount: syllabi.length,
    subjectCount: new Set(syllabi.map((s) => s.subject_id).filter(Boolean)).size,
    classCount: new Set(syllabi.map((s) => s.class_instance_id)).size,
    onTrackSubjects, atRiskSubjects,
    lastTaughtAt,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// 2. Daily progress trend — topics taught per day in [start, end].
// Calendar-windowed, zero-filled.
// ────────────────────────────────────────────────────────────────────────────
export async function getDailyProgress({ schoolCode, ayId, classInstanceId, subjectId, startDate, endDate }) {
  if (!schoolCode || !ayId) return [];
  const { start, end } = await resolveDateRange({ ayId, startDate, endDate });
  const classIds = (classInstanceId && classInstanceId !== 'all')
    ? [classInstanceId]
    : await getClassInstanceIdsForAy(schoolCode, ayId);
  if (classIds.length === 0) return [];

  let q = supabase
    .from('syllabus_progress')
    .select('id, syllabus_topic_id, syllabus_chapter_id, taught_at, class_instance_id, subject_id')
    .in('class_instance_id', classIds)
    .gte('taught_at', `${start}T00:00:00`)
    .lte('taught_at', `${end}T23:59:59`);
  if (subjectId && subjectId !== 'all') q = q.eq('subject_id', subjectId);
  const rows = await fetchAll(q, 'daily-progress');

  const map = new Map();
  rows.forEach((r) => {
    const day = dayjs(r.taught_at).tz(IST).format('YYYY-MM-DD');
    const m = map.get(day) || { date: day, topicCount: 0, chapterCount: 0, topics: new Set(), chapters: new Set() };
    if (r.syllabus_topic_id) m.topics.add(r.syllabus_topic_id);
    if (r.syllabus_chapter_id) m.chapters.add(r.syllabus_chapter_id);
    map.set(day, m);
  });

  const days = [];
  let cur = dayjs(start);
  const last = dayjs(end);
  while (cur.isBefore(last) || cur.isSame(last, 'day')) {
    const k = cur.format('YYYY-MM-DD');
    const hit = map.get(k);
    days.push({
      date: k,
      topicCount: hit ? hit.topics.size : 0,
      chapterCount: hit ? hit.chapters.size : 0,
      noData: !hit || (hit.topics.size === 0 && hit.chapters.size === 0),
    });
    cur = cur.add(1, 'day');
  }
  return days;
}

// ────────────────────────────────────────────────────────────────────────────
// 3. Per-class summary — completion % per class (school scope).
// ────────────────────────────────────────────────────────────────────────────
export async function getPerClassSummary({ schoolCode, ayId, subjectId }) {
  if (!schoolCode || !ayId) return [];
  const { syllabi, chapters, topics, progress, classesById } = await fetchScope({
    schoolCode, ayId, classInstanceId: null, subjectId,
  });
  if (syllabi.length === 0) return [];

  const taughtTopics = new Set();
  progress.forEach((p) => { if (p.syllabus_topic_id) taughtTopics.add(p.syllabus_topic_id); });

  const topicsByChapter = new Map();
  topics.forEach((t) => {
    const arr = topicsByChapter.get(t.chapter_id) || [];
    arr.push(t);
    topicsByChapter.set(t.chapter_id, arr);
  });
  const chaptersBySyllabus = new Map();
  chapters.forEach((c) => {
    const arr = chaptersBySyllabus.get(c.syllabus_id) || [];
    arr.push(c);
    chaptersBySyllabus.set(c.syllabus_id, arr);
  });

  const byClass = new Map();
  syllabi.forEach((s) => {
    const cls = byClass.get(s.class_instance_id) || {
      classInstanceId: s.class_instance_id,
      totalTopics: 0, completedTopics: 0,
      totalChapters: 0, completedChapters: 0,
      subjectCount: 0,
    };
    cls.subjectCount += 1;
    const ch = chaptersBySyllabus.get(s.id) || [];
    cls.totalChapters += ch.length;
    ch.forEach((c) => {
      const tps = topicsByChapter.get(c.id) || [];
      cls.totalTopics += tps.length;
      const doneInCh = tps.filter((t) => taughtTopics.has(t.id)).length;
      cls.completedTopics += doneInCh;
      if (tps.length > 0 && doneInCh === tps.length) cls.completedChapters += 1;
    });
    byClass.set(s.class_instance_id, cls);
  });

  return Array.from(byClass.values()).map((c) => {
    const meta = classesById.get(c.classInstanceId);
    return {
      ...c,
      label: meta ? `Grade ${meta.grade}${meta.section ? ` ${meta.section}` : ''}` : 'Unknown',
      pct: c.totalTopics > 0 ? Math.round((c.completedTopics / c.totalTopics) * 1000) / 10 : 0,
    };
  }).sort((a, b) => b.pct - a.pct);
}

// ────────────────────────────────────────────────────────────────────────────
// 4. Per-subject summary — completion % per subject in scope.
// ────────────────────────────────────────────────────────────────────────────
export async function getPerSubjectSummary({ schoolCode, ayId, classInstanceId }) {
  if (!schoolCode || !ayId) return [];
  const { syllabi, chapters, topics, progress, subjectsById } = await fetchScope({
    schoolCode, ayId, classInstanceId, subjectId: null,
  });
  if (syllabi.length === 0) return [];

  const taughtTopics = new Set();
  progress.forEach((p) => { if (p.syllabus_topic_id) taughtTopics.add(p.syllabus_topic_id); });

  const topicsByChapter = new Map();
  topics.forEach((t) => {
    const arr = topicsByChapter.get(t.chapter_id) || [];
    arr.push(t);
    topicsByChapter.set(t.chapter_id, arr);
  });
  const chaptersBySyllabus = new Map();
  chapters.forEach((c) => {
    const arr = chaptersBySyllabus.get(c.syllabus_id) || [];
    arr.push(c);
    chaptersBySyllabus.set(c.syllabus_id, arr);
  });

  const bySubject = new Map();
  syllabi.forEach((s) => {
    const sub = bySubject.get(s.subject_id) || {
      subjectId: s.subject_id,
      totalTopics: 0, completedTopics: 0,
      totalChapters: 0, completedChapters: 0,
      classCount: 0,
    };
    sub.classCount += 1;
    const ch = chaptersBySyllabus.get(s.id) || [];
    sub.totalChapters += ch.length;
    ch.forEach((c) => {
      const tps = topicsByChapter.get(c.id) || [];
      sub.totalTopics += tps.length;
      const doneInCh = tps.filter((t) => taughtTopics.has(t.id)).length;
      sub.completedTopics += doneInCh;
      if (tps.length > 0 && doneInCh === tps.length) sub.completedChapters += 1;
    });
    bySubject.set(s.subject_id, sub);
  });

  return Array.from(bySubject.values())
    .filter((s) => s.subjectId)
    .map((s) => ({
      ...s,
      subjectName: subjectsById.get(s.subjectId)?.subject_name || 'Unknown',
      pct: s.totalTopics > 0 ? Math.round((s.completedTopics / s.totalTopics) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.pct - a.pct);
}

// ────────────────────────────────────────────────────────────────────────────
// 5. Chapter-level breakdown — for a class-and-subject focus view.
// ────────────────────────────────────────────────────────────────────────────
export async function getChapterBreakdown({ schoolCode, ayId, classInstanceId, subjectId }) {
  if (!schoolCode || !ayId || !classInstanceId || classInstanceId === 'all') return [];

  const { chapters, topics, progress } = await fetchScope({
    schoolCode, ayId, classInstanceId, subjectId,
  });
  if (chapters.length === 0) return [];

  const taughtTopics = new Set();
  const taughtChapters = new Set();
  progress.forEach((p) => {
    if (p.syllabus_topic_id) taughtTopics.add(p.syllabus_topic_id);
    if (p.syllabus_chapter_id) taughtChapters.add(p.syllabus_chapter_id);
  });

  const topicsByChapter = new Map();
  topics.forEach((t) => {
    const arr = topicsByChapter.get(t.chapter_id) || [];
    arr.push(t);
    topicsByChapter.set(t.chapter_id, arr);
  });

  return chapters
    .map((c) => {
      const tps = topicsByChapter.get(c.id) || [];
      const done = tps.filter((t) => taughtTopics.has(t.id)).length;
      const pct = tps.length > 0
        ? Math.round((done / tps.length) * 1000) / 10
        : (taughtChapters.has(c.id) ? 100 : 0);
      return {
        chapterId: c.id,
        chapterNo: c.chapter_no,
        title: c.title,
        syllabusId: c.syllabus_id,
        totalTopics: tps.length,
        completedTopics: done,
        chapterTaught: taughtChapters.has(c.id),
        pct,
      };
    })
    .sort((a, b) => (a.chapterNo ?? 0) - (b.chapterNo ?? 0));
}

// ────────────────────────────────────────────────────────────────────────────
// 6. At-risk subjects — under 30% completion or no activity in 30 days.
// ────────────────────────────────────────────────────────────────────────────
export async function getAtRiskSubjects({ schoolCode, ayId, classInstanceId }) {
  if (!schoolCode || !ayId) return [];
  const { syllabi, chapters, topics, progress, subjectsById, classesById } = await fetchScope({
    schoolCode, ayId, classInstanceId, subjectId: null,
  });
  if (syllabi.length === 0) return [];

  const taughtTopics = new Set();
  const lastByCsKey = new Map(); // classInstanceId|subjectId -> max taught_at
  progress.forEach((p) => {
    if (p.syllabus_topic_id) taughtTopics.add(p.syllabus_topic_id);
    const k = `${p.class_instance_id}|${p.subject_id}`;
    const prev = lastByCsKey.get(k);
    if (!prev || (p.taught_at && p.taught_at > prev)) lastByCsKey.set(k, p.taught_at);
  });

  const topicsByChapter = new Map();
  topics.forEach((t) => {
    const arr = topicsByChapter.get(t.chapter_id) || [];
    arr.push(t);
    topicsByChapter.set(t.chapter_id, arr);
  });
  const chaptersBySyllabus = new Map();
  chapters.forEach((c) => {
    const arr = chaptersBySyllabus.get(c.syllabus_id) || [];
    arr.push(c);
    chaptersBySyllabus.set(c.syllabus_id, arr);
  });

  const today = dayjs().tz(IST);
  const out = [];
  syllabi.forEach((s) => {
    const ch = chaptersBySyllabus.get(s.id) || [];
    let total = 0, done = 0;
    ch.forEach((c) => {
      const tps = topicsByChapter.get(c.id) || [];
      total += tps.length;
      done += tps.filter((t) => taughtTopics.has(t.id)).length;
    });
    if (total === 0) return;
    const pct = (done / total) * 100;
    const last = lastByCsKey.get(`${s.class_instance_id}|${s.subject_id}`);
    const daysSince = last ? today.diff(dayjs(last), 'day') : null;
    const isLowPct = pct < 30;
    const isStale = daysSince != null && daysSince > 30;
    if (!isLowPct && !isStale) return;
    const meta = classesById.get(s.class_instance_id);
    out.push({
      syllabusId: s.id,
      classInstanceId: s.class_instance_id,
      classLabel: meta ? `Grade ${meta.grade}${meta.section ? ` ${meta.section}` : ''}` : '—',
      subjectId: s.subject_id,
      subjectName: subjectsById.get(s.subject_id)?.subject_name || 'Unknown',
      totalTopics: total,
      completedTopics: done,
      pct: Math.round(pct * 10) / 10,
      lastTaughtAt: last || null,
      daysSinceLast: daysSince,
      reason: isLowPct && isStale ? 'low + stale'
            : isLowPct ? 'low completion' : 'no recent activity',
    });
  });
  return out.sort((a, b) => a.pct - b.pct);
}

export default {
  getHeadlineKpis,
  getDailyProgress,
  getPerClassSummary,
  getPerSubjectSummary,
  getChapterBreakdown,
  getAtRiskSubjects,
};
