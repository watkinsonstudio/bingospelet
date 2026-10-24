# Signe och Skogens Väktare: game breakdown

Dokumentet beskriver spelet som det fungerar i den nuvarande prototypen (Godot 4, isometrisk 3D). Siffrorna kommer direkt ur koden. Grafikstilen tas inte upp. Sist i dokumentet finns en analys av vad som behöver ändras i en 2.5D-version med äventyr och plattformsspel.

Måttenhet: 1 ruta = 1 meter. Spelvärlden är 96 × 128 m.

---

## 1. Översikt

| | |
|---|---|
| **Genre** | Action-äventyr med utforskning, lätt strid och djurkompisar |
| **Perspektiv (nu)** | Isometrisk 3D med fri rörelse åt alla håll, som i ett action-RPG |
| **Plattform** | PC med tangentbord/mus eller handkontroll. Koden är förberedd för mobilport. |
| **Målgrupp** | Barn och familj. Spelet är förlåtande: man dör aldrig utan skickas tillbaka till basen och behåller allt. |
| **Speltid** | Uppskattningsvis 1–2 timmar för att väcka Urkärnan. Längre om man vill hitta alla djur och kristaller. |
| **Mål** | Samla minst 8 av 12 energikristaller och väck Urkärnan längst i norr. Då höjs en sköld över skogen och tidsstormen lägger sig. |

**Premiss.** En tidsstorm laddar upp sig över skogen. Elektriska urladdningar har väckt gamla maskiner till liv: vilsna robotdjur som patrullerar skogen. Signe är en ung väktare med elbåge och frostpilar. Tillsammans med skogens djur letar hon energikristaller i dolda grottor.

**Designpelare**
1. **Utforska, inte stressa.** Ingen klocka tickar. Stormen växer när man utforskar och minskar när man hittar kristaller.
2. **Djuren är nycklar.** Varje djur har en förmåga som öppnar nya delar av världen, i Metroidvania-stil.
3. **Val som syns.** Rustningens färger ändrar hur robotarna beter sig.
4. **Inget straff.** Faller Signe går hon tillbaka till basen och behåller allt hon samlat.

---

## 2. Kärnloop

```
Utforska ny sektor ──► stormen +5 %, dimman lyfts, djuren får XP
      │
      ▼
Möt robotar ──► elhugg, EMP, frostpilar, djurets samarbete
      │                     │
      │                     ▼
      │              Skrot + kretsar + XP ──► Smedjan: uppgraderingar och rustningsfärger
      ▼
Hitta grotta / lös hinder med rätt djur ──► Energikristall (stormen −12 %)
      │
      ▼
8 kristaller ──► Urkärnan ──► vinst
```

**Kort loop (sekunder):** gå, upptäck robot, frys den med pilar, slå med elhugg, plocka skrot.
**Mellanloop (minuter):** ta dig igenom en sektor, hitta ett djur eller en grotta, gå tillbaka till basen och uppgradera.
**Lång loop:** lås upp djur och nivåer som öppnar nya vägar, samla kristaller och väck Urkärnan.

---

## 3. Signe (spelaren)

### Grundvärden

| Egenskap | Värde |
|---|---|
| Gånghastighet | 4 m/s |
| Energi (liv) | 8 + 2 × plätering. Startvärdet är 10, vilket visas som 5 celler. |
| Frostpilar i kogret | 4 + 2 × kogernivå. Startvärdet är 6. |
| Kogret fylls på | 1 pil per 0,8 s när man inte skjuter, 3× snabbare vid lägerelden |
| Lägerelden | Inom 2,5 m: +1 energi per 0,8 s |
| Osårbarhet efter träff | 1 s, med knuff bakåt |

### Terräng

