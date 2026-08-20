import Svg, { Circle, G, Path } from 'react-native-svg';
import type { StyleProp, ViewStyle } from 'react-native';
import { theme } from '@/constants/theme';

// A delicate single-line botanical sprig, used as a quiet decorative accent
// (never as a background wash) so it stays sophisticated rather than busy.
// Petals are generated from angle/length math rather than hand-traced
// coordinates, so a blossom stays evenly spaced at any size.

function petalPath(cx: number, cy: number, angleDeg: number, length: number, width: number) {
  const angle = (angleDeg * Math.PI) / 180;
  const perp = angle + Math.PI / 2;
  const tipX = cx + length * Math.cos(angle);
  const tipY = cy + length * Math.sin(angle);
  const midX = cx + length * 0.55 * Math.cos(angle);
  const midY = cy + length * 0.55 * Math.sin(angle);
  const c1x = midX + width * Math.cos(perp);
  const c1y = midY + width * Math.sin(perp);
  const c2x = midX - width * Math.cos(perp);
  const c2y = midY - width * Math.sin(perp);
  return `M ${cx} ${cy} Q ${c1x} ${c1y} ${tipX} ${tipY} Q ${c2x} ${c2y} ${cx} ${cy} Z`;
}

function Blossom({ cx, cy, size, rotate, color }: { cx: number; cy: number; size: number; rotate: number; color: string }) {
  const petals = [0, 72, 144, 216, 288];
  return (
    <G>
      {petals.map(a => (
        <Path key={a} d={petalPath(cx, cy, a + rotate, size, size * 0.4)} stroke={color} strokeWidth={1.1} fill="none" strokeLinejoin="round" />
      ))}
      <Circle cx={cx} cy={cy} r={size * 0.16} stroke={color} strokeWidth={1} fill="none" />
    </G>
  );
}

export function FloralFlourish({
  width = 96,
  height = 64,
  color,
  style
}: {
  width?: number;
  height?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const stroke = color ?? theme.colors.gold;
  return (
    <Svg width={width} height={height} viewBox="0 0 160 100" style={style}>
      <Path d="M12 92 C 34 74, 42 54, 56 34 C 66 20, 80 12, 98 6" stroke={stroke} strokeWidth={1.3} fill="none" strokeLinecap="round" />
      <Path d="M40 54 C 30 46, 22 40, 14 36" stroke={stroke} strokeWidth={1.1} fill="none" strokeLinecap="round" />
      <Path d="M50 70 Q 40 60 50 48 Q 60 60 50 70 Z" stroke={stroke} strokeWidth={1} fill="none" />
      <Path d="M24 40 Q 14 34 8 22 Q 22 24 24 40 Z" stroke={stroke} strokeWidth={1} fill="none" />
      <Blossom cx={98} cy={8} size={11} rotate={10} color={stroke} />
      <Blossom cx={58} cy={32} size={9} rotate={-20} color={stroke} />
      <Circle cx={16} cy={34} r={2.4} stroke={stroke} strokeWidth={1} fill="none" />
    </Svg>
  );
}
