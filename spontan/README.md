# Spontan ⚽️

**Utkast till en app för spontanfotboll.** Säg att du är sugen – på matchspel,
spontanträning, teknik, löpning eller målvaktspass – och se direkt vilka fler som
är det. När flera vill samma sak samtidigt föreslår appen ett pass som någon kan
starta med ett tryck.

Appen ligger i samma repo som _Föreningens Sommarbingo_ men är **helt fristående**:
eget `package.json`, eget bygge, egen datamodell och egen deploy. Den delar bara
arkitekturprinciperna – och mappen.

## Kom igång

```bash
cd spontan
npm install
npm run dev        # startar Vite på http://localhost:5173
```

Andra kommandon:

```bash
npm run build         # typecheck + produktionsbygge till dist/
npm run build:single  # allt i en enda self-contained HTML-fil (förhandsvisning)
npm run preview       # förhandsvisar produktionsbygget
npm test              # 31 enhetstester för domänlogiken (Vitest)
npm run typecheck     # endast typkontroll
```

### Testa utkastet

Områdeskod: **`SKULTUNA`**. Välj sedan en av demoprofilerna (t.ex. `Milo`, som är
värd för kvällens match) eller skapa en egen. Inga lösenord, ingen e-post.

Demodatan innehåller ett pass som saknar två spelare, ett par framtida pass, ett
avslutat pass och sex personer med aktiv sugen-status – så att flödets förslag
har något att räkna på. Nollställ demodatan under **Jag**.

## Vad appen löser

Spontanfotboll dör sällan av att ingen vill spela. Den dör av att ingen vet att
någon annan vill. Därför är appen byggd kring två saker:

| Begrepp                      | Vad det är                                                          |
| ---------------------------- | ------------------------------------------------------------------- |
| **Sugen-status** (`intents`) | "Jag vill spela match någon kväll den här veckan." Ingen tid bokas.  |
| **Pass** (`sessions`)        | "Torsdag 18:30 på IP, minst 8 personer." Något att svara ja på.      |

Sugen-status är det låga tröskelsteget: den kostar inget att sätta, den binder
inte, och den försvinner av sig själv efter några dagar. Appen letar upp överlapp
mellan sugna och gör dem till färdiga passförslag – då är det bara att trycka
_Starta passet_, och tid, plats och typ är redan ifyllda.

## Skärmarna

| Vy                | Vad man gör där                                                        |
| ----------------- | ---------------------------------------------------------------------- |
| **Passen** (`/`)  | Förslag från överlappande sugen-status + allt som redan är på gång.     |
| **Sugen**         | Sätter/ändrar sin egen sugen-status och ser andras.                     |
| **Starta**        | Skapar ett pass: typ, plats, tid, minsta antal, nivå, notering.         |
| **Passet**        | Vilka kommer, hur många saknas, lagindelning, inbjudan att kopiera.     |
| **Jag**           | Profil, mina pass, min sugen-status, nollställ demodata.                |

## Reglerna som är implementerade

- **Blir det av?** Varje pass har ett `minPlayers`. Flödet visar "behöver 3 till"
  tills tröskeln nås, sedan "blir av – 9 anmälda".
- **Fullt pass.** Sätts `maxPlayers` fördelas platserna i anmälningsordning;
  överskjutande "ja" blir **reserver** i kö. Reserver räknas inte in i tröskeln.
- **Ja / kanske / nej.** Alla tre sparas – "nej" är också information ("hen har
  sett passet"). Byte av svar behåller köplatsen.
- **Värden** anmäls automatiskt, kan ställa in passet och återuppta det.
- **Sugen-status matchas** på aktivitet, veckodag och del av dygnet. Tomma val
  betyder "spelar ingen roll" – hellre bli tillfrågad en gång för mycket.
- **Förslag** kräver minst två överlappande sugna, visar bara det bästa förslaget
  per aktivitet och föreslår ett rimligt klockslag (morgon 08, lunch 12,
  eftermiddag 16, kväll 18).
- **Lagindelning** på plan: alla anmälda delas i två (eller tre) jämna lag med en
  deterministisk lottning, så att alla telefoner visar samma lag. Lotta om hur
  många gånger som helst.

Reglerna täcks av 31 enhetstester i `src/domain/`.

## Teknik & arkitektur

- **React 18 + TypeScript + Vite** (SPA, deployas rakt av på Vercel).
- **Utbytbart datalager.** All dataåtkomst går genom `SpontanRepository`
  (`src/data/repository.ts`). `LocalRepository` använder demodata + localStorage
  så att utkastet fungerar direkt i webbläsaren.
- **Ren domänlogik.** Passlägen, reservkö, matchning och lagindelning ligger som
  rena, testade funktioner i `src/domain/` – utan UI- och backend-beroenden.
  Klockan skickas alltid in som argument, så allt går att testa.
- **Tema-bara komponenter.** Alla färger, radier och avstånd är CSS-variabler i
  `src/index.css`. Spontan har en egen identitet (planens gröna) men samma
  tokenstruktur som Sommarbingo – byt värdena för att tema om till en förening.

```
spontan/
  src/
    data/          types, demodata, localStorage, repository (utbytbart)
    domain/        sessions, intents, teams, selectors + tester
    state/         SpontanProvider (React-context: profil, klocka, åtgärder)
    components/    AppBar, BottomNav, SessionCard, ResponseButtons, Avatar
    screens/       Passen, Sugen, Starta, Passet, Jag, Inloggning
    lib/           datum/tid, texter, uid
  supabase/        schema.sql (redo att koppla på)
```

## Koppla mot Supabase

Samma stack som Sommarbingo (React + Supabase + Vercel):

1. Skapa ett Supabase-projekt och kör `supabase/schema.sql` i SQL Editor.
2. `npm install @supabase/supabase-js` och lägg projekt-URL + anon-nyckel i `.env`:
   ```
   VITE_SUPABASE_URL=...
   VITE_SUPABASE_ANON_KEY=...
   ```
3. Skapa en `SupabaseRepository` som implementerar `SpontanRepository` (samma
   metoder, mot SQL i stället för localStorage) och exportera den som
   `repository` i `src/data/repository.ts`. Fältnamn mappas snake_case ↔ camelCase.

Domänlogiken och alla vyer fungerar oförändrat – bara datalagret byts ut.

## GDPR

Utkastet är medvetet snålt: ingen e-post, inga lösenord, inga kontaktuppgifter,
ingen platsdelning. Endast namn och en färg lagras, och sugen-status har ett
utgångsdatum. Om appen ska användas av minderåriga bör den hållas kvar på den
nivån – kravet på riktig inloggning uppstår först när data lämnar enheten.

## Vad som medvetet inte är byggt

Se `KONCEPT.md` för hela resonemanget. Kort: notiser, riktig inloggning,
kartor/positionering, återkommande pass och närvarohistorik är utelämnade i
utkastet – de kräver beslut som bör tas innan de byggs, inte efteråt.
