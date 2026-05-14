import React, { createContext, useState, useContext, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { writeAudit } from '@/lib/auditLog';

const AuthContext = createContext();

function withTimeout(promise, ms, label) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${label} timed out`)), ms);
    }),
  ]).finally(() => clearTimeout(timer));
}

function clearSupabaseAuthStorage() {
  if (typeof window === 'undefined') return;
  const clearStore = (store) => {
    try {
      Object.keys(store)
        .filter(key => (key.startsWith('sb-') && key.includes('auth-token')) || key === 'supabase.auth.token')
        .forEach(key => store.removeItem(key));
    } catch {
      // Storage cleanup is best-effort; state below is authoritative for the UI.
    }
  };
  clearStore(window.localStorage);
  clearStore(window.sessionStorage);
}

function getSignupRedirectUrl() {
  if (typeof window === 'undefined') return undefined;
  return `${window.location.origin}/?auth_action=signup`;
}

function getAuthCallbackParams() {
  if (typeof window === 'undefined') return null;

  const search = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const get = (key) => search.get(key) || hash.get(key);
  const errorMessage = get('error_description') || get('error');
  const authAction = get('auth_action');
  const auth = get('auth');
  const type = get('type');
  const code = get('code');
  const tokenHash = get('token_hash');
  const accessToken = get('access_token');

  if (errorMessage) {
    return { kind: 'error', message: errorMessage.replace(/\+/g, ' ') };
  }
  if (auth === 'confirmed') {
    return { kind: 'confirmed_notice' };
  }
  if (code && authAction === 'signup') {
    return { kind: 'code', code };
  }
  if (tokenHash && (type === 'email' || type === 'signup')) {
    return { kind: 'token_hash', tokenHash, type };
  }
  if (accessToken && type === 'signup') {
    return { kind: 'access_token' };
  }

  return null;
}

function replaceAuthUrl(nextSearch = '') {
  if (typeof window === 'undefined') return;
  const nextUrl = `${window.location.pathname || '/'}${nextSearch}`;
  window.history.replaceState({}, document.title, nextUrl);
}

async function upsertUserProfile(user, fallbackFullName = '') {
  if (!user?.id) return;
  const fullName = (fallbackFullName || user.user_metadata?.full_name || '').trim();
  const profile = {
    user_id: user.id,
    updated_at: new Date().toISOString(),
  };
  if (fullName) profile.full_name = fullName;

  const { error } = await supabase
    .from('user_profiles')
    .upsert(profile, { onConflict: 'user_id' });
  if (error) throw error;
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [authNotice, setAuthNotice] = useState(null);
  const [plan, setPlan] = useState('free');
  const [isPlanLoaded, setIsPlanLoaded] = useState(false);

  useEffect(() => {
    const callbackParams = getAuthCallbackParams();
    let processingCallback = Boolean(callbackParams && callbackParams.kind !== 'confirmed_notice');
    let mounted = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (processingCallback) return;

      if (session?.user) {
        setUser(session.user);
        setIsAuthenticated(true);
        setIsDemoMode(false);
        // app_metadata.plan is authoritative (set by server, not editable by user)
        const metaPlan = session.user.app_metadata?.plan;
        if (metaPlan) {
          setPlan(metaPlan);
          setIsPlanLoaded(true);
        } else {
          // Fall back to user_profiles table (legacy / future migration path)
          supabase.from('user_profiles').select('plan').eq('user_id', session.user.id).single()
            .then(({ data }) => { if (data?.plan) setPlan(data.plan); })
            .catch(() => {})
            .finally(() => setIsPlanLoaded(true));
        }
      } else {
        setUser(null);
        setIsAuthenticated(false);
        setPlan('free');
        setIsPlanLoaded(true);
      }
      if (event === 'INITIAL_SESSION') {
        setIsLoadingAuth(false);
      }
    });

    // Fallback: if INITIAL_SESSION never fires (stub client / no network), unblock after 3s
    const fallback = setTimeout(() => {
      if (!processingCallback && mounted) setIsLoadingAuth(false);
    }, 3000);

    const finishCallback = () => {
      processingCallback = false;
      if (mounted) setIsLoadingAuth(false);
    };

    const handleCallback = async () => {
      if (!callbackParams) return;

      if (callbackParams.kind === 'confirmed_notice') {
        setAuthNotice({ type: 'success', message: 'Email confirmed. You can now sign in.' });
        replaceAuthUrl();
        return;
      }

      setIsLoadingAuth(true);
      try {
        let session = null;
        let confirmedUser = null;

        if (callbackParams.kind === 'error') {
          throw new Error(callbackParams.message || 'Authentication link failed.');
        }

        if (callbackParams.kind === 'code') {
          const { data, error } = await withTimeout(
            supabase.auth.exchangeCodeForSession(callbackParams.code),
            9000,
            'Email confirmation',
          );
          if (error) throw error;
          session = data?.session;
          confirmedUser = data?.user || data?.session?.user;
        } else if (callbackParams.kind === 'token_hash') {
          const { data, error } = await withTimeout(
            supabase.auth.verifyOtp({
              token_hash: callbackParams.tokenHash,
              type: callbackParams.type,
            }),
            9000,
            'Email confirmation',
          );
          if (error) throw error;
          session = data?.session;
          confirmedUser = data?.user || data?.session?.user;
        } else if (callbackParams.kind === 'access_token') {
          const { data, error } = await withTimeout(
            supabase.auth.getSession(),
            5000,
            'Email confirmation session',
          );
          if (error) throw error;
          session = data?.session;
          confirmedUser = data?.session?.user;
        }

        if (!confirmedUser && session?.user) confirmedUser = session.user;
        if (!confirmedUser) throw new Error('Email confirmed, but no sign-in session was returned.');

        await upsertUserProfile(confirmedUser);
        await withTimeout(supabase.auth.signOut({ scope: 'local' }), 3000, 'Post-confirmation sign out')
          .catch(error => console.warn('[Auth] Post-confirmation sign out did not complete cleanly:', error?.message || error));
        clearSupabaseAuthStorage();

        if (!mounted) return;
        setUser(null);
        setIsAuthenticated(false);
        setIsDemoMode(false);
        setAuthError(null);
        setAuthNotice({ type: 'success', message: 'Email confirmed. You can now sign in.' });
        replaceAuthUrl('?auth=confirmed');
      } catch (error) {
        const message = error?.message || 'Authentication link failed. Please request a new confirmation email.';
        console.warn('[Auth] Email confirmation failed:', message);
        clearSupabaseAuthStorage();
        if (!mounted) return;
        setUser(null);
        setIsAuthenticated(false);
        setIsDemoMode(false);
        setAuthError(message);
        setAuthNotice({ type: 'error', message });
        replaceAuthUrl();
      } finally {
        finishCallback();
      }
    };

    handleCallback();

    return () => {
      mounted = false;
      subscription.unsubscribe();
      clearTimeout(fallback);
    };
  }, []);

  const signUp = async (email, password, fullName) => {
    setAuthError(null);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: getSignupRedirectUrl(),
      },
    });
    if (error) {
      setAuthError(error.message);
      throw error;
    }
    if (data.session?.user) {
      await upsertUserProfile(data.session.user, fullName);
    }
    writeAudit('auth_signup', { has_session: !!data.session });
    return data;
  };

  const signIn = async (email, password) => {
    setAuthError(null);
    setAuthNotice(null);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setAuthError(error.message);
      throw error;
    }
    writeAudit('auth_signin', {});
    return data;
  };

  const updateFullName = async (newName) => {
    const { error } = await supabase.auth.updateUser({ data: { full_name: newName } });
    if (error) throw error;
    if (user?.id) {
      await supabase.from('user_profiles').upsert({ user_id: user.id, full_name: newName });
    }
    // onAuthStateChange fires USER_UPDATED and refreshes user state automatically
  };

  const updateEmail = async (newEmail) => {
    const { error } = await supabase.auth.updateUser({ email: newEmail });
    if (error) throw error;
    setAuthNotice({
      type: 'success',
      message: 'Confirmation emails were sent to your old and new addresses. Confirm the new email to finish the change.',
    });
    if (user?.id) {
      await supabase.from('user_profiles').upsert({
        user_id: user.id,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });
    }
    writeAudit('email_changed', {});
  };

  const logout = async () => {
    setAuthError(null);
    setAuthNotice(null);
    // Audit BEFORE the signOut so the JWT is still valid for the audit POST.
    writeAudit('auth_signout', {});
    try {
      await withTimeout(supabase.auth.signOut({ scope: 'local' }), 3000, 'Sign out');
    } catch (error) {
      console.warn('[Auth] Sign out did not complete cleanly; clearing local session:', error?.message || error);
    } finally {
      clearSupabaseAuthStorage();
      setUser(null);
      setIsAuthenticated(false);
      setIsDemoMode(false);
      setIsLoadingAuth(false);
      setPlan('free');
      setIsPlanLoaded(false);
    }
  };

  const enterDemoMode = () => {
    setIsDemoMode(true);
  };

  const exitDemoMode = () => {
    setIsDemoMode(false);
  };

  const clearAuthNotice = () => {
    setAuthNotice(null);
  };

  const sendPasswordReset = async (email) => {
    const redirectTo = typeof window !== 'undefined'
      ? `${window.location.origin}/reset-password`
      : 'https://unifolio.ca/reset-password';
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) throw error;
    // Reset is requested while signed-out — auditLog skips silently when no
    // session is available, but if the user requests reset while signed in
    // (e.g. from /profile) it captures the event.
    writeAudit('password_reset_requested', {});
  };

  // ─── MFA (TOTP) ──────────────────────────────────────────────────────────
  // Wraps supabase.auth.mfa.* primitives. Supabase handles the TOTP secret
  // generation, QR-code provisioning URI, and HOTP/TOTP verification — this
  // layer just routes UI through a single API surface and writes audit rows.

  const listMfaFactors = async () => {
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error) throw error;
    return data; // { all: [...], totp: [...verified...] }
  };

  const enrollMfa = async (friendlyName = 'Unifolio TOTP') => {
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName,
    });
    if (error) throw error;
    // Returns { id (factorId), totp: { qr_code, secret, uri } }
    return data;
  };

  const verifyMfaEnrollment = async (factorId, code) => {
    // Step 1: create the challenge for this factor.
    const { data: challenge, error: challengeError } =
      await supabase.auth.mfa.challenge({ factorId });
    if (challengeError) throw challengeError;
    // Step 2: verify the user-supplied code against that challenge.
    const { data, error } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.id,
      code,
    });
    if (error) throw error;
    writeAudit('mfa_enrolled', { factor_id: factorId });
    return data;
  };

  const unenrollMfa = async (factorId) => {
    const { data, error } = await supabase.auth.mfa.unenroll({ factorId });
    if (error) throw error;
    writeAudit('mfa_unenrolled', { factor_id: factorId });
    return data;
  };

  const challengeMfa = async (factorId) => {
    const { data, error } = await supabase.auth.mfa.challenge({ factorId });
    if (error) throw error;
    return data; // { id (challengeId), expires_at }
  };

  const verifyMfaChallenge = async (factorId, challengeId, code) => {
    const { data, error } = await supabase.auth.mfa.verify({
      factorId,
      challengeId,
      code,
    });
    if (error) {
      writeAudit('mfa_challenge_failed', { factor_id: factorId });
      throw error;
    }
    writeAudit('mfa_challenge_succeeded', { factor_id: factorId });
    return data;
  };

  const getAuthenticatorAssuranceLevel = async () => {
    const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (error) throw error;
    return data; // { currentLevel, nextLevel, currentAuthenticationMethods }
  };

  const fullName = user?.user_metadata?.full_name || user?.full_name || user?.email || '';
  const isPro = plan === 'pro' || plan === 'lifetime';

  return (
    <AuthContext.Provider value={{
      user,
      fullName,
      isAuthenticated,
      isLoadingAuth,
      isDemoMode,
      authError,
      authNotice,
      plan,
      isPro,
      isPlanLoaded,
      signUp,
      signIn,
      logout,
      enterDemoMode,
      exitDemoMode,
      updateFullName,
      updateEmail,
      clearAuthNotice,
      sendPasswordReset,
      listMfaFactors,
      enrollMfa,
      verifyMfaEnrollment,
      unenrollMfa,
      challengeMfa,
      verifyMfaChallenge,
      getAuthenticatorAssuranceLevel,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
