import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, TextInput, RefreshControl, Modal,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/contexts/AuthContext";
import authStorage from "@/utils/authStorage";
import ConfirmModal from "@/components/ConfirmModal";
import { useCalendarBadge } from "@/contexts/CalendarBadgeContext";

// ── API helper ────────────────────────────────────────────────────────
const BASE_URL = process.env["EXPO_PUBLIC_DOMAIN"]
  ? `https://${process.env["EXPO_PUBLIC_DOMAIN"]}`
  : "";

async function apiFetch(path: string, options?: RequestInit) {
  const token = await authStorage.getItem("auth_token");
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token ?? ""}`,
      ...(options?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any).error ?? `HTTP ${res.status}`);
  }
  return res.json();
}

// ── Types ─────────────────────────────────────────────────────────────
type SlotBooking = {
  id: number; slotId: number; studentId: number;
  studentName: string | null; status: string; note: string | null;
};
type TeacherSlot = {
  id: number; teacherId: number; date: string;
  startTime: string; endTime: string; bookings: SlotBooking[];
};
type StudentSlot = {
  id: number; teacherId: number; teacherName: string | null;
  date: string; startTime: string; endTime: string;
  status: "available" | "pending" | "confirmed_me" | "unavailable";
  myBookingId: number | null;
};
type BookingRow = {
  id: number; slotId: number; status: string; note: string | null;
  createdAt: string; date: string | null; startTime: string | null; endTime: string | null;
  studentName?: string | null; teacherName?: string | null;
};
type CustomRequest = {
  id: number; studentId: number; teacherId: number;
  date: string; startTime: string; endTime: string;
  note: string | null; status: string; createdAt: string;
  studentName?: string | null; teacherName?: string | null;
};
type TeacherBasic = { id: number; name: string | null; username: string };

// ── Date / time helpers ───────────────────────────────────────────────
const DAY_SHORT = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
const MONTH_SHORT = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];

function localDateStr(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function todayStr() { return localDateStr(); }

function getDates(count = 35) {
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() + i);
    return localDateStr(d);
  });
}
function dateLabel(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return { day: DAY_SHORT[d.getDay()], num: d.getDate(), month: MONTH_SHORT[d.getMonth()] };
}
function formatDate(dateStr: string | null) {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  return `${d.getDate()} ${MONTH_SHORT[d.getMonth()]}`;
}

// ── Past-slot helper ──────────────────────────────────────────────────
function isPastSlot(date: string, endTime: string): boolean {
  const now = new Date();
  const todayLocal = localDateStr(now);
  if (date < todayLocal) return true;
  if (date > todayLocal) return false;
  const [h, m] = endTime.split(":").map(Number);
  const slotEnd = new Date();
  slotEnd.setHours(h, m, 0, 0);
  return slotEnd <= now;
}

// Wheel picker data
const HOURS   = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"));

const WHEEL_ITEM_H = 52;
const WHEEL_VISIBLE = 5;

// ── WheelColumn ───────────────────────────────────────────────────────
// Scrollable drum-roll column — iOS style
type WheelColumnProps = {
  items: string[]; value: string; onChange: (v: string) => void;
  fg: string; muted: string; hlColor: string;
};
function WheelColumn({ items, value, onChange, fg, muted, hlColor }: WheelColumnProps) {
  const ref = useRef<ScrollView>(null);

  const scrollTo = (i: number, animated = true) =>
    ref.current?.scrollTo({ y: i * WHEEL_ITEM_H, animated });

  // Scroll to current value on mount (without animation)
  useEffect(() => {
    const i = items.indexOf(value);
    if (i >= 0) setTimeout(() => scrollTo(i, false), 50);
  }, []);

  return (
    <View style={{ width: 70, height: WHEEL_ITEM_H * WHEEL_VISIBLE, overflow: "hidden" }}>
      {/* Selection highlight bar */}
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: WHEEL_ITEM_H * 2, height: WHEEL_ITEM_H,
          left: 0, right: 0, zIndex: 1,
          backgroundColor: hlColor,
          borderRadius: 10,
        }}
      />
      <ScrollView
        ref={ref}
        showsVerticalScrollIndicator={false}
        snapToInterval={WHEEL_ITEM_H}
        decelerationRate="fast"
        contentContainerStyle={{ paddingVertical: WHEEL_ITEM_H * 2 }}
        onMomentumScrollEnd={(e) => {
          const i = Math.round(e.nativeEvent.contentOffset.y / WHEEL_ITEM_H);
          const clamped = Math.max(0, Math.min(i, items.length - 1));
          onChange(items[clamped]);
        }}
        scrollEventThrottle={16}
      >
        {items.map((item, i) => {
          const sel = item === value;
          return (
            <TouchableOpacity
              key={item}
              style={{ height: WHEEL_ITEM_H, justifyContent: "center", alignItems: "center" }}
              onPress={() => { onChange(item); scrollTo(i); }}
              activeOpacity={0.7}
            >
              <Text style={{
                fontSize: sel ? 28 : 20,
                fontWeight: sel ? "700" : "400",
                color: sel ? fg : muted,
                opacity: sel ? 1 : 0.55,
              }}>
                {item}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const STATUS_CFG = {
  available:    { label: "Свободно",      color: "#10b981", icon: "circle"       as const },
  pending:      { label: "Ожидает",       color: "#f59e0b", icon: "clock"        as const },
  confirmed_me: { label: "Записан",       color: "#6366f1", icon: "check-circle" as const },
  unavailable:  { label: "Занято",        color: "#ef4444", icon: "x-circle"     as const },
};
const BOOKING_CFG = {
  pending:   { label: "Ожидает",       color: "#f59e0b", icon: "clock"        as const },
  confirmed: { label: "Подтверждено",  color: "#10b981", icon: "check-circle" as const },
  rejected:  { label: "Отклонено",     color: "#ef4444", icon: "x-circle"     as const },
};

const DATES = getDates(35);

// ── Component ─────────────────────────────────────────────────────────
export default function CalendarScreen() {
  const { user } = useAuth();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const isTeacherRole = user?.role === "teacher" || user?.role === "admin";
  const { markSeen } = useCalendarBadge();

  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [slots, setSlots] = useState<TeacherSlot[] | StudentSlot[]>([]);
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<"schedule" | "requests">("schedule");

  // Delete confirm
  const [deleteSlotId, setDeleteSlotId] = useState<number | null>(null);
  const scheduleScrollRef = useRef<import("react-native").ScrollView>(null);

  // Bookings filter (student)
  const [bookingFilter, setBookingFilter] = useState<"all" | "pending" | "confirmed" | "rejected">("all");

  // Add-slot modal (teacher)
  const [showAdd, setShowAdd] = useState(false);
  const [addStartH, setAddStartH] = useState("09");
  const [addStartM, setAddStartM] = useState("00");
  const [addEndH, setAddEndH] = useState("10");
  const [addEndM, setAddEndM] = useState("00");
  const [saving, setSaving] = useState(false);

  // Book-slot modal (student)
  const [bookSlot, setBookSlot] = useState<StudentSlot | null>(null);
  const [bookNote, setBookNote] = useState("");
  const [booking, setBooking] = useState(false);

  // Custom time request (student)
  const [customRequests, setCustomRequests] = useState<CustomRequest[]>([]);
  const [showCustomReq, setShowCustomReq] = useState(false);
  const [crTeachers, setCrTeachers] = useState<TeacherBasic[]>([]);
  const [crTeacherId, setCrTeacherId] = useState<number | null>(null);
  const [crStartH, setCrStartH] = useState("09");
  const [crStartM, setCrStartM] = useState("00");
  const [crEndH, setCrEndH] = useState("10");
  const [crEndM, setCrEndM] = useState("00");
  const [crNote, setCrNote] = useState("");
  const [crSaving, setCrSaving] = useState(false);
  const [crError, setCrError] = useState<string | null>(null);

  // ── Data loading ────────────────────────────────────────────────────
  const loadSlots = useCallback(async (date: string) => {
    const data = await apiFetch(`/api/calendar/slots?date=${date}`).catch(() => []);
    setSlots(data);
  }, []);

  const loadBookings = useCallback(async () => {
    const data = await apiFetch("/api/calendar/bookings").catch(() => []);
    setBookings(data);
  }, []);

  const loadCustomRequests = useCallback(async () => {
    const data = await apiFetch("/api/calendar/custom-requests").catch(() => []);
    setCustomRequests(data);
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([loadSlots(selectedDate), loadBookings(), loadCustomRequests()]).finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadSlots(selectedDate); }, [selectedDate]);

  // Auto-refresh every 30 s so past slots disappear without manual tab switch
  useEffect(() => {
    const id = setInterval(() => {
      loadSlots(selectedDate);
      loadBookings();
      loadCustomRequests();
    }, 30_000);
    return () => clearInterval(id);
  }, [selectedDate, loadSlots, loadBookings, loadCustomRequests]);

  // Also refresh when browser tab becomes visible (web)
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        loadSlots(selectedDate);
        loadBookings();
        loadCustomRequests();
      }
    };
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", onVisible);
      return () => document.removeEventListener("visibilitychange", onVisible);
    }
  }, [selectedDate, loadSlots, loadBookings, loadCustomRequests]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadSlots(selectedDate), loadBookings(), loadCustomRequests()]);
    setRefreshing(false);
  }, [selectedDate, loadSlots, loadBookings, loadCustomRequests]);

  // ── Actions ─────────────────────────────────────────────────────────
  const handleAddSlot = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await apiFetch("/api/calendar/slots", {
        method: "POST",
        body: JSON.stringify({ date: selectedDate, startTime: `${addStartH}:${addStartM}`, endTime: `${addEndH}:${addEndM}` }),
      });
      setShowAdd(false);
      await loadSlots(selectedDate);
      // Defer scroll until after React re-renders with the new slot
      setTimeout(() => scheduleScrollRef.current?.scrollTo({ y: 0, animated: false }), 50);
    } catch (e: any) { Alert.alert("Ошибка", e.message); }
    finally { setSaving(false); }
  };

  const handleDeleteSlot = (slotId: number) => setDeleteSlotId(slotId);

  const doDeleteSlot = async () => {
    if (!deleteSlotId) return;
    await apiFetch(`/api/calendar/slots/${deleteSlotId}`, { method: "DELETE" }).catch(() => {});
    setDeleteSlotId(null);
    await loadSlots(selectedDate);
  };

  const handleBookSlot = async () => {
    if (!bookSlot || booking) return;
    setBooking(true);
    try {
      await apiFetch(`/api/calendar/slots/${bookSlot.id}/book`, {
        method: "POST",
        body: JSON.stringify({ note: bookNote.trim() || undefined }),
      });
      setBookSlot(null); setBookNote("");
      await Promise.all([loadSlots(selectedDate), loadBookings()]);
    } catch (e: any) { Alert.alert("Ошибка", e.message); }
    finally { setBooking(false); }
  };

  const handleCancelBooking = async (bookingId: number) => {
    await apiFetch(`/api/calendar/bookings/${bookingId}`, { method: "DELETE" }).catch(() => {});
    await Promise.all([loadSlots(selectedDate), loadBookings()]);
  };

  const handleRespond = async (bookingId: number, status: "confirmed" | "rejected") => {
    try {
      await apiFetch(`/api/calendar/bookings/${bookingId}`, {
        method: "PATCH", body: JSON.stringify({ status }),
      });
      await Promise.all([loadSlots(selectedDate), loadBookings(), loadCustomRequests()]);
    } catch (e: any) { /* silent on web */ }
  };

  const handleRespondCustom = async (requestId: number, status: "confirmed" | "rejected") => {
    try {
      await apiFetch(`/api/calendar/custom-requests/${requestId}`, {
        method: "PATCH", body: JSON.stringify({ status }),
      });
      await Promise.all([loadSlots(selectedDate), loadBookings(), loadCustomRequests()]);
    } catch (e: any) { /* silent on web */ }
  };

  const handleOpenCustomReq = async () => {
    const teachers = await apiFetch("/api/connections/student/teachers").catch(() => []);
    setCrTeachers(teachers);
    if (teachers.length > 0) setCrTeacherId(teachers[0].id);
    setCrStartH("09"); setCrStartM("00"); setCrEndH("10"); setCrEndM("00"); setCrNote("");
    setShowCustomReq(true);
  };

  const handleSendCustomReq = async () => {
    if (!crTeacherId || crSaving) return;
    const startTime = `${crStartH}:${crStartM}`;
    const endTime   = `${crEndH}:${crEndM}`;
    if (endTime <= startTime) return;
    setCrSaving(true);
    setCrError(null);
    try {
      await apiFetch("/api/calendar/custom-requests", {
        method: "POST",
        body: JSON.stringify({ teacherId: crTeacherId, date: selectedDate, startTime, endTime, note: crNote.trim() || undefined }),
      });
      setShowCustomReq(false);
      await loadCustomRequests();
      setActiveTab("requests");
    } catch (e: any) {
      setCrError(e?.message ?? "Не удалось отправить запрос. Убедитесь, что вы подключены к учителю.");
    } finally { setCrSaving(false); }
  };

  // ── Styles ──────────────────────────────────────────────────────────
  const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: "row", alignItems: "center",
      paddingTop: insets.top + 16, paddingHorizontal: 20, paddingBottom: 12,
    },
    headerTitle: { flex: 1, fontSize: 22, fontWeight: "800", color: colors.foreground },

    tabRow: {
      flexDirection: "row", marginHorizontal: 20, marginBottom: 2,
      backgroundColor: colors.muted, borderRadius: 14, padding: 4,
    },
    tab: {
      flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: "center",
      flexDirection: "row", justifyContent: "center", gap: 6,
    },
    tabActive: { backgroundColor: colors.card },
    tabText: { fontSize: 13, fontWeight: "700", color: colors.mutedForeground },
    tabTextActive: { color: colors.primary },
    badge: {
      backgroundColor: colors.primary, borderRadius: 8,
      minWidth: 18, height: 18, justifyContent: "center", alignItems: "center", paddingHorizontal: 4,
    },
    badgeText: { fontSize: 10, fontWeight: "800", color: "#fff" },

    datePicker: { paddingHorizontal: 16, paddingVertical: 6 },
    dateChip: {
      alignItems: "center", justifyContent: "center",
      width: 46, height: 58,
      borderRadius: 12, marginHorizontal: 3, backgroundColor: colors.muted,
    },
    dateChipActive: { backgroundColor: colors.primary },
    dc_day: { fontSize: 9, fontWeight: "600", color: colors.mutedForeground },
    dc_dayA: { color: "#fff" },
    dc_num: { fontSize: 15, fontWeight: "800", color: colors.foreground, lineHeight: 18 },
    dc_numA: { color: "#fff" },
    dc_mon: { fontSize: 8, color: colors.mutedForeground, lineHeight: 11 },
    dc_monA: { color: "#ffffffcc" },

    scroll: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 120 },
    historyLabel: {
      fontSize: 12, fontWeight: "700", color: colors.mutedForeground,
      textAlign: "center", marginVertical: 12, letterSpacing: 1,
    },
    filterChip: {
      paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20,
      backgroundColor: colors.muted, borderWidth: 1, borderColor: colors.border,
    },
    filterChipActive: {
      backgroundColor: colors.primary + "18", borderColor: colors.primary,
    },
    filterChipText: { fontSize: 12, fontWeight: "600", color: colors.mutedForeground },
    filterChipTextActive: { color: colors.primary },
    emptyBox: { alignItems: "center", paddingVertical: 48, gap: 12 },
    emptyEmoji: { fontSize: 42 },
    emptyText: { fontSize: 15, color: colors.mutedForeground, textAlign: "center", lineHeight: 22 },

    slotCard: {
      borderRadius: 16, borderWidth: 1, borderColor: colors.border,
      backgroundColor: colors.card, marginBottom: 12, overflow: "hidden",
    },
    slotTop: { flexDirection: "row", alignItems: "center", padding: 14, gap: 12 },
    slotDot: { width: 12, height: 12, borderRadius: 6 },
    slotTime: { flex: 1, fontSize: 17, fontWeight: "700", color: colors.foreground },
    slotSub: { fontSize: 12, color: colors.mutedForeground, marginTop: 1 },

    bookingRow: {
      flexDirection: "row", alignItems: "center", gap: 10,
      paddingHorizontal: 14, paddingVertical: 11,
      borderTopWidth: 1, borderTopColor: colors.border,
    },
    bookingName: { fontWeight: "700", fontSize: 14, color: colors.foreground },
    bookingNote: { fontSize: 12, color: colors.mutedForeground, marginTop: 2, fontStyle: "italic" },

    btnRow: { flexDirection: "row", gap: 8 },
    btnConfirm: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10, backgroundColor: "#10b981" },
    btnReject:  { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10, backgroundColor: "#ef4444" },
    btnCancel:  {
      paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10,
      borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.muted,
    },
    btnText: { fontSize: 13, fontWeight: "700", color: "#fff" },
    btnTextGray: { fontSize: 13, fontWeight: "700", color: colors.mutedForeground },

    addBtn: {
      flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
      borderRadius: 16, borderWidth: 2, borderStyle: "dashed", borderColor: colors.primary,
      padding: 16, marginTop: 4,
    },
    addBtnText: { fontSize: 15, fontWeight: "700", color: colors.primary },

    statusLabel: { fontSize: 12, fontWeight: "700" },

    // Modals
    overlay: { flex: 1, backgroundColor: "#00000070", justifyContent: "flex-end" },
    sheet: {
      backgroundColor: colors.card,
      borderTopLeftRadius: 24, borderTopRightRadius: 24,
      paddingTop: 12, paddingHorizontal: 20, paddingBottom: insets.bottom + 24,
    },
    handle: {
      width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border,
      alignSelf: "center", marginBottom: 18,
    },
    sheetTitle: { fontSize: 18, fontWeight: "800", color: colors.foreground, marginBottom: 18 },
    timeLabel: { fontSize: 11, fontWeight: "700", color: colors.mutedForeground, marginBottom: 12, textTransform: "uppercase", letterSpacing: 0.5, textAlign: "center" },
    wheelRow: { flexDirection: "row", alignItems: "center" },
    wheelColon: { fontSize: 32, fontWeight: "700", color: colors.foreground, marginHorizontal: 2, lineHeight: WHEEL_ITEM_H * WHEEL_VISIBLE },
    primaryBtn: {
      backgroundColor: colors.primary, borderRadius: 16, paddingVertical: 15,
      alignItems: "center", marginTop: 12,
    },
    primaryBtnText: { fontSize: 16, fontWeight: "700", color: colors.primaryForeground },
    noteInput: {
      borderWidth: 1.5, borderColor: colors.border, borderRadius: 12,
      padding: 12, fontSize: 14, color: colors.foreground,
      backgroundColor: colors.muted, minHeight: 64, textAlignVertical: "top", marginBottom: 4,
    },

    // Request / booking cards
    reqCard: {
      borderRadius: 16, borderWidth: 1, borderColor: colors.border,
      backgroundColor: colors.card, marginBottom: 12, padding: 14, gap: 10,
    },
    reqTop: { flexDirection: "row", alignItems: "center", gap: 12 },
    reqAvatar: {
      width: 40, height: 40, borderRadius: 12, justifyContent: "center", alignItems: "center",
    },
    reqName: { flex: 1, fontSize: 15, fontWeight: "700", color: colors.foreground },
    reqTime: { fontSize: 12, color: colors.mutedForeground, marginTop: 2 },
    reqNote: { fontSize: 13, color: colors.mutedForeground, fontStyle: "italic" },
  });

  // ── Date strip ──────────────────────────────────────────────────────
  const renderDatePicker = () => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.datePicker}>
      {DATES.map((date) => {
        const { day, num, month } = dateLabel(date);
        const active = date === selectedDate;
        return (
          <TouchableOpacity
            key={date} style={[s.dateChip, active && s.dateChipActive]}
            onPress={() => setSelectedDate(date)}
          >
            <Text style={[s.dc_day, active && s.dc_dayA]}>{day}</Text>
            <Text style={[s.dc_num, active && s.dc_numA]}>{num}</Text>
            <Text style={[s.dc_mon, active && s.dc_monA]}>{month}</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );

  // ── Reusable slot card (teacher) ────────────────────────────────────
  const renderTeacherSlotCard = (slot: TeacherSlot, dimmed = false) => {
    const pending = slot.bookings.filter((b) => b.status === "pending");
    const confirmed = slot.bookings.find((b) => b.status === "confirmed");
    const isBusy = !!confirmed;
    const borderColor = dimmed ? colors.border : (isBusy ? "#ef4444" : "#10b981");
    const dotColor   = dimmed ? colors.mutedForeground : borderColor;
    return (
      <View key={slot.id} style={[s.slotCard, { borderLeftWidth: 4, borderLeftColor: borderColor, opacity: dimmed ? 0.55 : 1 }]}>
        <View style={s.slotTop}>
          <View style={[s.slotDot, { backgroundColor: dotColor }]} />
          <View style={{ flex: 1 }}>
            <Text style={s.slotTime}>{slot.startTime} – {slot.endTime}</Text>
            <Text style={s.slotSub}>
              {dimmed ? "Завершён" : isBusy ? "Занято" : "Свободно"}
            </Text>
          </View>
          {!dimmed && pending.length > 0 && (
            <View style={s.badge}><Text style={s.badgeText}>{pending.length}</Text></View>
          )}
          <TouchableOpacity onPress={() => handleDeleteSlot(slot.id)} style={{ padding: 4 }}>
            <Feather name="trash-2" size={17} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>

        {confirmed && (
          <View style={s.bookingRow}>
            <Feather name="check-circle" size={16} color="#10b981" />
            <View style={{ flex: 1 }}>
              <Text style={s.bookingName}>{confirmed.studentName ?? "Ученик"}</Text>
              {confirmed.note ? <Text style={s.bookingNote}>«{confirmed.note}»</Text> : null}
            </View>
            <Text style={[s.statusLabel, { color: "#10b981" }]}>Подтверждено</Text>
          </View>
        )}

        {!dimmed && pending.map((b) => (
          <View key={b.id} style={s.bookingRow}>
            <Feather name="user" size={16} color={colors.mutedForeground} />
            <View style={{ flex: 1 }}>
              <Text style={s.bookingName}>{b.studentName ?? "Ученик"}</Text>
              {b.note ? <Text style={s.bookingNote}>«{b.note}»</Text> : null}
            </View>
            <View style={s.btnRow}>
              <TouchableOpacity style={s.btnConfirm} onPress={() => handleRespond(b.id, "confirmed")}>
                <Text style={s.btnText}>✓</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.btnReject} onPress={() => handleRespond(b.id, "rejected")}>
                <Text style={s.btnText}>✗</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </View>
    );
  };

  // ── Teacher: schedule tab ───────────────────────────────────────────
  const renderTeacherSchedule = () => {
    const daySlots = slots as TeacherSlot[];
    const active = daySlots.filter((s) => !isPastSlot(s.date, s.endTime));
    const past   = daySlots.filter((s) =>  isPastSlot(s.date, s.endTime));
    return (
      <ScrollView
        ref={scheduleScrollRef}
        contentContainerStyle={s.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
      >
        {active.length === 0 && past.length === 0 && (
          <View style={s.emptyBox}>
            <Text style={s.emptyEmoji}>📅</Text>
            <Text style={s.emptyText}>Нет слотов на {formatDate(selectedDate)}{"\n"}Добавьте время для занятий</Text>
          </View>
        )}
        {active.length === 0 && past.length > 0 && (
          <View style={s.emptyBox}>
            <Text style={s.emptyEmoji}>✅</Text>
            <Text style={s.emptyText}>Все занятия сегодня завершены</Text>
          </View>
        )}

        {active.map((slot) => renderTeacherSlotCard(slot, false))}

        {past.length > 0 && (
          <>
            <Text style={s.historyLabel}>— История —</Text>
            {past.map((slot) => renderTeacherSlotCard(slot, true))}
          </>
        )}

        <TouchableOpacity style={s.addBtn} onPress={() => setShowAdd(true)}>
          <Feather name="plus-circle" size={18} color={colors.primary} />
          <Text style={s.addBtnText}>Добавить слот</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  };

  // ── Teacher: requests tab ───────────────────────────────────────────
  const renderTeacherRequests = () => {
    const totalCount = bookings.length + customRequests.length;
    return (
      <ScrollView
        contentContainerStyle={s.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
      >
        {totalCount === 0 && (
          <View style={s.emptyBox}>
            <Text style={s.emptyEmoji}>🎉</Text>
            <Text style={s.emptyText}>Нет новых запросов</Text>
          </View>
        )}

        {/* Regular slot bookings */}
        {bookings.map((b) => (
          <View key={`sb-${b.id}`} style={s.reqCard}>
            <View style={s.reqTop}>
              <View style={[s.reqAvatar, { backgroundColor: colors.primary + "20" }]}>
                <Feather name="user" size={18} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.reqName}>{b.studentName ?? "Ученик"}</Text>
                <Text style={s.reqTime}>{formatDate(b.date)}, {b.startTime} – {b.endTime}</Text>
              </View>
            </View>
            {b.note ? <Text style={s.reqNote}>«{b.note}»</Text> : null}
            <View style={s.btnRow}>
              <TouchableOpacity style={[s.btnConfirm, { flex: 1, alignItems: "center" }]} onPress={() => handleRespond(b.id, "confirmed")}>
                <Text style={s.btnText}>Подтвердить</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.btnReject, { flex: 1, alignItems: "center" }]} onPress={() => handleRespond(b.id, "rejected")}>
                <Text style={s.btnText}>Отклонить</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}

        {/* Custom time requests from students */}
        {customRequests.length > 0 && bookings.length > 0 && (
          <Text style={s.historyLabel}>— Запросы своего времени —</Text>
        )}
        {customRequests.map((cr) => (
          <View key={`cr-${cr.id}`} style={[s.reqCard, { borderLeftWidth: 3, borderLeftColor: "#8b5cf6" }]}>
            <View style={s.reqTop}>
              <View style={[s.reqAvatar, { backgroundColor: "#8b5cf620" }]}>
                <Feather name="clock" size={18} color="#8b5cf6" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.reqName}>{cr.studentName ?? "Ученик"}</Text>
                <Text style={s.reqTime}>{formatDate(cr.date)}, {cr.startTime} – {cr.endTime}</Text>
                <Text style={[s.reqTime, { color: "#8b5cf6", fontSize: 11 }]}>Предлагает своё время</Text>
              </View>
            </View>
            {cr.note ? <Text style={s.reqNote}>«{cr.note}»</Text> : null}
            <View style={s.btnRow}>
              <TouchableOpacity style={[s.btnConfirm, { flex: 1, alignItems: "center" }]} onPress={() => handleRespondCustom(cr.id, "confirmed")}>
                <Text style={s.btnText}>Принять</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.btnReject, { flex: 1, alignItems: "center" }]} onPress={() => handleRespondCustom(cr.id, "rejected")}>
                <Text style={s.btnText}>Отклонить</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </ScrollView>
    );
  };

  // ── Student: schedule tab ───────────────────────────────────────────
  const renderStudentSchedule = () => {
    const daySlots = slots as StudentSlot[];
    const active = daySlots.filter((sl) => !isPastSlot(sl.date, sl.endTime));
    const past   = daySlots.filter((sl) =>  isPastSlot(sl.date, sl.endTime));
    return (
      <ScrollView
        contentContainerStyle={s.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
      >
        {active.length === 0 && past.length === 0 && (
          <View style={s.emptyBox}>
            <Text style={s.emptyEmoji}>📅</Text>
            <Text style={s.emptyText}>Нет доступных слотов на {formatDate(selectedDate)}</Text>
          </View>
        )}
        {active.length === 0 && past.length > 0 && (
          <View style={s.emptyBox}>
            <Text style={s.emptyEmoji}>✅</Text>
            <Text style={s.emptyText}>Все занятия сегодня завершены</Text>
          </View>
        )}

        {active.map((slot) => {
          const meta = STATUS_CFG[slot.status];
          return (
            <View key={slot.id} style={[s.slotCard, { borderLeftWidth: 4, borderLeftColor: meta.color }]}>
              <View style={s.slotTop}>
                <View style={[s.slotDot, { backgroundColor: meta.color }]} />
                <View style={{ flex: 1 }}>
                  <Text style={s.slotTime}>{slot.startTime} – {slot.endTime}</Text>
                  {slot.teacherName && <Text style={s.slotSub}>{slot.teacherName}</Text>}
                </View>
                <Text style={[s.statusLabel, { color: meta.color }]}>{meta.label}</Text>
              </View>

              {slot.status === "available" && (
                <TouchableOpacity
                  style={[s.btnConfirm, { margin: 12, marginTop: 0, alignItems: "center" }]}
                  onPress={() => setBookSlot(slot)}
                >
                  <Text style={s.btnText}>Записаться</Text>
                </TouchableOpacity>
              )}

              {slot.status === "pending" && slot.myBookingId && (
                <TouchableOpacity
                  style={[s.btnCancel, { margin: 12, marginTop: 0, alignItems: "center" }]}
                  onPress={() => handleCancelBooking(slot.myBookingId!)}
                >
                  <Text style={s.btnTextGray}>Отменить запрос</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })}

        {past.length > 0 && (
          <>
            <Text style={s.historyLabel}>— История —</Text>
            {past.map((slot) => {
              const meta = STATUS_CFG[slot.status];
              return (
                <View key={slot.id} style={[s.slotCard, { borderLeftWidth: 4, borderLeftColor: colors.border, opacity: 0.5 }]}>
                  <View style={s.slotTop}>
                    <View style={[s.slotDot, { backgroundColor: colors.mutedForeground }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={s.slotTime}>{slot.startTime} – {slot.endTime}</Text>
                      {slot.teacherName && <Text style={s.slotSub}>{slot.teacherName}</Text>}
                    </View>
                    <Text style={[s.statusLabel, { color: meta.color }]}>{meta.label}</Text>
                  </View>
                </View>
              );
            })}
          </>
        )}

        {/* Button to request custom time */}
        <TouchableOpacity style={[s.addBtn, { borderColor: "#8b5cf6" }]} onPress={handleOpenCustomReq}>
          <Feather name="clock" size={18} color="#8b5cf6" />
          <Text style={[s.addBtnText, { color: "#8b5cf6" }]}>Предложить своё время</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  };

  // ── Student: my bookings tab ────────────────────────────────────────
  const renderStudentBookings = () => {
    const FILTERS: { key: "all"|"pending"|"confirmed"|"rejected"; label: string }[] = [
      { key: "all",      label: "Все"         },
      { key: "pending",  label: "В ожидании"  },
      { key: "confirmed",label: "Выполнено"   },
      { key: "rejected", label: "Отклонённые" },
    ];

    const sorted = [...bookings].sort((a, b) => {
      const da = (a.date ?? "") + (a.startTime ?? "");
      const db = (b.date ?? "") + (b.startTime ?? "");
      return da.localeCompare(db);
    });

    const filtered = bookingFilter === "all"
      ? sorted
      : sorted.filter((b) => b.status === bookingFilter);

    const upcoming = filtered.filter((b) => !isPastSlot(b.date ?? "", b.endTime ?? ""));
    const past     = filtered.filter((b) =>  isPastSlot(b.date ?? "", b.endTime ?? ""));

    const renderBookingCard = (b: BookingRow, isPast: boolean) => {
      const cfg = BOOKING_CFG[b.status as keyof typeof BOOKING_CFG];
      const isRejected = b.status === "rejected";
      // Rejected bookings always shown prominently in red, never treated as generic "Завершено"
      const cardColor = isRejected ? "#ef4444" : isPast ? colors.border : (cfg?.color ?? colors.border);
      const iconColor = isRejected ? "#ef4444" : isPast ? colors.mutedForeground : (cfg?.color ?? colors.primary);
      const statusLabel = isRejected ? "Отклонено" : isPast ? "Завершено" : (cfg?.label ?? b.status);
      const statusColor = isRejected ? "#ef4444" : isPast ? colors.mutedForeground : (cfg?.color ?? colors.mutedForeground);
      return (
        <View
          key={b.id}
          style={[
            s.reqCard,
            { borderLeftWidth: 4, borderLeftColor: cardColor },
            isPast && !isRejected && { opacity: 0.5 },
          ]}
        >
          <View style={s.reqTop}>
            <View style={[s.reqAvatar, { backgroundColor: iconColor + "20" }]}>
              <Feather name={cfg?.icon ?? "calendar"} size={18} color={iconColor} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.reqName}>{b.teacherName ?? "Учитель"}</Text>
              <Text style={s.reqTime}>{formatDate(b.date)}, {b.startTime} – {b.endTime}</Text>
            </View>
            <Text style={[s.statusLabel, { color: statusColor }]}>{statusLabel}</Text>
          </View>
          {b.note ? <Text style={s.reqNote}>«{b.note}»</Text> : null}
          {isRejected && (
            <Text style={{ fontSize: 12, color: "#ef4444", marginHorizontal: 12, marginBottom: 10, fontStyle: "italic" }}>
              Учитель отклонил вашу запись
            </Text>
          )}
        </View>
      );
    };

    return (
      <ScrollView
        contentContainerStyle={s.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
      >
        {/* Filter chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {FILTERS.map((f) => {
              const active = bookingFilter === f.key;
              return (
                <TouchableOpacity
                  key={f.key}
                  onPress={() => setBookingFilter(f.key)}
                  style={[s.filterChip, active && s.filterChipActive]}
                >
                  <Text style={[s.filterChipText, active && s.filterChipTextActive]}>{f.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>

        {upcoming.length === 0 && past.length === 0 && (
          <View style={s.emptyBox}>
            <Text style={s.emptyEmoji}>📝</Text>
            <Text style={s.emptyText}>
              {bookingFilter === "all"
                ? "Нет записей\nПерейдите в расписание и запишитесь к учителю"
                : "Нет записей с таким статусом"}
            </Text>
          </View>
        )}

        {upcoming.map((b) => renderBookingCard(b, false))}

        {past.length > 0 && (
          <>
            <Text style={s.historyLabel}>— История занятий —</Text>
            {past.map((b) => renderBookingCard(b, true))}
          </>
        )}

        {/* Custom time requests sent by student */}
        {bookingFilter === "all" && customRequests.length > 0 && (
          <>
            <Text style={s.historyLabel}>— Предложения своего времени —</Text>
            {customRequests.map((cr) => {
              const isPastCr = isPastSlot(cr.date, cr.endTime);
              const isRejCr = cr.status === "rejected";
              const crColor = cr.status === "confirmed" ? "#10b981" : isRejCr ? "#ef4444" : "#8b5cf6";
              const crLabel = cr.status === "confirmed" ? "Принято" : isRejCr ? "Отклонено" : "Ожидает";
              return (
                <View
                  key={`cr-${cr.id}`}
                  style={[s.reqCard, { borderLeftWidth: 4, borderLeftColor: crColor }, isPastCr && !isRejCr && { opacity: 0.5 }]}
                >
                  <View style={s.reqTop}>
                    <View style={[s.reqAvatar, { backgroundColor: crColor + "20" }]}>
                      <Feather name="clock" size={18} color={crColor} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.reqName}>{cr.teacherName ?? "Учитель"}</Text>
                      <Text style={s.reqTime}>{formatDate(cr.date)}, {cr.startTime} – {cr.endTime}</Text>
                      <Text style={[s.reqTime, { fontSize: 11, color: "#8b5cf6" }]}>Мой запрос на время</Text>
                    </View>
                    <Text style={[s.statusLabel, { color: crColor }]}>{crLabel}</Text>
                  </View>
                  {cr.note ? <Text style={s.reqNote}>«{cr.note}»</Text> : null}
                  {isRejCr && (
                    <Text style={{ fontSize: 12, color: "#ef4444", marginHorizontal: 12, marginBottom: 10, fontStyle: "italic" }}>
                      Учитель отклонил ваш запрос на время
                    </Text>
                  )}
                </View>
              );
            })}
          </>
        )}
      </ScrollView>
    );
  };

  // ── Add-slot modal (teacher) ────────────────────────────────────────
  const addStart = `${addStartH}:${addStartM}`;
  const addEnd   = `${addEndH}:${addEndM}`;
  const renderAddSlotModal = () => (
    <Modal visible={showAdd} transparent animationType="slide" onRequestClose={() => setShowAdd(false)}>
      <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={() => setShowAdd(false)}>
        <TouchableOpacity style={s.sheet} activeOpacity={1}>
          <View style={s.handle} />
          <Text style={s.sheetTitle}>Добавить слот — {formatDate(selectedDate)}</Text>

          {/* Time pickers row */}
          <View style={{ flexDirection: "row", justifyContent: "space-around", marginBottom: 20 }}>
            {/* Start time */}
            <View style={{ alignItems: "center" }}>
              <Text style={s.timeLabel}>Начало</Text>
              <View style={s.wheelRow}>
                <WheelColumn
                  items={HOURS} value={addStartH} onChange={setAddStartH}
                  fg={colors.foreground} muted={colors.mutedForeground}
                  hlColor={colors.primary + "28"}
                />
                <Text style={s.wheelColon}>:</Text>
                <WheelColumn
                  items={MINUTES} value={addStartM} onChange={setAddStartM}
                  fg={colors.foreground} muted={colors.mutedForeground}
                  hlColor={colors.primary + "28"}
                />
              </View>
            </View>

            {/* Divider */}
            <View style={{ width: 1, backgroundColor: colors.border, marginHorizontal: 4 }} />

            {/* End time */}
            <View style={{ alignItems: "center" }}>
              <Text style={s.timeLabel}>Конец</Text>
              <View style={s.wheelRow}>
                <WheelColumn
                  items={HOURS} value={addEndH} onChange={setAddEndH}
                  fg={colors.foreground} muted={colors.mutedForeground}
                  hlColor={colors.primary + "28"}
                />
                <Text style={s.wheelColon}>:</Text>
                <WheelColumn
                  items={MINUTES} value={addEndM} onChange={setAddEndM}
                  fg={colors.foreground} muted={colors.mutedForeground}
                  hlColor={colors.primary + "28"}
                />
              </View>
            </View>
          </View>

          {addEnd <= addStart && (
            <Text style={{ color: "#ef4444", fontSize: 13, fontWeight: "600", textAlign: "center", marginBottom: 8 }}>
              ⚠ Конец раньше начала: {addStart} → {addEnd}
            </Text>
          )}
          {addEnd > addStart && isPastSlot(selectedDate, addEnd) && (
            <Text style={{ color: "#f59e0b", fontSize: 13, fontWeight: "600", textAlign: "center", marginBottom: 8 }}>
              ⚠ Это время уже прошло — слот не сохранится
            </Text>
          )}
          <TouchableOpacity
            style={[s.primaryBtn, (addEnd <= addStart || (addEnd > addStart && isPastSlot(selectedDate, addEnd))) && { opacity: 0.4 }]}
            onPress={handleAddSlot}
            disabled={saving || addEnd <= addStart || isPastSlot(selectedDate, addEnd)}
          >
            {saving
              ? <ActivityIndicator color="#fff" />
              : <Text style={s.primaryBtnText}>Добавить {addStart} – {addEnd}</Text>
            }
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );

  // ── Custom time request modal (student) ────────────────────────────
  const crStart = `${crStartH}:${crStartM}`;
  const crEnd   = `${crEndH}:${crEndM}`;
  const renderCustomReqModal = () => (
    <Modal visible={showCustomReq} transparent animationType="slide" onRequestClose={() => setShowCustomReq(false)}>
      <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={() => setShowCustomReq(false)}>
        <TouchableOpacity style={s.sheet} activeOpacity={1}>
          <View style={s.handle} />
          <Text style={s.sheetTitle}>Предложить своё время{"\n"}{formatDate(selectedDate)}</Text>

          {/* Teacher selector */}
          {crTeachers.length > 1 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {crTeachers.map((t) => {
                  const active = crTeacherId === t.id;
                  return (
                    <TouchableOpacity
                      key={t.id}
                      onPress={() => setCrTeacherId(t.id)}
                      style={[s.filterChip, active && { backgroundColor: "#8b5cf620", borderColor: "#8b5cf6" }]}
                    >
                      <Text style={[s.filterChipText, active && { color: "#8b5cf6" }]}>{t.name ?? t.username}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
          )}
          {crTeachers.length === 0 && (
            <Text style={{ color: colors.mutedForeground, textAlign: "center", marginBottom: 16 }}>
              Нет подключённых учителей
            </Text>
          )}
          {crTeachers.length === 1 && (
            <Text style={{ color: colors.mutedForeground, marginBottom: 12, fontSize: 14 }}>
              Учитель: {crTeachers[0].name ?? crTeachers[0].username}
            </Text>
          )}

          {/* Time pickers */}
          <View style={{ flexDirection: "row", justifyContent: "space-around", marginBottom: 16 }}>
            <View style={{ alignItems: "center" }}>
              <Text style={s.timeLabel}>Начало</Text>
              <View style={s.wheelRow}>
                <WheelColumn items={HOURS}   value={crStartH} onChange={setCrStartH} fg={colors.foreground} muted={colors.mutedForeground} hlColor={"#8b5cf628"} />
                <Text style={s.wheelColon}>:</Text>
                <WheelColumn items={MINUTES} value={crStartM} onChange={setCrStartM} fg={colors.foreground} muted={colors.mutedForeground} hlColor={"#8b5cf628"} />
              </View>
            </View>
            <View style={{ width: 1, backgroundColor: colors.border, marginHorizontal: 4 }} />
            <View style={{ alignItems: "center" }}>
              <Text style={s.timeLabel}>Конец</Text>
              <View style={s.wheelRow}>
                <WheelColumn items={HOURS}   value={crEndH} onChange={setCrEndH} fg={colors.foreground} muted={colors.mutedForeground} hlColor={"#8b5cf628"} />
                <Text style={s.wheelColon}>:</Text>
                <WheelColumn items={MINUTES} value={crEndM} onChange={setCrEndM} fg={colors.foreground} muted={colors.mutedForeground} hlColor={"#8b5cf628"} />
              </View>
            </View>
          </View>

          {crEnd <= crStart && (
            <Text style={{ color: "#ef4444", fontSize: 13, fontWeight: "600", textAlign: "center", marginBottom: 8 }}>
              ⚠ Конец раньше начала: {crStart} → {crEnd}
            </Text>
          )}
          {crEnd > crStart && isPastSlot(selectedDate, crEnd) && (
            <Text style={{ color: "#f59e0b", fontSize: 13, fontWeight: "600", textAlign: "center", marginBottom: 8 }}>
              ⚠ Это время уже прошло — выберите будущее время
            </Text>
          )}

          <Text style={[s.timeLabel, { marginBottom: 8 }]}>Сообщение учителю (необязательно)</Text>
          <TextInput
            style={s.noteInput}
            placeholder="Например: хочу разобрать Present Perfect..."
            placeholderTextColor={colors.mutedForeground}
            value={crNote} onChangeText={setCrNote}
            multiline returnKeyType="done"
          />

          {crError && (
            <View style={{ backgroundColor: "#fee2e2", borderRadius: 10, padding: 10, marginBottom: 10 }}>
              <Text style={{ color: "#dc2626", fontSize: 13, textAlign: "center" }}>⚠ {crError}</Text>
            </View>
          )}

          <TouchableOpacity
            style={[s.primaryBtn, { backgroundColor: "#8b5cf6" }, (crEnd <= crStart || isPastSlot(selectedDate, crEnd) || !crTeacherId || crSaving) && { opacity: 0.4 }]}
            onPress={handleSendCustomReq}
            disabled={crEnd <= crStart || isPastSlot(selectedDate, crEnd) || !crTeacherId || crSaving}
          >
            {crSaving
              ? <ActivityIndicator color="#fff" />
              : <Text style={s.primaryBtnText}>Отправить запрос {crStart} – {crEnd}</Text>
            }
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );

  // ── Book-slot modal (student) ───────────────────────────────────────
  const renderBookModal = () => (
    <Modal visible={!!bookSlot} transparent animationType="slide" onRequestClose={() => setBookSlot(null)}>
      <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={() => setBookSlot(null)}>
        <TouchableOpacity style={s.sheet} activeOpacity={1}>
          <View style={s.handle} />
          <Text style={s.sheetTitle}>
            Запись на {formatDate(bookSlot?.date ?? null)}{"\n"}{bookSlot?.startTime} – {bookSlot?.endTime}
          </Text>
          <Text style={[s.timeLabel, { marginBottom: 8 }]}>Сообщение учителю (необязательно)</Text>
          <TextInput
            style={s.noteInput}
            placeholder="Например: хочу разобрать Present Perfect..."
            placeholderTextColor={colors.mutedForeground}
            value={bookNote} onChangeText={setBookNote}
            multiline returnKeyType="done"
          />
          <TouchableOpacity style={s.primaryBtn} onPress={handleBookSlot} disabled={booking}>
            {booking ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryBtnText}>Отправить запрос</Text>}
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );

  const pendingCount = isTeacherRole ? bookings.length + customRequests.length : 0;

  return (
    <View style={s.container}>
      {renderAddSlotModal()}
      {renderCustomReqModal()}
      {renderBookModal()}
      <ConfirmModal
        visible={deleteSlotId !== null}
        title="Удалить слот?"
        message="Вы действительно хотите удалить этот слот?"
        confirmText="Удалить"
        destructive
        onConfirm={doDeleteSlot}
        onCancel={() => setDeleteSlotId(null)}
      />

      <View style={s.header}>
        <Text style={s.headerTitle}>Календарь</Text>
      </View>

      <View style={s.tabRow}>
        <TouchableOpacity style={[s.tab, activeTab === "schedule" && s.tabActive]} onPress={() => setActiveTab("schedule")}>
          <Feather name="calendar" size={14} color={activeTab === "schedule" ? colors.primary : colors.mutedForeground} />
          <Text style={[s.tabText, activeTab === "schedule" && s.tabTextActive]}>Расписание</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.tab, activeTab === "requests" && s.tabActive]} onPress={() => { setActiveTab("requests"); loadBookings(); loadCustomRequests(); if (isTeacherRole) markSeen(); }}>
          <Feather name={isTeacherRole ? "inbox" : "list"} size={14} color={activeTab === "requests" ? colors.primary : colors.mutedForeground} />
          <Text style={[s.tabText, activeTab === "requests" && s.tabTextActive]}>
            {isTeacherRole ? "Запросы" : "Мои записи"}
          </Text>
          {pendingCount > 0 && <View style={s.badge}><Text style={s.badgeText}>{pendingCount}</Text></View>}
        </TouchableOpacity>
      </View>

      {activeTab === "schedule" && renderDatePicker()}

      {loading
        ? <ActivityIndicator style={{ marginTop: 48 }} color={colors.primary} size="large" />
        : activeTab === "schedule"
          ? isTeacherRole ? renderTeacherSchedule() : renderStudentSchedule()
          : isTeacherRole ? renderTeacherRequests() : renderStudentBookings()
      }
    </View>
  );
}
