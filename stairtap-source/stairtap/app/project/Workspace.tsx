"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Page } from "@/components/Page";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { SendMark } from "@/components/ui/Logo";
import { Bar, Card, Chip, EmptyState, Label, Tabs } from "@/components/ui/Primitives";
import { ai, api } from "@/lib/api";
import type { SiteCheck, Startup } from "@/lib/types";
import { useStore } from "@/lib/store";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/cn";

type Tab = "overview" | "blueprint" | "site" | "checks" | "analytics" | "assistant";
const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "Overview" }, { id: "blueprint", label: "Blueprint" }, { id: "site", label: "Website" },
  { id: "checks", label: "Checks" }, { id: "analytics", label: "Analytics" }, { id: "assistant", label: "AI Assistant" },
];

interface SiteState { loaded: boolean; html: string; published: boolean; publicId: string; checks: SiteCheck[] }
interface Stats { views: number; signups: number; days: { day: string; n: number }[]; recent: { email: string; ts: number }[] }

const CHECK_LABELS: Record<string, string> = {
  title: "Page has a title", lang: "Language is declared", viewport: "Works on phones (viewport)", description: "Search description is set",
  h1: "Exactly one main heading", form: "Waitlist form is present", no_external_js: "No external scripts", alt: "Images have alt text",
  landmarks: "Has main and footer regions", size: "Page is lightweight",
};

function previewDoc(html: string, msg: string): string {
  const s = `<script>document.addEventListener('submit',function(e){e.preventDefault();var m=document.querySelector('[data-waitlist-msg]');if(m)m.textContent=${JSON.stringify(msg)}},true);</script>`;
  return /<\/body>/i.test(html) ? html.replace(/<\/body>/i, `${s}</body>`) : html + s;
}

