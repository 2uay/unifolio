import React, { useState } from 'react';
import { User, Eye, Shield, Bell, RefreshCw, AlertTriangle, LogOut, Trash2, Download, Lock, Smartphone, Monitor, Coins, CheckCircle2, Clock, Palette, Zap, Sparkles, Pencil, X, Check } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import ThemedSwitch from '@/components/ui/switch-themed';
import { accounts, getInstitution } from '@/lib/mockData';
import PageHeader from '@/components/shared/PageHeader';
import ThemeSelector from '@/components/settings/ThemeSelector';
import CacheManagement from '@/components/settings/CacheManagement';
import ProfilePictureSection from '@/components/settings/ProfilePictureSection';
import { useCurrency } from '@/lib/CurrencyContext';
import { getCurrencyRates, FX_PROVIDER, FX_IS_SAMPLE } from '@/lib/exchangeRates';
import { useAuth } from '@/lib/AuthContext';
import { useLiveData } from '@/lib/LiveDataContext';
import { useAccentBars } from '@/lib/AccentBarsContext';
import Avatar from '@/components/shared/Avatar';
import { cn } from '@/lib/utils';

export default function Settings() {
  const { displayCurrency, setDisplayCurrency, enabledCurrencies, setEnabledCurrencies, allCurrencies } = useCurrency();
  const { user, fullName, logout, updateFullName } = useAuth();
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState('');
  const [nameSaving, setNameSaving] = useState(false);
  const [nameError, setNameError] = useState('');
  const { liveDataEnabled, setLiveDataEnabled } = useLiveData();
  const { accentBarsEnabled, toggleAccentBars } = useAccentBars();
  const [excludedAccounts, setExcludedAccounts] = useState([]);
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [priceAlerts, setPriceAlerts] = useState(true);
  const [twoFactor, setTwoFactor] = useState(false);

  const handleSaveName = async () => {
    const trimmed = nameValue.trim();
    if (!trimmed) { setNameError('Name cannot be empty.'); return; }
    setNameSaving(true);
    setNameError('');
    try {
      await updateFullName(trimmed);
      setEditingName(false);
    } catch (err) {
      setNameError(err.message || 'Failed to update name.');
    } finally {
      setNameSaving(false);
    }
  };

  const toggleAccount = (id) => {
    setExcludedAccounts(prev =>
      prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]
    );
  };

  const toggleEnabledCurrency = (code) => {
    // CAD and USD are always required
    if (code === 'CAD' || code === 'USD') return;
    const newEnabledCurrencies = enabledCurrencies.includes(code)
      ? enabledCurrencies.filter(c => c !== code)
      : [...enabledCurrencies, code];
    setEnabledCurrencies(newEnabledCurrencies);
  };

  const fxRates = getCurrencyRates();

  return (
    <div className="space-y-3 sm:space-y-6 max-w-3xl">
      <PageHeader title="Settings" description="Manage your profile and preferences" />

      {/* Profile Picture */}
      <ProfilePictureSection />

      {/* Account */}
      <div className="bg-card rounded-xl border border-border p-3 sm:p-5 md:p-6 space-y-3 sm:space-y-4">
        <div className="flex items-center gap-2 text-xs sm:text-sm font-medium text-muted-foreground uppercase tracking-wider">
          <User className="w-3 h-3 sm:w-4 sm:h-4" /> Account
        </div>
        <div className="flex items-center gap-2 sm:gap-4 p-2 sm:p-4 rounded-lg bg-secondary/40 border border-border">
          <Avatar user={user} size="md" showRing={true} />
          <div className="min-w-0">
            <p className="text-sm sm:text-base font-semibold truncate">{fullName || 'User'}</p>
            <p className="text-xs sm:text-sm text-muted-foreground truncate">{user?.email}</p>
            <p className="text-[10px] sm:text-xs text-muted-foreground/60 mt-0.5">Role: {user?.role || 'user'}</p>
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-2 sm:gap-4">
          <div>
            <Label className="text-[10px] sm:text-xs text-muted-foreground">Full Name</Label>
            {editingName ? (
              <div className="mt-1 flex items-center gap-1.5">
                <Input
                  autoFocus
                  value={nameValue}
                  onChange={(e) => setNameValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveName();
                    if (e.key === 'Escape') setEditingName(false);
                  }}
                  className="bg-secondary border-border flex-1"
                  disabled={nameSaving}
                />
                <button
                  onClick={handleSaveName}
                  disabled={nameSaving}
                  className="p-1.5 rounded-md text-green-500 hover:bg-green-500/10 transition-colors disabled:opacity-40"
                  title="Save"
                >
                  <Check className="w-4 h-4" />
                </button>
                <button
                  onClick={() => { setEditingName(false); setNameError(''); }}
                  disabled={nameSaving}
                  className="p-1.5 rounded-md text-muted-foreground hover:bg-secondary transition-colors disabled:opacity-40"
                  title="Cancel"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="mt-1 flex items-center gap-1.5">
                <Input value={fullName} className="bg-secondary border-border flex-1" readOnly />
                <button
                  onClick={() => { setNameValue(fullName); setNameError(''); setEditingName(true); }}
                  className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                  title="Edit name"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
            {nameError && <p className="text-xs text-red-400 mt-1">{nameError}</p>}
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Email</Label>
            <Input defaultValue={user?.email || ''} className="mt-1 bg-secondary border-border" readOnly />
          </div>
        </div>
      </div>

      {/* Themes */}
       <div className="bg-card rounded-xl border border-border p-3 sm:p-5 md:p-6 space-y-3 sm:space-y-5">
         <div className="flex items-center gap-2 text-xs sm:text-sm font-medium text-muted-foreground uppercase tracking-wider">
           <Palette className="w-3 h-3 sm:w-4 sm:h-4" /> Themes
         </div>
         <ThemeSelector />
       </div>

       {/* Data Cache Management */}
        <div className="bg-card rounded-xl border border-border p-3 sm:p-5 md:p-6 space-y-3 sm:space-y-5">
          <div className="flex items-center gap-2 text-xs sm:text-sm font-medium text-muted-foreground uppercase tracking-wider">
            <Palette className="w-3 h-3 sm:w-4 sm:h-4" /> Data Cache & Retention
          </div>
         <CacheManagement />
       </div>

      {/* Currencies */}
      <div className="bg-card rounded-xl border border-border p-3 sm:p-5 md:p-6 space-y-3 sm:space-y-5">
        <div className="flex items-center gap-2 text-xs sm:text-sm font-medium text-muted-foreground uppercase tracking-wider">
          <Coins className="w-3 h-3 sm:w-4 sm:h-4" /> Currencies
        </div>

        {/* Default display currency */}
         <div>
           <p className="text-xs font-semibold text-foreground mb-1">Default Display Currency</p>
           <p className="text-[11px] text-muted-foreground mb-3">All portfolio totals, charts, and values will use this currency globally.</p>
           <div className="flex flex-wrap gap-2">
             {allCurrencies.filter(c => enabledCurrencies.includes(c.code) && c.supported).map(c => (
               <button
                 key={c.code}
                 onClick={() => setDisplayCurrency(c.code)}
                 className={cn(
                   'flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition-colors',
                   displayCurrency === c.code
                     ? 'border-primary bg-primary/10 text-primary'
                     : 'border-border bg-secondary text-muted-foreground hover:text-foreground'
                 )}
               >
                 <span className="font-mono font-bold">{c.code}</span>
                 <span className="opacity-60">— {c.name}</span>
               </button>
             ))}
           </div>
         </div>

        {/* Enabled currencies */}
        <div>
          <p className="text-xs font-semibold text-foreground mb-1">Available in Currency Switcher</p>
          <p className="text-[11px] text-muted-foreground mb-3">Choose which currencies appear in the global switcher. CAD and USD are always enabled.</p>
          <div className="space-y-2">
            {allCurrencies.map(c => {
              const isEnabled = enabledCurrencies.includes(c.code);
              const isLocked  = c.code === 'CAD' || c.code === 'USD';
              const rateInfo  = fxRates.find(r => r.code === c.code);
              return (
                <div key={c.code} className="flex items-center justify-between py-2.5 px-3 rounded-lg bg-secondary/30 border border-border/50">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm font-bold w-8">{c.code}</span>
                    <div>
                      <p className="text-xs font-medium text-foreground">{c.name}</p>
                      {rateInfo?.available
                        ? <p className="text-[10px] text-emerald-400 flex items-center gap-1"><CheckCircle2 className="w-2.5 h-2.5" /> Rate available · {FX_PROVIDER}</p>
                        : <p className="text-[10px] text-muted-foreground/50 flex items-center gap-1"><Clock className="w-2.5 h-2.5" /> Exchange rate not available yet</p>
                      }
                    </div>
                  </div>
                  <ThemedSwitch
                    checked={isEnabled}
                    onCheckedChange={() => toggleEnabledCurrency(c.code)}
                    disabled={isLocked || !c.supported}
                    className={isLocked || !c.supported ? 'opacity-40' : ''}
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* Exchange rate status */}
        <div className="rounded-lg bg-secondary/20 border border-border/50 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Exchange Rates</p>
            {FX_IS_SAMPLE && (
              <span className="flex items-center gap-1 text-[10px] text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full">
                <AlertTriangle className="w-2.5 h-2.5" /> Sample Data
              </span>
            )}
          </div>
          {fxRates.filter(r => r.available).map(r => (
            <div key={r.code} className="flex items-center justify-between text-xs">
              <span className="font-mono text-muted-foreground">CAD / {r.code}</span>
              <div className="text-right">
                <span className="font-mono font-semibold">1 CAD = {r.rateToCAD?.toFixed(4)} {r.code}</span>
                <span className="ml-2 text-[10px] text-muted-foreground/50">{r.lastUpdated ? new Date(r.lastUpdated).toLocaleTimeString() : ''}</span>
              </div>
            </div>
          ))}
          <div className="flex items-center justify-between pt-1">
            <p className="text-[10px] text-muted-foreground/60">
              Connect a live FX provider via Backend Functions for real-time rates.
            </p>
            <Button variant="outline" size="sm" className="h-6 text-[10px] gap-1 opacity-50 cursor-not-allowed" disabled>
              <RefreshCw className="w-2.5 h-2.5" /> Refresh
            </Button>
          </div>
        </div>
      </div>

      {/* Visible Accounts */}
      <div className="bg-card rounded-xl border border-border p-3 sm:p-5 md:p-6 space-y-3 sm:space-y-4">
        <div className="flex items-center gap-2 text-xs sm:text-sm font-medium text-muted-foreground uppercase tracking-wider">
          <Eye className="w-3 h-3 sm:w-4 sm:h-4" /> Visible Accounts
        </div>
        <p className="text-xs text-muted-foreground">Toggle accounts to include/exclude from portfolio calculations.</p>
        <div className="space-y-3">
          {accounts.map(acc => {
            const inst = getInstitution(acc.institution_id ?? acc.institutionId);
            const isExcluded = excludedAccounts.includes(acc.id);
            return (
              <div key={acc.id} className="flex items-center justify-between py-2">
                <div>
                  <p className="text-sm font-medium">{(acc.account_type ?? acc.type)} — {inst?.name}</p>
                  <p className="text-xs text-muted-foreground">{acc.base_currency ?? acc.currency}</p>
                </div>
                <ThemedSwitch checked={!isExcluded} onCheckedChange={() => toggleAccount(acc.id)} />
              </div>
            );
          })}
        </div>
      </div>

      {/* Security & Privacy */}
      <div className="bg-card rounded-xl border border-border p-3 sm:p-5 md:p-6 space-y-3 sm:space-y-4">
        <div className="flex items-center gap-2 text-xs sm:text-sm font-medium text-muted-foreground uppercase tracking-wider">
          <Shield className="w-3 h-3 sm:w-4 sm:h-4" /> Security & Privacy
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between py-2 border-b border-border/40">
            <div className="flex items-center gap-3">
              <Lock className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Password</p>
                <p className="text-xs text-muted-foreground">Managed by platform authentication</p>
              </div>
            </div>
            <Button variant="outline" size="sm" disabled className="opacity-50">Change Password</Button>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-border/40">
            <div className="flex items-center gap-3">
              <Smartphone className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Two-Factor Authentication</p>
                <p className="text-xs text-muted-foreground">Coming soon — extra security for your account</p>
              </div>
            </div>
            <ThemedSwitch checked={twoFactor} onCheckedChange={setTwoFactor} disabled className="opacity-50" />
          </div>
          <div className="flex items-center justify-between py-2 border-b border-border/40">
            <div className="flex items-center gap-3">
              <Monitor className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Active Sessions</p>
                <p className="text-xs text-muted-foreground">Manage devices where you're signed in</p>
              </div>
            </div>
            <Button variant="outline" size="sm" disabled className="opacity-50">View Sessions</Button>
          </div>
          <div className="py-2">
            <p className="text-xs text-muted-foreground/70 leading-relaxed">
              <strong className="text-muted-foreground">Data Privacy:</strong> Your portfolio data is private and only accessible to you. We never sell or share your financial data with third parties.
            </p>
          </div>
        </div>
      </div>

      {/* Notifications */}
      <div className="bg-card rounded-xl border border-border p-3 sm:p-5 md:p-6 space-y-3 sm:space-y-4">
        <div className="flex items-center gap-2 text-xs sm:text-sm font-medium text-muted-foreground uppercase tracking-wider">
          <Bell className="w-3 h-3 sm:w-4 sm:h-4" /> Notifications
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-medium">Email Alerts</p>
              <p className="text-xs text-muted-foreground">Daily summary and important changes</p>
            </div>
            <ThemedSwitch checked={emailAlerts} onCheckedChange={setEmailAlerts} />
            </div>
            <div className="flex items-center justify-between py-2">
             <div>
               <p className="text-sm font-medium">Price Alerts</p>
               <p className="text-xs text-muted-foreground">Notify when watched stocks hit target price</p>
             </div>
             <ThemedSwitch checked={priceAlerts} onCheckedChange={setPriceAlerts} />
          </div>
        </div>
      </div>

      {/* Live Data Simulation */}
      <div className="bg-card rounded-xl border border-border p-3 sm:p-5 md:p-6 space-y-3 sm:space-y-4">
        <div className="flex items-center gap-2 text-xs sm:text-sm font-medium text-muted-foreground uppercase tracking-wider">
          <Zap className="w-3 h-3 sm:w-4 sm:h-4" /> Market Data
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-medium">Simulated Live Data</p>
              <p className="text-xs text-muted-foreground">Show realistic price movements and updates across the app until live API connections are available</p>
            </div>
            <ThemedSwitch checked={liveDataEnabled} onCheckedChange={setLiveDataEnabled} />
          </div>
        </div>
      </div>

      {/* Accent Bars */}
      <div className="bg-card rounded-xl border border-border p-3 sm:p-5 md:p-6 space-y-3 sm:space-y-4">
        <div className="flex items-center gap-2 text-xs sm:text-sm font-medium text-muted-foreground uppercase tracking-wider">
          <Sparkles className="w-3 h-3 sm:w-4 sm:h-4" /> Appearance
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-medium">Accent Bars</p>
              <p className="text-xs text-muted-foreground">Subtle theme-aware accent lines at the top and bottom of the app for a premium look</p>
            </div>
            <ThemedSwitch checked={accentBarsEnabled} onCheckedChange={toggleAccentBars} />
          </div>
        </div>
      </div>

      {/* Sign Out & Danger Zone */}
      <div className="bg-card rounded-xl border border-border p-3 sm:p-5 md:p-6 space-y-3 sm:space-y-4">
        <div className="flex items-center gap-2 text-xs sm:text-sm font-medium text-muted-foreground uppercase tracking-wider">
          <LogOut className="w-3 h-3 sm:w-4 sm:h-4" /> Session
        </div>
        <div className="flex items-center justify-between py-2">
          <div>
            <p className="text-sm font-medium">Sign Out</p>
            <p className="text-xs text-muted-foreground">You will be redirected to the login screen</p>
          </div>
          <Button variant="outline" size="sm" onClick={logout} className="gap-2">
            <LogOut className="w-3.5 h-3.5" /> Sign Out
          </Button>
        </div>
      </div>

      <div className="bg-card rounded-xl border border-destructive/30 p-3 sm:p-5 md:p-6 space-y-3 sm:space-y-4">
        <div className="flex items-center gap-2 text-xs sm:text-sm font-medium text-destructive/80 uppercase tracking-wider">
          <AlertTriangle className="w-3 h-3 sm:w-4 sm:h-4" /> Danger Zone
        </div>
        <div className="flex items-center justify-between py-2 border-b border-border/40">
          <div>
            <p className="text-sm font-medium">Export My Data</p>
            <p className="text-xs text-muted-foreground">Download a copy of your portfolio data</p>
          </div>
          <Button variant="outline" size="sm" disabled className="gap-2 opacity-50">
            <Download className="w-3.5 h-3.5" /> Export
          </Button>
        </div>
        <div className="flex items-center justify-between py-2">
          <div>
            <p className="text-sm font-medium text-destructive/80">Delete Account</p>
            <p className="text-xs text-muted-foreground">Permanently remove your account and all data</p>
          </div>
          <Button variant="outline" size="sm" disabled className="gap-2 opacity-50 border-destructive/30 text-destructive/60">
            <Trash2 className="w-3.5 h-3.5" /> Delete
          </Button>
        </div>
      </div>
    </div>
  );
}