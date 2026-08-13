// frontend/src/pages/Admin/NurtureSequenceBuilder.jsx — NEW FILE
// ─────────────────────────────────────────────────────────────────────────────
// Admin UI to build/manage NurtureRule documents for THIS company only.
// Route is wrapped in <FeatureGate featureKey="leadNurtureSequence"> in
// App.jsx, and the backend independently enforces the same entitlement on
// every /api/nurture/* call — so this page is inert (403) for any company
// that hasn't been explicitly enabled from Developer > Company Details.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback } from "react";
import api from "../../data/axiosConfig";
// Statuses relevant to nurture — deliberately NOT the same as the app-wide
// ALL_STATUSES constant. "Not Interested", "Merged", and "Closed" leads are
// dead ends (no nurture makes sense there), and "Interested" is a real
// lead.status value in this CRM that the global constant doesn't list.
const NURTURE_STATUSES = ["New", "In Progress", "Interested", "Converted"];

// Industries — these MUST match utils/templateNameResolver.js on the backend,
// because each one's slug becomes part of an APPROVED MSG91 template name
// (e.g. "Interior Designers" → interior_designers_crm_action_v1).
//
// Do not add an industry here unless the matching templates exist and are
// approved in MSG91, or auto-resolve will build a name that doesn't exist and
// the send will fail. The previous list contained E-commerce / Manufacturing /
// Hospitality / Other, none of which have templates in the library.
const INDUSTRIES = [
  "Healthcare", "Education", "Real Estate", "Logistics", "Finance",
  "IT Solutions", "Digital Marketing", "Construction", "Local Business",
  "Interior Designers", "Professional Services",
];
const SERVICES = [
  "SEO", "Paid Ads", "Website Design & Development", "AI Automation",
  "CRM", "Video Editing", "Graphic Design", "Social Media Marketing",
];

// The 4 funnel stages in the approved template library.
const FUNNEL_STAGES = [
  { value: "awareness", label: "Awareness — Day 0, first touch (no pitch)" },
  { value: "interest",  label: "Interest — Day 2–3, name the pain + the fix" },
  { value: "desire",    label: "Desire — Day 5–6, outcome & value" },
  { value: "action",    label: "Action — Day 8–9, one clear next step" },
];

// Shared slug + naming pattern — MUST stay identical to the one used inside
// TemplatePreview and to utils/templateNameResolver.js on the backend.
const slug = (x) => String(x || "").toLowerCase().replace(/[^a-z0-9]+/g, "_");
const tplNameFor = (industry, service, stage, variation1Based) =>
  `${slug(industry)}_${slug(service)}_${stage}_v${variation1Based}`;

// Same status → funnel-stage mapping shown next to the Status Stage <select>
// (New→awareness, In Progress→interest, Interested→desire, Converted→action).
const STATUS_TO_STAGE = {
  "New": "awareness",
  "In Progress": "interest",
  "Interested": "desire",
  "Converted": "action",
};

// ── Template preview data (from the approved MSG91 sequence generator) ────────
const SITE = "https://skyupdigitalsolutions.com/";
const FOOT = `\n\n🌐 ${SITE}\n— *Skyup Digital Solutions*`;

const SVC_DATA = {
  "SEO":{ title:"Google Ranking (SEO)", e:"🔍", d1:"Show up on top of Google & Maps", d2:"Free, steady customers every month",
    fix:"We get {{2}} ranking on top of Google & Maps for what your {cust} actually search — so you get found first, for free, every day.",
    pains:["Your {cust} search on Google, but your competitors show up first — not you.","You depend only on references and word-of-mouth — nothing steady coming in.","You're nowhere on Google Maps, so nearby {cust} never find you.","The day you stop paying for ads, your leads stop too.","People search your service in your city, but {{2}} just doesn't appear."]},
  "Paid Ads":{ title:"Google & Facebook Ads", e:"🎯", d1:"Leads coming in within days", d2:"Every rupee tracked, nothing wasted",
    fix:"We run Google & Facebook ads that target only people ready to buy — and track every rupee, so your money brings real {cust}, fast.",
    pains:["You're spending on ads but getting mostly junk leads and time-wasters.","You don't know which ad is working and which is wasting your money.","Your competitors' ads are everywhere and yours are nowhere.","You boosted a few posts on Facebook and got likes — but no customers.","You need {cust} now, and waiting months isn't an option."]},
  "Website Design & Development":{ title:"Website Design", e:"💻", d1:"A website you'll be proud of", d2:"Works perfectly on mobile too",
    fix:"We build {{2}} a fast, clean, mobile-friendly website that turns visitors into enquiries — working for you 24x7.",
    pains:["People visit your website, look once, and leave without contacting you.","Your website looks old and loads slowly, especially on mobile.","You don't have a proper website yet — just a social media page.","{cust} can't easily find your number, services or how to enquire.","Your website brings you almost zero enquiries."]},
  "AI Automation":{ title:"WhatsApp & AI Automation", e:"🤖", d1:"Instant replies to every customer", d2:"No lead missed, even at night",
    fix:"We set up WhatsApp + AI that replies instantly, answers common questions and books {cust} in automatically — 24x7, even while you sleep.",
    pains:["{cust} message at night or on holidays, no one replies, so they go elsewhere.","Your team wastes hours answering the same questions again and again.","Leads come in but follow-up is slow, and they go cold.","You miss calls and WhatsApp messages when you're busy.","You can't reply fast enough — and fast reply is what wins the deal."]},
  "CRM":{ title:"Lead Management (CRM)", e:"📋", d1:"All your leads in one place", d2:"Auto follow-ups so none slip away",
    fix:"We give {{2}} one simple place for every lead, with automatic reminders and follow-ups — so you close more of what you already get.",
    pains:["Your leads are scattered across WhatsApp, calls and notebooks.","You forget to follow up, and good leads quietly slip away.","You don't know how many leads came in, or how many you lost.","Different team members lose track of who is following up with whom.","You're busy with old leads while new ones get ignored."]},
  "Video Editing":{ title:"Video Editing", e:"🎬", d1:"Scroll-stopping reels & ads", d2:"Build trust and get shared more",
    fix:"We make short, catchy reels and videos for {{2}} that stop the scroll, build trust and get shared.",
    pains:["Your posts get ignored — photos alone don't grab attention anymore.","People don't fully trust a business they can't really 'see'.","Your competitors' reels are getting views and yours aren't.","You have no videos to show your work or build trust.","You want to reach more people locally but don't know how to make good reels."]},
  "Graphic Design":{ title:"Graphic Design", e:"🎨", d1:"Clean, professional designs", d2:"A brand people remember",
    fix:"We design clean, professional creatives and branding for {{2}} so you instantly look premium and trustworthy.",
    pains:["Your posts and posters look basic and don't match the quality of your work.","Your brand looks different everywhere — no consistent, professional look.","You lose {cust} to competitors who simply look more trustworthy.","You waste time making creatives yourself in Canva.","You don't have a proper logo or brand identity yet."]},
  "Social Media Marketing":{ title:"Social Media", e:"📱", d1:"Regular posts, done for you", d2:"More followers that become customers",
    fix:"We handle {{2}}'s Instagram & Facebook with a proper content plan — regular posts and reels that build an audience and bring enquiries.",
    pains:["Your Instagram/Facebook is inactive, so people think you're not serious.","You post sometimes, but there's no plan and no enquiries from it.","Your competitors are active on social and grabbing your {cust}' attention.","You just don't have time to post regularly.","You get followers, but they never turn into customers."]},
};

