# Signe och Skogens Väktare

> **Huvudversionen finns nu i Godot 4.** Den ligger i [`godot/`](godot/README.md) och är byggd för PC med handkontroll. Webbversionen nedan finns kvar som referens.

Spelbar prototyp för PC: ett isometriskt 3D-äventyr i en lysande, lummig
skog, byggt efter speldesigndokumentet *Signe och Skogens Väktare* och Signes
egna referensbilder:

- **Världen** utgår från kristallgrottan: djupblå skuggor, limegrön mossa,
  jättesvampar, orange tickor, turkosa spiralrunor och magentaglödande
  kristaller.
- **Djuren** är fluffiga pastellvarelser med stora glansiga ögon.
- **Robotarna** är vita, blanka robotdjur med cyanlysande paneler.
- **Signe** är en ståtlig alvkrigare i heltäckande bladrustning.

All grafik byggs i koden (Three.js). Prototypen använder inga bildfiler.

## Starta

Spelet använder ES-moduler och måste därför köras via en webbserver. Det går
inte att dubbelklicka på `index.html`.

```bash
cd signe-skogens-vaktare
npx http-server -c-1 .     # eller: python3 -m http.server
# öppna http://localhost:8080
```

Three.js ligger i `vendor/three/` (MIT-licens), så spelet fungerar utan
internet. Bara typsnitten hämtas från Google Fonts.

## Kontroller

| Handling | Tangentbord och mus | Handkontroll (Xbox / PlayStation) |
|---|---|---|
| Gå | WASD / piltangenter | Vänster spak |
| Sikta | Musen | Höger spak |
| Elhugg (håll in: EMP) | Vänsterklick / J | X / □ |
| Frostpil | Högerklick / mellanslag / K | RT / R2 |
| Samarbete med djuret | Q | LB / L1 |
| Superattack | F | RB / R1 |
| Interagera | E | A / ✕ |
| Byt djur | Tab | Y / △ |
| Karta | M | Back / Share |
| Meny | Esc | Start / Options |
| Zooma | Mushjulet | – |

Menyerna går att styra med styrkorset eller vänster spak, A för att välja och
B för att stänga. Knappnamnen i förmågefältet byts automatiskt efter vad
spelaren senast rörde.

## Vad som finns i prototypen

- **Signe:** elhugg med Väktarbågens bladkanter, EMP-pulsvåg, frostpilar
  (tre träffar fryser en robot), energisköld och sex rustningszoner i smedjan.
- **Sex djur:** Hund, Lodjur, Uggla, Älg, Räv och Bäver. Var och en har tre
  nivåer, en samarbetsförmåga per nivå, en Superattack på nivå 3 och en
  supermätare som laddas i strid. Alla förmågor från GDD:n är med: Sköldskall,
  Skugghopp, Bländande Vingslag, Urkraftens Rusning, Kretskupp och
  Översvämning.
- **Tidsstormen:** `storm_intensity` (0.0–1.0) styr himmel, dimma, ljus, vind,
  regn, blixtar och robotarnas tempo. Ingen klocka tickar. Utforskning laddar
  stormen och varje kristall pressar tillbaka den.
- **Kristallgrottor:** sex grottor med smal öppning. Inne i grottan blir ljuset
  magenta och kameran går närmare.
- **Robotar:** Björnrobot, Svävardrönare och Mekanisk varg med patrull, larm,
  jakt, laddade attacker, fryst och paralyserat läge. De tappar skrot och
  kretsar.
- **Smedjan:** förvalda paletter, fri målarverkstad (RGB/HEX) och
  uppgraderingar. Rustningens stil påverkar AI:n: kamouflage −35 %
  upptäcktsradie, neon lockar robotar men skrämmer drönare, grafit halverar
  elskada.
- **Meny:** kompisar, karta, ett galleri med alla 3D-modeller (djuren i tre
  nivåer), kontroller och ett testläge med stormreglage och Sköldskall-test.
- **Övrigt:** grafikläge hög/låg (låg väljs automatiskt på svag hårdvara) och
  autosparning i webbläsaren.

## Arkitektur och portning

Spellogiken och grafiken är helt separerade, så att logiken kan flyttas till
Godot, Unity eller en mobilversion.

```
js/                 Motoroberoende spellogik (vanliga skript, window.SV)
  core.js           Matte, färger, signaler (Emitter), lagring
  input.js          Tangentbord, mus och handkontroll → gemensamma handlingar
  input-touch.js    Pekskärmsspak och knappar (laddas inte på PC, redo för mobil)
  world.js          Kartgenerering, grottor, kollision, utforskning
  environment.js    EnvironmentController (GDD §5.2)
  entities.js       Player, Robot, ArmorStyle
  companions.js     Companion-basklass + sex arter + CompanionManager (GDD §5.1)
  forge.js, ui.js   Smedjan, HUD och menyer (DOM)
  game.js           Spelloop och regler; anropar SV.View för grafiken
js3d/               3D-vyn (ES-moduler, Three.js)
  view.js           Kamera, ljus, bloom, färggradering, synk mot logiken
  terrain.js        Höjdfält, vatten, dimslöjor, instansierad vegetation
  models.js         Signe, djuren, robotarna, miljön; ArmorColorShader (GDD §5.3)
  fur.js            Shell-päls för djuren
  fx.js             Partiklar, regn, blixtar, ringar, projektiler
tests/logic.test.mjs  Tester för logiken (node tests/logic.test.mjs)
```

Klasserna i `companions.js` följer GDD:ns GDScript namn för namn
(`add_xp`, `level_up`, `trigger_super`, `execute_super_ability`,
`apply_stun`, `apply_energy_shield`, signalerna `level_changed` och
`super_ready`). En port till Godot blir därför en översättning rad för rad.

Logiken räknar i px-koordinater (16 per ruta). 3D-vyn delar med 16 för att få
världsenheter.

## Tester

```bash
node tests/logic.test.mjs
```

Testerna verifierar nivåstegen för djuren, att Sköldskall paralyserar
robotarna i 4 s och ger Signe en sköld på 2 träffar (GDD §6.3), att
`storm_intensity` klampas och styr ljus och partiklar, rustningsstilarnas
effekter, att minst åtta kristaller går att nå och att bro- och
stockändringar sparas.

## Begränsningar

- Figurerna är procedurella modeller i koden, inte handgjord konst. Nästa steg
  för att nå referensbildernas detaljnivå är riktiga 3D-modeller eller målade
  sprites.
- Handkontrollstödet följer webbläsarens standardlayout. Det är skrivet och
  genomgånget i koden men inte provat med en fysisk kontroll i den här
  miljön.
- Pixelversionen av prototypen finns kvar i git-historiken (commit
  `fb054e8`).
