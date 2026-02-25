'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { login as apiLogin, getToken, clearToken, LoginResponse } from '@/lib/api';

export interface User {
  username: string;
  role: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Decode a JWT payload without external libraries.
 * Only used to extract username/role — actual validation happens server-side.
 */
function decodeJwtPayload(token: string): Record<string, any> | null {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(base64));
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isMounted, setIsMounted] = useState(false);

  // Restore session from stored JWT on mount (client-side only)
  useEffect(() => {
    setIsMounted(true);
    const token = getToken();
    if (token) {
      const payload = decodeJwtPayload(token);
      if (payload && payload.exp * 1000 > Date.now()) {
        setUser({ username: payload.sub, role: payload.role || 'OPERATOR' });
      } else {
        clearToken(); // expired
      }
    }
    setIsLoading(false);
  }, []);

  const login = async (username: string, password: string) => {
    setIsLoading(true);
    try {
      const res: LoginResponse = await apiLogin(username, password);
      setUser({ username, role: res.role });
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    clearToken();
  };

  // Render placeholder during SSR hydration to prevent mismatch
  if (!isMounted) {
    return <>{children}</>;
  }

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    return {
      user: null,
      isAuthenticated: false,
      isLoading: true,
      login: async () => { },
      logout: () => { },
    };
  }
  return context;
}
