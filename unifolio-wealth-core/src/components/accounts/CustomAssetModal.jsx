import React, { useState, useEffect } from 'react';
import { X, ChevronRight, ChevronLeft, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import ThemedSwitch from '@/components/ui/switch-themed';
import { cn } from '@/lib/utils';

const ASSET_TYPES = ['Real Estate', 'Vehicle', 'Private Business', 'Collectible', 'Cash', 'Crypto Wallet', 'Precious Metals', 'Private Investment', 'Other'];
const VALUATION_METHODS = ['Manual Estimate', 'Recent Appraisal', 'Purchase Price', 'Market Estimate', 'Other'];
const CURRENCIES = ['USD', 'CAD', 'EUR', 'GBP', 'CHF', 'JPY', 'AUD'];

const ASSET_TYPE_ICONS = {
  'Real Estate': '🏠', 'Vehicle': '🚗', 'Private Business': '💼',
  'Collectible': '🏺', 'Cash': '💵', 'Crypto Wallet': '₿',
  'Precious Metals': '🥇', 'Private Investment': '📈', 'Other': '📦'
};

const STEPS = ['Basic Info', 'Value', 'Ownership', 'Details'];

function calcNet(estimated, ownership, liability) {
  const v = parseFloat(estimated) || 0;
  const o = parseFloat(ownership) ?? 100;
  const l = parseFloat(liability) || 0;
  return (v * (o / 100)) - l;
}

function Field({ label, required, children, hint }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground/60">{hint}</p>}
    </div>
  );
}

