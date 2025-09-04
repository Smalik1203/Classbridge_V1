import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert, Button, Card, Dropdown, Empty, Layout, List, message, Progress, Select, Skeleton, Space, Typography
} from 'antd';
import { MoreOutlined } from '@ant-design/icons';
import { supabase } from '../config/supabaseClient';

const { Sider, Content } = Layout;
const { Title, Text } = Typography;

const STATUS_LABEL = { pending: 'Pending', in_progress: 'In Progress', completed: 'Completed' };
const STATUS_COLOR = { pending: '#9CA3AF', in_progress: '#F59E0B', completed: '#16A34A' };

export default function SyllabusTracking() {
  // auth / user
  const [me, setMe] = useState(null);
  const canEdit = me?.role === 'admin' || me?.role === 'superadmin';

  // filters
  const [classes, setClasses] = useState([]);       // [{id, grade, section}]
  const [subjectsAll, setSubjectsAll] = useState([]); // full school subjects for Subject filter dropdown
  const [classId, setClassId] = useState(null);
  const [subjectFilter, setSubjectFilter] = useState(null);

  // cards
  const [cards, setCards] = useState([]); // [{subject_id, subject_name, syllabus_id, total, completed, in_progress, pending, expanded, loadingChapters, chapters: [...] }]
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // ---------- bootstrap ----------
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const { data: auth } = await supabase.auth.getUser();
        if (!auth?.user) throw new Error('Not signed in');

        const { data: meRow, error: meErr } = await supabase
          .from('users')
          .select('id, role, school_code')
          .eq('id', auth.user.id)
          .single();
        if (meErr || !meRow) throw meErr ?? new Error('User profile not found');
        setMe(meRow);

        const [{ data: cis, error: ciErr }, { data: subs, error: subErr }] = await Promise.all([
          supabase.from('class_instances').select('id, grade, section').order('grade').order('section'),
          supabase.from('subjects').select('id, subject_name').order('subject_name'),
        ]);
        if (ciErr) throw ciErr;
        if (subErr) throw subErr;

        setClasses(cis ?? []);
        setSubjectsAll(subs ?? []);

        // Preselect first class for faster UX (optional)
        if ((cis ?? []).length && !classId) setClassId(cis[0].id);
      } catch (e) {
        setError(e?.message || 'Failed to initialize');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // ---------- load cards when class changes ----------
  useEffect(() => {
    if (!classId) return;
    loadCardsForClass(classId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId]);

  const classOptions = useMemo(
    () => (classes || []).map(c => ({ label: `Grade ${c.grade ?? ''}${c.section ? '-' + c.section : ''}`, value: c.id })),
    [classes]
  );
  const subjectOptions = useMemo(
    () => (subjectsAll || []).map(s => ({ label: s.subject_name, value: s.id })),
    [subjectsAll]
  );

  async function loadCardsForClass(ciId) {
    try {
      setError(null);
      setLoading(true);

      // Try RPC (best: server aggregation)
      let rpc = await supabase.rpc('get_class_subject_progress', { p_class_instance_id: ciId });

      if (rpc.error) {
        // Fallback: build cards client-side
        const [{ data: subs }, { data: sylls }, { data: items }] = await Promise.all([
          supabase.from('subjects').select('id, subject_name').order('subject_name'),
          supabase.from('syllabi').select('id, subject_id').eq('class_instance_id', ciId),
          // if no syllabi, this returns null - guard below
          supabase.from('syllabus_items').select('syllabus_id, status'),
        ]);

        const syllabusBySubject = new Map((sylls ?? []).map(sy => [sy.subject_id, sy.id]));
        const countsBySyllabus = new Map();
        (items ?? []).forEach(it => {
          const key = it.syllabus_id;
          if (!key) return;
          const acc = countsBySyllabus.get(key) || { total: 0, completed: 0, in_progress: 0, pending: 0 };
          acc.total += 1;
          acc[it.status] = (acc[it.status] || 0) + 1;
          countsBySyllabus.set(key, acc);
        });

        const built = (subs ?? []).map(s => {
          const sid = syllabusBySubject.get(s.id) || null;
          const cnt = sid ? (countsBySyllabus.get(sid) || { total: 0, completed: 0, in_progress: 0, pending: 0 }) : { total: 0, completed: 0, in_progress: 0, pending: 0 };
          return { subject_id: s.id, subject_name: s.subject_name, syllabus_id: sid, ...cnt, expanded: false, loadingChapters: false, chapters: null };
        });
        setCards(built);
      } else {
        const arr = rpc.data || [];
        const built = arr.map(r => ({
          subject_id: r.subject_id,
          subject_name: r.subject_name,
          syllabus_id: r.syllabus_id,
          total: r.total || 0,
          completed: r.completed || 0,
          in_progress: r.in_progress || 0,
          pending: r.pending || 0,
          expanded: false,
          loadingChapters: false,
          chapters: null,
        }));
        setCards(built);
      }
    } catch (e) {
      setError(e?.message || 'Failed to load progress');
    } finally {
      setLoading(false);
    }
  }

  const filteredCards = useMemo(() => {
    if (!subjectFilter) return cards;
    return cards.filter(c => c.subject_id === subjectFilter);
  }, [cards, subjectFilter]);

  async function toggleExpand(subjectId) {
    setCards(prev => prev.map(c => (c.subject_id === subjectId ? { ...c, expanded: !c.expanded } : c)));
    const card = cards.find(c => c.subject_id === subjectId);
    if (!card) return;
    if (card.expanded) return; // will collapse
    if (card.chapters || card.loadingChapters) return;

    // Load chapters for this card (if we have a syllabus)
    if (!card.syllabus_id) return;
    setCards(prev => prev.map(c => (c.subject_id === subjectId ? { ...c, loadingChapters: true } : c)));
    try {
      const { data, error } = await supabase
        .from('syllabus_items')
        .select('id, title, status, unit_no')
        .eq('syllabus_id', card.syllabus_id)
        .order('unit_no', { ascending: true })
        .order('title', { ascending: true });
      if (error) throw error;
      setCards(prev =>
        prev.map(c => (c.subject_id === subjectId ? { ...c, chapters: data ?? [], loadingChapters: false } : c))
      );
    } catch (e) {
      setCards(prev => prev.map(c => (c.subject_id === subjectId ? { ...c, loadingChapters: false } : c)));
      message.error(e?.message || 'Failed to load chapters');
    }
  }

  async function createSyllabusFor(subjectId) {
    if (!canEdit || !me?.school_code || !classId) return;
    try {
      const { data, error } = await supabase
        .from('syllabi')
        .insert({
          school_code: me.school_code,
          class_instance_id: classId,
          subject_id: subjectId,
          created_by: me.id,
        })
        .select('id')
        .single();
      if (error) throw error;
      setCards(prev => prev.map(c => (c.subject_id === subjectId ? { ...c, syllabus_id: data.id, total: 0, completed: 0, in_progress: 0, pending: 0 } : c)));
      message.success('Syllabus created');
      toggleExpand(subjectId);
    } catch (e) {
      if (e?.code === '23505') {
        message.info('Syllabus already exists. Loading…');
        const { data } = await supabase
          .from('syllabi')
          .select('id')
          .eq('class_instance_id', classId)
          .eq('subject_id', subjectId)
          .single();
        setCards(prev => prev.map(c => (c.subject_id === subjectId ? { ...c, syllabus_id: data?.id || c.syllabus_id } : c)));
        toggleExpand(subjectId);
      } else {
        message.error(e?.message || 'Failed to create syllabus');
      }
    }
  }

  async function changeChapterStatus(subjectId, chapterId, newStatus) {
    const cardIdx = cards.findIndex(c => c.subject_id === subjectId);
    if (cardIdx < 0) return;
    const card = cards[cardIdx];
    const chIdx = (card.chapters || []).findIndex(ch => ch.id === chapterId);
    if (chIdx < 0) return;

    const prevStatus = card.chapters[chIdx].status || 'pending';

    // optimistic update chapter row
    setCards(prev => {
      const cp = [...prev];
      const c = { ...cp[cardIdx] };
      const chs = [...(c.chapters || [])];
      chs[chIdx] = { ...chs[chIdx], status: newStatus };
      c.chapters = chs;
      // adjust counters
      const counters = ['pending', 'in_progress', 'completed'];
      const nc = { ...c };
      counters.forEach(k => { nc[k] = c[k] || 0; });
      nc[prevStatus] = Math.max(0, (nc[prevStatus] || 0) - 1);
      nc[newStatus] = (nc[newStatus] || 0) + 1;
      nc.total = (nc.pending || 0) + (nc.in_progress || 0) + (nc.completed || 0);
      cp[cardIdx] = nc;
      return cp;
    });

    try {
      const { error } = await supabase.from('syllabus_items').update({ status: newStatus }).eq('id', chapterId);
      if (error) throw error;
      message.success(`Marked ${STATUS_LABEL[newStatus]}`);
    } catch (e) {
      // revert on error
      setCards(prev => {
        const cp = [...prev];
        const c = { ...cp[cardIdx] };
        const chs = [...(c.chapters || [])];
        chs[chIdx] = { ...chs[chIdx], status: prevStatus };
        c.chapters = chs;
        // revert counters
        c[newStatus] = Math.max(0, (c[newStatus] || 0) - 1);
        c[prevStatus] = (c[prevStatus] || 0) + 1;
        cp[cardIdx] = c;
        return cp;
      });
      message.error(e?.message || 'Update failed');
    }
  }

  const cardGridStyle = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
    gap: 16,
  };

  return (
    <Layout style={{ minHeight: '100%', background: '#F7F8FA' }}>
      <Sider width={280} style={{ background: '#fff', borderRight: '1px solid #f0f0f0', padding: 16 }}>
        <div style={{ marginBottom: 8, fontWeight: 600 }}>Class</div>
        <Select
          showSearch
          placeholder="Select class"
          style={{ width: '100%' }}
          options={classOptions}
          value={classId || undefined}
          onChange={setClassId}
          filterOption={(input, opt) => (opt?.label || '').toLowerCase().includes(input.toLowerCase())}
        />
        <div style={{ marginTop: 16, marginBottom: 8, fontWeight: 600 }}>Subject</div>
        <Select
          allowClear
          showSearch
          placeholder="All subjects"
          style={{ width: '100%' }}
          options={subjectOptions}
          value={subjectFilter || undefined}
          onChange={setSubjectFilter}
          filterOption={(input, opt) => (opt?.label || '').toLowerCase().includes(input.toLowerCase())}
        />
        <div style={{ marginTop: 16, color: '#667085', fontSize: 12 }}>
          Filter by class to see progress. Pick a subject to narrow the list.
        </div>
      </Sider>

      <Content style={{ padding: 24 }}>
        <Title level={4} style={{ marginTop: 0 }}>Syllabus Tracking</Title>
        {error && <Alert type="error" message="Error" description={error} style={{ marginBottom: 16 }} showIcon />}

        {loading ? (
          <Skeleton active paragraph={{ rows: 8 }} />
        ) : !classId ? (
          <Empty description="Select a class to view progress" />
        ) : filteredCards.length === 0 ? (
          <Empty description="No subjects found" />
        ) : (
          <div style={cardGridStyle}>
            {filteredCards.map(card => {
              const total = card.total || 0;
              const completed = card.completed || 0;
              const pct = total ? Math.round((completed / total) * 100) : 0;
              return (
                <Card
                  key={card.subject_id}
                  hoverable
                  style={{ borderRadius: 8 }}
                  bodyStyle={{ padding: 16 }}
                  onClick={() => toggleExpand(card.subject_id)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ fontWeight: 600, fontSize: 16 }}>{card.subject_name}</div>
                    {(!card.syllabus_id && canEdit) && (
                      <Button size="small" type="link" onClick={(e) => { e.stopPropagation(); createSyllabusFor(card.subject_id); }}>
                        Create Syllabus
                      </Button>
                    )}
                  </div>

                  <div style={{ marginTop: 8 }}>
                    <Progress percent={pct} showInfo={false} />
                    <div style={{ color: '#667085', marginTop: 6 }}>
                      {completed} of {total} Chapters Completed
                    </div>
                  </div>

                  {/* Accordion body */}
                  {card.expanded && (
                    <div style={{ marginTop: 12 }}>
                      {card.loadingChapters ? (
                        <Skeleton active paragraph={{ rows: 4 }} />
                      ) : !card.syllabus_id ? (
                        <div style={{ color: '#9CA3AF' }}>Syllabus not created.</div>
                      ) : (card.chapters?.length ? (
                        <List
                          dataSource={card.chapters}
                          renderItem={(ch) => {
                            const menuItems = [
                              { key: 'pending', label: 'Mark Pending' },
                              { key: 'in_progress', label: 'Mark In Progress' },
                              { key: 'completed', label: 'Mark Completed' },
                            ];
                            return (
                              <List.Item
                                style={{ paddingLeft: 0, cursor: 'default' }}
                                actions={[
                                  canEdit ? (
                                    <Dropdown
                                      key="kebab"
                                      menu={{ items: menuItems, onClick: ({ key }) => changeChapterStatus(card.subject_id, ch.id, key) }}
                                      trigger={['click']}
                                    >
                                      <MoreOutlined
                                        style={{ fontSize: 18, color: '#667085' }}
                                        onClick={(e) => e.stopPropagation()}
                                      />
                                    </Dropdown>
                                  ) : null,
                                ].filter(Boolean)}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%' }}>
                                  <span
                                    style={{
                                      width: 6, height: 24, borderRadius: 3,
                                      background: STATUS_COLOR[ch.status || 'pending'], flex: '0 0 auto'
                                    }}
                                  />
                                  <span style={{ flex: 1 }}>{ch.title}</span>
                                  <span
                                    style={{
                                      padding: '2px 10px',
                                      borderRadius: 12,
                                      background: STATUS_COLOR[ch.status || 'pending'],
                                      color: (ch.status || 'pending') === 'pending' ? '#000' : '#fff',
                                      fontSize: 12,
                                      fontWeight: 500,
                                    }}
                                  >
                                    {STATUS_LABEL[ch.status || 'pending']}
                                  </span>
                                </div>
                              </List.Item>
                            );
                          }}
                        />
                      ) : (
                        <div style={{ color: '#9CA3AF' }}>No chapters yet.</div>
                      ))}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </Content>
    </Layout>
  );
}


