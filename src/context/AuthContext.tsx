import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api } from '@/lib/api';
import type { AuthUser } from '@/types';

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  signUp: (email: string, password: string) => Promise<{ error: string | null }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const me = await api.getMe();
        if (me) {
          setUser({ id: me.id, email: me.email });
        }
      } catch {
        // Token might be invalid — clear it
        localStorage.removeItem('nutterx_token');
      }
      setLoading(false);
    })();
  }, []);

  const signUp = async (email: string, password: string) => {
    try {
      const res = await api.signUp(email, password);
      setUser({ id: res.user.id, email: res.user.email });
      return { error: null };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sign up failed';
      return { error: message };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const res = await api.signIn(email, password);
      setUser({ id: res.user.id, email: res.user.email });
      return { error: null };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sign in failed';
      return { error: message };
    }
  };

  const signOut = async () => {
    await api.signOut();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
