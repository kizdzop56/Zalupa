import React, { useState } from "react";
import {
  View, Text, TextInput, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator, Platform,
} from "react-native";
import { useRouter } from "expo-router";
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
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? `Ошибка сервера (${res.status})`);
  return data;
}

const TYPES = [
  { key: "text_test", label: "Тест",        icon: "edit-3"     },
  { key: "audio",     label: "Аудирование", icon: "headphones" },
  { key: "reading",   label: "Чтение",      icon: "book"       },
  { key: "video",     label: "Видео",       icon: "video"      },
] as const;
type AssignmentType = typeof TYPES[number]["key"];

type QuestionFormat = "open" | "choice";

type QuestionDraft = {
  text: string;
  format: QuestionFormat;
  correctAnswer: string;
  options: string[];      // для формата "choice"
  correctIndex: number;   // индекс правильного варианта в options
};

const DEFAULT_QUESTION = (): QuestionDraft => ({
  text: "",
  format: "open",
  correctAnswer: "",
  options: ["", "", ""],
  correctIndex: 0,
});

export default function CreateAssignmentScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [type, setType] = useState<AssignmentType>("text_test");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [ageMin, setAgeMin] = useState("5");
  const [ageMax, setAgeMax] = useState("18");
  const [points, setPoints] = useState("10");
  const [content, setContent] = useState("");
  const [questions, setQuestions] = useState<QuestionDraft[]>([DEFAULT_QUESTION()]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [success, setSuccess] = useState(false);

  // ── Question helpers ────────────────────────────────────────────────
  const addQuestion = () => setQuestions((p) => [...p, DEFAULT_QUESTION()]);
  const removeQuestion = (i: number) =>
    setQuestions((p) => p.filter((_, idx) => idx !== i));
  const updateQ = <K extends keyof QuestionDraft>(i: number, key: K, val: QuestionDraft[K]) =>
    setQuestions((p) => p.map((q, idx) => idx === i ? { ...q, [key]: val } : q));
  const updateOption = (qi: number, oi: number, val: string) =>
    setQuestions((p) => p.map((q, idx) =>
      idx === qi ? { ...q, options: q.options.map((o, j) => j === oi ? val : o) } : q
    ));
  const addOption = (qi: number) =>
    setQuestions((p) => p.map((q, idx) =>
      idx === qi && q.options.length < 6 ? { ...q, options: [...q.options, ""] } : q
    ));
  const removeOption = (qi: number, oi: number) =>
    setQuestions((p) => p.map((q, idx) => {
      if (idx !== qi || q.options.length <= 2) return q;
      const next = q.options.filter((_, j) => j !== oi);
      const newCorrectIdx = q.correctIndex >= next.length ? next.length - 1 : q.correctIndex;
      return { ...q, options: next, correctIndex: newCorrectIdx };
    }));

  // ── Submit ──────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    setFormError("");

    // Validation
    if (!title.trim()) { setFormError("Введите название задания"); return; }
    if (!description.trim()) { setFormError("Введите описание задания"); return; }

    const ageMinNum = parseInt(ageMin, 10);
    const ageMaxNum = parseInt(ageMax, 10);
    if (isNaN(ageMinNum) || ageMinNum < 1 || ageMinNum > 100) {
      setFormError("Возраст «от» введён некорректно (1–100)");
      return;
    }
    if (isNaN(ageMaxNum) || ageMaxNum < 1 || ageMaxNum > 100) {
      setFormError("Возраст «до» введён некорректно (1–100)");
      return;
    }
    if (ageMinNum > ageMaxNum) {
      setFormError("Возраст «от» не может быть больше возраста «до»");
      return;
    }

    const questionPayload = questions
      .filter((q) => q.text.trim())
      .map((q, i) => {
        if (q.format === "choice") {
          const filledOptions = q.options.filter((o) => o.trim());
          if (filledOptions.length < 2) return null;
          const correct = filledOptions[q.correctIndex] ?? filledOptions[0];
          return {
            text: q.text.trim(),
            options: filledOptions,
            correctAnswer: correct.trim(),
            orderIndex: i,
          };
        }
        return {
          text: q.text.trim(),
          options: [] as string[],
          correctAnswer: q.correctAnswer.trim(),
          orderIndex: i,
        };
      })
      .filter(Boolean);

    setSaving(true);
    try {
      await apiFetch("/api/assignments", {
        method: "POST",
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          type,
          ageMin: ageMinNum,
          ageMax: ageMaxNum,
          points: parseInt(points) || 10,
          content: content.trim() || undefined,
          questions: questionPayload,
        }),
      });
      setSuccess(true);
      setTimeout(() => router.back(), 1200);
    } catch (e: any) {
      setFormError(e?.message ?? "Не удалось создать задание");
    } finally {
      setSaving(false);
    }
  };

  const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      paddingTop: insets.top + (Platform.OS === "web" ? 67 : 16),
      paddingHorizontal: 20, paddingBottom: 8,
      flexDirection: "row", alignItems: "center", gap: 12,
    },
    backBtn: { width: 36, height: 36, justifyContent: "center", alignItems: "center" },
    headerTitle: { fontSize: 20, fontWeight: "800", color: colors.foreground, flex: 1 },
    scroll: { paddingHorizontal: 20, paddingBottom: insets.bottom + 140 },
    section: { marginBottom: 20 },
    sectionTitle: {
      fontSize: 12, fontWeight: "700", color: colors.mutedForeground,
      textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 10,
    },
    typeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    typeBtn: {
      flexDirection: "row", alignItems: "center", gap: 6,
      paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12,
      borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.card,
    },
    typeBtnActive: { borderColor: colors.primary, backgroundColor: colors.primary + "12" },
    typeBtnText: { fontSize: 13, fontWeight: "600", color: colors.mutedForeground },
    typeBtnTextActive: { color: colors.primary },
    label: { fontSize: 14, fontWeight: "600", color: colors.foreground, marginBottom: 6 },
    input: {
      backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
      borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
      fontSize: 15, color: colors.foreground, marginBottom: 12,
    },
    textArea: { minHeight: 90, textAlignVertical: "top" },
    row: { flexDirection: "row", gap: 12 },
    half: { flex: 1 },
    questionCard: {
      backgroundColor: colors.card, borderRadius: 16, padding: 14,
      borderWidth: 1, borderColor: colors.border, marginBottom: 12,
    },
    questionHeader: {
      flexDirection: "row", alignItems: "center",
      justifyContent: "space-between", marginBottom: 10,
    },
    questionNum: { fontSize: 13, fontWeight: "700", color: colors.primary },
    formatRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
    formatBtn: {
      flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
      gap: 5, paddingVertical: 8, borderRadius: 10, borderWidth: 1.5,
    },
    formatBtnText: { fontSize: 13, fontWeight: "600" },
    optionRow: {
      flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8,
    },
    radio: {
      width: 22, height: 22, borderRadius: 11, borderWidth: 2,
      justifyContent: "center", alignItems: "center",
    },
    optionInput: {
      flex: 1, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border,
      borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9,
      fontSize: 14, color: colors.foreground,
    },
    addOptBtn: {
      flexDirection: "row", alignItems: "center", justifyContent: "center",
      gap: 5, paddingVertical: 8, borderRadius: 10,
      borderWidth: 1.5, borderColor: colors.border, borderStyle: "dashed",
      marginBottom: 4,
    },
    addQBtn: {
      flexDirection: "row", alignItems: "center", gap: 6, justifyContent: "center",
      paddingVertical: 12, borderRadius: 12, borderWidth: 1.5,
      borderColor: colors.border, borderStyle: "dashed",
    },
    addQBtnText: { fontSize: 14, fontWeight: "600", color: colors.mutedForeground },
    submitBtn: {
      backgroundColor: colors.primary, borderRadius: 14,
      paddingVertical: 16, alignItems: "center", marginTop: 8,
      flexDirection: "row", justifyContent: "center", gap: 8,
    },
    submitText: { fontSize: 16, fontWeight: "700", color: "#fff" },
  });

  const contentLabel =
    type === "reading" ? "Текст для чтения"
    : type === "audio" ? "Ссылка на аудио"
    : "Ссылка на видео";

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Создать задание</Text>
      </View>

      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">

        {/* Тип задания */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Тип задания</Text>
          <View style={s.typeGrid}>
            {TYPES.map((t) => (
              <TouchableOpacity
                key={t.key}
                style={[s.typeBtn, type === t.key && s.typeBtnActive]}
                onPress={() => setType(t.key)}
              >
                <Feather name={t.icon as any} size={16} color={type === t.key ? colors.primary : colors.mutedForeground} />
                <Text style={[s.typeBtnText, type === t.key && s.typeBtnTextActive]}>{t.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Основная информация */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Основная информация</Text>

          <Text style={s.label}>Название</Text>
          <TextInput
            style={s.input} value={title} onChangeText={setTitle}
            placeholder="Например: Глаголы прошедшего времени"
            placeholderTextColor={colors.mutedForeground}
          />

          <Text style={s.label}>Описание</Text>
          <TextInput
            style={[s.input, s.textArea]} value={description} onChangeText={setDescription}
            placeholder="Краткое описание задания для ученика"
            placeholderTextColor={colors.mutedForeground}
            multiline
          />

          <View style={s.row}>
            <View style={s.half}>
              <Text style={s.label}>Возраст от</Text>
              <TextInput style={s.input} value={ageMin} onChangeText={setAgeMin} keyboardType="numeric" placeholder="5" placeholderTextColor={colors.mutedForeground} />
            </View>
            <View style={s.half}>
              <Text style={s.label}>Возраст до</Text>
              <TextInput style={s.input} value={ageMax} onChangeText={setAgeMax} keyboardType="numeric" placeholder="18" placeholderTextColor={colors.mutedForeground} />
            </View>
          </View>

          <Text style={s.label}>Баллы за выполнение</Text>
          <TextInput
            style={s.input} value={points} onChangeText={setPoints}
            keyboardType="numeric" placeholder="10"
            placeholderTextColor={colors.mutedForeground}
          />
        </View>

        {/* Контент (чтение / аудио / видео) */}
        {(type === "reading" || type === "audio" || type === "video") && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Контент</Text>
            <Text style={s.label}>{contentLabel}</Text>
            <TextInput
              style={[s.input, type === "reading" && s.textArea]}
              value={content} onChangeText={setContent}
              placeholder={type === "reading" ? "Вставьте текст для чтения..." : "Вставьте URL медиафайла..."}
              placeholderTextColor={colors.mutedForeground}
              multiline={type === "reading"}
            />
          </View>
        )}

        {/* Вопросы */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Вопросы</Text>

          {questions.map((q, qi) => (
            <View key={qi} style={s.questionCard}>
              {/* Header */}
              <View style={s.questionHeader}>
                <Text style={s.questionNum}>Вопрос {qi + 1}</Text>
                {questions.length > 1 && (
                  <TouchableOpacity onPress={() => removeQuestion(qi)}>
                    <Feather name="x" size={18} color={colors.destructive} />
                  </TouchableOpacity>
                )}
              </View>

              {/* Question text */}
              <TextInput
                style={[s.input, s.textArea, { minHeight: 60 }]}
                value={q.text}
                onChangeText={(v) => updateQ(qi, "text", v)}
                placeholder="Текст вопроса"
                placeholderTextColor={colors.mutedForeground}
                multiline
              />

              {/* Format selector */}
              <View style={s.formatRow}>
                {(["open", "choice"] as QuestionFormat[]).map((fmt) => {
                  const active = q.format === fmt;
                  return (
                    <TouchableOpacity
                      key={fmt}
                      style={[
                        s.formatBtn,
                        { borderColor: active ? colors.primary : colors.border,
                          backgroundColor: active ? colors.primary + "12" : colors.background },
                      ]}
                      onPress={() => updateQ(qi, "format", fmt)}
                    >
                      <Feather
                        name={fmt === "open" ? "edit-2" : "list"}
                        size={14}
                        color={active ? colors.primary : colors.mutedForeground}
                      />
                      <Text style={[s.formatBtnText, { color: active ? colors.primary : colors.mutedForeground }]}>
                        {fmt === "open" ? "Свободный ответ" : "Варианты ответов"}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Open text answer */}
              {q.format === "open" && (
                <TextInput
                  style={s.input}
                  value={q.correctAnswer}
                  onChangeText={(v) => updateQ(qi, "correctAnswer", v)}
                  placeholder="Правильный ответ"
                  placeholderTextColor={colors.mutedForeground}
                />
              )}

              {/* Multiple choice options */}
              {q.format === "choice" && (
                <View>
                  <Text style={{ fontSize: 12, fontWeight: "700", color: colors.mutedForeground, marginBottom: 8 }}>
                    ВАРИАНТЫ · выбери правильный
                  </Text>
                  {q.options.map((opt, oi) => {
                    const isCorrect = q.correctIndex === oi;
                    return (
                      <View key={oi} style={s.optionRow}>
                        {/* Radio button */}
                        <TouchableOpacity
                          style={[
                            s.radio,
                            { borderColor: isCorrect ? "#10b981" : colors.border,
                              backgroundColor: isCorrect ? "#10b981" : "transparent" },
                          ]}
                          onPress={() => updateQ(qi, "correctIndex", oi)}
                        >
                          {isCorrect && <Feather name="check" size={13} color="#fff" />}
                        </TouchableOpacity>

                        {/* Option text */}
                        <TextInput
                          style={[
                            s.optionInput,
                            isCorrect && { borderColor: "#10b981", backgroundColor: "#f0fdf4" },
                          ]}
                          value={opt}
                          onChangeText={(v) => updateOption(qi, oi, v)}
                          placeholder={`Вариант ${oi + 1}`}
                          placeholderTextColor={colors.mutedForeground}
                        />

                        {/* Remove option */}
                        {q.options.length > 2 && (
                          <TouchableOpacity onPress={() => removeOption(qi, oi)}>
                            <Feather name="x" size={16} color={colors.mutedForeground} />
                          </TouchableOpacity>
                        )}
                      </View>
                    );
                  })}

                  {/* Add option */}
                  {q.options.length < 6 && (
                    <TouchableOpacity style={s.addOptBtn} onPress={() => addOption(qi)}>
                      <Feather name="plus" size={14} color={colors.mutedForeground} />
                      <Text style={{ fontSize: 13, color: colors.mutedForeground, fontWeight: "600" }}>
                        Добавить вариант
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
          ))}

          <TouchableOpacity style={s.addQBtn} onPress={addQuestion}>
            <Feather name="plus" size={16} color={colors.mutedForeground} />
            <Text style={s.addQBtnText}>Добавить вопрос</Text>
          </TouchableOpacity>
        </View>

        {/* Inline error */}
        {!!formError && (
          <View style={{
            backgroundColor: "#fef2f2", borderWidth: 1, borderColor: "#fca5a5",
            borderRadius: 12, padding: 12, marginBottom: 12, flexDirection: "row", alignItems: "center", gap: 8,
          }}>
            <Feather name="alert-circle" size={16} color={colors.destructive} />
            <Text style={{ fontSize: 14, color: colors.destructive, flex: 1 }}>{formError}</Text>
          </View>
        )}

        {/* Success banner */}
        {success && (
          <View style={{
            backgroundColor: "#f0fdf4", borderWidth: 1, borderColor: "#86efac",
            borderRadius: 12, padding: 12, marginBottom: 12, flexDirection: "row", alignItems: "center", gap: 8,
          }}>
            <Feather name="check-circle" size={16} color={colors.success} />
            <Text style={{ fontSize: 14, color: colors.success, fontWeight: "600" }}>Задание создано!</Text>
          </View>
        )}

        {/* Submit */}
        <TouchableOpacity style={[s.submitBtn, success && { backgroundColor: colors.success }]} onPress={handleSubmit} disabled={saving || success}>
          {saving
            ? <ActivityIndicator color="#fff" />
            : <>
                <Feather name="check" size={18} color="#fff" />
                <Text style={s.submitText}>{success ? "Готово!" : "Сохранить черновик"}</Text>
              </>
          }
        </TouchableOpacity>

      </ScrollView>
    </View>
  );
}
