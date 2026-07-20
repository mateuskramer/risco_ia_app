"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { Session } from "./types";
import * as api from "./storage";

interface AuthContextValue {
  session: Session | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // A sessão vive num cookie httpOnly (não acessível via JS) — pra saber
    // se já tem alguém logado, pergunta pro servidor.
    api
      .getSession()
      .then(setSession)
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const s = await api.login(email, password);
    setSession(s);
  }, []);

  const register = useCallback(async (name: string, email: string, password: string) => {
    const s = await api.register(name, email, password);
    setSession(s);
  }, []);

  const logout = useCallback(() => {
    api.logout().finally(() => setSession(null));
  }, []);

  return (
    <AuthContext.Provider value={{ session, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de AuthProvider.");
  return ctx;
}
