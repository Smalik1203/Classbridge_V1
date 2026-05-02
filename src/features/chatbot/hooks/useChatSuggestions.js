// Starter prompts for the empty-conversation state. Mirrors mobile's
// useChatSuggestions exactly: same labels, same messages, same ordering.
// `icon` is an AntD icon name (string) that the UI maps to a component.
import { useMemo } from 'react';

const AI_TEST_GENERATOR = {
  label: 'Test Generator',
  message: '',
  icon: 'thunderbolt',
  color: '#6366F1',
  href: '/test-management?mode=ai',
};

const SUPER_ADMIN_SUGGESTIONS = [
  { label: 'School overview',  message: 'Give me a school overview for today',                 icon: 'dashboard',     color: '#2678BE' },
  { label: 'Fee collection',   message: 'What is the current fee collection status?',          icon: 'credit-card',   color: '#10B981' },
  { label: 'Compare classes',  message: 'Compare all classes performance',                     icon: 'assessment',    color: '#6366F1' },
  { label: 'Low attendance',   message: 'Which students have low attendance this month?',      icon: 'warning',       color: '#F59E0B' },
  { label: 'Admissions',       message: 'Show me the admissions pipeline status',              icon: 'school',        color: '#3B82F6' },
  { label: 'Upcoming events',  message: 'What events are coming up this week?',                icon: 'event',         color: '#EF4444' },
];

const ADMIN_TEACHER_SUGGESTIONS = [
  { label: 'Class overview',     message: 'How is my class doing overall?',                       icon: 'dashboard',      color: '#2678BE' },
  { label: 'Fee defaulters',     message: 'Which students have pending fee payments?',            icon: 'credit-card',    color: '#10B981' },
  { label: 'Weak topics',        message: 'What topics do students need help with?',              icon: 'trending-down',  color: '#EF4444' },
  { label: 'Attendance today',   message: "Show me today's attendance summary",                   icon: 'how-to-reg',     color: '#F59E0B' },
  { label: 'Pending tasks',      message: 'What tasks are overdue or due soon?',                  icon: 'check-circle',   color: '#0EA5E9' },
  { label: 'Syllabus progress',  message: 'How far along is the syllabus for each subject?',      icon: 'auto-stories',   color: '#3B82F6' },
];

const STUDENT_SUGGESTIONS = [
  { label: 'My results',        message: 'Show me my latest test results',                  icon: 'assessment',  color: '#2678BE' },
  { label: 'My attendance',     message: 'How is my attendance this month?',                icon: 'how-to-reg',  color: '#F59E0B' },
  { label: "What's due",        message: 'What homework or tasks do I have due?',           icon: 'check-circle', color: '#0EA5E9' },
  { label: "Today's schedule",  message: "What's on my timetable today?",                   icon: 'event',       color: '#EF4444' },
  { label: 'Weak topics',       message: 'Which topics should I revise?',                   icon: 'trending-down', color: '#3B82F6' },
  { label: 'My fees',           message: 'What is my fee status?',                          icon: 'credit-card', color: '#10B981' },
];

export function useChatSuggestions(role, capabilities = {}) {
  return useMemo(() => {
    const r = (role || '').toLowerCase();
    let base;
    if (r === 'superadmin') base = SUPER_ADMIN_SUGGESTIONS;
    else if (r === 'student') base = STUDENT_SUGGESTIONS;
    else base = ADMIN_TEACHER_SUGGESTIONS;

    if (capabilities.canCreateAssessments && r !== 'student') {
      return [AI_TEST_GENERATOR, ...base];
    }
    return base;
  }, [role, capabilities.canCreateAssessments]);
}
