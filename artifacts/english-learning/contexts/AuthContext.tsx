import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { setAuthTokenGetter } from "@workspace/api-client-react";

export type KnowledgeLevel =
  | "starter"
  | "beginner"
  | "elementary"
  | "intermediate"
  | "upper_intermediate";

export interface AuthUser {
  id: number;
  username: string;
  name: string;
  role: "student" | "parent" | "admin" | "teacher";
  age: number | null;
  dateOfBirth: string | null;
  knowledgeLevel: KnowledgeLevel | null;
  totalPoints: number;
  totalTimeMinutes?: number;
  avatarEmoji?: string;
  avatarColor?: string;
  bio?: string;
  createdAt: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  login: (token: string, user: AuthUser) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadAuth = async () => {
      try {
        const storedToken = await AsyncStorage.getItem("auth_token");
        const storedUser = await AsyncStorage.getItem("auth_user");
        if (storedToken && storedUser) {
          setToken(storedToken);
          setUser(JSON.parse(storedUser));
        }
      } catch {
        // ignore
      } finally {
        setIsLoading(false);
      }
    };
    loadAuth();
  }, []);

  useEffect(() => {
    setAuthTokenGetter(() => token);
  }, [token]);

  const login = useCallback(async (newToken: string, newUser: AuthUser) => {
    await AsyncStorage.setItem("auth_token", newToken);
    await AsyncStorage.setItem("auth_user", JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
  }, []);

  const logout = useCallback(async () => {
    await AsyncStorage.removeItem("auth_token");
    await AsyncStorage.removeItem("auth_user");
    setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

// Helper to check if user has teacher/admin privileges
export function isTeacherOrAdmin(role: string): boolean {
  return role === "teacher" || role === "admin";
}

// Knowledge level metadata
export const LEVEL_META: Record<KnowledgeLevel, { labelRu: string; label: string; color: string; ageRange: string }> = {
  starter:            { labelRu: "Стартовый",   label: "Starter",           color: "#8b5cf6", ageRange: "5–6 лет" },
  beginner:           { labelRu: "Начинающий",  label: "Beginner",          color: "#06b6d4", ageRange: "7–9 лет" },
  elementary:         { labelRu: "Элементарный",label: "Elementary",        color: "#10b981", ageRange: "10–12 лет" },
  intermediate:       { labelRu: "Средний",     label: "Intermediate",      color: "#f59e0b", ageRange: "13–15 лет" },
  upper_intermediate: { labelRu: "Продвинутый", label: "Upper Intermediate", color: "#ef4444", ageRange: "16–18 лет" },
};
