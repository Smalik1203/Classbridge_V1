import React, { useState, useEffect } from 'react';
import { Table, Input, InputNumber, Select, Button } from 'antd';

const { Option } = Select;

const MarksEditableTable = ({ 
  students = [], 
  marks = [], 
  maxMarks, 
  onMarksChange,
  onSave 
}) => {
  const [localMarks, setLocalMarks] = useState(marks);

  // Update local marks when props change (e.g., after CSV upload)
  useEffect(() => {
    setLocalMarks(marks);
  }, [marks]);

  const handleFieldChange = (studentId, field, value) => {
    console.log('🔧 MarksEditableTable: Field changed', { studentId, field, value });
    
    const updatedMarks = [...localMarks];
    const existingIndex = updatedMarks.findIndex(mark => mark.student_id === studentId);
    
    if (existingIndex >= 0) {
      updatedMarks[existingIndex] = { ...updatedMarks[existingIndex], [field]: value };
    } else {
      updatedMarks.push({
        student_id: studentId,
        marks_obtained: null,
        max_marks: maxMarks,
        remarks: '',
        [field]: value
      });
    }
    
    console.log('📊 MarksEditableTable: Updated marks', updatedMarks);
    setLocalMarks(updatedMarks);
    
    // Immediately notify parent component of changes
    const dirtyRows = new Set();
    const errorRows = new Set();
    onMarksChange(updatedMarks, dirtyRows, errorRows);
  };

  const getMarkForStudent = (studentId) => {
    return localMarks.find(mark => mark.student_id === studentId) || {};
  };

  const handleSave = async () => {
    console.log('🚀 MarksEditableTable: Save clicked');
    console.log('📊 MarksEditableTable: Current local marks', localMarks);
    
    // First update the parent with current marks
    const dirtyRows = new Set();
    const errorRows = new Set();
    onMarksChange(localMarks, dirtyRows, errorRows);
    
    console.log('📤 MarksEditableTable: Notified parent of changes');
    
    // Then save to Supabase
    if (onSave) {
      console.log('🚀 MarksEditableTable: Calling parent onSave');
      await onSave();
      console.log('✅ MarksEditableTable: Parent onSave completed');
    }
  };

  const columns = [
    {
      title: 'Student',
      dataIndex: 'full_name',
      key: 'student_name',
      render: (text, record) => (
        <div>
          <div>{text}</div>
          <div style={{ fontSize: '12px', color: '#666' }}>{record.student_code}</div>
        </div>
      ),
    },
    {
      title: 'Marks',
      key: 'marks',
      render: (_, record) => {
        const mark = getMarkForStudent(record.id);
        return (
          <InputNumber
            value={mark.marks_obtained}
            onChange={(val) => handleFieldChange(record.id, 'marks_obtained', val)}
            style={{ width: '100%' }}
            placeholder="Marks"
          />
        );
      },
    },
    {
      title: 'Absent',
      key: 'absent',
      render: (_, record) => {
        const mark = getMarkForStudent(record.id);
        const isAbsent = mark.remarks === 'Absent';
        return (
          <Select
            value={isAbsent ? 'absent' : 'present'}
            onChange={(value) => {
              if (value === 'absent') {
                handleFieldChange(record.id, 'marks_obtained', null);
                handleFieldChange(record.id, 'remarks', 'Absent');
              } else {
                handleFieldChange(record.id, 'remarks', '');
              }
            }}
            style={{ width: '100%' }}
          >
            <Option value="present">Present</Option>
            <Option value="absent">Absent</Option>
          </Select>
        );
      },
    },
    {
      title: 'Remarks',
      key: 'remarks',
      render: (_, record) => {
        const mark = getMarkForStudent(record.id);
        return (
          <Input
            value={mark.remarks}
            onChange={(e) => handleFieldChange(record.id, 'remarks', e.target.value)}
            placeholder="Remarks"
          />
        );
      },
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16, textAlign: 'right' }}>
        <Button type="primary" onClick={handleSave}>
          Save All Changes
        </Button>
      </div>
      <Table
        columns={columns}
        dataSource={students}
        rowKey="id"
        pagination={{ pageSize: 25 }}
        size="small"
      />
    </div>
  );
};

export default MarksEditableTable;