| Underlag | Fart | Undantag |
|---|---|---|
| Gyttja | 55 % | Normal fart med Älgen inom 5,6 m |
| Snö | 70 % | Normal fart med Älgen inom 5,6 m |
| Grunt vatten | 55 %, och −1 energi var 2,5 s ("Kallt!") | Bävern tar bort båda effekterna |
| Djupt vatten, stenar, träd, grottväggar | Oframkomligt | Broar (Bävern), dolda stigar (Lodjuret) |

### Vapen: Väktarbågen

| Attack | Knapp | Effekt |
|---|---|---|
| **Elhugg** | Vänsterklick / X | Närstrid i en båge på ±72° framåt med 1,5 m räckvidd. Skada 6, +4 per uppgradering. Nedkylning 0,3 s. Slår man på en skrothög får man 2 skrot första gången. |
| **EMP** | Håll in elhugg i minst 0,6 s och släpp | Pulsvåg runt Signe med radien 2,9 m + 0,25 per nivå. Robotarna paralyseras i 2,5 s och tar 4 + 2 × nivå i skada. Ger 1 skada på el-barrikader. Nedkylning 3 s. Signe går i halv fart medan hon laddar. |
| **Frostpil** | Högerklick / RT | Projektil med farten 11,9 m/s och cirka 9,5 m räckvidd. Kostar 1 pil. Skada 2 + frostnivå. Varje träff ger roboten "kyla" (1,0, +0,4 per nivå). Vid 3 kyla fryser roboten i 2,2 s (+0,5 per nivå). Kylan saktar också ner roboten, till som lägst 35 % fart. Siktesstöd utan mus eller spak: närmaste robot inom 9,4 m och ±57°. |

**Kombinationer**
- En frusen robot tar **+50 %** skada av elhugg och EMP ("termisk chock").
- En blöt robot (Bäverns Plask eller Översvämning) tar också **+50 %** skada av el.
- Grundtaktiken är alltså: frys först, slå sedan.

### Skada och "död"
- Robotarnas el-skada halveras med grafitrustning.
- En energisköld (från Hundens Sköldskall) tar ett visst antal träffar innan energin påverkas.
- Vid 0 energi faller Signe ihop. Efter 1,6 s är hon tillbaka i Skogsbasen med full energi och fullt koger, och robotarna går tillbaka till patrull. **Man förlorar ingenting.**

---

## 4. Rustning och Smedjan

Smedjan står i Skogsbasen. Där betalar man med **skrot** och **kretsar** från kortslutna robotar.

### Rustningsstilar och deras effekt på AI

Spelet läser av rustningens tre färger (hjälm, bröst, ben) och klassar dem automatiskt:

| Stil | Hur den uppstår | Effekt |
|---|---|---|
| **Kamouflage** | Jordiga, dämpade färger (grönt, brunt, oliv) | Robotarnas upptäcktsradie −35 % |
| **Neon** | Minst två starka, klara färger | Robotarnas upptäcktsradie +35 %, men **drönare flyr** från Signe |
| **Isolerande grafit** | Mörka, omättade färger | Halverar el-skada |
| **Balanserad** | Allt annat | Ingen effekt |

### Paletter (förvalda färgscheman)

| Palett | Stil | Pris |
|---|---|---|
| Väktarens grönska | Balanserad | Gratis (start) |
| Opalalv | Balanserad | 6 skrot |
| Mossväktare | Kamouflage | 6 skrot |
| Lavskog | Kamouflage | 6 skrot |
| Neonnorrsken | Neon | 8 skrot |
| Solflamma | Neon | 8 skrot |
| Grafit | Grafit | 8 skrot |
| Järnmalm | Grafit | 8 skrot |
| Lingon & björk | Balanserad | 6 skrot |
| Fjällsjö | Balanserad | 6 skrot |

**Fri målarverkstad** (12 skrot): ett färghjul med RGB/HEX för varje del. Stilen räknas om direkt, så spelaren kan själv hitta egna kamouflage- eller neonkombinationer.

### Uppgraderingar

