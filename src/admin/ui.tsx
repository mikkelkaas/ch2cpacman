import type { ButtonHTMLAttributes, ReactNode } from 'react';

/** Plain admin widgets. The arcade look is for players only. */

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' };

export function Button({ variant = 'secondary', className = '', ...rest }: ButtonProps) {
  const colors =
    variant === 'primary'
      ? 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700 disabled:bg-blue-300 disabled:border-blue-300'
      : variant === 'danger'
        ? 'bg-white text-red-700 border-red-300 hover:bg-red-50'
        : 'bg-white text-gray-800 border-gray-300 hover:bg-gray-50';
  return <button {...rest} className={`text-sm font-medium px-3 py-1.5 rounded-md border disabled:cursor-not-allowed transition-colors ${colors} ${className}`} />;
}

export function Panel({ title, action, children }: { title: ReactNode; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="bg-white border border-gray-200 rounded-lg shadow-sm">
      <header className="flex items-center justify-between gap-3 px-4 py-3 border-b border-gray-200">
        <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
        {action}
      </header>
      <div className="p-4 flex flex-col gap-3">{children}</div>
    </section>
  );
}

export const inputClass = 'border border-gray-300 rounded-md px-2 py-1 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500';
