import Svg, { Circle, Defs, Ellipse, G, Mask, Path, Rect } from "react-native-svg";
import { useTheme } from "@/lib/theme";

/** The NomClock mark: a smiling plate with a bite out of the rim. */
export function BrandMark({ size = 32 }: { size?: number }) {
  const t = useTheme();
  return (
    <Svg width={size} height={size} viewBox="0 0 200 200" accessibilityLabel="NomClock logo">
      <Defs>
        <Mask id="bite">
          <Rect width="200" height="200" fill="#fff" />
          <Circle cx="168" cy="44" r="21" fill="#000" />
          <Circle cx="185" cy="68" r="16" fill="#000" />
          <Circle cx="148" cy="24" r="15" fill="#000" />
        </Mask>
      </Defs>
      <G mask="url(#bite)">
        <Circle cx="100" cy="100" r="86" fill="#FFFFFF" stroke={t.ink} strokeWidth={13} />
      </G>
      <Ellipse cx="81" cy="92" rx="8" ry="11" fill="#1F2340" />
      <Ellipse cx="119" cy="92" rx="8" ry="11" fill="#1F2340" />
      <Ellipse cx="63" cy="113" rx="11" ry="7" fill="#B4245C" opacity={0.3} />
      <Ellipse cx="137" cy="113" rx="11" ry="7" fill="#B4245C" opacity={0.3} />
      <Path d="M84 115 Q100 133 116 115" fill="none" stroke="#1F2340" strokeWidth={8} strokeLinecap="round" />
    </Svg>
  );
}
