"use client";
import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { api, setSession } from "./api";

interface User { id: string; email: string; }
interface AuthCtx {
  user: User | null;
  loading: boolean;
  signup: (email: string, password: string, displayName?: string) => Promise<void>;
  signin: (email: string, password: string) => Promise<void>;
  signout: () => void;
}

const Ctx = createContext<AuthCtx>({ user: null, loading: true, signup: async () => {}, signin: async () => {}, signout: () => {} });
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<{ user: User }>("/api/auth/me")
      .then((r) => setUser(r.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  async function save(path: string, body: object) {
    const r = await api<{ user: User; session: { access_token: string; refresh_token: string } }>(path, {
      method: "POST", body: JSON.stringify(body),
    });
    setSession(r.session);
    setUser(r.user);
  }

  return (
    <Ctx.Provider value={{
      user, loading,
      signup: (email, password, displayName) => save("/api/auth/signup", { email, password, displayName }),
      signin: (email, password) => save("/api/auth/signin", { email, password }),
      signout: () => { setSession(null); setUser(null); },
    }}>{children}</Ctx.Provider>
  );
}
