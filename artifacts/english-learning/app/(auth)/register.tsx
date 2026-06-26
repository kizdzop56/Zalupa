import React, { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Platform, KeyboardAvoidingView,
} from "react-native";
import { useRouter } from "expo-router";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/contexts/AuthContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";

const AGE_OPTIONS = Array.from({ length: 14 }, (_, i) => i + 5);

export default function RegisterScreen() {
  const colors = useColors();
  const { login } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [step, setStep] = useState<"role" | "details" | "age">("role");
  const [role, setRole] = useState<"student" | "parent" | null>(null);
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [selectedAge, setSelectedAge] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleRoleSelect = (r: "student" | "parent") => {
    setRole(r);
    setError("");
    setStep("details");
  };

  const handleDetailsNext = () => {
    if (!name.trim()) { setError("Please enter your name"); return; }
    if (!username.trim()) { setError("Please enter a username"); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters"); return; }
    setError("");
    if (role === "student") {
      setStep("age");
    } else {
      handleSubmit();
    }
  };

  const handleAgeSelect = (age: number) => {
    setSelectedAge(age);
    setError("");
  };

  const handleSubmit = async (ageOverride?: number) => {
    const age = ageOverride ?? selectedAge;
    if (role === "student" && !age) {
      setError("Please select your age");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const body: any = { username: username.trim(), password, name: name.trim(), role };
      if (role === "student" && age) body.age = age;

      const response = await fetch(`${process.env.EXPO_PUBLIC_DOMAIN ? `https://${process.env.EXPO_PUBLIC_DOMAIN}` : ""}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Registration failed");
        return;
      }
      await login(data.token, data.user);
      router.replace("/(main)/assignments");
    } catch {
      setError("Connection error. Please try again.");
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
      paddingBottom: insets.bottom + 24,
    },
    backBtn: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 24 },
    backText: { fontSize: 15, color: colors.primary, fontWeight: "600" },
    title: { fontSize: 26, fontWeight: "700", color: colors.foreground, marginBottom: 6 },
    subtitle: { fontSize: 15, color: colors.mutedForeground, marginBottom: 28 },
    roleCard: {
      borderWidth: 2, borderColor: colors.border, borderRadius: 16,
      padding: 20, marginBottom: 12, flexDirection: "row", alignItems: "center", gap: 16,
      backgroundColor: colors.card,
    },
    roleCardActive: { borderColor: colors.primary, backgroundColor: colors.secondary },
    roleIcon: {
      width: 52, height: 52, borderRadius: 26,
      justifyContent: "center", alignItems: "center",
    },
    roleName: { fontSize: 18, fontWeight: "700", color: colors.foreground },
    roleDesc: { fontSize: 13, color: colors.mutedForeground, marginTop: 2 },
    label: { fontSize: 14, fontWeight: "600", color: colors.foreground, marginBottom: 6 },
    input: {
      backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
      borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14,
      fontSize: 16, color: colors.foreground, marginBottom: 16,
    },
    error: { fontSize: 14, color: colors.destructive, textAlign: "center", marginBottom: 12 },
    button: {
      backgroundColor: colors.primary, borderRadius: 12,
      paddingVertical: 16, alignItems: "center", marginTop: 8,
    },
    buttonText: { fontSize: 16, fontWeight: "700", color: colors.primaryForeground },
    footer: { flexDirection: "row", justifyContent: "center", marginTop: 24, gap: 4 },
    footerText: { fontSize: 14, color: colors.mutedForeground },
    footerLink: { fontSize: 14, fontWeight: "600", color: colors.primary },
    ageGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 24 },
    ageBtn: {
      width: 64, height: 64, borderRadius: 12,
      justifyContent: "center", alignItems: "center",
      borderWidth: 2, borderColor: colors.border, backgroundColor: colors.card,
    },
    ageBtnActive: { borderColor: colors.primary, backgroundColor: colors.secondary },
    ageBtnText: { fontSize: 20, fontWeight: "700", color: colors.foreground },
    ageBtnTextActive: { color: colors.primary },
    ageLabel: { fontSize: 11, color: colors.mutedForeground, marginTop: 1 },
  });

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.content}>
          {step !== "role" && (
            <TouchableOpacity style={styles.backBtn} onPress={() => { setStep(step === "age" ? "details" : "role"); setError(""); }}>
              <Feather name="arrow-left" size={18} color={colors.primary} />
              <Text style={styles.backText}>Back</Text>
            </TouchableOpacity>
          )}

          {step === "role" && (
            <>
              <Text style={styles.title}>Create Account</Text>
              <Text style={styles.subtitle}>Choose your role to get started</Text>

              <TouchableOpacity style={styles.roleCard} onPress={() => handleRoleSelect("student")}>
                <View style={[styles.roleIcon, { backgroundColor: "#e0e7ff" }]}>
                  <Feather name="book-open" size={24} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.roleName}>Student</Text>
                  <Text style={styles.roleDesc}>I want to learn English</Text>
                </View>
                <Feather name="chevron-right" size={20} color={colors.mutedForeground} />
              </TouchableOpacity>

              <TouchableOpacity style={styles.roleCard} onPress={() => handleRoleSelect("parent")}>
                <View style={[styles.roleIcon, { backgroundColor: "#e0f2fe" }]}>
                  <Feather name="users" size={24} color={colors.parentColor} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.roleName}>Parent</Text>
                  <Text style={styles.roleDesc}>I want to track my child&apos;s progress</Text>
                </View>
                <Feather name="chevron-right" size={20} color={colors.mutedForeground} />
              </TouchableOpacity>

              <View style={styles.footer}>
                <Text style={styles.footerText}>Already have an account?</Text>
                <TouchableOpacity onPress={() => router.push("/(auth)/login")}>
                  <Text style={styles.footerLink}>Sign In</Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          {step === "details" && (
            <>
              <Text style={styles.title}>{role === "student" ? "Student Details" : "Parent Details"}</Text>
              <Text style={styles.subtitle}>Tell us about yourself</Text>

              <Text style={styles.label}>Full Name</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Enter your full name"
                placeholderTextColor={colors.mutedForeground}
                testID="name-input"
              />

              <Text style={styles.label}>Username</Text>
              <TextInput
                style={styles.input}
                value={username}
                onChangeText={setUsername}
                placeholder="Choose a username"
                placeholderTextColor={colors.mutedForeground}
                autoCapitalize="none"
                autoCorrect={false}
                testID="reg-username-input"
              />

              <Text style={styles.label}>Password</Text>
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder="At least 6 characters"
                placeholderTextColor={colors.mutedForeground}
                secureTextEntry
                testID="reg-password-input"
              />

              {error ? <Text style={styles.error}>{error}</Text> : null}

              <TouchableOpacity style={styles.button} onPress={handleDetailsNext} disabled={loading}>
                {loading
                  ? <ActivityIndicator color={colors.primaryForeground} />
                  : <Text style={styles.buttonText}>{role === "student" ? "Next: Select Age" : "Create Account"}</Text>
                }
              </TouchableOpacity>
            </>
          )}

          {step === "age" && (
            <>
              <Text style={styles.title}>How old are you?</Text>
              <Text style={styles.subtitle}>We&apos;ll match assignments to your level</Text>

              <View style={styles.ageGrid}>
                {AGE_OPTIONS.map(age => (
                  <TouchableOpacity
                    key={age}
                    style={[styles.ageBtn, selectedAge === age && styles.ageBtnActive]}
                    onPress={() => handleAgeSelect(age)}
                    testID={`age-${age}`}
                  >
                    <Text style={[styles.ageBtnText, selectedAge === age && styles.ageBtnTextActive]}>{age}</Text>
                    <Text style={styles.ageLabel}>yrs</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {error ? <Text style={styles.error}>{error}</Text> : null}

              <TouchableOpacity
                style={[styles.button, !selectedAge && { opacity: 0.5 }]}
                onPress={() => selectedAge && handleSubmit(selectedAge)}
                disabled={loading || !selectedAge}
                testID="confirm-age-button"
              >
                {loading
                  ? <ActivityIndicator color={colors.primaryForeground} />
                  : <Text style={styles.buttonText}>Create Account</Text>
                }
              </TouchableOpacity>
            </>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
