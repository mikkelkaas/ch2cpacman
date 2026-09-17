/** No 0/O or 1/I: the code is read aloud and typed on a phone in the woods. */
export const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const CODE_LENGTH = 4;

export function generateTeamCode(existing: Iterable<string>, rand: () => number = Math.random): string {
  const taken = new Set(existing);
  for (;;) {
    let code = '';
    for (let i = 0; i < CODE_LENGTH; i++) {
      code += CODE_ALPHABET[Math.min(CODE_ALPHABET.length - 1, Math.floor(rand() * CODE_ALPHABET.length))];
    }
    if (!taken.has(code)) return code;
  }
}

export function normalizeCode(input: string): string {
  return [...input.toUpperCase()].filter(ch => CODE_ALPHABET.includes(ch)).join('');
}