| Uppgradering | Nivåer | Kostnad per steg | Effekt |
|---|---|---|---|
| Väktarbågens elhugg | 1 → 5 | 10 / 18 + 1 krets / 28 + 3 / 40 + 5 | +4 skada, större EMP-radie |
| Frostpilar | 1 → 5 | 10 / 18 + 1 / 28 + 3 / 40 + 5 | Mer kyla per träff, längre frystid |
| Pilkoger | 1 → 4 | 8 / 16 + 1 / 26 + 2 | +2 pilar |
| Rustningsplätering | 1 → 4 | 12 / 24 + 2 / 36 + 4 | +2 energi (en cell) |

---

## 5. Djurkompisarna

### System (gemensamt för alla djur)
- **Ett djur följer med** åt gången. De andra väntar vid lägerelden och man byter med Tab / Y.
- **Hunden** följer med från start. De andra fem träffar man i skogen och blir vän med genom att interagera.
- **Tre nivåer:** Nyfiken hjälpare, Skogsväktare och Skogens Mästare. Nivå 2 kräver 100 XP och nivå 3 kräver 350 XP till. Djuret växer synligt för varje nivå.
- **XP går till det aktiva djuret.** Det blir ett val vem man har med sig.
- **Samarbete (Q / LB):** en aktiv förmåga med nedkylning. Samarbetet byts ut eller blir starkare på nivå 2.
- **Superattack (F / RB):** låses upp på nivå 3. Den kräver en full supermätare, som laddas i strid:

| Händelse | Supermätare |
|---|---|
| Elhugg som träffar | +3 |
| Frostpil som träffar | +2 |
| EMP | +6 |
| Robot kortsluten | +12 |
| Full mätare | 100 |

### XP-källor

| Källa | XP |
|---|---|
| Utforska (per ny ruta som dimman lyfts från) | 0,2 |
| Hitta dolt skrot (Hunden) | 6 |
| Kortsluta robot | 6 (varg) / 10 (drönare) / 18 (björn) |
| Läsa runsten (första gången) | 10 |
| Öppna kista | 15 |
| Kortsluta barrikad | 15 |
| Gå en dold stig första gången | 20 |
| Energikristall | 35 |
| Bärkaka (från kistor) | 50 |
| Bygga bro | 60 |

### De sex djuren

| Djur | Personlighet | Nivå 1 (passiv) | Nivå 2 | Samarbete | Superattack (nivå 3) |
|---|---|---|---|---|---|
| **Hunden** | Modig & lojal | Hittar begravt skrot nära er och skäller när robotar närmar sig | Större sökradie | *Nosa*: söker av ett stort område (9 s). Nivå 2: *Distrahera*, skäller och lockar en robot i 5 s (12 s). | **Sköldskall**: chockvåg i 360°. Alla robotar inom 7,5 m paralyseras i 4 s och Signe får en sköld som tål 2 träffar. |
| **Lodjuret** | Smygande & snabb | Visar och öppnar **dolda stigar** genom täta snår | Robotarna ser hela gruppen sämre | *Smyg*: robotarna ser er knappt i 5 s. Nivå 2: 8 s. | **Skugghopp**: hoppar på den starkaste roboten inom 13,75 m och slår ut den direkt. |
| **Ugglan** | Vis & klarsynt | Dimman lyfts i större radie | **Markerar kristaller och kistor** på kartan | *Spana*: lyfter dimman långt bort och pekar ut kristaller. Nivå 2: ännu längre. | **Bländande Vingslag**: robotar inom 14,4 m blir blinda i 7 s och slutar jaga. |
| **Älgen** | Kraftfull & lugn | Signe går i normal fart i snö och gyttja | **Knuffar undan fallna stockar** | *Knuff*: knuffar bort robotar. Nivå 2: knuffar också stockar. | **Urkraftens Rusning**: rusar 10,6 m framåt, slår omkull robotar och krossar stockar, barrikader och skrothögar. |
| **Räven** | Listig & teknisk | Plockar automatiskt upp skrot | Kan placera ut en **elektronisk skenbild** | *Hämta*: hämtar allt skrot i närheten. Nivå 2: *Skenbild*, lockar robotar i 6 s. | **Kretskupp**: knycker batteriet från närmaste robot inom 11,25 m. Roboten stängs av och tappar dubbelt så mycket skrot. |
| **Bävern** | Byggare & vattenexpert | Signe går i grunt vatten utan att frysa eller sakta in | **Bygger broar** vid brostolpar | *Plask*: blöter ner robotar så att el gör +50 %. Nivå 2: *Bygg/Plask*. | **Översvämning**: robotar inom 11,9 m blir blöta i 8 s, paralyseras i 3 s och tar 25 skada. Alla barrikader i området kortsluts. |

