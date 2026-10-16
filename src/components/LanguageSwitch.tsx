import { LANGS } from '../i18n/lang';
import { useLang } from '../i18n/LangProvider';
import { sound } from '../lib/sound';

/** DA · EN · NO. Each label is in its own language, so anyone can find theirs. */
export default function LanguageSwitch({ className = '' }: { className?: string }) {
  const { lang, setLang } = useLang();
  return (
    <div role="group" aria-label="Sprog / Language / Språk" className={`flex gap-1 ${className}`}>
      {LANGS.map(option => (
        <button
          key={option.lang}
          type="button"
          lang={option.lang}
          aria-label={option.name}
          aria-pressed={lang === option.lang}
          onClick={() => {
            sound.blip();
            setLang(option.lang);
          }}
          className={`font-arcade text-[10px] px-2 py-1 border-2 ${lang === option.lang ? 'border-pac text-pac' : 'border-maze text-blue-400'}`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
