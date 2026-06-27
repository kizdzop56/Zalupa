import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Platform, Alert,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import AsyncStorage from "@react-native-async-storage/async-storage";

const BASE = process.env["EXPO_PUBLIC_DOMAIN"]
  ? `https://${process.env["EXPO_PUBLIC_DOMAIN"]}`
  : "";

async function apiFetch(path: string, options?: RequestInit) {
  const token = await AsyncStorage.getItem("auth_token");
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options?.headers ?? {}),
    },
  });
  if (res.status === 204) return null;
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Ошибка сервера");
  return data;
}

type ResultRow = {
  assignedTaskId: number;
  studentId: number;
  studentName: string;
  studentAvatarEmoji: string | null;
  studentAvatarColor: string | null;
  assignmentId: number;
  assignmentTitle: string;
  assignmentType: string;
  assignmentPoints: number;
  assignedAt: string;
  submission: {
    id: number;
    score: number;
    correctCount: number;
    totalQuestions: number;
    pointsEarned: number;
    submittedAt: string;
  } | null;
  answers: Array<{
    id: number;
    questionId: number;
    studentAnswer: string;
    correctAnswer: string;
    isCorrect: boolean;
    questionText: string;
  }>;
};

export default function TeacherResultsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const assignmentId = parseInt(id || "0", 10);
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [results, setResults] = useState<ResultRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const assignmentTitle = results[0]?.assignmentTitle ?? "Задание";

  const load = useCallback(() => {
    setLoading(true);
    apiFetch("/api/assignments/teacher-results")
      .then((all: ResultRow[]) => {
        const filtered = all.filter((r) => r.assignmentId === assignmentId);
        setResults(filtered);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [assignmentId]);

  useEffect(() => { load(); }, [load]);

  const toggleExpand = (id: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleUnassign = (row: ResultRow) => {
    Alert.alert(
      "Убрать задание у ученика?",
      `«${row.assignmentTitle}» будет удалено из списка у ${row.studentName}`,
      [
        { text: "Отмена", style: "cancel" },
        {
          text: "Удалить",
          style: "destructive",
          onPress: async () => {
            setDeletingId(row.assignedTaskId);
            try {
              await apiFetch(`/api/assigned-tasks/${row.assignedTaskId}`, { method: "DELETE" });
              setResults(prev => prev.filter(r => r.assignedTaskId !== row.assignedTaskId));
            } catch (e: any) {
              Alert.alert("Ошибка", e.message);
            } finally {
              setDeletingId(null);
            }
          },
        },
      ]
    );
  };

  const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      paddingTop: insets.top + (Platform.OS === "web" ? 67 : 16),
      paddingHorizontal: 20, paddingBottom: 12,
      flexDirection: "row", alignItems: "center", gap: 12,
    },
    headerTitle: { fontSize: 18, fontWeight: "800", color: colors.foreground, flex: 1 },
    scroll: { paddingHorizontal: 20, paddingBottom: insets.bottom + 40 },
    center: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
    statsRow: { flexDirection: "row", gap: 10, marginBottom: 20 },
    statCard: {
      flex: 1, backgroundColor: colors.card, borderRadius: 14, padding: 14,
      alignItems: "center", borderWidth: 1, borderColor: colors.border,
    },
    statVal: { fontSize: 22, fontWeight: "900", color: colors.foreground, marginTop: 6 },
    statLabel: { fontSize: 11, color: colors.mutedForeground },
    studentCard: {
      backgroundColor: colors.card, borderRadius: 16, padding: 16,
      borderWidth: 1, borderColor: colors.border, marginBottom: 10,
    },
    studentRow: { flexDirection: "row", alignItems: "center", gap: 12 },
    avatar: {
      width: 46, height: 46, borderRadius: 23,
      justifyContent: "center", alignItems: "center",
    },
    scoreBox: { alignItems: "flex-end" },
    scoreNum: { fontSize: 22, fontWeight: "900" },
    scoreSub: { fontSize: 11, color: colors.mutedForeground },
    answerRow: {
      flexDirection: "row", gap: 10, alignItems: "flex-start",
      marginTop: 10, padding: 10, borderRadius: 10, borderWidth: 1,
    },
    qText: { fontSize: 13, color: colors.foreground, fontWeight: "600", marginBottom: 4 },
    aText: { fontSize: 12 },
    expandBtn: {
      flexDirection: "row", alignItems: "center", justifyContent: "center",
      gap: 4, marginTop: 12, paddingTop: 10,
      borderTopWidth: 1, borderTopColor: colors.border,
    },
    pendingTag: {
      backgroundColor: "#fef3c7", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4,
    },
    sectionLabel: {
      fontSize: 12, fontWeight: "700", color: colors.mutedForeground,
      textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 10,
    },
    deleteBtn: {
      width: 32, height: 32, borderRadius: 10,
      backgroundColor: "#fef2f2", borderWidth: 1, borderColor: "#fca5a5",
      justifyContent: "center", alignItems: "center",
    },
  });

  if (loading) return (
    <View style={[s.container, s.center]}>
      <ActivityIndicator color={colors.primary} size="large" />
    </View>
  );

  const submitted = results.filter((r) => r.submission);
  const pending = results.filter((r) => !r.submission);
  const avgScore = submitted.length > 0
    ? Math.round(submitted.reduce((sum, r) => sum + (r.submission?.score ?? 0), 0) / submitted.length)
    : null;

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity
          style={{ width: 36, height: 36, justifyContent: "center", alignItems: "center" }}
          onPress={() => router.back()}
        >
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={s.headerTitle} numberOfLines={2}>Результаты: {assignmentTitle}</Text>
      </View>

      {error ? (
        <View style={s.center}>
          <Text style={{ fontSize: 40 }}>😕</Text>
          <Text style={{ color: colors.mutedForeground }}>{error}</Text>
        </View>
      ) : results.length === 0 ? (
        <View style={s.center}>
          <Text style={{ fontSize: 48 }}>📭</Text>
          <Text style={{ fontSize: 16, fontWeight: "700", color: colors.foreground }}>Никому не назначено</Text>
          <Text style={{ fontSize: 13, color: colors.mutedForeground, textAlign: "center" }}>
            Назначьте задание ученикам из экрана «Задания»
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

          {/* Summary stats */}
          <View style={s.statsRow}>
            <View style={s.statCard}>
              <Feather name="users" size={20} color={colors.primary} />
              <Text style={s.statVal}>{results.length}</Text>
              <Text style={s.statLabel}>Назначено</Text>
            </View>
            <View style={s.statCard}>
              <Feather name="check-circle" size={20} color="#10b981" />
              <Text style={[s.statVal, { color: "#10b981" }]}>{submitted.length}</Text>
              <Text style={s.statLabel}>Выполнили</Text>
            </View>
            <View style={s.statCard}>
              <Feather name="star" size={20} color="#f59e0b" />
              <Text style={[s.statVal, { color: "#f59e0b" }]}>
                {avgScore !== null ? `${avgScore}%` : "—"}
              </Text>
              <Text style={s.statLabel}>Средний балл</Text>
            </View>
          </View>

          {/* Submitted */}
          {submitted.length > 0 && (
            <>
              <Text style={s.sectionLabel}>Выполнили · {submitted.length}</Text>
              {submitted.map((r) => {
                const sub = r.submission!;
                const scoreColor = sub.score >= 70 ? "#10b981" : sub.score >= 50 ? "#f59e0b" : "#ef4444";
                const isExpanded = expanded.has(r.assignedTaskId);
                const isDeleting = deletingId === r.assignedTaskId;
                return (
                  <View key={r.assignedTaskId} style={s.studentCard}>
                    <View style={s.studentRow}>
                      <View style={[s.avatar, { backgroundColor: r.studentAvatarColor ?? "#6366f1" }]}>
                        <Text style={{ fontSize: 22 }}>{r.studentAvatarEmoji ?? "🦁"}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 15, fontWeight: "700", color: colors.foreground }}>
                          {r.studentName}
                        </Text>
                        <Text style={{ fontSize: 12, color: colors.mutedForeground }}>
                          {sub.correctCount}/{sub.totalQuestions} правильных
                        </Text>
                      </View>
                      <View style={s.scoreBox}>
                        <Text style={[s.scoreNum, { color: scoreColor }]}>{sub.score}%</Text>
                        <Text style={s.scoreSub}>+{sub.pointsEarned} ⭐</Text>
                      </View>
                      <TouchableOpacity
                        style={s.deleteBtn}
                        onPress={() => handleUnassign(r)}
                        disabled={isDeleting}
                      >
                        {isDeleting
                          ? <ActivityIndicator size="small" color="#dc2626" />
                          : <Feather name="trash-2" size={15} color="#dc2626" />
                        }
                      </TouchableOpacity>
                    </View>

                    {r.answers.length > 0 && (
                      <TouchableOpacity
                        style={s.expandBtn}
                        onPress={() => toggleExpand(r.assignedTaskId)}
                      >
                        <Feather
                          name={isExpanded ? "chevron-up" : "chevron-down"}
                          size={16} color={colors.mutedForeground}
                        />
                        <Text style={{ fontSize: 13, color: colors.mutedForeground, fontWeight: "600" }}>
                          {isExpanded ? "Скрыть ответы" : "Показать ответы"}
                        </Text>
                      </TouchableOpacity>
                    )}

                    {isExpanded && r.answers.map((a, i) => (
                      <View
                        key={a.id}
                        style={[s.answerRow, {
                          borderColor: a.isCorrect ? "#10b98140" : "#ef444440",
                          backgroundColor: a.isCorrect ? "#f0fdf4" : "#fef2f2",
                        }]}
                      >
                        <Feather
                          name={a.isCorrect ? "check-circle" : "x-circle"}
                          size={16}
                          color={a.isCorrect ? "#10b981" : "#ef4444"}
                          style={{ marginTop: 2 }}
                        />
                        <View style={{ flex: 1 }}>
                          <Text style={s.qText}>{i + 1}. {a.questionText}</Text>
                          <Text style={[s.aText, { color: a.isCorrect ? "#10b981" : "#ef4444", fontWeight: "600" }]}>
                            Ответ: {a.studentAnswer}
                          </Text>
                          {!a.isCorrect && (
                            <Text style={[s.aText, { color: "#10b981", marginTop: 2 }]}>
                              Правильно: {a.correctAnswer}
                            </Text>
                          )}
                        </View>
                      </View>
                    ))}
                  </View>
                );
              })}
            </>
          )}

          {/* Pending */}
          {pending.length > 0 && (
            <>
              <Text style={[s.sectionLabel, { marginTop: submitted.length > 0 ? 20 : 0 }]}>
                Ещё не выполнили · {pending.length}
              </Text>
              {pending.map((r) => {
                const isDeleting = deletingId === r.assignedTaskId;
                return (
                  <View key={r.assignedTaskId} style={[s.studentCard, { opacity: isDeleting ? 0.5 : 0.85 }]}>
                    <View style={s.studentRow}>
                      <View style={[s.avatar, { backgroundColor: r.studentAvatarColor ?? "#6366f1" }]}>
                        <Text style={{ fontSize: 22 }}>{r.studentAvatarEmoji ?? "🦁"}</Text>
                      </View>
                      <Text style={{ flex: 1, fontSize: 15, fontWeight: "700", color: colors.foreground }}>
                        {r.studentName}
                      </Text>
                      <View style={s.pendingTag}>
                        <Text style={{ fontSize: 12, fontWeight: "600", color: "#92400e" }}>Ожидает</Text>
                      </View>
                      <TouchableOpacity
                        style={s.deleteBtn}
                        onPress={() => handleUnassign(r)}
                        disabled={isDeleting}
                      >
                        {isDeleting
                          ? <ActivityIndicator size="small" color="#dc2626" />
                          : <Feather name="trash-2" size={15} color="#dc2626" />
                        }
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
}
