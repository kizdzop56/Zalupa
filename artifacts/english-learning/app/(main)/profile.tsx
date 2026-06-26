import React from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "expo-router";

const ROLE_COLORS: Record<string, string> = {
  student: "#6366f1",
  parent: "#0ea5e9",
  admin: "#f59e0b",
};

const ROLE_LABELS: Record<string, string> = {
  student: "Student",
  parent: "Parent",
  admin: "Administrator",
};

export default function ProfileScreen() {
  const colors = useColors();
  const { user, logout } = useAuth();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const roleColor = user ? ROLE_COLORS[user.role] : colors.primary;

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    scroll: { paddingBottom: insets.bottom + 90 },
    header: {
      paddingTop: insets.top + (Platform.OS === "web" ? 67 : 16),
      paddingHorizontal: 20, paddingBottom: 24,
      alignItems: "center",
    },
    avatar: {
      width: 80, height: 80, borderRadius: 40,
      backgroundColor: roleColor + "20",
      justifyContent: "center", alignItems: "center",
      marginBottom: 12,
    },
    name: { fontSize: 22, fontWeight: "800", color: colors.foreground, marginBottom: 4 },
    username: { fontSize: 14, color: colors.mutedForeground, marginBottom: 8 },
    roleBadge: {
      paddingHorizontal: 14, paddingVertical: 5, borderRadius: 20,
    },
    roleText: { fontSize: 13, fontWeight: "700" },
    section: { paddingHorizontal: 20, marginBottom: 20 },
    sectionTitle: { fontSize: 13, fontWeight: "700", color: colors.mutedForeground, marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 },
    statsRow: { flexDirection: "row", gap: 10 },
    statCard: {
      flex: 1, backgroundColor: colors.card, borderRadius: 14, padding: 14,
      alignItems: "center", borderWidth: 1, borderColor: colors.border,
    },
    statValue: { fontSize: 22, fontWeight: "800", color: colors.foreground, marginBottom: 2 },
    statLabel: { fontSize: 12, color: colors.mutedForeground },
    row: {
      flexDirection: "row", alignItems: "center", gap: 14,
      backgroundColor: colors.card, borderRadius: 14, padding: 16,
      marginBottom: 8, borderWidth: 1, borderColor: colors.border,
    },
    rowText: { flex: 1, fontSize: 15, fontWeight: "600", color: colors.foreground },
    logoutBtn: {
      marginHorizontal: 20, marginTop: 8,
      backgroundColor: colors.destructive + "15", borderRadius: 14,
      padding: 16, alignItems: "center",
      borderWidth: 1, borderColor: colors.destructive + "30",
    },
    logoutText: { fontSize: 15, fontWeight: "700", color: colors.destructive },
    ageInfo: {
      fontSize: 13, color: colors.mutedForeground, marginTop: 4,
    },
  });

  if (!user) return null;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <View style={styles.avatar}>
            <Feather
              name={user.role === "student" ? "book-open" : user.role === "parent" ? "users" : "shield"}
              size={36} color={roleColor}
            />
          </View>
          <Text style={styles.name}>{user.name}</Text>
          <Text style={styles.username}>@{user.username}</Text>
          {user.age && <Text style={styles.ageInfo}>Age {user.age}</Text>}
          <View style={[styles.roleBadge, { backgroundColor: roleColor + "15" }]}>
            <Text style={[styles.roleText, { color: roleColor }]}>{ROLE_LABELS[user.role]}</Text>
          </View>
        </View>

        {user.role === "student" && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>My Progress</Text>
            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <Feather name="star" size={20} color="#f59e0b" />
                <Text style={styles.statValue}>{user.totalPoints}</Text>
                <Text style={styles.statLabel}>Points</Text>
              </View>
              <View style={styles.statCard}>
                <Feather name="award" size={20} color={colors.primary} />
                <Text style={styles.statValue}>Top</Text>
                <Text style={styles.statLabel}>Learner</Text>
              </View>
            </View>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          {user.role === "admin" && (
            <TouchableOpacity style={styles.row} onPress={() => router.push("/(main)/create-assignment" as any)}>
              <Feather name="plus-circle" size={20} color={colors.primary} />
              <Text style={styles.rowText}>Create Assignment</Text>
              <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
            </TouchableOpacity>
          )}
          {(user.role === "admin" || user.role === "parent") && (
            <TouchableOpacity style={styles.row} onPress={() => router.push("/(main)/students" as any)}>
              <Feather name="users" size={20} color={colors.primary} />
              <Text style={styles.rowText}>{user.role === "parent" ? "My Children" : "All Students"}</Text>
              <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
            </TouchableOpacity>
          )}
          {user.role === "student" && (
            <TouchableOpacity style={styles.row} onPress={() => router.push("/(main)/leaderboard" as any)}>
              <Feather name="award" size={20} color={colors.primary} />
              <Text style={styles.rowText}>View Leaderboard</Text>
              <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}