---

## 6. Fiender: de vilsna robotarna

### Typer

| Robot | Liv | Fart (patrull / jakt) | Ser på | Skada | Beteende | Byte |
|---|---|---|---|---|---|---|
| **Björnrobot** | 60 | 1,25 / 2,1 m/s | 4,6 m | 3 | Tung närstrid. Laddar i 0,65 s och slår sedan en stöt på marken med 1,4 m radie. | 5–7 skrot, 1–2 kretsar |
| **Mekanisk varg** | 14 | 1,9 / 4,0 m/s | 3,9 m | 1 | Snabb och går i flock. Laddar i 0,35 s och gör sedan ett utfall med 9,4 m/s. | 1–3 skrot |
| **Svävardrönare** | 22 | 2,1 / 3,1 m/s | 6,0 m (strålkastarkägla) | 1 | Flyger över hinder och håller avståndet (3,5–5,4 m). Skjuter elbollar var 1,7 s. Ser i en smal kägla på ±29° men långt, och runt omkring sig bara på nära håll. | 2–3 skrot, 0–1 krets |

Startvärlden har **38 robotar**: 19 vargar, 11 drönare och 8 björnar. Fler tillkommer vid stark storm (se avsnitt 7).

### AI-tillstånd

```
patrull ──(ser Signe / lockas)──► larm (0,55 s, "!") ──► jakt ──► laddning ──► attack
   ▲                                                       │
   └────────────(tappar spåret i 2,5 s)────────────────────┘
drönare + neonrustning ──► flykt
specialtillstånd: paralyserad, frusen, blind, blöt, nedkyld, avstängd
```

- Robotar på patrull vandrar slumpmässigt inom 3 m från sin startpunkt.
- **Avledning:** Hundens Distrahera och Rävens Skenbild drar robotarna mot djuret eller skenbilden i stället för mot Signe.
- **Upptäcktsradien** påverkas av storm (+25 % vid max), rustningsstil (−35 % eller +35 %) och Lodjurets passiva förmåga och Smyg.
- En kortsluten robot faller ihop, tappar skrot och kretsar och försvinner efter några sekunder.

---

## 7. Tidsstormen (storm_intensity 0–1)

Stormen ersätter en klocka. Den är spelets **dynamiska svårighetsgrad och stämningsreglage.**

| Påverkar stormen | Ändring |
|---|---|
| Spelstart | 0,30 |
| Gå in i en ny sektor första gången | +0,05 |
| Utforska (per ruta) | +0,00009 |
| Ta en energikristall | −0,12 |
| Väcka Urkärnan | → 0 |

| Stormen påverkar | Effekt |
|---|---|
| Robotarnas fart | Upp till +30 % |
| Robotarnas upptäcktsradie | Upp till +25 % |
| Regn | Startar vid 0,3 |
| Elektriska gnistor i luften | Startar vid 0,45 |
| Blixtar | Över 0,55, var 9:e sekund ned till var 3:e |
| **Blixt kan ladda liv i en ny robot** | Över 0,6. Bara om färre än 5 robotar finns nära Signe och högst 36 totalt. I norr blir det en drönare, annars 60 % varg. |
| Ljus | Månljuset dämpas och färgen går från blåvitt mot violett |