export function Workspace() {
  const search = useSearchParams();
  const id = search.get("id") ?? "";
  const router = useRouter();
  const { projects, getStartup, refresh, fail, say, model, setCredits, deleteProject } = useStore();
  const { t, lang, date } = useI18n();
  const project = projects.find((p) => p.id === id);
  const s = project ? getStartup(project.sid) : undefined;
  const [tab, setTab] = useState<Tab>(TABS.find((x) => x.id === search.get("tab"))?.id ?? "overview");
  const [site, setSite] = useState<SiteState>({ loaded: false, html: "", published: false, publicId: "", checks: [] });
  const [busy, setBusy] = useState("");

  const loadSite = useCallback(async () => {
    if (!id) return;
    try {
      const r = await api<Omit<SiteState, "loaded">>(`/projects/${id}/site`);
      setSite({ loaded: true, ...r });
    } catch { setSite((x) => ({ ...x, loaded: true })); }
  }, [id]);
  useEffect(() => { void loadSite(); }, [loadSite]);

  if (!project || !s) {
    return (
      <Page>
        <EmptyState title={t("Project not found.")} text={t("It may have been removed.")} action={<Button variant="pri" onClick={() => router.push("/projects")}>{t("Back to projects")}</Button>} />
      </Page>
    );
  }

  const url = site.publicId && typeof window !== "undefined" ? `${window.location.origin}/s/${site.publicId}` : "";

  const generate = async (instruction?: string) => {
    if (busy) return;
    setBusy("gen");
    try {
      const r = await ai.site({ projectId: project.id, model, lang, instruction });
      setSite((x) => ({ ...x, loaded: true, html: r.html, checks: r.checks }));
      setCredits(r.credits);
      await refresh();
      say(t("Website generated"));
    } catch (e) { fail(e); }
    setBusy("");
  };

  const publish = async (on: boolean) => {
    setBusy("pub");
    try {
      await api(`/projects/${project.id}/publish`, { body: { publish: on } });
      await Promise.all([loadSite(), refresh()]);
      say(on ? t("Published. Your site is live.") : t("Unpublished"));
    } catch (e) { fail(e); }
    setBusy("");
  };

  const copy = async () => {
    try { await navigator.clipboard.writeText(url); say(t("Link copied")); } catch { say(url); }
  };

  const remove = async () => {
    if (!window.confirm(t("Delete this project, its website and its signups?"))) return;
    router.push("/projects");
    await deleteProject(project.id);
  };

  return (
    <Page>
      <Link href="/projects" className="inline-flex h-11 items-center gap-2 text-sm text-tx2 transition hover:text-tx"><Icon n="back" size={16} /> {t("Projects")}</Link>
      <div className="mt-4.5 flex flex-wrap items-end justify-between gap-5">
        <div>
          <div className="mb-3.5 flex flex-wrap items-center gap-2.5"><StatusBadge status={project.status} /><span className="text-[13px] text-tx3">{s.type} · {t("Created {date}", { date: date(project.created_at) })}</span></div>
          <h1 className="font-display text-[clamp(28px,4.2vw,46px)] leading-[1.08] font-semibold tracking-[-0.03em]">{s.name}</h1>
        </div>
        <div className="flex flex-wrap gap-2.5">
          {site.published && url && <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex h-11 items-center gap-2 rounded-xl border border-line2 px-4.5 text-sm font-medium transition hover:bg-white/6">{t("View live site")} <Icon n="arrow" size={15} /></a>}
          {site.published && <Button onClick={copy}>{t("Copy link")}</Button>}
          {site.html && (site.published
            ? <Button disabled={!!busy} onClick={() => publish(false)}>{t("Unpublish")}</Button>
            : <Button variant="acc" disabled={!!busy} onClick={() => publish(true)}>{busy === "pub" ? t("Publishing…") : t("Publish")}</Button>)}
        </div>
      </div>
      <Tabs tabs={TABS.map((x) => ({ id: x.id, label: t(x.label) }))} value={tab} onChange={setTab} />

      {tab === "overview" && <Overview s={s} progress={project.progress} site={site} signups={null} go={setTab} onRemove={remove} />}
      {tab === "blueprint" && <Blueprint s={s} />}
      {tab === "site" && <SiteTab site={site} busy={busy === "gen"} onGenerate={generate} onPublish={() => publish(true)} publishing={busy === "pub"} name={s.slug} />}
      {tab === "checks" && <Checks site={site} go={setTab} />}
      {tab === "analytics" && <Analytics projectId={project.id} site={site} url={url} onCopy={copy} go={setTab} />}
      {tab === "assistant" && <Assistant s={s} />}
    </Page>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return <Card><Label>{label}</Label>{children}</Card>;
}

function Overview({ s, progress, site, go, onRemove }: { s: Startup; progress: number; site: SiteState; signups: number | null; go: (t: Tab) => void; onRemove: () => void }) {
  const { t } = useI18n();
  const checksOk = site.checks.length > 0 && site.checks.every((c) => c.ok);
  const todos: [string, boolean, Tab][] = [
    ["Blueprint is ready", true, "blueprint"],
    ["Generate the website", !!site.html, "site"],
    ["All checks pass", checksOk, "checks"],
    ["Publish on a public link", site.published, "site"],
  ];
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <Label>{t("Progress")}</Label>
        <div className="mt-2.5 font-display text-[38px] leading-none font-bold tracking-[-0.04em]">{progress}%</div>
        <Bar accent value={progress} className="mt-4 mb-2" />
        <p className="mt-2 text-tx2">{s.tag}</p>
      </Card>
      <Card>
        <Label>{t("Next steps")}</Label>
        <div className="mt-2">
          {todos.map(([label, done, tab]) => (
            <button key={label} type="button" onClick={() => go(tab)} className="flex min-h-12.5 w-full items-center gap-3 border-b border-line py-3 text-left last:border-0">
              <span className={cn("grid size-5 flex-none place-items-center rounded-md border-[1.5px] text-accfg transition", done ? "border-acc bg-acc" : "border-line2")}>{done && <Icon n="check" size={12} stroke={3.4} />}</span>
              <span className={cn(done && "text-tx3 line-through")}>{t(label)}</span>
            </button>
          ))}
        </div>
      </Card>
      <Fact label={t("Problem")}><p className="mt-2">{s.problem}</p></Fact>
      <Fact label={t("Audience")}><p className="mt-2">{s.audience}</p></Fact>
      <div className="md:col-span-2"><Button variant="ghost" onClick={onRemove}>{t("Delete project")}</Button></div>
    </div>
  );
}

function Blueprint({ s }: { s: Startup }) {
  const { t } = useI18n();
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      <Fact label={t("Problem")}><p className="mt-2">{s.problem}</p></Fact>
      <Fact label={t("Target audience")}><p className="mt-2">{s.audience}</p></Fact>
      <Fact label={t("Core solution")}><p className="mt-2">{s.solution}</p></Fact>
      <Fact label={t("Key features")}><ul className="list-stair">{s.features.map((f) => <li key={f}>{f}</li>)}</ul></Fact>
      <Fact label={t("Business model")}><ul className="list-stair">{s.biz.map((f) => <li key={f}>{f}</li>)}</ul></Fact>
      <Fact label={t("Why now")}><p className="mt-2">{s.why}</p></Fact>
    </div>
  );
}

