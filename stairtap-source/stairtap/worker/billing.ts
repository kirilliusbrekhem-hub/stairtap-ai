import type { Env } from "./types";
import type { UserRow } from "./db";
import { PRODUCTS, isProductId, type ProductId } from "../lib/plans";
import { err, hmac, json, readJson, safeEqual } from "./util";

const GRACE_MS = 2 * 86400000;

const variantEnv: Record<ProductId, keyof Env> = {
  pro_month: "LEMON_VARIANT_PRO_MONTH", pro_year: "LEMON_VARIANT_PRO_YEAR",
  ultra_month: "LEMON_VARIANT_ULTRA_MONTH", ultra_year: "LEMON_VARIANT_ULTRA_YEAR",
  pack_50: "LEMON_VARIANT_PACK_50", pack_200: "LEMON_VARIANT_PACK_200",
};

function variantFor(env: Env, id: ProductId): string { return String(env[variantEnv[id]] ?? ""); }
function productByVariant(env: Env, variantId: string): ProductId | null {
  for (const id of Object.keys(variantEnv) as ProductId[]) if (variantFor(env, id) && variantFor(env, id) === variantId) return id;
  return null;
}

/** Which payment methods are configured (used by the UI to show or hide buttons). */
export function methods(env: Env) {
  return {
    card: !!(env.LEMON_API_KEY && env.LEMON_STORE_ID),
    crypto: !!(env.NOWPAYMENTS_API_KEY && env.NOWPAYMENTS_IPN_SECRET),
  };
}

function siteUrl(env: Env, request: Request): string {
  return (env.PUBLIC_URL || new URL(request.url).origin).replace(/\/+$/, "");
}

/** POST /api/billing/checkout  { product, method: "card" | "crypto" } */
export async function checkout(env: Env, request: Request, u: UserRow): Promise<Response> {
  const p = await readJson<{ product?: string; method?: string }>(request, 500);
  if (!p || !isProductId(p.product)) return err("bad_product");
  const product = PRODUCTS[p.product];
  const base = siteUrl(env, request);

  if (p.method === "card") {
    const variant = variantFor(env, product.id);
    if (!env.LEMON_API_KEY || !env.LEMON_STORE_ID || !variant) return err("card_not_configured", 503);
    const res = await fetch(`${env.LEMON_API_BASE || "https://api.lemonsqueezy.com"}/v1/checkouts`, {
      method: "POST",
      headers: { accept: "application/vnd.api+json", "content-type": "application/vnd.api+json", authorization: `Bearer ${env.LEMON_API_KEY}` },
      body: JSON.stringify({
        data: {
          type: "checkouts",
          attributes: {
            product_options: { redirect_url: `${base}/pricing/?paid=1` },
            checkout_data: { email: u.email, name: u.name, custom: { user_id: u.id } },
          },
          relationships: {
            store: { data: { type: "stores", id: String(env.LEMON_STORE_ID) } },
            variant: { data: { type: "variants", id: variant } },
          },
        },
      }),
    });
    if (!res.ok) { console.error("lemon checkout", res.status, (await res.text()).slice(0, 300)); return err("provider_error", 502); }
    const d = (await res.json()) as { data?: { attributes?: { url?: string } } };
    const url = d.data?.attributes?.url;
    return url ? json({ url }) : err("provider_error", 502);
  }

  if (p.method === "crypto") {
    if (!env.NOWPAYMENTS_API_KEY || !env.NOWPAYMENTS_IPN_SECRET) return err("crypto_not_configured", 503);
    const orderId = `${u.id}|${product.id}|${crypto.randomUUID().slice(0, 8)}`;
    const res = await fetch(`${env.NOWPAYMENTS_API_BASE || "https://api.nowpayments.io"}/v1/invoice`, {
      method: "POST",
      headers: { "x-api-key": env.NOWPAYMENTS_API_KEY, "content-type": "application/json" },
      body: JSON.stringify({
        price_amount: product.usd, price_currency: "usd", order_id: orderId,
        order_description: `STAIRTAP ${product.id}`,
        ipn_callback_url: `${base}/api/billing/webhook/nowpayments`,
        success_url: `${base}/pricing/?paid=1`, cancel_url: `${base}/pricing/`,
      }),
    });
    if (!res.ok) { console.error("nowpayments invoice", res.status, (await res.text()).slice(0, 300)); return err("provider_error", 502); }
    const d = (await res.json()) as { invoice_url?: string };
    return d.invoice_url ? json({ url: d.invoice_url }) : err("provider_error", 502);
  }
  return err("bad_method");
}

