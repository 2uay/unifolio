import React, { useState } from 'react';
import { User, Eye, Shield, Bell, RefreshCw, AlertTriangle, LogOut, Download, Lock, Monitor, Coins, CheckCircle2, Clock, Palette, Zap, ArrowRight, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import ThemedSwitch from '@/components/ui/switch-themed';
import MfaEnrollment from '@/components/settings/MfaEnrollment';
import PageHeader from '@/components/shared/PageHeader';
import ThemeSelector from '@/components/settings/ThemeSelector';
import CacheManagement from '@/components/settings/CacheManagement';
import { useCurrency } from '@/lib/CurrencyContext';
import { getCurrencyRates, FX_PROVIDER, FX_IS_SAMPLE } from '@/lib/exchangeRates';
import { useAuth } from '@/lib/AuthContext';
import { useLiveData } from '@/lib/LiveDataContext';
import { useAccentBars } from '@/lib/AccentBarsContext';
import Avatar from '@/components/shared/Avatar';
import InstitutionLogo from '@/components/shared/InstitutionLogo';
import { cn } from '@/lib/utils';
import { exportFullBackupJSON, exportHoldingsCSV, exportTransactionsCSV } from '@/lib/exportEngine';
import { usePortfolioData } from '@/lib/PortfolioDataContext';
import { toast } from 'sonner';

export default function Settings() {
  const navigate = useNavigate();
  const { displayCurrency, setDisplayCurrency, enabledCurrencies, setEnabledCurrencies, allCurrencies } = useCurrency();
  const { accounts, holdings, transactions, institutions, getInstitution } = usePortfolioData();
  const { user, fullName, logout, sendPasswordReset, isAuthenticated } = useAuth();
  const { liveDataEnabled, setLiveDataEnabled } = useLiveData();
  const { accentBarsEnabled, toggleAccentBars } = useAccentBars();
  const [excludedAccounts, setExcludedAccounts] = useState([]);
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [priceAlerts, setPriceAlerts] = useState(true);
  const [sendingReset, setSendingReset] = useState(false);
  const [customCursorEnabled, setCustomCursorEnabled] = useState(() => {
    try {
      const v = localStorage.getItem('unifolio_custom_cursor_enabled');
      return v === null ? true : v === 'true';
    } catch { return true; }
  });

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

  const handlePasswordReset = async () => {
    if (!user?.email) return;
    setSendingReset(true);
    try {
      await sendPasswordReset(user.email);
      toast.success(`Password reset email sent to ${user.email}`);
    } catch (err) {
      toast.error(err.message || 'Could not send password reset email');
    } finally {
      setSendingReset(false);
    }
  };

  return (
    <div className="space-y-3 sm:space-y-6 max-w-3xl">
      <PageHeader title="Settings" description="Manage your preferences, security, and data controls" />

      {!isAuthenticated && (
        <div className="flex items-start gap-3 rounded-xl border border-primary/30 bg-primary/8 px-4 py-3">
          <Zap className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
          <p className="text-sm text-muted-foreground">
            You're in <span className="font-semibold text-foreground">demo mode</span> — theme and display preferences are available below.{' '}
            <a href="/" className="text-primary hover:underline">Sign in</a> to access your full account settings.
          </p>
        </div>
      )}

      {/* Account */}
      {isAuthenticated && (
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
        <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
          <div className="rounded-lg bg-secondary/30 border border-border/50 p-3">
            <p className="text-sm font-medium">{fullName || 'User'}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{user?.email}</p>
            <p className="text-[11px] text-muted-foreground/70 mt-2">
              Profile photo, name, email, phone, and personal details now live on your dedicated profile page.
            </p>
          </div>
          <Button variant="outline" className="gap-2" onClick={() => navigate('/profile')}>
            Open My Profile
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
      )}

      {/* Themes */}
       <div className="bg-card rounded-xl border border-border p-3 sm:p-5 md:p-6 space-y-3 sm:space-y-5">
         <div className="flex items-center gap-2 text-xs sm:text-sm font-medium text-muted-foreground uppercase tracking-wider">
           <Palette className="w-3 h-3 sm:w-4 sm:h-4" /> Themes
         </div>
         <ThemeSelector />
         <div className="flex items-center justify-between rounded-lg border border-border/50 bg-secondary/20 px-3 py-2">
           <div>
             <p className="text-sm font-medium">Accent Bars</p>
             <p className="text-xs text-muted-foreground">Theme-aware accent lines around the app shell.</p>
           </div>
           <ThemedSwitch checked={accentBarsEnabled} onCheckedChange={toggleAccentBars} />
         </div>
         <div className="flex items-center justify-between rounded-lg border border-border/50 bg-secondary/20 px-3 py-2">
           <div>
             <p className="text-sm font-medium">Custom Cursor</p>
             <p className="text-xs text-muted-foreground">Use the Unifolio wheel cursor in-app. Turn off to use your normal system cursor.</p>
           </div>
           <ThemedSwitch
             checked={customCursorEnabled}
             onCheckedChange={(v) => {
               setCustomCursorEnabled(v);
               try { localStorage.setItem('unifolio_custom_cursor_enabled', String(v)); } catch {}
               window.dispatchEvent(new CustomEvent('unifolio:cursor-pref-changed'));
             }}
           />
         </div>
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
            {allCurrencies.filter(c => !c.isNative).map(c => {
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
                <div className="flex items-center gap-2">
                  <InstitutionLogo institution={inst} size="sm" />
                  <div>
                  <p className="text-sm font-medium">{(acc.account_type ?? acc.type)} — {inst?.name}</p>
                  <p className="text-xs text-muted-foreground">{acc.base_currency ?? acc.currency}</p>
                  </div>
                </div>
                <ThemedSwitch checked={!isExcluded} onCheckedChange={() => toggleAccount(acc.id)} />
              </div>
            );
          })}
        </div>
      </div>

      {/* Security & Privacy */}
      {isAuthenticated && (
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
            <Button variant="outline" size="sm" onClick={handlePasswordReset} disabled={sendingReset || !user?.email}>
              {sendingReset ? 'Sending…' : 'Change Password'}
            </Button>
          </div>
          <MfaEnrollment />
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
      )}

      {/* Notifications */}
      {isAuthenticated && (
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
      )}

      {/* Live Data Simulation */}
      <div className="bg-card rounded-xl border border-border p-3 sm:p-5 md:p-6 space-y-3 sm:space-y-4">
        <div className="flex items-center gap-2 text-xs sm:text-sm font-medium text-muted-foreground uppercase tracking-wider">
          <Zap className="w-3 h-3 sm:w-4 sm:h-4" /> Market Data
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-medium">Simulated Holdings Data</p>
              <p className="text-xs text-muted-foreground">Show realistic price movements and updates across the app until live API connections are available</p>
            </div>
            <ThemedSwitch checked={liveDataEnabled} onCheckedChange={setLiveDataEnabled} />
          </div>
        </div>
      </div>

      {/* Sign Out & Danger Zone */}
      {isAuthenticated && (
      <>
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
        <div className="py-2 border-b border-border/40 space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Export My Data</p>
              <p className="text-xs text-muted-foreground">Download a copy of your portfolio data</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" className="gap-2 h-8 text-xs" onClick={() => exportHoldingsCSV(holdings, accounts, institutions)}>
              <Download className="w-3 h-3" /> Holdings CSV
            </Button>
            <Button variant="outline" size="sm" className="gap-2 h-8 text-xs" onClick={() => exportTransactionsCSV(transactions, accounts)}>
              <Download className="w-3 h-3" /> Transactions CSV
            </Button>
            <Button variant="outline" size="sm" className="gap-2 h-8 text-xs" onClick={() => exportFullBackupJSON({ accounts, holdings, transactions, institutions })}>
              <Download className="w-3 h-3" /> Full JSON Backup
            </Button>
          </div>
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
      </>
      )}
    </div>
  );
}
