/** The languages the player screens come in. `nb` is Norwegian Bokmål. */
export type Lang = 'da' | 'en' | 'nb';

export const LANGS: readonly { lang: Lang; label: string; name: string }[] = [
  { lang: 'da', label: 'DA', name: 'Dansk' },
  { lang: 'en', label: 'EN', name: 'English' },
  { lang: 'nb', label: 'NO', name: 'Norsk' },
];

function isLang(value: string | null): value is Lang {
  return value === 'da' || value === 'en' || value === 'nb';
}

/** A browser language tag such as `nb-NO` to one of ours, or null. */
function fromTag(tag: string): Lang | null {
  const base = tag.toLowerCase().split('-')[0];
  if (base === 'da') return 'da';
  if (base === 'nb' || base === 'nn' || base === 'no') return 'nb';
  if (base === 'en') return 'en';
  return null;
}

/**
 * The phone's saved choice if it has one, else the first of the browser's
 * languages we have, else English: a phone set to a language we lack is more
 * likely read by someone who knows English than Danish.
 */
export function pickLang(saved: string | null, browser: readonly string[]): Lang {
  if (isLang(saved)) return saved;
  for (const tag of browser) {
    const lang = fromTag(tag);
    if (lang) return lang;
  }
  return 'en';
}
