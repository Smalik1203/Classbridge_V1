import React, { useEffect, useRef, useState } from 'react';
import { Modal, Button, Space, Spin, Alert, message } from 'antd';
import { PrinterOutlined, ReloadOutlined, DownloadOutlined } from '@ant-design/icons';
import { generateInvoiceDocument } from '../services/feesService';

/**
 * Iframe + window.print invoice viewer. Mirrors HrDocumentViewer pattern.
 * Calls Edge Function `generate-invoice-document` for the canonical HTML so
 * totals are server-computed (never trust client-side amounts).
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
      setError(err?.message || 'Failed to generate invoice document');
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
    } catch (err) {
      message.error('Could not open print dialog');
    }
  };

  const handleDownload = () => {
    if (!doc?.html_content) return;
    const blob = new Blob([doc.html_content], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `invoice-${doc.invoice_number || invoiceId}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      width={900}
      footer={null}
      title={
        <Space>
          <span>Invoice document</span>
          {doc?.invoice_number && <span style={{ color: '#888' }}>#{doc.invoice_number}</span>}
        </Space>
      }
      destroyOnClose
    >
      <Space style={{ marginBottom: 12 }} wrap>
        <Button icon={<PrinterOutlined />} type="primary" onClick={handlePrint} disabled={!doc}>
          Print / Save as PDF
        </Button>
        <Button icon={<DownloadOutlined />} onClick={handleDownload} disabled={!doc}>
          Download HTML
        </Button>
        <Button icon={<ReloadOutlined />} onClick={() => load(true)} loading={loading}>
          Regenerate
        </Button>
      </Space>

      {error && (
        <Alert
          type="error"
          showIcon
          message="Could not generate document"
          description={error}
          style={{ marginBottom: 12 }}
        />
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 80 }}>
          <Spin size="large" tip="Generating server-computed invoice..." />
        </div>
      ) : doc ? (
        <iframe
          ref={iframeRef}
          srcDoc={doc.html_content}
          title="Invoice document"
          style={{ width: '100%', height: '70vh', border: '1px solid #eee', background: '#fff' }}
        />
      ) : null}
    </Modal>
  );
}
