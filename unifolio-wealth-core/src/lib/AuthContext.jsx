import React, { createContext, useState, useContext, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [authError, setAuthError] = useState(null);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
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
    const fallback = setTimeout(() => setIsLoadingAuth(false), 3000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(fallback);
    };
  }, []);

  const signUp = async (email, password, fullName) => {
    setAuthError(null);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
    if (error) {
      setAuthError(error.message);
      throw error;
    }
    // Create profile row
    if (data.user) {
      await supabase.from('user_profiles').upsert({
        user_id: data.user.id,
        full_name: fullName,
      });
    }
    return data;
  };

  const signIn = async (email, password) => {
    setAuthError(null);
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
    await supabase.auth.signOut();
    setUser(null);
    setIsAuthenticated(false);
    setIsDemoMode(false);
  };

  const enterDemoMode = () => {
    setIsDemoMode(true);
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
      signUp,
      signIn,
      logout,
      enterDemoMode,
      updateFullName,
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
