import createContextHook from '@nkzw/create-context-hook';
import { useMutation } from '@tanstack/react-query';
import type { Session, User } from '@supabase/supabase-js';
import { useEffect, useMemo, useState } from 'react';
import { hasSupabaseConfig, supabase } from '@/constants/supabase';

type AuthState = {
  hasConfig: boolean;
  isReady: boolean;
  session: Session | null;
  user: User | null;

  signInWithPassword: (input: { email: string; password: string }) => Promise<void>;
  signUpWithPassword: (input: { email: string; password: string }) => Promise<void>;
  signOut: () => Promise<void>;
  sendPasswordReset: (input: { email: string }) => Promise<void>;

  authError: string | null;
  clearAuthError: () => void;
};

function toUserFacingAuthError(e: unknown): string {
  if (typeof e === 'string' && e.trim().length > 0) return e;
  if (e && typeof e === 'object' && 'message' in e) {
    const maybeMessage = (e as { message?: unknown }).message;
    if (typeof maybeMessage === 'string' && maybeMessage.trim().length > 0) return maybeMessage;
  }
  return 'Something went wrong. Please try again.';
}

export const [AuthProvider, useAuth] = createContextHook<AuthState>(() => {
  const [session, setSession] = useState<Session | null>(null);
  const [isReady, setIsReady] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    console.log('[auth] init', { hasSupabaseConfig });

    if (!hasSupabaseConfig) {
      setIsReady(true);
      return () => {
        isMounted = false;
      };
    }

    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!isMounted) return;
        if (error) {
          console.log('[auth] getSession error', { message: error.message });
        }
        console.log('[auth] getSession result', { hasSession: Boolean(data?.session) });
        setSession(data?.session ?? null);
        setIsReady(true);
      })
      .catch((e) => {
        const message = e instanceof Error ? e.message : String(e);
        console.log('[auth] getSession unexpected error', { message });
        if (!isMounted) return;
        setSession(null);
        setIsReady(true);
      });

    const { data: subscription } = supabase.auth.onAuthStateChange((event, nextSession) => {
      console.log('[auth] onAuthStateChange', { event, hasSession: Boolean(nextSession) });
      if (!isMounted) return;
      setSession(nextSession);
      setIsReady(true);
    });

    return () => {
      isMounted = false;
      subscription?.subscription?.unsubscribe();
    };
  }, []);

  const user = useMemo<User | null>(() => session?.user ?? null, [session]);

  const signInMutation = useMutation({
    mutationFn: async (input: { email: string; password: string }) => {
      setAuthError(null);
      const email = input.email.trim();
      const password = input.password;

      console.log('[auth] signInWithPassword start', { emailLen: email.length });

      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      console.log('[auth] signInWithPassword success', { hasSession: Boolean(data?.session) });
      setSession(data?.session ?? null);
    },
    onError: (e) => {
      const message = toUserFacingAuthError(e);
      console.log('[auth] signInWithPassword error', { message });
      setAuthError(message);
    },
  });

  const signUpMutation = useMutation({
    mutationFn: async (input: { email: string; password: string }) => {
      setAuthError(null);
      const email = input.email.trim();
      const password = input.password;

      console.log('[auth] signUpWithPassword start', { emailLen: email.length });

      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;

      console.log('[auth] signUpWithPassword success', {
        hasSession: Boolean(data?.session),
        hasUser: Boolean(data?.user),
      });
      setSession(data?.session ?? null);
    },
    onError: (e) => {
      const message = toUserFacingAuthError(e);
      console.log('[auth] signUpWithPassword error', { message });
      setAuthError(message);
    },
  });

  const signOutMutation = useMutation({
    mutationFn: async () => {
      setAuthError(null);
      console.log('[auth] signOut start');
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      console.log('[auth] signOut success');
      setSession(null);
    },
    onError: (e) => {
      const message = toUserFacingAuthError(e);
      console.log('[auth] signOut error', { message });
      setAuthError(message);
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async (input: { email: string }) => {
      setAuthError(null);
      const email = input.email.trim();
      console.log('[auth] resetPasswordForEmail start', { emailLen: email.length });
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      if (error) throw error;
      console.log('[auth] resetPasswordForEmail success');
    },
    onError: (e) => {
      const message = toUserFacingAuthError(e);
      console.log('[auth] resetPasswordForEmail error', { message });
      setAuthError(message);
    },
  });

  const clearAuthError = () => setAuthError(null);

  const result: AuthState = {
    hasConfig: hasSupabaseConfig,
    isReady,
    session,
    user,

    signInWithPassword: async (input) => {
      if (!hasSupabaseConfig) {
        setAuthError('Supabase is not configured yet.');
        return;
      }
      await signInMutation.mutateAsync(input);
    },

    signUpWithPassword: async (input) => {
      if (!hasSupabaseConfig) {
        setAuthError('Supabase is not configured yet.');
        return;
      }
      await signUpMutation.mutateAsync(input);
    },

    signOut: async () => {
      if (!hasSupabaseConfig) return;
      await signOutMutation.mutateAsync();
    },

    sendPasswordReset: async (input) => {
      if (!hasSupabaseConfig) {
        setAuthError('Supabase is not configured yet.');
        return;
      }
      await resetPasswordMutation.mutateAsync(input);
    },

    authError,
    clearAuthError,
  };

  return result;
});
