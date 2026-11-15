import type { AdventCalendar, AdventDoor, AdventPlace } from './types';

// ---------------------------------------------------------------------------
// Adventskalendern: samma idé som sommarbingon (utmaningar i tre nivåer, poäng,
// lagets gemensamma framsteg) men en lucka om dagen 1–24 december.
// Utmaningarna är anpassade för vintern: de flesta går att göra inomhus med en
// mjuk boll, några ute i snön och några handlar om att vara en bra lagkompis.
// ---------------------------------------------------------------------------

export const ADVENT_CALENDAR_ID = 'advent-2026';

export const adventCalendar = (clubId: string): AdventCalendar => ({
  id: ADVENT_CALENDAR_ID,
  clubId,
  year: 2026,
  title: 'Julkalendern',
});

// [dag, emoji, titel, plats, ingress, Lätt, Medel, Svår]
type DoorRow = [number, string, string, AdventPlace, string, string, string, string];

const DOORS: DoorRow[] = [
  [1, '🎅', 'Tomtens jonglering', 'inne',
    'Tomten har övat jonglering hela året i verkstaden. Hinner du ikapp honom?',
    '10 jongleringar i rad', '25 jongleringar i rad', '50 jongleringar i rad'],
  [2, '🧦', 'Strumptouchen', 'inne',
    'Ta av skorna och kör i strumplästen. Tå-touch på bollen, växla fot varje gång.',
    '50 tå-touchar', '100 tå-touchar på under 1 minut', '200 tå-touchar på under 2 minuter'],
  [3, '❄️', 'Snöängelsplankan', 'inne',
    'Ligg still som en snöängel, fast på armbågarna. Raka i ryggen!',
    'Planka i 30 sekunder', 'Planka i 60 sekunder', 'Planka 90 sekunder + sidoplanka 30 sekunder per sida'],
  [4, '🎁', 'Ge bort en övning', 'hemma',
    'Den bästa julklappen är den man ger. Lär någon hemma något du kan.',
    'Visa en övning för någon i familjen', 'Lär någon jonglera 3 gånger i rad', 'Håll ett eget 10-minuterspass för syskon eller kompisar'],
  [5, '⭐', 'Svagfotsstjärnan', 'inne',
    'Den svaga foten vill också ha julklappar. Passa mot en vägg (fråga först!) eller en vält soffa.',
    '20 pass med svaga foten', '40 pass med svaga foten', '60 pass med svaga foten på 2 minuter'],
  [6, '🎄', 'Granslalom', 'överallt',
    'Ställ upp en skog av "granar": flaskor, skor eller koner. Dribbla dig igenom utan att fälla någon.',
    'Slalom genom 5 granar', 'Slalom genom 8 granar, båda fötter', '8 granar på under 12 sekunder'],
  [7, '🦶', 'Nissens snabba fötter', 'inne',
    'Nissarna springer tyst och snabbt. Sula bollen fram och tillbaka, eller växla fötter ovanpå den.',
    'Sula fram och tillbaka i 30 sekunder', '1 minut utan att tappa bollen', '1 minut och byt fot vid varje touch'],
  [8, '🪢', 'Renens hopprep', 'överallt',
    'Renarna måste vara starka i benen för att dra släden. Hopprep eller hoppa på stället.',
    '50 hopp', '150 hopp', '300 hopp (eller 3 minuter non-stop)'],
  [9, '🍪', 'Pepparkaksfintan', 'inne',
    'Bryt av som en pepparkaka! Lär dig en finta, till exempel en överstegsfinta eller en Cruyff-vändning.',
    'Lär dig en ny finta', 'Gör fintan 5 gånger per fot i fart', 'Kombinera två fintor förbi en "försvarare" (en stol)'],
  [10, '🧤', 'Vinterinkastet', 'ute',
    'Inkast med vantar och vinterjacka är svårare än det låter. Båda fötterna i marken!',
    '5 korrekta inkast', 'Kasta 10 meter med rätt teknik', 'Kasta 15 meter eller längre, korrekt'],
  [11, '🎯', 'Klappjakten', 'överallt',
    'Ställ upp en kartong som mål. Varje träff är ett paket under granen.',
    '3 av 10 i kartongen', '6 av 10 i kartongen', '8 av 10 i kartongen från 7 meter'],
  [12, '🥣', 'Tomtegröten', 'hemma',
    'Inga mål görs på tom mage. Den här luckan handlar om bränsle och sömn.',
    'Ät frukost 3 dagar i rad', 'Drick 6 glas vatten och ät en frukt varje dag i 3 dagar', 'Hjälp till att laga en hel middag'],
  [13, '🕯️', 'Ljus i mörkret', 'ute',
    'Luciadagen! Sätt på reflexen och ge dig ut i vintermörkret, gärna med någon vuxen.',
    'Gå en 20 minuters promenad med reflex', 'Jogga 2 km med reflex', 'Spring 3 km med reflex'],
  [14, '🎬', 'Julfilmen', 'hemma',
    'Dags för film i soffan, fast med fotboll. Plocka en idé från proffsen.',
    'Se ett matchklipp och härma en rörelse', 'Filma dig själv göra en övning och jämför', 'Se en match och skriv ner 3 saker du lärde dig'],
  [15, '⛄', 'Snögubbens ben', 'inne',
    'En snögubbe står stadigt. Det ska du också göra efter de här benövningarna.',
    '15 knäböj', '3 × 15 knäböj', '3 × 20 knäböj + 10 utfallssteg per ben'],
  [16, '🔔', 'Klockan som nickar', 'inne',
    'Bollen är en klocka och huvudet är kläppen. Använd en mjuk boll eller ballong inomhus.',
    '5 nickar mot vägg eller med ballong', '10 nickar i rad med en vuxen eller kompis', '5 nickjongleringar i rad utan att tappa'],
  [17, '🤶', 'Hjälptomten', 'hemma',
    'En bra lagkompis hjälper till. Gör något för någon annan utan att bli tillfrågad.',
    'Duka fram och av efter middagen', 'Hjälp till hemma med något hela dagen', 'Gör något snällt för en granne eller någon äldre'],
  [18, '✨', 'Glitterjongleringen', 'inne',
    'Variation är kryddan i julmaten. Fot, lår, huvud, i valfri ordning.',
    '10 jongleringar med fötterna', 'Fot–lår–fot 10 gånger', 'Fot–lår–huvud i en serie, 15 träffar'],
  [19, '💌', 'Julhälsningen', 'överallt',
    'Laget är ett lag även på jullovet. Peppa någon!',
    'Skicka en peppig julhälsning till en lagkompis', 'Träffa en lagkompis och passa i 15 minuter', 'Ordna en snöfotbollsmatch med minst 4 spelare'],
  [20, '🦌', 'Rudolfs sprint', 'ute',
    'Rudolf leder släden och är snabbast av alla. Korta, explosiva ruscher.',
    '5 sprintstarter på 10 meter', '10 sprintstarter på 10 meter', '8 × 20 meter sprint med kort vila'],
  [21, '🌅', 'Årets kortaste dag', 'ute',
    'Vintersolståndet: minst dagsljus på hela året. Passa på att vara ute medan det är ljust!',
    '20 minuter fysisk aktivitet ute i dagsljus', '45 minuter ute i dagsljus, gärna med boll', '60 minuter ute, och ta en bild av solnedgången'],
  [22, '🏔️', 'Snöfotbollen', 'ute',
    'Fotboll i snö är ren glädje. Klä dig varmt och kör!',
    'Spela fotboll ute i 15 minuter', 'Spela 30 minuter med kompisar eller familj', 'Spela 30 minuter med en egen julig regel du hittat på'],
  [23, '🧠', 'Uppfinn en julövning', 'överallt',
    'Lillejulafton. Nu är det din tur att vara tränare. Hitta på en egen övning med jultema.',
    'Hitta på en egen julövning', 'Gör din övning i 10 minuter', 'Skriv ner den så att du kan lära ut den till laget efter jul'],
  [24, '🌟', 'Julaftonsfinalen', 'överallt',
    'God jul! Sista luckan är en kombination av allt du övat på i december. Ge dig själv en julklapp.',
    '10 jongleringar + 20 tå-touchar + 30 sekunder planka',
    '25 jongleringar + en finta per fot + 60 sekunder planka',
    '50 jongleringar + två fintor i rad + 90 sekunder planka'],
];

export function buildAdventDoors(): AdventDoor[] {
  return DOORS.map(([day, emoji, title, place, intro, easy, medium, hard]) => ({
    id: `${ADVENT_CALENDAR_ID}-d${day}`,
    calendarId: ADVENT_CALENDAR_ID,
    day,
    emoji,
    title,
    place,
    intro,
    levelEasyText: easy,
    levelMediumText: medium,
    levelHardText: hard,
  }));
}
