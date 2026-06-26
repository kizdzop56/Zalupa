import React, { useState, useCallback, useEffect } from "react";
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl, Platform, Modal, ScrollView, Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useAuth, isTeacherOrAdmin, LEVEL_META } from "@/contexts/AuthContext";
import { useListAssignments } from "@workspace/api-client-react";
import type { Assignment } from "@workspace/api-client-react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const BASE_URL = process.env["EXPO_PUBLIC_DOMAIN"]
  ? `https://${process.env["EXPO_PUBLIC_DOMAIN"]}`
  : "";

async function apiFetch(path: string, options?: RequestInit) {
  const token = await AsyncStorage.getItem("auth_token");
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options?.headers ?? {}),
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Ошибка сервера");
  return data;
}

const TYPE_ICONS: Record<string, any> = {
  text_test: "edit-3", audio: "headphones", reading: "book", video: "video",
};
const TYPE_LABELS: Record<string, string> = {
  text_test: "Тест", audio: "Слушание", reading: "Чтение", video: "Видео",
};
const TYPE_COLORS: Record<string, string> = {
  text_test: "#8b5cf6", audio: "#06b6d4", reading: "#10b981", video: "#f59e0b",
};
const FILTERS = ["Все", "text_test", "audio", "reading", "video"] as const;
type Filter = typeof FILTERS[number];

type StudentItem = {
  id: number; name: string; avatarEmoji: string | null; avatarColor: string | null; knowledgeLevel: string | null;
};

