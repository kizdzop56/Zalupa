import React, { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Platform,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import AsyncStorage from "@react-native-async-storage/async-storage";

const BASE_URL = process.env["EXPO_PUBLIC_DOMAIN"]
  ? `https://${process.env["EXPO_PUBLIC_DOMAIN"]}`
  : "";

async function apiFetch(path: string) {
  const token = await AsyncStorage.getItem("auth_token");
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token ?? ""}` },
  });
  if (res.status === 204) return null;
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? `Ошибка ${res.status}`);
  return data;
}

const TYPE_COLORS: Record<string, string> = {
  text_test: "#8b5cf6", audio: "#06b6d4", reading: "#10b981", video: "#f59e0b",
};
const TYPE_LABELS: Record<string, string> = {
  text_test: "Тест", audio: "Аудирование", reading: "Чтение", video: "Видео",
};
const TYPE_ICONS: Record<string, any> = {
  text_test: "edit-3", audio: "headphones", reading: "book", video: "video",
};

type CategoryStat = { type: string; avgScore: number | null; count: number };
type Submission = {
  submissionId: number; score: number; correctCount: number;
  totalQuestions: number; pointsEarned: number; submittedAt: string;
  assignmentId: number; title: string; type: string; points: number;
};

function CategoryChart({ stats, colors }: { stats: CategoryStat[]; colors: any }) {
  return (
    <View style={{ gap: 14 }}>
      {stats.map((stat) => {
        const color = TYPE_COLORS[stat.type] ?? colors.primary;
        const pct = stat.avgScore ?? 0;
        const hasData = stat.count > 0;
        return (
          <View key={stat.type}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Feather name={TYPE_ICONS[stat.type]} size={14} color={color} />
                <Text style={{ fontSize: 13, fontWeight: "700", color: colors.foreground }}>
                  {TYPE_LABELS[stat.type]}
                </Text>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                {hasData ? (
                  <Text style={{ fontSize: 15, fontWeight: "900", color }}>
                    {pct}%
                  </Text>
                ) : (
                  <Text style={{ fontSize: 13, color: colors.mutedForeground }}>нет данных</Text>
                )}
                <Text style={{ fontSize: 11, color: colors.mutedForeground }}>
                  {stat.count} зад.
                </Text>
              </View>
            </View>
            <View style={{ height: 12, backgroundColor: colors.muted, borderRadius: 6, overflow: "hidden" }}>
              {hasData && (
                <View style={{
                  height: 12,
                  width: `${pct}%` as any,
                  backgroundColor: color,
                  borderRadius: 6,
                }} />
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
}

export default function StudentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const studentId = parseInt(id || "0", 10);
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [student, setStudent] = useState<any>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [categoryStats, setCategoryStats] = useState<CategoryStat[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!studentId) return;
    setIsLoading(true);
    Promise.all([
      apiFetch(`/api/users/${studentId}`),
      apiFetch(`/api/students/${studentId}/submissions`).catch(() => []),
      apiFetch(`/api/students/${studentId}/category-stats`).catch(() => []),
    ]).then(([s, subs, stats]) => {
      setStudent(s);
      setSubmissions(subs ?? []);
      setCategoryStats(stats ?? []);
    }).finally(() => setIsLoading(false));
  }, [studentId]);

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      paddingTop: insets.top + (Platform.OS === "web" ? 67 : 16),
      paddingHorizontal: 20, paddingBottom: 12,
      flexDirection: "row", alignItems: "center", gap: 12,
    },
    backBtn: { width: 36, height: 36, justifyContent: "center", alignItems: "center" },
    headerTitle: { fontSize: 18, fontWeight: "800", color: colors.foreground, flex: 1 },
    scroll: { paddingHorizontal: 20, paddingBottom: insets.bottom + 40 },
    profileCard: {
      backgroundColor: colors.card, borderRadius: 20, padding: 20,
      borderWidth: 1, borderColor: colors.border, marginBottom: 16,
      alignItems: "center",
    },
    avatar: {
      width: 72, height: 72, borderRadius: 36,
      justifyContent: "center", alignItems: "center", marginBottom: 12,
    },
    name: { fontSize: 22, fontWeight: "800", color: colors.foreground, marginBottom: 2 },
    username: { fontSize: 14, color: colors.mutedForeground, marginBottom: 8 },
    badge: {
      paddingHorizontal: 14, paddingVertical: 5, borderRadius: 20,
      backgroundColor: colors.muted,
    },
    badgeText: { fontSize: 13, color: colors.mutedForeground, fontWeight: "600" },
    statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 16 },
    statCard: {
      flex: 1, minWidth: "44%", backgroundColor: colors.card, borderRadius: 16,
      padding: 14, borderWidth: 1, borderColor: colors.border, alignItems: "center", gap: 4,
    },
    statValue: { fontSize: 26, fontWeight: "900", color: colors.foreground },
    statLabel: { fontSize: 12, color: colors.mutedForeground, textAlign: "center" },
    section: {
      backgroundColor: colors.card, borderRadius: 16, padding: 16,
      borderWidth: 1, borderColor: colors.border, marginBottom: 16,
    },
    sectionTitle: { fontSize: 16, fontWeight: "700", color: colors.foreground, marginBottom: 14 },
    subCard: {
      backgroundColor: colors.background, borderRadius: 12, padding: 12,
      borderWidth: 1, borderColor: colors.border, marginBottom: 8,
    },
    loading: { flex: 1, justifyContent: "center", alignItems: "center" },
    empty: { fontSize: 14, color: colors.mutedForeground, textAlign: "center", paddingVertical: 20 },
  });

  if (isLoading) {
    return <View style={[styles.container, styles.loading]}><ActivityIndicator color={colors.primary} size="large" /></View>;
  }

  if (!student) {
    return (
      <View style={[styles.container, styles.loading]}>
        <Feather name="alert-circle" size={40} color={colors.destructive} />
        <Text style={{ marginTop: 12, color: colors.mutedForeground }}>Ученик не найден</Text>
      </View>
    );
  }

  const avgScore = submissions.length > 0
    ? Math.round(submissions.reduce((s, sub) => s + sub.score, 0) / submissions.length)
    : null;

  const totalMins = student.totalTimeMinutes ?? 0;
  const hours = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  const timeLabel = hours > 0 ? `${hours}ч ${mins}м` : `${mins}м`;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Профиль ученика</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Profile card */}
        <View style={styles.profileCard}>
          <View style={[styles.avatar, { backgroundColor: student.avatarColor ?? "#6366f1" }]}>
            <Text style={{ fontSize: 32 }}>{student.avatarEmoji ?? "🦁"}</Text>
          </View>
          <Text style={styles.name}>{student.name}</Text>
          <Text style={styles.username}>@{student.username}</Text>
          {student.age && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{student.age} лет</Text>
            </View>
          )}
          {student.bio ? (
            <Text style={{ fontSize: 13, color: colors.mutedForeground, marginTop: 8, textAlign: "center" }}>
              {student.bio}
            </Text>
          ) : null}
        </View>

        {/* Stats grid */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Feather name="star" size={20} color="#f59e0b" />
            <Text style={styles.statValue}>{student.totalPoints ?? 0}</Text>
            <Text style={styles.statLabel}>Очков</Text>
          </View>
          <View style={styles.statCard}>
            <Feather name="check-circle" size={20} color={colors.success} />
            <Text style={styles.statValue}>{submissions.length}</Text>
            <Text style={styles.statLabel}>Выполнено</Text>
          </View>
          <View style={styles.statCard}>
            <Feather name="clock" size={20} color="#06b6d4" />
            <Text style={styles.statValue}>{timeLabel}</Text>
            <Text style={styles.statLabel}>Учится</Text>
          </View>
          <View style={styles.statCard}>
            <Feather name="bar-chart-2" size={20} color={colors.primary} />
            <Text style={styles.statValue}>{avgScore !== null ? `${avgScore}%` : "—"}</Text>
            <Text style={styles.statLabel}>Ср. балл</Text>
          </View>
        </View>

        {/* Category chart */}
        {categoryStats.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Навыки по областям</Text>
            <CategoryChart stats={categoryStats} colors={colors} />

            {/* Legend note */}
            <Text style={{ fontSize: 12, color: colors.mutedForeground, marginTop: 16, lineHeight: 17 }}>
              Показывает средний процент правильных ответов по каждому типу заданий.
            </Text>
          </View>
        )}

        {/* Recent submissions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Последние ответы {submissions.length > 0 ? `(${submissions.length})` : ""}
          </Text>
          {submissions.length === 0 ? (
            <Text style={styles.empty}>Ещё нет выполненных заданий</Text>
          ) : (
            submissions.slice(0, 10).map((sub) => {
              const scoreColor = sub.score >= 70 ? colors.success : sub.score >= 40 ? "#f59e0b" : colors.destructive;
              const color = TYPE_COLORS[sub.type] ?? colors.primary;
              return (
                <View key={sub.submissionId} style={styles.subCard}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 6 }}>
                    <Feather name={TYPE_ICONS[sub.type] ?? "edit-3"} size={15} color={color} />
                    <Text style={{ flex: 1, fontSize: 14, fontWeight: "600", color: colors.foreground }} numberOfLines={1}>
                      {sub.title ?? "Задание"}
                    </Text>
                    <Text style={{ fontSize: 15, fontWeight: "900", color: scoreColor }}>
                      {sub.score}%
                    </Text>
                  </View>
                  <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
                    <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, backgroundColor: color + "15" }}>
                      <Text style={{ fontSize: 11, fontWeight: "600", color }}>{TYPE_LABELS[sub.type] ?? sub.type}</Text>
                    </View>
                    <Text style={{ fontSize: 12, color: colors.mutedForeground }}>
                      {sub.correctCount}/{sub.totalQuestions} правильно
                    </Text>
                    <Text style={{ fontSize: 12, color: colors.mutedForeground, marginLeft: "auto" as any }}>
                      {new Date(sub.submittedAt).toLocaleDateString("ru-RU")}
                    </Text>
                  </View>
                </View>
              );
            })
          )}
        </View>

      </ScrollView>
    </View>
  );
}
