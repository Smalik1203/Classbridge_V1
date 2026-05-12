import React, { useEffect, useRef, useState } from 'react';
import { Modal, Button, Spin, Alert, Select, Popconfirm, Tooltip, message } from 'antd';
import { PrinterOutlined, ReloadOutlined, DownloadOutlined, CloseOutlined, WhatsAppOutlined } from '@ant-design/icons';
import { generateInvoiceDocument, downloadInvoicePdf, sendInvoiceViaWhatsApp } from '../services/feesService';
import { supabase } from '@/config/supabaseClient';

// Premium invoice/receipt viewer — server returns canonical HTML with totals;
// this component renders it and exposes Print / Download / WhatsApp actions.
export default function InvoiceDocumentViewer({ open, invoiceId, onClose }) {
  const [loading, setLoading] = useState(false);
  const [doc, setDoc] = useState(null);
  const [error, setError] = useState(null);
  const [copies, setCopies] = useState(1);
  // Paper size — 'a4' (default, works on every school printer with content
  // on top half of A4 + tear guide) or 'a5' (edge-to-edge, advanced setup).
  const [paperSize, setPaperSize] = useState('a4');
  const [downloading, setDownloading] = useState(false);
  // Parent phone is fetched separately from the HTML render — the receipt
  // doesn't include phone in the visible doc, so we look it up to gate the
  // WhatsApp button. null = unknown (still loading), '' = no phone on file.
  const [parentPhone, setParentPhone] = useState(null);
  const [sendingWhatsApp, setSendingWhatsApp] = useState(false);
  const iframeRef = useRef(null);

  const load = async (forceRegenerate = false, opts = {}) => {
    if (!invoiceId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await generateInvoiceDocument(invoiceId, forceRegenerate, {
        copies: opts.copies ?? copies,
        paperSize: opts.paperSize ?? paperSize,
      });
      setDoc(data);
    } catch (err) {
      setError(err?.message || 'Failed to generate document');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && invoiceId) load(false);
    if (!open) {
      setDoc(null);
      setParentPhone(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, invoiceId]);

  // Side-fetch the parent's phone number so we can enable/disable the
  // WhatsApp button + show the recipient in the confirm popover.
  useEffect(() => {
    if (!open || !invoiceId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('fee_invoices')
        .select('student:student_id (parent_phone_e164)')
        .eq('id', invoiceId)
        .single();
      if (!cancelled) {
        setParentPhone(data?.student?.parent_phone_e164 || '');
      }
    })();
    return () => { cancelled = true; };
  }, [open, invoiceId]);

  const handleCopiesChange = (value) => {
    setCopies(value);
    load(true, { copies: value });
  };

  const handlePaperChange = (value) => {
    setPaperSize(value);
    load(true, { paperSize: value });
  };

  const handlePrint = () => {
    try {
      iframeRef.current?.contentWindow?.focus();
      iframeRef.current?.contentWindow?.print();
    } catch {
      message.error('Could not open print dialog');
    }
  };

  const handleDownload = async () => {
    if (!invoiceId) return;
    setDownloading(true);
    try {
      const blob = await downloadInvoicePdf(invoiceId, { copies, paperSize });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${doc?.invoice_number || invoiceId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      message.error(err?.message || 'Could not download PDF');
    } finally {
      setDownloading(false);
    }
  };

  const handleSendWhatsApp = async () => {
    if (!invoiceId) return;
    setSendingWhatsApp(true);
    try {
      const result = await sendInvoiceViaWhatsApp(invoiceId);
      if (result.sent) {
        message.success(`Receipt sent on WhatsApp to ${maskPhone(result.to)}`);
      } else if (result.skipped) {
        // Demo allowlist, killswitch, or opt-out — surfaced as a non-fatal info toast.
        const reason = {
          demo_allowlist: 'Demo mode is on — only allowlisted numbers receive real messages.',
          killswitch: 'WhatsApp sending is disabled for this event.',
          optout: 'The parent has opted out of WhatsApp updates.',
          invalid_phone: 'Parent phone number is invalid.',
        }[result.reason] || `Send was skipped (${result.reason}).`;
        message.warning(reason, 5);
      }
    } catch (err) {
      message.error(err?.message || 'Could not send WhatsApp');
    } finally {
      setSendingWhatsApp(false);
    }
  };

  // E.164 → "+91 90••••35" — what the cashier sees in the confirm popover and
  // success toast. Easier to spot a wrong-number than the full string.
  const maskPhone = (e164) => {
    if (!e164 || e164.length < 6) return e164 || '';
    return `${e164.slice(0, 3)} ${e164.slice(3, 5)}••••${e164.slice(-2)}`;
  };

  // Button state derives from the parent-phone lookup. `null` = still loading
  // (don't enable yet); empty string = lookup completed but no phone on file.
  const phoneLoading = parentPhone === null;
  const hasPhone = !!parentPhone;
  const whatsAppDisabled = !doc || phoneLoading || !hasPhone || sendingWhatsApp;
  const whatsAppTooltip = phoneLoading
    ? 'Checking parent phone…'
    : !hasPhone
      ? 'No parent phone number on file for this student'
      : `Send receipt PDF to ${maskPhone(parentPhone)}`;

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
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Select
            size="small"
            value={paperSize}
            onChange={handlePaperChange}
            disabled={loading}
            style={{ width: 80 }}
            options={[
              { value: 'a4', label: 'A4' },
              { value: 'a5', label: 'A5' },
            ]}
          />
          <Select
            size="small"
            value={copies}
            onChange={handleCopiesChange}
            disabled={loading}
            style={{ width: 130 }}
            options={[
              { value: 1, label: 'Single copy' },
              { value: 2, label: 'Two copies' },
            ]}
          />
          <Button size="small" icon={<ReloadOutlined />} onClick={() => load(true)} loading={loading}>
            Regenerate
          </Button>
          <Button size="small" icon={<DownloadOutlined />} onClick={handleDownload} disabled={!doc || downloading} loading={downloading}>
            Download PDF
          </Button>
          <Tooltip title={whatsAppTooltip}>
            {/* Tooltip wraps Popconfirm so the tooltip still shows when the
                button is disabled (Popconfirm forwards events; Tooltip handles
                disabled state via the span wrapper). */}
            <Popconfirm
              title="Send receipt via WhatsApp?"
              description={hasPhone ? `The PDF will be sent to ${maskPhone(parentPhone)}.` : null}
              okText="Send"
              cancelText="Cancel"
              onConfirm={handleSendWhatsApp}
              disabled={whatsAppDisabled}
              placement="bottomRight"
            >
              <Button
                size="small"
                icon={<WhatsAppOutlined />}
                disabled={whatsAppDisabled}
                loading={sendingWhatsApp}
                style={hasPhone && !whatsAppDisabled ? { background: '#25D366', borderColor: '#25D366', color: '#fff' } : undefined}
              >
                Send via WhatsApp
              </Button>
            </Popconfirm>
          </Tooltip>
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
