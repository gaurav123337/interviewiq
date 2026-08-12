/* Minimal typing for the Razorpay checkout.js global (loaded lazily from
   https://checkout.razorpay.com/v1/checkout.js only when the modal opens —
   never bundled). The full options surface is much larger; we declare only
   what the app uses so a typo is caught at compile time. */

interface RazorpaySuccessResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

interface RazorpayCheckoutOptions {
  /** Public key id — returned from the server, never hardcoded. */
  key: string;
  /** Order id from pay-checkout (mode=standard). */
  order_id: string;
  /** Amount in minor units (paise). */
  amount: number;
  currency: string;
  name: string;
  description?: string;
  prefill?: { email?: string; name?: string };
  theme?: { color?: string };
  handler?: (res: RazorpaySuccessResponse) => void;
  modal?: { ondismiss?: () => void };
}

interface RazorpayInstance {
  open: () => void;
  close: () => void;
}

interface Window {
  Razorpay?: new (options: RazorpayCheckoutOptions) => RazorpayInstance;
}
