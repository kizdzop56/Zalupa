import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Platform, Alert, TextInput, Linking, Image,
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
  imageUrl: string | null;
  isDraft: boolean;
  timeLimitMinutes: number | null;
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

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

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

  // Timer state
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [timerExpired, setTimerExpired] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoSubmitRef = useRef(false);

  const isAdmin = user?.role === "admin";
  const isTeacherRole = user?.role === "teacher" || user?.role === "admin";
  const isStudent = user?.role === "student";

  // Keep a ref to latest answers so auto-submit captures them without closure issues
  const answersRef = useRef<Record<number, string>>({});

  // Load assignment
  useEffect(() => {
    if (!assignmentId) return;
    setAssignment(null);
    setAnswers({});
    setSubmitted(false);
    setResult(null);
    setIsLoading(true);
    setFetchError(null);
    setTimeLeft(null);
    setTimerExpired(false);
    autoSubmitRef.current = false;
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    apiFetch(`/api/assignments/${assignmentId}`)
      .then(setAssignment)
      .catch((e: Error) => setFetchError(e.message))
      .finally(() => setIsLoading(false));
  }, [assignmentId]);

  // Start timer when assignment loads (students only)
  useEffect(() => {
    if (!assignment || !isStudent || submitted) return;
    if (!assignment.timeLimitMinutes) return;

    const totalSeconds = assignment.timeLimitMinutes * 60;
    setTimeLeft(totalSeconds);

    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev === null || prev <= 1) {
          clearInterval(timerRef.current!);
          timerRef.current = null;
          setTimerExpired(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    };
  }, [assignment?.id, isStudent]);

  // Auto-submit when timer expires
  const handleSubmit = useCallback(async (forcedAnswers?: Record<number, string>) => {
    if (!assignment) return;
    if (submitting) return;
    setSubmitting(true);
    const currentAnswers = forcedAnswers ?? answers;
    try {
      const answerList = (assignment.questions || []).map((q: Question) => ({
        questionId: q.id,
        answer: currentAnswers[q.id] || "",
      }));
      const data = await apiFetch(`/api/assignments/${assignmentId}/submit`, {
        method: "POST",
        body: JSON.stringify({ answers: answerList }),
      });
      setResult(data);
      setSubmitted(true);
    } catch (e: any) {
      Alert.alert("Ошибка отправки", e.message ?? "Не удалось отправить. Попробуйте снова.");
    } finally {
      setSubmitting(false);
    }
  }, [assignment, answers, assignmentId, submitting]);

  // Keep answersRef in sync so auto-submit always sends the latest answers
  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  // Auto-submit when timer expires (call directly — never inside setState)
  useEffect(() => {
    if (timerExpired && !submitted && !autoSubmitRef.current) {
      autoSubmitRef.current = true;
      handleSubmit(answersRef.current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timerExpired]);

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      paddingTop: insets.top + (Platform.OS === "web" ? 67 : 16),
      paddingHorizontal: 20, paddingBottom: 12,
      flexDirection: "row", alignItems: "center", gap: 12,
    },
    backBtn: { width: 36, height: 36, justifyContent: "center", alignItems: "center" },
    headerTitle: { fontSize: 18, fontWeight: "800", color: colors.foreground, flex: 1 },
    scroll: { paddingHorizontal: 20, paddingBottom: insets.bottom + (Platform.OS === "web" ? 110 : 130) },
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
    timerBanner: {
      flexDirection: "row", alignItems: "center", gap: 8,
      borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
      marginBottom: 14, borderWidth: 1.5,
    },
    timerText: { fontSize: 22, fontWeight: "900", fontVariant: ["tabular-nums"] as any },
  });

  if (isLoading) {
    return <View style={[styles.container, styles.loading]}><ActivityIndicator color={colors.primary} size="large" /></View>;
  }

  if (fetchError || !assignment) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Feather name="arrow-left" size={22} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Задание</Text>
        </View>
        <View style={styles.loading}>
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
  const mediaUrl = assignment.mediaUrl || (assignment.type !== "reading" ? assignment.content : null);
  const textContent = assignment.type === "reading" ? assignment.content : null;
  const imageUrl = assignment.imageUrl;

  // Detect what kind of media the URL is
  const isAudioUrl = (url: string) => /\.(mp3|m4a|wav|ogg|aac)(\?|$)/i.test(url) || url.includes("/upload/audio");
  const isVideoUrl = (url: string) => url.includes("youtube") || url.includes("youtu.be") || /\.(mp4|mov|webm|avi)(\?|$)/i.test(url) || url.includes("/upload/video");

  const showVideoBlock = !!mediaUrl && (assignment.type === "video" || (assignment.type !== "audio" && isVideoUrl(mediaUrl)));
  const showAudioBlock = !!mediaUrl && (assignment.type === "audio" || (!showVideoBlock && isAudioUrl(mediaUrl)));

  const openMedia = () => {
    if (!mediaUrl) return;
    const url = mediaUrl.startsWith("http") ? mediaUrl : `https://${mediaUrl}`;
    Linking.openURL(url);
  };

  const youtubeEmbed = mediaUrl
    ? mediaUrl.replace("watch?v=", "embed/").replace("youtu.be/", "www.youtube.com/embed/")
    : null;

  // Timer display helpers
  const hasTimer = isStudent && !!assignment.timeLimitMinutes && !submitted;
  const timerWarning = timeLeft !== null && timeLeft < 60;
  const timerDanger = timeLeft !== null && timeLeft < 30;
  const timerColor = timerDanger ? colors.destructive : timerWarning ? "#f59e0b" : colors.success;
  const inputsDisabled = submitted || timerExpired;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{assignment.title}</Text>

        {/* Timer badge in header */}
        {hasTimer && timeLeft !== null && (
          <View style={[styles.timerBanner, {
            borderColor: timerColor + "60",
            backgroundColor: timerColor + "12",
            paddingHorizontal: 10, paddingVertical: 6,
            marginBottom: 0,
          }]}>
            <Feather name="clock" size={16} color={timerColor} />
            <Text style={[styles.timerText, { fontSize: 17, color: timerColor }]}>
              {formatTime(timeLeft)}
            </Text>
          </View>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Timer expired banner */}
        {timerExpired && !submitted && (
          <View style={{
            backgroundColor: "#fef2f2", borderRadius: 14, padding: 14,
            borderWidth: 1.5, borderColor: "#fca5a5", marginBottom: 16,
            flexDirection: "row", alignItems: "center", gap: 10,
          }}>
            <Feather name="clock" size={20} color={colors.destructive} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, fontWeight: "800", color: colors.destructive }}>Время вышло!</Text>
              <Text style={{ fontSize: 12, color: colors.destructive, marginTop: 2 }}>
                {submitting ? "Ответы отправляются…" : "Не удалось отправить автоматически"}
              </Text>
            </View>
            {submitting ? (
              <ActivityIndicator color={colors.destructive} />
            ) : (
              <TouchableOpacity
                onPress={() => {
                  autoSubmitRef.current = false;
                  setAnswers(prev => { handleSubmit(prev); return prev; });
                }}
                style={{ backgroundColor: colors.destructive, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 }}
              >
                <Text style={{ color: "#fff", fontSize: 12, fontWeight: "700" }}>Повторить</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Timer running banner (shown inside scroll on mobile) */}
        {hasTimer && timeLeft !== null && !timerExpired && Platform.OS !== "web" && (
          <View style={[styles.timerBanner, {
            borderColor: timerColor + "60",
            backgroundColor: timerColor + "12",
            marginBottom: 12,
          }]}>
            <Feather name="clock" size={20} color={timerColor} />
            <Text style={{ fontSize: 14, color: timerColor, fontWeight: "700", flex: 1 }}>
              Оставшееся время:
            </Text>
            <Text style={[styles.timerText, { color: timerColor }]}>
              {formatTime(timeLeft)}
            </Text>
          </View>
        )}

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
            {assignment.timeLimitMinutes ? (
              <View style={[styles.badge, { backgroundColor: "#f59e0b18" }]}>
                <Feather name="clock" size={12} color="#92400e" />
                <Text style={[styles.badgeText, { color: "#92400e" }]}>{assignment.timeLimitMinutes} мин</Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* Result after submission */}
        {submitted && result && (
          <View style={[styles.resultCard, { borderColor: result.score >= 70 ? colors.success : colors.destructive }]}>
            {timerExpired && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 }}>
                <Feather name="clock" size={14} color={colors.mutedForeground} />
                <Text style={{ fontSize: 12, color: colors.mutedForeground }}>Время истекло — задание сдано автоматически</Text>
              </View>
            )}
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

        {/* Image */}
        {imageUrl ? (
          <View style={[styles.content, { padding: 0, overflow: "hidden" }]}>
            <Image
              source={{ uri: imageUrl }}
              style={{ width: "100%", height: 200, borderRadius: 12 }}
              resizeMode="cover"
            />
          </View>
        ) : null}

        {/* Reading text */}
        {textContent && (
          <View style={styles.content}>
            <Text style={[styles.sectionTitle, { marginBottom: 8 }]}>Текст для чтения</Text>
            <Text style={styles.contentText}>{textContent}</Text>
          </View>
        )}

        {/* Video */}
        {showVideoBlock && (
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
        {showAudioBlock && (
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
              const isLocked = inputsDisabled;

              return (
                <View key={q.id} style={[styles.questionCard, isLocked && !submitted && { opacity: 0.6 }]}>
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
                            onPress={() => !isLocked && setAnswers(prev => ({ ...prev, [q.id]: opt }))}
                            activeOpacity={isLocked ? 1 : 0.7}
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
                        onChangeText={v => !isLocked && setAnswers(prev => ({ ...prev, [q.id]: v }))}
                        placeholder={isLocked && !submitted ? "Время вышло" : "Ваш ответ..."}
                        placeholderTextColor={colors.mutedForeground}
                        editable={!isLocked}
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

        {/* Submit button — shown for all assignment types, not just those with questions */}
        {!isTeacherRole && !submitted && !timerExpired && (
          <TouchableOpacity style={styles.submitBtn} onPress={() => handleSubmit()} disabled={submitting}>
            {submitting
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.submitText}>
                  {(assignment.questions || []).length === 0 ? "Отметить как выполненное" : "Отправить ответы"}
                </Text>
            }
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}
