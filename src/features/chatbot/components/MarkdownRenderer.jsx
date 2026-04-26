// Lightweight markdown renderer tailored to LLM chat output.
// Mirrors mobile's MessageBubble parser (headings, paragraphs, bullet/numbered
// lists, tables, dividers, inline bold/italic/code/links) and adds fenced code
// blocks — which mobile renders as plain text but web can show with monospace
// formatting and a copy button.
//
// Intentionally NOT a general-purpose markdown engine — chat output is the
// only consumer, so the parser is pragmatic over rigorous.
import React, { useMemo, useState } from 'react';
import { Button, Tooltip, App } from 'antd';
import { CopyOutlined, CheckOutlined } from '@ant-design/icons';

// ───────── inline parser ─────────
// Handles: **bold**, *italic*, `code`, [text](url)
function parseInline(text, keyPrefix = '') {
  if (!text) return null;
  const out = [];
  let buf = '';
  let i = 0;
  let key = 0;
  const flush = () => {
    if (buf) {
      out.push(<React.Fragment key={`${keyPrefix}t${key++}`}>{buf}</React.Fragment>);
      buf = '';
    }
  };

  while (i < text.length) {
    const ch = text[i];
    const next = text[i + 1];

    // ** bold **
    if (ch === '*' && next === '*') {
      const end = text.indexOf('**', i + 2);
      if (end > -1) {
        flush();
        out.push(
          <strong key={`${keyPrefix}b${key++}`}>
            {parseInline(text.slice(i + 2, end), `${keyPrefix}b${key}-`)}
          </strong>,
        );
        i = end + 2;
        continue;
      }
    }
    // * italic *  (single, not ** ); skip if next char is space
    if (ch === '*' && next !== '*' && next !== ' ') {
      const end = text.indexOf('*', i + 1);
      if (end > -1 && text[end - 1] !== ' ') {
        flush();
        out.push(
          <em key={`${keyPrefix}i${key++}`}>
            {parseInline(text.slice(i + 1, end), `${keyPrefix}i${key}-`)}
          </em>,
        );
        i = end + 1;
        continue;
      }
    }
    // `code`
    if (ch === '`') {
      const end = text.indexOf('`', i + 1);
      if (end > -1) {
        flush();
        out.push(
          <code
            key={`${keyPrefix}c${key++}`}
            style={{
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              fontSize: '0.9em',
              background: 'rgba(99,102,241,0.1)',
              color: '#4338ca',
              padding: '1px 6px',
              borderRadius: 4,
              border: '1px solid rgba(99,102,241,0.18)',
            }}
          >
            {text.slice(i + 1, end)}
          </code>,
        );
        i = end + 1;
        continue;
      }
    }
    // [text](url)
    if (ch === '[') {
      const close = text.indexOf(']', i + 1);
      if (close > -1 && text[close + 1] === '(') {
        const urlEnd = text.indexOf(')', close + 2);
        if (urlEnd > -1) {
          flush();
          const label = text.slice(i + 1, close);
          const href = text.slice(close + 2, urlEnd);
          out.push(
            <a
              key={`${keyPrefix}l${key++}`}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: '#6366F1', textDecoration: 'underline' }}
            >
              {label}
            </a>,
          );
          i = urlEnd + 1;
          continue;
        }
      }
    }
    buf += ch;
    i++;
  }
  flush();
  return out;
}

// ───────── block parser ─────────
function parseBlocks(src) {
  const lines = src.replace(/\r\n/g, '\n').split('\n');
  const blocks = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // fenced code block ```lang
    if (trimmed.startsWith('```')) {
      const lang = trimmed.slice(3).trim();
      const buf = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        buf.push(lines[i]);
        i++;
      }
      i++; // skip closing fence
      blocks.push({ type: 'code', lang, content: buf.join('\n') });
      continue;
    }

    // blank line — separator
    if (!trimmed) { i++; continue; }

    // divider
    if (/^(\*\*\*|---|___)$/.test(trimmed)) {
      blocks.push({ type: 'divider' });
      i++;
      continue;
    }

    // heading
    const h = trimmed.match(/^(#{1,4})\s+(.*)$/);
    if (h) {
      blocks.push({ type: 'heading', level: h[1].length, text: h[2] });
      i++;
      continue;
    }

    // table — current line and next look like |...| with --- separator.
    // Be lenient: a trailing pipe is preferred but not required for rows.
    const splitRow = (line) => {
      let s = line.trim();
      if (s.startsWith('|')) s = s.slice(1);
      if (s.endsWith('|')) s = s.slice(0, -1);
      return s.split('|').map((c) => c.trim());
    };
    if (trimmed.startsWith('|') && lines[i + 1]) {
      const sep = lines[i + 1].trim();
      if (/^\|?\s*:?-{2,}/.test(sep) && sep.includes('|')) {
        const header = splitRow(trimmed);
        const rows = [];
        i += 2;
        while (i < lines.length) {
          const r = lines[i].trim();
          if (!r.startsWith('|')) break;
          rows.push(splitRow(r));
          i++;
        }
        blocks.push({ type: 'table', header, rows });
        continue;
      }
    }

    // bullet list
    if (/^([-*•])\s+/.test(trimmed)) {
      const items = [];
      while (i < lines.length && /^([-*•])\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^([-*•])\s+/, ''));
        i++;
      }
      blocks.push({ type: 'ul', items });
      continue;
    }

    // numbered list
    if (/^\d+[.)]\s+/.test(trimmed)) {
      const items = [];
      while (i < lines.length && /^\d+[.)]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+[.)]\s+/, ''));
        i++;
      }
      blocks.push({ type: 'ol', items });
      continue;
    }

    // paragraph: gather until blank line / new block-marker
    const paraBuf = [];
    while (i < lines.length) {
      const l = lines[i];
      const lt = l.trim();
      if (!lt) break;
      if (/^(#{1,4})\s/.test(lt)) break;
      if (lt.startsWith('```')) break;
      if (lt.startsWith('|') && lt.endsWith('|')) break;
      if (/^([-*•])\s+/.test(lt)) break;
      if (/^\d+[.)]\s+/.test(lt)) break;
      if (/^(\*\*\*|---|___)$/.test(lt)) break;
      paraBuf.push(l);
      i++;
    }
    blocks.push({ type: 'p', text: paraBuf.join(' ').trim() });
  }
  return blocks;
}