const IND_DATA = {
  "Healthcare":{ label:"clinics & hospitals", win:"more patients 🏥", wl:"more patients find you and trust you", cust:"patients" },
  "Education":{ label:"schools, colleges & coaching centres", win:"more admissions 🎓", wl:"more admission enquiries every season", cust:"parents & students" },
  "Real Estate":{ label:"real estate businesses", win:"more site visits 🏠", wl:"more buyers booking site visits", cust:"buyers" },
  "Logistics":{ label:"logistics & transport companies", win:"more quote requests 🚚", wl:"more enquiries from the right companies", cust:"clients" },
  "Finance":{ label:"finance businesses", win:"more clients 💰", wl:"more trusted enquiries for your services", cust:"clients" },
  "IT Solutions":{ label:"IT & software companies", win:"more demos booked 💻", wl:"more demo bookings from real buyers", cust:"clients" },
  "Digital Marketing":{ label:"marketing agencies", win:"more work handled under your brand 🤝", wl:"more capacity, delivered as your behind-the-scenes team", cust:"your clients" },
  "Construction":{ label:"construction companies", win:"more project enquiries 🏗️", wl:"more enquiries from serious clients", cust:"clients" },
  "Local Business":{ label:"local shops & businesses", win:"more walk-in customers 🛍️", wl:"more nearby customers calling & visiting", cust:"customers" },
  "Interior Designers":{ label:"interior designers", win:"more high-value projects 🛋️", wl:"more big-budget project enquiries", cust:"homeowners" },
  "Professional Services":{ label:"CA, legal & consulting firms", win:"more clients 📁", wl:"more quality client enquiries", cust:"clients" },
};

function px(str, cust) { return str.replace(/{cust}/g, cust); }

function buildPreview(industry, service, stage, variationIndex) {
  const s = SVC_DATA[service];
  const i = IND_DATA[industry];
  if (!s || !i) return "";
  const v = variationIndex; // 0-based

  if (stage === "awareness") {
    const variants = [
      `Hi {{1}} 👋\n\nThis is *Skyup Digital Solutions*, a Bangalore-based digital marketing team 🙂\n\nWe help ${i.label} get *${i.win}*.\n\nJust saying hello and putting us on your radar — nothing to sell today!\n\nI'll share something useful for {{2}} soon.`,
      `Hi {{1}} 👋\n\nQuick question — is {{2}} getting enough new ${i.cust} from online? 🤔\n\nMost ${i.label} miss out simply because a few basics aren't set up right.\n\nWe're *Skyup Digital Solutions*, and this is exactly what we help with.\n\nMore on this soon 🙂`,
      `Hi {{1}} 👋\n\nSmall free tip for {{2}} 👇\n\nRight now most ${i.label} lose ${i.cust} online without even realising it — just a few missing basics.\n\nWe're *Skyup Digital Solutions* and fixing this is what we do 🙂\n\nNo cost to chat. I'll share more soon.`,
      `Hi {{1}} 👋\n\nWe're *Skyup Digital Solutions* — we work with ${i.label} like {{2}} to get *${i.win}*.\n\n${s.e} One thing we help a lot with is *${s.title}*.\n\nJust a hello for now 🙂 nothing to buy — something useful coming your way soon.`,
      `Hi {{1}} 👋\n\nHope you're doing well! 🙂\n\nQuick intro — *Skyup Digital Solutions* helps ${i.label} grow online and get *${i.win}*.\n\nWe'd genuinely love to help {{2}} too. No pressure at all — just wanted to connect first.`,
    ];
    return (variants[v] || "") + FOOT;
  }
  if (stage === "interest") {
    return `Hi {{1}} 👋\n\nHere's something a lot of ${i.label} quietly struggle with 👇\n\n😟 *The problem:* ${px(s.pains[v], i.cust)}\n\n✅ *How we fix it:* ${px(s.fix, i.cust)}\n\nFor {{2}}, that means *${i.wl}* ${s.e}\n\nWant to see how we'd do this for you?` + FOOT;
  }
  if (stage === "desire") {
    const variants = [
      `Hi {{1}} 👋\n\nJust imagine this for {{2}} 👇\n\n🎯 *${i.win}*\n⭐ ${s.d1}\n⭐ ${s.d2}\n\nAnd the best part — *we handle everything for you*, start to finish 🙌\n\nWant the details?`,
      `Hi {{1}} 👋\n\nHere's what *${s.title}* can do for {{2}} 👇\n\n✅ ${s.d1}\n✅ ${s.d2}\n✅ ${i.wl}\n\nWe've helped other ${i.label} do exactly this — {{2}} can be next 🚀`,
      `Hi {{1}} 👋\n\nHonest truth 👇\n\nYour competitors are already using *${s.title}* to get *${i.win}*.\n\nEvery day without it, those ${i.cust} go to them instead of {{2}} 😬\n\nWe can fix that for you quickly. Interested?`,
      `Hi {{1}} 👋\n\nDon't worry — *you don't have to do anything technical* 🙌\n\nWe handle the full *${s.title}* setup for {{2}}:\n${s.e} ${s.title}\n✅ ${s.d1}\n\nYou focus on your business — we bring the ${i.cust} 🙂`,
      `Hi {{1}} 👋\n\nWorried about budget? Totally fair 🙂\n\nWith *${s.title}*, you're not spending — you're *investing* to get *${i.win}*.\n\nWe keep it affordable and make every rupee work. 💰\n\nWant a plan that fits your budget?`,
    ];
    return (variants[v] || "") + FOOT;
  }
  if (stage === "action") {
    const variants = [
      `Hi {{1}} 👋\n\nLet's take the first step 🚀\n\n🎁 A *FREE business strategy session* for {{2}} — no cost, no pressure.\nWe'll show exactly how *${s.title}* gets you *${i.win}*.\n\n👉 Reply *YES*, or use *Call us / Ask us to call back* below 🙂`,
      `Hi {{1}} 👋\n\nShall we do a quick *15-minute call*? 📞\n\nI'll walk you through how *${s.title}* works for {{2}} — simple, no jargon.\n\n👉 Reply with a good time, or tap *Call us* below 🙂`,
      `Hi {{1}} 👋\n\nWant me to send {{2}} a simple plan for *${s.title}*? 📄\n\nJust reply *YES* and I'll share it — no obligation at all 🙂\n\nOr tap *Ask us to call back* below 👇`,
      `Hi {{1}} 👋\n\nWe're taking on just a few new ${i.label} this month, and I'd love {{2}} to be one 🙂\n\n🎁 Free strategy session + a clear plan for *${i.win}*.\n\n👉 Reply to grab a slot, or *Call us* below 🙌`,
      `Hi {{1}} 👋\n\nHappy to keep this simple 🙂\n\nWe can start with a quick WhatsApp chat about {{2}} — whatever's easy for you.\n\n👉 Message us, or use *Call us / Ask us to call back* below 🚀`,
    ];
    return (variants[v] || "") + FOOT;
  }
  return "";
}

