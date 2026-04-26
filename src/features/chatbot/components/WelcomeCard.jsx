// Centered greeting + suggestion chips. No grid — chips wrap naturally.
import React from 'react';
import { useTheme } from '@/contexts/ThemeContext';

export default function WelcomeCard({ firstName, suggestions = [], onSelect }) {
  const { isDarkMode } = useTheme();
  const muted = isDarkMode ? '#94a3b8' : '#64748b';
  const text = isDarkMode ? '#e2e8f0' : '#0f172a';
  const chipBg = isDarkMode ? '#1e293b' : '#f8fafc';
  const chipBorder = isDarkMode ? '#334155' : '#e2e8f0';

  return (
    <div
      style={{
        maxWidth: 760,
        margin: '0 auto',
        padding: '64px 20px 32px',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          margin: '0 auto 18px',
          borderRadius: 16,
          background: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          fontSize: 24,
          fontWeight: 700,
          boxShadow: '0 12px 30px rgba(99,102,241,0.25)',
        }}
      >
        S
      </div>
      <div style={{ fontSize: 28, fontWeight: 600, color: text, marginBottom: 8 }}>
        Hi {firstName || 'there'}, I'm Sage
      </div>
      <div style={{ fontSize: 15, color: muted, marginBottom: 32 }}>
        Your school management assistant. Ask me about attendance, fees, performance and more.
      </div>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          gap: 8,
          maxWidth: 640,
          margin: '0 auto',
        }}
      >
        {suggestions.map((s, i) => (
          <button
            key={`${s.label}-${i}`}
            onClick={() => onSelect?.(s)}
            style={{
              border: `1px solid ${chipBorder}`,
              background: chipBg,
              color: text,
              padding: '10px 14px',
              borderRadius: 999,
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'background 0.15s ease, transform 0.05s ease',
              fontFamily: 'inherit',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = isDarkMode ? '#27324a' : '#eef2ff')}
            onMouseLeave={(e) => (e.currentTarget.style.background = chipBg)}
          >
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}
