import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal, Steps, Segmented, Upload, Input, Form, Select, InputNumber, Button, Space,
  Spin, Alert, Typography, Tag, List, Empty, Divider, Row, Col, Checkbox, message,
  DatePicker, Tooltip
} from 'antd';
import {
  FileTextOutlined, FilePdfOutlined, FileImageOutlined, RocketOutlined, ReloadOutlined,
  CheckCircleOutlined, EditOutlined, DeleteOutlined, SaveOutlined, InfoCircleOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useAuth } from '@/AuthProvider';
import { getSchoolCode } from '@/shared/utils/metadata';
import { useErrorHandler } from '@/shared/hooks/useErrorHandler';
import { supabase } from '@/config/supabaseClient';
import {
  generateQuestionsFromInput, pollAiJobStatus, fetchAiJobResult,
  cancelAiJob, getSyllabusTree,
} from '../services/aiTestGeneratorService';
import { createTest, getClassInstances, getSubjects } from '../services/testService';
import { createQuestion } from '../services/questionService';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

const BLOOM_LEVELS = [
  { value: 'remember', label: 'Remember' },
  { value: 'understand', label: 'Understand' },
  { value: 'apply', label: 'Apply' },
  { value: 'analyze', label: 'Analyze' },
  { value: 'evaluate', label: 'Evaluate' },
  { value: 'create', label: 'Create' },
];

/**
 * Self-contained AI Test Generator wizard.
 * Renders inline (no Modal wrapper) so it can be used as a step inside
 * UnifiedTestManagement. Calls onSaved(testId) once the test is persisted.
 */
