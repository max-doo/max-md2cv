export interface ThemeColorPreset {
  hex: string;
  name: string;
  note?: string;
}

export const THEME_COLOR_PRESETS: readonly ThemeColorPreset[] = [
  { hex: "#302EA3", name: "群青紫", note: "原" },
  { hex: "#4c49cc", name: "深蓝紫", note: "原" },
  { hex: "#003396", name: "藏青", note: "原" },
  { hex: "#1F4E79", name: "商务深蓝" },
  { hex: "#004A99", name: "深蔚蓝", note: "原" },
  { hex: "#0050D1", name: "宝蓝", note: "原" },
  { hex: "#2477BF", name: "经典商务蓝", note: "原" },
  { hex: "#40566F", name: "冷静蓝灰" },
  { hex: "#005451", name: "深墨青", note: "原" },
  { hex: "#0F6B66", name: "科技青绿" },
  { hex: "#008080", name: "水鸭青", note: "原" },
  { hex: "#355C4D", name: "墨绿色" },
  { hex: "#7A3142", name: "勃艮第红" },
  { hex: "#000000", name: "纯黑", note: "原" },
  { hex: "#242424", name: "深炭灰", note: "原" },
] as const;

export const THEME_COLORS: readonly string[] = THEME_COLOR_PRESETS.map((p) => p.hex);
