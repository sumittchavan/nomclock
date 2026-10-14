import { Tabs } from "expo-router";
import type { ColorValue } from "react-native";
import Svg, { Circle, Path, Rect } from "react-native-svg";
import { fonts, useTheme } from "@/lib/theme";

type IconProps = { color: ColorValue };
const icons = {
  today: ({ color }: IconProps) => (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
      <Circle cx={12} cy={12} r={9} /><Circle cx={12} cy={12} r={4} />
    </Svg>
  ),
  history: ({ color }: IconProps) => (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
      <Rect x={3} y={5} width={18} height={16} rx={3} /><Path d="M3 10h18M8 3v4M16 3v4" />
    </Svg>
  ),
  coach: ({ color }: IconProps) => (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round">
      <Path d="M4 5h16v11H9l-5 4V5z" /><Path d="M8 10h8M8 13h5" />
    </Svg>
  ),
  trends: ({ color }: IconProps) => (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round">
      <Path d="M5 20V12M12 20V6M19 20v-9" />
    </Svg>
  ),
  profile: ({ color }: IconProps) => (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
      <Circle cx={12} cy={8} r={4} /><Path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" />
    </Svg>
  ),
};

export default function TabsLayout() {
  const t = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: t.ink,
        tabBarInactiveTintColor: t.inkSoft,
        tabBarStyle: { backgroundColor: t.surface, borderTopColor: t.line },
        tabBarLabelStyle: { fontFamily: fonts.body, fontSize: 12 },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Today", tabBarIcon: icons.today }} />
      <Tabs.Screen name="history" options={{ title: "History", tabBarIcon: icons.history }} />
      <Tabs.Screen name="coach" options={{ title: "Coach", tabBarIcon: icons.coach }} />
      <Tabs.Screen name="trends" options={{ title: "Trends", tabBarIcon: icons.trends }} />
      <Tabs.Screen name="profile" options={{ title: "Profile", tabBarIcon: icons.profile }} />
    </Tabs>
  );
}
