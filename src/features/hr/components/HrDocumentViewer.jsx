import React, { useEffect, useRef, useState } from 'react';
import { Modal, Button, Space, Spin, Result, App, Tooltip } from 'antd';
import {
  PrinterOutlined, DownloadOutlined, ReloadOutlined, FilePdfOutlined, FileTextOutlined,
} from '@ant-design/icons';
import { hrService } from '../services/hrService';

const DOC_TITLES = {
  payslip: 'Payslip',
  appointment_letter: 'Appointment Letter',
  experience_letter: 'Experience Letter',
  relieving_letter: 'Relieving Letter',
};

/**
 * Renders HR documents (payslip, letters) in-app via the `generate-hr-document` Edge Function.
 * Mobile uses a WebView with print/share/download. Web equivalent: iframe + window.print + Blob download.
 */
export default function HrDocumentViewer({ open, onClose, docType, employeeId, payslipId, employeeName }) {
  const [loading, setLoading] = useState(false);
  const [html, setHtml] = useState('');
  const [error, setError] = useState(null);
  const [meta, setMeta] = useState(null);
  const iframeRef = useRef(null);
  const { message } = App.useApp();

  const load = async () => {
    if (!docType || !employeeId) return;
    try {
      setLoading(true);
      setError(null);
      const res = await hrService.generateDocument(docType, employeeId, payslipId);
      setHtml(res.html_content);
      setMeta(res.meta || null);
    } catch (e) {
      setError(e.message || 'Failed to generate document');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) load();
    else { setHtml(''); setError(null); setMeta(null); }
    // eslint-disable-next-line
  }, [open, docType, employeeId, payslipId]);

  const handlePrint = () => {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) {
      message.warning('Document not ready yet');
      return;
    }
    try {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    } catch (e) {
      message.error('Print failed: ' + (e.message || 'unknown'));
    }
  };

  const handleDownloadHtml = () => {
    if (!html) return;
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safeName = (employeeName || 'employee').replace(/[^a-z0-9]+/gi, '_').toLowerCase();
    a.href = url;
    a.download = `${safeName}_${docType}_${new Date().toISOString().slice(0, 10)}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadPdf = () => {
    // Browser-driven PDF: open print dialog with "Save as PDF" hint
    handlePrint();
    message.info('Use "Save as PDF" in the print dialog to save a PDF');
  };

  const title = DOC_TITLES[docType] || 'Document';

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title={`${title}${employeeName ? ` · ${employeeName}` : ''}`}
      width="min(960px, 95vw)"
      style={{ top: 24 }}
      bodyStyle={{ padding: 0, height: '78vh', display: 'flex', flexDirection: 'column' }}
      footer={
        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          <Space size={4}>
            {meta?.generated_at && (
              <span style={{ color: '#9CA3AF', fontSize: 12 }}>
                Generated: {new Date(meta.generated_at || Date.now()).toLocaleString()}
              </span>
            )}
          </Space>
          <Space>
            <Tooltip title="Reload">
              <Button icon={<ReloadOutlined />} onClick={load} loading={loading} />
            </Tooltip>
            <Button icon={<FileTextOutlined />} onClick={handleDownloadHtml} disabled={!html || loading}>
              Download HTML
            </Button>
            <Button icon={<FilePdfOutlined />} onClick={handleDownloadPdf} disabled={!html || loading}>
              Save as PDF
            </Button>
            <Button type="primary" icon={<PrinterOutlined />} onClick={handlePrint} disabled={!html || loading}>
              Print
            </Button>
          </Space>
        </Space>
      }
      destroyOnClose
    >
      <div style={{ flex: 1, position: 'relative', background: '#f5f5f5' }}>
        {loading && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.8)', zIndex: 2 }}>
            <Spin tip="Generating document..." size="large" />
          </div>
        )}
        {error && !loading && (
          <Result
            status="error"
            title="Couldn't generate document"
            subTitle={error}
            extra={<Button type="primary" onClick={load}>Try again</Button>}
          />
        )}
        {html && !error && (
          <iframe
            ref={iframeRef}
            title={title}
            srcDoc={html}
            sandbox="allow-same-origin allow-modals allow-popups allow-forms"
            style={{ width: '100%', height: '100%', border: 'none', background: '#fff' }}
          />
        )}
      </div>
    </Modal>
  );
}
