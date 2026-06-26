import React from "react";
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useAuth, isTeacherOrAdmin, LEVEL_META } from "@/contexts/AuthContext";
import { useListUsers, useGetParentChildren } from "@workspace/api-client-react";
import type { User, UserWithStats } from "@workspace/api-client-react";

export default function StudentsScreen() {
  const colors = useColors();
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const isParent = user?.role === "parent";
  const isTeacher = isTeacherOrAdmin(user?.role ?? "");

  const { data: allStudents, isLoading: loadingAll } = useListUsers(
    { role: "student" },
    { query: { enabled: !isParent } as any }
  );
  const { data: children, isLoading: loadingChildren } = useGetParentChildren(
    user?.id || 0,
    { query: { enabled: isParent && !!user?.id } as any }
  );

  const students = (isParent ? children : allStudents) ?? [];
  const isLoading = isParent ? loadingChildren : loadingAll;

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      paddingTop: insets.top + (Platform.OS === "web" ? 67 : 16),
      paddingHorizontal: 20, paddingBottom: 16,
    },
    title: { fontSize: 26, fontWeight: "800", color: colors.foreground, marginBottom: 4 },
    subtitle: { fontSize: 14, color: colors.mutedForeground },
    list: { paddingHorizontal: 20, paddingBottom: insets.bottom + 90 },
    card: {
      backgroundColor: colors.card, borderRadius: 16, padding: 16,
      marginBottom: 10, borderWidth: 1, borderColor: colors.border,
      flexDirection: "row", alignItems: "center", gap: 14,
    },
    avatar: {
      width: 50, height: 50, borderRadius: 25,
      backgroundColor: colors.secondary, justifyContent: "center", alignItems: "center",
    },
    info: { flex: 1 },
    name: { fontSize: 15, fontWeight: "700", color: colors.foreground },
    username: { fontSize: 13, color: colors.mutedForeground },
    metaRow: { flexDirection: "row", gap: 8, marginTop: 5, flexWrap: "wrap" },
    chip: {
      flexDirection: "row", alignItems: "center", gap: 3,
      paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
    },
    chipText: { fontSize: 11, fontWeight: "700" },
    statsCol: { alignItems: "flex-end", gap: 2 },
    points: { fontSize: 16, fontWeight: "800", color: colors.foreground },
    pointsLabel: { fontSize: 11, color: colors.mutedForeground },
    empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
    emptyText: { fontSize: 16, color: colors.mutedForeground, textAlign: "center" },
  });

  const renderItem = ({ item }: { item: User | UserWithStats }) => {
    const knowledgeLevel = (item as any).knowledgeLevel as string | null;
    const lvl = knowledgeLevel ? LEVEL_META[knowledgeLevel as keyof typeof LEVEL_META] : null;

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => router.push(`/(main)/student/${item.id}` as any)}
        activeOpacity={0.75}
      >
        <View style={[styles.avatar, lvl ? { backgroundColor: lvl.color + "20" } : {}]}>
          <Feather name="user" size={22} color={lvl ? lvl.color : colors.primary} />
        </View>
        <View style={styles.info}>
          <Text style={styles.name}>{item.name}</Text>
          <Text style={styles.username}>@{item.username}</Text>
          <View style={styles.metaRow}>
            {item.age != null && (
              <View style={[styles.chip, { backgroundColor: colors.muted }]}>
                <Feather name="calendar" size={10} color={colors.mutedForeground} />
                <Text style={[styles.chipText, { color: colors.mutedForeground }]}>{item.age} лет</Text>
              </View>
            )}
            {lvl && (
              <View style={[styles.chip, { backgroundColor: lvl.color + "18" }]}>
                <Feather name="zap" size={10} color={lvl.color} />
                <Text style={[styles.chipText, { color: lvl.color }]}>{lvl.labelRu}</Text>
              </View>
            )}
            {"completedAssignments" in item && (
              <View style={[styles.chip, { backgroundColor: colors.muted }]}>
                <Feather name="check-circle" size={10} color={colors.success} />
                <Text style={[styles.chipText, { color: colors.mutedForeground }]}>
                  {(item as UserWithStats).completedAssignments} выполнено
                </Text>
              </View>
            )}
          </View>
        </View>
        <View style={styles.statsCol}>
          <Text style={styles.points}>{item.totalPoints}</Text>
          <Text style={styles.pointsLabel}>очков</Text>
          <Feather name="chevron-right" size={16} color={colors.mutedForeground} style={{ marginTop: 4 }} />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>
          {isParent ? "Мои дети" : "Ученики"}
        </Text>
        <Text style={styles.subtitle}>
          {isParent
            ? "Прогресс вашего ребёнка"
            : `${students.length} ${students.length === 1 ? "ученик" : "учеников"}`}
        </Text>
      </View>

      {isLoading ? (
        <View style={styles.empty}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : students.length === 0 ? (
        <View style={styles.empty}>
          <Feather name="users" size={48} color={colors.mutedForeground} />
          <Text style={styles.emptyText}>
            {isParent ? "Дети ещё не привязаны" : "Учеников пока нет"}
          </Text>
        </View>
      ) : (
        <FlatList
          data={students}
          keyExtractor={(s) => String(s.id)}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
        />
      )}
    </View>
  );
}