export default function AITestGeneratorWizard({ onCancel, onSaved, defaultClassId, defaultSubjectId }) {
  const { user } = useAuth();
  const { showError, showSuccess } = useErrorHandler();
  const schoolCode = getSchoolCode(user);

  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);

  const [step, setStep] = useState(0);
  const [sourceMode, setSourceMode] = useState('text');
  const [imageFiles, setImageFiles] = useState([]);
  const [pdfFile, setPdfFile] = useState(null);
  const [textContent, setTextContent] = useState('');

  const [questionCount, setQuestionCount] = useState(10);
  const [additionalContext, setAdditionalContext] = useState('');
  const [bloomsLevels, setBloomsLevels] = useState([]);
  const [classId, setClassId] = useState(defaultClassId);
  const [subjectId, setSubjectId] = useState(defaultSubjectId);
  const [chapters, setChapters] = useState([]);
  const [scopeChapterIds, setScopeChapterIds] = useState([]);

  const [jobId, setJobId] = useState(null);
  const [jobStatus, setJobStatus] = useState(null);
  const [jobError, setJobError] = useState(null);
  const [progressMsg, setProgressMsg] = useState('');
  const pollRef = useRef(null);

  const [questions, setQuestions] = useState([]);
  const [editingIdx, setEditingIdx] = useState(null);

  const [saving, setSaving] = useState(false);
  const [testTitle, setTestTitle] = useState('');
  const [testDate, setTestDate] = useState(null);
  const [timeLimit, setTimeLimit] = useState(60);

  // Load classes/subjects on mount
  useEffect(() => {
    if (!schoolCode) return;
    Promise.all([getClassInstances(schoolCode), getSubjects(schoolCode)])
      .then(([c, s]) => { setClasses(c); setSubjects(s); })
      .catch(e => showError('Failed to load classes/subjects: ' + e.message));
    // eslint-disable-next-line
  }, [schoolCode]);

  // Load syllabus chapters when class+subject chosen
  useEffect(() => {
    if (!schoolCode || !classId || !subjectId) { setChapters([]); return; }
    getSyllabusTree(schoolCode, classId, subjectId)
      .then(rows => setChapters(rows || []))
      .catch(() => setChapters([]));
  }, [schoolCode, classId, subjectId]);

  // Poll job status
  useEffect(() => {
    if (step !== 2 || !jobId) return;
    let stopped = false;
    const tick = async () => {
      if (stopped) return;
      try {
        const row = await pollAiJobStatus(jobId);
        if (!row) { setJobError('Job not found.'); return; }
        setJobStatus(row.status);
        if (row.status === 'done') {
          const result = await fetchAiJobResult(jobId);
          setQuestions(result.questions.map(q => ({ ...q, _id: randomId() })));
          setStep(3);
          return;
        }
        if (row.status === 'failed') {
          setJobError(row.error || 'Generation failed');
          return;
        }
        pollRef.current = setTimeout(tick, 2500);
      } catch (e) {
        setJobError(e.message);
      }
    };
    tick();
    return () => { stopped = true; if (pollRef.current) clearTimeout(pollRef.current); };
    // eslint-disable-next-line
  }, [step, jobId]);

  function randomId() {
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
  }

  function buildSyllabusScope() {
    if (!scopeChapterIds.length || !chapters.length) return undefined;
    const picked = chapters.filter(c => scopeChapterIds.includes(c.chapter_id));
    if (!picked.length) return undefined;
    return {
      chapters: picked.map(c => ({
        chapterId: c.chapter_id,
        chapterTitle: c.chapter_title || c.title,
        topics: (c.topics || []).map(t => ({ topicId: t.topic_id, topicTitle: t.topic_title })),
      })),
    };
  }

  async function startGeneration() {
    setProgressMsg('');
    setJobError(null);
    setJobStatus(null);
    setJobId(null);
    let input;
    if (sourceMode === 'images') {
      if (!imageFiles.length) return showError('Please add at least one image.');
      input = { mode: 'images', files: imageFiles.map(f => f.originFileObj || f) };
    } else if (sourceMode === 'pdf') {
      if (!pdfFile) return showError('Please upload a PDF.');
      input = { mode: 'pdf', file: pdfFile.originFileObj || pdfFile };
    } else {
      if ((textContent || '').trim().length < 20) return showError('Paste at least 20 characters of text.');
      input = { mode: 'text', content: textContent };
    }
    try {
      setStep(2);
      const res = await generateQuestionsFromInput({
        input,
        questionCount,
        context: additionalContext,
        syllabusScope: buildSyllabusScope(),
        bloomsLevels: bloomsLevels.length ? bloomsLevels : undefined,
        schoolCode,
        onProgress: setProgressMsg,
      });
      setJobId(res.jobId);
    } catch (e) {
      setJobError(e.message);
    }
  }

  function updateQuestion(idx, patch) {
    setQuestions(prev => prev.map((q, i) => (i === idx ? { ...q, ...patch } : q)));
  }
  function removeQuestion(idx) {
    setQuestions(prev => prev.filter((_, i) => i !== idx));
  }

  async function regenerateSingle(idx) {
    try {
      const input =
        sourceMode === 'images' ? { mode: 'images', files: imageFiles.map(f => f.originFileObj || f) } :
        sourceMode === 'pdf' ? { mode: 'pdf', file: pdfFile.originFileObj || pdfFile } :
        { mode: 'text', content: textContent };
      message.loading({ content: 'Regenerating question…', key: 'regen', duration: 0 });
      const res = await generateQuestionsFromInput({
        input,
        questionCount: 1,
        context: `${additionalContext || ''}\n\nReplace this exact question with a fresh one (avoid duplicates):\n${questions[idx].question_text}`,
        syllabusScope: buildSyllabusScope(),
        bloomsLevels: bloomsLevels.length ? bloomsLevels : undefined,
        schoolCode,
      });
      let row;
      for (let i = 0; i < 60; i++) {
        // eslint-disable-next-line
        await new Promise(r => setTimeout(r, 2500));
        row = await pollAiJobStatus(res.jobId);
        if (row?.status === 'done' || row?.status === 'failed') break;
      }
      if (row?.status === 'done') {
        const result = await fetchAiJobResult(res.jobId);
        if (result.questions?.[0]) {
          updateQuestion(idx, { ...result.questions[0], _id: questions[idx]._id });
          message.success({ content: 'Regenerated.', key: 'regen' });
          return;
        }
      }
      message.error({ content: 'Regenerate failed', key: 'regen' });
    } catch (e) {
      message.error({ content: e.message, key: 'regen' });
    }
  }

  async function saveAsTest() {
    if (!testTitle.trim()) return showError('Test title required.');
    if (!classId) return showError('Pick a class.');
    if (!subjectId) return showError('Pick a subject.');
    if (!questions.length) return showError('No questions to save.');

    setSaving(true);
    try {
      // First try the atomic RPC; if it doesn't exist on this Supabase project,
      // fall back to insert-test then insert-questions one-by-one.
      const testPayload = {
        title: testTitle.trim(),
        description: additionalContext ? additionalContext.slice(0, 500) : null,
        class_instance_id: classId,
        subject_id: subjectId,
        school_code: schoolCode,
        test_type: 'Quiz',
        test_mode: 'online',
        test_date: testDate ? dayjs(testDate).format('YYYY-MM-DD') : null,
        time_limit_seconds: timeLimit ? timeLimit * 60 : null,
        status: 'active',
        created_by: user.id,
      };
      const questionsPayload = questions.map((q, i) => ({
        question_text: q.question_text,
        question_type: q.question_type || 'mcq',
        options: q.options || null,
        correct_index: q.correct_index ?? null,
        correct_text: q.correct_text ?? null,
        correct_answer: null,
        points: 1,
        order_index: i,
        bloom_level: q.bloom_level ?? null,
        cognitive_verbs: q.cognitive_verbs ?? null,
      }));

      let testId = null;
      try {
        const { data, error } = await supabase.rpc('create_test_with_questions', {
          test_payload: testPayload,
          questions_payload: questionsPayload,
        });
        if (error) throw error;
        const row = Array.isArray(data) ? data[0] : data;
        testId = row?.id;
      } catch {
        // Fallback path
      }

      if (!testId) {
        const created = await createTest(testPayload);
        testId = created.id;
        for (const q of questionsPayload) {
          await createQuestion({ ...q, test_id: testId });
        }
      }

      showSuccess('AI test saved.');
      onSaved?.(testId);
    } catch (e) {
      showError('Save failed: ' + e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <Steps
        current={step}
        style={{ marginBottom: 24 }}
        items={[
          { title: 'Source' },
          { title: 'Configure' },
          { title: 'Generating' },
          { title: 'Review & Save' },
        ]}
      />

      {step === 0 && (
        <div>
          <Title level={5}>Where should Sage learn from?</Title>
          <Segmented
            block
            value={sourceMode}
            onChange={setSourceMode}
            options={[
              { label: <span><FileTextOutlined /> Paste text</span>, value: 'text' },
              { label: <span><FilePdfOutlined /> PDF</span>, value: 'pdf' },
              { label: <span><FileImageOutlined /> Images</span>, value: 'images' },
            ]}
            style={{ marginBottom: 16 }}
          />
          {sourceMode === 'text' && (
            <TextArea
              rows={10}
              value={textContent}
              onChange={(e) => setTextContent(e.target.value)}
              placeholder="Paste textbook content, notes, or syllabus material (≥ 20 chars)…"
            />
          )}
          {sourceMode === 'pdf' && (
            <Upload.Dragger
              accept="application/pdf"
              maxCount={1}
              beforeUpload={() => false}
              fileList={pdfFile ? [pdfFile] : []}
              onChange={({ fileList }) => setPdfFile(fileList[0] || null)}
              onRemove={() => setPdfFile(null)}
            >
              <p className="ant-upload-drag-icon"><FilePdfOutlined style={{ fontSize: 32 }} /></p>
              <p>Drop PDF here, or click to choose.</p>
            </Upload.Dragger>
          )}
          {sourceMode === 'images' && (
            <Upload.Dragger
              accept="image/png,image/jpeg,image/jpg"
              multiple
              maxCount={5}
              beforeUpload={() => false}
              listType="picture"
              fileList={imageFiles}
              onChange={({ fileList }) => setImageFiles(fileList.slice(0, 5))}
            >
              <p className="ant-upload-drag-icon"><FileImageOutlined style={{ fontSize: 32 }} /></p>
              <p>Drop up to 5 images (≤ 3MB each).</p>
            </Upload.Dragger>
          )}
          <div style={{ marginTop: 24, textAlign: 'right' }}>
            <Space>
              {onCancel && <Button onClick={onCancel}>Cancel</Button>}
              <Button type="primary" size="large" onClick={() => setStep(1)}>Continue</Button>
            </Space>
          </div>
        </div>
      )}

      {step === 1 && (
        <div>
          <Title level={5}>Configure generation</Title>
          <Row gutter={16}>
            <Col xs={24} md={8}>
              <Form.Item label="Class" required>
                <Select value={classId} onChange={setClassId} placeholder="Select class">
                  {classes.map(c => <Select.Option key={c.id} value={c.id}>Grade {c.grade} {c.section}</Select.Option>)}
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item label="Subject" required>
                <Select value={subjectId} onChange={setSubjectId} placeholder="Select subject">
                  {subjects.map(s => <Select.Option key={s.id} value={s.id}>{s.subject_name}</Select.Option>)}
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item label="Question count">
                <InputNumber min={1} max={50} value={questionCount} onChange={(v) => setQuestionCount(v ?? 10)} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item label="Bloom's Taxonomy levels (optional)">
            <Checkbox.Group value={bloomsLevels} onChange={setBloomsLevels} options={BLOOM_LEVELS} />
          </Form.Item>
          {chapters.length > 0 && (
            <Form.Item label="Limit to syllabus chapters (optional)">
              <Select
                mode="multiple"
                value={scopeChapterIds}
                onChange={setScopeChapterIds}
                placeholder="Pick chapters to focus on"
                allowClear
              >
                {chapters.map(c => (
                  <Select.Option key={c.chapter_id} value={c.chapter_id}>
                    Ch. {c.chapter_no || ''} — {c.chapter_title || c.title}
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>
          )}
          <Form.Item label="Additional context (optional)">
            <TextArea
              rows={2}
              value={additionalContext}
              onChange={(e) => setAdditionalContext(e.target.value)}
              placeholder="e.g., focus on word problems"
            />
          </Form.Item>
          <Space>
            <Button onClick={() => setStep(0)}>Back</Button>
            <Button type="primary" icon={<RocketOutlined />} onClick={startGeneration}>Generate</Button>
          </Space>
        </div>
      )}

      {step === 2 && (
        <div style={{ textAlign: 'center', padding: '40px 16px' }}>
          {!jobError ? (
            <>
              <Spin size="large" />
              <Title level={4} style={{ marginTop: 16 }}>Sage is generating questions…</Title>
              <Paragraph type="secondary">
                {progressMsg || (jobStatus === 'processing' ? 'Working on it…' : 'Queued — waiting for a worker.')}
              </Paragraph>
              <Space>
                <Button danger onClick={async () => {
                  if (jobId) await cancelAiJob(jobId);
                  setStep(1);
                }}>Cancel</Button>
              </Space>
            </>
          ) : (
            <>
              <Alert type="error" showIcon message="Generation failed" description={jobError} style={{ textAlign: 'left', marginBottom: 16 }} />
              <Space>
                <Button onClick={() => setStep(1)}>Back</Button>
                <Button type="primary" icon={<ReloadOutlined />} onClick={startGeneration}>Retry</Button>
              </Space>
            </>
          )}
        </div>
      )}

      {step === 3 && (
        <div>
          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col xs={24} md={12}>
              <Form.Item label="Test title" required>
                <Input value={testTitle} onChange={(e) => setTestTitle(e.target.value)} placeholder="e.g., Photosynthesis Quiz" />
              </Form.Item>
            </Col>
            <Col xs={12} md={6}>
              <Form.Item label="Test date">
                <DatePicker style={{ width: '100%' }} value={testDate} onChange={setTestDate} format="DD-MM-YYYY" />
              </Form.Item>
            </Col>
            <Col xs={12} md={6}>
              <Form.Item label="Time limit (min)">
                <InputNumber min={1} max={600} value={timeLimit} onChange={setTimeLimit} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Alert
            type="success"
            showIcon
            message={`Sage generated ${questions.length} question${questions.length === 1 ? '' : 's'}`}
            description="Review, edit, regenerate or remove individual questions before saving the test."
            style={{ marginBottom: 16 }}
          />

          <List
            dataSource={questions}
            locale={{ emptyText: <Empty description="No questions" /> }}
            renderItem={(q, idx) => (
              <List.Item
                key={q._id}
                actions={[
                  <Tooltip title="Edit"><Button size="small" icon={<EditOutlined />} onClick={() => setEditingIdx(idx)} /></Tooltip>,
                  <Tooltip title="Regenerate this question"><Button size="small" icon={<ReloadOutlined />} onClick={() => regenerateSingle(idx)} /></Tooltip>,
                  <Tooltip title="Remove"><Button size="small" danger icon={<DeleteOutlined />} onClick={() => removeQuestion(idx)} /></Tooltip>,
                ]}
              >
                <List.Item.Meta
                  title={
                    <span>
                      <Tag>Q{idx + 1}</Tag>
                      {q.bloom_level && <Tag color="purple">{q.bloom_level}</Tag>}
                      {q.difficulty_level && <Tag color="orange">{q.difficulty_level}</Tag>}{' '}
                      {q.question_text}
                    </span>
                  }
                  description={
                    <div>
                      {(q.options || []).map((o, i) => (
                        <div key={i}>
                          {i === q.correct_index
                            ? <span style={{ color: '#52c41a', fontWeight: 600 }}><CheckCircleOutlined /> {o}</span>
                            : <span>{String.fromCharCode(65 + i)}. {o}</span>}
                        </div>
                      ))}
                      {q.explanation && (
                        <div style={{ marginTop: 4 }}>
                          <Text type="secondary"><InfoCircleOutlined /> {q.explanation}</Text>
                        </div>
                      )}
                    </div>
                  }
                />
              </List.Item>
            )}
          />

          <Modal
            open={editingIdx != null}
            onCancel={() => setEditingIdx(null)}
            onOk={() => setEditingIdx(null)}
            title={`Edit Question ${editingIdx != null ? editingIdx + 1 : ''}`}
            width={720}
            destroyOnClose
          >
            {editingIdx != null && questions[editingIdx] && (
              <EditQuestionForm
                question={questions[editingIdx]}
                onChange={(patch) => updateQuestion(editingIdx, patch)}
              />
            )}
          </Modal>

          <Divider />
          <Space>
            <Button icon={<ReloadOutlined />} onClick={() => { setQuestions([]); setStep(1); }}>
              Regenerate all
            </Button>
            {onCancel && <Button onClick={onCancel}>Cancel</Button>}
            <Button
              type="primary"
              icon={<SaveOutlined />}
              onClick={saveAsTest}
              loading={saving}
              disabled={!questions.length}
            >
              Save test
            </Button>
          </Space>
        </div>
      )}
    </div>
  );
}

function EditQuestionForm({ question, onChange }) {
  return (
    <Space direction="vertical" style={{ width: '100%' }}>
      <Form.Item label="Question">
        <TextArea
          rows={3}
          value={question.question_text}
          onChange={(e) => onChange({ question_text: e.target.value })}
        />
      </Form.Item>
      <Form.Item label="Options">
        {(question.options || []).map((opt, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <Input
              value={opt}
              onChange={(e) => {
                const next = [...question.options];
                next[i] = e.target.value;
                onChange({ options: next });
              }}
              addonBefore={String.fromCharCode(65 + i)}
            />
            <Tooltip title="Mark correct">
              <Button
                type={i === question.correct_index ? 'primary' : 'default'}
                icon={<CheckCircleOutlined />}
                onClick={() => onChange({ correct_index: i })}
              />
            </Tooltip>
            {(question.options || []).length > 2 && (
              <Button
                danger
                icon={<DeleteOutlined />}
                onClick={() => {
                  const next = question.options.filter((_, j) => j !== i);
                  let ci = question.correct_index;
                  if (ci === i) ci = 0;
                  else if (ci > i) ci -= 1;
                  onChange({ options: next, correct_index: ci });
                }}
              />
            )}
          </div>
        ))}
        <Button
          onClick={() => onChange({ options: [...(question.options || []), ''] })}
          disabled={(question.options || []).length >= 6}
        >
          Add option
        </Button>
      </Form.Item>
    </Space>
  );
}
