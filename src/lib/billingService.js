// Billing transport + Razorpay Checkout orchestration. Free-beta plans are granted
// straight from /billing/checkout (no payment); priced plans open Razorpay
// Checkout and confirm via /billing/verify.

import { apiFetch } from './apiClient';

const RAZORPAY_SRC = 'https://checkout.razorpay.com/v1/checkout.js';

export function fetchBillingConfig() {
  return apiFetch('/billing/config');
}

export function createCheckout(plan) {
  return apiFetch('/billing/checkout', { method: 'POST', body: { plan } });
}

export function verifyPayment({ orderId, paymentId, signature }) {
  return apiFetch('/billing/verify', { method: 'POST', body: { orderId, paymentId, signature } });
}

let razorpayPromise = null;
function loadRazorpay() {
  if (window.Razorpay) return Promise.resolve(true);
  if (razorpayPromise) return razorpayPromise;
  razorpayPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = RAZORPAY_SRC;
    s.onload = () => resolve(true);
    s.onerror = () => { razorpayPromise = null; reject(new Error('Could not load the payment widget.')); };
    document.body.appendChild(s);
  });
  return razorpayPromise;
}

/**
 * Run the full upgrade for `plan`. Resolves to the granted plan id (e.g. "PLUS").
 * Free-beta returns immediately; a priced plan opens Razorpay Checkout and
 * resolves once the payment is verified server-side. Rejects on cancel/failure.
 */
export async function startUpgrade(plan, user) {
  const res = await createCheckout(plan);
  if (res.granted) return res.plan; // free beta — no payment

  await loadRazorpay();
  return new Promise((resolve, reject) => {
    const rzp = new window.Razorpay({
      key: res.keyId,
      order_id: res.orderId,
      amount: res.amount,
      currency: res.currency,
      name: 'Privoraa',
      description: `${res.plan} plan`,
      prefill: { email: user?.email || '', name: user?.name || '' },
      theme: { color: '#6366f1' },
      handler: async (r) => {
        try {
          const v = await verifyPayment({
            orderId: r.razorpay_order_id,
            paymentId: r.razorpay_payment_id,
            signature: r.razorpay_signature,
          });
          resolve(v.plan);
        } catch (e) {
          reject(e);
        }
      },
      modal: { ondismiss: () => reject(new Error('Payment cancelled.')) },
    });
    rzp.open();
  });
}
