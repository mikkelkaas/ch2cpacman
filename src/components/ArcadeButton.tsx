import type { ButtonHTMLAttributes } from 'react';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'danger' };

export default function ArcadeButton({ variant = 'primary', className = '', ...rest }: Props) {
  const colors =
    variant === 'primary'
      ? 'bg-pac text-black border-pac hover:bg-yellow-300 disabled:bg-yellow-900 disabled:text-yellow-700 disabled:border-yellow-900'
      : variant === 'danger'
        ? 'bg-black text-ghost-red border-ghost-red hover:bg-red-950'
        : 'bg-black text-pac border-maze hover:bg-blue-950';
  return (
    <button
      {...rest}
      className={`font-arcade text-xs sm:text-sm uppercase px-4 py-3 border-4 rounded-none active:translate-y-0.5 transition-colors disabled:cursor-not-allowed ${colors} ${className}`}
    />
  );
}
