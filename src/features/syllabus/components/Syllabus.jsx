import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BookOpen, CheckCircle, ChevronDown, Clock, Copy, Download,
  Edit, FileSpreadsheet, FileText, MoreHorizontal, Plus, RefreshCw,
  Trophy, Trash2, Upload, Eye, AlertCircle,
} from 'lucide-react';
import * as XLSX from 'xlsx';

import { supabase } from '@/config/supabaseClient';
import { useAuth } from '@/AuthProvider';
import { getSchoolCode, getUserRole } from '@/shared/utils/metadata';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

import { PageHeader } from '@/shared/ui/PageHeader';
import { Card } from '@/shared/ui/Card';
import { EmptyState } from '@/shared/ui/EmptyState';
import { FormDialog } from '@/shared/ui/FormDialog';
import { Field } from '@/shared/ui/Field';

function byText(field) {
  return (a, b) => String(a[field]).localeCompare(String(b[field]));
}

function MiniProgress({ percent }) {
  const color =
    percent === 100 ? 'var(--success)' :
    percent >= 50   ? 'var(--brand)'   :
    'var(--warning)';
  return (
    <div className="h-1.5 w-16 rounded-full overflow-hidden bg-[color:var(--bg-muted)]">
      <div className="h-full rounded-full transition-all" style={{ width: `${percent}%`, background: color }} />
    </div>
  );
}

