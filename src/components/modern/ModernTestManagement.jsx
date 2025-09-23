import React, { useState, useEffect } from 'react';
import { useAuth } from '../../AuthProvider';
import { supabase } from '../../config/supabaseClient';

const ModernTestManagement = () => {
  const { user } = useAuth();
  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState('list'); // 'list' or 'create'
  const [selectedTest, setSelectedTest] = useState(null);
  const [filters, setFilters] = useState({
    type: 'all',
    subject: 'all',
    class: 'all',
    status: 'all'
  });

  const userRole = user?.app_metadata?.role;
  const canCreate = userRole === 'superadmin' || userRole === 'admin';

  useEffect(() => {
    loadTests();
  }, [user, filters]);

  const loadTests = async () => {
    try {
      setLoading(true);
      const schoolCode = user?.user_metadata?.school_code;
      if (!schoolCode) return;

      let query = supabase
        .from('tests')
        .select(`
          *,
          class_instances(grade, section),
          subjects(subject_name),
          test_questions(id)
        `)
        .eq('school_code', schoolCode);

      // Apply filters
      if (filters.type !== 'all') {
        query = query.eq('test_type', filters.type);
      }
      if (filters.subject !== 'all') {
        query = query.eq('subject_id', filters.subject);
      }
      if (filters.class !== 'all') {
        query = query.eq('class_instance_id', filters.class);
      }

      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) throw error;
      
      setTests(data || []);
    } catch (error) {
      console.error('Error loading tests:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTestTypeIcon = (type) => {
    const icons = {
      quiz: '❓',
      unit_test: '📝',
      assignment: '📋',
      exam: '🎓',
      practice: '🎯'
    };
    return icons[type] || '📝';
  };

  const getTestTypeColor = (type) => {
    const colors = {
      quiz: 'primary',
      unit_test: 'success',
      assignment: 'warning',
      exam: 'error',
      practice: 'neutral'
    };
    return colors[type] || 'neutral';
  };

  const formatTimeLimit = (seconds) => {
    if (!seconds) return 'No limit';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m`;
    } else {
      return `${seconds}s`;
    }
  };

  const TestCard = ({ test }) => (
    <div className="cb-card cb-card-interactive">
      <div className="cb-card-body">
        <div className="cb-flex cb-justify-between cb-items-start cb-mb-4">
          <div className="cb-flex cb-items-center cb-gap-3">
            <div className="cb-stat-icon" style={{ 
              width: '40px', 
              height: '40px',
              fontSize: 'var(--text-lg)',
              background: `var(--color-${getTestTypeColor(test.test_type)}-100)`,
              color: `var(--color-${getTestTypeColor(test.test_type)}-600)`
            }}>
              {getTestTypeIcon(test.test_type)}
            </div>
            <div>
              <h4 className="cb-heading-5 cb-mb-1">{test.title}</h4>
              <div className="cb-flex cb-gap-2 cb-items-center">
                <span className={`cb-badge cb-badge-${getTestTypeColor(test.test_type)} cb-badge-sm`}>
                  {test.test_type.replace('_', ' ')}
                </span>
                <span className="cb-text-caption-sm">•</span>
                <span className="cb-text-caption-sm">
                  Grade {test.class_instances?.grade} {test.class_instances?.section}
                </span>
              </div>
            </div>
          </div>
          
          <div className="cb-dropdown">
            <button className="cb-button cb-button-ghost cb-button-sm">
              ⋯
            </button>
          </div>
        </div>

        {test.description && (
          <p className="cb-text-caption cb-mb-4" style={{ 
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden'
          }}>
            {test.description}
          </p>
        )}

        <div className="cb-flex cb-justify-between cb-items-center cb-mb-4">
          <div className="cb-flex cb-gap-4">
            <div className="cb-text-center">
              <div className="cb-text-body-sm" style={{ fontWeight: 'var(--font-semibold)' }}>
                {test.test_questions?.length || 0}
              </div>
              <div className="cb-text-caption-sm">Questions</div>
            </div>
            <div className="cb-text-center">
              <div className="cb-text-body-sm" style={{ fontWeight: 'var(--font-semibold)' }}>
                {formatTimeLimit(test.time_limit_seconds)}
              </div>
              <div className="cb-text-caption-sm">Time Limit</div>
            </div>
            <div className="cb-text-center">
              <div className="cb-text-body-sm" style={{ fontWeight: 'var(--font-semibold)' }}>
                {test.subjects?.subject_name}
              </div>
              <div className="cb-text-caption-sm">Subject</div>
            </div>
          </div>
        </div>

        <div className="cb-flex cb-gap-2">
          <button className="cb-button cb-button-sm cb-button-primary" style={{ flex: 1 }}>
            <span>⚙️</span>
            <span>Manage Questions</span>
          </button>
          <button className="cb-button cb-button-sm cb-button-secondary">
            <span>👁️</span>
            <span>Preview</span>
          </button>
          <button className="cb-button cb-button-sm cb-button-ghost">
            <span>📊</span>
            <span>Results</span>
          </button>
        </div>
      </div>
    </div>
  );

  const CreateTestForm = () => (
    <div className="cb-card">
      <div className="cb-card-header">
        <h3 className="cb-heading-4">Create New Test</h3>
        <p className="cb-text-caption">Set up a new assessment for your students</p>
      </div>
      <div className="cb-card-body">
        <form className="cb-form">
          <div className="cb-form-section">
            <h4 className="cb-form-section-title">Basic Information</h4>
            <div className="cb-form-row">
              <div className="cb-form-group">
                <label className="cb-label cb-label-required">Test Title</label>
                <input
                  type="text"
                  className="cb-input"
                  placeholder="e.g., Mathematics Unit Test 1"
                />
              </div>
              <div className="cb-form-group">
                <label className="cb-label cb-label-required">Test Type</label>
                <select className="cb-input">
                  <option value="">Select type</option>
                  <option value="quiz">Quiz</option>
                  <option value="unit_test">Unit Test</option>
                  <option value="assignment">Assignment</option>
                  <option value="exam">Exam</option>
                  <option value="practice">Practice</option>
                </select>
              </div>
            </div>
            
            <div className="cb-form-group">
              <label className="cb-label">Description</label>
              <textarea
                className="cb-input cb-textarea"
                placeholder="Describe what this test covers..."
                rows="3"
              ></textarea>
            </div>
          </div>

          <div className="cb-form-section">
            <h4 className="cb-form-section-title">Assignment</h4>
            <div className="cb-form-row">
              <div className="cb-form-group">
                <label className="cb-label cb-label-required">Class</label>
                <select className="cb-input">
                  <option value="">Select class</option>
                  <option value="class1">Grade 10 - Section A</option>
                  <option value="class2">Grade 10 - Section B</option>
                </select>
              </div>
              <div className="cb-form-group">
                <label className="cb-label cb-label-required">Subject</label>
                <select className="cb-input">
                  <option value="">Select subject</option>
                  <option value="math">Mathematics</option>
                  <option value="science">Science</option>
                  <option value="english">English</option>
                </select>
              </div>
            </div>
          </div>

          <div className="cb-form-section">
            <h4 className="cb-form-section-title">Settings</h4>
            <div className="cb-form-row">
              <div className="cb-form-group">
                <label className="cb-label">Time Limit</label>
                <div className="cb-input-group">
                  <input
                    type="number"
                    className="cb-input"
                    placeholder="60"
                    min="1"
                  />
                  <span className="cb-input-icon" style={{ 
                    right: 'var(--space-3)', 
                    left: 'auto',
                    fontSize: 'var(--text-sm)',
                    color: 'var(--color-text-tertiary)'
                  }}>
                    minutes
                  </span>
                </div>
                <div className="cb-help-text">Leave empty for no time limit</div>
              </div>
              <div className="cb-form-group">
                <label className="cb-label">Allow Reattempts</label>
                <div className="cb-flex cb-items-center cb-gap-3">
                  <label className="cb-flex cb-items-center cb-gap-2">
                    <input type="radio" name="reattempts" value="no" defaultChecked />
                    <span className="cb-text-body-sm">No</span>
                  </label>
                  <label className="cb-flex cb-items-center cb-gap-2">
                    <input type="radio" name="reattempts" value="yes" />
                    <span className="cb-text-body-sm">Yes</span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          <div className="cb-flex cb-justify-end cb-gap-3">
            <button 
              type="button"
              className="cb-button cb-button-secondary"
              onClick={() => setView('list')}
            >
              Cancel
            </button>
            <button type="submit" className="cb-button cb-button-primary">
              <span>✨</span>
              <span>Create Test</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return (
    <div className="cb-container cb-section">
      {/* Header */}
      <div className="cb-dashboard-header">
        <div className="cb-flex cb-justify-between cb-items-start">
          <div>
            <h1 className="cb-heading-2 cb-mb-2">
              📝 Test Management
            </h1>
            <p className="cb-text-caption">
              Create, manage, and organize tests and assessments
            </p>
          </div>
          
          {canCreate && (
            <div className="cb-dashboard-actions">
              <button 
                className="cb-button cb-button-secondary"
                onClick={() => setView(view === 'create' ? 'list' : 'create')}
              >
                {view === 'create' ? '📋 View Tests' : '➕ Create Test'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Quick Stats */}
      <div className="cb-kpi-grid cb-mb-8">
        <div className="cb-kpi-card">
          <div className="cb-stat-header">
            <div className="cb-stat-icon">📝</div>
            <div className="cb-stat-change positive">↗️ +12%</div>
          </div>
          <div className="cb-stat-value">{tests.length}</div>
          <div className="cb-stat-label">Total Tests</div>
        </div>
        <div className="cb-kpi-card">
          <div className="cb-stat-header">
            <div className="cb-stat-icon">❓</div>
            <div className="cb-stat-change positive">↗️ +8%</div>
          </div>
          <div className="cb-stat-value">
            {tests.reduce((sum, test) => sum + (test.test_questions?.length || 0), 0)}
          </div>
          <div className="cb-stat-label">Total Questions</div>
        </div>
        <div className="cb-kpi-card">
          <div className="cb-stat-header">
            <div className="cb-stat-icon">🎯</div>
            <div className="cb-stat-change positive">↗️ +5%</div>
          </div>
          <div className="cb-stat-value">
            {tests.filter(test => test.test_type === 'quiz').length}
          </div>
          <div className="cb-stat-label">Active Quizzes</div>
        </div>
        <div className="cb-kpi-card">
          <div className="cb-stat-header">
            <div className="cb-stat-icon">🎓</div>
            <div className="cb-stat-change neutral">→ Stable</div>
          </div>
          <div className="cb-stat-value">
            {tests.filter(test => test.test_type === 'exam').length}
          </div>
          <div className="cb-stat-label">Exams</div>
        </div>
      </div>

      {view === 'create' && canCreate ? (
        <CreateTestForm />
      ) : (
        <>
          {/* Filters */}
          <div className="cb-filter-bar cb-mb-6">
            <div className="cb-text-overline">Filter Tests</div>
            
            <div className="cb-filter-chips">
              {[
                { key: 'all', label: 'All Tests', icon: '📚' },
                { key: 'quiz', label: 'Quizzes', icon: '❓' },
                { key: 'unit_test', label: 'Unit Tests', icon: '📝' },
                { key: 'exam', label: 'Exams', icon: '🎓' },
                { key: 'assignment', label: 'Assignments', icon: '📋' }
              ].map(type => (
                <button
                  key={type.key}
                  className={`cb-chip ${filters.type === type.key ? 'active' : ''}`}
                  onClick={() => setFilters(prev => ({ ...prev, type: type.key }))}
                >
                  <span>{type.icon}</span>
                  <span>{type.label}</span>
                  <span className="cb-badge cb-badge-neutral cb-badge-sm">
                    {type.key === 'all' ? tests.length : tests.filter(t => t.test_type === type.key).length}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Test List */}
          {loading ? (
            <div className="cb-grid cb-grid-auto">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} className="cb-skeleton" style={{ 
                  height: '280px',
                  borderRadius: 'var(--radius-2xl)' 
                }}></div>
              ))}
            </div>
          ) : tests.length === 0 ? (
            <div className="cb-empty-state">
              <div className="cb-empty-icon">📝</div>
              <h3 className="cb-empty-title">No tests found</h3>
              <p className="cb-empty-description">
                {canCreate 
                  ? 'Start creating assessments for your students. You can add quizzes, unit tests, assignments, and exams.'
                  : 'Your teachers haven\'t created any tests yet. Check back soon!'
                }
              </p>
              {canCreate && (
                <button 
                  className="cb-button cb-button-primary cb-button-lg"
                  onClick={() => setView('create')}
                >
                  <span>✨</span>
                  <span>Create First Test</span>
                </button>
              )}
            </div>
          ) : (
            <div className="cb-grid cb-grid-auto">
              {tests.map(test => (
                <TestCard key={test.id} test={test} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ModernTestManagement;