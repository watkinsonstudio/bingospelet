# Signe och Skogens Väktare – Godot 4

Det här är PC-versionen av spelet byggd i **Godot 4.5**. Det är ett isometriskt 3D-äventyr i en lysande, lummig skog med grafik i Ori-anda. Allt bygger på speldesigndokumentet och Signes referensbilder:

- **Världen och grottorna:** djupblå skuggor, limegrön mossa, jättesvampar, orange tickor och magentaglödande kristaller.
- **Signe:** en ståtlig alvkrigare i heltäckande rustning, med elbåge och frostpilar.
- **Djurkompisarna:** fluffiga pastellvarelser med äkta päls (shell-teknik).
- **Robotarna:** vita, blanka robotdjur med cyanlysande paneler (björn, varg och drönare).

All grafik och allt ljud skapas i koden. Projektet har inga bild- eller ljudfiler förutom typsnitten (SIL OFL) och ikonen.

## Spela

1. Ladda ner Godot 4.5 eller senare (standardversionen, inte .NET) från <https://godotengine.org>.
2. Starta Godot, välj **Importera** och peka på mappen `godot/project.godot`.
3. Tryck **F5** (Kör projektet).

Från terminalen går det också:

```bash
godot --path signe-skogens-vaktare/godot
```

Spelet sparar automatiskt var tionde sekund och när en meny stängs. Sparfilen
heter `user://signe_save.json`; på Windows ligger den under
`%APPDATA%\Godot\app_userdata\Signe och Skogens Väktare\`.

### Göra en .exe

Gå till **Editor → Hantera exportmallar → Ladda ner**. Välj sedan
**Projekt → Exportera → Lägg till… → Windows Desktop**, ange
`export/Signe.exe` som sökväg och klicka **Exportera projekt**. Mappen
`export/` ignoreras av git.

## Kontroller

Spelet känner av automatiskt om du använder tangentbord och mus eller handkontroll. Knappnamnen i spelet byter mellan Xbox och PlayStation.

| Handling | Tangentbord och mus | Handkontroll |
|---|---|---|
| Gå | WASD / piltangenter | Vänster spak |
| Sikta | Musen | Höger spak |
| Elhugg (håll in: EMP) | Vänsterklick / J | X / □ |
| Frostpil | Högerklick / mellanslag / K | RT / R2 |
| Samarbete med djuret | Q | LB / L1 / LT |
| Superattack (nivå 3) | F | RB / R1 |
| Interagera | E | A / ✕ |
| Byt djur | Tab | Y / △ |
| Skogsboken (meny) | Esc / P | Start |
| Karta | M | Back / Select |
| Zooma | + / − / mushjulet | Spakklick |

## Arkitektur

GDD:ns klassnamn och signaler behålls. Spelplanet är 96 × 128 rutor, där en ruta är en meter i 3D.

```
scenes/main.tscn              Huvudscenen (GDD §6: fristående noder)
├─ WorldEnvironment, Moon     Ljus, dimma, glöd (styrs av EnvironmentController)
├─ EnvironmentController      scripts/environment/environment_controller.gd
├─ World → WorldBuilder       scripts/world/world_builder.gd   (3D-terräng, MultiMesh-skog)
├─ Actors → Player, Robot     scripts/actors/
├─ CompanionManager           scripts/companions/companion_manager.gd
├─ Fx                         scripts/fx/fx.gd                  (partiklar, projektiler, skadetal)
└─ UI → GameUI                scripts/ui/game_ui.gd             (HUD, Skogsboken, Smedjan)
```

| Fil | Innehåll |
|---|---|
| `scripts/world/world_data.gd` | `WorldData` genererar skogen, grottorna, kristallerna, djuren och robotarna utifrån ett fast frö. Här finns också kollision. Klassen är fri från rendering och kan portas. |
| `scripts/companions/companion_base.gd` | `class_name Companion` med `level_changed`, `super_ready`, `add_xp`, `level_up`, `trigger_super` och `execute_super_ability`. |
| `scripts/companions/*_companion.gd` | Hund (Sköldskall), Lodjur, Uggla, Älg, Räv och Bäver. Varje djur har tre nivåer, ett samarbete och en superattack. |
| `scripts/environment/environment_controller.gd` | `storm_intensity` (0–1) styr himmel, ljus, regn, gnistor och blixtar, utan någon klocka. Kristaller pressar tillbaka stormen. |
| `scripts/actors/armor_style.gd` | Rustningsfärgen påverkar AI: kamouflage ger −35 % upptäckt, neon lockar robotar men skrämmer drönare, grafit halverar elskada. |
| `shaders/armor_color.gdshader` | GDD:ns ArmorColorShader ordagrant (canvas_item). |
| `shaders/armor_color_3d.gdshader` | Samma färgbyte för 3D-rustningen. Smedjans färghjul skickar färgerna hit. |
| `scripts/core/controls.gd` | Autoload. Tangentbord, mus och handkontroll definieras i koden. |
| `scripts/core/sfx.gd` | Autoload. Procedurella ljudeffekter. |

**Portning till mobil:** `project.godot` har redan `rendering_method.mobile = gl_compatibility`. Spellogiken (`WorldData`, `Companion`, `Robot`, `Player.tick`) läser bara av `Controls.move_vector()` och handlingsnamnen. Pekskärmsknappar kan därför läggas till som en egen UI-nod som trycker på samma handlingar (`Input.action_press`), utan att spellogiken ändras.

## Tester

```bash
# 20 logiktester: nivåer, Sköldskall mot stun, stormen, rustningsstilar,
# skada, världens nåbarhet, broar och sparfil
godot --headless --path . res://tests/run_tests.tscn

# Röktest: spelar med simulerad input och sparar skärmdumpar
godot --path . --rendering-method gl_compatibility res://tests/smoke.tscn -- /tmp/shots
```

Sköldskall kan också testas inne i spelet under **Skogsboken → Testläge**.

Datorer utan Vulkan kan köra spelet med
`--rendering-method gl_compatibility`. I det läget stängs SSAO och volymetrisk
dimma av.
