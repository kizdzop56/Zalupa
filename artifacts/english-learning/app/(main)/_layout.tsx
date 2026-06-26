import { Redirect, Tabs } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { Platform, View, StyleSheet } from "react-native";
import { BlurView } from "expo-blur";
import { useColorScheme } from "react-native";
import { useColors } from "@/hooks/useColors";
import { useAuth, isTeacherOrAdmin } from "@/contexts/AuthContext";
import { useEffect } from "react";
import { useStartTimeSession, useEndTimeSession } from "@workspace/api-client-react";

function StudentTimerManager() {
  const { mutate: startSession } = useStartTimeSession();
  const { mutate: endSession } = useEndTimeSession();

  useEffect(() => {
    startSession(undefined);
    return () => { endSession(undefined); };
  }, []);

  return null;
}

export default function MainLayout() {
  const { user } = useAuth();
  const colors = useColors();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const isIOS = Platform.OS === "ios";
  const isWeb = Platform.OS === "web";

  if (!user) return <Redirect href="/(auth)/login" />;

  const isStudent = user.role === "student";
  const isTeacher = isTeacherOrAdmin(user.role);
  const isParent = user.role === "parent";

  return (
    <>
      {isStudent && <StudentTimerManager />}
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.mutedForeground,
          headerShown: false,
          tabBarStyle: {
            position: "absolute",
            backgroundColor: isIOS ? "transparent" : colors.background,
            borderTopWidth: isWeb ? 1 : 0,
            borderTopColor: colors.border,
            elevation: 0,
            ...(isWeb ? { height: 84 } : {}),
          },
          tabBarBackground: () =>
            isIOS ? (
              <BlurView intensity={100} tint={isDark ? "dark" : "light"} style={StyleSheet.absoluteFill} />
            ) : isWeb ? (
              <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.background }]} />
            ) : null,
        }}
      >
        {/* Assignments — visible for all */}
        <Tabs.Screen
          name="assignments"
          options={{
            title: isTeacher ? "Задания" : "Учиться",
            tabBarIcon: ({ color }) => <Feather name="book-open" size={22} color={color} />,
          }}
        />

        {/* AI Chat — students only */}
        <Tabs.Screen
          name="voice-chat"
          options={isStudent
            ? { title: "AI Чат", tabBarIcon: ({ color }) => <Feather name="message-circle" size={22} color={color} /> }
            : { href: null }
          }
        />

        {/* Leaderboard — students only */}
        <Tabs.Screen
          name="leaderboard"
          options={isStudent
            ? { title: "Рейтинг", tabBarIcon: ({ color }) => <Feather name="award" size={22} color={color} /> }
            : { href: null }
          }
        />

        {/* Students list — teacher or parent */}
        <Tabs.Screen
          name="students"
          options={(isTeacher || isParent)
            ? {
                title: isParent ? "Дети" : "Ученики",
                tabBarIcon: ({ color }) => <Feather name="users" size={22} color={color} />,
              }
            : { href: null }
          }
        />

        {/* Profile — all */}
        <Tabs.Screen
          name="profile"
          options={{
            title: "Профиль",
            tabBarIcon: ({ color }) => <Feather name="user" size={22} color={color} />,
          }}
        />

        {/* Hidden detail routes */}
        <Tabs.Screen name="student/[id]" options={{ href: null }} />
        <Tabs.Screen name="assignment/[id]" options={{ href: null }} />
        <Tabs.Screen name="create-assignment" options={{ href: null }} />
      </Tabs>
    </>
  );
}
