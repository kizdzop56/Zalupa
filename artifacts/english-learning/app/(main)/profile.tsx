import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Platform, TextInput, Modal, FlatList, ActivityIndicator,
  Clipboard,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useAuth, isTeacherOrAdmin, LEVEL_META, type AuthUser } from "@/contexts/AuthContext";
import { useRouter } from "expo-router";
import { useGetStudentSubmissions, useGetStudentTimeStats } from "@workspace/api-client-react";
import { ACHIEVEMENTS, getUnlockedAchievements, getLockedAchievements, type AchievementStats } from "@/constants/achievements";
import AsyncStorage from "@react-native-async-storage/async-storage";

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

// ── API helper ───────────────────────────────────────────────────────
const BASE = process.env["EXPO_PUBLIC_DOMAIN"]
  ? `https://${process.env["EXPO_PUBLIC_DOMAIN"]}`
  : "";

async function apiFetch(path: string, opts?: RequestInit) {
  const token = await AsyncStorage.getItem("auth_token");
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(opts?.headers ?? {}) },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Ошибка сервера");
  return data;
}

type FriendRow = {
  friendshipId: number;
  user: { id: number; name: string; username: string; avatarEmoji: string | null; avatarColor: string | null; totalPoints: number };
  status: "pending" | "accepted";
  direction: "sent" | "received";
};

