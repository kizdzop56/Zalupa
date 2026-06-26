import React, { useState, useEffect, useRef } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Platform, TextInput, Modal, FlatList, ActivityIndicator,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useAuth, isTeacherOrAdmin, LEVEL_META, type AuthUser } from "@/contexts/AuthContext";
import { useRouter } from "expo-router";
import { useGetStudentSubmissions, useGetStudentTimeStats } from "@workspace/api-client-react";
import { ACHIEVEMENTS, getUnlockedAchievements, getLockedAchievements, type AchievementStats } from "@/constants/achievements";

const ROLE_LABELS: Record<string, string> = {
  student: "Ученик", parent: "Родитель", teacher: "Учитель", admin: "Администратор",
};

const AVATAR_EMOJIS = [
  "🦁","🐯","🐻","🐼","🦊","🐸","🦅","🦋","🐬","🦄",
  "🐲","🦝","🦉","🐺","🐮","🐷","🐙","🦀","🐧","🦜",
  "🌟","🚀","⚡","🎯","🎸","🎨","🏆","💎","🔥","🌈",
];
const AVATAR_COLORS = [
  "#6366f1","#8b5cf6","#ec4899","#ef4444",
  "#f59e0b","#10b981","#06b6d4","#3b82f6",
  "#84cc16","#f97316","#64748b","#1e293b",
];

