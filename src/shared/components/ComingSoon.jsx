import React from 'react';
import { Result, Card, Tag, Typography } from 'antd';
import { RocketOutlined } from '@ant-design/icons';
import { useTheme } from '@/contexts/ThemeContext';

const { Paragraph } = Typography;

/**
 * Generic placeholder for feature parity with the Classbridge mobile app.
 * Used for screens that exist on mobile but haven't been built on web yet.
 */
const ComingSoon = ({ title, description, module: moduleName, mobileParity = true }) => {
  const { isDarkMode } = useTheme();

  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '24px' }}>
      <Card
        style={{
          maxWidth: 720,
          width: '100%',
          background: isDarkMode ? '#141414' : '#ffffff',
          borderRadius: 12
        }}
      >
        <Result
          icon={<RocketOutlined style={{ color: '#6366F1' }} />}
          title={title || 'Coming Soon'}
          subTitle={
            <div style={{ textAlign: 'center' }}>
              {moduleName && (
                <div style={{ marginBottom: 12 }}>
                  <Tag color="purple">{moduleName}</Tag>
                  {mobileParity && <Tag color="blue">Available on mobile</Tag>}
                </div>
              )}
              <Paragraph type="secondary" style={{ marginBottom: 0 }}>
                {description ||
                  'This feature is available on the Classbridge mobile app and will be coming to the web app soon.'}
              </Paragraph>
            </div>
          }
        />
      </Card>
    </div>
  );
};

export default ComingSoon;
