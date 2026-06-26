import React from "react";
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/contexts/AuthContext";
import { useListUsers, useGetParentChildren } from "@workspace/api-client-react";
import type { User, UserWithStats } from "@workspace/api-client-react";

export default function StudentsScreen() {
  const colors = useColors();
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const isParent = user?.role === "parent";

  const { data: allStudents, isLoading: loadingAll } = useListUsers(
    { role: "student" },
    { query: { enabled: !isParent } }
  );
  const { data: children, isLoading: loadingChildren } = useGetParentChildren(
    user?.id || 0,
    { query: { enabled: isParent && !!user?.id } }
  );

  const students = (isParent ? children : allStudents) || [];
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
      width: 48, height: 48, borderRadius: 24,
      backgroundColor: colors.secondary, justifyContent: "center", alignItems: "center",
    },
    info: { flex: 1 },
    name: { fontSize: 15, fontWeight: "700", color: colors.foreground },
    username: { fontSize: 13, color: colors.mutedForeground },
    meta: { flexDirection: "row", gap: 10, marginTop: 4 },
    metaBadge: {
      flexDirection: "row", alignItems: "center", gap: 3,
    },
    metaText: { fontSize: 12, color: colors.mutedForeground },
    statsCol: { alignItems: "flex-end", gap: 2 },
    points: { fontSize: 16, fontWeight: "800", color: colors.foreground },
    pointsLabel: { fontSize: 11, color: colors.mutedForeground },
    empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
    emptyText: { fontSize: 16, color: colors.mutedForeground },
  });

  const renderItem = ({ item }: { item: User | UserWithStats }) => (
    <TouchableOpacity style={styles.card} onPress={() => router.push(`/(main)/student/${item.id}` as any)} activeOpacity={0.7}>
      <View style={styles.avatar}>
        <Feather name="user" size={22} color={colors.primary} />
      </View>
      <View style={styles.info}>
        <Text style={styles.name}>{item.name}</Text>
        <Text style={styles.username}>@{item.username}</Text>
        <View style={styles.meta}>
          {item.age && (
            <View style={styles.metaBadge}>
              <Feather name="calendar" size={11} color={colors.mutedForeground} />
              <Text style={styles.metaText}>Age {item.age}</Text>
            </View>
          )}
          {"completedAssignments" in item && (
            <View style={styles.metaBadge}>
              <Feather name="check-circle" size={11} color={colors.success} />
              <Text style={styles.metaText}>{(item as UserWithStats).completedAssignments} done</Text>
            </View>
          )}
        </View>
      </View>
      <View style={styles.statsCol}>
        <Text style={styles.points}>{item.totalPoints}</Text>
        <Text style={styles.pointsLabel}>pts</Text>
        <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{isParent ? "My Children" : "All Students"}</Text>
        <Text style={styles.subtitle}>
          {isParent ? "Track your child's progress" : `${students.length} student${students.length !== 1 ? "s" : ""} enrolled`}
        </Text>
      </View>

      {isLoading ? (
        <View style={styles.empty}><ActivityIndicator color={colors.primary} size="large" /></View>
      ) : students.length === 0 ? (
        <View style={styles.empty}>
          <Feather name="users" size={48} color={colors.mutedForeground} />
          <Text style={styles.emptyText}>{isParent ? "No children linked yet" : "No students yet"}</Text>
        </View>
      ) : (
        <FlatList
          data={students}
          keyExtractor={s => String(s.id)}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
        />
      )}
    </View>
  );
}
