import React, { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Platform,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { LEVEL_META } from "@/contexts/AuthContext";
import { ACHIEVEMENTS, getUnlockedAchievements, type AchievementStats } from "@/constants/achievements";
import AsyncStorage from "@react-native-async-storage/async-storage";

const BASE = process.env["EXPO_PUBLIC_DOMAIN"]
  ? `https://${process.env["EXPO_PUBLIC_DOMAIN"]}`
  : "";

async function apiFetch(path: string) {
  const token = await AsyncStorage.getItem("auth_token");
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Ошибка сервера");
  return data;
}

type FriendProfile = {
  id: number;
  name: string;
  username: string;
  avatarEmoji: string | null;
  avatarColor: string | null;
  knowledgeLevel: string | null;
  totalPoints: number;
  totalTimeMinutes: number;
  bio: string | null;
  age: number | null;
  role: string;
  completedAssignments: number;
};

function formatTime(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} мин`;
  if (m === 0) return `${h} ч`;
  return `${h} ч ${m} мин`;
}

export default function FriendProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const friendId = parseInt(id || "0", 10);
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [profile, setProfile] = useState<FriendProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!friendId) return;
    // Use the general user endpoint — visible to any authenticated user (read-only)
    apiFetch(`/api/users/${friendId}`)
      .then(setProfile)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [friendId]);

  const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      paddingTop: insets.top + (Platform.OS === "web" ? 67 : 16),
      paddingHorizontal: 20, paddingBottom: 12,
      flexDirection: "row", alignItems: "center", gap: 12,
    },
    backBtn: { width: 36, height: 36, justifyContent: "center", alignItems: "center" },
    headerTitle: { fontSize: 18, fontWeight: "800", color: colors.foreground, flex: 1 },
    scroll: { paddingHorizontal: 20, paddingBottom: insets.bottom + 40 },
    center: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
  });

  if (loading) {
    return (
      <View style={[s.container, s.center]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (error || !profile) {
    return (
      <View style={[s.container]}>
        <View style={s.header}>
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
            <Feather name="arrow-left" size={22} color={colors.foreground} />
          </TouchableOpacity>
        </View>
        <View style={s.center}>
          <Text style={{ fontSize: 40 }}>😕</Text>
          <Text style={{ fontSize: 16, fontWeight: "700", color: colors.foreground }}>Не удалось загрузить</Text>
          <Text style={{ fontSize: 13, color: colors.mutedForeground, textAlign: "center" }}>
            {error || "Профиль недоступен"}
          </Text>
        </View>
      </View>
    );
  }

  const levelMeta = profile.knowledgeLevel
    ? LEVEL_META[profile.knowledgeLevel as keyof typeof LEVEL_META]
    : null;

  const achievementStats: AchievementStats = {
    completedAssignments: profile.completedAssignments,
    totalPoints: profile.totalPoints,
    knowledgeLevel: profile.knowledgeLevel,
    totalTimeMinutes: profile.totalTimeMinutes ?? 0,
  };
  const unlocked = getUnlockedAchievements(achievementStats);

  const avatarColor = profile.avatarColor ?? "#6366f1";
  const avatarEmoji = profile.avatarEmoji ?? "🦁";

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Профиль друга</Text>
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Avatar + name ── */}
        <View style={{
          alignItems: "center", paddingVertical: 24,
          backgroundColor: colors.card, borderRadius: 20,
          borderWidth: 1, borderColor: colors.border, marginBottom: 16,
        }}>
          <View style={{
            width: 90, height: 90, borderRadius: 45,
            backgroundColor: avatarColor,
            justifyContent: "center", alignItems: "center",
            marginBottom: 14,
            shadowColor: avatarColor, shadowOpacity: 0.35,
            shadowRadius: 12, shadowOffset: { width: 0, height: 4 },
          }}>
            <Text style={{ fontSize: 44 }}>{avatarEmoji}</Text>
          </View>
          <Text style={{ fontSize: 22, fontWeight: "800", color: colors.foreground, marginBottom: 3 }}>
            {profile.name}
          </Text>
          <Text style={{ fontSize: 14, color: colors.mutedForeground, marginBottom: 12 }}>
            @{profile.username}
          </Text>

          {/* Level badge */}
          {levelMeta && (
            <View style={{
              flexDirection: "row", alignItems: "center", gap: 6,
              backgroundColor: levelMeta.color + "18",
              paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20,
            }}>
              <Feather name="zap" size={13} color={levelMeta.color} />
              <Text style={{ fontSize: 13, fontWeight: "700", color: levelMeta.color }}>
                {levelMeta.labelRu}
              </Text>
            </View>
          )}
        </View>

        {/* ── Bio ── */}
        {!!profile.bio && (
          <View style={{
            backgroundColor: colors.card, borderRadius: 16, padding: 16,
            borderWidth: 1, borderColor: colors.border, marginBottom: 16,
          }}>
            <Text style={{ fontSize: 11, fontWeight: "700", color: colors.mutedForeground, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 6 }}>
              О себе
            </Text>
            <Text style={{ fontSize: 14, color: colors.foreground, lineHeight: 20 }}>
              {profile.bio}
            </Text>
          </View>
        )}

        {/* ── Stats row ── */}
        <View style={{ flexDirection: "row", gap: 10, marginBottom: 16 }}>
          {[
            { icon: "star", color: "#f59e0b", value: profile.totalPoints, label: "Очки" },
            { icon: "check-circle", color: "#10b981", value: profile.completedAssignments, label: "Заданий" },
            { icon: "clock", color: colors.primary, value: formatTime(profile.totalTimeMinutes ?? 0), label: "Время" },
          ].map((stat) => (
            <View key={stat.label} style={{
              flex: 1, backgroundColor: colors.card, borderRadius: 14, padding: 14,
              alignItems: "center", borderWidth: 1, borderColor: colors.border,
            }}>
              <Feather name={stat.icon as any} size={20} color={stat.color} />
              <Text style={{ fontSize: stat.label === "Время" ? 14 : 22, fontWeight: "900", color: colors.foreground, marginTop: 6, marginBottom: 2 }}>
                {stat.value}
              </Text>
              <Text style={{ fontSize: 11, color: colors.mutedForeground, textAlign: "center" }}>
                {stat.label}
              </Text>
            </View>
          ))}
        </View>

        {/* ── Achievements showcase ── */}
        <View style={{
          backgroundColor: colors.card, borderRadius: 16, padding: 16,
          borderWidth: 1, borderColor: colors.border, marginBottom: 16,
        }}>
          <Text style={{ fontSize: 11, fontWeight: "700", color: colors.mutedForeground, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 12 }}>
            Витрина наград · {unlocked.length}/{ACHIEVEMENTS.length}
          </Text>

          {unlocked.length === 0 ? (
            <View style={{ alignItems: "center", paddingVertical: 20, gap: 8 }}>
              <Text style={{ fontSize: 32 }}>🏆</Text>
              <Text style={{ fontSize: 13, color: colors.mutedForeground }}>Пока нет наград</Text>
            </View>
          ) : (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
              {unlocked.map((a) => (
                <View
                  key={a.id}
                  style={{
                    backgroundColor: a.bgColor, borderRadius: 14, padding: 12,
                    borderWidth: 1.5, borderColor: a.color + "40",
                    width: "47%", alignItems: "flex-start",
                  }}
                >
                  <Text style={{ fontSize: 28, marginBottom: 6 }}>{a.emoji}</Text>
                  <Text style={{ fontSize: 13, fontWeight: "700", color: a.color }}>{a.title}</Text>
                  <Text style={{ fontSize: 11, marginTop: 2, color: a.color + "bb", lineHeight: 15 }}>
                    {a.description}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>

      </ScrollView>
    </View>
  );
}
