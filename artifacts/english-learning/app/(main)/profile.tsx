import React from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useAuth, isTeacherOrAdmin, LEVEL_META } from "@/contexts/AuthContext";
import { useRouter } from "expo-router";

const ROLE_LABELS: Record<string, string> = {
  student: "Ученик",
  parent: "Родитель",
  teacher: "Учитель",
  admin: "Администратор",
};

const ROLE_COLORS: Record<string, string> = {
  student: "#6366f1",
  parent: "#0ea5e9",
  teacher: "#f59e0b",
  admin: "#f59e0b",
};

const ROLE_ICONS: Record<string, string> = {
  student: "book-open",
  parent: "users",
  teacher: "award",
  admin: "shield",
};

export default function ProfileScreen() {
  const colors = useColors();
  const { user, logout } = useAuth();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  if (!user) return null;

  const roleColor = ROLE_COLORS[user.role] || colors.primary;
  const levelMeta = user.knowledgeLevel ? LEVEL_META[user.knowledgeLevel] : null;

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    scroll: { paddingBottom: insets.bottom + 90 },
    header: {
      paddingTop: insets.top + (Platform.OS === "web" ? 67 : 16),
      paddingHorizontal: 20, paddingBottom: 24,
      alignItems: "center",
    },
    avatar: {
      width: 84, height: 84, borderRadius: 42,
      backgroundColor: roleColor + "20",
      justifyContent: "center", alignItems: "center", marginBottom: 14,
    },
    name: { fontSize: 22, fontWeight: "800", color: colors.foreground, marginBottom: 3 },
    username: { fontSize: 14, color: colors.mutedForeground, marginBottom: 10 },
    badgeRow: { flexDirection: "row", gap: 8, flexWrap: "wrap", justifyContent: "center" },
    roleBadge: { paddingHorizontal: 14, paddingVertical: 5, borderRadius: 20 },
    roleText: { fontSize: 13, fontWeight: "700" },
    levelBadge: { paddingHorizontal: 14, paddingVertical: 5, borderRadius: 20, flexDirection: "row", alignItems: "center", gap: 5 },
    levelText: { fontSize: 13, fontWeight: "700" },

    section: { paddingHorizontal: 20, marginBottom: 20 },
    sectionTitle: {
      fontSize: 12, fontWeight: "700", color: colors.mutedForeground,
      marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.6,
    },

    // Stats
    statsRow: { flexDirection: "row", gap: 10 },
    statCard: {
      flex: 1, backgroundColor: colors.card, borderRadius: 14, padding: 14,
      alignItems: "center", borderWidth: 1, borderColor: colors.border,
    },
    statValue: { fontSize: 24, fontWeight: "900", color: colors.foreground, marginTop: 6, marginBottom: 2 },
    statLabel: { fontSize: 12, color: colors.mutedForeground, textAlign: "center" },

    // Level card (students only)
    levelCard: {
      borderRadius: 16, padding: 16,
      flexDirection: "row", alignItems: "center", gap: 14,
      borderWidth: 1.5,
    },
    levelIcon: { width: 50, height: 50, borderRadius: 14, justifyContent: "center", alignItems: "center" },
    levelTitle: { fontSize: 16, fontWeight: "800" },
    levelSub: { fontSize: 13, marginTop: 2 },
    levelAge: { fontSize: 12, fontWeight: "600", marginTop: 4 },

    // Actions
    row: {
      flexDirection: "row", alignItems: "center", gap: 14,
      backgroundColor: colors.card, borderRadius: 14, padding: 16,
      marginBottom: 8, borderWidth: 1, borderColor: colors.border,
    },
    rowText: { flex: 1, fontSize: 15, fontWeight: "600", color: colors.foreground },

    logoutBtn: {
      marginHorizontal: 20, marginTop: 4, marginBottom: 8,
      backgroundColor: "#fef2f2", borderRadius: 14,
      padding: 16, alignItems: "center",
      borderWidth: 1, borderColor: "#fecaca",
    },
    logoutText: { fontSize: 15, fontWeight: "700", color: colors.destructive },
  });

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.avatar}>
            <Feather name={ROLE_ICONS[user.role] as any} size={38} color={roleColor} />
          </View>
          <Text style={styles.name}>{user.name}</Text>
          <Text style={styles.username}>@{user.username}</Text>
          <View style={styles.badgeRow}>
            <View style={[styles.roleBadge, { backgroundColor: roleColor + "18" }]}>
              <Text style={[styles.roleText, { color: roleColor }]}>{ROLE_LABELS[user.role]}</Text>
            </View>
            {levelMeta && (
              <View style={[styles.levelBadge, { backgroundColor: levelMeta.color + "18" }]}>
                <Feather name="zap" size={12} color={levelMeta.color} />
                <Text style={[styles.levelText, { color: levelMeta.color }]}>{levelMeta.labelRu}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Student: points + level card */}
        {user.role === "student" && (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Мой прогресс</Text>
              <View style={styles.statsRow}>
                <View style={styles.statCard}>
                  <Feather name="star" size={22} color="#f59e0b" />
                  <Text style={styles.statValue}>{user.totalPoints}</Text>
                  <Text style={styles.statLabel}>Очки</Text>
                </View>
                <View style={styles.statCard}>
                  <Feather name="calendar" size={22} color={colors.primary} />
                  <Text style={styles.statValue}>{user.age ?? "—"}</Text>
                  <Text style={styles.statLabel}>Лет</Text>
                </View>
              </View>
            </View>

            {levelMeta && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Мой уровень</Text>
                <View style={[styles.levelCard, {
                  backgroundColor: levelMeta.color + "10",
                  borderColor: levelMeta.color + "40",
                }]}>
                  <View style={[styles.levelIcon, { backgroundColor: levelMeta.color + "20" }]}>
                    <Feather name="zap" size={24} color={levelMeta.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.levelTitle, { color: levelMeta.color }]}>{levelMeta.labelRu}</Text>
                    <Text style={[styles.levelSub, { color: colors.mutedForeground }]}>{levelMeta.label}</Text>
                    <Text style={[styles.levelAge, { color: levelMeta.color }]}>{levelMeta.ageRange}</Text>
                  </View>
                  <Feather name="check-circle" size={22} color={levelMeta.color} />
                </View>
              </View>
            )}
          </>
        )}

        {/* Quick actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Быстрые действия</Text>

          {isTeacherOrAdmin(user.role) && (
            <TouchableOpacity style={styles.row} onPress={() => router.push("/(main)/create-assignment" as any)}>
              <Feather name="plus-circle" size={20} color={colors.primary} />
              <Text style={styles.rowText}>Создать задание</Text>
              <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
            </TouchableOpacity>
          )}

          {(isTeacherOrAdmin(user.role) || user.role === "parent") && (
            <TouchableOpacity style={styles.row} onPress={() => router.push("/(main)/students" as any)}>
              <Feather name="users" size={20} color={colors.primary} />
              <Text style={styles.rowText}>
                {user.role === "parent" ? "Мои дети" : "Все ученики"}
              </Text>
              <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
            </TouchableOpacity>
          )}

          {user.role === "student" && (
            <>
              <TouchableOpacity style={styles.row} onPress={() => router.push("/(main)/leaderboard" as any)}>
                <Feather name="award" size={20} color={colors.primary} />
                <Text style={styles.rowText}>Рейтинг</Text>
                <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.row} onPress={() => router.push("/(main)/voice-chat" as any)}>
                <Feather name="message-circle" size={20} color={colors.primary} />
                <Text style={styles.rowText}>AI Чат-тренажёр</Text>
                <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
              </TouchableOpacity>
            </>
          )}
        </View>

        <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
          <Text style={styles.logoutText}>Выйти из аккаунта</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}