Etiketter i HUD: Lugnt (< 0,25), Blåsigt (< 0,5), Laddat (< 0,75), Tidsstorm.

**Designeffekt:** spelaren belönas för att hämta kristaller i stället för att bara utforska. Den som utforskar mycket utan kristaller får en svårare skog.

---

## 8. Världen

### Sektorer (från söder till norr)

| Sektor | Innehåll | Djur att möta |
|---|---|---|
| **Mossdalen** (start, söder) | Skogsbasen med lägereld, smedja och tält. Damm, snårglänta med dolda stigar och ruiner. | Hunden (start), Räven och Bävern |
| **Järnforsen** (mitten) | Älven, sjön med en ö (brobygge), robotdepå med el-barrikader och reaktorer | Lodjuret, Älgen och Ugglan |
| **Dimkronorna** (norr) | Frost och snö, en stenring med fallna stockar, drönarrike, Urkärnan med 4 pyloner | – |

### Platser och föremål

| Sak | Antal | Funktion |
|---|---|---|
| **Energikristaller** | 12 (8 behövs) | Sänker stormen och ger XP. De flesta ligger i grottor med en smal öppning. |
| **Kristallgrottor** | 6 | Runda grottrum med en smal ingång. Grottan blir mörkare och mer magentaglödande, och kameran zoomar in. |
| **Kistor** | 9 | 6–11 skrot, 1–2 kretsar och en bärkaka (+50 XP till djuret). Ugglan på nivå 2 visar dem på kartan. |
| **Runstenar** | 4 | Ledtrådar om djurens förmågor och målet. |
| **Begravt skrot** | 46 platser | Hunden hittar dem och gräver upp 2–4 skrot. |
| **Skrothögar** | Flera | Elhugg ger 2 skrot första gången. |
| **El-barrikader** | Vid depån | Tål 3 träffar. EMP gör 1 skada; Älgens Rusning och Bäverns Översvämning bryter dem direkt. |
| **Fallna stockar** | Vid stenringen | Älgen på nivå 2 eller Älgens Rusning. |
| **Brostolpar** | Vid sjön | Bävern på nivå 2 bygger en bro till ön. |
| **Dolda stigar** | I snårgläntan | Lodjuret öppnar dem. |
| **Urkärnan** | 1 | Kräver 8 kristaller. Väcker skölden: alla robotar paralyseras och stormen lägger sig. |

### Kristallerna och vad som krävs

| Kristall | Sektor | Krav |
|---|---|---|
| Mossdalens grotta | Mossdalen | – |
| Dammen | Mossdalen | – |
| Ruingrottan | Mossdalen | – |
| Snårgläntan | Mossdalen | **Lodjuret** (dold stig) |
| Begravd kristall | Järnforsen | **Hunden** gräver fram den |
| Reaktorgrottan | Järnforsen | – |
| Ön i sjön | Järnforsen | **Bävern nivå 2** (bro) |
| Robotdepån | Järnforsen | **Barrikader**: EMP, Älgen eller Bävern |
| Drönargrottan | Dimkronorna | – |
| Klippgrottan | Dimkronorna | – |
| Stenringen | Dimkronorna | **Älgen nivå 2** (stockar) |
| Kärnans grotta | Dimkronorna | – |

Åtta kristaller kan nås med bara Hunden. Det testas automatiskt. De fyra övriga är belöningar för att låsa upp och utveckla djuren.

### Dimma och karta
- Hela kartan börjar täckt av dimma som lyfts runt Signe. Ugglan gör radien större.
- HUD-kartan visar ett utsnitt runt Signe. Skogsboken har en hel karta med teckenförklaring och procent utforskat.

