import React, { useEffect, useRef, useState } from 'react';
import { Modal, Button, Spin, Alert, message } from 'antd';
import { PrinterOutlined, ReloadOutlined, DownloadOutlined, CloseOutlined } from '@ant-design/icons';
import { generateInvoiceDocument } from '../services/feesService';

/**
 * Premium invoice/receipt viewer.
 * Server returns canonical HTML with totals — we just render and offer print.
 */
export default function InvoiceDocumentViewer({ open, invoiceId, onClose }) {
  const [loading, setLoading] = useState(false);
  const [doc, setDoc] = useState(null);
  const [error, setError] = useState(null);
  const iframeRef = useRef(null);

  const load = async (forceRegenerate = false) => {
    if (!invoiceId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await generateInvoiceDocument(invoiceId, forceRegenerate);
      setDoc(data);
    } catch (err) {
      setError(err?.message || 'Failed to generate document');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && invoiceId) load(false);
    if (!open) setDoc(null);
  }, [open, invoiceId]);

  const handlePrint = () => {
    try {
      iframeRef.current?.contentWindow?.focus();
      iframeRef.current?.contentWindow?.print();
    } catch {
      message.error('Could not open print dialog');
    }
  };

  const handleDownload = () => {
    if (!doc?.html_content) return;
    const blob = new Blob([doc.html_content], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${doc.invoice_number || invoiceId}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      width="min(1180px, calc(100vw - 48px))"
      footer={null}
      closable={false}
      destroyOnClose
      styles={{
        body: { padding: 0 },
        content: { padding: 0, overflow: 'hidden', borderRadius: 16 },
      }}
    >
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '14px 20px',
        borderBottom: '1px solid #e2e8f0',
        background: '#fff',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 15, fontWeight: 600, color: '#0f172a' }}>
            {doc?.server_computed?.status === 'PAID' ? 'Receipt' : 'Invoice'}
          </span>
          {doc?.invoice_number && (
            <span style={{
              fontSize: 12,
              color: '#64748b',
              fontFamily: 'JetBrains Mono, ui-monospace, monospace',
              background: '#f1f5f9',
              padding: '3px 8px',
              borderRadius: 6,
            }}>
              {doc.invoice_number}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button size="small" icon={<ReloadOutlined />} onClick={() => load(true)} loading={loading}>
            Regenerate
          </Button>
          <Button size="small" icon={<DownloadOutlined />} onClick={handleDownload} disabled={!doc}>
            Download
          </Button>
          <Button size="small" type="primary" icon={<PrinterOutlined />} onClick={handlePrint} disabled={!doc}>
            Print / PDF
          </Button>
          <Button size="small" type="text" icon={<CloseOutlined />} onClick={onClose} />
        </div>
      </div>

      {error && (
        <div style={{ padding: 16 }}>
          <Alert type="error" showIcon message="Could not generate document" description={error} />
        </div>
      )}

      {loading ? (
        <div style={{ padding: 80, textAlign: 'center', background: '#f8fafc', minHeight: 500 }}>
          <Spin size="large" />
          <div style={{ marginTop: 16, color: '#64748b', fontSize: 13 }}>Generating document…</div>
        </div>
      ) : doc ? (
        <iframe
          ref={iframeRef}
          srcDoc={doc.html_content}
          title="Invoice document"
          style={{ width: '100%', height: '78vh', border: 'none', background: '#f8fafc', display: 'block' }}
        />
      ) : null}
    </Modal>
  );
}
