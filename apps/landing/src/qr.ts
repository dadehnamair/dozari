import qrcode from 'qrcode-generator';

/** An inline, scalable SVG QR code for `text` (dark modules on white, with a quiet zone). */
export function qrSvg(text: string): string {
  const qr = qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  return qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
}
