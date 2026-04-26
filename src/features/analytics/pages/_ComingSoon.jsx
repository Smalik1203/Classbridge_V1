import React from 'react';
import { Tag } from 'antd';
import { useAcademicYear } from '../context/AcademicYearContext';
import { HeroStat, SectionCard } from '../components/primitives';

export default function ComingSoon({ feature, gradient = 'midnight' }) {
  const { selectedYear, formatYearLabel } = useAcademicYear();
  return (
    <SectionCard padded={false}>
      <HeroStat
        gradient={gradient}
        eyebrow={selectedYear ? `AY ${formatYearLabel(selectedYear)}` : 'Coming up'}
        value={feature}
        label="This report is being built next. The data layer is wired — visualisations are on the way."
        height={220}
      />
    </SectionCard>
  );
}
