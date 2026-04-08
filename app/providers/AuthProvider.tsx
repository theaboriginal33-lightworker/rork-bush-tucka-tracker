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
  onboardingCompleted: boolean | null;
  refreshOnboarding: () => Promise<void>;
  signInWithPassword: (input: { email: string; password: string }) => Promise<void>;
  signUpWithPassword: (input: { email: string; password: string }) => Promise<void>;
  verifyOtp: (input: { email: string; token: string }) => Promise<void>;
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
  const [onboardingCompleted, setOnboardingCompleted] = useState<boolean | null>(null); 
   
async function fetchOnboardingStatus(userId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('onboarding_completed')
    .eq('id', userId)
    .maybeSingle();
  console.log('[fetchOnboarding]', { userId, data, error });
  
  if (error) {
    setOnboardingCompleted(null);
    return;
  }
  
  // ✅ Fix: sirf actual value use karo
  setOnboardingCompleted(data?.onboarding_completed ?? null);
}
  // useEffect(() => {
  //   let isMounted = true;

  //   console.log('[auth] init', { hasSupabaseConfig });

  //   if (!hasSupabaseConfig) {
  //     setIsReady(true);
  //     return () => {
  //       isMounted = false;
  //     };
  //   }

  //   supabase.auth
  //     .getSession()
  //     .then(({ data, error }) => {
  //       if (!isMounted) return;
  //       if (error) {
  //         console.log('[auth] getSession error', { message: error.message });
  //       }
  //       console.log('[auth] getSession result', { hasSession: Boolean(data?.session) });
  //       setSession(data?.session ?? null);
  //       setIsReady(true);
  //     })
  //     .catch((e) => {
  //       const message = e instanceof Error ? e.message : String(e);
  //       console.log('[auth] getSession unexpected error', { message });
  //       if (!isMounted) return;
  //       setSession(null);
  //       setIsReady(true);
  //     });

  //   const { data: subscription } = supabase.auth.onAuthStateChange((event, nextSession) => {
  //     console.log('[auth] onAuthStateChange', { event, hasSession: Boolean(nextSession) });
  //     if (!isMounted) return;
  //     setSession(nextSession);
  //     setIsReady(true);
  //   });

  //   return () => {
  //     isMounted = false;
  //     subscription?.subscription?.unsubscribe();
  //   };
  // }, []);



 useEffect(() => {
    let isMounted = true;

    console.log('[auth] init', { hasSupabaseConfig });

    if (!hasSupabaseConfig) {
      setIsReady(true);
      return () => { isMounted = false; };
    }

    // ✅ onAuthStateChange pehle setup karo
    const { data: subscription } = supabase.auth.onAuthStateChange(async (event, nextSession) => {
      console.log('[auth] onAuthStateChange', { event, hasSession: Boolean(nextSession) });
      if (!isMounted) return;

      if (event === 'SIGNED_OUT') {
        setSession(null);
        setOnboardingCompleted(null);
        setIsReady(true);
        return;
      }

      // USER_UPDATED fires when phone is linked — don't re-fetch onboarding
      // as it would interrupt the onboarding flow mid-step
      if (event === 'USER_UPDATED') {
        setSession(nextSession);
        setIsReady(true);
        return;
      }

      setSession(nextSession);
      if (nextSession?.user) {
        await fetchOnboardingStatus(nextSession.user.id);
      } else {
        setOnboardingCompleted(null);
      }
      if (isMounted) setIsReady(true);
    });

    // ✅ getSession baad mein
    supabase.auth
      .getSession()
      .then(async ({ data, error }) => {
        if (!isMounted) return;
        if (error) console.log('[auth] getSession error', { message: error.message });
        console.log('[auth] getSession result', { hasSession: Boolean(data?.session) });
        
        if (data?.session?.user) {
          setSession(data.session);
          await fetchOnboardingStatus(data.session.user.id);
        } else {
          setSession(null);
          setOnboardingCompleted(null);
        }
        if (isMounted) setIsReady(true);
      })
      .catch((e) => {
        const message = e instanceof Error ? e.message : String(e);
        console.log('[auth] getSession unexpected error', { message });
        if (!isMounted) return;
        setSession(null);
        setOnboardingCompleted(null);
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
      // onAuthStateChange handles session + onboarding fetch
  
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

      // Supabase returns a fake user for already-registered emails (no error thrown)
      // Detect this by checking if identities array is empty
      if (data?.user && data.user.identities && data.user.identities.length === 0) {
        throw new Error('This email is already registered. Please log in instead.');
      }

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

//   const signOutMutation = useMutation({
//   mutationFn: async () => {
//     setAuthError(null);
//     setSession(null);           
//     setOnboardingCompleted(null); 
//     const { error } = await supabase.auth.signOut();
//     if (error) throw error;
//   },
//   onError: (e) => {
//     const message = toUserFacingAuthError(e);
//     setAuthError(message);
//   },
// });
const signOutMutation = useMutation({
  mutationFn: async () => {
    setAuthError(null);
    console.log('[auth] signOut start');
    const { error } = await supabase.auth.signOut(); 
    if (error) throw error;
    console.log('[auth] signOut success');
  },
  onError: (e) => {
    const message = toUserFacingAuthError(e);
    console.log('[auth] signOut error', { message });
    setAuthError(message);
  },
});
  const verifyOtpMutation = useMutation({
    mutationFn: async (input: { email: string; token: string }) => {
      setAuthError(null);
      const { data, error } = await supabase.auth.verifyOtp({
        email: input.email.trim(),
        token: input.token.trim(),
        type: 'signup',
      });
      if (error) throw error;
      setSession(data?.session ?? null);
    },
    onError: (e) => {
      const message = toUserFacingAuthError(e);
      console.log('[auth] verifyOtp error', { message });
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
onboardingCompleted,
refreshOnboarding: async () => { 
    const { data: { user } } = await supabase.auth.getUser();
    if (user) await fetchOnboardingStatus(user.id);
  },

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

    verifyOtp: async (input) => {
      if (!hasSupabaseConfig) {
        setAuthError('Supabase is not configured yet.');
        return;
      }
      await verifyOtpMutation.mutateAsync(input);
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
