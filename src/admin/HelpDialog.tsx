import { useEffect, useState } from 'react';
import { Button } from './ui';

/** A short in-app guide for the person running the station. Danish, like the rest. */
export default function HelpButton() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      <Button onClick={() => setOpen(true)} aria-haspopup="dialog">
        Hjælp
      </Button>
      {open && (
        <div className="fixed inset-0 z-[1000] bg-black/40 flex items-start justify-center p-4 overflow-y-auto" onClick={() => setOpen(false)}>
          <div role="dialog" aria-modal="true" aria-labelledby="help-title" className="bg-white rounded-lg shadow-xl max-w-2xl w-full my-8 p-6 text-sm text-gray-800 leading-relaxed" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-4 mb-4">
              <h2 id="help-title" className="text-lg font-semibold text-gray-900">
                Sådan kører du en post
              </h2>
              <Button onClick={() => setOpen(false)}>Luk</Button>
            </div>

            <Section title="Idéen">
              <p>
                Et hold får en telefon med et kort fuld af prikker. De trykker START og har et fast antal minutter til at løbe rundt og
                spise så mange prikker som muligt. Telefonen spiser en prik af sig selv, når den er tæt nok på. Prikker langt fra
                starten bør give flere point. Holdene kommer ét ad gangen i løbet af dagen; hvert hold har sit eget ur.
              </p>
            </Section>

            <Section title="1. Opsætning, inden holdene kommer">
              <ol className="list-decimal pl-5 space-y-1">
                <li>
                  <b>Opret et spil</b> på forsiden (Alle spil) og åbn det. Hvert spil har egne prikker, hold og stilling.
                </li>
                <li>
                  <b>Startpunkt:</b> tryk <i>Sæt startpunkt</i> og klik på kortet, hvor holdene står, når de trykker START.
                </li>
                <li>
                  <b>Minutter pr. hold:</b> hvor lang tid hvert hold har. 10 er et godt udgangspunkt.
                </li>
                <li>
                  <b>Prikker:</b> sæt <i>Point for nye prikker</i> og <i>Type</i>, og klik på kortet én gang pr. prik. Skift point og klik
                  videre. Træk en prik for at flytte den; træk i kortet for at panorere. Listen er sorteret efter afstand fra start,
                  så du let kan give de fjerne flere point.
                </li>
                <li>
                  <b>Radius</b> er, hvor tæt telefonen skal være. 5 m er standard. Under tætte træer eller hvis GPS'en driller, sæt 10 til
                  15 m på de prikker.
                </li>
                <li>
                  <b>Hold:</b> skriv navnene, ét pr. linje, og tryk Tilføj. Hver får en kode på 4 tegn. Koden er det eneste, holdet skal
                  taste, og den virker på tværs af spil.
                </li>
                <li>
                  <b>Korttema</b> vælger farverne på løbernes kort. Prøv dem på en telefon i dagslys på stedet.
                </li>
              </ol>
            </Section>

            <Section title="Priktyper">
              <ul className="list-disc pl-5 space-y-1">
                <li>
                  <b>Almindelig:</b> giver sine point.
                </li>
                <li>
                  <b>Power:</b> giver sine point og gør alle spøgelser blå i et stykke tid. Blå spøgelser flygter, og fanger holdet ét,
                  får de bonuspoint.
                </li>
                <li>
                  <b>Dobbelt:</b> giver sine point og fordobler alle prikker, holdet spiser i det næste minut. Ikke sig selv, ikke
                  spøgelsesbonus.
                </li>
              </ul>
            </Section>

            <Section title="Spøgelser">
              <p>
                Spøgelserne findes kun på telefonen. De venter et forspring og går derefter lige mod holdets seneste GPS-position uden
                hensyn til hegn og krat. De er sultne: fra <i>Fart</i> stiger de til <i>Topfart</i> i løbet af <i>Op i topfart efter</i>{' '}
                sekunder, talt fra de slippes løs eller sidst fangede nogen, og et spøgelse i topfart gløder rødt. En spejder løber
                omkring 9 km/t, så med standardtallene indhenter de holdet efter et minut eller to. Sæt topfarten lig farten for
                spøgelser med fast fart. Kommer et inden for 10 m, mister holdet point og er immunt i 20 sekunder, mens spøgelset hopper
                langt væk. Inden for 40 m lyder en sirene. Alle tal står under <i>Spøgelser</i> i Indstillinger; sæt antallet til 0 for
                at slå dem fra. Er det for hårdt på dagen, så sæt point tabt til 1 eller farten ned.
              </p>
            </Section>

            <Section title="Hjem igen">
              <p>
                Holdet skal være tilbage ved startpunktet, når tiden er gået. Er de det ikke, skifter telefonen til <b>LØB HJEM!</b>{' '}
                med en rød linje til starten, og for hver <i>Straf hver</i> sekunder for sent mister de <i>Point tabt pr. straf</i>,
                indtil de er inden for <i>Hjemmeradius</i> af starten eller loftet <i>Højst tabt for sent</i> er nået. Så viser den GAME OVER. Telefonen stempler selv, når GPS'en
                ser den hjemme; ser du holdet komme før telefonen gør, så tryk <b>Hjemme</b> på holdet under Hold. Ingen bonus for at
                komme tidligt. Sæt point tabt til 0 for at slå reglen fra.
              </p>
            </Section>

            <Section title="2. Når et hold kommer">
              <ol className="list-decimal pl-5 space-y-1">
                <li>Åbn løbersiden på telefonen (link øverst) og tast holdets kode.</li>
                <li>
                  Holdet læser reglerne og trykker Videre. Så tager de et <b>holdfoto</b>, som kommer i stillingen her; de kan springe det
                  over.
                </li>
                <li>De kigger på kortet og planlægger.</li>
                <li>
                  Når de trykker <b>TRYK START</b>, starter deres ur. Stillingen her viser dem inden for 10 sekunder.
                </li>
                <li>
                  Når tiden er gået, og holdet er ved starten, viser telefonen GAME OVER og deres score. Er de ikke, løber de hjem med
                  voksende straf, se <i>Hjem igen</i>. Prikker spist efter tiden tæller ikke, men de har 30 sekunders nåde til at få de
                  sidste sendt op.
                </li>
              </ol>
              <p className="mt-2">
                Telefonen skal have lov til at bruge placering, og skærmen skal blive tændt. Mister den signal, gemmer den prikkerne
                og sender dem, når der er net igen. Scoren på telefonen tæller dem med det samme.
              </p>
            </Section>

            <Section title="Stilling, nulstil og slet">
              <ul className="list-disc pl-5 space-y-1">
                <li>
                  <b>Stilling</b> opdateres hvert 10. sekund. Klik på et hold for at se, hvad de spiste, fangster og spiste spøgelser.
                  Point = prikker × dobbelt + spøgelsesbonus − fangster − for sent hjem, aldrig under 0.
                </li>
                <li>
                  <b>Hjemme</b> stempler holdet som tilbage ved starten nu, hvis telefonen ikke selv nåede det.{' '}
                  <b>Nulstil</b> sletter holdets starttid, hjemkomst og alle deres point, så de kan løbe igen. Telefonen går tilbage til reglerne,
                  når den genindlæses.
                </li>
                <li>
                  <b>Slet</b> fjerner holdet helt. <b>Slet spil</b> på forsiden fjerner alt i spillet. Ingen af delene kan fortrydes.
                </li>
              </ul>
            </Section>

            <Section title="Gode råd">
              <ul className="list-disc pl-5 space-y-1">
                <li>Gå selv en prik eller to igennem med en telefon, inden det første hold kommer.</li>
                <li>Undgå prikker lige ved siden af hinanden; GPS'en er sjældent bedre end 5 til 10 m.</li>
                <li>Hold telefonen i hånden, ikke i lommen; nogle telefoner stopper GPS'en, når skærmen er låst.</li>
                <li>Lad admin-siden stå åben på en computer; den er ikke beskyttet, så del ikke adressen.</li>
              </ul>
            </Section>
          </div>
        </div>
      )}
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-4">
      <h3 className="font-semibold text-gray-900 mb-1">{title}</h3>
      {children}
    </section>
  );
}
