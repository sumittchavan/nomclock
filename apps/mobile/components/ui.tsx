import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View, type TextProps, type TextInputProps, type TextStyle, type ViewStyle } from "react-native";
import { fonts, useTheme } from "@/lib/theme";

type Variant = "h1" | "h2" | "h3" | "body" | "bodyBold" | "small" | "num" | "big";

export function T({ v = "body", soft, style, ...rest }: TextProps & { v?: Variant; soft?: boolean }) {
  const t = useTheme();
  const styles: Record<Variant, TextStyle> = {
    h1: { fontFamily: fonts.display, fontSize: 32, letterSpacing: -0.6, lineHeight: 36 },
    h2: { fontFamily: fonts.displaySemi, fontSize: 21, lineHeight: 26 },
    h3: { fontFamily: fonts.displaySemi, fontSize: 16, lineHeight: 21 },
    body: { fontFamily: fonts.body, fontSize: 16, lineHeight: 23 },
    bodyBold: { fontFamily: fonts.bodyBold, fontSize: 16, lineHeight: 23 },
    small: { fontFamily: fonts.body, fontSize: 13.5, lineHeight: 19 },
    num: { fontFamily: fonts.displaySemi, fontSize: 15, fontVariant: ["tabular-nums"] },
    big: { fontFamily: fonts.display, fontSize: 56, letterSpacing: -2, lineHeight: 60, fontVariant: ["tabular-nums"] },
  };
  const base = styles[v];
  return <Text {...rest} style={[base, { color: soft ? t.inkSoft : t.ink }, style]} />;
}

export function Button({ title, onPress, kind = "primary", disabled, busy, small, style, accessibilityLabel }: {
  title: string; onPress: () => void; kind?: "primary" | "ghost" | "danger"; disabled?: boolean; busy?: boolean; small?: boolean; style?: ViewStyle; accessibilityLabel?: string;
}) {
  const t = useTheme();
  const bg = kind === "primary" ? t.ink : "transparent";
  const fg = kind === "primary" ? t.onInk : kind === "danger" ? t.warn : t.ink;
  return (
    <Pressable
      accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? title} accessibilityState={{ disabled: !!disabled || !!busy }}
      onPress={onPress} disabled={disabled || busy}
      style={({ pressed }) => [{
        backgroundColor: bg, borderRadius: 999, paddingVertical: small ? 7 : 13, paddingHorizontal: small ? 14 : 22,
        borderWidth: kind === "primary" ? 0 : 1.5, borderColor: kind === "danger" ? t.warn : t.line,
        flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
        opacity: disabled ? 0.5 : pressed ? 0.8 : 1,
      }, style]}
    >
      {busy && <ActivityIndicator color={fg} size="small" />}
      <Text style={{ color: fg, fontFamily: fonts.bodyBold, fontSize: small ? 14 : 16 }}>{title}</Text>
    </Pressable>
  );
}

export function Field({ label, hint, ...rest }: TextInputProps & { label: string; hint?: string }) {
  const t = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <T v="bodyBold" style={{ fontSize: 14.5 }}>{label}{hint ? <T v="small" soft>  {hint}</T> : null}</T>
      <TextInput
        placeholderTextColor={t.inkSoft} accessibilityLabel={label}
        {...rest}
        style={[{ borderWidth: 1.5, borderColor: t.line, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 11, color: t.ink, backgroundColor: t.surface, fontFamily: fonts.body, fontSize: 16 }, rest.style]}
      />
    </View>
  );
}

export function Chips<V extends string>({ label, value, options, onChange }: {
  label: string; value: V; options: [V, string][]; onChange: (v: V) => void;
}) {
  const t = useTheme();
  return (
    <View style={{ gap: 8 }}>
      <T v="bodyBold" style={{ fontSize: 14.5 }}>{label}</T>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }} accessibilityRole="radiogroup" accessibilityLabel={label}>
        {options.map(([v, l]) => {
          const on = v === value;
          return (
            <Pressable key={v} accessibilityRole="radio" accessibilityState={{ selected: on }} onPress={() => onChange(v)}
              style={{ paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1.5, borderColor: on ? t.ink : t.line, backgroundColor: on ? t.ink : "transparent" }}>
              <Text style={{ color: on ? t.onInk : t.ink, fontFamily: fonts.body, fontSize: 14.5 }}>{l}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function Section({ title, children, first }: { title?: string; children: React.ReactNode; first?: boolean }) {
  const t = useTheme();
  return (
    <View style={{ borderTopWidth: first ? 0 : StyleSheet.hairlineWidth * 2, borderTopColor: t.line, paddingTop: first ? 0 : 20, marginTop: first ? 0 : 24, gap: 14 }}>
      {title && <T v="h2">{title}</T>}
      {children}
    </View>
  );
}
