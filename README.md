# Föreningens Sommarbingo ⚽️

En digital sommarutmaning för fotbollsföreningar (byggd för **Skultuna IS**). Varje
spelare har en egen 5×5-bingobricka med fotbollsövningar i tre svårighetsnivåer.
Avklarade rutor bidrar till en gemensam **lagbricka** som tänds ruta för ruta, det
finns en **topplista** och en **sommarfinal** där allt kan låsas upp för ett
gemensamt ryck på en träning.

Byggd efter designspecen i _Överlämning till Claude Code: Föreningens Sommarbingo_.

## Kom igång

```bash
npm install
npm run dev        # startar Vite på http://localhost:5173
```

Andra kommandon:

```bash
npm run build      # typecheck + produktionsbygge till dist/
npm run preview    # förhandsvisar produktionsbygget
npm test           # kör domänlogikens enhetstester (Vitest)
npm run typecheck  # endast typkontroll
```

### Testa appen

På inloggningssidan finns tre demokoder. Ange en och välj ett namn – inga lösenord.

| Lag            | Kod       | Roll att testa                          |
| -------------- | --------- | --------------------------------------- |
| Flickor 11     | `F11-SOL` | `Alva` (spelare) eller `Daniel` (coach) |
| Flickor 17/18  | `F17-RÖD` | `Karin` (coach)                         |
| Pojkar 13      | `P13-BLÅ` | `Peter` (coach)                         |

All data lagras lokalt i webbläsaren (localStorage). Coach-vyn har en knapp för att
**nollställa demodatan**.

## Teknik & arkitektur

- **React 18 + TypeScript + Vite** (SPA, deployas rakt av på Vercel).
- **Utbytbart datalager.** All dataåtkomst går genom ett `BingoRepository`-interface
  (`src/data/repository.ts`). Standardimplementationen `LocalRepository` använder
  seed-data + localStorage så att appen fungerar direkt. Byt till Supabase genom att
  implementera samma interface (se nedan).
- **Ren domänlogik.** Poäng, tröskel, bingoräkning och topplista ligger som rena,
  testade funktioner i `src/domain/` – oberoende av UI och backend.
- **Tema:bara komponenter.** Alla färger, radier, avstånd och typsnitt är
  CSS-variabler (design-tokens) i `src/index.css`, redo att bytas mot designsystemet
  _Skultuna Heritage_ utan att komponentstrukturen skrivs om.

```
src/
  data/          types, seed-data, localStorage, repository (utbytbart)
  domain/        board, scoring, selectors  + scoring.test.ts
  state/         BingoProvider (React-context: inloggning, val, åtgärder)
  components/    AppBar, BottomNav, BingoBoard, Sheet, TaskSheet, m.fl.
  screens/       Login, MinBricka, Lag, Topplista, Final, Coach
supabase/        schema.sql + seed.sql (redo att koppla på)
```

## Reglerna (implementerade exakt enligt spec)

- **Nivåer:** Lätt = 1p, Medel = 2p, Svår = 3p. Väljs per ruta.
- **Personlig bricka:** 5×5, index 12 = FRI (alltid klar, 0p). Fem i rad = bingo.
  Poäng = summan av nivåernas poäng.
- **Lagbricka:** en ruta tänds när minst `ceil(antal spelare / 2)` spelare klarat den,
  oavsett nivå. Bidragsmärken (initial + färg) visas per ruta, senast klarade får en
  ring, och vid fler än 5 bidrag visas `+N`. Fem tända i rad = lagbingo.
- **Topplista:** rankar spelare efter poäng (svårare nivåer belönas), visar antal rutor
  och personliga bingos. Ny vecka = ny topplista.
- **Veckor & arkiv:** en aktiv vecka i taget; äldre veckor arkiveras och blir
  skrivskyddade men fullt synliga. Ingen data raderas – arkivering är bara en flagga.
- **Sommarfinal:** listar alla veckors resultat. Coach kan _låsa upp alla brickor_,
  vilket gör ännu icke-tända rutor (även i arkiverade veckor) möjliga att klara
  gemensamt.

Domänreglerna täcks av 14 enhetstester i `src/domain/scoring.test.ts` (plus 10 för julkalendern).

## Julkalendern 🎄

Samma idé som sommarbingon, fast för december: fliken **Jul** är en adventskalender
med 24 luckor. Bakom varje lucka finns en fotbollsutmaning i tre nivåer, anpassad för
vintern (det mesta går att göra inomhus med en mjuk boll, några ute i snön och några
handlar om att vara en bra lagkompis). Utmaningarna ligger i `src/data/adventSeed.ts`.

- **En lucka om dagen.** Lucka _n_ öppnas _n_ december. Låsta luckor visar bara en
  nedräkning, ingen tjuvkikning. Missade luckor går att klara i efterhand fram till
  trettondedag jul; därefter är kalendern skrivskyddad.
- **Poäng:** Lätt 1p, Medel 2p, Svår 3p, plus **⭐ +1p** om luckan klaras samma dag som
  den öppnas. Det belönar att vara med varje dag.
- **Lagets julgran:** ett ljus per lucka. Ljuset tänds när minst hälften av lagets
  spelare klarat luckan (samma tröskel som lagbrickan). När alla 24 lyser tänds
  stjärnan. Under granen visas vilka som klarat dagens lucka och en egen topplista.
- **Coach:** under _Coach → Julkalendern_ kan man öppna alla luckor direkt för ett lag
  (för att provköra eller låta laget komma ikapp).
- **Provköra före december:** lägg till `?datum=2026-12-07` i adressen så beter sig
  appen som om det vore 7 december. `?datum=idag` återgår till riktigt datum.

Reglerna ligger som rena funktioner i `src/domain/advent.ts` och täcks av
`src/domain/advent.test.ts`. Befintlig sommardata i webbläsaren migreras automatiskt
(schemaversion 3 → 4); inget raderas.

## Koppla mot Supabase

Din vanliga stack (React + Supabase + Vercel) stöds direkt:

1. Skapa ett Supabase-projekt och kör `supabase/schema.sql` och därefter
   `supabase/seed.sql` i SQL Editor.
2. `npm install @supabase/supabase-js` och lägg projekt-URL + anon-nyckel i `.env`:
   ```
   VITE_SUPABASE_URL=...
   VITE_SUPABASE_ANON_KEY=...
   ```
3. Skapa en `SupabaseRepository` som implementerar `BingoRepository` (samma metoder,
   mot SQL i stället för localStorage) och exportera den som `repository` i
   `src/data/repository.ts`. Fältnamn mappas snake_case ↔ camelCase.

Domänlogiken och alla vyer fungerar oförändrat – bara datalagret byts ut.

## GDPR

Spelarna är minderåriga, så appen är medvetet snål: ingen e-post, inga lösenord,
inga kontaktuppgifter. Endast förnamn (och en färg) lagras. Inloggning sker med en
lag-kod + namnval.

## Öppna frågor från spec (avsnitt 8) – så här är de lösta i v1

- **Delat övningsbibliotek:** veckor ligger på klubbnivå (`team_id = null`) och delas av
  alla lag. Datamodellen stödjer även lag-egna veckor.
- **Coach-roll:** enkel `role`-flagga, ingen serverskyddad behörighet ännu (öppen fråga –
  kräver riktig auth om appen ska driftas publikt).
- **Animationer:** rut-bladet har en tydlig yta för demo-film (`tasks.animation_url`),
  men v1 lanseras utan animationer – fylls på efter hand.
- **Säsongstotal:** sparas inte separat i v1; resultat visas per vecka + i finalen.
