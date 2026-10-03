import type { AIModel } from "./types";

export const MODELS: AIModel[] = [
  { id: "auto", name: "Auto", sub: "Fast and balanced" },
  { id: "gemini", name: "Gemini", sub: "Fast · great for building" },
  { id: "geminipro", name: "Gemini Pro", sub: "Advanced reasoning · paid plans" },
];

export const EXAMPLE_IDEAS = [
  "A meal planner that cooks from what is in my fridge",
  "Cash-flow tool for freelancers who invoice abroad",
  "An AI study coach for exam season",
];

export const BUILD_STEPS: [string, string][] = [
  ["Understanding your idea", "Reading intent, audience and constraints"],
  ["Defining the problem", "Framing who is hurting, and how much"],
  ["Researching the opportunity", "Mapping alternatives and demand signals"],
  ["Creating the product blueprint", "Scoping features and the first release"],
  ["Designing the experience", "Choosing brand, layout and flows"],
  ["Writing the plan", "Features, business model, why now"],
  ["Final check", "Making sure the blueprint is coherent"],
];
