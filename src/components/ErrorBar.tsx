import { useT } from '../i18n/LangProvider';

export default function ErrorBar({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const t = useT();
  return (
    <div role="alert" className="flex items-center justify-between gap-3 bg-ghost-red text-black px-4 py-2 font-arcade text-[10px] sm:text-xs">
      <span>{message}</span>
      {onRetry && (
        <button onClick={onRetry} className="underline uppercase">
          {t.retry}
        </button>
      )}
    </div>
  );
}
