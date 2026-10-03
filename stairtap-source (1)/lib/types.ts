import type { PlanId } from "./plans";

export type ModelId = "auto" | "gemini" | "geminipro";
export type ProjectStatus = "Draft" | "Building" | "Live";
export type Plan = PlanId;
export type GenerationType = "ideas" | "startups" | "designs" | "copy" | "research" | "other";
export type UsageKind = "startups" | "ideas" | "designs" | "copy";

export interface AIModel {
  id: ModelId;
  name: string;
  sub: string;
}

export interface Startup {
  id: string;
  name: string;
  slug: string;
  type: string;
  industry: string;
  tag: string;
  problem: string;
  audience: string;
  solution: string;
  features: string[];
  biz: string[];
  why: string;
  money: string;
  complexity: "Low" | "Medium" | "High";
  complexityLevel: 1 | 2 | 3;
}

export interface Project {
  id: string;
  sid: string;
  status: ProjectStatus;
  progress: number;
  created_at: number;
  updated_at: number;
  published: number | null;
  public_id: string | null;
}

export interface Generation {
  id: string;
  type: GenerationType;
  title: string;
  project: string;
  model: string;
  sid: string | null;
  created_at: number;
}

export interface Prefs {
  reduceMotion: boolean;
  showCredits: boolean;
  model: ModelId;
}

export interface Credits {
  plan: PlanId;
  limit: number;
  used: Record<UsageKind, number>;
  usedTotal: number;
  bonus: number;
  left: number;
  chatLeft: number;
  planUntil: number;
  hasPortal: boolean;
}

export interface User { id: string; email: string; name: string }

export interface IdeaFilters {
  industry: string;
  audience: string;
  biz: string;
  level: string;
  market: string;
  interests: string[];
}

export interface SiteCheck { id: string; ok: boolean }
