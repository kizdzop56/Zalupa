import React, { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
  Image,
} from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/contexts/AuthContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function LoginScreen() {
  const colors = useColors();
  const { login } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      setError("Введите псевдоним и пароль");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const baseUrl = process.env["EXPO_PUBLIC_DOMAIN"]
        ? `https://${process.env["EXPO_PUBLIC_DOMAIN"]}`
        : "";
      const response = await fetch(`${baseUrl}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(
          response.status === 401
            ? "Неверный псевдоним или пароль"
            : data.error || "Ошибка входа. Попробуйте снова."
        );
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
      paddingTop: insets.top + 40,
      paddingBottom: insets.bottom + 24,
      justifyContent: "center",
    },
    logo: { width: 84, height: 84, borderRadius: 22, alignSelf: "center", marginBottom: 18 },
    title: { fontSize: 28, fontWeight: "800", color: colors.foreground, textAlign: "center", marginBottom: 4 },
    subtitle: { fontSize: 15, color: colors.mutedForeground, textAlign: "center", marginBottom: 36 },
    label: { fontSize: 14, fontWeight: "700", color: colors.foreground, marginBottom: 6 },
    inputRow: {
      backgroundColor: colors.card, borderWidth: 1.5, borderColor: colors.border,
      borderRadius: 13, flexDirection: "row", alignItems: "center",
      paddingHorizontal: 14, marginBottom: 14,
    },
    input: { flex: 1, fontSize: 15, color: colors.foreground, paddingVertical: 14, ...(Platform.OS === "web" ? { outlineWidth: 0 } as any : {}) },
    eyeBtn: { padding: 6 },
    error: { fontSize: 14, color: colors.destructive, textAlign: "center", marginBottom: 12 },
    button: {
      backgroundColor: colors.primary, borderRadius: 14,
      paddingVertical: 16, alignItems: "center", marginTop: 8,
    },
    buttonText: { fontSize: 16, fontWeight: "700", color: "#fff" },
    footer: { flexDirection: "row", justifyContent: "center", alignItems: "center", marginTop: 24, gap: 4 },
    footerText: { fontSize: 14, color: colors.mutedForeground },
    footerLink: { fontSize: 14, fontWeight: "700", color: colors.primary },
    adminHint: {
      marginTop: 28, padding: 14, backgroundColor: colors.muted,
      borderRadius: 12, borderWidth: 1, borderColor: colors.border,
    },
    adminHintText: { fontSize: 12, color: colors.mutedForeground, textAlign: "center", lineHeight: 18 },
    adminHintBold: { fontWeight: "700", color: colors.foreground },
  });

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.content}>
          <Image source={require("@/assets/images/icon.png")} style={styles.logo} />
          <Text style={styles.title}>English Learning</Text>
          <Text style={styles.subtitle}>Войдите, чтобы продолжить обучение</Text>

          <Text style={styles.label}>Псевдоним</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              value={username}
              onChangeText={setUsername}
              placeholder="Введите ваш псевдоним"
              placeholderTextColor={colors.mutedForeground}
              autoCapitalize="none"
              autoCorrect={false}
              testID="username-input"
            />
          </View>

          <Text style={styles.label}>Пароль</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="Введите пароль"
              placeholderTextColor={colors.mutedForeground}
              secureTextEntry={!showPass}
              testID="password-input"
            />
            <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPass(!showPass)}>
              <Feather name={showPass ? "eye-off" : "eye"} size={18} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={loading} testID="login-button">
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.buttonText}>Войти</Text>
            }
          </TouchableOpacity>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Нет аккаунта?</Text>
            <TouchableOpacity onPress={() => router.push("/(auth)/register")}>
              <Text style={[styles.footerLink, { marginLeft: 4 }]}>Зарегистрироваться</Text>
            </TouchableOpacity>
          </View>

        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
