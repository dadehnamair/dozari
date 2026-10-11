import { useMemo } from 'react';
import { colors } from '../theme/colors';
import Svg, { Path, Rect } from 'react-native-svg';
import qrcode from 'qrcode-generator';

/** A QR code drawn as one SVG path (white quiet zone included). Error correction M; the type number is picked from the text length. */
export function QrCode({ value, size = 220, dark = colors.ink }: { value: string; size?: number; dark?: string }) {
  const { count, path } = useMemo(() => {
    const qr = qrcode(0, 'M');
    qr.addData(value);
    qr.make();
    const n = qr.getModuleCount();
    let d = '';
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) d += `M${c} ${r}h1v1h-1z`;
    return { count: n, path: d };
  }, [value]);
  const quiet = 3;
  const box = count + quiet * 2;
  return (
    <Svg width={size} height={size} viewBox={`${-quiet} ${-quiet} ${box} ${box}`} accessibilityLabel={value}>
      <Rect x={-quiet} y={-quiet} width={box} height={box} fill="#FFFFFF" />
      <Path d={path} fill={dark} />
    </Svg>
  );
}
