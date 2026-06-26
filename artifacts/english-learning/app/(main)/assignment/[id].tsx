import React, { useState, useEffect, useRef } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Platform, Alert, TextInput, Linking,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/contexts/AuthContext";
import AsyncStorage from "@react-native-async-storage/async-storage";

const BASE_URL = process.env["EXPO_PUBLIC_DOMAIN"]
  ? `https://${process.env["EXPO_PUBLIC_DOMAIN"]}`
  : "";

async function apiFetch(path: string, options?: RequestInit) {
  const token = await AsyncStorage.getItem("auth_token");
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options?.headers ?? {}),
    },
  });
  if (res.status === 204) return null;
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? `Ошибка ${res.status}`);
  return data;
}

type Question = {
  id: number;
  text: string;
  options: string[] | null;
  correctAnswer: string | null;
  orderIndex: number;
};

type AssignmentDetail = {
  id: number;
  title: string;
  description: string;
  type: string;
  points: number;
  ageMin: number;
  ageMax: number;
  content: string | null;
  mediaUrl: string | null;
  isDraft: boolean;
  questions: Question[];
};

const TYPE_COLORS: Record<string, string> = {
  text_test: "#8b5cf6",
  audio: "#06b6d4",
  reading: "#10b981",
  video: "#f59e0b",
};

const TYPE_LABELS: Record<string, string> = {
  text_test: "Тест",
  audio: "Аудирование",
  reading: "Чтение",
  video: "Видео",
};