---

## 9. Ekonomi

| Resurs | Källa | Används till |
|---|---|---|
| **Skrot** | Robotar, kistor, begravt skrot, skrothögar | Paletter, målarverkstad, alla uppgraderingar |
| **Kretsar** | Björnar, drönare, kistor | De högre uppgraderingsstegen |
| **XP** | Se avsnitt 5 | Djurens nivåer |
| **Bärkaka** | Kistor | +50 XP till aktivt djur |

Räven plockar upp skrot automatiskt. Kretskupp ger dubbelt byte.

---

## 10. Gränssnitt

- **HUD:** energiceller och frostpilar, djurkort med porträtt och nivårad, stormmätare, resurser (skrot, kretsar, kristaller x/8), minikarta med sektornamn och ett förmågefält med fyra rutor. Rutorna är Elhugg, Frostpil, Samarbete och Superattack, med knappnamn och nedkylning.
- **I världen:** hälsomätare och "!" över robotar, "?" över djur som väntar, djurens pratbubblor, flytande skadetal och en interaktionsknapp vid föremål.
- **Skogsboken (paus):** flikarna Kompisar (byta djur), Karta, Galleri (alla figurer), Kontroller och Testläge (stormreglage, Sköldskall-test med mera).
- **Smedjan:** roterande förhandsvisning av Signe, stilmärke med förklaring, palettrutnät, färghjul och uppgraderingar.
- **Banners och toasts:** sektornamn, "Du har hittat en kristallgrotta", "Ny vän" och liknande.
- **Kontroller:** tangentbord/mus och handkontroll med automatisk växling. Knappnamnen anpassas för Xbox eller PlayStation.

---

## 11. Sparning och vinst

- Spelet sparar automatiskt var 10:e sekund och när menyer stängs. Sparningen omfattar kristaller, kistor, begravt skrot, broar och röjda hinder, djur och deras nivåer, resurser, rustning, uppgraderingar och dimman.
- **Vinst:** Urkärnan med 8 kristaller. Vinstskärmen visar antal kristaller, kortslutna robotar, djurvänner, procent utforskat och speltid.
- **Ingen förlust:** att falla ihop skickar bara Signe tillbaka till basen.

---

## 12. Ljud

Alla ljud genereras i koden. Det finns ljud för elhugg, laddning, EMP, frostpil, frysning, träff, robot som kortsluts, Signe som skadas, upplockning, kristall, hundskall, robotlarm, nivå upp, superattack, åska, gränssnitt, "nekad", brobygge och vinst. Musik saknas än så länge.

---

## 13. Teknisk struktur (för portering)

| System | Fil | Kopplat till perspektivet? |
|---|---|---|
| Djurens XP, nivåer, signaler och superattacker | `companions/companion_base.gd` + sex djurklasser | **Nej**, logiken kan återanvändas |
| Stormen | `environment/environment_controller.gd` | Nej |
| Rustningsstilar | `actors/armor_style.gd` | Nej |
| Smedjan och ekonomin | `ui/forge_data.gd` | Nej |
| Kontroller | `core/controls.gd` | Delvis: hopp behöver läggas till |
| Världen | `world/world_data.gd` | **Ja**: rutnät sett uppifrån |
| Spelarens rörelse och robotarnas AI | `actors/player.gd`, `actors/robot.gd` | **Ja**: rör sig i ett 2D-plan sett uppifrån |

---

## 14. Från isometriskt till 2.5D äventyr och plattform

### Vad som går att flytta nästan rakt av
- Berättelse, mål (8 kristaller → Urkärnan) och de tre sektorerna, som kan bli tre zoner eller banor.
- **Tidsstormen** som svårighetsreglage utan klocka.
- **Djursystemet**: XP, nivåer, supermätare, ett aktivt djur och byte vid lägerelden.
- **Rustning, Smedjan och ekonomin**, inklusive stilarnas effekt på robotarnas AI.
- **Grundtaktiken** frys först, slå sedan, och att blöta robotar tar mer el-skada.
- Förlåtande "död" och autosparning.

