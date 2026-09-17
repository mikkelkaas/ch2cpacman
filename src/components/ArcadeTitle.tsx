import type { ReactNode } from 'react';

export default function ArcadeTitle({ children, className = '', size = 'lg' }: { children: ReactNode; className?: string; size?: 'sm' | 'lg' | 'xl' }) {
  const sizes = { sm: 'text-sm sm:text-base', lg: 'text-xl sm:text-3xl', xl: 'text-3xl sm:text-5xl' };
  return <h1 className={`font-arcade text-pac glow-pac leading-relaxed ${sizes[size]} ${className}`}>{children}</h1>;
}
