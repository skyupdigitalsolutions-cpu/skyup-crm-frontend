// src/pages/developer/Plans.jsx
// Developer panel page for managing plan definitions:
//   • View all plans with their price and feature matrix
//   • Create new plans
//   • Edit existing plans (name, price, limits, features)
//   • Delete custom plans

import { useEffect, useState, useCallback } from 'react';
import {
  Plus, Pencil, Trash2, ToggleLeft, ToggleRight,
  ChevronDown, ChevronUp, X, Loader2, AlertTriangle,
  DollarSign, Users, Database, Zap, RefreshCw, Check,
  PackageCheck,
} from 'lucide-react';
import api from '../../data/axiosConfig';

// ── All known feature keys — shown in the feature toggle grid ─────────────────
const ALL_FEATURES = [
  { key: 'leads',          label: 'Lead Management'      },
  { key: 'contacts',       label: 'Contacts'             },
  { key: 'basic-reports',  label: 'Basic Reports'        },
  { key: 'attendance',     label: 'Attendance'           },
  { key: 'daily-report',   label: 'Daily Report (Email)' },
  { key: 'sms-blast',      label: 'SMS Blast'            },
  { key: 'whatsapp-blast', label: 'WhatsApp Blast'       },
  { key: 'email-blast',    label: 'Email Blast'          },
  { key: 'campaigns',      label: 'Campaigns'            },
  { key: 'google-ads',     label: 'Google Ads'           },
  { key: 'meta-ads',       label: 'Facebook / Meta Ads'  },
  { key: 'call-recording', label: 'Call Recordings'      },
  { key: 'api-access',     label: 'API / Webhooks'       },
  { key: 'custom-reports', label: 'Custom Reports'       },
  { key: 'white-label',    label: 'White Label'          },
];

// Accent colour options for the plan picker
const COLOR_SWATCHES = [
  '#6B7280', '#2563EB', '#7C3AED', '#059669',
  '#D97706', '#DC2626', '#0891B2', '#DB2777',
];

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

function buildEmptyForm() {
  return {
    planKey:     '',
    name:        '',
    description: '',
    color:       '#2563EB',
    priceMonthly: '',
    priceYearly:  '',
    maxUsers:    '',
    maxLeads:    '',
    sortOrder:   '',
    isActive:    true,
    features: ALL_FEATURES.map(f => ({ key: f.key, label: f.label, enabled: false })),
  };
}

function planToForm(plan) {
  const featureMap = {};
  (plan.features || []).forEach(f => { featureMap[f.key] = f.enabled; });
  return {
    planKey:      plan.planKey      || '',
    name:         plan.name         || '',
    description:  plan.description  || '',
    color:        plan.color        || '#6B7280',
    priceMonthly: plan.price?.monthly ?? '',
    priceYearly:  plan.price?.yearly  ?? '',
    maxUsers:     plan.maxUsers ?? '',
    maxLeads:     plan.maxLeads ?? '',
    sortOrder:    plan.sortOrder ?? '',
    isActive:     plan.isActive !== false,
    features: ALL_FEATURES.map(f => ({
      key:     f.key,
      label:   f.label,
      enabled: featureMap[f.key] ?? false,
    })),
  };
}

function formToPayload(form) {
  return {
    planKey:     form.planKey.trim().toLowerCase().replace(/\s+/g, '-'),
    name:        form.name.trim(),
    description: form.description.trim(),
    color:       form.color,
    price: {
      monthly: Number(form.priceMonthly || 0),
      yearly:  Number(form.priceYearly  || 0),
    },
    maxUsers:  Number(form.maxUsers  || 5),
    maxLeads:  Number(form.maxLeads  || 1000),
    sortOrder: Number(form.sortOrder || 0),
    isActive:  form.isActive,
    features:  form.features,
  };
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
function Skeleton() {
  return (
    <div className="bg-[#F8F9FC] dark:bg-[#0D0F14] min-h-screen px-4 sm:px-6 py-8 animate-pulse">
      <div className="h-7 w-40 bg-[#E5E7EB] dark:bg-[#262A38] rounded-xl mb-2" />
      <div className="h-4 w-64 bg-[#E5E7EB] dark:bg-[#262A38] rounded-xl mb-8" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[0,1,2].map(i => (
          <div key={i} className="bg-white dark:bg-[#1A1D27] border border-[#E5E7EB] dark:border-[#262A38] rounded-2xl h-64" />
        ))}
      </div>
    </div>
  );
}

