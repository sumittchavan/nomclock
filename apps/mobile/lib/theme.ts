import { useColorScheme } from "react-native";

const light = {
  bg: "#F3F6F5",
  surface: "#FFFFFF",
  ink: "#1F2340",
  inkSoft: "#5C6370",
  line: "#C9D2D0",
  track: "#E2E8E6",
  protein: "#B4245C",
  carbs: "#E3A51A",
  fat: "#6E7D2B",
  good: "#2F7A55",
  warn: "#B4245C",
  info: "#3A5A8C",
  onInk: "#F3F6F5",
};

const dark: typeof light = {
  bg: "#15172B",
  surface: "#1E2138",
  ink: "#EEF2F1",
  inkSoft: "#A3A9B8",
  line: "#353A57",
  track: "#2A2E4A",
  protein: "#E2588D",
  carbs: "#EDB84A",
  fat: "#A6B85A",
  good: "#5FC08F",
  warn: "#E2588D",
  info: "#8BA8DA",
  onInk: "#15172B",
};

export type Theme = typeof light;

export function useTheme(): Theme {
  return useColorScheme() === "dark" ? dark : light;
}

export const fonts = {
  display: "BricolageGrotesque_800ExtraBold",
  displaySemi: "BricolageGrotesque_600SemiBold",
  body: "AtkinsonHyperlegible_400Regular",
  bodyBold: "AtkinsonHyperlegible_700Bold",
};