// ─── Assign Modal ────────────────────────────────────────────────────
function AssignModal({
  visible, assignment, onClose, onDone,
}: {
  visible: boolean;
  assignment: Assignment | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const colors = useColors();
  const [students, setStudents] = useState<StudentItem[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!visible) return;
    setSelected(new Set()); setError("");
    setLoading(true);
    apiFetch("/api/connections/teacher/students")
      .then(setStudents)
      .catch(() => setError("Не удалось загрузить учеников"))
      .finally(() => setLoading(false));
  }, [visible]);

  const toggle = (id: number) => setSelected((prev) => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const send = async () => {
    if (!assignment || selected.size === 0) return;
    setSending(true); setError("");
    try {
      await apiFetch(`/api/assignments/${assignment.id}/assign`, {
        method: "POST",
        body: JSON.stringify({ studentIds: Array.from(selected) }),
      });
      onDone();
      onClose();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: "#00000066", justifyContent: "flex-end" }}>
        <View style={{
          backgroundColor: colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24,
          padding: 24, maxHeight: "85%",
        }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
            <Text style={{ fontSize: 18, fontWeight: "800", color: colors.foreground }}>Назначить задание</Text>
            <TouchableOpacity onPress={onClose}><Feather name="x" size={22} color={colors.mutedForeground} /></TouchableOpacity>
          </View>
          <Text style={{ fontSize: 13, color: colors.mutedForeground, marginBottom: 16 }}>
            {assignment?.title} · выбери учеников
          </Text>

          {error ? (
            <View style={{ backgroundColor: "#fef2f2", borderRadius: 10, padding: 12, marginBottom: 12 }}>
              <Text style={{ color: "#dc2626", fontSize: 13 }}>{error}</Text>
            </View>
          ) : null}

          {loading ? (
            <ActivityIndicator color={colors.primary} style={{ marginVertical: 30 }} />
          ) : students.length === 0 ? (
            <View style={{ alignItems: "center", paddingVertical: 30, gap: 8 }}>
              <Text style={{ fontSize: 36 }}>🎓</Text>
              <Text style={{ fontSize: 15, color: colors.mutedForeground, textAlign: "center" }}>
                Нет принятых учеников.{"\n"}Сначала добавьте учеников на вкладке «Ученики».
              </Text>
            </View>
          ) : (
            <ScrollView style={{ maxHeight: 340 }}>
              {students.map((s) => {
                const checked = selected.has(s.id);
                return (
                  <TouchableOpacity
                    key={s.id}
                    onPress={() => toggle(s.id)}
                    style={{
                      flexDirection: "row", alignItems: "center", gap: 12,
                      padding: 12, borderRadius: 14, marginBottom: 8,
                      backgroundColor: checked ? colors.primary + "15" : colors.card,
                      borderWidth: 1.5,
                      borderColor: checked ? colors.primary : colors.border,
                    }}
                  >
                    <View style={{
                      width: 42, height: 42, borderRadius: 21,
                      backgroundColor: s.avatarColor ?? "#6366f1",
                      justifyContent: "center", alignItems: "center",
                    }}>
                      <Text style={{ fontSize: 20 }}>{s.avatarEmoji ?? "🦁"}</Text>
                    </View>
                    <Text style={{ flex: 1, fontSize: 15, fontWeight: "600", color: colors.foreground }}>
                      {s.name}
                    </Text>
                    <View style={{
                      width: 22, height: 22, borderRadius: 11,
                      borderWidth: 2, borderColor: checked ? colors.primary : colors.border,
                      backgroundColor: checked ? colors.primary : "transparent",
                      justifyContent: "center", alignItems: "center",
                    }}>
                      {checked && <Feather name="check" size={13} color="#fff" />}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}

          {students.length > 0 && (
            <TouchableOpacity
              style={{
                backgroundColor: selected.size > 0 ? colors.primary : colors.muted,
                borderRadius: 14, paddingVertical: 15,
                alignItems: "center", marginTop: 16,
                flexDirection: "row", justifyContent: "center", gap: 8,
              }}
              onPress={send}
              disabled={selected.size === 0 || sending}
            >
              {sending
                ? <ActivityIndicator color="#fff" />
                : <>
                    <Feather name="send" size={18} color="#fff" />
                    <Text style={{ fontSize: 16, fontWeight: "700", color: "#fff" }}>
                      Отправить {selected.size > 0 ? `(${selected.size})` : ""}
                    </Text>
                  </>
              }
            </TouchableOpacity>
          )}

          <TouchableOpacity onPress={onClose} style={{ paddingVertical: 12, alignItems: "center", marginTop: 4 }}>
            <Text style={{ fontSize: 14, color: colors.mutedForeground }}>Отмена</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────
export default function AssignmentsScreen() {
  const colors = useColors();
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState<Filter>("Все");
  const [assignTarget, setAssignTarget] = useState<Assignment | null>(null);
  const [myTasks, setMyTasks] = useState<any[]>([]);
  const [loadingMyTasks, setLoadingMyTasks] = useState(false);
  const [myAssignments, setMyAssignments] = useState<any[]>([]);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const isTeacher = isTeacherOrAdmin(user?.role ?? "");
  const isStudent = user?.role === "student";
  const levelMeta = user?.knowledgeLevel ? LEVEL_META[user.knowledgeLevel] : null;

  const queryParams = isStudent && user?.age ? { ageMin: user.age, ageMax: user.age } : {};
  const { data: allAssignments, isLoading, refetch, isRefetching } = useListAssignments(queryParams);

  const loadMyTasks = useCallback(async () => {
    if (!isStudent) return;
    setLoadingMyTasks(true);
    try { setMyTasks(await apiFetch("/api/assignments/my-tasks")); }
    catch { /* silent */ }
    finally { setLoadingMyTasks(false); }
  }, [isStudent]);

  const loadMyAssignments = useCallback(async () => {
    if (!isTeacher) return;
    try { setMyAssignments(await apiFetch("/api/assignments/my-assignments")); }
    catch { /* silent */ }
  }, [isTeacher]);

  useEffect(() => { loadMyTasks(); }, [loadMyTasks]);
  useEffect(() => { loadMyAssignments(); }, [loadMyAssignments]);

  const handleDeleteAssignment = async (id: number) => {
    setDeletingId(id);
    try {
      await apiFetch(`/api/assignments/${id}`, { method: "DELETE" });
      setMyAssignments(prev => prev.filter(a => a.id !== id));
    } catch (e: any) {
      Alert.alert("Ошибка", e.message);
    } finally {
      setDeletingId(null);
    }
  };

  const assignments = (allAssignments ?? []).filter(
    (a) => filter === "Все" || a.type === filter
  );

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
    levelBanner: {
      flexDirection: "row", alignItems: "center", gap: 8,
      borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8,
      marginTop: 8, borderWidth: 1,
    },
    levelBannerText: { fontSize: 13, fontWeight: "700" },
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
    assignedCard: {
      backgroundColor: colors.primary + "08", borderRadius: 16, padding: 16,
      marginBottom: 10, borderWidth: 1.5, borderColor: colors.primary + "40",
    },
    cardHeader: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 10 },
    typeIcon: { width: 44, height: 44, borderRadius: 12, justifyContent: "center", alignItems: "center" },
    cardTitle: { fontSize: 16, fontWeight: "700", color: colors.foreground, flex: 1 },
    cardDesc: { fontSize: 13, color: colors.mutedForeground, lineHeight: 18, marginBottom: 10 },
    cardFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 6 },
    cardActions: { flexDirection: "row", gap: 8, marginTop: 10 },
    typeBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
    typeBadgeText: { fontSize: 12, fontWeight: "600" },
    pointsBadge: {
      flexDirection: "row", alignItems: "center", gap: 4,
      paddingHorizontal: 10, paddingVertical: 4,
      backgroundColor: "#fef3c7", borderRadius: 8,
    },
    pointsText: { fontSize: 12, fontWeight: "700", color: "#92400e" },
    ageText: { fontSize: 12, color: colors.mutedForeground },
    actionBtn: {
      flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
      gap: 6, paddingVertical: 9, borderRadius: 10, borderWidth: 1,
    },
    actionBtnText: { fontSize: 13, fontWeight: "700" },
    sectionLabel: {
      fontSize: 12, fontWeight: "700", color: colors.mutedForeground,
      textTransform: "uppercase", letterSpacing: 0.6,
      marginBottom: 10, marginTop: 4,
    },
    empty: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 60, gap: 12 },
    emptyText: { fontSize: 16, color: colors.mutedForeground, textAlign: "center" },
    teacherTag: {
      flexDirection: "row", alignItems: "center", gap: 4,
      backgroundColor: colors.primary + "15", borderRadius: 8,
      paddingHorizontal: 8, paddingVertical: 3, marginBottom: 8, alignSelf: "flex-start",
    },
  });

  const renderAssignmentCard = ({ item }: { item: Assignment }) => {
    const color = TYPE_COLORS[item.type] || colors.primary;
    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => router.push(`/(main)/assignment/${item.id}` as any)}
        activeOpacity={0.75}
      >
        <View style={styles.cardHeader}>
          <View style={[styles.typeIcon, { backgroundColor: color + "20" }]}>
            <Feather name={TYPE_ICONS[item.type]} size={22} color={color} />
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
            <Text style={styles.pointsText}>{item.points} очков</Text>
          </View>
          <Text style={styles.ageText}>{item.ageMin}–{item.ageMax} лет</Text>
        </View>

        {isTeacher && (
          <View style={styles.cardActions}>
            <TouchableOpacity
              style={[styles.actionBtn, { borderColor: colors.primary, backgroundColor: colors.primary + "10" }]}
              onPress={(e) => { e.stopPropagation(); setAssignTarget(item); }}
            >
              <Feather name="send" size={15} color={colors.primary} />
              <Text style={[styles.actionBtnText, { color: colors.primary }]}>Назначить</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, { borderColor: colors.border, backgroundColor: colors.card }]}
              onPress={(e) => { e.stopPropagation(); router.push(`/(main)/teacher-results/${item.id}` as any); }}
            >
              <Feather name="bar-chart-2" size={15} color={colors.mutedForeground} />
              <Text style={[styles.actionBtnText, { color: colors.mutedForeground }]}>Результаты</Text>
            </TouchableOpacity>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderMyTaskCard = ({ item }: { item: any }) => {
    const color = TYPE_COLORS[item.type] || colors.primary;
    return (
      <TouchableOpacity
        style={styles.assignedCard}
        onPress={() => router.push(`/(main)/assignment/${item.assignmentId}` as any)}
        activeOpacity={0.75}
      >
        <View style={styles.teacherTag}>
          <Feather name="send" size={11} color={colors.primary} />
          <Text style={{ fontSize: 11, fontWeight: "700", color: colors.primary }}>
            от {item.teacherName}
          </Text>
        </View>
        <View style={styles.cardHeader}>
          <View style={[styles.typeIcon, { backgroundColor: color + "20" }]}>
            <Feather name={TYPE_ICONS[item.type] ?? "edit-3"} size={22} color={color} />
          </View>
          <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
        </View>
        <View style={styles.cardFooter}>
          <View style={[styles.typeBadge, { backgroundColor: color + "15" }]}>
            <Text style={[styles.typeBadgeText, { color }]}>{TYPE_LABELS[item.type] ?? item.type}</Text>
          </View>
          <View style={styles.pointsBadge}>
            <Feather name="star" size={12} color="#92400e" />
            <Text style={styles.pointsText}>{item.points} очков</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderMyAssignmentCard = (item: any) => {
    const color = TYPE_COLORS[item.type] || colors.primary;
    const isDraft = item.isDraft;
    return (
      <TouchableOpacity
        key={item.id}
        style={[styles.card, isDraft && { borderColor: colors.border, borderStyle: "dashed" }]}
        onPress={() => router.push(`/(main)/assignment/${item.id}` as any)}
        activeOpacity={0.75}
      >
        <View style={styles.cardHeader}>
          <View style={[styles.typeIcon, { backgroundColor: color + "20" }]}>
            <Feather name={TYPE_ICONS[item.type]} size={22} color={color} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
            {isDraft && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 3 }}>
                <Feather name="edit-2" size={11} color={colors.mutedForeground} />
                <Text style={{ fontSize: 11, color: colors.mutedForeground, fontWeight: "600" }}>Черновик</Text>
              </View>
            )}
          </View>
        </View>
        <View style={styles.cardActions}>
          <TouchableOpacity
            style={[styles.actionBtn, { borderColor: colors.primary, backgroundColor: colors.primary + "10", flex: undefined, paddingHorizontal: 12 }]}
            onPress={(e) => { e.stopPropagation(); setAssignTarget(item); }}
          >
            <Feather name="send" size={14} color={colors.primary} />
            <Text style={[styles.actionBtnText, { color: colors.primary }]}>Назначить</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, { borderColor: colors.border, backgroundColor: colors.card, flex: undefined, paddingHorizontal: 12 }]}
            onPress={(e) => { e.stopPropagation(); router.push(`/(main)/teacher-results/${item.id}` as any); }}
          >
            <Feather name="bar-chart-2" size={14} color={colors.mutedForeground} />
            <Text style={[styles.actionBtnText, { color: colors.mutedForeground }]}>Итоги</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, { borderColor: "#fca5a5", backgroundColor: "#fef2f2", flex: undefined, paddingHorizontal: 12 }]}
            onPress={(e) => {
              e.stopPropagation();
              Alert.alert("Удалить задание?", item.title, [
                { text: "Отмена", style: "cancel" },
                { text: "Удалить", style: "destructive", onPress: () => handleDeleteAssignment(item.id) },
              ]);
            }}
          >
            {deletingId === item.id
              ? <ActivityIndicator size="small" color="#dc2626" />
              : <Feather name="trash-2" size={14} color="#dc2626" />
            }
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <AssignModal
        visible={!!assignTarget}
        assignment={assignTarget}
        onClose={() => setAssignTarget(null)}
        onDone={() => { loadMyAssignments(); refetch(); }}
      />

      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>
            {isTeacher ? "Задания" : "Мои задания"}
          </Text>
          {isTeacher && (
            <TouchableOpacity style={styles.addBtn} onPress={() => router.push("/(main)/create-assignment" as any)}>
              <Feather name="plus" size={20} color="#fff" />
            </TouchableOpacity>
          )}
        </View>

        {levelMeta && isStudent && (
          <View style={[styles.levelBanner, { backgroundColor: levelMeta.color + "12", borderColor: levelMeta.color + "35" }]}>
            <Feather name="zap" size={14} color={levelMeta.color} />
            <Text style={[styles.levelBannerText, { color: levelMeta.color }]}>
              Уровень: {levelMeta.labelRu} ({levelMeta.label})
            </Text>
          </View>
        )}

        <FlatList
          horizontal
          data={FILTERS}
          keyExtractor={(f) => f}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
          renderItem={({ item: f }) => (
            <TouchableOpacity
              style={[styles.filterBtn, filter === f && styles.filterBtnActive]}
              onPress={() => setFilter(f)}
            >
              <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
                {f === "Все" ? "Все" : TYPE_LABELS[f]}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {isLoading ? (
        <View style={styles.empty}><ActivityIndicator color={colors.primary} size="large" /></View>
      ) : (
        <FlatList
          data={assignments}
          keyExtractor={(a) => String(a.id)}
          renderItem={renderAssignmentCard}
          contentContainerStyle={[styles.list, { paddingTop: 8 }]}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => { refetch(); loadMyTasks(); loadMyAssignments(); }} />}
          ListHeaderComponent={
            <>
              {/* Teacher: my assignments section */}
              {isTeacher && myAssignments.length > 0 && (
                <View style={{ marginBottom: 8 }}>
                  <Text style={styles.sectionLabel}>Мои задания · {myAssignments.length}</Text>
                  {myAssignments.map((item) => renderMyAssignmentCard(item))}
                  <Text style={[styles.sectionLabel, { marginTop: 16 }]}>Все задания</Text>
                </View>
              )}
              {/* Student: assigned by teacher section */}
              {isStudent && myTasks.length > 0 && (
                <View style={{ marginBottom: 8 }}>
                  <Text style={styles.sectionLabel}>Назначено учителем · {myTasks.length}</Text>
                  {myTasks.map((item) => (
                    <View key={item.assignedTaskId}>
                      {renderMyTaskCard({ item })}
                    </View>
                  ))}
                  <Text style={[styles.sectionLabel, { marginTop: 16 }]}>Все задания</Text>
                </View>
              )}
            </>
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Feather name="inbox" size={48} color={colors.mutedForeground} />
              <Text style={styles.emptyText}>
                {isTeacher ? "Заданий пока нет.\nНажмите + чтобы создать первое." : "Нет доступных заданий"}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}
