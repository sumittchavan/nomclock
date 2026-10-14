import { useState } from "react";
import { View, useWindowDimensions } from "react-native";
import Svg, { G, Line, Path, Rect, Text as SvgText, Circle } from "react-native-svg";
import { fonts, useTheme } from "@/lib/theme";
import { T } from "./ui";

export interface Series { key: string; color: string; label: string }

function niceMax(v: number) {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
}

/** Stacked bar chart with an optional reference line. Tap a bar to read its values. */
export function BarChart({ rows, series, target, unit, height = 220 }: {
  rows: (Record<string, number | string> & { name: string })[];
  series: Series[]; target?: number; unit: string; height?: number;
}) {
  const t = useTheme();
  const { width: winW } = useWindowDimensions();
  const width = winW - 32;
  const [sel, setSel] = useState<number | null>(null);
  const padL = 40, padB = 22, padT = 8;
  const totals = rows.map((r) => series.reduce((s, x) => s + Number(r[x.key] ?? 0), 0));
  const max = niceMax(Math.max(...totals, target ?? 0) * 1.05);
  const plotW = width - padL, plotH = height - padB - padT;
  const slot = plotW / Math.max(rows.length, 1);
  const barW = Math.min(28, slot * 0.6);
  const y = (v: number) => padT + plotH - (v / max) * plotH;
  const labelEvery = Math.ceil(rows.length / 7);

  return (
    <View>
      <Svg width={width} height={height}>
        {[0, 0.5, 1].map((f) => (
          <G key={f}>
            <Line x1={padL} x2={width} y1={y(max * f)} y2={y(max * f)} stroke={t.line} strokeDasharray="2 4" />
            <SvgText x={padL - 6} y={y(max * f) + 4} fontSize={10.5} fill={t.inkSoft} textAnchor="end" fontFamily={fonts.body}>{Math.round(max * f).toLocaleString()}</SvgText>
          </G>
        ))}
        {rows.map((r, i) => {
          let acc = 0;
          const x = padL + slot * i + (slot - barW) / 2;
          return (
            <G key={r.name + i} onPress={() => setSel(sel === i ? null : i)} opacity={sel === null || sel === i ? 1 : 0.45}>
              <Rect x={padL + slot * i} y={padT} width={slot} height={plotH} fill="transparent" />
              {series.map((s, si) => {
                const v = Number(r[s.key] ?? 0);
                const top = y(acc + v), h = y(acc) - top;
                acc += v;
                return <Rect key={s.key} x={x} y={top} width={barW} height={Math.max(0, h)} fill={s.color} rx={si === series.length - 1 ? 4 : 0} />;
              })}
              {i % labelEvery === 0 && (
                <SvgText x={x + barW / 2} y={height - 6} fontSize={10.5} fill={t.inkSoft} textAnchor="middle" fontFamily={fonts.body}>{r.name}</SvgText>
              )}
            </G>
          );
        })}
        {target !== undefined && <Line x1={padL} x2={width} y1={y(target)} y2={y(target)} stroke={t.ink} strokeWidth={1.5} strokeDasharray="6 4" />}
      </Svg>
      <T v="small" soft style={{ minHeight: 20 }}>
        {sel !== null
          ? `${rows[sel].name}: ${series.map((s) => `${s.label} ${Math.round(Number(rows[sel][s.key] ?? 0)).toLocaleString()} ${unit}`).join(", ")}`
          : target !== undefined ? `Dashed line: target ${target.toLocaleString()} ${unit}. Tap a bar for details.` : "Tap a bar for details."}
      </T>
    </View>
  );
}

export function LineChart({ points, unit, height = 180 }: { points: { name: string; v: number }[]; unit: string; height?: number }) {
  const t = useTheme();
  const { width: winW } = useWindowDimensions();
  const width = winW - 32;
  const padL = 40, padB = 22, padT = 10;
  const vs = points.map((p) => p.v);
  const lo = Math.floor(Math.min(...vs) - 1), hi = Math.ceil(Math.max(...vs) + 1);
  const x = (i: number) => padL + ((width - padL - 8) * i) / Math.max(points.length - 1, 1);
  const y = (v: number) => padT + (height - padB - padT) * (1 - (v - lo) / (hi - lo || 1));
  const d = points.map((p, i) => `${i ? "L" : "M"}${x(i)},${y(p.v)}`).join(" ");
  const every = Math.ceil(points.length / 6);
  return (
    <Svg width={width} height={height} accessibilityLabel={`Weight from ${vs[0]} to ${vs[vs.length - 1]} ${unit}`}>
      {[lo, hi].map((v) => (
        <G key={v}>
          <Line x1={padL} x2={width} y1={y(v)} y2={y(v)} stroke={t.line} strokeDasharray="2 4" />
          <SvgText x={padL - 6} y={y(v) + 4} fontSize={10.5} fill={t.inkSoft} textAnchor="end" fontFamily={fonts.body}>{v}</SvgText>
        </G>
      ))}
      <Path d={d} stroke={t.ink} strokeWidth={2.5} fill="none" />
      {points.map((p, i) => (
        <G key={i}>
          <Circle cx={x(i)} cy={y(p.v)} r={3} fill={t.bg} stroke={t.ink} strokeWidth={2} />
          {i % every === 0 && <SvgText x={x(i)} y={height - 6} fontSize={10.5} fill={t.inkSoft} textAnchor="middle" fontFamily={fonts.body}>{p.name}</SvgText>}
        </G>
      ))}
    </Svg>
  );
}
