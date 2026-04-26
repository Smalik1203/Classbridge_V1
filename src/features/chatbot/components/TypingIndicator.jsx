// "Thinking…" indicator while waiting for the first content token.
// Replicates mobile's three-dot pulse + phase text + "Still working on it…" hint.
import React from 'react';
import { useTheme } from '@/contexts/ThemeContext';

export default function TypingIndicator({ phase, slowHint }) {
  const { isDarkMode } = useTheme();
  const bg = isDarkMode ? '#1f2937' : '#ffffff';
  const border = isDarkMode ? '#334155' : '#e2e8f0';
  const dotColor = '#6366F1';

  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, margin: '12px 0' }}>
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 16,
          background: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          fontWeight: 700,
          fontSize: 13,
          flexShrink: 0,
        }}
      >
        S
      </div>
      <div
        style={{
          background: bg,
          border: `1px solid ${border}`,
          borderRadius: 14,
          padding: '10px 14px',
          minWidth: 80,
        }}
      >
        <div style={{ display: 'flex', gap: 5, alignItems: 'center', height: 16 }}>
          {[0, 1, 2].map((d) => (
            <span
              key={d}
              style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: dotColor,
                animation: `sage-pulse 1.2s ease-in-out ${d * 0.2}s infinite`,
              }}
            />
          ))}
          {phase && (
            <span style={{ marginLeft: 10, fontSize: 12, color: isDarkMode ? '#94a3b8' : '#64748b' }}>{phase}</span>
          )}
        </div>
        {slowHint && (
          <div style={{ marginTop: 6, fontSize: 11, color: isDarkMode ? '#94a3b8' : '#94a3b8', fontStyle: 'italic' }}>
            Still working on it…
          </div>
        )}
        <style>{`
          @keyframes sage-pulse {
            0%, 100% { transform: scale(1); opacity: 0.4; }
            50% { transform: scale(1.4); opacity: 1; }
          }
        `}</style>
      </div>
    </div>
  );
}
