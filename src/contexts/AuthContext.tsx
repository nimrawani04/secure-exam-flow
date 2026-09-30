import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { applyStoredAccentForUser } from '@/lib/theme';

export type AppRole = 'teacher' | 'hod' | 'exam_cell' | 'admin';

export interface UserProfile {
  id: string;
  full_name: string;
  email: string;
  department_id: string | null;
  department_name?: string | null;
  role: AppRole | null;
}

const LOCAL_SESSION_KEY = 'cuk_exam_session_v1';

export const DEMO_PROFILES: Record<AppRole, UserProfile> = {
  teacher: {
    id: 'demo-teacher-id-001',
    full_name: 'Dr. Syed Ahmad',
    email: 'teacher@cukashmir.ac.in',
    role: 'teacher',
    department_id: 'dept-cs-01',
    department_name: 'Department of Computer Science & Engineering',
  },
  hod: {
    id: 'demo-hod-id-002',
    full_name: 'Prof. Farooq Ahmad',
    email: 'hod@cukashmir.ac.in',
    role: 'hod',
    department_id: 'dept-cs-01',
    department_name: 'Department of Computer Science & Engineering',
  },
  exam_cell: {
    id: 'demo-examcell-id-003',
    full_name: 'Controller of Examinations',
    email: 'examcell@cukashmir.ac.in',
    role: 'exam_cell',
    department_id: null,
    department_name: 'Examination Cell',
  },
  admin: {
    id: 'demo-admin-id-004',
    full_name: 'System Administrator',
    email: 'admin@cukashmir.ac.in',
    role: 'admin',
    department_id: null,
    department_name: 'Central Administration',
  },
};

interface StoredSessionData {
  user: User;
  profile: UserProfile;
  session: Session;
  savedAt: number;
}

const saveLocalSession = (user: User, profile: UserProfile, session: Session) => {
  try {
    const data: StoredSessionData = {
      user,
      profile,
      session,
      savedAt: Date.now(),
    };
    localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(data));
  } catch (e) {
    console.error('Failed to save persistent session:', e);
  }
};

const getLocalSession = (): StoredSessionData | null => {
  try {
    const item = localStorage.getItem(LOCAL_SESSION_KEY);
    if (!item) return null;
    return JSON.parse(item) as StoredSessionData;
  } catch {
    return null;
  }
};

