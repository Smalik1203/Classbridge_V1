import React from 'react';
import { Select, Space, Tag, Tooltip, Switch, Typography } from 'antd';
import { CalendarOutlined, SwapOutlined } from '@ant-design/icons';
import { useAcademicYear } from '../context/AcademicYearContext';

const { Text } = Typography;

/**
 * Top-of-page picker shown on every analytics page.
 *
 *   [📅 Academic Year: 2025-2026 (active) ▾]   [Compare AY: off ▾]
 *
 * Defaults to the school's active AY. Persists the user's selection in
 * localStorage so they don't have to re-pick across navigation.
 */
export default function AcademicYearPicker({ compact = false, showCompare = true }) {
  const {
    loading, years, activeAyId,
    selectedAyId, setSelectedAyId,
    compareAyId, setCompareAyId, clearCompare,
    formatYearLabel,
  } = useAcademicYear();

  if (loading) return <Tag>Loading academic years…</Tag>;
  if (!years || years.length === 0) {
    return <Tag color="orange">No academic years configured</Tag>;
  }

  const options = years.map((y) => ({
    value: y.id,
    label: (
      <Space size={6}>
        <span>{formatYearLabel(y)}</span>
        {y.id === activeAyId && <Tag color="green" style={{ margin: 0 }}>active</Tag>}
      </Space>
    ),
  }));

  const compareOptions = years
    .filter((y) => y.id !== selectedAyId)
    .map((y) => ({ value: y.id, label: formatYearLabel(y) }));

  const compareEnabled = !!compareAyId;

  return (
    <Space size={compact ? 8 : 16} wrap>
      <Space size={6}>
        <CalendarOutlined />
        <Text strong>Academic Year:</Text>
        <Select
          size={compact ? 'small' : 'middle'}
          style={{ minWidth: 180 }}
          value={selectedAyId}
          options={options}
          onChange={setSelectedAyId}
        />
      </Space>

      {showCompare && (
        <Space size={6}>
          <SwapOutlined />
          <Text type="secondary">Compare with:</Text>
          <Switch
            size="small"
            checked={compareEnabled}
            onChange={(checked) => {
              if (!checked) { clearCompare(); return; }
              const firstOther = years.find((y) => y.id !== selectedAyId);
              if (firstOther) setCompareAyId(firstOther.id);
            }}
          />
          {compareEnabled && (
            <Tooltip title="Pick second academic year for side-by-side comparison">
              <Select
                size={compact ? 'small' : 'middle'}
                style={{ minWidth: 140 }}
                value={compareAyId}
                options={compareOptions}
                onChange={setCompareAyId}
                disabled={compareOptions.length === 0}
              />
            </Tooltip>
          )}
        </Space>
      )}
    </Space>
  );
}