const TEMPERATURES = ["Hot", "Warm", "Cold"];

const emptyDraft = {
  name: "",
  enabled: true,
  trigger: {
    statuses: [],
    temperatures: [],
    minDaysSinceLastTouch: 3,
    requirePendingFollowUp: false,
    sources: [],
    industries: [],
    includeManualOrImported: false,
  },
  action: {
    whatsapp: {
      enabled: true,
      languageCode: "en",
      // Which CRM status this rule's stage targets (e.g. "New" → Awareness).
      // When a lead moves to a new status, the variation index resets to V1.
      statusStage: "",
      // When true, the template name is derived per-lead from the lead's own
      // industry + service, so one rule covers all 88 industry×service combos.
      autoResolveTemplate: true,
      funnelStage: "",
      variationCount: 5,
      // When false (default per Roshan's spec): after V5, the lead simply
      // stops getting this rule's messages — no wraparound to V1. When true,
      // it cycles V1→V2→…→V5→V1 indefinitely. NOTE: this flag must also be
      // checked by the nurture job on the backend (the actual send loop
      // lives there, not in this file) — it only travels as data from here.
      repeatVariations: false,
      // Sequential variation pool — V1 through V5 in order.
      // The job picks the next unused variation per lead, then stops at V5
      // unless repeatVariations is true (in which case it wraps to V1).
      templateVariations: ["", "", "", "", ""],
      // Default/fallback template — used when templateVariations is empty.
      templateName: "",
      // Per-status overrides (legacy, kept for backward compat).
      templatesByStatus: {},
    },
    email: { enabled: false, subject: "", fromName: "", bodyTemplate: "" },
    notifyAgent: false,
    notifyAgentMessage: "",
  },
  repeatEveryDays: null,
};

function Toggle({ checked, onChange, label }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer select-none">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="w-4 h-4 accent-[#2563EB]" />
      <span className="text-[12px] text-[#4B5168] dark:text-[#9DA3BB]">{label}</span>
    </label>
  );
}