function SiteTab({ site, busy, onGenerate, onPublish, publishing, name }: { site: SiteState; busy: boolean; onGenerate: (instruction?: string) => void; onPublish: () => void; publishing: boolean; name: string }) {
  const { t } = useI18n();
  const { left } = useStore();
  const [mobile, setMobile] = useState(false);
  const [instr, setInstr] = useState("");

  if (!site.loaded) return <div className="sk h-96 w-full" />;
  if (busy && !site.html) return <GeneratingCard />;
  if (!site.html) {
    return (
      <EmptyState
        title={t("No website yet.")}
        text={t("AI will write and design a complete landing page with a working waitlist form, based on your blueprint. It costs 1 generation and takes up to a minute.")}
        action={<Button variant="acc" size="lg" disabled={busy} onClick={() => onGenerate()}>{t("Generate website")} · {left > 0 ? t("{n} left", { n: left }) : t("no generations left")}</Button>}
      />
    );
  }
  const download = () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([site.html], { type: "text/html" }));
    a.download = `${name || "site"}.html`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };
  return (
    <div className="grid items-start gap-4 lg:grid-cols-[1fr_340px]">
      <div className="overflow-hidden rounded-2xl border border-line2 bg-[#0c0c0e]">
        <div className="flex items-center gap-1.5 border-b border-line px-3.5 py-3">
          <i className="size-2.25 rounded-full bg-white/14" /><i className="size-2.25 rounded-full bg-white/14" /><i className="size-2.25 rounded-full bg-white/14" />
          <span className="ml-3 font-mono text-xs text-tx3">{t("Preview")}</span>
          <div className="ml-auto flex gap-1.5">
            <Chip on={!mobile} onClick={() => setMobile(false)}>{t("Desktop")}</Chip>
            <Chip on={mobile} onClick={() => setMobile(true)}>{t("Phone")}</Chip>
          </div>
        </div>
        <div className="relative flex justify-center bg-[#1a1a1d]">
          <iframe title={t("Preview")} sandbox="allow-scripts" srcDoc={previewDoc(site.html, t("Preview: the form works once the site is published."))} className={cn("h-170 border-0 bg-white", mobile ? "w-93.75" : "w-full")} />
          {busy && <div className="absolute inset-0 grid place-items-center bg-black/60 backdrop-blur-[2px]"><GeneratingCard /></div>}
        </div>
      </div>
      <div className="flex flex-col gap-4">
        <Card>
          <Label>{t("Change something")}</Label>
          <textarea aria-label={t("What should change?")} rows={3} maxLength={400} value={instr} onChange={(e) => setInstr(e.target.value)} placeholder={t("e.g. make it warmer, add a pricing section, shorter hero")} className="mt-3 w-full resize-none rounded-xl border border-line2 bg-s1 p-3 text-[14.5px] outline-none transition focus:border-white/40" />
          <Button className="mt-3" wide variant="pri" disabled={busy || !instr.trim()} onClick={() => { onGenerate(instr.trim()); setInstr(""); }}>{t("Apply")} · {t("1 generation")}</Button>
          <Button className="mt-2" wide variant="ghost" disabled={busy} onClick={() => onGenerate()}>{t("Regenerate from scratch")}</Button>
        </Card>
        <Card>
          <Label>{t("Publish")}</Label>
          <p className="mt-2 text-[14.5px] text-tx2">{site.published ? t("Your site is live. Visitors can join the waitlist.") : t("Publishing puts the page on a public link. Signups appear under Analytics.")}</p>
          {!site.published && <Button className="mt-3.5" wide variant="acc" disabled={publishing} onClick={onPublish}>{publishing ? t("Publishing…") : t("Publish")}</Button>}
          <Button className="mt-2" wide onClick={download}>{t("Download HTML")}</Button>
        </Card>
      </div>
    </div>
  );
}

