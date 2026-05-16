import React, { useEffect, useMemo, useState } from 'react';
import { Mail, MapPin, Phone, User, Lock, Save, Loader2, BadgeInfo, Receipt } from 'lucide-react';
import PageHeader from '@/components/shared/PageHeader';
import ProfilePictureSection from '@/components/settings/ProfilePictureSection';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import EmptyPortfolioState from '@/components/shared/EmptyPortfolioState';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const DEFAULT_FORM = {
  fullName: '',
  displayName: '',
  email: '',
  phoneNumber: '',
  location: '',
  bio: '',
  marginalTaxRate: '',
  province: '',
};

// Approximate top-of-bracket combined federal+provincial marginal rates for
// taxable income in the rough middle of each Canadian bracket. Used to
// populate the helper dropdown so users don't have to look up the math.
const MARGINAL_RATE_PRESETS = [
  { label: 'Low income (~$30K–$55K)', rate: 24 },
  { label: 'Middle income (~$55K–$110K)', rate: 30 },
  { label: 'Upper middle (~$110K–$170K)', rate: 38 },
  { label: 'High income (~$170K–$245K)', rate: 45 },
  { label: 'Top bracket ($245K+)', rate: 53 },
];

const CANADIAN_PROVINCES = [
  { code: 'AB', name: 'Alberta' },
  { code: 'BC', name: 'British Columbia' },
  { code: 'MB', name: 'Manitoba' },
  { code: 'NB', name: 'New Brunswick' },
  { code: 'NL', name: 'Newfoundland and Labrador' },
  { code: 'NS', name: 'Nova Scotia' },
  { code: 'NT', name: 'Northwest Territories' },
  { code: 'NU', name: 'Nunavut' },
  { code: 'ON', name: 'Ontario' },
  { code: 'PE', name: 'Prince Edward Island' },
  { code: 'QC', name: 'Quebec' },
  { code: 'SK', name: 'Saskatchewan' },
  { code: 'YT', name: 'Yukon' },
];