function MultiChip({ options, selected, onToggle }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          onClick={() => onToggle(o)}
          className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition
            ${selected.includes(o)
              ? "bg-[#2563EB] text-white border-[#2563EB]"
              : "bg-white dark:bg-[#161822] text-[#4B5168] dark:text-[#9DA3BB] border-[#E4E7EF] dark:border-[#262A38]"}`}
        >
          {o}
        </button>
      ))}
    </div>
  );
}


// ── TemplatePreview — shows the actual WhatsApp message + MSG91 status ────────
// A proper component (not an IIFE) so variables are always in scope.
function TemplatePreview({ industry, service, stage, variation, templates, onVariationChange }) {
  const tplName = tplNameFor(industry, service, stage, variation + 1);

  // Look up this template in the synced MSG91 cache
  const cached = templates.find((t) => t.name === tplName);

  // MSG91 returns "Enabled" which we store as either "ENABLED" (old sync)
  // or "APPROVED" (new sync after normalization fix). Accept both.
  const rawStatus  = String(cached?.status || "").trim().toUpperCase();
  const isApproved = ["APPROVED", "ENABLED", "ACTIVE", "LIVE"].includes(rawStatus);
  const isPending  = ["PENDING", "SUBMITTED", "IN_APPEAL", "PENDING_REVIEW"].includes(rawStatus);
  const isRejected = ["REJECTED", "REFUSED", "FLAGGED", "DISABLED_BY_META"].includes(rawStatus);
  const isPaused   = ["PAUSED", "DISABLED", "ARCHIVED", "INACTIVE"].includes(rawStatus);
  const notSynced  = !cached;

  // What to actually display in the badge — normalize to user-friendly label
  const isUnknown = rawStatus === "UNKNOWN" || rawStatus === "";
  const statusLabel = isApproved ? "Approved"
    : isPending  ? "Pending"
    : isRejected ? "Rejected"
    : isPaused   ? "Paused"
    : isUnknown  ? "Status unavailable"
    : rawStatus;

  // Build the message body and replace placeholders for display
  const bizName = industry === "Healthcare" ? "City Clinic" : `${industry} Co.`;
  const rawBody = buildPreview(industry, service, stage, variation) || "";
  const display = rawBody
    .replace(/\*([^*]+)\*/g, "$1")   // strip *bold* markers
    .split("{{1}}").join("Rahul")
    .split("{{2}}").join(bizName);

  return (
    <div className="p-3">
      {/* Variation tabs V1–V5 */}
      <div className="flex gap-1 mb-2 flex-wrap items-center">
        {[0,1,2,3,4].map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => onVariationChange(v)}
            className={`w-7 h-7 rounded text-[11px] font-bold border transition-colors ${
              variation === v
                ? "bg-[#0F1117] dark:bg-white text-white dark:text-[#0F1117] border-transparent"
                : "border-[#E4E7EF] dark:border-[#262A38] text-[#8B92A9]"
            }`}
          >V{v + 1}</button>
        ))}

        {/* Template name */}
        <code className="ml-auto text-[10px] self-center text-[#8B92A9] bg-[#F8F9FC] dark:bg-[#13161E] px-2 py-0.5 rounded">
          {tplName}
        </code>

        {/* MSG91 status badge — always shows, matches exactly what MSG91 dashboard shows */}
        {notSynced ? (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-[#8B92A9] self-center ml-1">
            Not synced
          </span>
        ) : isApproved ? (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 self-center ml-1">
            ✅ Approved
          </span>
        ) : isPending ? (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 self-center ml-1">
            ⏳ Pending
          </span>
        ) : isRejected ? (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 self-center ml-1">
            ❌ Rejected
          </span>
        ) : isPaused ? (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 self-center ml-1">
            ⏸ Paused
          </span>
        ) : (
          <span
            className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-[#8B92A9] self-center ml-1"
            title={cached?.rawStatusField || "MSG91 returned no status field"}
          >
            {statusLabel}
          </span>
        )}

        {/* Show exactly what MSG91 sent, so the status is never a mystery */}
        {cached?.rawStatusField && (
          <span className="text-[9px] text-[#8B92A9] self-center ml-1 opacity-70">
            (MSG91: {cached.rawStatusField})
          </span>
        )}
        {notSynced && (
          <span className="text-[10px] text-[#8B92A9] self-center ml-1">— not synced</span>
        )}
      </div>

      {/* Status warning below the bubble when not approved */}
      {isPending && (
        <div className="mb-2 px-2 py-1.5 rounded bg-[#FEF3C7] dark:bg-[#78350F]/20 border border-[#F5B547]/40 text-[11px] text-[#92400E] dark:text-[#F5B547]">
          ⚠️ This template is <b>pending Meta approval</b>. The nurture job will skip it until MSG91 shows it as Enabled.
        </div>
      )}
      {isRejected && (
        <div className="mb-2 px-2 py-1.5 rounded bg-[#FEE2E2] dark:bg-[#7F1D1D]/20 border border-[#DC2626]/40 text-[11px] text-[#991B1B] dark:text-[#F87171]">
          ❌ This template was <b>rejected by Meta</b>. Edit and resubmit it in the MSG91 dashboard.
        </div>
      )}

      {/* WhatsApp-style message bubble */}
      <div className="rounded-[4px_14px_14px_14px] bg-[#075E54] text-white text-[12.5px] leading-relaxed p-3 whitespace-pre-wrap">
        {display}
      </div>
      <p className="text-[9px] text-[#8B92A9] mt-1">
        Preview replaces name = "Rahul" and business = "{bizName}". Real send uses the lead's actual values.
      </p>
    </div>
  );
}

export default function NurtureSequenceBuilder() {
  const [rules,   setRules]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");
  const [draft,   setDraft]   = useState(emptyDraft);
  const [editingId, setEditingId] = useState(null);

  // ── MSG91 template cache (auto-fetched, no manual typing) ──────────────────
  const [templates, setTemplates]   = useState([]);
  const [tplStats, setTplStats]     = useState(null);
  const [syncing, setSyncing]       = useState(false);
  const [syncMsg, setSyncMsg]       = useState("");
  const [saving,  setSaving]  = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get("/nurture/rules");
      setRules(data.rules || []);
    } catch (e) {
      setError(e.response?.data?.message || "Failed to load nurture rules.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Template preview state
  const [previewIndustry, setPreviewIndustry] = useState("");
  const [previewService,  setPreviewService]  = useState("");
  const [previewVariation, setPreviewVariation] = useState(0);

  // Load whatever templates are already cached locally (fast, no MSG91 call).
  const loadTemplates = useCallback(async () => {
    try {
      const { data } = await api.get("/nurture/templates");
      setTemplates(data.templates || []);
      setTplStats(data.stats || null);
    } catch {
      setTemplates([]);
      setTplStats(null);
    }
  }, []);
  useEffect(() => { loadTemplates(); }, [loadTemplates]);

  // Pull the live list from MSG91 into the cache, then refresh.
  const syncTemplates = async () => {
    setSyncing(true);
    setSyncMsg("");
    try {
      const { data } = await api.post("/nurture/templates/sync");
      let msg = `✅ Synced ${data.total} template(s) — ${data.nurture} nurture, ${data.other} other.`;
      // Show which fields MSG91 actually returned. If there is no status-like
      // field here, MSG91's list endpoint simply does not expose approval
      // state and we cannot display it accurately from this call.
      if (Array.isArray(data.sampleKeys) && data.sampleKeys.length) {
        msg += `\n\nFields MSG91 returned: ${data.sampleKeys.join(", ")}`;
        const hasStatusLike = data.sampleKeys.some((k) => /status|state|approv|active|enabled/i.test(k));
        msg += hasStatusLike
          ? `\n→ A status-like field IS present. Send me this line and I will map it.`
          : `\n⚠ No status field in this response — MSG91's list endpoint does not expose approval state.`;
      }
      setSyncMsg(msg);
      await loadTemplates();
    } catch (e) {
      const msg = e?.response?.data?.message || e.message || "Sync failed";
      setSyncMsg(`❌ ${msg}`);
    } finally {
      setSyncing(false);
    }
  };

  const toggleArrayValue = (path, value) => {
    setDraft((d) => {
      // NOTE: structuredClone() isn't available on Safari <15.4 or some
      // embedded WebViews, and nothing else in this codebase relies on it.
      // JSON round-trip is a safe deep-clone here since `draft` only ever
      // holds plain JSON-serializable values (no Dates/Maps/functions).
      const next = JSON.parse(JSON.stringify(d));
      const arr = path === "statuses" ? next.trigger.statuses
                : path === "temperatures" ? next.trigger.temperatures
                : path === "industries" ? next.trigger.industries
                : next.trigger.sources;
      const idx = arr.indexOf(value);
      if (idx === -1) arr.push(value); else arr.splice(idx, 1);

      // Auto-sync Status Stage + Funnel Stage from the status chips — no
      // need to pick the same thing three times. Only auto-fills when the
      // chips resolve to exactly ONE status with a known mapping; with zero
      // or multiple statuses selected there's no single answer, so leave
      // whatever was already chosen (manual override still available).
      if (path === "statuses") {
        if (next.trigger.statuses.length === 1 && STATUS_TO_STAGE[next.trigger.statuses[0]]) {
          const st = next.trigger.statuses[0];
          next.action.whatsapp.statusStage = st;
          next.action.whatsapp.funnelStage = STATUS_TO_STAGE[st];
        } else {
          next.action.whatsapp.statusStage = "";
        }
      }
      return next;
    });
  };

  const startEdit = (rule) => {
    setEditingId(rule._id);
    setDraft({
      name: rule.name,
      enabled: rule.enabled,
      trigger: { ...emptyDraft.trigger, ...rule.trigger },
      action: {
        whatsapp: { ...emptyDraft.action.whatsapp, ...(rule.action?.whatsapp || {}) },
        email:    { ...emptyDraft.action.email,    ...(rule.action?.email    || {}) },
        notifyAgent: !!rule.action?.notifyAgent,
        notifyAgentMessage: rule.action?.notifyAgentMessage || "",
      },
      repeatEveryDays: rule.repeatEveryDays || null,
    });
  };

  const resetDraft = () => { setEditingId(null); setDraft(emptyDraft); };

  const save = async () => {
    if (!draft.name.trim()) { setError("Rule name is required."); return; }
    setSaving(true);
    setError("");
    try {
      if (editingId) {
        await api.patch(`/nurture/rules/${editingId}`, draft);
      } else {
        await api.post("/nurture/rules", draft);
      }
      resetDraft();
      await load();
    } catch (e) {
      setError(e.response?.data?.message || "Failed to save rule.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    if (!window.confirm("Delete this nurture rule?")) return;
    try {
      await api.delete(`/nurture/rules/${id}`);
      await load();
    } catch (e) {
      setError(e.response?.data?.message || "Failed to delete rule.");
    }
  };

  const toggleEnabled = async (rule) => {
    try {
      await api.patch(`/nurture/rules/${rule._id}`, { enabled: !rule.enabled });
      await load();
    } catch (e) {
      setError(e.response?.data?.message || "Failed to update rule.");
    }
  };

  // ── Auto-build all 4 stage rules ────────────────────────────────────────
  // autoResolveTemplate already resolves the exact template PER LEAD from
  // that lead's own industry+service at send time — sends V1→V2→…→V5 in
  // order, then STOPS (repeatVariations: false) so nobody gets the same 5
  // messages looping forever — so one rule per funnel stage covers all 88
  // industry×service combos with zero manual template entry.
  //
  // Cadence per Roshan's spec (repeatEveryDays = resend interval):
  //   New          → every 3 days, ALL leads EXCEPT manual/CSV-imported ones
  //   In Progress  → every 2 days, all leads
  //   Interested   → every 2 days, all leads
  //   Converted    → every 1 day,  all leads
  const [autoBuilding, setAutoBuilding] = useState(false);
  const STAGE_REPEAT_DAYS = { "New": 3, "In Progress": 2, "Interested": 2, "Converted": 1 };
  // Only the New-status rule excludes manual/CSV-imported leads; the other
  // 3 stages include everyone (by the time a lead is In Progress/Interested/
  // Converted, source no longer matters).
  const STAGE_INCLUDE_MANUAL_OR_IMPORTED = { "New": false, "In Progress": true, "Interested": true, "Converted": true };

  const autoBuildAllRules = async () => {
    const existingStatuses = new Set(
      rules.flatMap((r) => r.trigger?.statuses || [])
    );
    const toCreate = NURTURE_STATUSES.filter(
      (st) => STATUS_TO_STAGE[st] && !existingStatuses.has(st)
    );
    if (toCreate.length === 0) {
      setError("");
      window.alert("All 4 stage rules already exist (matched by status) — nothing to create.");
      return;
    }
    const ok = window.confirm(
      `This will create ${toCreate.length} rule(s), one per status, each with ` +
      `Auto-pick template ON (V1→V2→…→V5, then STOPS — no repeat wraparound):\n\n` +
      toCreate.map((st) => {
        const inc = STAGE_INCLUDE_MANUAL_OR_IMPORTED[st];
        return `• ${st} → ${STATUS_TO_STAGE[st]} (repeats every ${STAGE_REPEAT_DAYS[st]}d${inc ? "" : ", excludes manual/CSV leads"})`;
      }).join("\n")
    );
    if (!ok) return;

    setAutoBuilding(true);
    setError("");
    try {
      for (const st of toCreate) {
        const stage = STATUS_TO_STAGE[st];
        const days = STAGE_REPEAT_DAYS[st];
        const payload = {
          name: `${st} → ${stage} (auto)`,
          enabled: true,
          trigger: {
            ...emptyDraft.trigger,
            statuses: [st],
            minDaysSinceLastTouch: days,
            includeManualOrImported: STAGE_INCLUDE_MANUAL_OR_IMPORTED[st],
          },
          action: {
            whatsapp: {
              ...emptyDraft.action.whatsapp,
              enabled: true,
              statusStage: st,
              autoResolveTemplate: true,
              funnelStage: stage,
              repeatVariations: false, // stop after V5 — per Roshan's spec, no wraparound
            },
            email: { ...emptyDraft.action.email },
            notifyAgent: false,
            notifyAgentMessage: "",
          },
          repeatEveryDays: days,
        };
        await api.post("/nurture/rules", payload);
      }
      await load();
    } catch (e) {
      setError(e.response?.data?.message || "Auto-build failed partway — check Active Rules for what was created.");
    } finally {
      setAutoBuilding(false);
    }
  };

  return (
    <div className="bg-[#F8F9FC] dark:bg-[#0D0F14] min-h-screen px-4 sm:px-6 py-8">
      <h1 className="text-[20px] font-bold text-[#0F1117] dark:text-[#F0F2FA] mb-1">Lead Nurture Sequence</h1>
      <p className="text-[13px] text-[#8B92A9] mb-6">
        Automated WhatsApp/Email nudges for leads that have gone quiet — separate from the per-outcome
        messages that already fire when an agent logs a call.
      </p>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 text-[12px] font-semibold text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      {/* ── Existing rules ────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl overflow-hidden mb-6">
        <div className="px-5 py-4 border-b border-[#E4E7EF] dark:border-[#262A38] flex items-center justify-between gap-3 flex-wrap">
          <h2 className="text-[14px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">Active Rules</h2>
          <button
            type="button"
            onClick={autoBuildAllRules}
            disabled={autoBuilding}
            className="text-[11px] font-semibold px-3 py-1.5 rounded-lg bg-[#2563EB] text-white disabled:opacity-50"
            title="New: every 3d (excl. manual/CSV) · In Progress & Interested: every 2d · Converted: every 1d — auto-picks template per lead's industry+service, V1→V5 then stops (no repeat)"
          >
            {autoBuilding ? "Building…" : "⚡ Auto-build all 4 stage rules"}
          </button>
        </div>
        <div className="p-5">
          {loading ? (
            <p className="text-[13px] text-[#8B92A9]">Loading…</p>
          ) : rules.length === 0 ? (
            <p className="text-[13px] text-[#8B92A9]">No rules yet — build one below.</p>
          ) : (
            <div className="space-y-2">
              {rules.map((r) => (
                <div key={r._id} className="flex items-center gap-3 p-3 rounded-xl bg-[#F8F9FC] dark:bg-[#161822]">
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-semibold text-[#0F1117] dark:text-[#F0F2FA]">{r.name}</div>
                    <div className="text-[11px] text-[#8B92A9]">
                      Fires after {r.trigger?.minDaysSinceLastTouch ?? "?"} day(s) idle
                      {r.trigger?.statuses?.length ? ` · status: ${r.trigger.statuses.join(", ")}` : ""}
                      {r.trigger?.temperatures?.length ? ` · temp: ${r.trigger.temperatures.join(", ")}` : ""}

                      {(() => {
                        const tbs = r.action?.whatsapp?.templatesByStatus || {};
                        const total = Object.values(tbs).reduce((sum, pool) => sum + (Array.isArray(pool) ? pool.filter((t) => t && t.trim()).length : (pool ? 1 : 0)), 0);
                        return total > 0 ? ` · ${total} template(s)` : "";
                      })()}
                    </div>
                  </div>
                  <button onClick={() => toggleEnabled(r)} className={`px-2.5 py-1 rounded-lg text-[11px] font-bold ${r.enabled ? "bg-[#059669]/10 text-[#059669]" : "bg-[#8B92A9]/10 text-[#8B92A9]"}`}>
                    {r.enabled ? "Enabled" : "Disabled"}
                  </button>
                  <button onClick={() => startEdit(r)} className="text-[11px] font-semibold text-[#2563EB]">Edit</button>
                  <button onClick={() => remove(r._id)} className="text-[11px] font-semibold text-red-600">Delete</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Builder form ──────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[#E4E7EF] dark:border-[#262A38]">
          <h2 className="text-[14px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">{editingId ? "Edit Rule" : "New Rule"}</h2>
        </div>
        <div className="p-5 space-y-5">
          <div>
            <label className="text-[11px] font-semibold text-[#8B92A9] uppercase">Rule name</label>
            <input
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder='e.g. "Cold lead re-engage — Day 3"'
              className="mt-1 w-full px-3 py-2 rounded-lg border border-[#E4E7EF] dark:border-[#262A38] bg-transparent text-[13px]"
            />
          </div>

          <div>
            <label className="text-[11px] font-semibold text-[#8B92A9] uppercase">Only fire for these statuses (empty = any)</label>
            <div className="mt-1"><MultiChip options={NURTURE_STATUSES} selected={draft.trigger.statuses} onToggle={(v) => toggleArrayValue("statuses", v)} /></div>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-[#8B92A9] uppercase">Only fire for these temperatures (empty = any)</label>
            <div className="mt-1"><MultiChip options={TEMPERATURES} selected={draft.trigger.temperatures} onToggle={(v) => toggleArrayValue("temperatures", v)} /></div>
          </div>



          <div className="flex items-end gap-4">
            <div>
              <label className="text-[11px] font-semibold text-[#8B92A9] uppercase">Days idle before firing</label>
              <input
                type="number" min="0"
                value={draft.trigger.minDaysSinceLastTouch}
                onChange={(e) => setDraft({ ...draft, trigger: { ...draft.trigger, minDaysSinceLastTouch: Number(e.target.value) } })}
                className="mt-1 w-24 px-3 py-2 rounded-lg border border-[#E4E7EF] dark:border-[#262A38] bg-transparent text-[13px]"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-[#8B92A9] uppercase">Repeat every (days, blank = once)</label>
              <input
                type="number" min="1"
                value={draft.repeatEveryDays ?? ""}
                onChange={(e) => setDraft({ ...draft, repeatEveryDays: e.target.value ? Number(e.target.value) : null })}
                className="mt-1 w-24 px-3 py-2 rounded-lg border border-[#E4E7EF] dark:border-[#262A38] bg-transparent text-[13px]"
              />
            </div>
            <Toggle
              checked={draft.trigger.requirePendingFollowUp}
              onChange={(v) => setDraft({ ...draft, trigger: { ...draft.trigger, requirePendingFollowUp: v } })}
              label="Only if a follow-up call is still pending"
            />
          </div>

          <Toggle
            checked={draft.trigger.includeManualOrImported}
            onChange={(v) => setDraft({ ...draft, trigger: { ...draft.trigger, includeManualOrImported: v } })}
            label="Also include manually added / CSV-imported leads (off by default)"
          />

          <hr className="border-[#E4E7EF] dark:border-[#262A38]" />

          <div>
            <Toggle
              checked={draft.action.whatsapp.enabled}
              onChange={(v) => setDraft({ ...draft, action: { ...draft.action, whatsapp: { ...draft.action.whatsapp, enabled: v } } })}
              label="Send WhatsApp"
            />
            {draft.action.whatsapp.enabled && (
              <div className="mt-2 space-y-2">

                {/* ── Status Stage — auto-synced from "Only fire for these
                    statuses" above when exactly one is picked. Manual
                    dropdown only shows up when there's no single answer
                    (zero or multiple statuses selected), so you're not
                    picking the same status three times for one rule. ────── */}
                <div>
                  <p className="text-[10px] font-semibold text-[#8B92A9] uppercase mb-1">
                    Status Stage — which CRM status triggers this rule
                  </p>
                  {draft.trigger.statuses.length === 1 && STATUS_TO_STAGE[draft.trigger.statuses[0]] ? (
                    <p className="text-[13px] px-3 py-2 rounded-lg border border-[#E4E7EF] dark:border-[#262A38] bg-[#F8F9FC] dark:bg-[#13161E]">
                      <b>{draft.trigger.statuses[0]}</b> → {STATUS_TO_STAGE[draft.trigger.statuses[0]].replace(/^./, (c) => c.toUpperCase())}
                      <span className="text-[#8B92A9] ml-1">(auto-set from the status chips above)</span>
                    </p>
                  ) : (
                    <select
                      value={draft.action.whatsapp.statusStage}
                      onChange={(e) => setDraft({ ...draft, action: { ...draft.action, whatsapp: { ...draft.action.whatsapp, statusStage: e.target.value } } })}
                      className="w-full px-3 py-2 rounded-lg border border-[#E4E7EF] dark:border-[#262A38] bg-transparent text-[13px]"
                    >
                      <option value="">— Any status (no stage gate) —</option>
                      {NURTURE_STATUSES.map(s => <option key={s} value={s}>{s} → {STATUS_TO_STAGE[s]?.replace(/^./, (c) => c.toUpperCase())}</option>)}
                    </select>
                  )}
                  <p className="text-[10px] text-[#8B92A9] mt-1">
                    Rule only fires when lead's status matches this. Variation index resets to V1 when status changes stage.
                  </p>
                </div>

                {/* ── MSG91 template sync ──────────────────────────────────── */}
                <div className="flex items-center justify-between gap-2 rounded-lg border border-[#E4E7EF] dark:border-[#262A38] px-3 py-2">
                  <div className="text-[11px] text-[#8B92A9]">
                    {tplStats
                      ? <>
                          Templates synced: <b className="text-[#0F1117] dark:text-[#F0F2FA]">{tplStats.total}</b>
                          {" · "}<span className="text-[#38D39F]">{tplStats.approved ?? 0} approved</span>
                          {(tplStats.pending||0) > 0 && <span className="text-[#F5B547] ml-1">· {tplStats.pending} pending</span>}
                          {(tplStats.rejected||0) > 0 && <span className="text-[#DC2626] ml-1">· {tplStats.rejected} rejected</span>}
                        </>
                      : "No templates synced yet — click Sync to fetch them from MSG91."}
                  </div>
                  <button
                    type="button"
                    onClick={syncTemplates}
                    disabled={syncing}
                    className="text-[11px] font-semibold px-3 py-1.5 rounded-lg border border-[#E4E7EF] dark:border-[#262A38] hover:bg-[#F8F9FC] dark:hover:bg-[#13161E] disabled:opacity-50"
                  >
                    {syncing ? "Syncing…" : "Sync from MSG91"}
                  </button>
                </div>
                {syncMsg && (
                  <p className="text-[10px] whitespace-pre-wrap text-[#8B92A9]">{syncMsg}</p>
                )}

                {/* ── Template auto-resolve (always on) ────────────────────── */}
                <div className="rounded-lg border border-[#E4E7EF] dark:border-[#262A38] p-3">
                  <p className="text-[13px] font-semibold">
                    ⚡ Template auto-picked from the lead's industry &amp; service
                  </p>
                  <p className="text-[10px] text-[#8B92A9] mt-1">
                    Builds the approved template name automatically as
                    <code className="mx-1">industry_service_stage_v1…v5</code>
                    — one rule covers all 88 industry × service combinations. No manual
                    template entry needed.
                  </p>

                  {/* ── Repeat-after-V5 toggle ─────────────────────────────── */}
                  <label className="flex items-center gap-2 cursor-pointer select-none mt-3">
                    <input
                      type="checkbox"
                      checked={!!draft.action.whatsapp.repeatVariations}
                      onChange={(e) => setDraft({ ...draft, action: { ...draft.action, whatsapp: { ...draft.action.whatsapp, repeatVariations: e.target.checked } } })}
                      className="w-4 h-4"
                    />
                    <span className="text-[12px] font-semibold">
                      Repeat variations after V5 (cycle back to V1)
                    </span>
                  </label>
                  <p className="text-[10px] text-[#8B92A9] mt-1">
                    {draft.action.whatsapp.repeatVariations
                      ? "ON — after V5, the lead goes back to V1 and keeps getting messages indefinitely."
                      : "OFF (default) — after V5, this rule stops sending to that lead. No wraparound."}
                  </p>

                  <div className="mt-3">
                      <p className="text-[10px] font-semibold text-[#8B92A9] uppercase mb-1">
                        Funnel stage (required)
                        {draft.trigger.statuses.length === 1 && STATUS_TO_STAGE[draft.trigger.statuses[0]] && (
                          <span className="text-[#38D39F] font-normal ml-1">— auto-set, change below if needed</span>
                        )}
                      </p>
                      <select
                        value={draft.action.whatsapp.funnelStage || ""}
                        onChange={(e) => setDraft({ ...draft, action: { ...draft.action, whatsapp: { ...draft.action.whatsapp, funnelStage: e.target.value } } })}
                        className="w-full px-3 py-2 rounded-lg border border-[#E4E7EF] dark:border-[#262A38] bg-transparent text-[13px]"
                      >
                        <option value="">— Select a stage —</option>
                        {FUNNEL_STAGES.map(st => <option key={st.value} value={st.value}>{st.label}</option>)}
                      </select>

                      {draft.action.whatsapp.funnelStage && (
                        <p className="text-[10px] text-[#8B92A9] mt-2">
                          Example for an Interior Designers lead interested in CRM:
                          <code className="ml-1">
                            interior_designers_crm_{draft.action.whatsapp.funnelStage}_v1
                          </code>
                        </p>
                      )}

                      {/* ── Live template preview panel ─────────────────── */}
                      {draft.action.whatsapp.funnelStage && (
                        <div className="mt-3 rounded-lg border border-[#E4E7EF] dark:border-[#262A38] overflow-hidden">
                          <div className="px-3 py-2 bg-[#F8F9FC] dark:bg-[#13161E] flex items-center justify-between flex-wrap gap-2">
                            <p className="text-[10px] font-semibold text-[#8B92A9] uppercase">
                              Preview — pick industry &amp; service to see the actual message
                            </p>
                            <div className="flex gap-2 flex-wrap">
                              <select
                                value={previewIndustry}
                                onChange={e => { setPreviewIndustry(e.target.value); setPreviewVariation(0); }}
                                className="text-[11px] px-2 py-1 rounded border border-[#E4E7EF] dark:border-[#262A38] bg-white dark:bg-[#0F1117]"
                              >
                                <option value="">— Industry —</option>
                                {INDUSTRIES.map(ind => <option key={ind} value={ind}>{ind}</option>)}
                              </select>
                              <select
                                value={previewService}
                                onChange={e => { setPreviewService(e.target.value); setPreviewVariation(0); }}
                                className="text-[11px] px-2 py-1 rounded border border-[#E4E7EF] dark:border-[#262A38] bg-white dark:bg-[#0F1117]"
                              >
                                <option value="">— Service —</option>
                                {SERVICES.map(svc => <option key={svc} value={svc}>{svc}</option>)}
                              </select>
                            </div>
                          </div>

                          {(previewIndustry && previewService) ? (
                              <TemplatePreview
                                industry={previewIndustry}
                                service={previewService}
                                stage={draft.action.whatsapp.funnelStage}
                                variation={previewVariation}
                                templates={templates}
                                onVariationChange={setPreviewVariation}
                              />
                          ) : (
                            <p className="text-[11px] text-[#8B92A9] p-3">
                              Select an industry and service above to preview the exact WhatsApp message for that combination.
                            </p>
                          )}
                        </div>
                      )}

                      {/* Live count of approved templates for this stage */}
                      {tplStats && (() => {
                        const _ac = tplStats.byStage?.[draft.action.whatsapp.funnelStage] || 0;
                        return (<>
                          <p className="text-[10px] text-[#38D39F] mt-2">
                            {_ac} approved template(s) synced from MSG91 for this stage
                            ({tplStats.approved ?? 0} approved of {tplStats.nurture} nurture templates).
                          </p>
                          {(tplStats.pending||0) > 0 && <p className="text-[10px] text-[#F5B547] mt-1">⚠ {tplStats.pending} pending Meta approval — skipped until approved.</p>}
                          {(tplStats.rejected||0) > 0 && <p className="text-[10px] text-[#DC2626] mt-1">✕ {tplStats.rejected} rejected by Meta — cannot be sent.</p>}
                        </>);
                      })()}

                      <p className="text-[10px] text-[#F5B547] mt-2">
                        Leads with no Industry or Service set can&apos;t be matched to a
                        template and are skipped by this rule.
                      </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div>
            <Toggle
              checked={draft.action.email.enabled}
              onChange={(v) => setDraft({ ...draft, action: { ...draft.action, email: { ...draft.action.email, enabled: v } } })}
              label="Send Email"
            />
            {draft.action.email.enabled && (
              <div className="mt-2 space-y-2">
                <input
                  value={draft.action.email.subject}
                  onChange={(e) => setDraft({ ...draft, action: { ...draft.action, email: { ...draft.action.email, subject: e.target.value } } })}
                  placeholder="Subject (supports {{name}})"
                  className="w-full px-3 py-2 rounded-lg border border-[#E4E7EF] dark:border-[#262A38] bg-transparent text-[13px]"
                />
                <textarea
                  value={draft.action.email.bodyTemplate}
                  onChange={(e) => setDraft({ ...draft, action: { ...draft.action, email: { ...draft.action.email, bodyTemplate: e.target.value } } })}
                  placeholder="HTML body (supports {{name}})"
                  rows={4}
                  className="w-full px-3 py-2 rounded-lg border border-[#E4E7EF] dark:border-[#262A38] bg-transparent text-[13px]"
                />
              </div>
            )}
          </div>

          <div>
            <Toggle
              checked={draft.action.notifyAgent}
              onChange={(v) => setDraft({ ...draft, action: { ...draft.action, notifyAgent: v } })}
              label="Also ping the assigned agent internally"
            />
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={save}
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-[#2563EB] text-white text-[13px] font-semibold disabled:opacity-50"
            >
              {saving ? "Saving…" : editingId ? "Save Changes" : "Create Rule"}
            </button>
            {editingId && (
              <button onClick={resetDraft} className="text-[13px] font-semibold text-[#8B92A9]">Cancel</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
