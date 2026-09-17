import type { ReactNode } from 'react';
import ArcadeTitle from './ArcadeTitle';

export default function FullScreenMessage({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="min-h-full flex flex-col items-center justify-center text-center gap-6 p-8 scanlines relative">
      <ArcadeTitle>{title}</ArcadeTitle>
      {children && <div className="text-gray-300 max-w-sm leading-relaxed">{children}</div>}
    </div>
  );
}
