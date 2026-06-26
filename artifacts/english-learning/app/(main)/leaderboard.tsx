import React from "react";
import { View, Text, FlatList, StyleSheet, ActivityIndicator, Platform } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/contexts/AuthContext";
import { useGetLeaderboard } from "@workspace/api-client-react";
import type { LeaderboardEntry } from "@workspace/api-client-react";

const MEDAL_COLORS = ["#f59e0b", "#94a3b8", "#b45309"];

export default function LeaderboardScreen() {
  const colors = useColors();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const { data: leaderboard, isLoading } = useGetLeaderboard();

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      paddingTop: insets.top + (Platform.OS === "web" ? 67 : 16),
      paddingHorizontal: 20, paddingBottom: 16,
    },
    title: { fontSize: 26, fontWeight: "800", color: colors.foreground, marginBottom: 4 },
    subtitle: { fontSize: 14, color: colors.mutedForeground },
    myCard: {
      marginHorizontal: 20, marginBottom: 16, padding: 16,
      backgroundColor: colors.primary + "15", borderRadius: 16,
      borderWidth: 1.5, borderColor: colors.primary + "40",
      flexDirection: "row", alignItems: "center", gap: 12,
    },
    myCardText: { fontSize: 14, fontWeight: "700", color: colors.primary },
    myCardPoints: { fontSize: 22, fontWeight: "800", color: colors.primary },
    myCardLabel: { fontSize: 12, color: colors.mutedForeground },
    list: { paddingHorizontal: 20, paddingBottom: insets.bottom + 90 },
    item: {
      flexDirection: "row", alignItems: "center", gap: 14,
      backgroundColor: colors.card, borderRadius: 14, padding: 14,
      marginBottom: 8, borderWidth: 1, borderColor: colors.border,
    },
    itemMe: { borderColor: colors.primary, backgroundColor: colors.secondary },
    rank: { width: 32, height: 32, borderRadius: 16, justifyContent: "center", alignItems: "center" },
    rankText: { fontSize: 16, fontWeight: "800" },
    name: { flex: 1, fontSize: 15, fontWeight: "600", color: colors.foreground },
    pointsBox: { alignItems: "flex-end" },
    points: { fontSize: 16, fontWeight: "800", color: colors.foreground },
    completed: { fontSize: 12, color: colors.mutedForeground },
    empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
    emptyText: { fontSize: 16, color: colors.mutedForeground },
  });

  const myEntry = leaderboard?.find(e => e.userId === user?.id);

  const renderItem = ({ item }: { item: LeaderboardEntry }) => {
    const isMe = item.userId === user?.id;
    const medalColor = MEDAL_COLORS[item.rank - 1];
    return (
      <View style={[styles.item, isMe && styles.itemMe]}>
        <View style={[styles.rank, { backgroundColor: medalColor ? medalColor + "20" : colors.muted }]}>
          {item.rank <= 3 ? (
            <Feather name="award" size={18} color={medalColor} />
          ) : (
            <Text style={[styles.rankText, { color: colors.mutedForeground }]}>#{item.rank}</Text>
          )}
        </View>
        <Text style={styles.name} numberOfLines={1}>{item.name}{isMe ? " (You)" : ""}</Text>
        <View style={styles.pointsBox}>
          <Text style={styles.points}>{item.totalPoints}</Text>
          <Text style={styles.completed}>{item.completedAssignments} done</Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Leaderboard</Text>
        <Text style={styles.subtitle}>Top English learners this month</Text>
      </View>

      {myEntry && (
        <View style={styles.myCard}>
          <Feather name="star" size={28} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.myCardLabel}>Your rank</Text>
            <Text style={styles.myCardText}>#{myEntry.rank} — {user?.name}</Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={styles.myCardPoints}>{myEntry.totalPoints}</Text>
            <Text style={styles.myCardLabel}>points</Text>
          </View>
        </View>
      )}

      {isLoading ? (
        <View style={styles.empty}><ActivityIndicator color={colors.primary} size="large" /></View>
      ) : !leaderboard?.length ? (
        <View style={styles.empty}>
          <Feather name="award" size={48} color={colors.mutedForeground} />
          <Text style={styles.emptyText}>No entries yet</Text>
        </View>
      ) : (
        <FlatList
          data={leaderboard}
          keyExtractor={e => String(e.userId)}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
        />
      )}
    </View>
  );
}