// ───────── code block with copy button ─────────
function CodeBlock({ lang, content }) {
  const [copied, setCopied] = useState(false);
  const { message } = App.useApp();

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      message.error('Copy failed');
    }
  };

  return (
    <div
      style={{
        position: 'relative',
        margin: '8px 0',
        borderRadius: 8,
        border: '1px solid rgba(99,102,241,0.25)',
        background: '#0f172a',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '4px 10px',
          background: 'rgba(99,102,241,0.18)',
          color: '#cbd5e1',
          fontSize: 11,
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          textTransform: 'lowercase',
        }}
      >
        <span>{lang || 'text'}</span>
        <Tooltip title={copied ? 'Copied' : 'Copy code'}>
          <Button
            size="small"
            type="text"
            icon={copied ? <CheckOutlined style={{ color: '#22c55e' }} /> : <CopyOutlined style={{ color: '#cbd5e1' }} />}
            onClick={onCopy}
            style={{ height: 22 }}
          />
        </Tooltip>
      </div>
      <pre
        style={{
          margin: 0,
          padding: '10px 12px',
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          fontSize: 13,
          color: '#e2e8f0',
          background: 'transparent',
          overflowX: 'auto',
          whiteSpace: 'pre',
        }}
      >
        {content}
      </pre>
    </div>
  );
}

// ───────── main renderer ─────────
export default function MarkdownRenderer({ text, isDarkMode = false }) {
  const blocks = useMemo(() => parseBlocks(text || ''), [text]);
  const colors = isDarkMode
    ? { text: '#e2e8f0', muted: '#94a3b8', border: '#334155', headerBg: 'rgba(99,102,241,0.18)' }
    : { text: '#0f172a', muted: '#475569', border: '#e2e8f0', headerBg: 'rgba(99,102,241,0.08)' };

  return (
    <div style={{ color: colors.text, fontSize: 14, lineHeight: 1.6, wordBreak: 'break-word' }}>
      {blocks.map((b, idx) => {
        switch (b.type) {
          case 'heading': {
            const sizes = { 1: 22, 2: 19, 3: 17, 4: 15 };
            return (
              <div
                key={idx}
                style={{
                  fontSize: sizes[b.level] ?? 15,
                  fontWeight: 700,
                  margin: idx === 0 ? '0 0 8px' : '14px 0 6px',
                  color: colors.text,
                }}
              >
                {parseInline(b.text, `h${idx}-`)}
              </div>
            );
          }
          case 'p':
            return (
              <p key={idx} style={{ margin: '4px 0 8px', whiteSpace: 'pre-wrap' }}>
                {parseInline(b.text, `p${idx}-`)}
              </p>
            );
          case 'ul':
            return (
              <ul key={idx} style={{ margin: '4px 0 8px', paddingLeft: 22 }}>
                {b.items.map((it, j) => (
                  <li key={j} style={{ margin: '2px 0' }}>
                    {parseInline(it, `ul${idx}-${j}-`)}
                  </li>
                ))}
              </ul>
            );
          case 'ol':
            return (
              <ol key={idx} style={{ margin: '4px 0 8px', paddingLeft: 22 }}>
                {b.items.map((it, j) => (
                  <li key={j} style={{ margin: '2px 0' }}>
                    {parseInline(it, `ol${idx}-${j}-`)}
                  </li>
                ))}
              </ol>
            );
          case 'divider':
            return <hr key={idx} style={{ border: 'none', borderTop: `1px solid ${colors.border}`, margin: '12px 0' }} />;
          case 'code':
            return <CodeBlock key={idx} lang={b.lang} content={b.content} />;
          case 'table':
            return (
              <div
                key={idx}
                style={{
                  margin: '8px 0',
                  overflowX: 'auto',
                  border: `1px solid ${colors.border}`,
                  borderRadius: 8,
                }}
              >
                <table style={{ borderCollapse: 'collapse', minWidth: '100%', fontSize: 13 }}>
                  <thead>
                    <tr>
                      {b.header.map((h, j) => (
                        <th
                          key={j}
                          style={{
                            background: colors.headerBg,
                            color: colors.text,
                            padding: '8px 10px',
                            textAlign: 'left',
                            borderBottom: `1px solid ${colors.border}`,
                            fontWeight: 600,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {parseInline(h, `th${idx}-${j}-`)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {b.rows.map((row, ri) => (
                      <tr key={ri} style={{ background: ri % 2 === 0 ? 'transparent' : (isDarkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)') }}>
                        {row.map((cell, ci) => {
                          const isNumeric = /^[₹$€£]?\s*[\d,.]+%?$/.test(cell.trim());
                          return (
                            <td
                              key={ci}
                              style={{
                                padding: '8px 10px',
                                borderBottom: `1px solid ${colors.border}`,
                                textAlign: isNumeric ? 'right' : 'left',
                                fontVariantNumeric: isNumeric ? 'tabular-nums' : 'normal',
                              }}
                            >
                              {parseInline(cell, `td${idx}-${ri}-${ci}-`)}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          default:
            return null;
        }
      })}
    </div>
  );
}
