/** What the rules list depends on: the game's settings and which dot kinds it has. */
export interface RulesInput {
  minutes: number;
  ghosts: boolean;
  penalty: number;
  bonus: number;
  hasPower: boolean;
  hasDouble: boolean;
  hungry: boolean;
  lateStep: number;
  latePenalty: number;
  latePenaltyMax: number;
}

/** Everything a runner or spectator reads. English and Norwegian follow this shape. */
export const playerDa = {
  title: 'PAC-LIVE',
  loading: 'HENTER…',
  fetchFailed: 'Kunne ikke hente data',
  retry: 'Prøv igen',
  notSetUp: 'Spillet er ikke sat op endnu',
  notSetUpHint: 'Spørg lederen ved posten.',

  // Runner
  enterCode: 'INDTAST HOLDKODE',
  codePlaceholder: 'ABCD',
  join: 'VIDERE',
  unknownCode: 'Ukendt kode',
  changeTeam: 'Skift hold',
  howToPlay: 'SÅDAN SPILLER I',
  rules: (s: RulesInput) => [
    { icon: '⏱', text: `I har ${s.minutes} minutter.` },
    { icon: '•', text: 'Kortet viser prikker. Løb hen til dem.' },
    { icon: 'ᗧ', text: 'Telefonen spiser prikken, når I er tæt nok på. I skal ikke trykke.' },
    { icon: '★', text: 'Jo længere væk, jo flere point.' },
    ...(s.ghosts ? [{ icon: '👻', text: `Spøgelser jager jer. Fanger de jer, mister I ${s.penalty} point. Løb!` }] : []),
    ...(s.ghosts ? [{ icon: '🧱', text: 'Spøgelser går lige igennem huse, hegn og krat. I kan ikke gemme jer bag noget.' }] : []),
    ...(s.ghosts && s.hungry ? [{ icon: '🔥', text: 'Jo længere et spøgelse jager uden at fange jer, jo hurtigere bliver det.' }] : []),
    ...(s.ghosts && s.hasPower ? [{ icon: '◉', text: `Spis en stor prik, så bliver spøgelserne blå. Fang dem for ${s.bonus} point.` }] : []),
    ...(s.hasDouble ? [{ icon: '×2', text: 'Prikker med ×2 giver dobbelte point i ét minut.' }] : []),
    { icon: '⏰', text: 'Når tiden er gået, er spillet slut. Point tæller kun inden for tiden.' },
    ...(s.latePenalty > 0
      ? [{ icon: '⌂', text: `Vær tilbage ved start, når tiden er gået. Hver ${s.lateStep} sekunder for sent koster ${s.latePenalty} point, højst ${s.latePenaltyMax}.` }]
      : []),
    { icon: '📱', text: 'Hold skærmen tændt og telefonen i hånden.' },
  ],
  double: 'DOBBELT',
  runHome: 'LØB HJEM!',
  lateLabel: 'FOR SENT',
  homeDistance: (m: number) => `${m} m til start`,
  latePoints: (n: number) => `-${n} point`,
  lateLine: (n: number) => (n === 1 ? '1 point tabt for at komme for sent hjem' : `${n} point tabt for at komme for sent hjem`),
  homeInTime: 'Hjemme til tiden!',
  caughtBanner: (points: number) => `FANGET! -${points}`,
  ghostEatenBanner: (points: number) => `+${points}`,
  ghostsCaught: (n: number) => (n === 1 ? 'fanget 1 gang' : `fanget ${n} gange`),
  ghostsEaten: (n: number) => (n === 1 ? '1 spøgelse spist' : `${n} spøgelser spist`),
  next: 'VIDERE',
  photoTitle: 'HOLDFOTO',
  photoHint: 'Stil jer sammen, så hele holdet er med. Fotoet kommer på tavlen ved posten.',
  takePhoto: 'TAG FOTO',
  retakePhoto: 'TAG ET NYT',
  usePhoto: 'BRUG FOTOET',
  skipPhoto: 'Spring over',
  uploadingPhoto: 'SENDER…',
  photoFailed: 'Kunne ikke sende fotoet. Prøv igen, eller spring over.',
  readyQuestion: 'Kig på kortet og læg en plan. Tiden starter først, når I trykker.',
  pressStart: 'TRYK START',
  starting: 'STARTER…',
  startFailed: 'Kunne ikke starte, prøv igen',
  ready: 'READY!',
  gameOver: 'GAME OVER',
  score: 'SCORE',
  time: 'TID',
  pelletsEaten: (n: number) => (n === 1 ? '1 prik spist' : `${n} prikker spist`),
  points: (n: number) => (n === 1 ? '1 point' : `${n} point`),
  waitingForNetwork: 'venter på netværk…',
  weakSignal: 'SVAGT GPS-SIGNAL',
  yourTeam: 'HOLD',
  locationDenied: 'Vi skal bruge din placering',
  locationDeniedHint: 'Giv siden lov til at bruge placering i browserens indstillinger, og indlæs siden igen.',
  locationWaiting: 'Finder jeres placering…',
  finalScore: 'JERES SCORE',
  wellPlayed: 'Godt løbet! Gå tilbage til posten.',
  leaveGame: 'Forlad spillet',
  leaveGameConfirm: 'Forlad spillet? Telefonen glemmer holdet, så et nyt hold kan tilmelde sig. Pointene er gemt.',
  leaveWaitingUpload: 'Sender de sidste point…',
  showRules: 'Regler',
  close: 'LUK',
  mute: 'Lyd fra',
  unmute: 'Lyd til',

  // Spectator
  spectator: 'TILSKUER',
  spectatorHint: 'I kigger med på løberens telefon. Denne telefon sporer ikke.',
  tapForSound: 'Tryk på skærmen for at slå lyden til',
  waitingForStart: 'Venter på at holdet starter…',
  waitingForRunner: 'VENTER PÅ LØBERENS TELEFON…',
  lastSeen: (s: number) => `SIDST SET FOR ${s} S SIDEN`,
  addSpectator: 'Tilføj tilskuer',
  spectatorQrTitle: 'SCAN FOR AT KIGGE MED',
  spectatorQrHint: 'Tilskueren ser kortet, spøgelserne og scoren, men sporer ikke.',
  roleRunner: 'LØBER',
  roleSpectator: 'TILSKUER',
  roleQuestion: 'HVEM ER DENNE TELEFON?',
};

export type PlayerStrings = typeof playerDa;
