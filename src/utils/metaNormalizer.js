// frontend/src/utils/metaNormalizer.js
// ─────────────────────────────────────────────────────────────────────────────
// Normalizes raw Meta API / backend responses into a consistent
// Campaign → Ad Set → Ad hierarchy before the UI renders them.
//
// FIX: Previously the Campaigns page received a flat or inconsistently
// structured array and had to guess at nesting — causing campaigns, adsets
// and ads to be mixed together on the same level.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Normalize a raw Meta campaigns array into the canonical hierarchy:
 *
 *   Campaign
 *     └── adsets[]
 *           └── ads[]
 *
 * Safe to call with null / undefined / empty arrays.
 *
 * @param {any[]} rawCampaigns - Array of campaign objects from backend / Meta API
 * @returns {NormalizedCampaign[]}
 */
export function normalizeMetaCampaigns(rawCampaigns) {
  if (!Array.isArray(rawCampaigns)) return [];

  return rawCampaigns
    .filter(Boolean)
    .map((campaign) => normalizeCampaign(campaign));
}

// ── Internal normalizers ──────────────────────────────────────────────────────

function normalizeCampaign(raw) {
  // Meta API returns adsets under campaign.adsets.data
  // Our backend may return campaign.adsets directly as an array
  const rawAdsets =
    raw?.adsets?.data ??   // Meta API nested shape
    raw?.adsets      ??    // backend flattened
    [];

  return {
    id:           String(raw?.id ?? raw?._id ?? ''),
    name:         raw?.name         ?? 'Unnamed Campaign',
    status:       raw?.status       ?? raw?.effective_status ?? 'UNKNOWN',
    objective:    raw?.objective    ?? '',
    buyingType:   raw?.buying_type  ?? '',
    startTime:    raw?.start_time   ?? raw?.startTime   ?? null,
    stopTime:     raw?.stop_time    ?? raw?.stopTime    ?? null,
    dailyBudget:  raw?.daily_budget ?? raw?.dailyBudget ?? null,
    lifetimeBudget: raw?.lifetime_budget ?? raw?.lifetimeBudget ?? null,
    spend:        raw?.insights?.data?.[0]?.spend ?? raw?.spend ?? null,
    reach:        raw?.insights?.data?.[0]?.reach ?? raw?.reach ?? null,
    impressions:  raw?.insights?.data?.[0]?.impressions ?? raw?.impressions ?? null,
    clicks:       raw?.insights?.data?.[0]?.clicks ?? raw?.clicks ?? null,
    leads:        raw?.insights?.data?.[0]?.leads  ?? raw?.leads  ?? null,
    adsets:       Array.isArray(rawAdsets) ? rawAdsets.filter(Boolean).map(normalizeAdset) : [],
    _raw:         raw,
  };
}

function normalizeAdset(raw) {
  const rawAds =
    raw?.ads?.data ??   // Meta API nested
    raw?.ads      ??    // backend flattened
    [];

  return {
    id:             String(raw?.id ?? raw?._id ?? ''),
    name:           raw?.name            ?? 'Unnamed Ad Set',
    status:         raw?.status          ?? raw?.effective_status ?? 'UNKNOWN',
    targetingSpec:  raw?.targeting       ?? null,
    optimizationGoal: raw?.optimization_goal ?? '',
    billingEvent:   raw?.billing_event   ?? '',
    bidAmount:      raw?.bid_amount      ?? null,
    dailyBudget:    raw?.daily_budget    ?? raw?.dailyBudget    ?? null,
    startTime:      raw?.start_time      ?? raw?.startTime      ?? null,
    endTime:        raw?.end_time        ?? raw?.endTime        ?? null,
    spend:          raw?.insights?.data?.[0]?.spend       ?? raw?.spend       ?? null,
    reach:          raw?.insights?.data?.[0]?.reach       ?? raw?.reach       ?? null,
    impressions:    raw?.insights?.data?.[0]?.impressions ?? raw?.impressions ?? null,
    clicks:         raw?.insights?.data?.[0]?.clicks      ?? raw?.clicks      ?? null,
    leads:          raw?.insights?.data?.[0]?.leads       ?? raw?.leads       ?? null,
    ads:            Array.isArray(rawAds) ? rawAds.filter(Boolean).map(normalizeAd) : [],
    _raw:           raw,
  };
}

function normalizeAd(raw) {
  return {
    id:         String(raw?.id ?? raw?._id ?? ''),
    name:       raw?.name      ?? 'Unnamed Ad',
    status:     raw?.status    ?? raw?.effective_status ?? 'UNKNOWN',
    creativeId: raw?.creative?.id ?? raw?.creative_id   ?? null,
    previewUrl: raw?.preview_url  ?? raw?.previewUrl    ?? null,
    spend:      raw?.insights?.data?.[0]?.spend       ?? raw?.spend       ?? null,
    reach:      raw?.insights?.data?.[0]?.reach       ?? raw?.reach       ?? null,
    impressions:raw?.insights?.data?.[0]?.impressions ?? raw?.impressions ?? null,
    clicks:     raw?.insights?.data?.[0]?.clicks      ?? raw?.clicks      ?? null,
    leads:      raw?.insights?.data?.[0]?.leads       ?? raw?.leads       ?? null,
    _raw:       raw,
  };
}

// ── Status helpers ────────────────────────────────────────────────────────────

export const META_STATUS_STYLE = {
  ACTIVE:    { bg: 'bg-[#ECFDF5] dark:bg-[#052E1C]', text: 'text-[#059669] dark:text-[#34D399]', dot: '#059669' },
  PAUSED:    { bg: 'bg-[#FFFBEB] dark:bg-[#2D1F00]', text: 'text-[#D97706] dark:text-[#FCD34D]', dot: '#D97706' },
  ARCHIVED:  { bg: 'bg-[#F1F5F9] dark:bg-[#1A1D27]', text: 'text-[#8B92A9] dark:text-[#565C75]', dot: '#8B92A9' },
  DELETED:   { bg: 'bg-[#FEF2F2] dark:bg-[#2D0A0A]', text: 'text-[#DC2626] dark:text-[#F87171]', dot: '#DC2626' },
  UNKNOWN:   { bg: 'bg-[#F1F5F9] dark:bg-[#1A1D27]', text: 'text-[#8B92A9] dark:text-[#565C75]', dot: '#8B92A9' },
};

export function getMetaStatusStyle(status) {
  return META_STATUS_STYLE[status?.toUpperCase()] ?? META_STATUS_STYLE.UNKNOWN;
}

/**
 * Summarize totals across all campaigns (for KPI cards).
 */
export function summarizeCampaigns(campaigns) {
  let totalCampaigns = campaigns.length;
  let totalAdsets    = 0;
  let totalAds       = 0;
  let totalLeads     = 0;
  let totalSpend     = 0;
  let activeCampaigns = 0;

  for (const c of campaigns) {
    if (c.status === 'ACTIVE') activeCampaigns++;
    totalLeads += Number(c.leads  || 0);
    totalSpend += Number(c.spend  || 0);
    for (const as of c.adsets) {
      totalAdsets++;
      totalLeads += Number(as.leads || 0);
      totalSpend += Number(as.spend || 0);
      for (const ad of as.ads) {
        totalAds++;
        totalLeads += Number(ad.leads || 0);
        totalSpend += Number(ad.spend || 0);
      }
    }
  }

  return {
    totalCampaigns, activeCampaigns,
    totalAdsets, totalAds,
    totalLeads, totalSpend: totalSpend.toFixed(2),
    cpl: totalLeads > 0 ? (totalSpend / totalLeads).toFixed(2) : '—',
  };
}
