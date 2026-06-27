import React, { useState, useRef, useCallback } from "react";
import {
  View, Text, TextInput, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator, Platform, Switch, Image,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useAuth, isTeacherOrAdmin } from "@/contexts/AuthContext";
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
  options: string[];
  correctIndex: number;
};

const DEFAULT_QUESTION = (): QuestionDraft => ({
  text: "", format: "open", correctAnswer: "", options: ["", "", ""], correctIndex: 0,
});

const FRESH = () => ({
  type: "text_test" as AssignmentType,
  title: "", description: "",
  ageMin: "5", ageMax: "18", points: "10",
  content: "",
  mediaUrl: "", mediaInputMode: "url" as "url" | "file", uploadedFileName: "",
  imageUrl: "", imageInputMode: "url" as "url" | "file", uploadedImageName: "",
  audioUrl: "", audioInputMode: "url" as "url" | "file", uploadedAudioName: "",
  videoUrl: "", videoInputMode: "url" as "url" | "file", uploadedVideoName: "",
  timerEnabled: false, timerMinutes: "30",
  questions: [DEFAULT_QUESTION()],
  formError: "", success: false,
});

export default function CreateAssignmentScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [st, setSt] = useState(FRESH());
  const [uploading, setUploading] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<any>(null);
  const imageInputRef = useRef<any>(null);
  const audioInputRef = useRef<any>(null);
  const videoInputRef = useRef<any>(null);

  const set = <K extends keyof ReturnType<typeof FRESH>>(k: K, v: ReturnType<typeof FRESH>[K]) =>
    setSt(prev => ({ ...prev, [k]: v }));

  useFocusEffect(useCallback(() => {
    setSt(FRESH()); setUploading(null); setSaving(false);
  }, []));

  const { type, title, description, ageMin, ageMax, points, content,
    mediaUrl, mediaInputMode, uploadedFileName,
    imageUrl, imageInputMode, uploadedImageName,
    audioUrl, audioInputMode, uploadedAudioName,
    videoUrl, videoInputMode, uploadedVideoName,
    timerEnabled, timerMinutes, questions, formError, success } = st;

  // ── Question helpers ────────────────────────────────────────────────
  const addQuestion = () => setSt(p => ({ ...p, questions: [...p.questions, DEFAULT_QUESTION()] }));
  const removeQuestion = (i: number) => setSt(p => ({ ...p, questions: p.questions.filter((_, idx) => idx !== i) }));
  const updateQ = <K extends keyof QuestionDraft>(i: number, key: K, val: QuestionDraft[K]) =>
    setSt(p => ({ ...p, questions: p.questions.map((q, idx) => idx === i ? { ...q, [key]: val } : q) }));
  const updateOption = (qi: number, oi: number, val: string) =>
    setSt(p => ({ ...p, questions: p.questions.map((q, idx) =>
      idx === qi ? { ...q, options: q.options.map((o, j) => j === oi ? val : o) } : q) }));
  const addOption = (qi: number) =>
    setSt(p => ({ ...p, questions: p.questions.map((q, idx) =>
      idx === qi && q.options.length < 6 ? { ...q, options: [...q.options, ""] } : q) }));
  const removeOption = (qi: number, oi: number) =>
    setSt(p => ({ ...p, questions: p.questions.map((q, idx) => {
      if (idx !== qi || q.options.length <= 2) return q;
      const next = q.options.filter((_, j) => j !== oi);
      return { ...q, options: next, correctIndex: q.correctIndex >= next.length ? next.length - 1 : q.correctIndex };
    }) }));

  // ── File upload ─────────────────────────────────────────────────────
  const handleUpload = async (file: File, kind: "audio" | "video" | "image") => {
    setUploading(kind);
    set("formError" as any, "");
    try {
      const token = await AsyncStorage.getItem("auth_token");
      const form = new FormData();
      form.append("file", file);
      const endpoint = kind === "audio" ? "/api/upload/audio" : kind === "video" ? "/api/upload/video" : "/api/upload/image";
      const res = await fetch(`${BASE}${endpoint}`, {
        method: "POST", headers: { Authorization: `Bearer ${token ?? ""}` }, body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Ошибка загрузки");
      if (kind === "audio") setSt(p => ({ ...p, audioUrl: data.url, uploadedAudioName: file.name }));
      else if (kind === "video") setSt(p => ({ ...p, videoUrl: data.url, uploadedVideoName: file.name }));
      else setSt(p => ({ ...p, imageUrl: data.url, uploadedImageName: file.name }));
    } catch (e: any) {
      set("formError" as any, e.message);
    } finally {
      setUploading(null);
    }
  };

  // ── Submit ──────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    set("formError", "");
    if (!title.trim()) { set("formError", "Введите название задания"); return; }
    const ageMinNum = parseInt(ageMin, 10);
    const ageMaxNum = parseInt(ageMax, 10);
    if (isNaN(ageMinNum) || ageMinNum < 1) { set("formError", "Возраст «от» некорректен"); return; }
    if (isNaN(ageMaxNum) || ageMaxNum < 1) { set("formError", "Возраст «до» некорректен"); return; }
    if (ageMinNum > ageMaxNum) { set("formError", "Возраст «от» не может быть больше «до»"); return; }
    if (timerEnabled) {
      const mins = parseInt(timerMinutes, 10);
      if (isNaN(mins) || mins < 1 || mins > 360) { set("formError", "Таймер: введите 1–360 минут"); return; }
    }

    // ── Media validation by type ───────────────────────────────────────
    if (type === "video") {
      const hasVideoUrl = videoUrl.trim() !== "";
      const hasVideoFile = uploadedVideoName !== "";
      if (!hasVideoUrl && !hasVideoFile) {
        set("formError", "Для задания «Видео» необходимо прикрепить видео или ссылку на него");
        return;
      }
      if (hasVideoUrl && hasVideoFile) {
        set("formError", "Нельзя одновременно указать ссылку и загрузить файл — выберите одно");
        return;
      }
    }

    if (type === "audio") {
      const hasAudioUrl = audioUrl.trim() !== "";
      const hasAudioFile = uploadedAudioName !== "";
      if (!hasAudioUrl && !hasAudioFile) {
        set("formError", "Для задания «Аудирование» необходимо прикрепить аудио или ссылку на него");
        return;
      }
      if (hasAudioUrl && hasAudioFile) {
        set("formError", "Нельзя одновременно указать ссылку и загрузить файл — выберите одно");
        return;
      }
    }

    if (type === "reading" && !imageUrl.trim() && !videoUrl.trim() && !content.trim()) {
      set("formError", "Для задания «Чтение» необходимо добавить хотя бы одно: текст, изображение или видео");
      return;
    }

    // ── Question validation — every added question must be fully filled ─
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.text.trim()) {
        set("formError", `Вопрос ${i + 1}: введите текст вопроса`);
        return;
      }
      if (q.format === "open") {
        if (!q.correctAnswer.trim()) {
          set("formError", `Вопрос ${i + 1}: введите правильный ответ`);
          return;
        }
      } else {
        const filledOptions = q.options.filter(o => o.trim());
        if (filledOptions.length < 2) {
          set("formError", `Вопрос ${i + 1}: заполните минимум 2 варианта ответа`);
          return;
        }
        if (!q.options[q.correctIndex]?.trim()) {
          set("formError", `Вопрос ${i + 1}: выберите правильный вариант из заполненных`);
          return;
        }
      }
    }

    const questionPayload = questions
      .filter(q => q.text.trim())
      .map((q, i) => {
        if (q.format === "choice") {
          const filled = q.options.filter(o => o.trim());
          if (filled.length < 2) return null;
          const filledCorrect = q.options[q.correctIndex]?.trim();
          const correctAns = filled.find(o => o.trim() === filledCorrect) ?? filled[0];
          return { text: q.text.trim(), options: filled, correctAnswer: correctAns.trim(), orderIndex: i };
        }
        return { text: q.text.trim(), options: [] as string[], correctAnswer: q.correctAnswer.trim(), orderIndex: i };
      })
      .filter(Boolean);

    // Determine mediaUrl for audio/video types
    const finalMediaUrl = type === "audio" ? (audioUrl.trim() || mediaUrl.trim() || undefined)
      : type === "video" ? (videoUrl.trim() || mediaUrl.trim() || undefined)
      : undefined;
    // For reading: optional supplementary audio/video
    const suppAudio = type === "reading" ? audioUrl.trim() || undefined : undefined;
    const suppVideo = type === "reading" ? videoUrl.trim() || undefined : undefined;
    const finalContent = type === "reading" ? content.trim() || undefined : undefined;

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
          content: finalContent,
          mediaUrl: finalMediaUrl ?? suppAudio ?? suppVideo ?? undefined,
          imageUrl: imageUrl.trim() || undefined,
          questions: questionPayload,
          timeLimitMinutes: timerEnabled ? parseInt(timerMinutes, 10) : null,
        }),
      });
      set("success", true);
      setTimeout(() => router.back(), 900);
    } catch (e: any) {
      set("formError", e?.message ?? "Не удалось создать задание");
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
      ...(Platform.OS === "web" ? { outlineWidth: 0, outlineStyle: "none" } as any : {}),
    },
    textArea: { minHeight: 90, textAlignVertical: "top" },
    row: { flexDirection: "row", gap: 12 },
    half: { flex: 1 },
    timerRow: {
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      backgroundColor: colors.card, borderRadius: 14, padding: 14,
      borderWidth: 1, borderColor: colors.border, marginBottom: 12,
    },
    timerInput: {
      backgroundColor: colors.background, borderWidth: 1.5, borderColor: "#f59e0b",
      borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10,
      fontSize: 18, fontWeight: "800", color: colors.foreground,
      width: 80, textAlign: "center",
      ...(Platform.OS === "web" ? { outlineWidth: 0, outlineStyle: "none" } as any : {}),
    },
    mediaToggle: { flexDirection: "row", gap: 8, marginBottom: 14 },
    mediaBtn: {
      flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
      gap: 5, paddingVertical: 8, borderRadius: 10, borderWidth: 1.5,
    },
    mediaBtnText: { fontSize: 13, fontWeight: "600" },
    uploadArea: {
      flexDirection: "row", alignItems: "center", justifyContent: "center",
      gap: 8, paddingVertical: 16, borderRadius: 12,
      borderWidth: 1.5, borderStyle: "dashed",
    },
    uploadedRow: {
      flexDirection: "row", alignItems: "center", gap: 10,
      backgroundColor: "#f0fdf4", borderWidth: 1, borderColor: "#86efac",
      borderRadius: 12, padding: 12, marginBottom: 8,
    },
    imagePreview: {
      width: "100%", height: 160, borderRadius: 12,
      backgroundColor: colors.muted, marginBottom: 8,
    },
    questionCard: {
      backgroundColor: colors.card, borderRadius: 16, padding: 14,
      borderWidth: 1, borderColor: colors.border, marginBottom: 12,
    },
    questionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
    questionNum: { fontSize: 13, fontWeight: "700", color: colors.primary },
    formatRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
    formatBtn: {
      flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
      gap: 5, paddingVertical: 8, borderRadius: 10, borderWidth: 1.5,
    },
    formatBtnText: { fontSize: 13, fontWeight: "600" },
    optionRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
    optionInput: {
      flex: 1, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border,
      borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9,
      fontSize: 14, color: colors.foreground,
      ...(Platform.OS === "web" ? { outlineWidth: 0, outlineStyle: "none" } as any : {}),
    },
    addOptBtn: {
      flexDirection: "row", alignItems: "center", justifyContent: "center",
      gap: 5, paddingVertical: 8, borderRadius: 10,
      borderWidth: 1.5, borderColor: colors.border, borderStyle: "dashed", marginBottom: 4,
    },
    addQBtn: {
      flexDirection: "row", alignItems: "center", gap: 6, justifyContent: "center",
      paddingVertical: 12, borderRadius: 12, borderWidth: 1.5,
      borderColor: colors.border, borderStyle: "dashed",
    },
    submitBtn: {
      backgroundColor: colors.primary, borderRadius: 14,
      paddingVertical: 16, alignItems: "center", marginTop: 8,
      flexDirection: "row", justifyContent: "center", gap: 8,
    },
    submitText: { fontSize: 16, fontWeight: "700", color: "#fff" },
  });

  // ── Media sub-section helper ────────────────────────────────────────
  const renderMediaSection = (
    kind: "audio" | "video" | "image",
    urlVal: string, setUrl: (v: string) => void,
    modeVal: "url" | "file", setMode: (v: "url" | "file") => void,
    uploadedName: string, clearUploaded: () => void,
    inputRef: React.RefObject<any>,
    accentColor: string,
    iconName: string,
    sectionLabel: string,
    urlPlaceholder: string,
    acceptMime: string,
  ) => (
    <View style={s.section}>
      <Text style={s.sectionTitle}>{sectionLabel}</Text>
      <View style={s.mediaToggle}>
        {(["url", "file"] as const).map(mode => {
          const active = modeVal === mode;
          return (
            <TouchableOpacity key={mode}
              style={[s.mediaBtn, { borderColor: active ? accentColor : colors.border, backgroundColor: active ? accentColor + "12" : colors.background }]}
              onPress={() => setMode(mode)}
            >
              <Feather name={mode === "url" ? "link" : "upload"} size={14} color={active ? accentColor : colors.mutedForeground} />
              <Text style={[s.mediaBtnText, { color: active ? accentColor : colors.mutedForeground }]}>
                {mode === "url" ? "По ссылке" : "Загрузить файл"}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {modeVal === "url" ? (
        <TextInput
          style={s.input} value={urlVal} onChangeText={setUrl}
          placeholder={urlPlaceholder} placeholderTextColor={colors.mutedForeground}
          autoCapitalize="none" keyboardType="url"
        />
      ) : (
        <>
          {uploadedName ? (
            <View style={s.uploadedRow}>
              <Feather name="check-circle" size={16} color={colors.success} />
              <Text style={{ flex: 1, fontSize: 13, color: colors.success, fontWeight: "600" }}>{uploadedName}</Text>
              <TouchableOpacity onPress={clearUploaded}>
                <Feather name="x" size={16} color={colors.success} />
              </TouchableOpacity>
            </View>
          ) : null}

          {/* Image preview */}
          {kind === "image" && urlVal ? (
            <Image source={{ uri: urlVal }} style={s.imagePreview} resizeMode="cover" />
          ) : null}

          {Platform.OS === "web" ? (
            <>
              {/* @ts-ignore */}
              <input type="file" accept={acceptMime} style={{ display: "none" }} ref={inputRef}
                onChange={(e: any) => { const f = e.target.files?.[0]; if (f) handleUpload(f, kind); }} />
              <TouchableOpacity
                style={[s.uploadArea, { borderColor: accentColor, paddingVertical: 18 }]}
                onPress={() => inputRef.current?.click()}
                disabled={uploading === kind}
              >
                {uploading === kind
                  ? <ActivityIndicator size="small" color={accentColor} />
                  : <Feather name={iconName as any} size={20} color={accentColor} />
                }
                <Text style={{ fontSize: 14, fontWeight: "600", color: accentColor }}>
                  {uploading === kind ? "Загрузка…" : `Выбрать файл`}
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            <TextInput
              style={s.input} value={urlVal} onChangeText={setUrl}
              placeholder={urlPlaceholder} placeholderTextColor={colors.mutedForeground}
              autoCapitalize="none" keyboardType="url"
            />
          )}
        </>
      )}
    </View>
  );

  if (success) {
    return (
      <View style={s.container}>
        <View style={s.header}>
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
            <Feather name="arrow-left" size={22} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Создать задание</Text>
        </View>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", gap: 16 }}>
          <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: "#f0fdf4", justifyContent: "center", alignItems: "center", borderWidth: 2, borderColor: "#86efac" }}>
            <Feather name="check" size={36} color="#22c55e" />
          </View>
          <Text style={{ fontSize: 20, fontWeight: "800", color: colors.foreground }}>Задание создано!</Text>
          <Text style={{ fontSize: 14, color: colors.mutedForeground }}>Возвращаемся к заданиям…</Text>
        </View>
      </View>
    );
  }

  if (user && !isTeacherOrAdmin(user.role)) {
    return (
      <View style={[s.container, { justifyContent: "center", alignItems: "center", padding: 32 }]}>
        <Feather name="lock" size={48} color={colors.mutedForeground} />
        <Text style={{ fontSize: 18, fontWeight: "700", color: colors.foreground, marginTop: 16, textAlign: "center" }}>
          Нет доступа
        </Text>
        <Text style={{ fontSize: 14, color: colors.mutedForeground, marginTop: 8, textAlign: "center" }}>
          Создавать задания могут только учителя
        </Text>
        <TouchableOpacity
          style={{ marginTop: 24, backgroundColor: colors.primary, borderRadius: 14, paddingHorizontal: 24, paddingVertical: 12 }}
          onPress={() => router.back()}
        >
          <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>Назад</Text>
        </TouchableOpacity>
      </View>
    );
  }

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
              <TouchableOpacity key={t.key}
                style={[s.typeBtn, type === t.key && s.typeBtnActive]}
                onPress={() => set("type", t.key)}
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
          <TextInput style={s.input} value={title} onChangeText={v => set("title", v)}
            placeholder="Например: Глаголы прошедшего времени" placeholderTextColor={colors.mutedForeground} />
          <Text style={s.label}>Описание</Text>
          <TextInput style={[s.input, s.textArea]} value={description} onChangeText={v => set("description", v)}
            placeholder="Краткое описание задания для ученика" placeholderTextColor={colors.mutedForeground} multiline />
          <View style={s.row}>
            <View style={s.half}>
              <Text style={s.label}>Возраст от</Text>
              <TextInput style={s.input} value={ageMin} onChangeText={v => set("ageMin", v)} keyboardType="numeric" placeholder="5" placeholderTextColor={colors.mutedForeground} />
            </View>
            <View style={s.half}>
              <Text style={s.label}>Возраст до</Text>
              <TextInput style={s.input} value={ageMax} onChangeText={v => set("ageMax", v)} keyboardType="numeric" placeholder="18" placeholderTextColor={colors.mutedForeground} />
            </View>
          </View>
          <Text style={s.label}>Баллы за выполнение</Text>
          <TextInput style={s.input} value={points} onChangeText={v => set("points", v)}
            keyboardType="numeric" placeholder="10" placeholderTextColor={colors.mutedForeground} />
        </View>

        {/* Таймер */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Таймер</Text>
          <View style={s.timerRow}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
              <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: "#f59e0b20", justifyContent: "center", alignItems: "center" }}>
                <Feather name="clock" size={18} color="#f59e0b" />
              </View>
              <View>
                <Text style={{ fontSize: 15, fontWeight: "700", color: colors.foreground }}>Ограничение по времени</Text>
                <Text style={{ fontSize: 12, color: colors.mutedForeground, marginTop: 1 }}>
                  {timerEnabled ? `${timerMinutes} мин — по истечении ответить нельзя` : "Без ограничения"}
                </Text>
              </View>
            </View>
            <Switch value={timerEnabled} onValueChange={v => set("timerEnabled", v)}
              trackColor={{ false: colors.border, true: "#f59e0b" }} thumbColor="#fff" />
          </View>
          {timerEnabled && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10,
              backgroundColor: colors.card, borderRadius: 14, padding: 14,
              borderWidth: 1, borderColor: "#f59e0b40", marginBottom: 12 }}>
              <Feather name="clock" size={16} color="#f59e0b" />
              <Text style={{ fontSize: 14, color: colors.foreground, fontWeight: "600" }}>Время:</Text>
              <TextInput style={s.timerInput} value={timerMinutes}
                onChangeText={v => set("timerMinutes", v.replace(/[^0-9]/g, ""))}
                keyboardType="numeric" maxLength={3} placeholderTextColor={colors.mutedForeground} />
              <Text style={{ fontSize: 14, color: colors.foreground, fontWeight: "600" }}>мин</Text>
              <Text style={{ fontSize: 12, color: colors.mutedForeground, flex: 1 }}>(1–360)</Text>
            </View>
          )}
        </View>

        {/* Изображение — только text_test и reading */}
        {(type === "text_test" || type === "reading") && renderMediaSection(
          "image",
          imageUrl, v => set("imageUrl", v),
          imageInputMode, v => set("imageInputMode", v),
          uploadedImageName, () => setSt(p => ({ ...p, imageUrl: "", uploadedImageName: "" })),
          imageInputRef,
          "#8b5cf6", "image",
          type === "reading" ? "Изображение" : "Изображение (необязательно)",
          "https://example.com/image.jpg",
          "image/*",
        )}

        {/* Аудио — только audio */}
        {type === "audio" && renderMediaSection(
          "audio",
          audioUrl, v => set("audioUrl", v),
          audioInputMode, v => {
            if (v === "url") setSt(p => ({ ...p, audioInputMode: "url", audioUrl: "", uploadedAudioName: "" }));
            else set("audioInputMode", "file");
          },
          uploadedAudioName, () => setSt(p => ({ ...p, audioUrl: "", uploadedAudioName: "" })),
          audioInputRef,
          "#06b6d4", "headphones",
          "Аудио",
          "https://example.com/audio.mp3",
          "audio/*",
        )}

        {/* Видео — только reading и video */}
        {(type === "reading" || type === "video") && renderMediaSection(
          "video",
          videoUrl, v => set("videoUrl", v),
          videoInputMode, v => {
            if (v === "url") setSt(p => ({ ...p, videoInputMode: "url", videoUrl: "", uploadedVideoName: "" }));
            else set("videoInputMode", "file");
          },
          uploadedVideoName, () => setSt(p => ({ ...p, videoUrl: "", uploadedVideoName: "" })),
          videoInputRef,
          "#f59e0b", "video",
          type === "video" ? "Видео" : "Видео (необязательно)",
          "https://youtube.com/watch?v=... или https://example.com/video.mp4",
          "video/*",
        )}

        {/* Текст для чтения — необязательный */}
        {type === "reading" && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Текст для чтения (необязательно)</Text>
            <TextInput
              style={[s.input, s.textArea]}
              value={content} onChangeText={v => set("content", v)}
              placeholder="Вставьте текст для чтения…"
              placeholderTextColor={colors.mutedForeground}
              multiline
            />
          </View>
        )}

        {/* Вопросы */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Вопросы</Text>
          {questions.map((q, qi) => (
            <View key={qi} style={s.questionCard}>
              <View style={s.questionHeader}>
                <Text style={s.questionNum}>Вопрос {qi + 1}</Text>
                {questions.length > 1 && (
                  <TouchableOpacity onPress={() => removeQuestion(qi)}>
                    <Feather name="x" size={18} color={colors.destructive} />
                  </TouchableOpacity>
                )}
              </View>
              <TextInput
                style={[s.input, s.textArea, { minHeight: 60 }]}
                value={q.text} onChangeText={v => updateQ(qi, "text", v)}
                placeholder="Текст вопроса" placeholderTextColor={colors.mutedForeground} multiline
              />
              <View style={s.formatRow}>
                {(["open", "choice"] as QuestionFormat[]).map(fmt => {
                  const active = q.format === fmt;
                  return (
                    <TouchableOpacity key={fmt}
                      style={[s.formatBtn, { borderColor: active ? colors.primary : colors.border, backgroundColor: active ? colors.primary + "12" : colors.background }]}
                      onPress={() => updateQ(qi, "format", fmt)}
                    >
                      <Feather name={fmt === "open" ? "edit-2" : "list"} size={14} color={active ? colors.primary : colors.mutedForeground} />
                      <Text style={[s.formatBtnText, { color: active ? colors.primary : colors.mutedForeground }]}>
                        {fmt === "open" ? "Свободный ответ" : "Варианты ответов"}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {q.format === "open" && (
                <TextInput style={s.input} value={q.correctAnswer}
                  onChangeText={v => updateQ(qi, "correctAnswer", v)}
                  placeholder="Правильный ответ" placeholderTextColor={colors.mutedForeground} />
              )}
              {q.format === "choice" && (
                <View>
                  {q.options.map((opt, oi) => (
                    <View key={oi} style={s.optionRow}>
                      <TouchableOpacity
                        style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, justifyContent: "center", alignItems: "center",
                          borderColor: q.correctIndex === oi ? colors.primary : colors.border,
                          backgroundColor: q.correctIndex === oi ? colors.primary : "transparent" }}
                        onPress={() => updateQ(qi, "correctIndex", oi)}
                      >
                        {q.correctIndex === oi && <Feather name="check" size={13} color="#fff" />}
                      </TouchableOpacity>
                      <TextInput style={s.optionInput} value={opt}
                        onChangeText={v => updateOption(qi, oi, v)}
                        placeholder={`Вариант ${oi + 1}`} placeholderTextColor={colors.mutedForeground} />
                      {q.options.length > 2 && (
                        <TouchableOpacity onPress={() => removeOption(qi, oi)}>
                          <Feather name="x" size={16} color={colors.destructive} />
                        </TouchableOpacity>
                      )}
                    </View>
                  ))}
                  {q.options.length < 6 && (
                    <TouchableOpacity style={s.addOptBtn} onPress={() => addOption(qi)}>
                      <Feather name="plus" size={14} color={colors.mutedForeground} />
                      <Text style={{ fontSize: 13, color: colors.mutedForeground }}>Добавить вариант</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
          ))}
          <TouchableOpacity style={s.addQBtn} onPress={addQuestion}>
            <Feather name="plus" size={16} color={colors.mutedForeground} />
            <Text style={{ fontSize: 14, fontWeight: "600", color: colors.mutedForeground }}>Добавить вопрос</Text>
          </TouchableOpacity>
        </View>

        {!!formError && (
          <View style={{ backgroundColor: "#fef2f2", borderRadius: 12, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: "#fca5a5" }}>
            <Text style={{ color: colors.destructive, fontSize: 14, fontWeight: "600" }}>{formError}</Text>
          </View>
        )}
        <TouchableOpacity style={s.submitBtn} onPress={handleSubmit} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" />
            : <><Feather name="check" size={18} color="#fff" /><Text style={s.submitText}>Создать задание</Text></>
          }
        </TouchableOpacity>

      </ScrollView>
    </View>
  );
}