// ── Friends modal ─────────────────────────────────────────────────────
function FriendsModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const colors = useColors();
  const [tab, setTab] = useState<"list" | "add">("list");
  const [friends, setFriends] = useState<FriendRow[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [code, setCode] = useState("");
  const [found, setFound] = useState<any>(null);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState("");
  const [codeCopied, setCodeCopied] = useState(false);

  const loadFriends = useCallback(async () => {
    setLoadingList(true);
    try { setFriends(await apiFetch("/api/connections/friends")); }
    catch { /* ignore */ }
    finally { setLoadingList(false); }
  }, []);

  useEffect(() => { if (visible) loadFriends(); }, [visible, loadFriends]);

  const searchByCode = async () => {
    const c = code.trim().toUpperCase();
    if (c.length < 6) { setAddError("Введите 6-символьный код"); return; }
    setAdding(true); setAddError(""); setFound(null);
    try {
      const data = await apiFetch(`/api/connections/by-code/${c}`);
      if (data.role !== "student") { setAddError("Этот пользователь не является учеником"); return; }
      setFound(data);
    } catch (e: any) { setAddError(e.message); }
    finally { setAdding(false); }
  };

  const sendRequest = async () => {
    if (!found) return;
    setAdding(true); setAddError("");
    try {
      await apiFetch("/api/connections/friends/request", { method: "POST", body: JSON.stringify({ code: code.trim().toUpperCase() }) });
      await loadFriends();
      setTab("list"); setCode(""); setFound(null);
    } catch (e: any) { setAddError(e.message); }
    finally { setAdding(false); }
  };

  const acceptRequest = async (id: number) => {
    await apiFetch(`/api/connections/friends/${id}/accept`, { method: "PATCH" });
    await loadFriends();
  };

  const removeOrDecline = async (id: number) => {
    await apiFetch(`/api/connections/friends/${id}`, { method: "DELETE" });
    setFriends((prev) => prev.filter((f) => f.friendshipId !== id));
  };

  const accepted = friends.filter((f) => f.status === "accepted");
  const pending = friends.filter((f) => f.status === "pending");

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: "#00000066", justifyContent: "flex-end" }}>
        <View style={{ backgroundColor: colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: "85%" }}>
          {/* Header */}
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <Text style={{ fontSize: 20, fontWeight: "800", color: colors.foreground }}>Друзья</Text>
            <TouchableOpacity onPress={onClose}><Feather name="x" size={22} color={colors.mutedForeground} /></TouchableOpacity>
          </View>

          {/* Tab switcher */}
          <View style={{ flexDirection: "row", gap: 8, marginBottom: 20 }}>
            {(["list", "add"] as const).map((t) => (
              <TouchableOpacity
                key={t}
                onPress={() => setTab(t)}
                style={{
                  flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: "center",
                  backgroundColor: tab === t ? colors.primary : colors.card,
                  borderWidth: 1, borderColor: tab === t ? colors.primary : colors.border,
                }}
              >
                <Text style={{ fontSize: 14, fontWeight: "700", color: tab === t ? "#fff" : colors.foreground }}>
                  {t === "list" ? `Мои друзья (${accepted.length})` : "Добавить"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {tab === "list" ? (
            <ScrollView style={{ maxHeight: 400 }}>
              {loadingList ? (
                <ActivityIndicator color={colors.primary} style={{ marginTop: 30 }} />
              ) : (
                <>
                  {/* Incoming requests */}
                  {pending.filter((f) => f.direction === "received").map((f) => (
                    <View key={f.friendshipId} style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 10, backgroundColor: "#fef3c7", borderRadius: 14, padding: 12 }}>
                      <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: f.user.avatarColor ?? "#6366f1", justifyContent: "center", alignItems: "center" }}>
                        <Text style={{ fontSize: 20 }}>{f.user.avatarEmoji ?? "🦁"}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 14, fontWeight: "700", color: "#92400e" }}>{f.user.name}</Text>
                        <Text style={{ fontSize: 12, color: "#92400e99" }}>Хочет дружить</Text>
                      </View>
                      <TouchableOpacity onPress={() => acceptRequest(f.friendshipId)} style={{ backgroundColor: "#10b981", borderRadius: 8, padding: 6 }}>
                        <Feather name="check" size={16} color="#fff" />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => removeOrDecline(f.friendshipId)} style={{ backgroundColor: "#ef4444", borderRadius: 8, padding: 6 }}>
                        <Feather name="x" size={16} color="#fff" />
                      </TouchableOpacity>
                    </View>
                  ))}

                  {/* Accepted friends */}
                  {accepted.map((f) => (
                    <View key={f.friendshipId} style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 10, backgroundColor: colors.card, borderRadius: 14, padding: 12, borderWidth: 1, borderColor: colors.border }}>
                      <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: f.user.avatarColor ?? "#6366f1", justifyContent: "center", alignItems: "center" }}>
                        <Text style={{ fontSize: 20 }}>{f.user.avatarEmoji ?? "🦁"}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 14, fontWeight: "700", color: colors.foreground }}>{f.user.name}</Text>
                        <Text style={{ fontSize: 12, color: colors.mutedForeground }}>⭐ {f.user.totalPoints} очков</Text>
                      </View>
                      <TouchableOpacity onPress={() => removeOrDecline(f.friendshipId)}>
                        <Feather name="user-x" size={18} color={colors.mutedForeground} />
                      </TouchableOpacity>
                    </View>
                  ))}

                  {/* Pending sent */}
                  {pending.filter((f) => f.direction === "sent").map((f) => (
                    <View key={f.friendshipId} style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 10, backgroundColor: colors.card, borderRadius: 14, padding: 12, borderWidth: 1, borderColor: colors.border, opacity: 0.6 }}>
                      <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: f.user.avatarColor ?? "#6366f1", justifyContent: "center", alignItems: "center" }}>
                        <Text style={{ fontSize: 20 }}>{f.user.avatarEmoji ?? "🦁"}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 14, fontWeight: "700", color: colors.foreground }}>{f.user.name}</Text>
                        <Text style={{ fontSize: 12, color: colors.mutedForeground }}>Запрос отправлен...</Text>
                      </View>
                    </View>
                  ))}

                  {friends.length === 0 && (
                    <View style={{ alignItems: "center", paddingVertical: 40, gap: 10 }}>
                      <Text style={{ fontSize: 40 }}>👫</Text>
                      <Text style={{ fontSize: 16, fontWeight: "700", color: colors.foreground }}>Нет друзей</Text>
                      <Text style={{ fontSize: 13, color: colors.mutedForeground }}>Поделись кодом или введи код друга</Text>
                    </View>
                  )}
                </>
              )}
            </ScrollView>
          ) : (
            <View>
              <Text style={{ fontSize: 14, color: colors.mutedForeground, marginBottom: 12 }}>
                Попроси друга открыть Профиль и назвать свой код
              </Text>
              <View style={{ flexDirection: "row", gap: 10, marginBottom: 12 }}>
                <TextInput
                  style={{
                    flex: 1, backgroundColor: colors.card, borderRadius: 12,
                    borderWidth: 1.5, borderColor: found ? "#10b981" : colors.border,
                    paddingHorizontal: 16, paddingVertical: 14,
                    fontSize: 20, fontWeight: "800", letterSpacing: 4,
                    color: colors.foreground, textAlign: "center", textTransform: "uppercase",
                  }}
                  placeholder="A3X9K2"
                  placeholderTextColor={colors.mutedForeground}
                  value={code}
                  onChangeText={(t) => { setCode(t.toUpperCase()); setFound(null); setAddError(""); }}
                  maxLength={6} autoCapitalize="characters" autoCorrect={false}
                />
                <TouchableOpacity
                  style={{ backgroundColor: colors.primary, borderRadius: 12, paddingHorizontal: 18, justifyContent: "center" }}
                  onPress={searchByCode} disabled={adding}
                >
                  {adding ? <ActivityIndicator color="#fff" size="small" /> : <Feather name="search" size={20} color="#fff" />}
                </TouchableOpacity>
              </View>

              {!!addError && <Text style={{ color: colors.destructive, fontSize: 13, marginBottom: 10 }}>{addError}</Text>}

              {found && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#f0fdf4", borderRadius: 14, padding: 14, marginBottom: 14, borderWidth: 1.5, borderColor: "#10b98150" }}>
                  <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: found.avatarColor ?? "#6366f1", justifyContent: "center", alignItems: "center" }}>
                    <Text style={{ fontSize: 24 }}>{found.avatarEmoji ?? "🦁"}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 16, fontWeight: "800", color: "#065f46" }}>{found.name}</Text>
                    <Text style={{ fontSize: 13, color: "#065f46aa" }}>@{found.username}</Text>
                  </View>
                  <Feather name="check-circle" size={24} color="#10b981" />
                </View>
              )}

              {found && (
                <TouchableOpacity
                  style={{ backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 14, alignItems: "center" }}
                  onPress={sendRequest} disabled={adding}
                >
                  {adding ? <ActivityIndicator color="#fff" /> : <Text style={{ fontSize: 16, fontWeight: "700", color: "#fff" }}>Отправить запрос</Text>}
                </TouchableOpacity>
              )}
            </View>
          )}
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
  const [friendsOpen, setFriendsOpen] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
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
      {isStudent && (
        <FriendsModal visible={friendsOpen} onClose={() => setFriendsOpen(false)} />
      )}

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

        {/* ── Уникальный код приглашения ── */}
        {user.inviteCode && (
          <View style={{
            marginHorizontal: 20, marginBottom: 14,
            backgroundColor: colors.primary + "10", borderRadius: 16, padding: 16,
            borderWidth: 1.5, borderColor: colors.primary + "30",
            flexDirection: "row", alignItems: "center", gap: 14,
          }}>
            <View style={{
              width: 44, height: 44, borderRadius: 12,
              backgroundColor: colors.primary + "20",
              justifyContent: "center", alignItems: "center",
            }}>
              <Feather name="key" size={20} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 11, fontWeight: "700", color: colors.primary, textTransform: "uppercase", letterSpacing: 0.5 }}>
                Мой код
              </Text>
              <Text style={{ fontSize: 22, fontWeight: "900", color: colors.primary, letterSpacing: 4 }}>
                {user.inviteCode}
              </Text>
              <Text style={{ fontSize: 11, color: colors.mutedForeground, marginTop: 1 }}>
                {isStudent
                  ? "Поделись с учителем, родителем или другом"
                  : "Поделись с учениками или детьми"}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => {
                Clipboard.setString(user.inviteCode ?? "");
                setCodeCopied(true);
                setTimeout(() => setCodeCopied(false), 2000);
              }}
              style={{
                backgroundColor: codeCopied ? "#10b981" : colors.primary,
                borderRadius: 10, padding: 10,
              }}
            >
              <Feather name={codeCopied ? "check" : "copy"} size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        )}

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

            {/* ── Друзья ── */}
            <View style={s.section}>
              <Text style={s.sectionTitle}>Друзья</Text>
              <TouchableOpacity
                style={{
                  backgroundColor: colors.card, borderRadius: 16, padding: 16,
                  borderWidth: 1, borderColor: colors.border,
                  flexDirection: "row", alignItems: "center", gap: 14,
                }}
                onPress={() => setFriendsOpen(true)}
              >
                <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: "#ec489918", justifyContent: "center", alignItems: "center" }}>
                  <Feather name="users" size={20} color="#ec4899" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: "700", color: colors.foreground }}>Мои друзья</Text>
                  <Text style={{ fontSize: 12, color: colors.mutedForeground }}>Добавляй друзей по коду</Text>
                </View>
                <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
              </TouchableOpacity>
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
