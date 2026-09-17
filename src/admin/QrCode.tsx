import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

/** Inline SVG QR code; scales with its container. */
export default function QrCode({ text, className = '' }: { text: string; className?: string }) {
  const [svg, setSvg] = useState('');
  useEffect(() => {
    let cancelled = false;
    QRCode.toString(text, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' })
      .then(s => !cancelled && setSvg(s))
      .catch(() => !cancelled && setSvg(''));
    return () => {
      cancelled = true;
    };
  }, [text]);
  return <div className={className} aria-label={text} role="img" dangerouslySetInnerHTML={{ __html: svg }} />;
}
