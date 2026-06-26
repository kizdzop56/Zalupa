import React, { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Platform,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import AsyncStorage from "@react-native-async-storage/async-storage";

const BASE = process.env["EXPO_PUBLIC_DOMAIN"]
  ? `https://${process.env["EXPO_PUBLIC_DOMAIN"]}`
  : "";

async function apiFetch(path: string) {
  const token = await AsyncStorage.getItem("auth_token");
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${token ?? ""}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Ошибка сервера");
  return data;
}

const TYPE_LABELS: Record<string, string> = {
  text_test: "Тест", audio: "Аудирование", reading: "Чтение", video: "Видео",
};
const TYPE_COLORS: Record<string, string> = {
  text_test: "#8b5cf6", audio: "#06b6d4", reading: "#10b981", video: "#f59e0b",
};

type Answer = {
  id: number;
  questionId: number;
  studentAnswer: string;
  isCorrect: boolean;
  correctAnswer: string;
  questionText: string;
};

type ReviewData = {
  id: number;
  score: number;
  correctCount: number;
  totalQuestions: number;
  pointsEarned: number;
  submittedAt: string;
  assignment: { id: number; title: string; type: string; points: number } | null;
  answers: Answer[];
};

export default function SubmissionReviewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const submissionId = parseInt(id || "0", 10);
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [data, setData] = useState<ReviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch(`/api/submissions/${submissionId}/review`)
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [submissionId]);

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
    summaryCard: {
      backgroundColor: colors.card, borderRadius: 20, padding: 20,
      borderWidth: 1, borderColor: colors.border, marginBottom: 20,
    },
    scoreRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
    bigScore: { fontSize: 48, fontWeight: "900" },
    statsRow: { flexDirection: "row", gap: 12 },
    stat: { flex: 1, alignItems: "center", backgroundColor: colors.muted, borderRadius: 12, padding: 10, gap: 2 },
    statVal: { fontSize: 18, fontWeight: "800", color: colors.foreground },
    statLabel: { fontSize: 11, color: colors.mutedForeground },
    sectionTitle: {
      fontSize: 12, fontWeight: "700", color: colors.mutedForeground,
      textTransform: "uppercase", letterSpacing: 0.6,
      marginBottom: 10,
    },
    answerCard: {
      borderRadius: 14, padding: 14, marginBottom: 10,
      borderWidth: 1.5,
    },
    questionNum: { fontSize: 11, fontWeight: "700", marginBottom: 3, textTransform: "uppercase", letterSpacing: 0.4 },
    questionText: { fontSize: 14, fontWeight: "600", color: colors.foreground, marginBottom: 8, lineHeight: 20 },
    answerRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
    answerLabel: { fontSize: 12, fontWeight: "600" },
    answerText: { fontSize: 13, flex: 1 },
  });

  if (loading) return (
    <View style={[s.container, s.center]}>
      <ActivityIndicator color={colors.primary} size="large" />
    </View>
  );

  if (error || !data) return (
    <View style={[s.container, s.center]}>
      <Text style={{ fontSize: 40 }}>😕</Text>
      <Text style={{ color: colors.mutedForeground }}>{error || "Не удалось загрузить"}</Text>
    </View>
  );

  const scoreColor = data.score >= 70 ? "#10b981" : data.score >= 40 ? "#f59e0b" : "#ef4444";
  const color = TYPE_COLORS[data.assignment?.type ?? ""] ?? colors.primary;
  const wrong = data.answers.filter(a => !a.isCorrect);
  const correct = data.answers.filter(a => a.isCorrect);

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity
          style={{ width: 36, height: 36, justifyContent: "center", alignItems: "center" }}
          onPress={() => router.back()}
        >
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={s.headerTitle} numberOfLines={2}>
          {data.assignment?.title ?? "Задание"}
        </Text>
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* Summary card */}
        <View style={s.summaryCard}>
          <View style={s.scoreRow}>
            <View>
              <Text style={{ fontSize: 13, color: colors.mutedForeground, marginBottom: 4 }}>
                {TYPE_LABELS[data.assignment?.type ?? ""] ?? "Задание"}
              </Text>
              <Text style={[s.bigScore, { color: scoreColor }]}>{data.score}%</Text>
            </View>
            <View style={{ alignItems: "flex-end", gap: 6 }}>
              <View style={{ backgroundColor: "#fef3c7", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 5 }}>
                <Text style={{ fontSize: 14, fontWeight: "800", color: "#92400e" }}>+{data.pointsEarned} ⭐</Text>
              </View>
              <Text style={{ fontSize: 12, color: colors.mutedForeground }}>
                {new Date(data.submittedAt).toLocaleDateString("ru-RU")}
              </Text>
            </View>
          </View>

          <View style={s.statsRow}>
            <View style={s.stat}>
              <Text style={[s.statVal, { color: "#10b981" }]}>{data.correctCount}</Text>
              <Text style={s.statLabel}>Правильно</Text>
            </View>
            <View style={s.stat}>
              <Text style={[s.statVal, { color: "#ef4444" }]}>{data.totalQuestions - data.correctCount}</Text>
              <Text style={s.statLabel}>Ошибок</Text>
            </View>
            <View style={s.stat}>
              <Text style={s.statVal}>{data.totalQuestions}</Text>
              <Text style={s.statLabel}>Всего</Text>
            </View>
          </View>
        </View>

        {/* Mistakes first */}
        {wrong.length > 0 && (
          <>
            <Text style={s.sectionTitle}>Ошибки · {wrong.length}</Text>
            {wrong.map((a, i) => (
              <View key={a.id} style={[s.answerCard, {
                backgroundColor: "#fef2f2", borderColor: "#fca5a5",
              }]}>
                <Text style={[s.questionNum, { color: "#ef4444" }]}>Вопрос {data.answers.indexOf(a) + 1}</Text>
                <Text style={s.questionText}>{a.questionText}</Text>
                <View style={s.answerRow}>
                  <Feather name="x-circle" size={15} color="#ef4444" style={{ marginTop: 1 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={[s.answerLabel, { color: "#ef4444" }]}>Ваш ответ</Text>
                    <Text style={[s.answerText, { color: "#ef4444" }]}>{a.studentAnswer}</Text>
                  </View>
                </View>
                <View style={[s.answerRow, { marginTop: 8 }]}>
                  <Feather name="check-circle" size={15} color="#10b981" style={{ marginTop: 1 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={[s.answerLabel, { color: "#10b981" }]}>Правильный ответ</Text>
                    <Text style={[s.answerText, { color: "#10b981" }]}>{a.correctAnswer}</Text>
                  </View>
                </View>
              </View>
            ))}
          </>
        )}

        {/* Correct answers */}
        {correct.length > 0 && (
          <>
            <Text style={[s.sectionTitle, { marginTop: wrong.length > 0 ? 16 : 0 }]}>
              Правильные · {correct.length}
            </Text>
            {correct.map((a) => (
              <View key={a.id} style={[s.answerCard, {
                backgroundColor: "#f0fdf4", borderColor: "#86efac",
              }]}>
                <Text style={[s.questionNum, { color: "#10b981" }]}>Вопрос {data.answers.indexOf(a) + 1}</Text>
                <Text style={s.questionText}>{a.questionText}</Text>
                <View style={s.answerRow}>
                  <Feather name="check-circle" size={15} color="#10b981" style={{ marginTop: 1 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={[s.answerLabel, { color: "#10b981" }]}>Ответ</Text>
                    <Text style={[s.answerText, { color: "#10b981" }]}>{a.studentAnswer}</Text>
                  </View>
                </View>
              </View>
            ))}
          </>
        )}

        {data.answers.length === 0 && (
          <View style={{ alignItems: "center", paddingVertical: 40, gap: 10 }}>
            <Feather name="info" size={36} color={colors.mutedForeground} />
            <Text style={{ fontSize: 14, color: colors.mutedForeground, textAlign: "center" }}>
              Подробные ответы недоступны для этого задания
            </Text>
          </View>
        )}

      </ScrollView>
    </View>
  );
}