/** Grant a purchased product. Idempotent per (provider, ref). */
async function grant(env: Env, provider: string, ref: string, userId: string, id: ProductId): Promise<boolean> {
  const ins = await env.DB.prepare("INSERT OR IGNORE INTO payments (provider, ref, user_id, product, created_at) VALUES (?, ?, ?, ?, ?)")
    .bind(provider, ref, userId, id, Date.now()).run();
  if (ins.meta.changes === 0) return false; // already processed
  const product = PRODUCTS[id];
  if (product.kind === "pack") {
    await env.DB.prepare("UPDATE users SET bonus = bonus + ? WHERE id = ?").bind(product.gens!, userId).run();
  } else {
    const u = await env.DB.prepare("SELECT plan_until FROM users WHERE id = ?").bind(userId).first<{ plan_until: number }>();
    const from = Math.max(Date.now(), u?.plan_until ?? 0);
    await env.DB.prepare("UPDATE users SET plan = ?, plan_until = ? WHERE id = ?").bind(product.plan!, from + product.days! * 86400000, userId).run();
  }
  return true;
}

/* ---------------- Lemon Squeezy ---------------- */

interface LemonEvent {
  meta?: { event_name?: string; custom_data?: { user_id?: string } };
  data?: { id?: string; attributes?: Record<string, unknown> };
}

export async function lemonWebhook(env: Env, request: Request): Promise<Response> {
  if (!env.LEMON_WEBHOOK_SECRET) return err("not_configured", 503);
  const raw = await request.text();
  const sig = request.headers.get("x-signature") || "";
  if (!safeEqual(await hmac("SHA-256", env.LEMON_WEBHOOK_SECRET, raw), sig)) return err("bad_signature", 401);

  let ev: LemonEvent;
  try { ev = JSON.parse(raw) as LemonEvent; } catch { return err("bad_json"); }
  const name = ev.meta?.event_name ?? "";
  const userId = ev.meta?.custom_data?.user_id;
  const a = (ev.data?.attributes ?? {}) as Record<string, unknown>;
  if (!userId) return json({ ok: true, ignored: "no_user" });
  const exists = await env.DB.prepare("SELECT 1 FROM users WHERE id = ?").bind(userId).first();
  if (!exists) return json({ ok: true, ignored: "unknown_user" });

  const variantId = String(a.variant_id ?? (a.first_order_item as { variant_id?: unknown } | undefined)?.variant_id ?? "");
  const pid = productByVariant(env, variantId);

  // One-time credit packs
  if (name === "order_created" && pid && PRODUCTS[pid].kind === "pack" && a.status === "paid") {
    await grant(env, "lemon", `order:${ev.data?.id}`, userId, pid);
    return json({ ok: true });
  }

  // Subscriptions: keep plan and paid-until in sync with the provider's state
  if (name.startsWith("subscription_") && !name.startsWith("subscription_payment_") && pid && PRODUCTS[pid].kind === "plan") {
    const status = String(a.status ?? "");
    const renews = a.renews_at ? Date.parse(String(a.renews_at)) : 0;
    const ends = a.ends_at ? Date.parse(String(a.ends_at)) : 0;
    const portal = String((a.urls as { customer_portal?: string } | undefined)?.customer_portal ?? "");
    let until = 0;
    if (status === "active" || status === "on_trial") until = renews + GRACE_MS;
    else if (status === "cancelled") until = ends || Date.now(); // paid period still valid until ends_at
    else if (status === "past_due" || status === "unpaid") until = (renews || Date.now()) + GRACE_MS;
    // expired / paused -> until stays 0 -> free
    await env.DB.prepare("UPDATE users SET plan = ?, plan_until = ?, portal_url = CASE WHEN ? <> '' THEN ? ELSE portal_url END WHERE id = ?")
      .bind(PRODUCTS[pid].plan!, until, portal, portal, userId).run();
    return json({ ok: true });
  }
  return json({ ok: true, ignored: name });
}

/* ---------------- NOWPayments ---------------- */

function sortKeys(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v && typeof v === "object") {
    return Object.fromEntries(Object.keys(v as object).sort().map((k) => [k, sortKeys((v as Record<string, unknown>)[k])]));
  }
  return v;
}

export async function nowpaymentsWebhook(env: Env, request: Request): Promise<Response> {
  if (!env.NOWPAYMENTS_IPN_SECRET) return err("not_configured", 503);
  const raw = await request.text();
  let body: Record<string, unknown>;
  try { body = JSON.parse(raw) as Record<string, unknown>; } catch { return err("bad_json"); }
  const sig = request.headers.get("x-nowpayments-sig") || "";
  const expect = await hmac("SHA-512", env.NOWPAYMENTS_IPN_SECRET, JSON.stringify(sortKeys(body)));
  if (!safeEqual(expect, sig)) return err("bad_signature", 401);

  if (body.payment_status !== "finished") return json({ ok: true, waiting: String(body.payment_status) });
  const [userId, product] = String(body.order_id ?? "").split("|");
  if (!userId || !isProductId(product)) return json({ ok: true, ignored: "bad_order" });
  const exists = await env.DB.prepare("SELECT 1 FROM users WHERE id = ?").bind(userId).first();
  if (!exists) return json({ ok: true, ignored: "unknown_user" });
  // never grant for less than the product price (guards against tampered invoices)
  if (Number(body.price_amount) < PRODUCTS[product].usd) return json({ ok: true, ignored: "underpaid" });
  await grant(env, "nowpayments", String(body.payment_id ?? body.order_id), userId, product);
  return json({ ok: true });
}
