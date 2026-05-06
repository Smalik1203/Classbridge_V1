import { useEffect, useState } from 'react';
import { Button, Empty, Spin, Space, Alert } from 'antd';
import { DownloadOutlined, ReloadOutlined } from '@ant-design/icons';
import { supabase } from '@/config/supabaseClient';

/**
 * Report Card Preview — single source of truth.
 *
 * Embeds the actual server-rendered PDF (the same one users download) inside
 * an iframe so the preview is always pixel-identical to the print/download
 * output. This replaced an earlier hand-coded JSX preview that had drifted
 * away from the per-school PDF templates (e.g. St. George).
 *
 * Props (kept identical to the previous component so callers don't change):
 *   - data:    { group: { id, kind }, student: { id, full_name }, ... }
 *              Only group.id, group.kind, and student.id are required for
 *              rendering — the rest of the shape is preserved for callers
 *              that may inspect it elsewhere.
 *   - loading: external loading flag (e.g. while parent fetches data context)
 */
export default function ReportCardPreview({ data, loading = false }) {
  const [pdfUrl, setPdfUrl] = useState(null); // blob: URL for the iframe + download
  const [renderError, setRenderError] = useState(null);
  const [rendering, setRendering] = useState(false);

  // Build a friendly download filename from student + report.
  const buildFilename = () => {
    const slug = (s) =>
      String(s || '').trim().replace(/\s+/g, '-').replace(/[^A-Za-z0-9._-]/g, '');
    const parts = [
      slug(data?.student?.full_name) || 'Student',
      slug(data?.group?.name) || 'ReportCard',
      data?.group?.start_date ? data.group.start_date.slice(0, 7) : '',
    ].filter(Boolean);
    return `${parts.join('_')}.pdf`;
  };

  // Fetch the PDF from the pdf-service. Same endpoint and auth pattern as the
  // download button used to use directly. We keep the blob around so:
  //   1. iframe can render it via blob: URL
  //   2. Download button just re-uses the same blob (no second round-trip)
  const renderPdf = async () => {
    setRenderError(null);
    setRendering(true);
    // Revoke any previous blob URL so we don't leak memory if the parent
    // re-renders us with new data.
    if (pdfUrl) {
      URL.revokeObjectURL(pdfUrl);
      setPdfUrl(null);
    }
    try {
      const serviceUrl = import.meta.env.VITE_PDF_SERVICE_URL;
      if (!serviceUrl) throw new Error('VITE_PDF_SERVICE_URL is not configured');
      if (!data?.group?.id || !data?.student?.id) {
        throw new Error('Missing group.id or student.id in report data');
      }
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('Not signed in');

      // Match the field name to the report kind so server-side logs read clean.
      const idField = data.group.kind === 'term_report' ? 'termReportId' : 'examGroupId';
      const res = await fetch(`${serviceUrl.replace(/\/+$/, '')}/render-report-card`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ [idField]: data.group.id, studentId: data.student.id }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `PDF service returned ${res.status}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setPdfUrl(url);
    } catch (err) {
      console.error('Report card render failed:', err);
      setRenderError(err.message || 'Failed to generate report card');
    } finally {
      setRendering(false);
    }
  };

  // Auto-render when the data context becomes ready or changes student/group.
  useEffect(() => {
    if (loading) return;
    if (!data?.group?.id || !data?.student?.id) return;
    renderPdf();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, data?.group?.id, data?.student?.id]);

  // Cleanup the blob URL when this component unmounts.
  useEffect(() => () => {
    if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Trigger a normal browser download for the blob we already have. If we
  // don't have it yet (e.g. the user clicked download mid-render), kick off
  // a render first.
  const triggerDownload = async () => {
    let url = pdfUrl;
    if (!url) {
      await renderPdf();
      url = pdfUrl; // setPdfUrl is async; refresh after the await
    }
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = buildFilename();
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center' }}><Spin /></div>;
  }
  if (!data) return <Empty description="No report card data" />;

  return (
    <div>
      <div style={{ marginBottom: 12, textAlign: 'right' }}>
        <Space>
          <Button
            icon={<ReloadOutlined />}
            onClick={renderPdf}
            disabled={rendering}
          >
            Refresh
          </Button>
          <Button
            type="primary"
            icon={<DownloadOutlined />}
            onClick={triggerDownload}
            loading={rendering}
            disabled={!pdfUrl && !rendering}
          >
            Download PDF
          </Button>
        </Space>
      </div>

      {renderError ? (
        <Alert
          type="error"
          showIcon
          message="Couldn't render report card"
          description={renderError}
          style={{ marginBottom: 12 }}
          action={
            <Button size="small" onClick={renderPdf}>Retry</Button>
          }
        />
      ) : null}

      {/* PDF iframe container. We strip Chrome's PDF viewer chrome (toolbar +
         sidebar) inside the iframe and let the page fill the available space
         on a clean white background — matches the rest of the dialog. */}
      <div
        style={{
          width: '100%',
          height: '80vh',
          minHeight: 600,
          background: '#fff',
          borderRadius: 6,
          overflow: 'hidden',
          border: '1px solid var(--border, #e5e5e5)',
          position: 'relative',
        }}
      >
        {rendering && !pdfUrl ? (
          <div
            style={{
              position: 'absolute', inset: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexDirection: 'column', gap: 12,
            }}
          >
            <Spin size="large" />
            <div style={{ color: '#666', fontSize: 13 }}>
              Generating report card…
            </div>
          </div>
        ) : pdfUrl ? (
          // PDF viewer URL hash params hide Chrome's built-in toolbar +
          // thumbnail sidebar and fit the page to width — gives us a clean
          // page-only preview that matches the rest of the dialog UI.
          // (Firefox honors these too; Safari ignores them but degrades fine.)
          <iframe
            src={`${pdfUrl}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`}
            title="Report Card Preview"
            style={{ width: '100%', height: '100%', border: 0, background: '#fff' }}
          />
        ) : !renderError ? (
          <div
            style={{
              position: 'absolute', inset: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#999', fontSize: 13,
            }}
          >
            Click Refresh to generate the report card.
          </div>
        ) : null}
      </div>
    </div>
  );
}
