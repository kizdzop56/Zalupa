import React, { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
  Image,
} from "react-native";
import { useRouter } from "expo-router";
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      setError("Please enter username and password");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${process.env.EXPO_PUBLIC_DOMAIN ? `https://${process.env.EXPO_PUBLIC_DOMAIN}` : ""}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Login failed");
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
      flex: 1,
      paddingHorizontal: 24,
      paddingTop: insets.top + 40,
      paddingBottom: insets.bottom + 24,
      justifyContent: "center",
    },
    logo: { width: 80, height: 80, borderRadius: 20, alignSelf: "center", marginBottom: 16 },
    title: { fontSize: 28, fontWeight: "700", color: colors.foreground, textAlign: "center", marginBottom: 4 },
    subtitle: { fontSize: 15, color: colors.mutedForeground, textAlign: "center", marginBottom: 32 },
    label: { fontSize: 14, fontWeight: "600", color: colors.foreground, marginBottom: 6 },
    input: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 14,
      fontSize: 16,
      color: colors.foreground,
      marginBottom: 16,
    },
    error: { fontSize: 14, color: colors.destructive, textAlign: "center", marginBottom: 12 },
    button: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      paddingVertical: 16,
      alignItems: "center",
      marginTop: 8,
    },
    buttonText: { fontSize: 16, fontWeight: "700", color: colors.primaryForeground },
    footer: { flexDirection: "row", justifyContent: "center", marginTop: 24, gap: 4 },
    footerText: { fontSize: 14, color: colors.mutedForeground },
    footerLink: { fontSize: 14, fontWeight: "600", color: colors.primary },
    adminHint: {
      marginTop: 32, padding: 16, backgroundColor: colors.muted,
      borderRadius: 12, borderWidth: 1, borderColor: colors.border,
    },
    adminHintText: { fontSize: 12, color: colors.mutedForeground, textAlign: "center" },
    adminHintBold: { fontWeight: "700", color: colors.foreground },
  });

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.content}>
          <Image source={require("@/assets/images/icon.png")} style={styles.logo} />
          <Text style={styles.title}>English Learning</Text>
          <Text style={styles.subtitle}>Sign in to continue your journey</Text>

          <Text style={styles.label}>Username</Text>
          <TextInput
            style={styles.input}
            value={username}
            onChangeText={setUsername}
            placeholder="Enter your username"
            placeholderTextColor={colors.mutedForeground}
            autoCapitalize="none"
            autoCorrect={false}
            testID="username-input"
          />

          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="Enter your password"
            placeholderTextColor={colors.mutedForeground}
            secureTextEntry
            testID="password-input"
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={loading} testID="login-button">
            {loading ? <ActivityIndicator color={colors.primaryForeground} /> : <Text style={styles.buttonText}>Sign In</Text>}
          </TouchableOpacity>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Don&apos;t have an account?</Text>
            <TouchableOpacity onPress={() => router.push("/(auth)/register")}>
              <Text style={styles.footerLink}>Sign Up</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.adminHint}>
            <Text style={styles.adminHintText}>
              <Text style={styles.adminHintBold}>Admin account: </Text>
              username: <Text style={styles.adminHintBold}>admin</Text> / password: <Text style={styles.adminHintBold}>admin123</Text>
            </Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
