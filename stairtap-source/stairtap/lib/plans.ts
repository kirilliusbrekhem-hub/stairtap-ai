/** Plans, limits and prices. Shared by the Worker (enforcement) and the UI (display). Edit here only. */
export type PlanId = "free" | "pro" | "ultra";

/** Generations per calendar month. */
export const PLAN_LIMITS: Record<PlanId, number> = { free: 10, pro: 300, ultra: 1000 };
/** Chat messages per day (chat does not spend generations). */
export const CHAT_DAILY: Record<PlanId, number> = { free: 20, pro: 200, ultra: 500 };
/** Projects a user can keep at the same time. */
export const PROJECT_LIMITS: Record<PlanId, number> = { free: 3, pro: 50, ultra: 200 };
export const PLAN_NAMES: Record<PlanId, string> = { free: "Free", pro: "Pro", ultra: "Founder" };

export type ProductId = "pro_month" | "pro_year" | "ultra_month" | "ultra_year" | "pack_50" | "pack_200";

export interface Product {
  id: ProductId;
  kind: "plan" | "pack";
  plan?: Exclude<PlanId, "free">;
  /** Price in USD charged to the customer (whole period). */
  usd: number;
  /** Subscription period in days (plans) */
  days?: number;
  /** Generations added (packs) */
  gens?: number;
}

export const PRODUCTS: Record<ProductId, Product> = {
  pro_month: { id: "pro_month", kind: "plan", plan: "pro", usd: 29, days: 30 },
  pro_year: { id: "pro_year", kind: "plan", plan: "pro", usd: 276, days: 365 },
  ultra_month: { id: "ultra_month", kind: "plan", plan: "ultra", usd: 99, days: 30 },
  ultra_year: { id: "ultra_year", kind: "plan", plan: "ultra", usd: 948, days: 365 },
  pack_50: { id: "pack_50", kind: "pack", usd: 7, gens: 50 },
  pack_200: { id: "pack_200", kind: "pack", usd: 24, gens: 200 },
};

/** Display-only conversion. Customers are always charged in USD. */
export const RUB_PER_USD = 90;

export const isProductId = (v: unknown): v is ProductId => typeof v === "string" && v in PRODUCTS;
