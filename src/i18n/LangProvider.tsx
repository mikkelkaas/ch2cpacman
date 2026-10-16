import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { storage } from '../lib/storage';
import { pickLang } from './lang';
import type { Lang } from './lang';
import { playerDa } from './player/da';
import type { PlayerStrings } from './player/da';
import { playerEn } from './player/en';
import { playerNb } from './player/nb';

const STRINGS: Record<Lang, PlayerStrings> = { da: playerDa, en: playerEn, nb: playerNb };

interface LangValue {
  lang: Lang;
  t: PlayerStrings;
  setLang: (lang: Lang) => void;
}

// Outside a provider, i.e. on the admin page, shared components stay Danish.
const LangContext = createContext<LangValue>({ lang: 'da', t: playerDa, setLang: () => {} });

function browserLanguages(): readonly string[] {
  return navigator.languages?.length ? navigator.languages : [navigator.language];
}

/** The player's language: saved on the phone, else taken from the browser. Wraps the runner and spectator screens only. */
export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => pickLang(storage.getLang(), browserLanguages()));

  useEffect(() => {
    document.documentElement.lang = lang;
    return () => {
      document.documentElement.lang = 'da';
    };
  }, [lang]);

  const value = useMemo<LangValue>(
    () => ({
      lang,
      t: STRINGS[lang],
      setLang: next => {
        storage.setLang(next);
        setLangState(next);
      },
    }),
    [lang],
  );
  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

/** The player text in the chosen language. */
export function useT(): PlayerStrings {
  return useContext(LangContext).t;
}

export function useLang(): LangValue {
  return useContext(LangContext);
}
