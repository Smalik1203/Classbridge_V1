import React from 'react';
import { Card, Tabs, Empty } from 'antd';

const ClassDetailView = ({ 
  selectedType,
  onTypeChange,
  renderResourceListItem,
  getResourcesByType,
  getSortedResources
}) => {

  return (
    <Card bodyStyle={{ paddingTop: 8 }}>
      <Tabs
        activeKey={selectedType}
        onChange={onTypeChange}
        items={[
          { key: 'all', label: 'All', children: (
            <div>
              {getSortedResources(getResourcesByType('all')).length > 0 ? (
                <div>
                  {getSortedResources(getResourcesByType('all')).map(renderResourceListItem)}
                </div>
              ) : (
                <Empty description="No resources found. Try clearing filters or check back later." image={Empty.PRESENTED_IMAGE_SIMPLE} />
              )}
            </div>
          ) },
          { key: 'video', label: 'Lectures', children: (
            <div>
              {getResourcesByType('video').length > 0 ? (
                <div>
                  {getSortedResources(getResourcesByType('video')).map(renderResourceListItem)}
                </div>
              ) : (
                <Empty description="No lectures found. Try clearing filters or check back later." image={Empty.PRESENTED_IMAGE_SIMPLE} />
              )}
            </div>
          ) },
          { key: 'pdf', label: 'Study Materials', children: (
            <div>
              {getResourcesByType('pdf').length > 0 ? (
                <div>
                  {getSortedResources(getResourcesByType('pdf')).map(renderResourceListItem)}
                </div>
              ) : (
                <Empty description="No study materials found. Try clearing filters or check back later." image={Empty.PRESENTED_IMAGE_SIMPLE} />
              )}
            </div>
          ) },
          { key: 'quiz', label: 'Practice Tests', children: (
            <div>
              {getResourcesByType('quiz').length > 0 ? (
                <div>
                  {getSortedResources(getResourcesByType('quiz')).map(renderResourceListItem)}
                </div>
              ) : (
                <Empty description="No practice tests found. Try clearing filters or check back later." image={Empty.PRESENTED_IMAGE_SIMPLE} />
              )}
            </div>
          ) }
        ]}
      />
    </Card>
  );
};

export default ClassDetailView;