// ── Feature toggle grid inside the modal ─────────────────────────────────────
function FeatureGrid({ features, onChange }) {
  const toggle = (key) => {
    onChange(features.map(f => f.key === key ? { ...f, enabled: !f.enabled } : f));
  };
  const enabledCount = features.filter(f => f.enabled).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-[11px] font-semibold text-[#6B7280] dark:text-[#565C75] uppercase tracking-wider">
          Features
        </label>
        <span className="text-[11px] text-[#6B7280] dark:text-[#565C75]">
          {enabledCount} / {features.length} enabled
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
        {features.map(f => (
          <button
            key={f.key}
            type="button"
            onClick={() => toggle(f.key)}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border text-left transition-all duration-150 ${
              f.enabled
                ? 'bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/30 text-blue-700 dark:text-blue-300'
                : 'bg-[#F8F9FC] dark:bg-[#13161E] border-[#E5E7EB] dark:border-[#262A38] text-[#6B7280] dark:text-[#565C75]'
            }`}
          >
            {f.enabled
              ? <ToggleRight className="w-4 h-4 shrink-0 text-blue-500" />
              : <ToggleLeft  className="w-4 h-4 shrink-0 opacity-40" />
            }
            <span className="text-[12px] font-medium truncate">{f.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Colour picker ─────────────────────────────────────────────────────────────
function ColorPicker({ value, onChange }) {
  return (
    <div>
      <label className="block text-[11px] font-semibold text-[#6B7280] dark:text-[#565C75] uppercase tracking-wider mb-1.5">
        Plan Colour
      </label>
      <div className="flex items-center gap-2 flex-wrap">
        {COLOR_SWATCHES.map(c => (
          <button
            key={c}
            type="button"
            onClick={() => onChange(c)}
            className={`w-7 h-7 rounded-full border-2 transition-all ${
              value === c ? 'border-[#0F1117] dark:border-white scale-110' : 'border-transparent'
            }`}
            style={{ background: c }}
            title={c}
          />
        ))}
        {/* Custom hex input */}
        <input
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-24 px-2 py-1 rounded-lg border border-[#E5E7EB] dark:border-[#262A38] bg-white dark:bg-[#13161E]
            text-[12px] text-[#0F1117] dark:text-[#F0F2FA] focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="#2563EB"
        />
      </div>
    </div>
  );
}

// ── Field wrapper ─────────────────────────────────────────────────────────────
function Field({ label, children, hint }) {
  return (
    <div>
      <label className="block text-[11px] font-semibold text-[#6B7280] dark:text-[#565C75] uppercase tracking-wider mb-1.5">
        {label}
      </label>
      {children}
      {hint && <p className="mt-1 text-[11px] text-[#9CA3AF] dark:text-[#565C75]">{hint}</p>}
    </div>
  );
}

function Input({ ...props }) {
  return (
    <input
      {...props}
      className={`w-full px-3 py-2 rounded-xl border border-[#E5E7EB] dark:border-[#262A38]
        bg-white dark:bg-[#13161E] text-[13px] text-[#0F1117] dark:text-[#F0F2FA]
        placeholder:text-[#9CA3AF] dark:placeholder:text-[#565C75]
        focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all ${props.className || ''}`}
    />
  );
}

// ── Plan Modal (create / edit) ────────────────────────────────────────────────
function PlanModal({ mode, plan, onClose, onSuccess }) {
  const [form,       setForm]       = useState(() => mode === 'edit' ? planToForm(plan) : buildEmptyForm());
  const [saving,     setSaving]     = useState(false);
  const [error,      setError]      = useState('');
  const [showFeatures, setShowFeatures] = useState(true);

  const setField = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return setError('Plan name is required.');
    if (mode === 'create' && !form.planKey.trim()) return setError('Plan key is required.');
    setSaving(true);
    setError('');
    try {
      const payload = formToPayload(form);
      if (mode === 'create') {
        await api.post('/developer/plans', payload);
      } else {
        await api.put(`/developer/plans/${plan._id}`, payload);
      }
      onSuccess();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save plan.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-8 pb-4 px-4 bg-black/50 backdrop-blur-sm overflow-y-auto">
      <div className="w-full max-w-2xl bg-white dark:bg-[#1A1D27] rounded-2xl shadow-2xl border border-[#E5E7EB] dark:border-[#262A38]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#F0F2FA] dark:border-[#1E2130]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center">
              <PackageCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
            <h2 className="text-[15px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">
              {mode === 'create' ? 'Create New Plan' : `Edit "${plan.name}"`}
            </h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[#F3F4F6] dark:hover:bg-[#262A38] transition-colors">
            <X className="w-4 h-4 text-[#6B7280]" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900">
              <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
              <p className="text-[12px] font-semibold text-red-700 dark:text-red-400">{error}</p>
            </div>
          )}

          {/* Basic info row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Plan Name *">
              <Input
                value={form.name}
                onChange={e => setField('name', e.target.value)}
                placeholder="e.g. Professional"
                required
              />
            </Field>
            <Field label="Plan Key *" hint={mode === 'edit' ? 'Cannot change after creation.' : 'Slug used internally (e.g. "pro")'}>
              <Input
                value={form.planKey}
                onChange={e => setField('planKey', e.target.value)}
                placeholder="e.g. pro"
                disabled={mode === 'edit'}
                className={mode === 'edit' ? 'opacity-60 cursor-not-allowed' : ''}
                required
              />
            </Field>
          </div>

          <Field label="Description">
            <Input
              value={form.description}
              onChange={e => setField('description', e.target.value)}
              placeholder="Short tagline shown on the upgrade page"
            />
          </Field>

          {/* Pricing row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Monthly Price (₹)">
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#9CA3AF]" />
                <Input
                  type="number"
                  min="0"
                  value={form.priceMonthly}
                  onChange={e => setField('priceMonthly', e.target.value)}
                  placeholder="999"
                  className="pl-8"
                />
              </div>
            </Field>
            <Field label="Yearly Price (₹)">
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#9CA3AF]" />
                <Input
                  type="number"
                  min="0"
                  value={form.priceYearly}
                  onChange={e => setField('priceYearly', e.target.value)}
                  placeholder="9990"
                  className="pl-8"
                />
              </div>
            </Field>
          </div>

          {/* Limits row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field label="Max Users">
              <div className="relative">
                <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#9CA3AF]" />
                <Input
                  type="number"
                  min="1"
                  value={form.maxUsers}
                  onChange={e => setField('maxUsers', e.target.value)}
                  placeholder="10"
                  className="pl-8"
                />
              </div>
            </Field>
            <Field label="Max Leads">
              <div className="relative">
                <Database className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#9CA3AF]" />
                <Input
                  type="number"
                  min="1"
                  value={form.maxLeads}
                  onChange={e => setField('maxLeads', e.target.value)}
                  placeholder="5000"
                  className="pl-8"
                />
              </div>
            </Field>
            <Field label="Sort Order" hint="Lower = first on list">
              <Input
                type="number"
                min="0"
                value={form.sortOrder}
                onChange={e => setField('sortOrder', e.target.value)}
                placeholder="0"
              />
            </Field>
          </div>

          {/* Colour + active */}
          <div className="flex flex-wrap items-center gap-4 justify-between">
            <ColorPicker value={form.color} onChange={v => setField('color', v)} />
            <div className="flex items-center gap-2">
              <span className="text-[12px] font-semibold text-[#6B7280] dark:text-[#565C75]">Active</span>
              <button
                type="button"
                onClick={() => setField('isActive', !form.isActive)}
                className="focus:outline-none"
              >
                {form.isActive
                  ? <ToggleRight className="w-8 h-8 text-green-500" />
                  : <ToggleLeft  className="w-8 h-8 text-[#9CA3AF]" />
                }
              </button>
            </div>
          </div>

          {/* Features */}
          <div className="border border-[#E5E7EB] dark:border-[#262A38] rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setShowFeatures(v => !v)}
              className="w-full flex items-center justify-between px-4 py-3 bg-[#F8F9FC] dark:bg-[#13161E] hover:bg-[#F3F4F6] dark:hover:bg-[#1A1D27] transition-colors"
            >
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-blue-500" />
                <span className="text-[13px] font-semibold text-[#0F1117] dark:text-[#F0F2FA]">Feature Toggles</span>
                <span className="text-[11px] text-[#6B7280] dark:text-[#565C75]">
                  ({form.features.filter(f => f.enabled).length}/{form.features.length})
                </span>
              </div>
              {showFeatures ? <ChevronUp className="w-4 h-4 text-[#6B7280]" /> : <ChevronDown className="w-4 h-4 text-[#6B7280]" />}
            </button>
            {showFeatures && (
              <div className="p-4">
                <FeatureGrid
                  features={form.features}
                  onChange={feats => setField('features', feats)}
                />
                {/* Quick-select buttons */}
                <div className="flex gap-2 mt-3">
                  <button
                    type="button"
                    onClick={() => setField('features', form.features.map(f => ({ ...f, enabled: true })))}
                    className="text-[11px] font-semibold px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-500/20 transition-colors"
                  >
                    Enable All
                  </button>
                  <button
                    type="button"
                    onClick={() => setField('features', form.features.map(f => ({ ...f, enabled: false })))}
                    className="text-[11px] font-semibold px-3 py-1.5 rounded-lg bg-[#F3F4F6] dark:bg-[#262A38] text-[#6B7280] dark:text-[#9DA3BB] hover:bg-[#E5E7EB] dark:hover:bg-[#2E3347] transition-colors"
                  >
                    Disable All
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-[#F0F2FA] dark:border-[#1E2130]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-[13px] font-semibold text-[#6B7280] dark:text-[#9DA3BB]
                bg-[#F3F4F6] dark:bg-[#262A38] hover:bg-[#E5E7EB] dark:hover:bg-[#2E3347] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 rounded-xl text-[13px] font-semibold text-white bg-blue-600 hover:bg-blue-700
                disabled:opacity-60 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {mode === 'create' ? 'Create Plan' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Delete confirmation modal ─────────────────────────────────────────────────
function DeleteModal({ plan, onClose, onSuccess }) {
  const [deleting, setDeleting] = useState(false);
  const [error,    setError]    = useState('');

  const handleDelete = async () => {
    setDeleting(true);
    setError('');
    try {
      await api.delete(`/developer/plans/${plan._id}`);
      onSuccess();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete plan.');
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-sm bg-white dark:bg-[#1A1D27] rounded-2xl shadow-2xl border border-[#E5E7EB] dark:border-[#262A38] p-6">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-500/10 flex items-center justify-center shrink-0">
            <Trash2 className="w-5 h-5 text-red-600 dark:text-red-400" />
          </div>
          <div>
            <h2 className="text-[15px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">Delete Plan</h2>
            <p className="text-[12px] text-[#6B7280] dark:text-[#565C75]">This cannot be undone.</p>
          </div>
        </div>
        <p className="text-[13px] text-[#4B5563] dark:text-[#9DA3BB] mb-4">
          Are you sure you want to delete <strong>{plan.name}</strong>? Companies currently on this plan will not be affected, but the plan will no longer be selectable.
        </p>
        {error && (
          <p className="text-[12px] text-red-600 dark:text-red-400 mb-3">{error}</p>
        )}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-xl text-[13px] font-semibold text-[#6B7280] dark:text-[#9DA3BB]
              bg-[#F3F4F6] dark:bg-[#262A38] hover:bg-[#E5E7EB] dark:hover:bg-[#2E3347] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="flex-1 py-2 rounded-xl text-[13px] font-semibold text-white bg-red-600 hover:bg-red-700
              disabled:opacity-60 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {deleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Plan Card ─────────────────────────────────────────────────────────────────
function PlanCard({ plan, onEdit, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const enabledFeatures  = (plan.features || []).filter(f => f.enabled);
  const disabledFeatures = (plan.features || []).filter(f => !f.enabled);

  return (
    <div className="bg-white dark:bg-[#1A1D27] border border-[#E5E7EB] dark:border-[#262A38] rounded-2xl overflow-hidden
      hover:shadow-md transition-all duration-200">

      {/* Accent bar */}
      <div className="h-1 w-full" style={{ background: plan.color || '#6B7280' }} />

      {/* Top section */}
      <div className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className="text-[11px] font-bold px-2 py-0.5 rounded-full text-white"
                style={{ background: plan.color || '#6B7280' }}
              >
                {plan.planKey?.toUpperCase()}
              </span>
              {!plan.isActive && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-500/10 text-gray-500 dark:text-gray-400">
                  Inactive
                </span>
              )}
            </div>
            <h3 className="text-[16px] font-bold text-[#0F1117] dark:text-[#F0F2FA] mt-1 truncate">
              {plan.name}
            </h3>
            {plan.description && (
              <p className="text-[12px] text-[#6B7280] dark:text-[#565C75] mt-0.5 line-clamp-1">{plan.description}</p>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => onEdit(plan)}
              className="p-2 rounded-xl bg-[#F3F4F6] dark:bg-[#262A38] hover:bg-blue-50 dark:hover:bg-blue-500/10
                text-[#6B7280] hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
              title="Edit plan"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onDelete(plan)}
              className="p-2 rounded-xl bg-[#F3F4F6] dark:bg-[#262A38] hover:bg-red-50 dark:hover:bg-red-500/10
                text-[#6B7280] hover:text-red-600 dark:hover:text-red-400 transition-colors"
              title="Delete plan"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Pricing */}
        <div className="flex items-end gap-1 mb-3">
          <span className="text-[24px] font-bold text-[#0F1117] dark:text-[#F0F2FA] tabular-nums leading-none">
            {fmt(plan.price?.monthly)}
          </span>
          <span className="text-[12px] text-[#6B7280] dark:text-[#565C75] mb-0.5">/mo</span>
          {plan.price?.yearly > 0 && (
            <span className="text-[11px] text-[#9CA3AF] dark:text-[#565C75] ml-2 mb-0.5">
              · {fmt(plan.price.yearly)}/yr
            </span>
          )}
        </div>

        {/* Limits row */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="flex items-center gap-2 bg-[#F8F9FC] dark:bg-[#13161E] rounded-xl px-3 py-2">
            <Users className="w-3.5 h-3.5 text-purple-500 shrink-0" />
            <span className="text-[12px] font-semibold text-[#4B5563] dark:text-[#9DA3BB]">
              {plan.maxUsers >= 999 ? 'Unlimited' : plan.maxUsers} users
            </span>
          </div>
          <div className="flex items-center gap-2 bg-[#F8F9FC] dark:bg-[#13161E] rounded-xl px-3 py-2">
            <Database className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <span className="text-[12px] font-semibold text-[#4B5563] dark:text-[#9DA3BB]">
              {plan.maxLeads >= 999999 ? 'Unlimited' : Number(plan.maxLeads).toLocaleString('en-IN')} leads
            </span>
          </div>
        </div>

        {/* Feature summary */}
        <div className="text-[11px] text-[#6B7280] dark:text-[#565C75] mb-2">
          <span className="font-semibold text-green-600 dark:text-green-400">{enabledFeatures.length}</span> features enabled
          {disabledFeatures.length > 0 && (
            <>, <span className="font-semibold text-[#9CA3AF]">{disabledFeatures.length}</span> disabled</>
          )}
        </div>

        {/* Expand toggle */}
        <button
          onClick={() => setExpanded(v => !v)}
          className="w-full flex items-center justify-center gap-1 py-1.5 rounded-xl text-[11px] font-semibold
            text-[#6B7280] dark:text-[#565C75] hover:text-[#0F1117] dark:hover:text-[#F0F2FA]
            hover:bg-[#F3F4F6] dark:hover:bg-[#262A38] transition-colors"
        >
          {expanded ? 'Hide features' : 'Show features'}
          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Expanded feature list */}
      {expanded && (
        <div className="border-t border-[#F0F2FA] dark:border-[#1E2130] px-4 pb-4 pt-3">
          <div className="grid grid-cols-1 gap-1">
            {ALL_FEATURES.map(f => {
              const enabled = (plan.features || []).find(x => x.key === f.key)?.enabled ?? false;
              return (
                <div key={f.key} className={`flex items-center gap-2 text-[12px] ${
                  enabled ? 'text-[#0F1117] dark:text-[#F0F2FA]' : 'text-[#9CA3AF] dark:text-[#565C75] line-through'
                }`}>
                  <Check className={`w-3.5 h-3.5 shrink-0 ${enabled ? 'text-green-500' : 'text-[#D1D5DB] dark:text-[#374151]'}`} />
                  {f.label}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function Plans() {
  const [plans,      setPlans]      = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error,      setError]      = useState('');

  // Modal state
  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState(null);   // plan to edit
  const [deleteTarget, setDeleteTarget] = useState(null); // plan to delete

  const loadPlans = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else           setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/developer/plans');
      setPlans(data.plans || []);
    } catch {
      setError('Failed to load plans. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadPlans(); }, [loadPlans]);

  const handleSuccess = () => {
    setShowCreate(false);
    setEditTarget(null);
    setDeleteTarget(null);
    loadPlans(true);
  };

  if (loading) return <Skeleton />;

  return (
    <div className="bg-[#F8F9FC] dark:bg-[#0D0F14] min-h-screen font-poppins px-4 sm:px-6 py-6 sm:py-8">

      {/* ── Header ── */}
      <div className="flex flex-wrap items-start sm:items-center justify-between gap-3 mb-6 sm:mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h1 className="text-[20px] sm:text-[24px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">Plan Management</h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide
              bg-violet-100 dark:bg-violet-500/15 text-violet-700 dark:text-violet-400 shrink-0">
              Developer
            </span>
          </div>
          <p className="text-[12px] sm:text-[13px] text-[#6B7280] dark:text-[#565C75]">
            Create and edit plans, set pricing and feature access
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => loadPlans(true)}
            disabled={refreshing}
            className={`p-2 rounded-xl border border-[#E5E7EB] dark:border-[#262A38] bg-white dark:bg-[#1A1D27]
              text-[#6B7280] hover:text-blue-600 dark:hover:text-blue-400 hover:border-blue-300 dark:hover:border-blue-700
              transition-all duration-150 ${refreshing ? 'opacity-60 cursor-not-allowed' : ''}`}
            aria-label="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700
              text-white text-[13px] font-semibold transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>New Plan</span>
          </button>
        </div>
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="flex items-center justify-between gap-4 p-4 mb-6 rounded-2xl
          bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900">
          <div className="flex items-center gap-3 min-w-0">
            <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
            <p className="text-[13px] font-semibold text-red-700 dark:text-red-400 truncate">{error}</p>
          </div>
          <button
            onClick={() => loadPlans()}
            className="text-[12px] font-bold text-red-600 dark:text-red-400 underline underline-offset-2 shrink-0"
          >
            Retry
          </button>
        </div>
      )}

      {/* ── Plans grid ── */}
      {plans.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <PackageCheck className="w-10 h-10 text-[#D1D5DB] dark:text-[#374151]" />
          <p className="text-[14px] font-semibold text-[#6B7280] dark:text-[#565C75]">No plans yet</p>
          <p className="text-[12px] text-[#9CA3AF] dark:text-[#565C75]">
            Create your first plan or wait for defaults to be seeded.
          </p>
          <button
            onClick={() => setShowCreate(true)}
            className="mt-2 flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-[13px] font-semibold transition-colors"
          >
            <Plus className="w-4 h-4" /> Create Plan
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {plans.map(plan => (
            <PlanCard
              key={plan._id}
              plan={plan}
              onEdit={p => setEditTarget(p)}
              onDelete={p => setDeleteTarget(p)}
            />
          ))}
        </div>
      )}

      {/* ── Modals ── */}
      {showCreate && (
        <PlanModal
          mode="create"
          onClose={() => setShowCreate(false)}
          onSuccess={handleSuccess}
        />
      )}
      {editTarget && (
        <PlanModal
          mode="edit"
          plan={editTarget}
          onClose={() => setEditTarget(null)}
          onSuccess={handleSuccess}
        />
      )}
      {deleteTarget && (
        <DeleteModal
          plan={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onSuccess={handleSuccess}
        />
      )}
    </div>
  );
}