function formatTime(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} мин`;
  if (m === 0) return `${h} ч`;
  return `${h} ч ${m} мин`;
}

// Live in-app timer (counts up from 0 this session)
function useLiveTimer() {
  const [seconds, setSeconds] = useState(0);
  const ref = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    ref.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => { if (ref.current) clearInterval(ref.current); };
  }, []);
  return seconds;
}

// Avatar picker modal
function AvatarPickerModal({
  visible, onClose, currentEmoji, currentColor, onSave,
}: {
  visible: boolean;
  onClose: () => void;
  currentEmoji: string;
  currentColor: string;
  onSave: (emoji: string, color: string) => void;
}) {
  const colors = useColors();
  const [emoji, setEmoji] = useState(currentEmoji);
  const [color, setColor] = useState(currentColor);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: "#00000066", justifyContent: "flex-end" }}>
        <View style={{ backgroundColor: colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 }}>
          <Text style={{ fontSize: 18, fontWeight: "800", color: colors.foreground, marginBottom: 16 }}>
            Выбери аватар
          </Text>

          {/* Preview */}
          <View style={{ alignItems: "center", marginBottom: 20 }}>
            <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: color, justifyContent: "center", alignItems: "center" }}>
              <Text style={{ fontSize: 40 }}>{emoji}</Text>
            </View>
          </View>

          {/* Emoji grid */}
          <Text style={{ fontSize: 13, fontWeight: "700", color: colors.mutedForeground, marginBottom: 8 }}>ЭМОДЗИ</Text>
          <FlatList
            data={AVATAR_EMOJIS}
            numColumns={8}
            keyExtractor={(e) => e}
            style={{ maxHeight: 120, marginBottom: 16 }}
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => setEmoji(item)}
                style={{
                  flex: 1, aspectRatio: 1, justifyContent: "center", alignItems: "center",
                  borderRadius: 10, margin: 2,
                  backgroundColor: item === emoji ? colors.primary + "20" : "transparent",
                  borderWidth: item === emoji ? 2 : 0,
                  borderColor: colors.primary,
                }}
              >
                <Text style={{ fontSize: 24 }}>{item}</Text>
              </TouchableOpacity>
            )}
          />

          {/* Color row */}
          <Text style={{ fontSize: 13, fontWeight: "700", color: colors.mutedForeground, marginBottom: 8 }}>ЦВЕТ ФОНА</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {AVATAR_COLORS.map((c) => (
                <TouchableOpacity
                  key={c}
                  onPress={() => setColor(c)}
                  style={{
                    width: 36, height: 36, borderRadius: 18, backgroundColor: c,
                    borderWidth: c === color ? 3 : 0, borderColor: colors.foreground,
                  }}
                />
              ))}
            </View>
          </ScrollView>

          <TouchableOpacity
            style={{ backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 14, alignItems: "center" }}
            onPress={() => { onSave(emoji, color); onClose(); }}
          >
            <Text style={{ fontSize: 16, fontWeight: "700", color: "#fff" }}>Сохранить</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onClose} style={{ paddingVertical: 12, alignItems: "center" }}>
            <Text style={{ fontSize: 15, color: colors.mutedForeground }}>Отмена</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

export default function ProfileScreen() {
  const colors = useColors();
  const { user, logout } = useAuth();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const sessionSeconds = useLiveTimer();

  const [avatarEmoji, setAvatarEmoji] = useState(user?.avatarEmoji ?? "🦁");
  const [avatarColor, setAvatarColor] = useState(user?.avatarColor ?? "#6366f1");
  const [bio, setBio] = useState(user?.bio ?? "");
  const [editingBio, setEditingBio] = useState(false);
  const [bioInput, setBioInput] = useState(user?.bio ?? "");
  const [avatarPickerOpen, setAvatarPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const isStudent = user?.role === "student";
  const isTeacher = isTeacherOrAdmin(user?.role ?? "");

  const { data: submissions } = useGetStudentSubmissions(
    user?.id || 0,
    { query: { enabled: isStudent && !!user?.id } as any }
  );
  const { data: timeStats } = useGetStudentTimeStats(
    user?.id || 0,
    { query: { enabled: isStudent && !!user?.id } as any }
  );

  const completedCount = submissions?.length ?? 0;
  const totalMinutes = (timeStats?.totalMinutes ?? 0) + Math.floor(sessionSeconds / 60);
  const levelMeta = user?.knowledgeLevel ? LEVEL_META[user.knowledgeLevel] : null;

  const achievementStats: AchievementStats = {
    completedAssignments: completedCount,
    totalPoints: user?.totalPoints ?? 0,
    knowledgeLevel: user?.knowledgeLevel ?? null,
    totalTimeMinutes: totalMinutes,
  };
  const unlocked = getUnlockedAchievements(achievementStats);
  const locked = getLockedAchievements(achievementStats);

  const baseUrl = process.env["EXPO_PUBLIC_DOMAIN"]
    ? `https://${process.env["EXPO_PUBLIC_DOMAIN"]}`
    : "";

  const saveProfile = async (patch: { avatarEmoji?: string; avatarColor?: string; bio?: string }) => {
    if (!user) return;
    setSaving(true);
    try {
      const token = await import("@react-native-async-storage/async-storage")
        .then((m) => m.default.getItem("auth_token"));
      await fetch(`${baseUrl}/api/users/${user.id}/profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(patch),
      });
    } catch { /* silent */ } finally {
      setSaving(false);
    }
  };

  const handleAvatarSave = (emoji: string, color: string) => {
    setAvatarEmoji(emoji);
    setAvatarColor(color);
    saveProfile({ avatarEmoji: emoji, avatarColor: color });
  };

  const handleBioSave = () => {
    setBio(bioInput);
    setEditingBio(false);
    saveProfile({ bio: bioInput });
  };

  if (!user) return null;

  const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    scroll: { paddingBottom: insets.bottom + 100 },

    // Header
    header: {
      paddingTop: insets.top + (Platform.OS === "web" ? 67 : 16),
      paddingHorizontal: 20, paddingBottom: 24,
      alignItems: "center",
    },
    avatarWrap: { position: "relative", marginBottom: 14 },
    avatar: { width: 90, height: 90, borderRadius: 45, justifyContent: "center", alignItems: "center" },
    avatarEmoji: { fontSize: 44 },
    editAvatarBtn: {
      position: "absolute", bottom: 0, right: 0,
      width: 28, height: 28, borderRadius: 14,
      backgroundColor: colors.primary, justifyContent: "center", alignItems: "center",
      borderWidth: 2, borderColor: colors.background,
    },
    name: { fontSize: 22, fontWeight: "800", color: colors.foreground, marginBottom: 3 },
    username: { fontSize: 14, color: colors.mutedForeground, marginBottom: 10 },
    badgeRow: { flexDirection: "row", gap: 8, flexWrap: "wrap", justifyContent: "center", marginBottom: 12 },
    badge: { paddingHorizontal: 14, paddingVertical: 5, borderRadius: 20, flexDirection: "row", alignItems: "center", gap: 4 },
    badgeText: { fontSize: 13, fontWeight: "700" },

    // Bio
    bioBox: {
      backgroundColor: colors.card, borderRadius: 14, padding: 14,
      borderWidth: 1, borderColor: colors.border, marginHorizontal: 20, marginBottom: 20,
    },
    bioLabel: { fontSize: 12, fontWeight: "700", color: colors.mutedForeground, marginBottom: 4, textTransform: "uppercase" },
    bioText: { fontSize: 14, color: colors.foreground, lineHeight: 20 },
    bioPlaceholder: { fontSize: 14, color: colors.mutedForeground, fontStyle: "italic" },
    bioInput: { fontSize: 14, color: colors.foreground, lineHeight: 20, minHeight: 60 },
    bioActions: { flexDirection: "row", gap: 8, marginTop: 8, justifyContent: "flex-end" },
    bioSaveBtn: { backgroundColor: colors.primary, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 6 },
    bioSaveText: { fontSize: 13, fontWeight: "700", color: "#fff" },
    bioCancelBtn: { paddingHorizontal: 14, paddingVertical: 6 },
    bioCancelText: { fontSize: 13, color: colors.mutedForeground },

    // Section
    section: { paddingHorizontal: 20, marginBottom: 20 },
    sectionTitle: {
      fontSize: 12, fontWeight: "700", color: colors.mutedForeground,
      marginBottom: 12, textTransform: "uppercase", letterSpacing: 0.6,
    },

    // Stats
    statsRow: { flexDirection: "row", gap: 10 },
    statCard: {
      flex: 1, backgroundColor: colors.card, borderRadius: 14, padding: 14,
      alignItems: "center", borderWidth: 1, borderColor: colors.border,
    },
    statValue: { fontSize: 22, fontWeight: "900", color: colors.foreground, marginTop: 6, marginBottom: 2 },
    statLabel: { fontSize: 11, color: colors.mutedForeground, textAlign: "center" },

    // Timer
    timerCard: {
      backgroundColor: colors.primary + "12", borderRadius: 16, padding: 16,
      borderWidth: 1.5, borderColor: colors.primary + "35",
      flexDirection: "row", alignItems: "center", gap: 14,
    },
    timerIcon: { width: 50, height: 50, borderRadius: 14, backgroundColor: colors.primary + "20", justifyContent: "center", alignItems: "center" },
    timerValue: { fontSize: 22, fontWeight: "900", color: colors.primary },
    timerLabel: { fontSize: 13, color: colors.mutedForeground, marginTop: 2 },

    // Level card
    levelCard: {
      borderRadius: 16, padding: 16,
      flexDirection: "row", alignItems: "center", gap: 14, borderWidth: 1.5,
    },
    levelIcon: { width: 50, height: 50, borderRadius: 14, justifyContent: "center", alignItems: "center" },
    levelTitle: { fontSize: 16, fontWeight: "800" },
    levelSub: { fontSize: 13, marginTop: 1 },
    levelAge: { fontSize: 12, fontWeight: "600", marginTop: 3 },

    // Achievements
    achieveGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
    achieveCard: {
      borderRadius: 14, padding: 12, borderWidth: 1.5,
      width: "47%", alignItems: "flex-start",
    },
    achieveEmoji: { fontSize: 28, marginBottom: 6 },
    achieveTitle: { fontSize: 13, fontWeight: "700" },
    achieveDesc: { fontSize: 11, marginTop: 2, lineHeight: 15 },

    // Quick actions
    row: {
      flexDirection: "row", alignItems: "center", gap: 14,
      backgroundColor: colors.card, borderRadius: 14, padding: 16,
      marginBottom: 8, borderWidth: 1, borderColor: colors.border,
    },
    rowText: { flex: 1, fontSize: 15, fontWeight: "600", color: colors.foreground },

    logoutBtn: {
      marginHorizontal: 20, marginBottom: 8,
      backgroundColor: "#fef2f2", borderRadius: 14,
      padding: 16, alignItems: "center",
      borderWidth: 1, borderColor: "#fecaca",
    },
    logoutText: { fontSize: 15, fontWeight: "700", color: colors.destructive },
  });

  return (
    <View style={s.container}>
      <AvatarPickerModal
        visible={avatarPickerOpen}
        onClose={() => setAvatarPickerOpen(false)}
        currentEmoji={avatarEmoji}
        currentColor={avatarColor}
        onSave={handleAvatarSave}
      />

      <ScrollView contentContainerStyle={s.scroll}>
        {/* ── Шапка профиля ── */}
        <View style={s.header}>
          <View style={s.avatarWrap}>
            <View style={[s.avatar, { backgroundColor: avatarColor }]}>
              <Text style={s.avatarEmoji}>{avatarEmoji}</Text>
            </View>
            <TouchableOpacity style={s.editAvatarBtn} onPress={() => setAvatarPickerOpen(true)}>
              <Feather name="edit-2" size={13} color="#fff" />
            </TouchableOpacity>
          </View>

          <Text style={s.name}>{user.name}</Text>
          <Text style={s.username}>@{user.username}</Text>

          <View style={s.badgeRow}>
            {/* Роль */}
            <View style={[s.badge, { backgroundColor: avatarColor + "20" }]}>
              <Text style={[s.badgeText, { color: avatarColor }]}>{ROLE_LABELS[user.role]}</Text>
            </View>
            {/* Уровень (только ученик) */}
            {levelMeta && (
              <View style={[s.badge, { backgroundColor: levelMeta.color + "18" }]}>
                <Feather name="zap" size={12} color={levelMeta.color} />
                <Text style={[s.badgeText, { color: levelMeta.color }]}>{levelMeta.labelRu}</Text>
              </View>
            )}
          </View>
        </View>

        {/* ── Описание (bio) ── */}
        <View style={s.bioBox}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
            <Text style={s.bioLabel}>О себе</Text>
            {!editingBio && (
              <TouchableOpacity onPress={() => { setBioInput(bio); setEditingBio(true); }}>
                <Feather name="edit-2" size={14} color={colors.primary} />
              </TouchableOpacity>
            )}
          </View>

          {editingBio ? (
            <>
              <TextInput
                style={s.bioInput}
                value={bioInput}
                onChangeText={setBioInput}
                placeholder="Расскажи о себе..."
                placeholderTextColor={colors.mutedForeground}
                multiline
                autoFocus
              />
              <View style={s.bioActions}>
                <TouchableOpacity style={s.bioCancelBtn} onPress={() => setEditingBio(false)}>
                  <Text style={s.bioCancelText}>Отмена</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.bioSaveBtn} onPress={handleBioSave}>
                  <Text style={s.bioSaveText}>Сохранить</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <Text style={bio ? s.bioText : s.bioPlaceholder}>
              {bio || "Нажми на карандаш, чтобы добавить описание"}
            </Text>
          )}
        </View>

        {/* ── Ученик: статистика + таймер + уровень ── */}
        {isStudent && (
          <>
            {/* Статистика */}
            <View style={s.section}>
              <Text style={s.sectionTitle}>Мои достижения</Text>
              <View style={s.statsRow}>
                <View style={s.statCard}>
                  <Feather name="star" size={22} color="#f59e0b" />
                  <Text style={s.statValue}>{user.totalPoints}</Text>
                  <Text style={s.statLabel}>Очки</Text>
                </View>
                <View style={s.statCard}>
                  <Feather name="check-circle" size={22} color="#10b981" />
                  <Text style={s.statValue}>{completedCount}</Text>
                  <Text style={s.statLabel}>Заданий</Text>
                </View>
                <View style={s.statCard}>
                  <Feather name="award" size={22} color={colors.primary} />
                  <Text style={s.statValue}>{unlocked.length}</Text>
                  <Text style={s.statLabel}>Наград</Text>
                </View>
              </View>
            </View>

            {/* Таймер времени */}
            <View style={s.section}>
              <Text style={s.sectionTitle}>Время в приложении</Text>
              <View style={s.timerCard}>
                <View style={s.timerIcon}>
                  <Feather name="clock" size={24} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.timerValue}>{formatTime(totalMinutes)}</Text>
                  <Text style={s.timerLabel}>
                    Сегодня: {formatTime(Math.floor(sessionSeconds / 60))} в этой сессии
                  </Text>
                </View>
              </View>
            </View>

            {/* Уровень */}
            {levelMeta && (
              <View style={s.section}>
                <Text style={s.sectionTitle}>Мой уровень</Text>
                <View style={[s.levelCard, {
                  backgroundColor: levelMeta.color + "10",
                  borderColor: levelMeta.color + "40",
                }]}>
                  <View style={[s.levelIcon, { backgroundColor: levelMeta.color + "20" }]}>
                    <Feather name="zap" size={24} color={levelMeta.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.levelTitle, { color: levelMeta.color }]}>{levelMeta.labelRu}</Text>
                    <Text style={[s.levelSub, { color: colors.mutedForeground }]}>{levelMeta.label}</Text>
                    <Text style={[s.levelAge, { color: levelMeta.color }]}>{levelMeta.ageRange}</Text>
                  </View>
                  <Feather name="check-circle" size={22} color={levelMeta.color} />
                </View>
              </View>
            )}

            {/* ── Витрина наград ── */}
            <View style={s.section}>
              <Text style={s.sectionTitle}>
                Витрина наград · {unlocked.length}/{ACHIEVEMENTS.length}
              </Text>

              {/* Разблокированные */}
              {unlocked.length > 0 && (
                <View style={s.achieveGrid}>
                  {unlocked.map((a) => (
                    <View
                      key={a.id}
                      style={[s.achieveCard, { backgroundColor: a.bgColor, borderColor: a.color + "40" }]}
                    >
                      <Text style={s.achieveEmoji}>{a.emoji}</Text>
                      <Text style={[s.achieveTitle, { color: a.color }]}>{a.title}</Text>
                      <Text style={[s.achieveDesc, { color: a.color + "bb" }]}>{a.description}</Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Заблокированные (серые) */}
              {locked.length > 0 && (
                <>
                  <Text style={[s.sectionTitle, { marginTop: 14, marginBottom: 10 }]}>
                    Ещё не получены
                  </Text>
                  <View style={s.achieveGrid}>
                    {locked.map((a) => (
                      <View
                        key={a.id}
                        style={[s.achieveCard, { backgroundColor: colors.muted, borderColor: colors.border }]}
                      >
                        <Text style={[s.achieveEmoji, { opacity: 0.3 }]}>{a.emoji}</Text>
                        <Text style={[s.achieveTitle, { color: colors.mutedForeground }]}>{a.title}</Text>
                        <Text style={[s.achieveDesc, { color: colors.mutedForeground }]}>{a.description}</Text>
                      </View>
                    ))}
                  </View>
                </>
              )}
            </View>
          </>
        )}

        {/* ── Быстрые действия ── */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Действия</Text>

          {isTeacherOrAdmin(user.role) && (
            <TouchableOpacity style={s.row} onPress={() => router.push("/(main)/create-assignment" as any)}>
              <Feather name="plus-circle" size={20} color={colors.primary} />
              <Text style={s.rowText}>Создать задание</Text>
              <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
            </TouchableOpacity>
          )}

          {(isTeacherOrAdmin(user.role) || user.role === "parent") && (
            <TouchableOpacity style={s.row} onPress={() => router.push("/(main)/students" as any)}>
              <Feather name="users" size={20} color={colors.primary} />
              <Text style={s.rowText}>{user.role === "parent" ? "Мои дети" : "Все ученики"}</Text>
              <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
            </TouchableOpacity>
          )}

          {isStudent && (
            <>
              <TouchableOpacity style={s.row} onPress={() => router.push("/(main)/history" as any)}>
                <Feather name="clock" size={20} color={colors.primary} />
                <Text style={s.rowText}>История заданий</Text>
                <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
              </TouchableOpacity>
              <TouchableOpacity style={s.row} onPress={() => router.push("/(main)/leaderboard" as any)}>
                <Feather name="award" size={20} color={colors.primary} />
                <Text style={s.rowText}>Рейтинг</Text>
                <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
              </TouchableOpacity>
            </>
          )}
        </View>

        <TouchableOpacity style={s.logoutBtn} onPress={logout}>
          <Text style={s.logoutText}>Выйти из аккаунта</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}