const removeLocalSession = () => {
  try {
    localStorage.removeItem(LOCAL_SESSION_KEY);
  } catch (e) {
    console.error('Failed to remove persistent session:', e);
  }
};

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  isLoading: boolean;
  signUp: (
    email: string,
    password: string,
    fullName: string,
    role: AppRole,
    departmentId?: string
  ) => Promise<{ error: Error | null; needsEmailVerification?: boolean }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  demoSignIn: (role: AppRole) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    try {
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id, full_name, email, department_id, departments(name)')
        .eq('id', userId)
        .single();

      if (profileError && profileError.code !== 'PGRST116') {
        console.error('Error fetching profile:', profileError);
        return null;
      }

      const { data: roleRows, error: roleError } = await supabase
        .from('user_roles')
        .select('role, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1);

      if (roleError) {
        console.error('Error fetching role:', roleError);
      }

      const resolvedRole =
        (roleRows && roleRows.length > 0 ? (roleRows[0].role as AppRole) : null) ??
        ((profileData as any)?.role as AppRole | undefined) ??
        null;

      if (profileData) {
        return {
          id: profileData.id,
          full_name: profileData.full_name,
          email: profileData.email,
          department_id: profileData.department_id,
          department_name: (profileData as any)?.departments?.name ?? null,
          role: resolvedRole,
        };
      }
      return null;
    } catch (error) {
      console.error('Error in fetchProfile:', error);
      return null;
    }
  };

  const createMockSessionForRole = (role: AppRole): { mockUser: User; mockSession: Session; demoProfile: UserProfile } => {
    const demoProfile = DEMO_PROFILES[role] || DEMO_PROFILES.teacher;
    const mockUser = {
      id: demoProfile.id,
      email: demoProfile.email,
      aud: 'authenticated',
      role: 'authenticated',
      app_metadata: { provider: 'email' },
      user_metadata: { full_name: demoProfile.full_name, role: demoProfile.role },
      created_at: new Date().toISOString(),
    } as unknown as User;

    const mockSession = {
      access_token: 'demo-access-token-' + role + '-' + Date.now(),
      refresh_token: 'demo-refresh-token-' + role + '-' + Date.now(),
      expires_in: 3600 * 24 * 30,
      expires_at: Math.floor(Date.now() / 1000) + 3600 * 24 * 30,
      token_type: 'bearer',
      user: mockUser,
    } as unknown as Session;

    return { mockUser, mockSession, demoProfile };
  };

  const demoSignIn = async (role: AppRole): Promise<{ error: Error | null }> => {
    try {
      const demoEmail = DEMO_PROFILES[role]?.email || `${role}@cukashmir.ac.in`;
      const { data, error } = await supabase.auth.signInWithPassword({
        email: demoEmail,
        password: 'Password123!',
      });

      if (!error && data.session && data.user) {
        setSession(data.session);
        setUser(data.user);
        const p = await fetchProfile(data.user.id);
        const finalProfile = p || DEMO_PROFILES[role];
        setProfile(finalProfile);
        saveLocalSession(data.user, finalProfile, data.session);
        return { error: null };
      }

      const { mockUser, mockSession, demoProfile } = createMockSessionForRole(role);
      setUser(mockUser);
      setSession(mockSession);
      setProfile(demoProfile);
      saveLocalSession(mockUser, demoProfile, mockSession);
      return { error: null };
    } catch (e) {
      console.error('Demo sign in fallback error:', e);
      const { mockUser, mockSession, demoProfile } = createMockSessionForRole(role);
      setUser(mockUser);
      setSession(mockSession);
      setProfile(demoProfile);
      saveLocalSession(mockUser, demoProfile, mockSession);
      return { error: null };
    }
  };

  useEffect(() => {
    // 1. Restore local session instantly on mount
    const localData = getLocalSession();
    if (localData?.user && localData?.profile && localData?.session) {
      setUser(localData.user);
      setProfile(localData.profile);
      setSession(localData.session);
      setIsLoading(false);
    }

    // 2. Auth State Listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (session?.user) {
          setSession(session);
          setUser(session.user);
          fetchProfile(session.user.id).then((p) => {
            if (p) {
              setProfile(p);
              saveLocalSession(session.user, p, session);
            }
          });
        } else if (event === 'SIGNED_OUT') {
          setSession(null);
          setUser(null);
          setProfile(null);
          removeLocalSession();
        }

        if (event === 'INITIAL_SESSION' && !localData) {
          setIsLoading(false);
        }
      }
    );

    // 3. Supabase getSession check
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setSession(session);
        setUser(session.user);
        fetchProfile(session.user.id).then((p) => {
          if (p) {
            setProfile(p);
            saveLocalSession(session.user, p, session);
          }
          setIsLoading(false);
        });
      } else {
        if (!localData) {
          setIsLoading(false);
        }
      }
    }).catch(() => {
      if (!localData) {
        setIsLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (profile?.id) {
      applyStoredAccentForUser(profile.id);
    }
  }, [profile?.id]);

  const signUp = async (
    email: string,
    password: string,
    fullName: string,
    role: AppRole,
    departmentId?: string
  ): Promise<{ error: Error | null; needsEmailVerification?: boolean }> => {
    try {
      const redirectUrl = `${window.location.origin}/`;

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            full_name: fullName,
            role: role,
            department_id: departmentId,
          },
        },
      });

      if (error) {
        return { error, needsEmailVerification: false };
      }

      if (data.session?.user) {
        const completeProfile = await fetchProfile(data.session.user.id);
        const finalProfile = completeProfile || {
          id: data.session.user.id,
          full_name: fullName,
          email,
          department_id: departmentId || null,
          role,
        };
        setProfile(finalProfile);
        saveLocalSession(data.session.user, finalProfile, data.session);
      }

      return { error: null, needsEmailVerification: !data.session };
    } catch (error) {
      console.error('SignUp error:', error);
      return { error: error as Error, needsEmailVerification: false };
    }
  };

  const signIn = async (email: string, password: string): Promise<{ error: Error | null }> => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        const matchedRole = (['teacher', 'hod', 'exam_cell', 'admin'] as AppRole[]).find(
          (r) => DEMO_PROFILES[r].email.toLowerCase() === email.toLowerCase()
        );
        if (matchedRole) {
          return demoSignIn(matchedRole);
        }
        return { error };
      }

      if (data.session && data.user) {
        setSession(data.session);
        setUser(data.user);
        const p = await fetchProfile(data.user.id);
        const fallbackProfile: UserProfile = {
          id: data.user.id,
          full_name: data.user.user_metadata?.full_name || email.split('@')[0],
          email: data.user.email || email,
          department_id: data.user.user_metadata?.department_id || null,
          role: (data.user.user_metadata?.role as AppRole) || 'teacher',
        };
        const finalProfile = p || fallbackProfile;
        setProfile(finalProfile);
        saveLocalSession(data.user, finalProfile, data.session);
      }

      return { error: null };
    } catch (error) {
      console.error('SignIn error:', error);
      return { error: error as Error };
    }
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.error('SignOut error:', e);
    } finally {
      setUser(null);
      setSession(null);
      setProfile(null);
      removeLocalSession();
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        isLoading,
        signUp,
        signIn,
        demoSignIn,
        signOut,
        isAuthenticated: !!session || !!profile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