function ChapterRow({
  chapter, expanded, onToggle,
  taughtTopics, canEdit,
  onAddTopic, onEditChapter, onDeleteChapter, onDeleteTopic,
}) {
  const topics = chapter.syllabus_topics || [];
  const taughtCount = topics.filter(t => taughtTopics.has(t.id)).length;
  const progress = topics.length > 0 ? Math.round((taughtCount / topics.length) * 100) : 0;

  return (
    <div>
      <div
        className="flex items-center gap-3 px-5 py-3.5 cursor-pointer select-none hover:bg-[color:var(--bg-subtle)] transition-colors group"
        onClick={() => onToggle(chapter.id)}
      >
        <ChevronDown
          size={14}
          className="text-[color:var(--fg-subtle)] transition-transform shrink-0"
          style={{ transform: expanded ? 'rotate(0deg)' : 'rotate(-90deg)' }}
        />

        <span
          className="text-[11.5px] font-semibold px-2 py-0.5 rounded-md shrink-0"
          style={{ background: 'var(--brand-soft)', color: 'var(--brand)' }}
        >
          Ch {chapter.chapter_no}
        </span>

        <span className="text-[14px] font-semibold text-[color:var(--fg)] flex-1 truncate">
          {chapter.title}
        </span>

        {chapter.ref_code && (
          <span className="text-[11px] font-mono text-[color:var(--fg-muted)] shrink-0">
            {chapter.ref_code}
          </span>
        )}

        {topics.length > 0 && (
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[11.5px] text-[color:var(--fg-muted)] tabular-nums">
              {taughtCount}/{topics.length}
            </span>
            <MiniProgress percent={progress} />
            <span className="text-[11.5px] text-[color:var(--fg-muted)] tabular-nums w-[36px]">
              {progress}%
            </span>
          </div>
        )}

        {canEdit && (
          <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
            <Button
              variant="ghost"
              size="sm"
              className="opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={() => onAddTopic(chapter.id)}
            >
              <Plus size={13} />
              Add Topic
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <MoreHorizontal size={14} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onEditChapter(chapter)}>
                  <Edit size={13} /> Edit chapter
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onClick={() => onDeleteChapter(chapter)}>
                  <Trash2 size={13} /> Delete chapter
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>

      {expanded && (
        <div className="px-5 pb-4 border-t border-[color:var(--border)]">
          {chapter.description && (
            <div className="mt-3 mb-3 px-3 py-2 rounded-[6px] bg-[color:var(--bg-subtle)] text-[13px] text-[color:var(--fg-muted)]">
              {chapter.description}
            </div>
          )}

          {topics.length === 0 ? (
            <div className="py-6 text-center">
              <p className="text-[13px] text-[color:var(--fg-muted)]">No topics yet</p>
              {canEdit && (
                <Button variant="outline" size="sm" className="mt-2" onClick={() => onAddTopic(chapter.id)}>
                  <Plus size={13} /> Add first topic
                </Button>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-2 mt-3">
              {topics.map(topic => (
                <TopicRow
                  key={topic.id}
                  topic={topic}
                  taught={taughtTopics.has(topic.id)}
                  canEdit={canEdit}
                  onEdit={() => onAddTopic(chapter.id, topic)}
                  onDelete={() => onDeleteTopic(topic)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TopicRow({ topic, taught, canEdit, onEdit, onDelete }) {
  return (
    <div
      className="flex items-start gap-3 px-3.5 py-2.5 rounded-[8px] border transition-colors"
      style={{
        background: taught ? 'var(--success-soft)' : 'var(--bg-elev)',
        borderColor: taught ? 'oklch(0.62 0.13 150 / 0.35)' : 'var(--border)',
      }}
    >
      <span
        className="text-[11px] font-semibold px-1.5 py-0.5 rounded mt-0.5 shrink-0"
        style={{
          background: taught ? 'var(--success)' : 'var(--bg-muted)',
          color: taught ? 'white' : 'var(--fg-muted)',
        }}
      >
        {topic.topic_no}
      </span>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className="text-[13.5px] font-medium"
            style={{ color: taught ? 'oklch(0.40 0.12 150)' : 'var(--fg)' }}
          >
            {topic.title}
          </span>
          {taught && <CheckCircle size={13} style={{ color: 'var(--success)', flexShrink: 0 }} />}
          {topic.ref_code && (
            <span className="text-[11px] font-mono text-[color:var(--fg-muted)]">
              {topic.ref_code}
            </span>
          )}
        </div>
        {topic.description && (
          <p className="text-[12px] text-[color:var(--fg-muted)] mt-0.5">{topic.description}</p>
        )}
      </div>

      {canEdit && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm">
              <MoreHorizontal size={13} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onEdit}>
              <Edit size={13} /> Edit topic
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={onDelete}>
              <Trash2 size={13} /> Delete topic
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}

export default function SyllabusPage() {
  const { user } = useAuth();
  const school_code = getSchoolCode(user);
  const role = getUserRole(user);
  const canEdit = role === 'admin' || role === 'superadmin';

  const fileInputRef = useRef(null);

  const [subjects, setSubjects] = useState([]);
  const [classInstances, setClassInstances] = useState([]);
  const [subjectId, setSubjectId] = useState(
    () => new URLSearchParams(window.location.search).get('subjectId') || ''
  );
  const [classInstanceId, setClassInstanceId] = useState(
    () => new URLSearchParams(window.location.search).get('classInstanceId') || ''
  );

  const [syllabus, setSyllabus] = useState(null);
  const [chapters, setChapters] = useState([]);
  const [expandedChapters, setExpandedChapters] = useState(new Set());
  const [taughtTopics, setTaughtTopics] = useState(new Set());
  const [taughtChapterIds, setTaughtChapterIds] = useState(new Set());

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [lastLoaded, setLastLoaded] = useState(null);

  const [chapterDialog, setChapterDialog] = useState({ open: false, editing: null });
  const [chapterForm, setChapterForm] = useState({ title: '', description: '', ref_code: '' });
  const [chapterErrors, setChapterErrors] = useState({});

  const [topicDialog, setTopicDialog] = useState({ open: false, editing: null, chapterId: null });
  const [topicForm, setTopicForm] = useState({ title: '', description: '', ref_code: '' });
  const [topicErrors, setTopicErrors] = useState({});

  const [copyDialog, setCopyDialog] = useState(false);
  const [copyForm, setCopyForm] = useState({ sourceSubjectId: '', sourceClassInstanceId: '' });
  const [copyErrors, setCopyErrors] = useState({});

  const [importDialog, setImportDialog] = useState({ open: false, data: [] });
  const [createDialog, setCreateDialog] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState({ open: false, title: '', body: '', onConfirm: null });

  useEffect(() => {
    if (!school_code) { setLoading(false); return; }
    (async () => {
      try {
        const [{ data: subs }, { data: cis }] = await Promise.all([
          supabase.from('subjects').select('id, subject_name').eq('school_code', school_code).order('subject_name'),
          supabase.from('class_instances')
            .select('id, grade, section, academic_years(year_start, year_end)')
            .eq('school_code', school_code).order('grade').order('section'),
        ]);
        setSubjects(subs || []);
        setClassInstances(cis || []);
      } catch {
        setError('Failed to load subjects and classes.');
      } finally {
        setLoading(false);
      }
    })();
  }, [school_code]);

  useEffect(() => {
    setSyllabus(null);
    setChapters([]);
    setExpandedChapters(new Set());
    setTaughtTopics(new Set());
    setTaughtChapterIds(new Set());
    setError(null);
  }, [subjectId, classInstanceId]);

  const subjectOptions = useMemo(
    () => subjects.map(s => ({ label: s.subject_name, value: s.id })).sort(byText('label')),
    [subjects]
  );

  const classOptions = useMemo(
    () => classInstances.map(c => {
      const yr = c.academic_years ? `${c.academic_years.year_start}-${c.academic_years.year_end}` : '';
      return {
        label: `Grade ${c.grade ?? ''}${c.section ? `-${c.section}` : ''}${yr ? ` (${yr})` : ''}`,
        value: c.id,
      };
    }).sort(byText('label')),
    [classInstances]
  );

  const subjectName = useMemo(
    () => subjects.find(s => s.id === subjectId)?.subject_name || '',
    [subjects, subjectId]
  );

  const selectedClassName = useMemo(
    () => classOptions.find(o => o.value === classInstanceId)?.label || '',
    [classOptions, classInstanceId]
  );

  const loadChapters = async (syllabusId) => {
    const { data, error: e } = await supabase
      .from('syllabus_chapters')
      .select('id, chapter_no, title, description, ref_code, syllabus_topics(id, topic_no, title, description, ref_code)')
      .eq('syllabus_id', syllabusId)
      .order('chapter_no');
    if (e) throw e;
    return (data || []).map(ch => ({
      ...ch,
      syllabus_topics: (ch.syllabus_topics || []).sort((a, b) => a.topic_no - b.topic_no),
    }));
  };

  const loadProgress = async (loadedChapters) => {
    if (!loadedChapters.length) return;
    const chapterIds = new Set(loadedChapters.map(c => c.id));
    const topicIds = new Set(loadedChapters.flatMap(c => (c.syllabus_topics || []).map(t => t.id)));
    const { data } = await supabase
      .from('syllabus_progress')
      .select('syllabus_chapter_id, syllabus_topic_id')
      .eq('school_code', school_code)
      .eq('class_instance_id', classInstanceId)
      .eq('subject_id', subjectId);
    const tch = new Set();
    const ttp = new Set();
    (data || []).forEach(r => {
      if (r.syllabus_chapter_id && chapterIds.has(r.syllabus_chapter_id)) tch.add(r.syllabus_chapter_id);
      if (r.syllabus_topic_id && topicIds.has(r.syllabus_topic_id)) ttp.add(r.syllabus_topic_id);
    });
    setTaughtChapterIds(tch);
    setTaughtTopics(ttp);
  };

  const handleLoadClick = async () => {
    if (!subjectId || !classInstanceId) return;
    setBusy(true);
    setError(null);
    try {
      const { data: syl, error: e } = await supabase
        .from('syllabi')
        .select('id, subject_id, class_instance_id')
        .eq('school_code', school_code)
        .eq('subject_id', subjectId)
        .eq('class_instance_id', classInstanceId)
        .maybeSingle();
      if (e) throw e;
      if (!syl) {
        setCreateDialog(true);
        return;
      }
      setSyllabus(syl);
      const chaps = await loadChapters(syl.id);
      setChapters(chaps);
      await loadProgress(chaps);
      setLastLoaded(new Date());
    } catch (e) {
      setError(e?.message || 'Failed to load syllabus.');
    } finally {
      setBusy(false);
    }
  };

  const handleCreateSyllabus = async () => {
    setBusy(true);
    setError(null);
    try {
      let syl;
      const { data: newSyl, error: ce } = await supabase
        .from('syllabi')
        .insert({ school_code, subject_id: subjectId, class_instance_id: classInstanceId, created_by: user.id })
        .select('id, subject_id, class_instance_id')
        .single();
      if (ce) {
        if (ce.code === '23505') {
          const { data: ex } = await supabase
            .from('syllabi').select('id, subject_id, class_instance_id')
            .eq('school_code', school_code).eq('subject_id', subjectId).eq('class_instance_id', classInstanceId)
            .single();
          syl = ex;
        } else throw ce;
      } else {
        syl = newSyl;
      }
      setSyllabus(syl);
      setChapters([]);
      setLastLoaded(new Date());
      setCreateDialog(false);
    } catch (e) {
      setError(e?.message || 'Failed to create syllabus.');
    } finally {
      setBusy(false);
    }
  };

  const reload = async () => {
    if (!syllabus) return;
    setBusy(true);
    try {
      const chaps = await loadChapters(syllabus.id);
      setChapters(chaps);
      await loadProgress(chaps);
      setLastLoaded(new Date());
    } catch (e) {
      setError(e?.message || 'Failed to reload.');
    } finally {
      setBusy(false);
    }
  };

  const openChapterDialog = (ch = null) => {
    setChapterDialog({ open: true, editing: ch });
    setChapterForm({ title: ch?.title || '', description: ch?.description || '', ref_code: ch?.ref_code || '' });
    setChapterErrors({});
  };

  const saveChapter = async () => {
    if (busy) return;
    const errs = {};
    if (!chapterForm.title.trim()) errs.title = 'Title is required';
    else if (chapterForm.title.length > 200) errs.title = 'Max 200 characters';
    else {
      const dup = chapters.find(c =>
        c.title.toLowerCase() === chapterForm.title.trim().toLowerCase() &&
        c.id !== chapterDialog.editing?.id
      );
      if (dup) errs.title = 'Chapter title already exists';
    }
    if (Object.keys(errs).length) { setChapterErrors(errs); return; }

    if (chapterDialog.editing) {
      const { error: e } = await supabase.from('syllabus_chapters').update({
        title: chapterForm.title.trim(),
        description: chapterForm.description.trim() || null,
        ref_code: chapterForm.ref_code.trim() || null,
      }).eq('id', chapterDialog.editing.id);
      if (e) throw e;
    } else {
      const nextNo = Math.max(0, ...chapters.map(c => c.chapter_no)) + 1;
      const { error: e } = await supabase.from('syllabus_chapters').insert({
        syllabus_id: syllabus.id,
        chapter_no: nextNo,
        title: chapterForm.title.trim(),
        description: chapterForm.description.trim() || null,
        ref_code: chapterForm.ref_code.trim() || null,
        created_by: user.id,
      });
      if (e) throw e;
    }
    setChapterDialog({ open: false, editing: null });
    await reload();
  };

  const confirmDeleteChapter = (ch) => {
    setDeleteConfirm({
      open: true,
      title: 'Delete chapter',
      body: `"${ch.title}" and all its topics will be permanently deleted. This cannot be undone.`,
      onConfirm: async () => {
        const { error: e } = await supabase.from('syllabus_chapters').delete().eq('id', ch.id);
        if (e) throw e;
        await reload();
      },
    });
  };

  const openTopicDialog = (chapterId, topic = null) => {
    setTopicDialog({ open: true, editing: topic, chapterId });
    setTopicForm({ title: topic?.title || '', description: topic?.description || '', ref_code: topic?.ref_code || '' });
    setTopicErrors({});
  };

  const saveTopic = async () => {
    if (busy) return;
    const errs = {};
    if (!topicForm.title.trim()) errs.title = 'Title is required';
    else if (topicForm.title.length > 200) errs.title = 'Max 200 characters';
    else {
      const ch = chapters.find(c => c.id === topicDialog.chapterId);
      const dup = ch?.syllabus_topics?.find(t =>
        t.title.toLowerCase() === topicForm.title.trim().toLowerCase() &&
        t.id !== topicDialog.editing?.id
      );
      if (dup) errs.title = 'Topic title already exists in this chapter';
    }
    if (Object.keys(errs).length) { setTopicErrors(errs); return; }

    if (topicDialog.editing) {
      const { error: e } = await supabase.from('syllabus_topics').update({
        title: topicForm.title.trim(),
        description: topicForm.description.trim() || null,
        ref_code: topicForm.ref_code.trim() || null,
      }).eq('id', topicDialog.editing.id);
      if (e) throw e;
    } else {
      const ch = chapters.find(c => c.id === topicDialog.chapterId);
      const nextNo = Math.max(0, ...(ch?.syllabus_topics || []).map(t => t.topic_no)) + 1;
      const { error: e } = await supabase.from('syllabus_topics').insert({
        chapter_id: topicDialog.chapterId,
        topic_no: nextNo,
        title: topicForm.title.trim(),
        description: topicForm.description.trim() || null,
        ref_code: topicForm.ref_code.trim() || null,
        created_by: user.id,
      });
      if (e) throw e;
    }
    setTopicDialog({ open: false, editing: null, chapterId: null });
    await reload();
  };

  const confirmDeleteTopic = (topic) => {
    setDeleteConfirm({
      open: true,
      title: 'Delete topic',
      body: `"${topic.title}" will be permanently deleted. This cannot be undone.`,
      onConfirm: async () => {
        const { error: e } = await supabase.from('syllabus_topics').delete().eq('id', topic.id);
        if (e) throw e;
        await reload();
      },
    });
  };

  const toggleChapter = (id) => {
    setExpandedChapters(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const exportSyllabus = () => {
    if (!chapters.length) return;
    const rows = [];
    chapters.forEach(ch => {
      if (ch.syllabus_topics?.length) {
        ch.syllabus_topics.forEach(t => rows.push({
          'Chapter Number': ch.chapter_no, 'Chapter Title': ch.title,
          'Chapter Description': ch.description || '', 'Chapter Ref Code': ch.ref_code || '',
          'Topic Number': t.topic_no, 'Topic Title': t.title,
          'Topic Description': t.description || '', 'Topic Ref Code': t.ref_code || '',
        }));
      } else {
        rows.push({
          'Chapter Number': ch.chapter_no, 'Chapter Title': ch.title,
          'Chapter Description': ch.description || '', 'Chapter Ref Code': ch.ref_code || '',
          'Topic Number': '', 'Topic Title': '', 'Topic Description': '', 'Topic Ref Code': '',
        });
      }
    });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Syllabus');
    const name = `Syllabus_${subjectName.replace(/[^a-zA-Z0-9]/g, '_')}_${selectedClassName.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, name);
  };

  const downloadTemplate = () => {
    const rows = [
      { 'Chapter Number': 1, 'Chapter Title': 'Introduction to Algebra', 'Chapter Description': 'Basic concepts', 'Chapter Ref Code': 'CH01', 'Topic Number': 1, 'Topic Title': 'Variables and Expressions', 'Topic Description': '', 'Topic Ref Code': 'T1.1' },
      { 'Chapter Number': 1, 'Chapter Title': 'Introduction to Algebra', 'Chapter Description': 'Basic concepts', 'Chapter Ref Code': 'CH01', 'Topic Number': 2, 'Topic Title': 'Order of Operations', 'Topic Description': '', 'Topic Ref Code': 'T1.2' },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Syllabus Template');
    XLSX.writeFile(wb, 'Syllabus_Import_Template.xlsx');
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const wb = XLSX.read(new Uint8Array(ev.target.result), { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(ws);
        const chapMap = new Map();
        json.forEach((row, i) => {
          if (!row['Chapter Number'] || !row['Chapter Title']) throw new Error(`Row ${i + 2}: Chapter Number and Title required`);
          const key = `${row['Chapter Number']}-${row['Chapter Title']}`;
          if (!chapMap.has(key)) chapMap.set(key, { chapter_no: parseInt(row['Chapter Number']), title: row['Chapter Title'], description: row['Chapter Description'] || '', ref_code: row['Chapter Ref Code'] || '', topics: [] });
          if (row['Topic Number'] && row['Topic Title']) {
            chapMap.get(key).topics.push({ topic_no: parseInt(row['Topic Number']), title: row['Topic Title'], description: row['Topic Description'] || '', ref_code: row['Topic Ref Code'] || '' });
          }
        });
        setImportDialog({ open: true, data: Array.from(chapMap.values()).sort((a, b) => a.chapter_no - b.chapter_no) });
      } catch (err) {
        setError(err?.message || 'Failed to parse file. Please check the format.');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const importSyllabus = async () => {
    if (!syllabus || !importDialog.data.length) return;
    await supabase.from('syllabus_chapters').delete().eq('syllabus_id', syllabus.id);
    for (const ch of importDialog.data) {
      const { data: newCh, error: ce } = await supabase
        .from('syllabus_chapters')
        .insert({ syllabus_id: syllabus.id, chapter_no: ch.chapter_no, title: ch.title, description: ch.description || null, ref_code: ch.ref_code || null, created_by: user.id })
        .select('id').single();
      if (ce) throw ce;
      if (ch.topics?.length) {
        const { error: te } = await supabase.from('syllabus_topics').insert(
          ch.topics.map(t => ({ chapter_id: newCh.id, topic_no: t.topic_no, title: t.title, description: t.description || null, ref_code: t.ref_code || null, created_by: user.id }))
        );
        if (te) throw te;
      }
    }
    setImportDialog({ open: false, data: [] });
    await reload();
  };

  const copySyllabus = async () => {
    const errs = {};
    if (!copyForm.sourceSubjectId) errs.subject = 'Select a source subject';
    if (!copyForm.sourceClassInstanceId) errs.class = 'Select a source class';
    if (Object.keys(errs).length) { setCopyErrors(errs); return; }

    const { data: src, error: se } = await supabase
      .from('syllabi').select('id')
      .eq('school_code', school_code).eq('subject_id', copyForm.sourceSubjectId)
      .eq('class_instance_id', copyForm.sourceClassInstanceId).single();
    if (se || !src) throw new Error('Source syllabus not found');

    const { data: srcChaps } = await supabase
      .from('syllabus_chapters')
      .select('chapter_no, title, description, ref_code, syllabus_topics(topic_no, title, description, ref_code)')
      .eq('syllabus_id', src.id).order('chapter_no');

    await supabase.from('syllabus_chapters').delete().eq('syllabus_id', syllabus.id);

    for (const ch of srcChaps || []) {
      const { data: newCh, error: ce } = await supabase
        .from('syllabus_chapters')
        .insert({ syllabus_id: syllabus.id, chapter_no: ch.chapter_no, title: ch.title, description: ch.description, ref_code: ch.ref_code, created_by: user.id })
        .select('id').single();
      if (ce) throw ce;
      if (ch.syllabus_topics?.length) {
        const { error: te } = await supabase.from('syllabus_topics').insert(
          ch.syllabus_topics.map(t => ({ chapter_id: newCh.id, topic_no: t.topic_no, title: t.title, description: t.description, ref_code: t.ref_code, created_by: user.id }))
        );
        if (te) throw te;
      }
    }
    setCopyDialog(false);
    await reload();
  };

  const stats = useMemo(() => {
    const totalTopics = chapters.reduce((s, c) => s + (c.syllabus_topics?.length || 0), 0);
    const taught = taughtTopics.size;
    const topicPct = totalTopics > 0 ? Math.round((taught / totalTopics) * 100) : 0;
    const chapterPct = chapters.length > 0 ? Math.round((taughtChapterIds.size / chapters.length) * 100) : 0;
    return {
      totalTopics, taught, remaining: totalTopics - taught,
      totalChapters: chapters.length, taughtChapters: taughtChapterIds.size,
      topicPct, chapterPct,
    };
  }, [chapters, taughtTopics, taughtChapterIds]);

  const subtitle = syllabus
    ? `${subjectName} · ${selectedClassName}${lastLoaded ? ` · loaded ${lastLoaded.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}` : ''}`
    : 'Select a subject and class to manage curriculum';

  if (loading) {
    return (
      <div className="px-8 pt-7 pb-16 max-w-[1480px] mx-auto w-full">
        <div className="h-8 w-48 rounded bg-[color:var(--bg-muted)] animate-pulse mb-6" />
        <div className="h-[120px] rounded-[var(--radius-lg)] bg-[color:var(--bg-muted)] animate-pulse" />
      </div>
    );
  }

  return (
    <div className="px-8 pt-7 pb-16 max-w-[1480px] mx-auto w-full">
      <PageHeader
        title="Syllabus"
        subtitle={subtitle}
        actions={
          syllabus && (
            <>
              <Button variant="outline" size="sm" onClick={exportSyllabus} disabled={!chapters.length}>
                <Download size={14} /> Export
              </Button>
              <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                <Upload size={14} /> Import
              </Button>
              <Button variant="outline" size="sm" onClick={downloadTemplate}>
                <FileSpreadsheet size={14} /> Template
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={handleFileChange}
              />
            </>
          )
        }
      />

      {error && (
        <div className="flex items-center gap-3 mb-5 px-4 py-3 rounded-[8px] border text-[13px]"
          style={{ background: 'var(--danger-soft)', borderColor: 'oklch(0.58 0.20 25 / 0.3)', color: 'var(--danger)' }}>
          <AlertCircle size={14} className="shrink-0" />
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)} className="text-[color:var(--fg-muted)] hover:text-[color:var(--fg)] transition-colors">×</button>
        </div>
      )}

      <div className="flex flex-wrap items-end gap-3 mb-5">
        <div className="flex flex-col gap-1">
          <span className="text-[11.5px] font-medium text-[color:var(--fg-muted)]">Subject</span>
          <Select value={subjectId || ''} onValueChange={setSubjectId}>
            <SelectTrigger size="sm" className="w-[200px]">
              <SelectValue placeholder="Choose subject" />
            </SelectTrigger>
            <SelectContent>
              {subjectOptions.map(o => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-[11.5px] font-medium text-[color:var(--fg-muted)]">Class</span>
          <Select value={classInstanceId || ''} onValueChange={setClassInstanceId}>
            <SelectTrigger size="sm" className="w-[220px]">
              <SelectValue placeholder="Choose class" />
            </SelectTrigger>
            <SelectContent>
              {classOptions.map(o => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button
          size="sm"
          variant={syllabus ? 'outline' : 'default'}
          disabled={!subjectId || !classInstanceId || busy}
          onClick={handleLoadClick}
          className="self-end"
        >
          {busy ? (
            <RefreshCw size={13} className="animate-spin" />
          ) : syllabus ? (
            <><RefreshCw size={13} /> Reload</>
          ) : (
            'Load syllabus'
          )}
        </Button>

        {syllabus && (
          <div className="flex items-center gap-1.5 self-end px-3 py-1.5 rounded-md text-[12.5px] font-medium"
            style={{ background: 'var(--brand-soft)', color: 'var(--brand)' }}>
            <Eye size={12} />
            {subjectName} · {selectedClassName}
          </div>
        )}
      </div>

      {syllabus && chapters.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
          {[
            { label: 'Overall progress', value: `${stats.topicPct}%`, sub: `${stats.taught} of ${stats.totalTopics} topics`, icon: Trophy, color: '--brand' },
            { label: 'Topics completed', value: `${stats.taught}/${stats.totalTopics}`, sub: `${stats.topicPct}% of curriculum`, icon: CheckCircle, color: '--success' },
            { label: 'Chapters started', value: `${stats.taughtChapters}/${stats.totalChapters}`, sub: `${stats.chapterPct}% of chapters`, icon: BookOpen, color: '--brand' },
            { label: 'Topics remaining', value: `${stats.remaining}`, sub: 'still to be covered', icon: Clock, color: '--warning' },
          ].map(({ label, value, sub, icon: Icon, color }) => (
            <div key={label}
              className="rounded-[var(--radius-lg)] border border-[color:var(--border)] bg-[color:var(--bg-elev)] px-4 py-3.5">
              <div className="flex items-center gap-1.5 text-[11.5px] font-medium text-[color:var(--fg-muted)] mb-2">
                <Icon size={12} style={{ color: `var(${color})` }} />
                {label}
              </div>
              <div className="text-[24px] font-semibold tracking-[-0.02em] tabular-nums text-[color:var(--fg)]">{value}</div>
              <div className="text-[11.5px] text-[color:var(--fg-muted)] mt-0.5">{sub}</div>
            </div>
          ))}
        </div>
      )}

      {syllabus && (
        busy && !chapters.length ? (
          <Card>
            <div className="p-10 text-center text-[13px] text-[color:var(--fg-subtle)]">Loading…</div>
          </Card>
        ) : (
          <Card
            padded={false}
            title="Chapters & Topics"
            sub={chapters.length > 0
              ? `${chapters.length} chapter${chapters.length !== 1 ? 's' : ''} · ${stats.totalTopics} topics · ${stats.taught} taught`
              : undefined}
            actions={
              canEdit && (
                <div className="flex items-center gap-2">
                  {syllabus && (
                    <Button variant="outline" size="sm" onClick={() => { setCopyDialog(true); setCopyForm({ sourceSubjectId: '', sourceClassInstanceId: '' }); setCopyErrors({}); }}>
                      <Copy size={13} /> Copy from class
                    </Button>
                  )}
                  <Button size="sm" onClick={() => openChapterDialog()}>
                    <Plus size={13} /> Add chapter
                  </Button>
                </div>
              )
            }
          >
            {chapters.length === 0 ? (
              <div className="py-2">
                <EmptyState
                  type="syllabus"
                  action={canEdit && (
                    <Button size="sm" className="mt-3" onClick={() => openChapterDialog()}>
                      <Plus size={13} /> Add first chapter
                    </Button>
                  )}
                />
              </div>
            ) : (
              <div className="divide-y divide-[color:var(--border)]">
                {chapters.map(ch => (
                  <ChapterRow
                    key={ch.id}
                    chapter={ch}
                    expanded={expandedChapters.has(ch.id)}
                    onToggle={toggleChapter}
                    taughtTopics={taughtTopics}
                    canEdit={canEdit}
                    onAddTopic={openTopicDialog}
                    onEditChapter={openChapterDialog}
                    onDeleteChapter={confirmDeleteChapter}
                    onDeleteTopic={confirmDeleteTopic}
                  />
                ))}
              </div>
            )}
          </Card>
        )
      )}

      <FormDialog
        open={createDialog}
        onClose={() => setCreateDialog(false)}
        title="Create syllabus"
        onSubmit={handleCreateSyllabus}
        submitLabel="Create syllabus"
        submitting={busy}
        width={460}
      >
        <p className="text-[13.5px] text-[color:var(--fg-subtle)]">
          No syllabus exists for <strong className="text-[color:var(--fg)]">{subjectName}</strong> in{' '}
          <strong className="text-[color:var(--fg)]">{selectedClassName}</strong>. Create a new one to start adding chapters and topics.
        </p>
      </FormDialog>

      <FormDialog
        open={chapterDialog.open}
        onClose={() => setChapterDialog({ open: false, editing: null })}
        title={chapterDialog.editing ? 'Edit chapter' : 'Add chapter'}
        onSubmit={saveChapter}
        submitLabel={chapterDialog.editing ? 'Save changes' : 'Add chapter'}
        submitting={busy}
        width={520}
      >
        <Field label="Chapter title" required error={chapterErrors.title}>
          <Input
            placeholder="e.g. Introduction to Algebra"
            maxLength={200}
            value={chapterForm.title}
            onChange={e => setChapterForm(f => ({ ...f, title: e.target.value }))}
          />
        </Field>
        <Field label="Description" hint="Optional">
          <Textarea
            placeholder="Brief description of the chapter content"
            value={chapterForm.description}
            onChange={e => setChapterForm(f => ({ ...f, description: e.target.value }))}
            rows={3}
          />
        </Field>
        <Field label="Reference code" hint="Optional — e.g. CH01, TEXT-1.1">
          <Input
            placeholder="CH01"
            value={chapterForm.ref_code}
            onChange={e => setChapterForm(f => ({ ...f, ref_code: e.target.value }))}
          />
        </Field>
      </FormDialog>

      <FormDialog
        open={topicDialog.open}
        onClose={() => setTopicDialog({ open: false, editing: null, chapterId: null })}
        title={topicDialog.editing ? 'Edit topic' : 'Add topic'}
        onSubmit={saveTopic}
        submitLabel={topicDialog.editing ? 'Save changes' : 'Add topic'}
        submitting={busy}
        width={520}
      >
        <Field label="Topic title" required error={topicErrors.title}>
          <Input
            placeholder="e.g. Linear Equations"
            maxLength={200}
            value={topicForm.title}
            onChange={e => setTopicForm(f => ({ ...f, title: e.target.value }))}
          />
        </Field>
        <Field label="Description" hint="Optional">
          <Textarea
            placeholder="Brief description of the topic content"
            value={topicForm.description}
            onChange={e => setTopicForm(f => ({ ...f, description: e.target.value }))}
            rows={3}
          />
        </Field>
        <Field label="Reference code" hint="Optional — e.g. T01, EX-1.1">
          <Input
            placeholder="T01"
            value={topicForm.ref_code}
            onChange={e => setTopicForm(f => ({ ...f, ref_code: e.target.value }))}
          />
        </Field>
      </FormDialog>

      <FormDialog
        open={importDialog.open}
        onClose={() => setImportDialog({ open: false, data: [] })}
        title="Import syllabus"
        description={`${importDialog.data.length} chapter${importDialog.data.length !== 1 ? 's' : ''} · ${importDialog.data.reduce((s, c) => s + (c.topics?.length || 0), 0)} topics — this will replace all existing content`}
        onSubmit={importSyllabus}
        submitLabel="Import"
        width={640}
      >
        <div
          className="rounded-[8px] border border-[color:var(--border)] overflow-y-auto flex flex-col gap-px"
          style={{ maxHeight: 340, background: 'var(--bg-subtle)' }}
        >
          {importDialog.data.map((ch, i) => (
            <div key={i} className="bg-[color:var(--bg-elev)] px-4 py-3 border-b border-[color:var(--border)] last:border-0">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded" style={{ background: 'var(--brand-soft)', color: 'var(--brand)' }}>
                  Ch {ch.chapter_no}
                </span>
                <span className="text-[13px] font-semibold text-[color:var(--fg)]">{ch.title}</span>
                {ch.ref_code && <span className="text-[11px] font-mono text-[color:var(--fg-muted)]">{ch.ref_code}</span>}
              </div>
              {ch.topics?.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pl-2">
                  {ch.topics.map((t, j) => (
                    <span key={j} className="text-[11.5px] px-2 py-0.5 rounded-md" style={{ background: 'var(--success-soft)', color: 'oklch(0.42 0.10 150)' }}>
                      {t.topic_no}. {t.title}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </FormDialog>

      <FormDialog
        open={copyDialog}
        onClose={() => setCopyDialog(false)}
        title="Copy syllabus from class"
        description="Copies all chapters and topics from the selected class. Existing content will be replaced."
        onSubmit={copySyllabus}
        submitLabel="Copy syllabus"
        width={520}
      >
        <Field label="Source subject" required error={copyErrors.subject}>
          <Select value={copyForm.sourceSubjectId || ''} onValueChange={v => setCopyForm(f => ({ ...f, sourceSubjectId: v }))}>
            <SelectTrigger>
              <SelectValue placeholder="Choose source subject" />
            </SelectTrigger>
            <SelectContent>
              {subjectOptions.map(o => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Source class" required error={copyErrors.class}>
          <Select value={copyForm.sourceClassInstanceId || ''} onValueChange={v => setCopyForm(f => ({ ...f, sourceClassInstanceId: v }))}>
            <SelectTrigger>
              <SelectValue placeholder="Choose source class" />
            </SelectTrigger>
            <SelectContent>
              {classOptions.map(o => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <p className="text-[12.5px] text-[color:var(--fg-muted)] px-3 py-2.5 rounded-[6px] bg-[color:var(--warning-soft)]">
          This will permanently replace all current chapters and topics in this syllabus.
        </p>
      </FormDialog>

      <FormDialog
        open={deleteConfirm.open}
        onClose={() => setDeleteConfirm(d => ({ ...d, open: false }))}
        title={deleteConfirm.title}
        onSubmit={async () => {
          await deleteConfirm.onConfirm();
          setDeleteConfirm(d => ({ ...d, open: false }));
        }}
        submitLabel="Delete"
        destructive
        width={440}
      >
        <p className="text-[13.5px] text-[color:var(--fg-subtle)]">{deleteConfirm.body}</p>
      </FormDialog>
    </div>
  );
}
