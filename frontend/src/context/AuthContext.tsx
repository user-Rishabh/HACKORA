import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { supabaseAuth, SupabaseUser, SupabaseSession } from '../lib/supabaseAuth';
import { API_BASE_URL } from '../lib/apiClient';

interface AuthContextType {
  user: SupabaseUser | null;
  session: SupabaseSession | null;
  token: string | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signUp: (email: string, password: string) => Promise<{ success: boolean; error?: string; confirmationRequired?: boolean }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ success: boolean; error?: string }>;
  updatePassword: (password: string) => Promise<{ success: boolean; error?: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<SupabaseSession | null>(supabaseAuth.getSession());
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const unsubscribe = supabaseAuth.onAuthStateChange((newSession) => {
      setSession(newSession);
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const res = await supabaseAuth.signIn(email, password);
    if (res.error) {
      return { success: false, error: res.error };
    }
    return { success: true };
  };

  const signUp = async (email: string, password: string) => {
    const res = await supabaseAuth.signUp(email, password);
    if (res.error) {
      return { success: false, error: res.error, confirmationRequired: false };
    }
    return { success: true, confirmationRequired: res.confirmationRequired };
  };

  const signOut = async () => {
    const token = supabaseAuth.getAccessToken();
    if (token) {
      try {
        await fetch(`${API_BASE_URL}/api/credentials/cleanup`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }).catch(() => {});
      } catch {
        // Ignore backend cleanup failure on network disconnect
      }
    }
    await supabaseAuth.signOut();
  };

  const resetPassword = async (email: string) => {
    const res = await supabaseAuth.resetPasswordForEmail(email);
    if (!res.success) {
      return { success: false, error: res.error || 'Password reset request failed.' };
    }
    return { success: true };
  };

  const updatePassword = async (password: string) => {
    const res = await supabaseAuth.updatePassword(password);
    if (!res.success) {
      return { success: false, error: res.error || 'Failed to update password.' };
    }
    return { success: true };
  };

  const value = useMemo(
    () => ({
      user: session ? session.user : null,
      session,
      token: session ? session.access_token : null,
      isLoading,
      signIn,
      signUp,
      signOut,
      resetPassword,
      updatePassword,
    }),
    [session, isLoading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

