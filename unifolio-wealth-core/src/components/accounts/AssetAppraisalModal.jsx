import React, { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Zap, AlertCircle, CheckCircle, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  generatePlaceholderAppraisal,
  APPRAISA_ASSET_TYPES,
  APPRAISABLE_TYPES,
  calculateNetValue,
} from '@/lib/appraisalEngine';
import {
  METAL_TYPES,
  PURITY_OPTIONS,
  METAL_FORMS,
  WEIGHT_UNITS,
  generateMetalAppraisal,
} from '@/lib/metalPrices';

const ASSET_DETAILS_CONFIG = {
  'Real Estate': [
    { name: 'address', label: 'Address', placeholder: '123 Main St' },
    { name: 'propertyType', label: 'Property Type', placeholder: 'House, Condo, etc.' },
    { name: 'country', label: 'Country', placeholder: 'Canada' },
    { name: 'city', label: 'City', placeholder: 'Toronto' },
    { name: 'province', label: 'Province/State', placeholder: 'ON' },
    { name: 'sqft', label: 'Square Footage', placeholder: '2,500', type: 'number' },
    { name: 'bedrooms', label: 'Bedrooms', placeholder: '3', type: 'number' },
    { name: 'bathrooms', label: 'Bathrooms', placeholder: '2', type: 'number' },
  ],
  'Vehicle': [
    { name: 'vin', label: 'VIN', placeholder: 'Optional' },
    { name: 'make', label: 'Make', placeholder: 'Tesla' },
    { name: 'model', label: 'Model', placeholder: 'Model 3' },
    { name: 'year', label: 'Year', placeholder: '2020', type: 'number' },
    { name: 'mileage', label: 'Mileage (km)', placeholder: '50,000', type: 'number' },
    { name: 'trim', label: 'Trim/Edition', placeholder: 'Long Range' },
    { name: 'condition', label: 'Condition', placeholder: 'Excellent' },
  ],
  'Precious Metals': [
    { name: 'metalType', label: 'Metal Type', placeholder: 'Gold, Silver, Platinum...' },
    { name: 'weight', label: 'Weight (oz)', placeholder: '10', type: 'number' },
    { name: 'purity', label: 'Purity (%)', placeholder: '99.9', type: 'number' },
  ],
  'Watch': [
    { name: 'brand', label: 'Brand', placeholder: 'Omega, Rolex, etc.' },
    { name: 'model', label: 'Model', placeholder: 'Seamaster' },
    { name: 'reference', label: 'Reference Number', placeholder: '2531.80' },
    { name: 'year', label: 'Year', placeholder: '2020', type: 'number' },
    { name: 'condition', label: 'Condition', placeholder: 'Excellent' },
    { name: 'boxPapers', label: 'Box & Papers', placeholder: 'Yes/No' },
  ],
  'Jewelry': [
    { name: 'itemType', label: 'Item Type', placeholder: 'Ring, Necklace, etc.' },
    { name: 'material', label: 'Material', placeholder: 'Gold, Silver, Platinum' },
    { name: 'weight', label: 'Weight (g)', placeholder: '15', type: 'number' },
    { name: 'gemstones', label: 'Gemstones', placeholder: 'Diamond 1.5ct' },
    { name: 'condition', label: 'Condition', placeholder: 'Excellent' },
  ],
  'Collectible': [
    { name: 'itemType', label: 'Item Type', placeholder: 'Comic, Card, Figure, etc.' },
    { name: 'brand', label: 'Brand/Series', placeholder: 'Marvel, Pokemon, etc.' },
    { name: 'itemName', label: 'Item Name', placeholder: 'Amazing Fantasy #15' },
    { name: 'year', label: 'Year', placeholder: '1962', type: 'number' },
    { name: 'condition', label: 'Condition', placeholder: 'Mint, Near Mint, Fine' },
  ],
  'Art': [
    { name: 'artist', label: 'Artist Name', placeholder: 'Artist name' },
    { name: 'title', label: 'Title', placeholder: 'Artwork title' },
    { name: 'medium', label: 'Medium', placeholder: 'Oil on canvas' },
    { name: 'year', label: 'Year', placeholder: '1990', type: 'number' },
    { name: 'dimensions', label: 'Dimensions (cm)', placeholder: '100 x 80' },
  ],
  'Other': [
    { name: 'description', label: 'Description', placeholder: 'Describe the asset' },
  ],
};

