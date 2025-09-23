import React, { useState, useEffect } from 'react';
import { useAuth } from '../../AuthProvider';
import { supabase } from '../../config/supabaseClient';

const ModernLearningResources = () => {
  const { user } = useAuth();
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState('grid'); // 'grid' or 'list'
  const [filters, setFilters] = useState({
    type: 'all',
    subject: 'all',
    class: 'all'
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [subjects, setSubjects] = useState([]);
  const [classes, setClasses] = useState([]);

  const userRole = user?.app_metadata?.role;
  const isStudent = userRole === 'student';
  const canEdit = userRole === 'superadmin' || userRole === 'admin';

  useEffect(() => {
    loadInitialData();
  }, [user]);

  useEffect(() => {
    loadResources();
  }, [filters, searchQuery]);

  const loadInitialData = async () => {
    try {
      const schoolCode = user?.user_metadata?.school_code;
      if (!schoolCode) return;

      const [subjectsRes, classesRes] = await Promise.all([
        supabase.from('subjects').select('id, subject_name').eq('school_code', schoolCode),
        supabase.from('class_instances').select('id, grade, section').eq('school_code', schoolCode)
      ]);

      setSubjects(subjectsRes.data || []);
      setClasses(classesRes.data || []);
    } catch (error) {
      console.error('Error loading initial data:', error);
    }
  };

  const loadResources = async () => {
    try {
      setLoading(true);
      const schoolCode = user?.user_metadata?.school_code;
      if (!schoolCode) return;

      let query = supabase
        .from('learning_resources')
        .select(`
          *,
          subjects:subject_id (id, subject_name),
          class_instances:class_instance_id (id, grade, section)
        `)
        .eq('school_code', schoolCode);

      // Apply filters
      if (filters.type !== 'all') {
        query = query.eq('resource_type', filters.type);
      }
      if (filters.subject !== 'all') {
        query = query.eq('subject_id', filters.subject);
      }
      if (filters.class !== 'all') {
        query = query.eq('class_instance_id', filters.class);
      }

      // Apply search
      if (searchQuery) {
        query = query.or(`title.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`);
      }

      const { data, error } = await query.order('created_at', { ascending: false });
      
      if (error) throw error;
      setResources(data || []);
    } catch (error) {
      console.error('Error loading resources:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (filterType, value) => {
    setFilters(prev => ({
      ...prev,
      [filterType]: value
    }));
  };

  const getResourceIcon = (type) => {
    const icons = {
      video: '🎥',
      pdf: '📄',
      quiz: '❓'
    };
    return icons[type] || '📄';
  };

  const getSubjectColor = (subjectName) => {
    const colors = {
      'mathematics': 'math',
      'science': 'science',
      'english': 'english',
      'history': 'history',
      'geography': 'geography',
      'computer': 'computer'
    };
    const key = subjectName?.toLowerCase() || '';
    return colors[key] || 'neutral';
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const ResourceCard = ({ resource }) => (
    <div className="cb-resource-card">
      <div className="cb-resource-thumbnail">
        <span style={{ fontSize: 'var(--text-4xl)' }}>
          {getResourceIcon(resource.resource_type)}
        </span>
      </div>
      <div className="cb-resource-content">
        <div className="cb-resource-title">
          {resource.title}
        </div>
        {resource.description && (
          <p className="cb-text-caption cb-mb-3" style={{ 
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden'
          }}>
            {resource.description}
          </p>
        )}
        <div className="cb-resource-meta">
          <span className={`cb-badge cb-badge-${getSubjectColor(resource.subjects?.subject_name)} cb-badge-sm`}>
            {resource.subjects?.subject_name}
          </span>
          <span>•</span>
          <span>Grade {resource.class_instances?.grade}{resource.class_instances?.section}</span>
          <span>•</span>
          <span>{formatDate(resource.created_at)}</span>
        </div>
        <div className="cb-flex cb-justify-between cb-items-center cb-mt-4">
          <div className="cb-flex cb-gap-2">
            {canEdit && (
              <>
                <button className="cb-button cb-button-xs cb-button-ghost">
                  ✏️ Edit
                </button>
                <button className="cb-button cb-button-xs cb-button-ghost" style={{ color: 'var(--color-error-500)' }}>
                  🗑️ Delete
                </button>
              </>
            )}
          </div>
          <button className="cb-button cb-button-sm cb-button-primary">
            {resource.resource_type === 'video' ? '▶️ Watch' : 
             resource.resource_type === 'pdf' ? '📖 Read' : 
             '🎯 Attempt'}
          </button>
        </div>
      </div>
    </div>
  );

  const ResourceListItem = ({ resource }) => (
    <div className="cb-list-item">
      <div className="cb-stat-icon" style={{ 
        width: '48px', 
        height: '48px',
        fontSize: 'var(--text-xl)',
        background: `var(--color-${getSubjectColor(resource.subjects?.subject_name)}-100)`,
        color: `var(--color-${getSubjectColor(resource.subjects?.subject_name)}-600)`
      }}>
        {getResourceIcon(resource.resource_type)}
      </div>
      <div className="cb-list-item-content">
        <div className="cb-list-item-title">{resource.title}</div>
        <div className="cb-list-item-subtitle">
          {resource.description && `${resource.description.substring(0, 80)}...`}
        </div>
        <div className="cb-resource-meta cb-mt-2">
          <span className={`cb-badge cb-badge-${getSubjectColor(resource.subjects?.subject_name)} cb-badge-sm`}>
            {resource.subjects?.subject_name}
          </span>
          <span>Grade {resource.class_instances?.grade}{resource.class_instances?.section}</span>
          <span>{formatDate(resource.created_at)}</span>
        </div>
      </div>
      <div className="cb-list-item-actions">
        {canEdit && (
          <>
            <button className="cb-button cb-button-xs cb-button-ghost">✏️</button>
            <button className="cb-button cb-button-xs cb-button-ghost" style={{ color: 'var(--color-error-500)' }}>🗑️</button>
          </>
        )}
        <button className="cb-button cb-button-sm cb-button-primary">
          {resource.resource_type === 'video' ? 'Watch' : 
           resource.resource_type === 'pdf' ? 'Read' : 
           'Attempt'}
        </button>
      </div>
    </div>
  );

  const filteredResources = resources.filter(resource => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return resource.title.toLowerCase().includes(query) ||
             resource.description?.toLowerCase().includes(query) ||
             resource.subjects?.subject_name.toLowerCase().includes(query);
    }
    return true;
  });

  const getResourcesByType = (type) => {
    if (type === 'all') return filteredResources;
    return filteredResources.filter(r => r.resource_type === type);
  };

  return (
    <div className="cb-container cb-section">
      {/* Modern Header */}
      <div className="cb-dashboard-header">
        <div className="cb-flex cb-justify-between cb-items-start">
          <div>
            <h1 className="cb-heading-2 cb-mb-2">
              📚 Learning Resources
            </h1>
            <p className="cb-text-caption">
              {isStudent ? 'Access your study materials, videos, and practice tests' : 'Manage educational content for your students'}
            </p>
          </div>
          
          {canEdit && (
            <div className="cb-dashboard-actions">
              <button className="cb-button cb-button-primary">
                <span>➕</span>
                <span>Add Resource</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Modern Search & Filters */}
      <div className="cb-search-container">
        <input
          type="text"
          placeholder="Search resources, subjects, or topics..."
          className="cb-search-input"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <span className="cb-search-icon">🔍</span>
      </div>

      <div className="cb-filter-bar">
        <div className="cb-text-overline">Filters</div>
        
        {/* Type Filter Chips */}
        <div className="cb-filter-chips">
          {[
            { key: 'all', label: 'All Resources', icon: '📚' },
            { key: 'video', label: 'Videos', icon: '🎥' },
            { key: 'pdf', label: 'Documents', icon: '📄' },
            { key: 'quiz', label: 'Quizzes', icon: '❓' }
          ].map(type => (
            <button
              key={type.key}
              className={`cb-chip ${filters.type === type.key ? 'active' : ''}`}
              onClick={() => handleFilterChange('type', type.key)}
            >
              <span>{type.icon}</span>
              <span>{type.label}</span>
              <span className="cb-badge cb-badge-neutral cb-badge-sm">
                {getResourcesByType(type.key).length}
              </span>
            </button>
          ))}
        </div>

        {/* Additional Filters */}
        <div className="cb-flex cb-gap-4 cb-items-center">
          {!isStudent && (
            <select
              className="cb-input"
              style={{ width: '200px' }}
              value={filters.class}
              onChange={(e) => handleFilterChange('class', e.target.value)}
            >
              <option value="all">All Classes</option>
              {classes.map(cls => (
                <option key={cls.id} value={cls.id}>
                  Grade {cls.grade} - {cls.section}
                </option>
              ))}
            </select>
          )}
          
          <select
            className="cb-input"
            style={{ width: '200px' }}
            value={filters.subject}
            onChange={(e) => handleFilterChange('subject', e.target.value)}
          >
            <option value="all">All Subjects</option>
            {subjects.map(subject => (
              <option key={subject.id} value={subject.id}>
                {subject.subject_name}
              </option>
            ))}
          </select>

          {/* View Toggle */}
          <div className="cb-flex cb-gap-1" style={{ marginLeft: 'auto' }}>
            <button
              className={`cb-button cb-button-sm ${view === 'grid' ? 'cb-button-primary' : 'cb-button-ghost'}`}
              onClick={() => setView('grid')}
              title="Grid view"
            >
              ⊞
            </button>
            <button
              className={`cb-button cb-button-sm ${view === 'list' ? 'cb-button-primary' : 'cb-button-ghost'}`}
              onClick={() => setView('list')}
              title="List view"
            >
              ☰
            </button>
          </div>
        </div>
      </div>

      {/* Content Area */}
      {loading ? (
        <div className="cb-grid cb-grid-auto">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="cb-skeleton" style={{ 
              height: view === 'grid' ? '320px' : '100px',
              borderRadius: 'var(--radius-2xl)' 
            }}></div>
          ))}
        </div>
      ) : filteredResources.length === 0 ? (
        <div className="cb-empty-state">
          <div className="cb-empty-icon">📚</div>
          <h3 className="cb-empty-title">
            {searchQuery ? 'No resources found' : 'No resources yet'}
          </h3>
          <p className="cb-empty-description">
            {searchQuery 
              ? `No resources match "${searchQuery}". Try adjusting your search or filters.`
              : canEdit 
                ? 'Start building your resource library by adding videos, documents, and quizzes.'
                : 'Your teachers haven\'t added any resources yet. Check back soon!'
            }
          </p>
          {canEdit && !searchQuery && (
            <button className="cb-button cb-button-primary cb-button-lg">
              <span>➕</span>
              <span>Add First Resource</span>
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Results Summary */}
          <div className="cb-flex cb-justify-between cb-items-center cb-mb-6">
            <div className="cb-text-caption">
              Showing {filteredResources.length} of {resources.length} resources
              {searchQuery && ` for "${searchQuery}"`}
            </div>
            <div className="cb-flex cb-gap-2">
              <span className="cb-text-caption-sm">Sort by:</span>
              <select className="cb-input" style={{ width: '140px', padding: 'var(--space-2) var(--space-3)' }}>
                <option value="recent">Most Recent</option>
                <option value="alphabetical">Alphabetical</option>
                <option value="type">Resource Type</option>
                <option value="subject">Subject</option>
              </select>
            </div>
          </div>

          {/* Resource Display */}
          {view === 'grid' ? (
            <div className="cb-grid cb-grid-auto">
              {filteredResources.map(resource => (
                <ResourceCard key={resource.id} resource={resource} />
              ))}
            </div>
          ) : (
            <div className="cb-list">
              {filteredResources.map(resource => (
                <ResourceListItem key={resource.id} resource={resource} />
              ))}
            </div>
          )}

          {/* Load More / Pagination */}
          {filteredResources.length >= 20 && (
            <div className="cb-text-center cb-mt-8">
              <button className="cb-button cb-button-secondary cb-button-lg">
                Load More Resources
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ModernLearningResources;