export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;

  // --- AI (Gemini) ---
  GEMINI_API_KEY?: string;
  /** Optional Cloudflare AI Gateway base, e.g. https://gateway.ai.cloudflare.com/v1/<account>/<gateway>/google-ai-studio */
  AI_GATEWAY_URL?: string;
  CF_AIG_TOKEN?: string;
  GEMINI_API_BASE?: string;
  GEMINI_MODEL_FAST?: string;
  GEMINI_MODEL_PRO?: string;

  // --- Card payments: Lemon Squeezy ---
  LEMON_API_KEY?: string;
  LEMON_STORE_ID?: string;
  LEMON_WEBHOOK_SECRET?: string;
  LEMON_VARIANT_PRO_MONTH?: string;
  LEMON_VARIANT_PRO_YEAR?: string;
  LEMON_VARIANT_ULTRA_MONTH?: string;
  LEMON_VARIANT_ULTRA_YEAR?: string;
  LEMON_VARIANT_PACK_50?: string;
  LEMON_VARIANT_PACK_200?: string;
  LEMON_API_BASE?: string;

  // --- Crypto payments: NOWPayments ---
  NOWPAYMENTS_API_KEY?: string;
  NOWPAYMENTS_IPN_SECRET?: string;
  NOWPAYMENTS_API_BASE?: string;

  // --- Password reset email (optional): Resend ---
  RESEND_API_KEY?: string;
  /** e.g. "STAIRTAP <no-reply@your-domain.com>" (domain must be verified in Resend) */
  MAIL_FROM?: string;
  RESEND_API_BASE?: string;

  /** Public site URL used in payment redirects. Defaults to the request origin. */
  PUBLIC_URL?: string;
}
