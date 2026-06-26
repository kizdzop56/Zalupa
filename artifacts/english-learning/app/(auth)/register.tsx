import React, { useState, useMemo } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Platform, KeyboardAvoidingView,
  FlatList,
} from "react-native";
import { useRouter } from "expo-router";
import { useColors } from "@/hooks/useColors";
import { useAuth, LEVEL_META } from "@/contexts/AuthContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";

type Role = "student" | "parent" | "teacher";
type Step = "role" | "details" | "dob";

const MONTHS_RU = [
  "Январь","Февраль","Март","Апрель","Май","Июнь",
  "Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь",
];

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 14 }, (_, i) => CURRENT_YEAR - 5 - i); // 18 down to 5 years old
const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);

function calculateAge(day: number, month: number, year: number): number {
  const today = new Date();
  const dob = new Date(year, month, day);
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
  return age;
}

function getLevel(age: number) {
  if (age <= 6) return "starter";
  if (age <= 9) return "beginner";
  if (age <= 12) return "elementary";
  if (age <= 15) return "intermediate";
  return "upper_intermediate";
}

interface WheelPickerProps {
  items: (string | number)[];
  selected: number;
  onSelect: (i: number) => void;
  width?: number;
  colors: ReturnType<typeof useColors>;
}

function WheelPicker({ items, selected, onSelect, width = 90, colors }: WheelPickerProps) {
  const ITEM_H = 44;
  return (
    <View style={{ width, height: ITEM_H * 3, overflow: "hidden", borderRadius: 12, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_H}
        decelerationRate="fast"
        contentContainerStyle={{ paddingVertical: ITEM_H }}
        onMomentumScrollEnd={(e) => {
          const idx = Math.round(e.nativeEvent.contentOffset.y / ITEM_H);
          onSelect(Math.max(0, Math.min(idx, items.length - 1)));
        }}
        contentOffset={{ x: 0, y: selected * ITEM_H }}
      >
        {items.map((item, i) => (
          <TouchableOpacity
            key={i}
            style={{ height: ITEM_H, justifyContent: "center", alignItems: "center" }}
            onPress={() => onSelect(i)}
          >
            <Text style={{
              fontSize: i === selected ? 18 : 15,
              fontWeight: i === selected ? "800" : "400",
              color: i === selected ? colors.primary : colors.mutedForeground,
            }}>
              {String(item).padStart(typeof item === "number" && item < 100 ? 2 : 0, "0")}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      {/* Highlight line */}
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { justifyContent: "center" }]}>
        <View style={{ height: ITEM_H, borderTopWidth: 1.5, borderBottomWidth: 1.5, borderColor: colors.primary + "60" }} />
      </View>
    </View>
  );
}

export default function RegisterScreen() {
  const colors = useColors();
  const { login } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [step, setStep] = useState<Step>("role");
  const [role, setRole] = useState<Role | null>(null);
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // DOB state
  const [dayIdx, setDayIdx] = useState(0);
  const [monthIdx, setMonthIdx] = useState(0);
  const [yearIdx, setYearIdx] = useState(0);

  const selectedDay = DAYS[dayIdx] ?? 1;
  const selectedMonth = monthIdx; // 0-indexed
  const selectedYear = YEARS[yearIdx] ?? YEARS[0];

  const age = useMemo(
    () => calculateAge(selectedDay, selectedMonth, selectedYear ?? CURRENT_YEAR),
    [selectedDay, selectedMonth, selectedYear]
  );
  const levelKey = useMemo(() => (age >= 5 && age <= 18 ? getLevel(age) : null), [age]);
  const levelMeta = levelKey ? LEVEL_META[levelKey as keyof typeof LEVEL_META] : null;

  const ROLES = [
    {
      key: "student" as Role,
      icon: "book-open",
      label: "Ученик",
      desc: "Выполняю задания и учу английский",
      bgColor: "#ede9fe",
      iconColor: "#7c3aed",
    },
    {
      key: "parent" as Role,
      icon: "users",
      label: "Родитель",
      desc: "Слежу за прогрессом ребёнка",
      bgColor: "#e0f2fe",
      iconColor: "#0369a1",
    },
    {
      key: "teacher" as Role,
      icon: "award",
      label: "Учитель",
      desc: "Создаю задания и управляю учениками",
      bgColor: "#fef3c7",
      iconColor: "#b45309",
    },
  ];

  const goBack = () => {
    setError("");
    if (step === "dob") setStep("details");
    else if (step === "details") setStep("role");
  };

  const handleRoleSelect = (r: Role) => {
    setRole(r);
    setError("");
    setStep("details");
  };

  const handleDetailsNext = () => {
    if (!name.trim()) { setError("Введите ваше имя"); return; }
    if (!username.trim()) { setError("Введите имя пользователя"); return; }
    if (password.length < 6) { setError("Пароль должен содержать не менее 6 символов"); return; }
    setError("");
    if (role === "student") {
      setStep("dob");
    } else {
      handleSubmit();
    }
  };

  const handleSubmit = async (overrideAge?: number) => {
    if (role === "student" && (age < 5 || age > 18)) {
      setError("Возраст ученика должен быть от 5 до 18 лет");
      return;
    }

    setLoading(true);
    setError("");

    const dobStr = role === "student"
      ? `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}-${String(selectedDay).padStart(2, "0")}`
      : undefined;

    const baseUrl = process.env["EXPO_PUBLIC_DOMAIN"]
      ? `https://${process.env["EXPO_PUBLIC_DOMAIN"]}`
      : "";

    try {
      const body: Record<string, unknown> = {
        username: username.trim(),
        password,
        name: name.trim(),
        role,
      };
      if (dobStr) body.dateOfBirth = dobStr;

      const response = await fetch(`${baseUrl}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Ошибка регистрации");
        return;
      }
      await login(data.token, data.user);
      router.replace("/(main)/assignments");
    } catch {
      setError("Ошибка соединения. Попробуйте снова.");
    } finally {
      setLoading(false);
    }
  };

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    scroll: { flexGrow: 1 },
    content: {
      flex: 1, paddingHorizontal: 24,
      paddingTop: insets.top + 20,
      paddingBottom: insets.bottom + 32,
    },
    backRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 24 },
    backText: { fontSize: 15, color: colors.primary, fontWeight: "600" },
    pageTitle: { fontSize: 26, fontWeight: "800", color: colors.foreground, marginBottom: 6 },
    pageSub: { fontSize: 15, color: colors.mutedForeground, marginBottom: 28, lineHeight: 22 },
    roleCard: {
      borderWidth: 2, borderColor: colors.border, borderRadius: 18,
      padding: 18, marginBottom: 12,
      flexDirection: "row", alignItems: "center", gap: 16,
      backgroundColor: colors.card,
    },
    roleIcon: { width: 54, height: 54, borderRadius: 16, justifyContent: "center", alignItems: "center" },
    roleLabel: { fontSize: 17, fontWeight: "800", color: colors.foreground },
    roleDesc: { fontSize: 13, color: colors.mutedForeground, marginTop: 2, lineHeight: 18 },
    label: { fontSize: 14, fontWeight: "700", color: colors.foreground, marginBottom: 6 },
    inputRow: {
      backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
      borderRadius: 12, flexDirection: "row", alignItems: "center",
      paddingHorizontal: 14, marginBottom: 14,
    },
    input: { flex: 1, fontSize: 15, color: colors.foreground, paddingVertical: 13 },
    eyeBtn: { padding: 6 },
    error: { fontSize: 14, color: colors.destructive, textAlign: "center", marginBottom: 12 },
    nextBtn: {
      backgroundColor: colors.primary, borderRadius: 14,
      paddingVertical: 16, alignItems: "center", marginTop: 8,
    },
    nextBtnText: { fontSize: 16, fontWeight: "700", color: "#fff" },
    footer: { flexDirection: "row", justifyContent: "center", marginTop: 24, gap: 4 },
    footerText: { fontSize: 14, color: colors.mutedForeground },
    footerLink: { fontSize: 14, fontWeight: "700", color: colors.primary },

    // DOB picker
    dobTitle: { fontSize: 20, fontWeight: "800", color: colors.foreground, marginBottom: 4 },
    dobSub: { fontSize: 14, color: colors.mutedForeground, marginBottom: 24, lineHeight: 20 },
    wheelRow: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 8, marginBottom: 28 },
    wheelLabel: { fontSize: 11, fontWeight: "700", color: colors.mutedForeground, textAlign: "center", marginTop: 4, textTransform: "uppercase" },
    levelCard: {
      borderRadius: 16, padding: 16, marginBottom: 24,
      flexDirection: "row", alignItems: "center", gap: 14,
    },
    levelIcon: { width: 48, height: 48, borderRadius: 14, justifyContent: "center", alignItems: "center" },
    levelLabel: { fontSize: 16, fontWeight: "800" },
    levelDesc: { fontSize: 13, marginTop: 2 },
    ageLine: { fontSize: 12, marginTop: 4, fontWeight: "600" },
    ageError: {
      backgroundColor: "#fef2f2", borderRadius: 12, padding: 14, marginBottom: 20,
      borderWidth: 1, borderColor: "#fecaca",
    },
    ageErrorText: { fontSize: 14, color: colors.destructive, textAlign: "center" },
  });

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.content}>
          {/* Back button */}
          {step !== "role" && (
            <TouchableOpacity style={styles.backRow} onPress={goBack}>
              <Feather name="arrow-left" size={18} color={colors.primary} />
              <Text style={styles.backText}>Назад</Text>
            </TouchableOpacity>
          )}

          {/* ── STEP 1: Choose role ── */}
          {step === "role" && (
            <>
              <Text style={styles.pageTitle}>Создать аккаунт</Text>
              <Text style={styles.pageSub}>Выберите вашу роль, чтобы начать</Text>

              {ROLES.map((r) => (
                <TouchableOpacity
                  key={r.key}
                  style={styles.roleCard}
                  onPress={() => handleRoleSelect(r.key)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.roleIcon, { backgroundColor: r.bgColor }]}>
                    <Feather name={r.icon as any} size={26} color={r.iconColor} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.roleLabel}>{r.label}</Text>
                    <Text style={styles.roleDesc}>{r.desc}</Text>
                  </View>
                  <Feather name="chevron-right" size={20} color={colors.mutedForeground} />
                </TouchableOpacity>
              ))}

              <View style={styles.footer}>
                <Text style={styles.footerText}>Уже есть аккаунт?</Text>
                <TouchableOpacity onPress={() => router.push("/(auth)/login")}>
                  <Text style={[styles.footerLink, { marginLeft: 4 }]}>Войти</Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          {/* ── STEP 2: Name / username / password ── */}
          {step === "details" && role && (
            <>
              <Text style={styles.pageTitle}>
                {role === "student" ? "Данные ученика"
                  : role === "parent" ? "Данные родителя"
                  : "Данные учителя"}
              </Text>
              <Text style={styles.pageSub}>
                {role === "student"
                  ? "Введите ваши данные для создания аккаунта"
                  : role === "parent"
                  ? "Следите за прогрессом вашего ребёнка"
                  : "Управляйте заданиями и учениками"}
              </Text>

              <Text style={styles.label}>Полное имя</Text>
              <View style={styles.inputRow}>
                <TextInput
                  style={styles.input}
                  value={name}
                  onChangeText={setName}
                  placeholder="Введите ваше имя"
                  placeholderTextColor={colors.mutedForeground}
                />
              </View>

              <Text style={styles.label}>Имя пользователя</Text>
              <View style={styles.inputRow}>
                <TextInput
                  style={styles.input}
                  value={username}
                  onChangeText={setUsername}
                  placeholder="Придумайте логин"
                  placeholderTextColor={colors.mutedForeground}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              <Text style={styles.label}>Пароль</Text>
              <View style={styles.inputRow}>
                <TextInput
                  style={styles.input}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Не менее 6 символов"
                  placeholderTextColor={colors.mutedForeground}
                  secureTextEntry={!showPass}
                />
                <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPass(!showPass)}>
                  <Feather name={showPass ? "eye-off" : "eye"} size={18} color={colors.mutedForeground} />
                </TouchableOpacity>
              </View>

              {error ? <Text style={styles.error}>{error}</Text> : null}

              <TouchableOpacity style={styles.nextBtn} onPress={handleDetailsNext} disabled={loading}>
                {loading
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.nextBtnText}>
                      {role === "student" ? "Далее: Дата рождения" : "Создать аккаунт"}
                    </Text>
                }
              </TouchableOpacity>
            </>
          )}

          {/* ── STEP 3: Date of birth (students only) ── */}
          {step === "dob" && (
            <>
              <Text style={styles.dobTitle}>Дата рождения</Text>
              <Text style={styles.dobSub}>
                Мы подберём задания под ваш возраст и уровень знаний
              </Text>

              {/* Wheel picker: Day | Month | Year */}
              <View style={styles.wheelRow}>
                <View style={{ alignItems: "center" }}>
                  <WheelPicker
                    items={DAYS}
                    selected={dayIdx}
                    onSelect={setDayIdx}
                    width={64}
                    colors={colors}
                  />
                  <Text style={styles.wheelLabel}>День</Text>
                </View>

                <View style={{ alignItems: "center" }}>
                  <WheelPicker
                    items={MONTHS_RU}
                    selected={monthIdx}
                    onSelect={setMonthIdx}
                    width={130}
                    colors={colors}
                  />
                  <Text style={styles.wheelLabel}>Месяц</Text>
                </View>

                <View style={{ alignItems: "center" }}>
                  <WheelPicker
                    items={YEARS}
                    selected={yearIdx}
                    onSelect={setYearIdx}
                    width={80}
                    colors={colors}
                  />
                  <Text style={styles.wheelLabel}>Год</Text>
                </View>
              </View>

              {/* Level preview */}
              {age >= 5 && age <= 18 && levelMeta ? (
                <View style={[styles.levelCard, { backgroundColor: levelMeta.color + "15", borderWidth: 1.5, borderColor: levelMeta.color + "40" }]}>
                  <View style={[styles.levelIcon, { backgroundColor: levelMeta.color + "20" }]}>
                    <Feather name="zap" size={22} color={levelMeta.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.levelLabel, { color: levelMeta.color }]}>
                      {levelMeta.labelRu}
                    </Text>
                    <Text style={[styles.levelDesc, { color: colors.mutedForeground }]}>
                      {levelMeta.label}
                    </Text>
                    <Text style={[styles.ageLine, { color: levelMeta.color }]}>
                      {age} лет · {levelMeta.ageRange}
                    </Text>
                  </View>
                  <Feather name="check-circle" size={22} color={levelMeta.color} />
                </View>
              ) : (
                <View style={styles.ageError}>
                  <Text style={styles.ageErrorText}>
                    {age < 5
                      ? "Возраст ученика должен быть не менее 5 лет"
                      : "Возраст ученика должен быть не более 18 лет"}
                  </Text>
                </View>
              )}

              {error ? <Text style={styles.error}>{error}</Text> : null}

              <TouchableOpacity
                style={[styles.nextBtn, (age < 5 || age > 18) && { opacity: 0.45 }]}
                onPress={() => handleSubmit()}
                disabled={loading || age < 5 || age > 18}
              >
                {loading
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.nextBtnText}>Создать аккаунт</Text>
                }
              </TouchableOpacity>
            </>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