function GeneratingCard() {
  const { t } = useI18n();
  return (
    <div className="flex flex-col items-center gap-3 rounded-[22px] border border-line bg-s1 px-8 py-12 text-center">
      <span className="size-2 animate-pulse2 rounded-full bg-acc shadow-[0_0_12px_var(--color-acc)]" />
      <div className="font-display text-xl font-semibold">{t("Designing and writing your website…")}</div>
      <p className="max-w-80 text-tx2">{t("This takes 20–60 seconds. Please keep this tab open.")}</p>
    </div>
  );
}

function Checks({ site, go }: { site: SiteState; go: (t: Tab) => void }) {
  const { t } = useI18n();
  if (!site.html) return <EmptyState title={t("Nothing to check yet.")} text={t("Generate the website first, then these automatic checks run on it.")} action={<Button variant="pri" onClick={() => go("site")}>{t("Go to Website")}</Button>} />;
  const passed = site.checks.filter((c) => c.ok).length;
  return (
    <div className="max-w-190">
      <Card>
        <div className="flex items-center justify-between"><Label>{t("Automatic checks")}</Label><span className="font-mono text-xs text-tx2">{passed}/{site.checks.length}</span></div>
        <div className="mt-1.5">
          {site.checks.map((c) => (
            <div key={c.id} className="flex items-center gap-3.5 border-b border-line py-4 last:border-0">
              <span className="flex-1">{t(CHECK_LABELS[c.id] ?? c.id)}</span>
              <span className={cn("rounded-full border border-line px-2.5 py-1.25 font-mono text-xs uppercase tracking-[0.05em]", c.ok ? "border-acc/40 text-acc" : "border-[rgb(255_160_120/0.45)] text-danger")}>{c.ok ? t("Passed") : t("Failed")}</span>
            </div>
          ))}
        </div>
      </Card>
      {passed < site.checks.length && <p className="mt-4 text-tx2">{t("Ask for a fix under Website → Change something, for example: “fix the failed checks”.")}</p>}
    </div>
  );
}

