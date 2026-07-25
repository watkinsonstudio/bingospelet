# Spontan – konceptutkast

Detta är utkastets "varför": problembilden, de val som redan är gjorda i koden,
och de frågor som bör besvaras innan nästa version byggs.

## 1. Problemet

Spontanfotboll dör sällan av att ingen vill spela. Den dör av att **ingen vet att
någon annan vill**. Dagens lösning är en gruppchatt där någon skriver "någon som
vill spela ikväll?" – och sedan:

- frågan drunknar bland annat snack,
- svaren kommer utspridda ("kanske", "hör av mig sen", en tumme upp),
- ingen vet om det blir tillräckligt många förrän det är för sent,
- den som frågade får ta hela ansvaret, varje gång.

Resultatet är att många är sugna samtidigt utan att det blir något av det.

## 2. Målgrupp

1. **Ungdomslag och deras föräldrar** i en förening – vill hitta extra bollkänsla
   mellan träningarna.
2. **Vuxna motionsspelare** i en ort eller ett bostadsområde – "torsdagsgänget"
   som ibland blir av och ibland inte.
3. **Enskilda** som saknar ett gäng: målvakten som vill ha skyttar, den som vill
   ha sällskap på löprundan.

Utkastet är byggt för fall 1 och 2, med en **områdeskod** som gemensam nämnare
(`SKULTUNA`). Det håller kretsen liten nog att man känner igen namnen.

## 3. Kärnidén: två begrepp

| Begrepp           | Kostar att sätta | Binder | Lever                    |
| ----------------- | ---------------- | ------ | ------------------------ |
| **Sugen-status**  | Nästan inget     | Nej    | Några dagar, dör själv   |
| **Pass**          | Kräver ett beslut| Ja     | Till dess det varit      |

Poängen är avståndet mellan dem. En sugen-status är gratis att sätta: du säger
_vad_ och _ungefär när_, inte _när_. När appen ser att flera vill samma sak
samtidigt gör den överlappet synligt – och då krävs bara ett tryck för att göra
det till ett riktigt pass med tid och plats.

Det är den enda funktionen appen egentligen behöver ha rätt i. Allt annat är
hygien.

## 4. Designprinciper

1. **Ingen ska behöva vara den som alltid frågar.** Appen ställer frågan.
2. **Lågt åtagande före högt.** Sugen-status före anmälan, "kanske" är ett
   fullvärdigt svar.
3. **Svara på tre sekunder.** Ja/kanske/nej finns direkt i flödet, utan att man
   öppnar passet.
4. **Alltid tydligt om det blir av.** Varje pass visar "behöver X till" eller
   "blir av". Det är den enda siffra som betyder något.
5. **Inget gammalt skräp.** Sugen-status har utgångsdatum. Ingen ska behöva
   städa.
6. **Snålt med personuppgifter.** Namn och en färg. Inget mer behövs för att
   spela fotboll.

## 5. Flöden

**A. Jag är sugen (10 sekunder)**
Sugen → välj aktiviteter, dagar, tid på dygnet → spara. Klart. Andra ser dig, och
appen räknar med dig i förslagen.

**B. Appen hittar ett gäng**
Flödet: "5 sugna på matchspel – imorgon kväll" → _Starta passet_ → formuläret är
redan ifyllt med typ och tid → välj plats → passet finns.

**C. Blir det av?**
Passet visar "behöver 2 till". De sugna som inte svarat listas separat, med en
färdig inbjudningstext att klistra in i lagchatten. Vid minsta antal slår
statusen om till "blir av".

**D. På plan**
_Dela in i två lag_ ger samma lag på allas telefoner, med västfärg. Lotta om tills
någon är nöjd.

## 6. Avgränsningar i utkastet

Följande är medvetet **inte** byggt, eftersom det kräver beslut snarare än kod:

| Utelämnat                    | Varför                                                                 |
| ---------------------------- | ---------------------------------------------------------------------- |
| Notiser (push/SMS/e-post)    | Är förmodligen skillnaden mellan att appen används och inte – men kräver riktig inloggning och ett val av kanal. |
| Riktig autentisering         | Områdeskod räcker för utkast och en känd krets, inte för publik drift. |
| Karta och positionering      | Platser räcker som en lista i en ort. Kartor drar in nya krav (GDPR, kostnad). |
| Återkommande pass            | "Varje torsdag 18:30" är efterfrågat men gör datamodellen dubbelt så stor. |
| Närvarostatistik och poäng   | Frestande (Sommarbingo har det) men riskerar att göra spontanfotboll till en prestation. |
| Chatt i passet               | Alla har redan en chatt. Appen ska svara på _blir det av_, inte ersätta snacket. |

## 7. Nästa steg (förslag)

**v0.2 – gör det verkligt**

- Supabase enligt `supabase/schema.sql`, en `SupabaseRepository`.
- Inloggning: magisk länk eller anonym Supabase-session kopplad till områdeskoden.
- Delningsbar länk till ett pass som fungerar för den som inte skapat profil än.

**v0.3 – gör det levande**

- Notiser: "3 till behövs till ikväll", "passet blev av", "någon startade det du
  var sugen på".
- Påminnelse dagen innan för alla som svarat "kanske".

**v0.4 – gör det till en vana**

- Återkommande pass.
- Föreningsvy: flera områden/lag under samma klubb.
- Enkel statistik för den som driver planen (hur ofta blir det av, vilka tider
  fungerar).

## 8. Öppna frågor

1. **Vem äger området?** Vem delar ut områdeskoden, och vad händer när någon
   missbrukar den? Behövs en "ansvarig" med rätt att ta bort pass?
2. **Minderåriga.** Ska ungdomar och vuxna vara i samma område? Vem ansvarar för
   att en vuxen som dyker upp på ett ungdomspass är känd i föreningen?
3. **Kritisk massa.** Appen är värdelös under ~15 personer i ett område. Hur
   startar man ett område – via ett befintligt lag, eller via föreningen?
4. **Notiskanal.** Push kräver installerad app (PWA räcker en bit). Är e-post
   eller en enkel Slack/WhatsApp-bot en bättre första kanal?
5. **Relation till Sommarbingo.** Ska de dela profiler och förening längre fram,
   eller förbli helt separata appar som bara råkar bo i samma repo?