### Vad som måste göras om
- **Rörelse:** sidled plus hopp i stället för fri rörelse åt alla håll. Signe behöver hopp, och kanske dubbelhopp, väggklättring eller glidning som låses upp.
- **Nivådesign:** handgjorda banor i stället för en genererad karta sedd uppifrån. Varje sektor blir en sammanhängande sidvy med vertikala delar och grottor som egna rum.
- **Fiendernas AI:** patrull på plattformar med kanter. Vargar som hoppar, drönare som flyger fritt i två dimensioner och björnar som stöter i marken så att plattformar skakar.
- **Sikte:** frostpilar i åtta riktningar med höger spak eller mus, eller en båge som skjuter rakt fram med möjlighet att sikta snett uppåt och nedåt.
- **Kamera:** sidokamera som följer Signe och zoomar in i grottor. Lager i djupled ger 2.5D-känsla men påverkar inte spelet.

### Förslag: djurens förmågor som plattformsnycklar

| Djur | Nuvarande nyckel | Förslag i 2.5D |
|---|---|---|
| Hunden | Gräver fram dolt skrot och kristall | Gräver genom mjuk jord i golv och väggar och hittar hemliga gångar |
| Lodjuret | Dolda stigar i snår | **Väggklättring eller långt hopp**. Signe rider eller hoppar efter lodjuret upp till höga avsatser. |
| Ugglan | Lyfter dimma, visar kristaller | **Glidflykt**: Signe håller i ugglan och glider över avgrunder. Visar också dolda plattformar. |
| Älgen | Stockar, gyttja och snö | **Krossar väggar och stockar**, går genom tungt motstånd och kan bära Signe genom snödrivor |
| Räven | Skrot och skenbild | **Smyger genom smala tunnlar** och hämtar föremål eller trycker på knappar bakom galler |
| Bävern | Bro och grunt vatten | **Bygger plattformar eller broar** över vatten och **simmar** genom översvämmade grottor |

Med ett djur i taget och byte vid lägereldar uppstår ett naturligt Metroidvania-pussel: "här behöver jag Ugglan, så jag går tillbaka till lägerelden och byter".

### Superattacker i sidvy
- **Sköldskall:** samma radie, en ring runt Signe.
- **Skugghopp:** lodjuret hoppar från bakgrundslagret ut på närmaste starka robot.
- **Bländande Vingslag:** ljusblixt över hela skärmen.
- **Urkraftens Rusning:** rusar längs marken framåt och krossar allt i vägen. Det passar extra bra i sidvy.
- **Kretskupp:** räven springer till närmaste robot.
- **Översvämning:** en våg sveper över skärmen från ena sidan.

### Stormen i 2.5D
- Vind som påverkar hopp, till exempel en knuff i sidled vid stark storm.
- Blixtar som tillfälligt tänder upp mörka grottor, eller laddar el-plattformar som blir farliga eller aktiva.
- Regn som gör ytor hala över ett visst stormvärde.

### Risker och omfattning
- **Handgjorda banor** är den största kostnaden. Nuvarande värld genereras från kod, medan en plattformsbana måste ritas för hand och testas.
- **Hoppkänslan** måste vara bra från början: "coyote time", hoppbuffert och variabel hopphöjd. Det tar tid att finjustera.
- **Barn som målgrupp:** plattformsdelarna får inte bli för svåra. Förslag: inga dödsgropar (man hamnar på senaste avsatsen) och valfria svåra delar för extra belöningar.
- **Rekommenderad start:** en prototyp av **en** sektor (Mossdalen) med Hunden och ett nytt djur (till exempel Lodjuret eller Ugglan). I den testas hopp, strid i sidvy och en djurnyckel innan resten byggs.
