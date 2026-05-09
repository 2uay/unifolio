import React, { createContext, useState, useContext, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';

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
      } else {
        setUser(null);
        setIsAuthenticated(false);
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

  const logout = async () => {
    setAuthError(null);
    setAuthNotice(null);
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

  const fullName = user?.user_metadata?.full_name || user?.full_name || user?.email || '';

  return (
    <AuthContext.Provider value={{
      user,
      fullName,
      isAuthenticated,
      isLoadingAuth,
      isDemoMode,
      authError,
      authNotice,
      signUp,
      signIn,
      logout,
      enterDemoMode,
      exitDemoMode,
      updateFullName,
      clearAuthNotice,
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
