import { Redirect, Tabs } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { Platform, View, StyleSheet } from "react-native";
import { BlurView } from "expo-blur";
import { useColorScheme } from "react-native";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect } from "react";
import { useStartTimeSession, useEndTimeSession } from "@workspace/api-client-react";

function StudentTimerManager() {
  const { mutate: startSession } = useStartTimeSession();
  const { mutate: endSession } = useEndTimeSession();

  useEffect(() => {
    startSession({});
    return () => { endSession({}); };
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
  const isAdmin = user.role === "admin";
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
        <Tabs.Screen
          name="assignments"
          options={{
            title: isAdmin ? "Tasks" : "Learn",
            tabBarIcon: ({ color }) => <Feather name="book-open" size={22} color={color} />,
          }}
        />
        {isStudent && (
          <Tabs.Screen
            name="voice-chat"
            options={{
              title: "AI Chat",
              tabBarIcon: ({ color }) => <Feather name="mic" size={22} color={color} />,
            }}
          />
        )}
        {isStudent && (
          <Tabs.Screen
            name="leaderboard"
            options={{
              title: "Ranking",
              tabBarIcon: ({ color }) => <Feather name="award" size={22} color={color} />,
            }}
          />
        )}
        {(isAdmin || isParent) && (
          <Tabs.Screen
            name="students"
            options={{
              title: isParent ? "My Children" : "Students",
              tabBarIcon: ({ color }) => <Feather name="users" size={22} color={color} />,
            }}
          />
        )}
        <Tabs.Screen
          name="profile"
          options={{
            title: "Profile",
            tabBarIcon: ({ color }) => <Feather name="user" size={22} color={color} />,
          }}
        />
        {/* Hide unused tabs */}
        {!isStudent && <Tabs.Screen name="voice-chat" options={{ href: null }} />}
        {!isStudent && <Tabs.Screen name="leaderboard" options={{ href: null }} />}
        {isStudent && <Tabs.Screen name="students" options={{ href: null }} />}
        <Tabs.Screen name="student/[id]" options={{ href: null }} />
        <Tabs.Screen name="assignment/[id]" options={{ href: null }} />
        <Tabs.Screen name="create-assignment" options={{ href: null }} />
      </Tabs>
    </>
  );
}
