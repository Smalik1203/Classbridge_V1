import React, { useState, useEffect } from 'react';
import { Card, Typography, Row, Col, Tooltip, Popover, Button } from 'antd';
import { 
  UserAddOutlined, 
  BookOutlined, 
  UnorderedListOutlined, 
  TeamOutlined,
  CalendarOutlined,
  FileTextOutlined,
  DollarOutlined,
  ClockCircleOutlined,
  InfoCircleOutlined,
  CloseOutlined
} from '@ant-design/icons';
import { useAuth } from '../AuthProvider';
import { useNavigate } from 'react-router-dom';

const { Title, Text } = Typography;


const SetupSchool = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  // Check if user is first time visitor
  useEffect(() => {
    const hasVisited = localStorage.getItem('quickSetupVisited');
    if (!hasVisited) {
      setShowOnboarding(true);
      localStorage.setItem('quickSetupVisited', 'true');
    }
  }, []);

  const handleSetupAction = (link) => {
    navigate(link);
  };

  const setupTasks = [
    {
      id: 'admins',
      title: 'Administrator Setup',
      tagline: 'Create accounts',
      description: 'Create and manage administrator accounts for your school',
      icon: <UserAddOutlined />,
      link: '/add-admin',
      color: '#10b981',
      bgColor: '#ecfdf5',
      iconBg: '#d1fae5',
      priority: 1
    },
    {
      id: 'classes',
      title: 'Class Structure',
      tagline: 'Organize grades',
      description: 'Define academic years, grades, and class organization',
      icon: <UnorderedListOutlined />,
      link: '/add-specific-class',
      color: '#f59e0b',
      bgColor: '#fffbeb',
      iconBg: '#fed7aa',
      priority: 2
    },
    {
      id: 'subjects',
      title: 'Subject Management',
      tagline: 'Set curriculum',
      description: 'Set up curriculum subjects and course offerings',
      icon: <BookOutlined />,
      link: '/add-subjects',
      color: '#06b6d4',
      bgColor: '#faf5ff',
      iconBg: '#e9d5ff',
      priority: 3
    },
    {
      id: 'students',
      title: 'Student Enrollment',
      tagline: 'Enroll students',
      description: 'Enroll students and assign them to classes',
      icon: <TeamOutlined />,
      link: '/add-student',
      color: '#3b82f6',
      bgColor: '#eff6ff',
      iconBg: '#dbeafe',
      priority: 4
    },
    {
      id: 'timetable',
      title: 'Timetable Management',
      tagline: 'Create schedules',
      description: 'Create and manage class schedules and timetables',
      icon: <CalendarOutlined />,
      link: '/timetable',
      color: '#06b6d4',
      bgColor: '#ecfeff',
      iconBg: '#a5f3fc',
      priority: 5
    },
    {
      id: 'syllabus',
      title: 'Syllabus & Learning',
      tagline: 'Manage resources',
      description: 'Manage curriculum and learning resources',
      icon: <FileTextOutlined />,
      link: '/syllabus',
      color: '#84cc16',
      bgColor: '#f7fee7',
      iconBg: '#d9f99d',
      priority: 6
    },
    {
      id: 'fees',
      title: 'Fee Management',
      tagline: 'Handle billing',
      description: 'Handle payments, billing, and fee collection',
      icon: <DollarOutlined />,
      link: '/fees',
      color: '#f97316',
      bgColor: '#fff7ed',
      iconBg: '#fed7aa',
      priority: 7
    },
    {
      id: 'attendance',
      title: 'Attendance Tracking',
      tagline: 'Monitor attendance',
      description: 'Monitor and track student attendance',
      icon: <ClockCircleOutlined />,
      link: '/attendance',
      color: '#ec4899',
      bgColor: '#fdf2f8',
      iconBg: '#f9a8d4',
      priority: 8
    }
  ];

  const onboardingSteps = [
    {
      target: 'admins',
      title: 'Start Here!',
      content: 'Click here to set up administrators first. This is your first step to get your school running.',
      placement: 'top'
    },
    {
      target: 'classes',
      title: 'Next Step',
      content: 'Then organize your classes and academic structure.',
      placement: 'top'
    },
    {
      target: 'subjects',
      title: 'Add Subjects',
      content: 'Set up your curriculum and subject offerings.',
      placement: 'top'
    },
    {
      target: 'students',
      title: 'Enroll Students',
      content: 'Finally, enroll students and assign them to classes.',
      placement: 'top'
    }
  ];

  const handleOnboardingNext = () => {
    if (currentStep < onboardingSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      setShowOnboarding(false);
    }
  };

  const handleOnboardingSkip = () => {
    setShowOnboarding(false);
  };


  return (
    <div style={{ 
      minHeight: '100vh', 
      background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
      padding: '20px 12px'
    }}>
      <div style={{ 
        maxWidth: '1400px', 
        margin: '0 auto',
        width: '100%'
      }}>
        {/* Header Section */}
        <div style={{ 
          textAlign: 'center', 
          marginBottom: '24px' 
        }}>
          <Title level={1} style={{ 
            margin: 0, 
            color: '#1e293b', 
            fontWeight: 700,
            fontSize: '26px',
            marginBottom: '6px'
          }}>
            Quick Setup
          </Title>
          <Text style={{ 
            fontSize: '15px', 
            color: '#64748b',
            display: 'block'
          }}>
            Get your school up and running in minutes
          </Text>
        </div>

        {/* Setup Tasks Grid */}
        <Row gutter={[16, 16]} justify="center">
          {setupTasks.map((task, index) => {
            const isOnboardingTarget = showOnboarding && 
              onboardingSteps[currentStep]?.target === task.id;
            
            const cardContent = (
              <Card
                hoverable
                onClick={() => handleSetupAction(task.link)}
                style={{ 
                  width: '100%',
                  maxWidth: '320px',
                  height: '180px',
                  borderRadius: '16px',
                  border: isOnboardingTarget ? '2px solid #3b82f6' : 'none',
                  background: `linear-gradient(135deg, ${task.bgColor} 0%, #ffffff 100%)`,
                  boxShadow: isOnboardingTarget 
                    ? '0 8px 32px rgba(59, 130, 246, 0.2)' 
                    : '0 4px 20px rgba(0, 0, 0, 0.08)',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  cursor: 'pointer',
                  margin: '0 auto',
                  overflow: 'hidden',
                  position: 'relative'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-4px) scale(1.02)';
                  e.currentTarget.style.boxShadow = '0 8px 32px rgba(0, 0, 0, 0.12)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0) scale(1)';
                  e.currentTarget.style.boxShadow = isOnboardingTarget 
                    ? '0 8px 32px rgba(59, 130, 246, 0.2)' 
                    : '0 4px 20px rgba(0, 0, 0, 0.08)';
                }}
              >
                <div style={{ 
                  padding: '28px',
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  textAlign: 'center',
                  position: 'relative'
                }}>
                  {/* Onboarding Indicator */}
                  {isOnboardingTarget && (
                    <div style={{
                      position: 'absolute',
                      top: '8px',
                      right: '8px',
                      width: '12px',
                      height: '12px',
                      borderRadius: '50%',
                      background: '#3b82f6',
                      animation: 'pulse 2s infinite'
                    }} />
                  )}

                  {/* Icon with Pastel Background */}
                  <div style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '50%',
                    background: task.iconBg,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '18px',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
                  }}>
                    <div style={{
                      fontSize: '28px',
                      color: task.color,
                      fontWeight: 'bold'
                    }}>
                      {task.icon}
                    </div>
                  </div>

                  {/* Content */}
                  <div style={{ width: '100%' }}>
                    <Title level={4} style={{ 
                      margin: '0 0 6px 0', 
                      color: '#1e293b',
                      fontWeight: 600,
                      fontSize: '18px',
                      lineHeight: '1.2',
                      textAlign: 'center'
                    }}>
                      {task.title}
                    </Title>
                    <Text style={{ 
                      color: '#64748b',
                      fontSize: '13px',
                      lineHeight: '1.3',
                      display: 'block',
                      textAlign: 'center',
                      fontWeight: '500'
                    }}>
                      {task.tagline}
                    </Text>
                  </div>
                </div>
              </Card>
            );

            return (
              <Col xs={24} sm={12} md={8} lg={6} key={task.id}>
                {isOnboardingTarget ? (
                  <Popover
                    content={
                      <div style={{ padding: '8px 0' }}>
                        <div style={{ 
                          display: 'flex', 
                          justifyContent: 'space-between', 
                          alignItems: 'center',
                          marginBottom: '12px'
                        }}>
                          <Text strong style={{ fontSize: '14px' }}>
                            {onboardingSteps[currentStep].title}
                          </Text>
                          <Button 
                            type="text" 
                            size="small" 
                            icon={<CloseOutlined />}
                            onClick={handleOnboardingSkip}
                            style={{ padding: '0', minWidth: 'auto' }}
                          />
                        </div>
                        <Text style={{ fontSize: '13px', display: 'block', marginBottom: '12px' }}>
                          {onboardingSteps[currentStep].content}
                        </Text>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Text style={{ fontSize: '11px', color: '#9ca3af' }}>
                            {currentStep + 1} of {onboardingSteps.length}
                          </Text>
                          <Button 
                            type="primary" 
                            size="small"
                            onClick={handleOnboardingNext}
                            style={{ fontSize: '12px', height: '24px' }}
                          >
                            {currentStep === onboardingSteps.length - 1 ? 'Finish' : 'Next'}
                          </Button>
                        </div>
                      </div>
                    }
                    title={null}
                    placement={onboardingSteps[currentStep].placement}
                    open={true}
                    overlayStyle={{ maxWidth: '280px' }}
                  >
                    {cardContent}
                  </Popover>
                ) : (
                  <Tooltip
                    title={task.description}
                    placement="top"
                    overlayStyle={{ maxWidth: '280px' }}
                  >
                    {cardContent}
                  </Tooltip>
                )}
              </Col>
            );
          })}
        </Row>
      </div>
    </div>
  );
};

export default SetupSchool;