export default function Profile() {
  const {
    user,
    fullName,
    isDemoMode,
    authNotice,
    clearAuthNotice,
    updateFullName,
    updateEmail,
    sendPasswordReset,
  } = useAuth();
  const [form, setForm] = useState(DEFAULT_FORM);
  const [initialForm, setInitialForm] = useState(DEFAULT_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const loadProfile = async () => {
      if (!user?.id) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const { data } = await supabase
          .from('user_profiles')
          .select('display_name, phone_number, location, bio, marginal_tax_rate, province')
          .eq('user_id', user.id)
          .single();

        if (cancelled) return;
        const nextForm = {
          fullName: fullName || user?.email || '',
          displayName: data?.display_name || '',
          email: user?.email || '',
          phoneNumber: data?.phone_number || '',
          location: data?.location || '',
          bio: data?.bio || '',
          marginalTaxRate: data?.marginal_tax_rate != null ? String(data.marginal_tax_rate) : '',
          province: data?.province || '',
        };
        setForm(nextForm);
        setInitialForm(nextForm);
      } catch {
        if (cancelled) return;
        const nextForm = {
          fullName: fullName || user?.email || '',
          displayName: '',
          email: user?.email || '',
          phoneNumber: '',
          location: '',
          bio: '',
          marginalTaxRate: '',
          province: '',
        };
        setForm(nextForm);
        setInitialForm(nextForm);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    loadProfile();
    return () => { cancelled = true; };
  }, [user?.id, fullName, user?.email]);

  const isDirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(initialForm), [form, initialForm]);

  const updateField = (key, value) => {
    if (authNotice) clearAuthNotice?.();
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    if (!user?.id) return;
    setSaving(true);
    try {
      const trimmedFullName = form.fullName.trim();
      const trimmedEmail = form.email.trim();
      const trimmedDisplayName = form.displayName.trim();
      const trimmedPhone = form.phoneNumber.trim();
      const trimmedLocation = form.location.trim();
      const trimmedBio = form.bio.trim();

      if (trimmedFullName && trimmedFullName !== fullName) {
        await updateFullName(trimmedFullName);
      }

      if (trimmedEmail && trimmedEmail !== user?.email) {
        await updateEmail(trimmedEmail);
      }

      const parsedRate = form.marginalTaxRate === '' ? null : Number(form.marginalTaxRate);
      const trimmedProvince = (form.province || '').trim().toUpperCase();

      const { error } = await supabase.from('user_profiles').upsert({
        user_id: user.id,
        full_name: trimmedFullName || null,
        display_name: trimmedDisplayName || null,
        phone_number: trimmedPhone || null,
        location: trimmedLocation || null,
        bio: trimmedBio || null,
        marginal_tax_rate: Number.isFinite(parsedRate) ? parsedRate : null,
        province: trimmedProvince || null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });

      if (error) throw error;
      const nextForm = {
        fullName: trimmedFullName || '',
        displayName: trimmedDisplayName || '',
        email: trimmedEmail || '',
        phoneNumber: trimmedPhone || '',
        location: trimmedLocation || '',
        bio: trimmedBio || '',
        marginalTaxRate: Number.isFinite(parsedRate) ? String(parsedRate) : '',
        province: trimmedProvince || '',
      };
      setForm(nextForm);
      setInitialForm(nextForm);
      toast.success('Profile updated');
    } catch (err) {
      toast.error(err.message || 'Could not update your profile');
    } finally {
      setSaving(false);
    }
  };

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

  if (!user && isDemoMode) {
    return (
      <div className="space-y-4">
        <PageHeader title="My Profile" description="Manage your account details" />
        <EmptyPortfolioState compact className="max-w-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader title="My Profile" description="Manage your photo, personal details, and account access" />

      <ProfilePictureSection />

      <div className="bg-card rounded-xl border border-border p-4 sm:p-6 space-y-4">
        <div className="flex items-center gap-2 text-xs sm:text-sm font-medium text-muted-foreground uppercase tracking-wider">
          <User className="w-4 h-4" />
          Personal Details
        </div>

        {authNotice && (
          <div
            className={cn(
              'rounded-lg border px-3 py-2 text-xs leading-relaxed',
              authNotice.type === 'error'
                ? 'border-red-400/30 bg-red-500/10 text-red-300'
                : 'border-emerald-400/30 bg-emerald-500/10 text-emerald-300'
            )}
          >
            {authNotice.message}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="profile-full-name">Full Name</Label>
            <Input
              id="profile-full-name"
              value={form.fullName}
              onChange={(e) => updateField('fullName', e.target.value)}
              placeholder="Your full name"
              disabled={loading}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="profile-display-name">Display Name</Label>
            <Input
              id="profile-display-name"
              value={form.displayName}
              onChange={(e) => updateField('displayName', e.target.value)}
              placeholder="How your name appears in the app"
              disabled={loading}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="profile-email">Email</Label>
            <Input
              id="profile-email"
              type="email"
              value={form.email}
              onChange={(e) => updateField('email', e.target.value)}
              placeholder="you@example.com"
              disabled={loading}
            />
            <p className="text-[11px] text-muted-foreground">Changing your email sends a confirmation to both addresses.</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="profile-phone">Phone</Label>
            <Input
              id="profile-phone"
              value={form.phoneNumber}
              onChange={(e) => updateField('phoneNumber', e.target.value)}
              placeholder="+1 (555) 555-5555"
              disabled={loading}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="profile-location">Location</Label>
            <Input
              id="profile-location"
              value={form.location}
              onChange={(e) => updateField('location', e.target.value)}
              placeholder="City, Country"
              disabled={loading}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="profile-bio">Bio</Label>
            <Textarea
              id="profile-bio"
              value={form.bio}
              onChange={(e) => updateField('bio', e.target.value)}
              placeholder="A few words about yourself"
              rows={4}
              disabled={loading}
            />
          </div>
        </div>

      </div>

      <div className="bg-card rounded-xl border border-border p-4 sm:p-6 space-y-4">
        <div className="flex items-center gap-2 text-xs sm:text-sm font-medium text-muted-foreground uppercase tracking-wider">
          <Receipt className="w-4 h-4" />
          Tax Settings
        </div>
        <p className="text-[11px] text-muted-foreground -mt-1">
          Powers the Tax Optimizer's savings estimates. Stored only in your profile; never sent to external services.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="profile-marginal-rate">Marginal Tax Rate (%)</Label>
            <Input
              id="profile-marginal-rate"
              type="number"
              step="0.01"
              min="0"
              max="60"
              value={form.marginalTaxRate}
              onChange={(e) => updateField('marginalTaxRate', e.target.value)}
              placeholder="e.g. 43.41"
              disabled={loading}
            />
            <div className="flex flex-wrap gap-1.5 mt-1">
              {MARGINAL_RATE_PRESETS.map(preset => (
                <button
                  key={preset.rate}
                  type="button"
                  onClick={() => updateField('marginalTaxRate', String(preset.rate))}
                  className={cn(
                    'rounded-md border px-2 py-0.5 text-[10px] transition-colors',
                    Number(form.marginalTaxRate) === preset.rate
                      ? 'border-primary/50 bg-primary/15 text-primary'
                      : 'border-border bg-secondary/30 text-muted-foreground hover:bg-secondary/60'
                  )}
                >
                  {preset.rate}%
                </button>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground/80">
              Combined federal + provincial rate on your next dollar of taxable income.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="profile-province">Province</Label>
            <select
              id="profile-province"
              value={form.province}
              onChange={(e) => updateField('province', e.target.value)}
              disabled={loading}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="">Select…</option>
              {CANADIAN_PROVINCES.map(p => (
                <option key={p.code} value={p.code}>{p.name}</option>
              ))}
            </select>
            <p className="text-[10px] text-muted-foreground/80">
              Used to refine province-specific dividend tax credit calculations.
            </p>
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={loading || saving || !isDirty} className="gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Profile
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <div className="bg-card rounded-xl border border-border p-4 sm:p-6 space-y-4">
          <div className="flex items-center gap-2 text-xs sm:text-sm font-medium text-muted-foreground uppercase tracking-wider">
            <Mail className="w-4 h-4" />
            Contact Snapshot
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-border/50 bg-secondary/20 p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Email</p>
              <p className="mt-1 text-sm font-medium break-all">{user?.email || '—'}</p>
            </div>
            <div className="rounded-lg border border-border/50 bg-secondary/20 p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Phone</p>
              <p className="mt-1 text-sm font-medium">{form.phoneNumber || '—'}</p>
            </div>
            <div className="rounded-lg border border-border/50 bg-secondary/20 p-3 sm:col-span-2">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Location</p>
              <p className="mt-1 text-sm font-medium">{form.location || '—'}</p>
            </div>
          </div>
        </div>

        <div className="bg-card rounded-xl border border-border p-4 sm:p-6 space-y-4">
          <div className="flex items-center gap-2 text-xs sm:text-sm font-medium text-muted-foreground uppercase tracking-wider">
            <Lock className="w-4 h-4" />
            Account Access
          </div>
          <div className="rounded-lg border border-border/50 bg-secondary/20 p-3">
            <p className="text-sm font-medium">Change Password</p>
            <p className="mt-1 text-xs text-muted-foreground">
              We’ll send a secure password reset link to your account email.
            </p>
            <Button
              variant="outline"
              className="mt-3 w-full gap-2"
              onClick={handlePasswordReset}
              disabled={sendingReset || !user?.email}
            >
              {sendingReset ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
              Send Password Reset Link
            </Button>
          </div>
          <div className="rounded-lg border border-border/50 bg-secondary/20 p-3">
            <div className="flex items-start gap-2">
              <BadgeInfo className="w-4 h-4 text-muted-foreground mt-0.5" />
              <p className="text-xs text-muted-foreground leading-relaxed">
                Billing and payment-method management are not part of this profile page yet. This page is focused on your personal and account details.
              </p>
            </div>
          </div>
          <div className="rounded-lg border border-border/50 bg-secondary/20 p-3 space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <Phone className="w-4 h-4 text-muted-foreground" />
              <span>{form.phoneNumber || 'No phone number added yet'}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="w-4 h-4 text-muted-foreground" />
              <span>{form.location || 'No location added yet'}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
