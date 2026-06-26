import React, { useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  ActivityIndicator, Modal, TextInput, Platform, Alert,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useAuth, isTeacherOrAdmin, LEVEL_META } from "@/contexts/AuthContext";
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

type PersonItem = {
  id: number;
  name: string;
  username: string;
  avatarEmoji: string | null;
  avatarColor: string | null;
  knowledgeLevel: string | null;
  totalPoints: number;
  inviteCode: string | null;
};

function UserCard({ item, onRemove, colors }: { item: PersonItem; onRemove: () => void; colors: any }) {
  const levelMeta = item.knowledgeLevel
    ? LEVEL_META[item.knowledgeLevel as keyof typeof LEVEL_META]
    : null;

  return (
    <View style={{
      backgroundColor: colors.card, borderRadius: 16, padding: 14,
      borderWidth: 1, borderColor: colors.border, marginBottom: 10,
      flexDirection: "row", alignItems: "center", gap: 12,
    }}>
      <View style={{
        width: 48, height: 48, borderRadius: 24,
        backgroundColor: item.avatarColor ?? "#6366f1",
        justifyContent: "center", alignItems: "center",
      }}>
        <Text style={{ fontSize: 24 }}>{item.avatarEmoji ?? "🦁"}</Text>
      </View>

      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 15, fontWeight: "700", color: colors.foreground }}>{item.name}</Text>
        <Text style={{ fontSize: 12, color: colors.mutedForeground }}>@{item.username}</Text>
        {levelMeta && (
          <View style={{
            flexDirection: "row", alignItems: "center", marginTop: 3,
            backgroundColor: levelMeta.color + "18", paddingHorizontal: 8, paddingVertical: 2,
            borderRadius: 8, alignSelf: "flex-start",
          }}>
            <Text style={{ fontSize: 11, fontWeight: "700", color: levelMeta.color }}>
              {levelMeta.labelRu}
            </Text>
          </View>
        )}
      </View>

      <View style={{ alignItems: "flex-end", gap: 6 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
          <Feather name="star" size={12} color="#f59e0b" />
          <Text style={{ fontSize: 13, fontWeight: "700", color: colors.foreground }}>
            {item.totalPoints}
          </Text>
        </View>
        <TouchableOpacity onPress={onRemove}>
          <Feather name="x" size={18} color={colors.destructive} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

function AddByCodeModal({
  visible, onClose, onAdded, endpoint, title,
}: {
  visible: boolean;
  onClose: () => void;
  onAdded: (item: PersonItem) => void;
  endpoint: string;
  title: string;
}) {
  const colors = useColors();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [found, setFound] = useState<any>(null);

  const reset = () => { setCode(""); setFound(null); setError(""); };

  const search = async () => {
    const trimmed = code.trim().toUpperCase();
    if (trimmed.length < 6) { setError("Введите полный 6-символьный код"); return; }
    setLoading(true); setError(""); setFound(null);
    try {
      const data = await apiFetch(`/api/connections/by-code/${trimmed}`);
      if (data.role !== "student") {
        setError("Этот пользователь не является учеником"); return;
      }
      setFound(data);
    } catch (e: any) {
      setError(e.message ?? "Пользователь не найден");
    } finally { setLoading(false); }
  };

  const confirm = async () => {
    if (!found) return;
    setLoading(true); setError("");
    try {
      const result = await apiFetch(endpoint, {
        method: "POST", body: JSON.stringify({ code: code.trim().toUpperCase() }),
      });
      onAdded(result);
      reset(); onClose();
    } catch (e: any) {
      setError(e.message ?? "Ошибка добавления");
    } finally { setLoading(false); }
  };

  const levelMeta = found?.knowledgeLevel
    ? LEVEL_META[found.knowledgeLevel as keyof typeof LEVEL_META]
    : null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={() => { onClose(); reset(); }}>
      <View style={{ flex: 1, backgroundColor: "#00000066", justifyContent: "flex-end" }}>
        <View style={{ backgroundColor: colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 }}>
          <Text style={{ fontSize: 20, fontWeight: "800", color: colors.foreground, marginBottom: 4 }}>
            {title}
          </Text>
          <Text style={{ fontSize: 14, color: colors.mutedForeground, marginBottom: 20 }}>
            Ученик найдёт свой код в разделе «Профиль»
          </Text>

          <View style={{ flexDirection: "row", gap: 10, marginBottom: 14 }}>
            <TextInput
              style={{
                flex: 1, backgroundColor: colors.card,
                borderRadius: 12, borderWidth: 1.5, borderColor: found ? "#10b981" : colors.border,
                paddingHorizontal: 16, paddingVertical: 14,
                fontSize: 20, fontWeight: "800", letterSpacing: 4,
                color: colors.foreground, textTransform: "uppercase", textAlign: "center",
              }}
              placeholder="A3X9K2"
              placeholderTextColor={colors.mutedForeground}
              value={code}
              onChangeText={(t) => { setCode(t.toUpperCase()); setFound(null); setError(""); }}
              maxLength={6}
              autoCapitalize="characters"
              autoCorrect={false}
            />
            <TouchableOpacity
              style={{
                backgroundColor: colors.primary, borderRadius: 12,
                paddingHorizontal: 18, justifyContent: "center",
              }}
              onPress={search} disabled={loading}
            >
              {loading
                ? <ActivityIndicator color="#fff" size="small" />
                : <Feather name="search" size={20} color="#fff" />}
            </TouchableOpacity>
          </View>

          {!!error && (
            <Text style={{ color: colors.destructive, fontSize: 13, marginBottom: 12 }}>{error}</Text>
          )}

          {found && (
            <View style={{
              backgroundColor: "#f0fdf4", borderRadius: 14, padding: 14,
              borderWidth: 1.5, borderColor: "#10b98150",
              flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16,
            }}>
              <View style={{
                width: 52, height: 52, borderRadius: 26,
                backgroundColor: found.avatarColor ?? "#6366f1",
                justifyContent: "center", alignItems: "center",
              }}>
                <Text style={{ fontSize: 26 }}>{found.avatarEmoji ?? "🦁"}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: "800", color: "#065f46" }}>{found.name}</Text>
                <Text style={{ fontSize: 13, color: "#065f46aa" }}>@{found.username}</Text>
                {levelMeta && (
                  <Text style={{ fontSize: 12, color: levelMeta.color, fontWeight: "700", marginTop: 2 }}>
                    {levelMeta.labelRu}
                  </Text>
                )}
              </View>
              <Feather name="check-circle" size={26} color="#10b981" />
            </View>
          )}

          {found && (
            <TouchableOpacity
              style={{
                backgroundColor: colors.primary, borderRadius: 14,
                paddingVertical: 14, alignItems: "center", marginBottom: 8,
              }}
              onPress={confirm} disabled={loading}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={{ fontSize: 16, fontWeight: "700", color: "#fff" }}>Добавить</Text>}
            </TouchableOpacity>
          )}

          <TouchableOpacity
            onPress={() => { onClose(); reset(); }}
            style={{ paddingVertical: 12, alignItems: "center" }}
          >
            <Text style={{ fontSize: 15, color: colors.mutedForeground }}>Отмена</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