export default function CustomAssetModal({ onClose, onSave, initialData = null }) {
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState({});

  const blank = {
    asset_name: '', asset_type: '', description: '',
    estimated_value: '', currency: 'USD', valuation_date: '', valuation_method: 'Manual Estimate',
    ownership_percentage: '100', liability_amount: '0',
    include_in_net_value: true,
    purchase_date: '', purchase_price: '', location: '', notes: ''
  };

  const [form, setForm] = useState(initialData ? {
    ...blank,
    ...initialData,
    estimated_value: String(initialData.estimated_value ?? ''),
    ownership_percentage: String(initialData.ownership_percentage ?? 100),
    liability_amount: String(initialData.liability_amount ?? 0),
    purchase_price: String(initialData.purchase_price ?? ''),
  } : blank);

  const set = (k, v) => { setForm(p => ({ ...p, [k]: v })); setErrors(e => ({ ...e, [k]: null })); };

  const netValue = calcNet(form.estimated_value, form.ownership_percentage, form.liability_amount);

  const validateStep = () => {
    const e = {};
    if (step === 0) {
      if (!form.asset_name.trim()) e.asset_name = 'Required';
      if (!form.asset_type) e.asset_type = 'Required';
    }
    if (step === 1) {
      if (!form.estimated_value || isNaN(parseFloat(form.estimated_value))) e.estimated_value = 'Must be a valid number';
      if (!form.currency) e.currency = 'Required';
    }
    if (step === 2) {
      const o = parseFloat(form.ownership_percentage);
      if (isNaN(o) || o < 0 || o > 100) e.ownership_percentage = 'Must be 0–100';
      if (parseFloat(form.liability_amount) < 0) e.liability_amount = 'Cannot be negative';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const next = () => { if (validateStep()) setStep(s => Math.min(s + 1, STEPS.length - 1)); };
  const back = () => setStep(s => Math.max(s - 1, 0));

  const handleSubmit = () => {
    if (!validateStep()) return;
    const asset = {
      ...form,
      estimated_value: parseFloat(form.estimated_value) || 0,
      ownership_percentage: parseFloat(form.ownership_percentage) ?? 100,
      liability_amount: parseFloat(form.liability_amount) || 0,
      purchase_price: form.purchase_price ? parseFloat(form.purchase_price) : null,
      net_value: netValue,
    };
    onSave(asset);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
          <div>
            <h2 className="font-semibold text-sm">{initialData ? 'Edit Custom Asset' : 'Add Custom Asset'}</h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">{STEPS[step]} — Step {step + 1} of {STEPS.length}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Step pills */}
        <div className="flex gap-1.5 px-6 py-3 border-b border-border flex-shrink-0">
          {STEPS.map((s, i) => (
            <div key={s} className={cn('flex-1 h-1 rounded-full transition-colors', i <= step ? 'bg-primary' : 'bg-border')} />
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* Step 0: Basic Info */}
          {step === 0 && (
            <>
              <Field label="Asset Name" required>
                <Input
                  value={form.asset_name}
                  onChange={e => set('asset_name', e.target.value)}
                  placeholder="e.g. My House, Tesla Model 3"
                  className={cn(errors.asset_name && 'border-red-500')}
                />
                {errors.asset_name && <p className="text-[11px] text-red-400 mt-1">{errors.asset_name}</p>}
              </Field>

              <Field label="Asset Type" required>
                <div className="grid grid-cols-3 gap-2">
                  {ASSET_TYPES.map(type => (
                    <button
                      key={type}
                      onClick={() => set('asset_type', type)}
                      className={cn(
                        'flex flex-col items-center gap-1 px-2 py-2.5 rounded-xl border text-xs transition-all',
                        form.asset_type === type
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border hover:border-primary/40 text-muted-foreground hover:text-foreground'
                      )}
                    >
                      <span className="text-lg">{ASSET_TYPE_ICONS[type]}</span>
                      <span className="text-center leading-tight">{type}</span>
                    </button>
                  ))}
                </div>
                {errors.asset_type && <p className="text-[11px] text-red-400 mt-1">{errors.asset_type}</p>}
              </Field>

              <Field label="Description / Notes">
                <textarea
                  value={form.description}
                  onChange={e => set('description', e.target.value)}
                  placeholder="Optional description..."
                  rows={2}
                  className="w-full bg-input border border-border rounded-md px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </Field>
            </>
          )}

          {/* Step 1: Value */}
          {step === 1 && (
            <>
              <Field label="Estimated Current Value" required>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    value={form.estimated_value}
                    onChange={e => set('estimated_value', e.target.value)}
                    placeholder="0.00"
                    className={cn('flex-1', errors.estimated_value && 'border-red-500')}
                  />
                  <select
                    value={form.currency}
                    onChange={e => set('currency', e.target.value)}
                    className="bg-input border border-border rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                {errors.estimated_value && <p className="text-[11px] text-red-400 mt-1">{errors.estimated_value}</p>}
              </Field>

              <Field label="Valuation Date">
                <Input type="date" value={form.valuation_date} onChange={e => set('valuation_date', e.target.value)} />
              </Field>

              <Field label="Valuation Method">
                <div className="grid grid-cols-1 gap-1.5">
                  {VALUATION_METHODS.map(m => (
                    <button
                      key={m}
                      onClick={() => set('valuation_method', m)}
                      className={cn(
                        'text-left px-3 py-2 rounded-lg border text-xs transition-all',
                        form.valuation_method === m
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border hover:border-primary/30 text-muted-foreground hover:text-foreground'
                      )}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </Field>
            </>
          )}

          {/* Step 2: Ownership */}
          {step === 2 && (
            <>
              <Field label="Ownership Percentage" hint="Enter 100 if you own it outright">
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min="0" max="100"
                    value={form.ownership_percentage}
                    onChange={e => set('ownership_percentage', e.target.value)}
                    className={cn('flex-1', errors.ownership_percentage && 'border-red-500')}
                  />
                  <span className="text-sm text-muted-foreground">%</span>
                </div>
                {errors.ownership_percentage && <p className="text-[11px] text-red-400 mt-1">{errors.ownership_percentage}</p>}
              </Field>

              <Field label="Liability / Debt Amount" hint="e.g. mortgage, loan balance. Enter 0 if none.">
                <Input
                  type="number"
                  min="0"
                  value={form.liability_amount}
                  onChange={e => set('liability_amount', e.target.value)}
                  placeholder="0.00"
                  className={cn(errors.liability_amount && 'border-red-500')}
                />
                {errors.liability_amount && <p className="text-[11px] text-red-400 mt-1">{errors.liability_amount}</p>}
              </Field>

              {/* Net value preview */}
              <div className="rounded-xl bg-primary/5 border border-primary/20 p-4 space-y-2">
                <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">Calculated Net Value</p>
                <p className="text-2xl font-bold font-mono text-primary">
                  {netValue < 0 ? '-' : ''}${Math.abs(netValue).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {form.currency}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  ${parseFloat(form.estimated_value || 0).toLocaleString()} × {form.ownership_percentage}% − ${parseFloat(form.liability_amount || 0).toLocaleString()} liability
                </p>
              </div>

              <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary border border-border">
                <ThemedSwitch
                  checked={form.include_in_net_value}
                  onCheckedChange={() => set('include_in_net_value', !form.include_in_net_value)}
                />
                <div>
                  <p className="text-xs font-medium">Include in Net Value</p>
                  <p className="text-[11px] text-muted-foreground">Count this asset toward your total net worth calculation</p>
                </div>
              </div>
            </>
          )}

          {/* Step 3: Optional Details */}
          {step === 3 && (
            <>
              <Field label="Purchase Date">
                <Input type="date" value={form.purchase_date} onChange={e => set('purchase_date', e.target.value)} />
              </Field>
              <Field label="Purchase Price">
                <Input type="number" value={form.purchase_price} onChange={e => set('purchase_price', e.target.value)} placeholder="0.00" />
              </Field>
              <Field label="Location">
                <Input value={form.location} onChange={e => set('location', e.target.value)} placeholder="e.g. Toronto, ON" />
              </Field>
              <Field label="Notes">
                <textarea
                  value={form.notes}
                  onChange={e => set('notes', e.target.value)}
                  placeholder="Any additional notes..."
                  rows={3}
                  className="w-full bg-input border border-border rounded-md px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </Field>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border flex items-center justify-between gap-3 flex-shrink-0">
          <Button variant="ghost" size="sm" onClick={step === 0 ? onClose : back} className="gap-1.5">
            {step === 0 ? <X className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
            {step === 0 ? 'Cancel' : 'Back'}
          </Button>
          {step < STEPS.length - 1 ? (
            <Button size="sm" onClick={next} className="gap-1.5">
              Next <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          ) : (
            <Button size="sm" onClick={handleSubmit} className="gap-1.5">
              <Check className="w-3.5 h-3.5" />
              {initialData ? 'Save Changes' : 'Add Asset'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}