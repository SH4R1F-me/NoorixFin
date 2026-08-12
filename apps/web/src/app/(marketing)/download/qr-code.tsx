'use client';

import { useEffect, useRef } from 'react';
import QRCode from 'qrcode';

export default function InstallQrCode({ value, label }: { value: string; label: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!canvas.current) return;
    void QRCode.toCanvas(canvas.current, value, {
      width: 208,
      margin: 2,
      color: { dark: '#07111f', light: '#ffffff' },
      errorCorrectionLevel: 'M',
    });
  }, [value]);
  return <canvas ref={canvas} role="img" aria-label={label} width={208} height={208} />;
}
