import { supabase } from '@/config/supabaseClient';

const CHECKOUT_SRC = 'https://checkout.razorpay.com/v1/checkout.js';

let scriptPromise = null;
function loadCheckoutScript() {
  if (typeof window === 'undefined') return Promise.reject(new Error('No window'));
  if (window.Razorpay) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = CHECKOUT_SRC;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      scriptPromise = null;
      reject(new Error('Failed to load Razorpay checkout script'));
    };
    document.body.appendChild(s);
  });
  return scriptPromise;
}

async function createOrder({ invoiceId, amount }) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const { data, error } = await supabase.functions.invoke('razorpay-create-order', {
    body: { invoice_id: invoiceId, amount },
    headers: { Authorization: `Bearer ${session.access_token}` },
  });
  if (error) {
    let msg = error.message;
    try {
      const body = await error.context?.json?.();
      if (body?.error) msg = body.error;
    } catch { /* ignore */ }
    throw new Error(msg || 'Failed to create order');
  }
  return data;
}

async function verifyPayment(payload) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const { data, error } = await supabase.functions.invoke('razorpay-verify-payment', {
    body: payload,
    headers: { Authorization: `Bearer ${session.access_token}` },
  });
  if (error) {
    let msg = error.message;
    try {
      const body = await error.context?.json?.();
      if (body?.error) msg = body.error;
    } catch { /* ignore */ }
    throw new Error(msg || 'Payment verification failed');
  }
  return data;
}

/**
 * Open Razorpay Checkout for an invoice and resolve once the payment is
 * successfully verified server-side. Rejects on failure or user dismissal.
 */
export async function payInvoiceWithRazorpay({ invoice, amount, prefill = {}, remarks = null }) {
  if (!invoice?.id) throw new Error('Invoice is required');
  if (!(amount > 0)) throw new Error('Amount must be greater than 0');

  await loadCheckoutScript();

  const order = await createOrder({ invoiceId: invoice.id, amount });

  return new Promise((resolve, reject) => {
    const rzp = new window.Razorpay({
      key: order.key_id,
      amount: order.amount,
      currency: order.currency,
      name: 'ClassBridge',
      description: `Fee payment · ${invoice.billing_period || ''}`.trim(),
      order_id: order.order_id,
      prefill: {
        name: prefill.name || invoice.student?.full_name || '',
        email: prefill.email || '',
        contact: prefill.contact || '',
      },
      notes: { invoice_id: invoice.id },
      theme: { color: '#2563eb' },
      handler: async (response) => {
        try {
          const verified = await verifyPayment({
            invoice_id: invoice.id,
            amount,
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
            remarks,
          });
          resolve(verified);
        } catch (err) {
          reject(err);
        }
      },
      modal: {
        ondismiss: () => reject(new Error('Payment cancelled')),
      },
    });

    rzp.on('payment.failed', (resp) => {
      reject(new Error(resp?.error?.description || 'Payment failed'));
    });

    rzp.open();
  });
}

export default { payInvoiceWithRazorpay };