function Analytics({ projectId, site, url, onCopy, go }: { projectId: string; site: SiteState; url: string; onCopy: () => void; go: (t: Tab) => void }) {
  const { t, lang, date } = useI18n();
  const [stats, setStats] = useState<Stats | null>(null);
  useEffect(() => {
    if (!site.published) return;
    let live = true;
    api<Stats>(`/projects/${projectId}/analytics`).then((r) => live && setStats(r)).catch(() => undefined);
    return () => { live = false; };
  }, [projectId, site.published]);

  if (!site.published) return <EmptyState title={t("Analytics start after you publish.")} text={t("Publish the website and real visits and waitlist signups will appear here.")} action={<Button variant="pri" onClick={() => go("site")}>{t("Go to Website")}</Button>} />;
  if (!stats) return <div className="sk h-64 w-full" />;
  const max = Math.max(1, ...stats.days.map((d) => d.n));
  const exportCsv = () => {
    const csv = "email,signed_up_at\n" + stats.recent.map((r) => `${r.email},${new Date(r.ts).toISOString()}`).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = "waitlist.csv";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <Label>{t("Visits, last 7 days")}</Label>
        <div className="mt-5 flex h-45 items-end gap-2.5">
          {stats.days.map((d, i) => (
            <div key={d.day} className="flex h-full flex-1 flex-col justify-end gap-2" title={`${d.day}: ${d.n}`}>
              <i className={cn("block rounded-t-md rounded-b-xs transition-[height] duration-900", i === 6 ? "bg-acc" : "bg-white/16")} style={{ height: `${Math.max(3, (d.n * 100) / max)}%` }} />
              <span className="text-center font-mono text-[11px] text-tx3">{new Date(d.day + "T12:00:00Z").toLocaleDateString(lang === "ru" ? "ru-RU" : "en-US", { weekday: "short" })}</span>
            </div>
          ))}
        </div>
      </Card>
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-4">
          <Card><Label>{t("Total visits")}</Label><div className="mt-2.5 font-display text-[38px] leading-none font-bold tracking-[-0.04em]">{stats.views}</div></Card>
          <Card><Label>{t("Waitlist signups")}</Label><div className="mt-2.5 font-display text-[38px] leading-none font-bold tracking-[-0.04em]">{stats.signups}</div></Card>
        </div>
        <Card>
          <Label>{t("Public link")}</Label>
          <p className="mt-2 break-all font-mono text-[13px] text-tx2">{url}</p>
          <Button className="mt-3" size="sm" onClick={onCopy}>{t("Copy link")}</Button>
        </Card>
      </div>
      <Card className="md:col-span-2">
        <div className="flex items-center justify-between"><Label>{t("Latest signups")}</Label>{stats.recent.length > 0 && <Button size="sm" onClick={exportCsv}>{t("Export CSV")}</Button>}</div>
        {stats.recent.length === 0 ? <p className="mt-3 text-tx2">{t("No signups yet. Share the link.")}</p> : (
          <div className="mt-2 max-h-80 overflow-auto">
            {stats.recent.slice(0, 50).map((r) => (
              <div key={r.email} className="flex justify-between gap-3 border-b border-line py-3 text-[14.5px] last:border-0"><span className="break-all">{r.email}</span><span className="flex-none font-mono text-xs text-tx3">{date(r.ts)}</span></div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

interface Msg { from: "ai" | "me"; text: string }

function Assistant({ s }: { s: Startup }) {
  const { model, fail, credits, setCredits } = useStore();
  const { t, lang } = useI18n();
  const [msgs, setMsgs] = useState<Msg[]>([{ from: "ai", text: t("I am your {name} co-founder. Ask me to refine the blueprint, write launch copy or plan the next sprint.", { name: s.name }) }]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  const send = async (text: string) => {
    const x = text.trim();
    if (!x || typing) return;
    const history = msgs;
    setMsgs((m) => [...m, { from: "me", text: x }]); setInput(""); setTyping(true);
    try {
      const r = await ai.chat({ startupId: s.id, message: x, history, model, lang });
      if (!alive.current) return;
      setMsgs((m) => [...m, { from: "ai", text: r.reply }]);
      if (credits) setCredits({ ...credits, chatLeft: Math.max(0, credits.chatLeft - 1) });
    } catch (e) {
      if (alive.current) fail(e);
    }
    if (alive.current) setTyping(false);
  };
  return (
    <div className="max-w-190">
      <div className="mb-4.5 flex min-h-65 flex-col gap-3" aria-live="polite">
        {msgs.map((m, i) => (
          <div key={i} className={cn("max-w-[min(620px,86%)] animate-rise rounded-2xl px-4.25 py-3.25 text-[15px] whitespace-pre-wrap", m.from === "ai" ? "self-start rounded-tl-sm border border-line bg-s2" : "self-end rounded-tr-sm bg-tx text-[#0a0a0b]")}>{m.text}</div>
        ))}
        {typing && <div className="self-start rounded-2xl rounded-tl-sm border border-line bg-s2 px-4.25 py-3.25"><span className="typing inline-flex gap-1.25"><i /><i /><i /></span></div>}
      </div>
      <div className="mb-3.5 flex flex-wrap gap-2">{["Improve the pricing", "Draft a launch post", "Find competitors"].map((q) => <Chip key={q} onClick={() => send(t(q))}>{t(q)}</Chip>)}</div>
      <div className="flex items-center gap-2.5">
        <input aria-label={t("Message the AI assistant")} placeholder={t("Ask your AI co-founder…")} value={input} maxLength={600} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send(input)} className="h-12 min-w-0 flex-1 rounded-[13px] border border-line2 bg-s1 px-3.75 text-[15px] transition outline-none focus:border-white/40" />
        <button type="button" aria-label={t("Send message")} onClick={() => send(input)} className="grid size-11.5 place-items-center rounded-[13px] border border-acc bg-acc text-accfg transition hover:scale-105 active:scale-90"><SendMark size={24} /></button>
      </div>
      {credits && <p className="mt-2.5 text-[12.5px] text-tx3">{t("{n} messages left today. Chat does not use generations.", { n: credits.chatLeft })}</p>}
    </div>
  );
}
