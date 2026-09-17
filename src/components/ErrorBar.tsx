import { da } from '../i18n/da';

export default function ErrorBar({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex items-center justify-between gap-3 bg-ghost-red text-black px-4 py-2 font-arcade text-[10px] sm:text-xs">
      <span>{message}</span>
      {onRetry && (
        <button onClick={onRetry} className="underline uppercase">
          {da.retry}
        </button>
      )}
    </div>
  );
}