export default function StudentsScreen() {
  const colors = useColors();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const isTeacher = isTeacherOrAdmin(user?.role ?? "");
  const isParent = user?.role === "parent";

  const [items, setItems] = useState<PersonItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  const listEndpoint = isTeacher
    ? "/api/connections/teacher/students"
    : "/api/connections/parent/children";
  const addEndpoint = isTeacher
    ? "/api/connections/teacher/add-student"
    : "/api/connections/parent/add-child";
  const deleteEndpoint = (id: number) =>
    isTeacher
      ? `/api/connections/teacher/students/${id}`
      : `/api/connections/parent/children/${id}`;

  const load = React.useCallback(async () => {
    setLoading(true);
    try { setItems(await apiFetch(listEndpoint)); }
    catch { /* ignore */ }
    finally { setLoading(false); }
  }, [listEndpoint]);

  React.useEffect(() => { load(); }, [load]);

  const handleRemove = async (item: PersonItem) => {
    try {
      await apiFetch(deleteEndpoint(item.id), { method: "DELETE" });
      setItems((prev) => prev.filter((i) => i.id !== item.id));
    } catch (e: any) {
      Alert.alert("Ошибка", e.message);
    }
  };

  const title = isTeacher ? "Мои ученики" : "Мои дети";
  const addTitle = isTeacher ? "Добавить ученика" : "Добавить ребёнка";

  const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      paddingTop: insets.top + (Platform.OS === "web" ? 67 : 16),
      paddingHorizontal: 20, paddingBottom: 16,
      flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between",
    },
    headerText: { flex: 1 },
    titleText: { fontSize: 26, fontWeight: "800", color: colors.foreground },
    subtitleText: { fontSize: 14, color: colors.mutedForeground, marginTop: 2 },
    addBtn: {
      backgroundColor: colors.primary, borderRadius: 14,
      paddingHorizontal: 14, paddingVertical: 10,
      flexDirection: "row", alignItems: "center", gap: 6,
    },
    addBtnText: { fontSize: 14, fontWeight: "700", color: "#fff" },
    content: { paddingHorizontal: 20, paddingBottom: insets.bottom + 100 },
    empty: { alignItems: "center", paddingTop: 60, gap: 12 },
    emptyEmoji: { fontSize: 52 },
    emptyTitle: { fontSize: 18, fontWeight: "700", color: colors.foreground },
    emptyText: { fontSize: 14, color: colors.mutedForeground, textAlign: "center", lineHeight: 20 },
  });

  return (
    <View style={s.container}>
      <AddByCodeModal
        visible={modalOpen}
        onClose={() => setModalOpen(false)}
        onAdded={(item) => setItems((prev) => [...prev, item])}
        endpoint={addEndpoint}
        title={addTitle}
      />

      <View style={s.header}>
        <View style={s.headerText}>
          <Text style={s.titleText}>{title}</Text>
          <Text style={s.subtitleText}>
            {items.length > 0 ? `${items.length} чел.` : "Список пуст"}
          </Text>
        </View>
        <TouchableOpacity style={s.addBtn} onPress={() => setModalOpen(true)}>
          <Feather name="user-plus" size={16} color="#fff" />
          <Text style={s.addBtnText}>Добавить</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={s.empty}><ActivityIndicator color={colors.primary} size="large" /></View>
      ) : items.length === 0 ? (
        <View style={s.content}>
          <View style={s.empty}>
            <Text style={s.emptyEmoji}>{isTeacher ? "🎓" : "👨‍👩‍👧"}</Text>
            <Text style={s.emptyTitle}>{addTitle}</Text>
            <Text style={s.emptyText}>
              {isTeacher
                ? "Попросите ученика открыть\nПрофиль и продиктовать код"
                : "Попросите ребёнка открыть\nПрофиль и продиктовать код"}
            </Text>
            <TouchableOpacity style={[s.addBtn, { marginTop: 8 }]} onPress={() => setModalOpen(true)}>
              <Feather name="plus" size={16} color="#fff" />
              <Text style={s.addBtnText}>Добавить по коду</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => String(i.id)}
          contentContainerStyle={s.content}
          renderItem={({ item }) => (
            <UserCard item={item} colors={colors} onRemove={() => handleRemove(item)} />
          )}
        />
      )}
    </View>
  );
}