export default function AssignmentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const assignmentId = parseInt(id || "0", 10);
  const colors = useColors();
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [assignment, setAssignment] = useState<AssignmentDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<any>(null);

  const isAdmin = user?.role === "admin";
  const isTeacherRole = user?.role === "teacher" || user?.role === "admin";

  // Load assignment — also resets all answer state when navigating to a different assignment
  useEffect(() => {
    if (!assignmentId) return;
    setAssignment(null);
    setAnswers({});
    setSubmitted(false);
    setResult(null);
    setIsLoading(true);
    setFetchError(null);
    apiFetch(`/api/assignments/${assignmentId}`)
      .then(setAssignment)
      .catch((e: Error) => setFetchError(e.message))
      .finally(() => setIsLoading(false));
  }, [assignmentId]);

  const handleSubmit = async () => {
    if (!assignment) return;
    setSubmitting(true);
    try {
      const answerList = (assignment.questions || []).map((q: Question) => ({
        questionId: q.id,
        answer: answers[q.id] || "",
      }));
      const data = await apiFetch(`/api/assignments/${assignmentId}/submit`, {
        method: "POST",
        body: JSON.stringify({ answers: answerList }),
      });
      setResult(data);
      setSubmitted(true);
    } catch (e: any) {
      Alert.alert("Ошибка", "Не удалось отправить. Попробуйте снова.");
    } finally {
      setSubmitting(false);
    }
  };

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
    card: {
      backgroundColor: colors.card, borderRadius: 16, padding: 16,
      borderWidth: 1, borderColor: colors.border, marginBottom: 16,
    },
    assignTitle: { fontSize: 20, fontWeight: "800", color: colors.foreground, marginBottom: 6 },
    assignDesc: { fontSize: 14, color: colors.mutedForeground, lineHeight: 20, marginBottom: 12 },
    metaRow: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
    badge: {
      paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8,
      flexDirection: "row", alignItems: "center", gap: 4,
    },
    badgeText: { fontSize: 12, fontWeight: "600" },
    sectionTitle: { fontSize: 16, fontWeight: "700", color: colors.foreground, marginBottom: 12 },
    questionCard: {
      backgroundColor: colors.card, borderRadius: 14, padding: 14,
      borderWidth: 1, borderColor: colors.border, marginBottom: 10,
    },
    questionText: { fontSize: 15, fontWeight: "600", color: colors.foreground, marginBottom: 10 },
    answerInput: {
      borderWidth: 1.5, borderColor: colors.border, borderRadius: 10,
      paddingHorizontal: 12, paddingVertical: 10,
      fontSize: 15, color: colors.foreground,
      backgroundColor: colors.background,
      ...(Platform.OS === "web" ? { outlineWidth: 0 } as any : {}),
    },
    answerCorrect: { borderColor: colors.success, backgroundColor: "#f0fdf4" },
    answerWrong: { borderColor: colors.destructive, backgroundColor: "#fef2f2" },
    correctLabel: { fontSize: 12, color: colors.success, fontWeight: "600", marginTop: 6 },
    wrongLabel: { fontSize: 12, color: colors.destructive, fontWeight: "600", marginTop: 6 },
    submitBtn: {
      backgroundColor: colors.primary, borderRadius: 14,
      paddingVertical: 16, alignItems: "center",
    },
    submitText: { fontSize: 16, fontWeight: "700", color: colors.primaryForeground },
    resultCard: {
      backgroundColor: colors.card, borderRadius: 16, padding: 20,
      borderWidth: 1.5, marginBottom: 16, alignItems: "center",
    },
    resultScore: { fontSize: 48, fontWeight: "900", marginBottom: 4 },
    resultLabel: { fontSize: 16, color: colors.mutedForeground, marginBottom: 8 },
    resultPoints: {
      flexDirection: "row", alignItems: "center", gap: 6,
      backgroundColor: "#fef3c7", paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
    },
    resultPointsText: { fontSize: 16, fontWeight: "700", color: "#92400e" },
    content: {
      backgroundColor: colors.muted, borderRadius: 12, padding: 14,
      marginBottom: 16, borderWidth: 1, borderColor: colors.border,
    },
    contentText: { fontSize: 14, color: colors.foreground, lineHeight: 22 },
    loading: { flex: 1, justifyContent: "center", alignItems: "center" },
    mediaBtn: {
      borderRadius: 12, paddingVertical: 13, paddingHorizontal: 16,
      flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    },
    mediaHint: { fontSize: 13, color: colors.mutedForeground, marginBottom: 10, lineHeight: 18 },
  });

  if (isLoading) {
    return <View style={[styles.container, styles.loading]}><ActivityIndicator color={colors.primary} size="large" /></View>;
  }

  if (fetchError || !assignment) {
    return (
      <View style={[styles.container]}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Feather name="arrow-left" size={22} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Задание</Text>
        </View>
        <View style={[styles.loading]}>
          <Feather name="alert-circle" size={40} color={colors.destructive} />
          <Text style={{ marginTop: 12, fontSize: 15, color: colors.mutedForeground, textAlign: "center", paddingHorizontal: 40 }}>
            {fetchError ?? "Задание не найдено"}
          </Text>
          <TouchableOpacity
            style={{ marginTop: 16, backgroundColor: colors.primary, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 }}
            onPress={() => {
              setIsLoading(true);
              setFetchError(null);
              apiFetch(`/api/assignments/${assignmentId}`)
                .then(setAssignment)
                .catch((e: Error) => setFetchError(e.message))
                .finally(() => setIsLoading(false));
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>Повторить</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const typeColor = TYPE_COLORS[assignment.type] || colors.primary;

  // ── Media helper ────────────────────────────────────────────────────
  const mediaUrl = assignment.mediaUrl || (assignment.type !== "reading" ? assignment.content : null);
  const textContent = assignment.type === "reading" ? assignment.content : null;

  const openMedia = () => {
    if (!mediaUrl) return;
    const url = mediaUrl.startsWith("http") ? mediaUrl : `https://${mediaUrl}`;
    Linking.openURL(url);
  };

  const youtubeEmbed = mediaUrl
    ? mediaUrl.replace("watch?v=", "embed/").replace("youtu.be/", "www.youtube.com/embed/")
    : null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{assignment.title}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Info card */}
        <View style={styles.card}>
          <Text style={styles.assignTitle}>{assignment.title}</Text>
          <Text style={styles.assignDesc}>{assignment.description}</Text>
          <View style={styles.metaRow}>
            <View style={[styles.badge, { backgroundColor: typeColor + "18" }]}>
              <Text style={[styles.badgeText, { color: typeColor }]}>{TYPE_LABELS[assignment.type] ?? assignment.type}</Text>
            </View>
            <View style={[styles.badge, { backgroundColor: "#fef3c7" }]}>
              <Feather name="star" size={12} color="#92400e" />
              <Text style={[styles.badgeText, { color: "#92400e" }]}>{assignment.points} очков</Text>
            </View>
            <View style={[styles.badge, { backgroundColor: colors.muted }]}>
              <Feather name="users" size={12} color={colors.mutedForeground} />
              <Text style={[styles.badgeText, { color: colors.mutedForeground }]}>{assignment.ageMin}–{assignment.ageMax} лет</Text>
            </View>
          </View>
        </View>

        {/* Result after submission */}
        {submitted && result && (
          <View style={[styles.resultCard, { borderColor: result.score >= 70 ? colors.success : colors.destructive }]}>
            <Text style={[styles.resultScore, { color: result.score >= 70 ? colors.success : colors.destructive }]}>
              {result.score}%
            </Text>
            <Text style={styles.resultLabel}>{result.correctCount}/{result.totalQuestions} правильно</Text>
            <View style={styles.resultPoints}>
              <Feather name="star" size={16} color="#92400e" />
              <Text style={styles.resultPointsText}>+{result.pointsEarned} очков!</Text>
            </View>
          </View>
        )}

        {/* Reading text */}
        {textContent && (
          <View style={styles.content}>
            <Text style={[styles.sectionTitle, { marginBottom: 8 }]}>Текст для чтения</Text>
            <Text style={styles.contentText}>{textContent}</Text>
          </View>
        )}

        {/* Video */}
        {assignment.type === "video" && mediaUrl && (
          <View style={[styles.content, { gap: 8 }]}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: "#f59e0b20", justifyContent: "center", alignItems: "center" }}>
                <Feather name="video" size={17} color="#f59e0b" />
              </View>
              <Text style={styles.sectionTitle}>Видео</Text>
            </View>
            {!isTeacherRole && (
              <Text style={styles.mediaHint}>📺 Сначала посмотрите видео, затем ответьте на вопросы</Text>
            )}
            {Platform.OS === "web" && youtubeEmbed && youtubeEmbed.includes("embed") ? (
              <View style={{ borderRadius: 12, overflow: "hidden", marginBottom: 8 }}>
                {/* @ts-ignore */}
                <iframe
                  src={youtubeEmbed}
                  style={{ width: "100%", height: 220, border: "none" }}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </View>
            ) : null}
            <TouchableOpacity style={[styles.mediaBtn, { backgroundColor: "#f59e0b" }]} onPress={openMedia}>
              <Feather name="play-circle" size={18} color="#fff" />
              <Text style={{ fontSize: 15, fontWeight: "700", color: "#fff" }}>Открыть видео</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Audio */}
        {assignment.type === "audio" && mediaUrl && (
          <View style={[styles.content, { gap: 8 }]}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: "#06b6d420", justifyContent: "center", alignItems: "center" }}>
                <Feather name="headphones" size={17} color="#06b6d4" />
              </View>
              <Text style={styles.sectionTitle}>Аудио</Text>
            </View>
            {!isTeacherRole && (
              <Text style={styles.mediaHint}>🎧 Сначала прослушайте аудио, затем ответьте на вопросы</Text>
            )}
            {Platform.OS === "web" ? (
              /* @ts-ignore */
              <audio controls src={mediaUrl} style={{ width: "100%", borderRadius: 8 }} />
            ) : (
              <TouchableOpacity style={[styles.mediaBtn, { backgroundColor: "#06b6d4" }]} onPress={openMedia}>
                <Feather name="headphones" size={18} color="#fff" />
                <Text style={{ fontSize: 15, fontWeight: "700", color: "#fff" }}>Открыть аудио</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Questions */}
        {(assignment.questions || []).length > 0 && (
          <View style={{ marginBottom: 16 }}>
            <Text style={styles.sectionTitle}>Вопросы</Text>
            {(assignment.questions || []).map((q: Question, i: number) => {
              const questionResult = result?.results?.find((r: any) => r.questionId === q.id);
              const hasOptions = Array.isArray(q.options) && q.options.length > 0;
              const selected = answers[q.id];
              return (
                <View key={q.id} style={styles.questionCard}>
                  <Text style={styles.questionText}>{i + 1}. {q.text}</Text>

                  {isTeacherRole && q.correctAnswer ? (
                    <View style={[styles.answerInput, styles.answerCorrect]}>
                      <Text style={{ color: colors.success, fontWeight: "600" }}>✓ {q.correctAnswer}</Text>
                    </View>
                  ) : hasOptions ? (
                    <View style={{ gap: 8 }}>
                      {(q.options as string[]).map((opt, oi) => {
                        const isSelected = selected === opt;
                        const isCorrectOpt = submitted && opt === questionResult?.correctAnswer;
                        const isWrongOpt = submitted && isSelected && !questionResult?.isCorrect;
                        return (
                          <TouchableOpacity
                            key={oi}
                            onPress={() => !submitted && setAnswers(prev => ({ ...prev, [q.id]: opt }))}
                            activeOpacity={submitted ? 1 : 0.7}
                            style={{
                              flexDirection: "row", alignItems: "center", gap: 10,
                              padding: 12, borderRadius: 12, borderWidth: 1.5,
                              borderColor: isCorrectOpt ? colors.success
                                : isWrongOpt ? colors.destructive
                                : isSelected ? colors.primary
                                : colors.border,
                              backgroundColor: isCorrectOpt ? "#f0fdf4"
                                : isWrongOpt ? "#fef2f2"
                                : isSelected ? colors.primary + "12"
                                : colors.background,
                            }}
                          >
                            <View style={{
                              width: 22, height: 22, borderRadius: 11, borderWidth: 2,
                              borderColor: isCorrectOpt ? colors.success
                                : isWrongOpt ? colors.destructive
                                : isSelected ? colors.primary
                                : colors.border,
                              backgroundColor: (isSelected || isCorrectOpt) ? (isCorrectOpt ? colors.success : colors.primary) : "transparent",
                              justifyContent: "center", alignItems: "center",
                            }}>
                              {(isSelected || isCorrectOpt) && <Feather name="check" size={13} color="#fff" />}
                            </View>
                            <Text style={{
                              fontSize: 14, flex: 1, fontWeight: isSelected ? "600" : "400",
                              color: isCorrectOpt ? colors.success
                                : isWrongOpt ? colors.destructive
                                : colors.foreground,
                            }}>{opt}</Text>
                          </TouchableOpacity>
                        );
                      })}
                      {submitted && questionResult && !questionResult.isCorrect && (
                        <Text style={styles.wrongLabel}>✗ Правильно: {questionResult.correctAnswer}</Text>
                      )}
                      {submitted && questionResult?.isCorrect && (
                        <Text style={styles.correctLabel}>✓ Верно!</Text>
                      )}
                    </View>
                  ) : (
                    <>
                      <TextInput
                        style={[
                          styles.answerInput,
                          submitted && questionResult?.isCorrect && styles.answerCorrect,
                          submitted && questionResult && !questionResult.isCorrect && styles.answerWrong,
                        ]}
                        value={answers[q.id] || ""}
                        onChangeText={v => setAnswers(prev => ({ ...prev, [q.id]: v }))}
                        placeholder="Ваш ответ..."
                        placeholderTextColor={colors.mutedForeground}
                        editable={!submitted}
                      />
                      {submitted && questionResult && (
                        questionResult.isCorrect
                          ? <Text style={styles.correctLabel}>✓ Верно!</Text>
                          : <Text style={styles.wrongLabel}>✗ Правильно: {questionResult.correctAnswer}</Text>
                      )}
                    </>
                  )}
                </View>
              );
            })}
          </View>
        )}

        {/* Submit button */}
        {!isTeacherRole && !submitted && (assignment.questions || []).length > 0 && (
          <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} disabled={submitting}>
            {submitting
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.submitText}>Отправить ответы</Text>
            }
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}
