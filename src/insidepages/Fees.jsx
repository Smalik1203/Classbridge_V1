import React from "react";
import { Tabs } from "antd";
import { useAuth } from "../AuthProvider";
import { getUserRole } from "../utils/metadata";
import FeeComponents from "../components/FeeComponents";
import FeeManage from "../components/FeeManage";
import FeeCollections from "../components/FeeCollections";
import FeeAnalytics from "../components/FeeAnalytics";
import StudentFees from "../components/StudentFees";
import SchoolCodeDebugger from "../components/SchoolCodeDebugger";

const { TabPane } = Tabs;

export default function Fees() {
  const { user } = useAuth();
  const role = getUserRole(user);

  // If user is a student, show student-specific fee view
  if (role === 'student') {
    return <StudentFees />;
  }

  // For admins and superadmins, show the full management interface
  return (
    <div style={{ padding: "24px" }}>
      <Tabs defaultActiveKey="components" type="card">
        <TabPane tab="Components" key="components">
          <FeeComponents />
        </TabPane>
        <TabPane tab="Manage" key="manage">
          <FeeManage />
        </TabPane>
        <TabPane tab="Collections" key="collections">
          <FeeCollections />
        </TabPane>
        <TabPane tab="Analytics" key="analytics">
          <FeeAnalytics />
        </TabPane>
        <TabPane tab="Debug School Code" key="debug">
          <SchoolCodeDebugger />
        </TabPane>
      </Tabs>
    </div>
  );
}