export default function AssetAppraisalModal({ onClose, onSave, initialData }) {
  const [step, setStep] = useState(1);
  const [assetType, setAssetType] = useState(initialData?.asset_type || '');
  const [assetName, setAssetName] = useState(initialData?.asset_name || '');
  const [assetDetails, setAssetDetails] = useState(initialData?.asset_details || {});
  const [userValue, setUserValue] = useState(initialData?.user_entered_value || null);
  const [appraisal, setAppraisal] = useState(null);
  const [chosenValue, setChosenValue] = useState(null);
  const [chosenValueSource, setChosenValueSource] = useState(null);
  const [currency, setCurrency] = useState(initialData?.currency || 'USD');
  const [notes, setNotes] = useState(initialData?.notes || '');

  const isAppraiseble = assetType && APPRAISABLE_TYPES[assetType]?.appraisable;
  const isMetal = assetType === 'Precious Metals';
  const detailsConfig = isMetal ? [] : (ASSET_DETAILS_CONFIG[assetType] || []);

  // Generate appraisal when details change
  const generatedAppraisal = useMemo(() => {
    if (!isAppraiseble || !assetName) return null;
    
    if (isMetal) {
      const weight = parseFloat(assetDetails.weight) || 0;
      const weightUnit = assetDetails.weightUnit || 'gram';
      const purity = parseFloat(assetDetails.purity) || 0;
      const metalType = assetDetails.metalType || 'Gold';
      return generateMetalAppraisal(metalType, weight, weightUnit, purity, userValue);
    }
    
    return generatePlaceholderAppraisal(assetType, assetDetails, userValue);
  }, [assetType, assetDetails, userValue, isAppraiseble, assetName, isMetal]);

  const handleDetailChange = (fieldName, value) => {
    setAssetDetails(prev => ({ ...prev, [fieldName]: value }));
  };

  const handleNext = () => {
    if (step === 1 && !assetType) return;
    if (step === 2 && !assetName) return;
    if (step === 3 && isAppraiseble && !generatedAppraisal) return;
    
    if (step === 3) {
      setAppraisal(generatedAppraisal);
    }
    setStep(step + 1);
  };

  const handlePrevious = () => setStep(Math.max(1, step - 1));

  const handleSelectValue = (source, value) => {
    setChosenValue(value);
    setChosenValueSource(source);
  };

  const handleSave = () => {
    if (!chosenValue) return;

    const netValue = calculateNetValue(chosenValue, 100, 0);
    const discrepancy = userValue && appraisal ? {
      amount: userValue - appraisal.midValue,
      percent: ((userValue - appraisal.midValue) / appraisal.midValue) * 100,
    } : null;

    const assetData = {
      asset_name: assetName,
      asset_type: assetType,
      asset_details: assetDetails,
      user_entered_value: userValue,
      chosen_value: chosenValue,
      chosen_value_source: chosenValueSource,
      currency,
      notes,
      net_value: netValue,
      include_in_net_value: true,
      ...(appraisal && {
        appraisal_method: 'Manual with Comparison',
        appraisal_provider: appraisal.provider,
        appraisal_status: appraisal.status,
        appraisal_confidence: appraisal.confidence,
        appraised_low_value: appraisal.lowValue,
        appraised_mid_value: appraisal.midValue,
        appraised_high_value: appraisal.highValue,
        discrepancy_percent: discrepancy?.percent || 0,
        discrepancy_warning: appraisal.discrepancyWarning,
        appraisal_last_checked: new Date().toISOString(),
      }),
    };

    onSave(assetData);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-card rounded-2xl border border-border w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-card border-b border-border px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Add Custom Asset</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">✕</button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Step 1: Asset Type */}
          {step === 1 && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold">What type of asset is this?</h3>
              <div className="grid grid-cols-2 gap-3">
                {APPRAISA_ASSET_TYPES.map(type => {
                  const config = APPRAISABLE_TYPES[type];
                  const isAppraisable = config?.appraisable;
                  return (
                    <button
                      key={type}
                      onClick={() => setAssetType(type)}
                      className={cn(
                        'p-3 rounded-lg border-2 transition-all text-left text-xs font-medium',
                        assetType === type
                          ? 'border-primary bg-primary/10 text-foreground'
                          : 'border-border hover:border-primary/50'
                      )}
                    >
                      <div>{type}</div>
                      {isAppraisable && (
                        <div className="text-[10px] text-emerald-400 mt-1 flex items-center gap-1">
                          <Zap className="w-2.5 h-2.5" /> Auto-appraisable
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Step 2: Asset Name & Details */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold mb-2 block">Asset Name</label>
                <Input
                  placeholder={isMetal ? "e.g., Gold Bars, Silver Coins" : "e.g., Main Residence, 2020 Tesla Model 3"}
                  value={assetName}
                  onChange={e => setAssetName(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>

              {isMetal ? (
                <div className="space-y-3">
                  <label className="text-xs font-semibold block">Metal Details</label>
                  <div className="space-y-3">
                    {/* Metal Type */}
                    <div>
                      <label className="text-[10px] text-muted-foreground block mb-1">Metal Type</label>
                      <select
                        value={assetDetails.metalType || 'Gold'}
                        onChange={e => handleDetailChange('metalType', e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-border bg-background text-xs"
                      >
                        {METAL_TYPES.map(m => <option key={m}>{m}</option>)}
                      </select>
                    </div>

                    {/* Weight & Unit */}
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-[10px] text-muted-foreground block mb-1">Weight</label>
                        <Input
                          type="number"
                          placeholder="100"
                          value={assetDetails.weight || ''}
                          onChange={e => handleDetailChange('weight', e.target.value)}
                          className="h-8 text-xs"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="text-[10px] text-muted-foreground block mb-1">Unit</label>
                        <select
                          value={assetDetails.weightUnit || 'gram'}
                          onChange={e => handleDetailChange('weightUnit', e.target.value)}
                          className="w-full px-3 py-2 rounded-lg border border-border bg-background text-xs"
                        >
                          {WEIGHT_UNITS.map(u => <option key={u.id} value={u.id}>{u.label}</option>)}
                        </select>
                      </div>
                    </div>

                    {/* Purity */}
                    <div>
                      <label className="text-[10px] text-muted-foreground block mb-1">Purity</label>
                      <select
                        value={assetDetails.purity || 'custom'}
                        onChange={e => {
                          const val = e.target.value;
                          if (val === 'custom') {
                            handleDetailChange('purityCustom', true);
                          } else {
                            handleDetailChange('purity', parseFloat(val));
                          }
                        }}
                        className="w-full px-3 py-2 rounded-lg border border-border bg-background text-xs"
                      >
                        {(PURITY_OPTIONS[assetDetails.metalType || 'Gold'] || []).map(p => (
                          <option key={p.value} value={p.value}>{p.label}</option>
                        ))}
                      </select>
                    </div>

                    {/* Custom Purity Input */}
                    {assetDetails.purityCustom && (
                      <div>
                        <label className="text-[10px] text-muted-foreground block mb-1">Purity %</label>
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          placeholder="99.9"
                          value={assetDetails.purityPercent || ''}
                          onChange={e => {
                            const pct = parseFloat(e.target.value) || 0;
                            handleDetailChange('purity', pct / 100);
                            handleDetailChange('purityPercent', e.target.value);
                          }}
                          className="h-8 text-xs"
                        />
                      </div>
                    )}

                    {/* Form */}
                    <div>
                      <label className="text-[10px] text-muted-foreground block mb-1">Form</label>
                      <select
                        value={assetDetails.form || 'Bullion'}
                        onChange={e => handleDetailChange('form', e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-border bg-background text-xs"
                      >
                        {METAL_FORMS.map(f => <option key={f}>{f}</option>)}
                      </select>
                    </div>

                    {/* Storage nickname */}
                    <div>
                      <label className="text-[10px] text-muted-foreground block mb-1">Storage Nickname (Optional)</label>
                      <Input
                        placeholder="e.g., Home safe, Bank vault"
                        value={assetDetails.storageNickname || ''}
                        onChange={e => handleDetailChange('storageNickname', e.target.value)}
                        className="h-8 text-xs"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                detailsConfig.length > 0 && (
                  <div className="space-y-3">
                    <label className="text-xs font-semibold block">Asset Details</label>
                    <div className="grid grid-cols-2 gap-3">
                      {detailsConfig.map(field => (
                        <div key={field.name}>
                          <label className="text-[10px] text-muted-foreground block mb-1">{field.label}</label>
                          <Input
                            type={field.type || 'text'}
                            placeholder={field.placeholder}
                            value={assetDetails[field.name] || ''}
                            onChange={e => handleDetailChange(field.name, e.target.value)}
                            className="h-8 text-xs"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )
              )}
            </div>
          )}

          {/* Step 3: Value Entry */}
          {step === 3 && (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold mb-2 block">
                  {isAppraiseble ? 'Your Estimated Value (Optional)' : 'Enter Asset Value *'}
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{currency}</span>
                  <Input
                    type="number"
                    placeholder="0"
                    value={userValue || ''}
                    onChange={e => setUserValue(e.target.value ? parseFloat(e.target.value) : null)}
                    className="h-9 text-xs flex-1"
                  />
                </div>
              </div>

              {isAppraiseble && (
                <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 text-xs text-primary/80">
                  <div className="flex items-start gap-2">
                    <Zap className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                    <span>Auto-appraisal available for {assetType}. Click Next to see results.</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 4: Appraisal Results */}
          {step === 4 && appraisal && (
            <div className="space-y-4">
              {appraisal.appraisable ? (
                <>
                  {isMetal && appraisal.metalDetails && (
                    <div className="p-3 rounded-lg bg-secondary/40 space-y-1.5 text-xs">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Metal:</span>
                        <span className="font-semibold">{appraisal.metalDetails.metal_type}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Weight:</span>
                        <span className="font-mono">{appraisal.metalDetails.weight} {appraisal.metalDetails.weight_unit.replace('_', ' ')}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Troy Ounces:</span>
                        <span className="font-mono">{appraisal.metalDetails.troy_ounces} oz t</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Purity:</span>
                        <span className="font-mono">{(appraisal.metalDetails.purity * 100).toFixed(1)}%</span>
                      </div>
                      <div className="flex justify-between border-t border-border/30 pt-1.5 mt-1.5">
                        <span className="text-muted-foreground">Pure Metal:</span>
                        <span className="font-mono font-semibold">{appraisal.metalDetails.pure_metal_oz} oz t</span>
                      </div>
                    </div>
                  )}

                  <div>
                    <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-emerald-400" />
                      Valuation
                    </h3>
                    {isMetal ? (
                      <div className="p-4 rounded-lg bg-primary/10 border border-primary/20 space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground text-xs">Spot Price:</span>
                          <span className="text-sm font-semibold font-mono">${appraisal.spotPrice}/oz t</span>
                        </div>
                        <div className="border-t border-primary/20 pt-2 mt-2">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground text-xs">Melt Value:</span>
                            <span className="text-xl font-bold font-mono text-primary">${appraisal.midValue.toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-3 gap-3 mb-4">
                        <div className="p-3 rounded-lg bg-secondary/40">
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Low</p>
                          <p className="text-lg font-bold font-mono">${appraisal.lowValue.toLocaleString()}</p>
                        </div>
                        <div className="p-3 rounded-lg bg-primary/10 border border-primary/30">
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Fair Value</p>
                          <p className="text-lg font-bold font-mono text-primary">${appraisal.midValue.toLocaleString()}</p>
                        </div>
                        <div className="p-3 rounded-lg bg-secondary/40">
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">High</p>
                          <p className="text-lg font-bold font-mono">${appraisal.highValue.toLocaleString()}</p>
                        </div>
                      </div>
                    )}

                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Confidence:</span>
                        <span className="font-semibold">{appraisal.confidence}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Provider:</span>
                        <span className="font-mono text-foreground">{appraisal.provider}</span>
                      </div>
                      {appraisal.sourceData && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Last Updated:</span>
                          <span className="font-mono text-foreground text-[10px]">
                            {new Date(appraisal.sourceData.last_updated).toLocaleDateString()}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {userValue && appraisal.discrepancy && (
                    <div className={cn(
                      'p-3 rounded-lg border flex items-start gap-2',
                      Math.abs(appraisal.discrepancy.percent) >= 15
                        ? 'bg-amber-500/10 border-amber-500/30 text-amber-700'
                        : 'bg-blue-500/10 border-blue-500/30 text-blue-700'
                    )}>
                      <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                      <div className="text-[11px]">
                        <p className="font-semibold">Your value vs appraisal:</p>
                        <p className="mt-1">
                          ${userValue.toLocaleString()} is{' '}
                          <span className="font-bold">
                            {appraisal.discrepancy.percent > 0 ? '+' : ''}{appraisal.discrepancy.percent.toFixed(1)}%
                          </span>
                          {appraisal.discrepancy.percent > 0 ? ' above' : ' below'} fair value.
                        </p>
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="text-xs font-semibold mb-3 block">
                      Choose Value to Use
                    </label>
                    <div className="space-y-2">
                      {[
                        ...(isMetal
                          ? [{ label: 'Melt Value (Recommended)', value: appraisal.midValue, source: 'Auto-Appraised Mid', recommended: true }]
                          : [
                              { label: 'Low Estimate', value: appraisal.lowValue, source: 'Auto-Appraised Low' },
                              { label: 'Fair Value (Recommended)', value: appraisal.midValue, source: 'Auto-Appraised Mid', recommended: true },
                              { label: 'High Estimate', value: appraisal.highValue, source: 'Auto-Appraised High' },
                            ]),
                        ...(userValue ? [{ label: `Manual Value ($${userValue.toLocaleString()})`, value: userValue, source: 'User Entered' }] : []),
                      ].map((option, i) => (
                        <button
                          key={i}
                          onClick={() => handleSelectValue(option.source, option.value)}
                          className={cn(
                            'w-full flex items-center justify-between p-3 rounded-lg border-2 transition-all text-left',
                            chosenValue === option.value
                              ? 'border-primary bg-primary/10'
                              : 'border-border hover:border-primary/30'
                          )}
                        >
                          <div className="flex-1">
                            <div className="text-xs font-semibold flex items-center gap-2">
                              {option.label}
                              {option.recommended && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-600">
                                  Recommended
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="text-sm font-bold font-mono">${option.value.toLocaleString()}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-700">
                  <p className="text-sm font-semibold mb-1">Manual Value Required</p>
                  <p className="text-xs">{assetType} requires manual appraisal or professional assessment.</p>
                </div>
              )}
            </div>
          )}

          {/* Step 5: Notes & Currency */}
          {step === 5 && (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold mb-2 block">Currency</label>
                <select
                  value={currency}
                  onChange={e => setCurrency(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-xs"
                >
                  <option>USD</option>
                  <option>CAD</option>
                  <option>EUR</option>
                  <option>GBP</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold mb-2 block">Notes</label>
                <textarea
                  placeholder="Add any additional notes..."
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-xs h-24 resize-none"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-border px-6 py-4 flex items-center justify-between bg-card">
          <button
            onClick={handlePrevious}
            disabled={step === 1}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-border text-muted-foreground disabled:opacity-50"
          >
            <ChevronLeft className="w-3.5 h-3.5" /> Previous
          </button>

          <span className="text-xs text-muted-foreground">
            Step {step} of {isAppraiseble ? 5 : 4}
          </span>

          <div className="flex items-center gap-2">
            {step < (isAppraiseble ? 5 : 4) ? (
              <Button
                onClick={handleNext}
                size="sm"
                disabled={
                  (step === 1 && !assetType) ||
                  (step === 2 && !assetName) ||
                  (step === 3 && isAppraiseble && !generatedAppraisal)
                }
                className="gap-1.5"
              >
                Next <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            ) : (
              <Button
                onClick={handleSave}
                disabled={!chosenValue}
                className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"
              >
                <CheckCircle className="w-3.5 h-3.5" /> Save Asset
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}