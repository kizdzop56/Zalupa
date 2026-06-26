import React, { useState } from "react";
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl, Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/contexts/AuthContext";
import { useListAssignments } from "@workspace/api-client-react";
import type { Assignment } from "@workspace/api-client-react";

const TYPE_ICONS: Record<string, string> = {
  text_test: "edit-3",
  audio: "headphones",
  reading: "book",
  video: "video",
};

const TYPE_LABELS: Record<string, string> = {
  text_test: "Text Test",
  audio: "Listening",
  reading: "Reading",
  video: "Video",
};

const FILTERS = ["All", "text_test", "audio", "reading", "video"] as const;
type Filter = typeof FILTERS[number];

export default function AssignmentsScreen() {
  const colors = useColors();
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState<Filter>("All");

  const { data: allAssignments, isLoading, refetch, isRefetching } = useListAssignments(
    user?.role === "student" && user?.age
      ? { ageMin: user.age, ageMax: user.age }
      : {}
  );

  const assignments = allAssignments?.filter(a =>
    filter === "All" || a.type === filter
  ) || [];

  const typeColor = (type: string) => {
    const map: Record<string, string> = {
      text_test: colors.textTestColor,
      audio: colors.audioColor,
      reading: colors.readingColor,
      video: colors.videoColor,
    };
    return map[type] || colors.primary;
  };

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      paddingTop: insets.top + (Platform.OS === "web" ? 67 : 16),
      paddingHorizontal: 20, paddingBottom: 12,
      backgroundColor: colors.background,
    },
    headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    title: { fontSize: 26, fontWeight: "800", color: colors.foreground },
    addBtn: {
      width: 40, height: 40, borderRadius: 20,
      backgroundColor: colors.primary, justifyContent: "center", alignItems: "center",
    },
    filterRow: { flexDirection: "row", gap: 8, paddingVertical: 12 },
    filterBtn: {
      paddingHorizontal: 14, paddingVertical: 7,
      borderRadius: 20, borderWidth: 1.5, borderColor: colors.border,
      backgroundColor: colors.card,
    },
    filterBtnActive: { borderColor: colors.primary, backgroundColor: colors.secondary },
    filterText: { fontSize: 13, fontWeight: "600", color: colors.mutedForeground },
    filterTextActive: { color: colors.primary },
    list: { paddingHorizontal: 20, paddingBottom: insets.bottom + 90 },
    card: {
      backgroundColor: colors.card, borderRadius: 16, padding: 16,
      marginBottom: 12, borderWidth: 1, borderColor: colors.border,
    },
    cardHeader: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 10 },
    typeIcon: {
      width: 44, height: 44, borderRadius: 12,
      justifyContent: "center", alignItems: "center",
    },
    cardTitle: { fontSize: 16, fontWeight: "700", color: colors.foreground, flex: 1 },
    cardDesc: { fontSize: 13, color: colors.mutedForeground, lineHeight: 18, marginBottom: 10 },
    cardFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    typeBadge: {
      paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8,
    },
    typeBadgeText: { fontSize: 12, fontWeight: "600" },
    pointsBadge: {
      flexDirection: "row", alignItems: "center", gap: 4,
      paddingHorizontal: 10, paddingVertical: 4,
      backgroundColor: "#fef3c7", borderRadius: 8,
    },
    pointsText: { fontSize: 12, fontWeight: "700", color: "#92400e" },
    ageBadge: {
      flexDirection: "row", alignItems: "center", gap: 4,
    },
    ageText: { fontSize: 12, color: colors.mutedForeground },
    empty: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 60, gap: 12 },
    emptyText: { fontSize: 16, color: colors.mutedForeground, textAlign: "center" },
  });

  const renderItem = ({ item }: { item: Assignment }) => {
    const color = typeColor(item.type);
    return (
      <TouchableOpacity style={styles.card} onPress={() => router.push(`/(main)/assignment/${item.id}` as any)} activeOpacity={0.7}>
        <View style={styles.cardHeader}>
          <View style={[styles.typeIcon, { backgroundColor: color + "20" }]}>
            <Feather name={TYPE_ICONS[item.type] as any} size={22} color={color} />
          </View>
          <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
        </View>
        <Text style={styles.cardDesc} numberOfLines={2}>{item.description}</Text>
        <View style={styles.cardFooter}>
          <View style={[styles.typeBadge, { backgroundColor: color + "15" }]}>
            <Text style={[styles.typeBadgeText, { color }]}>{TYPE_LABELS[item.type]}</Text>
          </View>
          <View style={styles.pointsBadge}>
            <Feather name="star" size={12} color="#92400e" />
            <Text style={styles.pointsText}>{item.points} pts</Text>
          </View>
          <Text style={styles.ageText}>Ages {item.ageMin}–{item.ageMax}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>
            {user?.role === "student" ? "My Assignments" : user?.role === "admin" ? "All Assignments" : "Assignments"}
          </Text>
          {user?.role === "admin" && (
            <TouchableOpacity style={styles.addBtn} onPress={() => router.push("/(main)/create-assignment" as any)}>
              <Feather name="plus" size={20} color="#fff" />
            </TouchableOpacity>
          )}
        </View>
        <FlatList
          horizontal
          data={FILTERS}
          keyExtractor={f => f}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
          renderItem={({ item: f }) => (
            <TouchableOpacity
              style={[styles.filterBtn, filter === f && styles.filterBtnActive]}
              onPress={() => setFilter(f)}
            >
              <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
                {f === "All" ? "All" : TYPE_LABELS[f]}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {isLoading ? (
        <View style={styles.empty}><ActivityIndicator color={colors.primary} size="large" /></View>
      ) : assignments.length === 0 ? (
        <View style={styles.empty}>
          <Feather name="inbox" size={48} color={colors.mutedForeground} />
          <Text style={styles.emptyText}>No assignments found</Text>
        </View>
      ) : (
        <FlatList
          data={assignments}
          keyExtractor={a => String(a.id)}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
        />
      )}
    </View>
  );
}
