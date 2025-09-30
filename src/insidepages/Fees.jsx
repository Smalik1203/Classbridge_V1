import React, { useState, useEffect } from "react";
import { Tabs, Card, Space, Typography, Select, Tag, Divider, Tooltip } from "antd";
import { 
  SettingOutlined, 
  TeamOutlined, 
  DollarOutlined, 
  BarChartOutlined,
  CalendarOutlined,
  BankOutlined
} from "@ant-design/icons";
import { useAuth } from "../AuthProvider";
import { getUserRole, getSchoolCode } from "../utils/metadata";
import { supabase } from "../config/supabaseClient";
import FeeComponents from "../components/FeeComponents";
import FeeManage from "../components/FeeManage";
import RecordPayments from "../components/RecordPayments";
import FeeAnalyticsEnhanced from "../components/FeeAnalyticsEnhanced";
import StudentFees from "../components/StudentFees";

const { TabPane } = Tabs;
const { Title, Text } = Typography;

export default function Fees() {
  // Force refresh to clear cache
  const { user } = useAuth();
  const role = getUserRole(user);
  const [schoolCode, setSchoolCode] = useState(null);
  const [academicYear, setAcademicYear] = useState(null);
  const [loading, setLoading] = useState(true);

  // Load context data
  useEffect(() => {
    const loadContext = async () => {
      try {
        const schoolCodeValue = getSchoolCode(user);
        setSchoolCode(schoolCodeValue);

        if (schoolCodeValue) {
          // Load active academic year
          const { data: ay, error: ayErr } = await supabase
            .from("academic_years")
            .select("id, year_start, year_end, is_active")
            .eq("school_code", schoolCodeValue)
            .eq("is_active", true)
            .single();
          
          if (!ayErr && ay) {
            setAcademicYear(ay);
          }
        }
      } catch (error) {
        console.error("Error loading context:", error);
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      loadContext();
    }
  }, [user]);

  // If user is a student, show student-specific fee view
  if (role === 'student') {
    return <StudentFees />;
  }

  // Context header component
  const ContextHeader = () => (
    <Card 
      size="small" 
      style={{ 
        marginBottom: 16, 
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        border: 'none',
        borderRadius: 12
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'white' }}>
        <div>
          <Title level={4} style={{ color: 'white', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <BankOutlined />
            Fee Management
          </Title>
          <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: '14px' }}>
            {academicYear && `Academic Year: ${academicYear.year_start} - ${academicYear.year_end}`}
          </Text>
        </div>
        <Space>
          {role && (
            <Tag color="rgba(255,255,255,0.2)" style={{ color: 'white', border: '1px solid rgba(255,255,255,0.3)' }}>
              {role.toUpperCase()}
            </Tag>
          )}
        </Space>
      </div>
    </Card>
  );

  // Enhanced tab configuration with better grouping
  const tabItems = [
    {
      key: 'components',
      label: (
        <span>
          <SettingOutlined />
          <span style={{ marginLeft: 8 }}>Components</span>
        </span>
      ),
      children: <FeeComponents />
    },
    {
      key: 'manage',
      label: (
        <span>
          <TeamOutlined />
          <span style={{ marginLeft: 8 }}>Plans</span>
        </span>
      ),
      children: <FeeManage />
    },
    {
      key: 'record',
      label: (
        <span>
          <DollarOutlined />
          <span style={{ marginLeft: 8 }}>Record Payments</span>
        </span>
      ),
      children: <RecordPayments />
    },
    {
      key: 'analytics',
      label: (
        <span>
          <BarChartOutlined />
          <span style={{ marginLeft: 8 }}>Analytics</span>
        </span>
      ),
      children: <FeeAnalyticsEnhanced />
    }
  ];


  if (loading) {
    return (
      <div style={{ padding: "24px" }}>
        <div style={{ textAlign: 'center', padding: '50px' }}>
          <div>Loading fee management...</div>
        </div>
      </div>
    );
  }

  // For admins and superadmins, show the enhanced management interface
  return (
    <div style={{ padding: "24px", background: '#f8fafc', minHeight: '100vh' }}>
      <ContextHeader />
      
      <Card 
        style={{ 
          borderRadius: 12, 
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
          border: 'none'
        }}
      >
        <Tabs 
          defaultActiveKey="components" 
          type="card"
          size="large"
          items={tabItems}
          style={{ marginTop: 8 }}
        />
      </Card>
    </div>
  );
}
