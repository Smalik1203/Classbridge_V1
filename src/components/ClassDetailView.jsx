import React from 'react';
import { Card, Tabs, Empty, Button, Space, Typography, Spin } from 'antd';
import { PlusOutlined, ReloadOutlined, FilterOutlined } from '@ant-design/icons';

const { Text } = Typography;

const ClassDetailView = ({ 
  selectedType,
  onTypeChange,
  renderResourceListItem,
  getResourcesByType,
  getSortedResources,
  loading = false,
  error = null,
  canEdit = false,
  onAddResource = null,
  onRefresh = null,
  onClearFilters = null
}) => {

  // Enhanced empty state component
  const renderEmptyState = (type, count) => {
    const getEmptyConfig = (type) => {
      switch (type) {
        case 'all':
          return {
            title: 'No Learning Resources',
            description: 'No resources found for the current filters. Try adjusting your search criteria or check back later.',
            icon: '📚',
            actions: [
              onClearFilters && { text: 'Clear Filters', onClick: onClearFilters, icon: <FilterOutlined /> },
              onRefresh && { text: 'Refresh', onClick: onRefresh, icon: <ReloadOutlined /> },
              canEdit && onAddResource && { text: 'Add Resource', onClick: onAddResource, type: 'primary', icon: <PlusOutlined /> }
            ].filter(Boolean)
          };
        case 'video':
          return {
            title: 'No Video Lectures',
            description: 'No video lectures available. Teachers can add video content for this class.',
            icon: '🎥',
            actions: [
              onClearFilters && { text: 'Clear Filters', onClick: onClearFilters, icon: <FilterOutlined /> },
              canEdit && onAddResource && { text: 'Add Video', onClick: onAddResource, type: 'primary', icon: <PlusOutlined /> }
            ].filter(Boolean)
          };
        case 'pdf':
          return {
            title: 'No Study Materials',
            description: 'No PDF documents or study materials available. Teachers can upload study materials.',
            icon: '📄',
            actions: [
              onClearFilters && { text: 'Clear Filters', onClick: onClearFilters, icon: <FilterOutlined /> },
              canEdit && onAddResource && { text: 'Add Material', onClick: onAddResource, type: 'primary', icon: <PlusOutlined /> }
            ].filter(Boolean)
          };
        case 'quiz':
          return {
            title: 'No Practice Tests',
            description: 'No interactive quizzes or practice tests available. Teachers can create quizzes for this class.',
            icon: '🧩',
            actions: [
              onClearFilters && { text: 'Clear Filters', onClick: onClearFilters, icon: <FilterOutlined /> },
              canEdit && onAddResource && { text: 'Add Quiz', onClick: onAddResource, type: 'primary', icon: <PlusOutlined /> }
            ].filter(Boolean)
          };
        default:
          return {
            title: 'No Resources Found',
            description: 'No resources match your current filters.',
            icon: '🔍',
            actions: [
              onClearFilters && { text: 'Clear Filters', onClick: onClearFilters, icon: <FilterOutlined /> }
            ].filter(Boolean)
          };
      }
    };

    const config = getEmptyConfig(type);
    
    return (
      <div style={{ textAlign: 'center', padding: '40px 20px' }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>
          {config.icon}
        </div>
        <Text style={{ fontSize: '18px', fontWeight: 600, color: '#1f2937', display: 'block', marginBottom: '8px' }}>
          {config.title}
        </Text>
        <Text type="secondary" style={{ fontSize: '14px', display: 'block', marginBottom: '24px', maxWidth: '400px', margin: '0 auto 24px' }}>
          {config.description}
        </Text>
        {config.actions && config.actions.length > 0 && (
          <Space>
            {config.actions.map((action, index) => (
              <Button
                key={index}
                type={action.type || 'default'}
                icon={action.icon}
                onClick={action.onClick}
                style={{ fontWeight: 500 }}
              >
                {action.text}
              </Button>
            ))}
          </Space>
        )}
      </div>
    );
  };

  // Show error state
  if (error) {
    return (
      <Card bodyStyle={{ paddingTop: 8 }}>
        <div style={{ textAlign: 'center', padding: '40px 20px' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
          <Text style={{ fontSize: '18px', fontWeight: 600, color: '#dc2626', display: 'block', marginBottom: '8px' }}>
            Error Loading Resources
          </Text>
          <Text type="secondary" style={{ fontSize: '14px', display: 'block', marginBottom: '24px' }}>
            {error}
          </Text>
          {onRefresh && (
            <Button type="primary" icon={<ReloadOutlined />} onClick={onRefresh}>
              Try Again
            </Button>
          )}
        </div>
      </Card>
    );
  }

  return (
    <Card bodyStyle={{ paddingTop: 8 }}>
      <Tabs
        activeKey={selectedType}
        onChange={onTypeChange}
        items={[
          { key: 'all', label: 'All', children: (
            <div>
              {loading ? (
                <div style={{ textAlign: 'center', padding: '40px' }}>
                  <Spin size="large" />
                  <div style={{ marginTop: '16px' }}>
                    <Text type="secondary">Loading resources...</Text>
                  </div>
                </div>
              ) : getSortedResources(getResourcesByType('all')).length > 0 ? (
                <div>
                  {getSortedResources(getResourcesByType('all')).map(renderResourceListItem)}
                </div>
              ) : (
                renderEmptyState('all', getSortedResources(getResourcesByType('all')).length)
              )}
            </div>
          ) },
          { key: 'video', label: 'Lectures', children: (
            <div>
              {loading ? (
                <div style={{ textAlign: 'center', padding: '40px' }}>
                  <Spin size="large" />
                  <div style={{ marginTop: '16px' }}>
                    <Text type="secondary">Loading video lectures...</Text>
                  </div>
                </div>
              ) : getResourcesByType('video').length > 0 ? (
                <div>
                  {getSortedResources(getResourcesByType('video')).map(renderResourceListItem)}
                </div>
              ) : (
                renderEmptyState('video', getResourcesByType('video').length)
              )}
            </div>
          ) },
          { key: 'pdf', label: 'Study Materials', children: (
            <div>
              {loading ? (
                <div style={{ textAlign: 'center', padding: '40px' }}>
                  <Spin size="large" />
                  <div style={{ marginTop: '16px' }}>
                    <Text type="secondary">Loading study materials...</Text>
                  </div>
                </div>
              ) : getResourcesByType('pdf').length > 0 ? (
                <div>
                  {getSortedResources(getResourcesByType('pdf')).map(renderResourceListItem)}
                </div>
              ) : (
                renderEmptyState('pdf', getResourcesByType('pdf').length)
              )}
            </div>
          ) },
          { key: 'quiz', label: 'Practice Tests', children: (
            <div>
              {loading ? (
                <div style={{ textAlign: 'center', padding: '40px' }}>
                  <Spin size="large" />
                  <div style={{ marginTop: '16px' }}>
                    <Text type="secondary">Loading practice tests...</Text>
                  </div>
                </div>
              ) : getResourcesByType('quiz').length > 0 ? (
                <div>
                  {getSortedResources(getResourcesByType('quiz')).map(renderResourceListItem)}
                </div>
              ) : (
                renderEmptyState('quiz', getResourcesByType('quiz').length)
              )}
            </div>
          ) }
        ]}
      />
    </Card>
  );
};

export default ClassDetailView;
