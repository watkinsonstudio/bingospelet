-- ============================================================================
-- Föreningens Sommarbingo – exempeldata (matchar src/data/seed.ts)
-- ============================================================================
-- Kör efter schema.sql. Skapar klubben Skultuna IS, tre lag med trupper, samt
-- två veckor (Teknikveckan – arkiverad, Kondition & VM – aktiv) med alla 25
-- rutor. Spelarnas avklarade rutor (entries) skapas när appen används.
-- ============================================================================

do $$
declare
  club_id  uuid;
  f11 uuid; f17 uuid; p13 uuid;
  w_teknik uuid; w_kond uuid;
begin
  insert into clubs (name) values ('Skultuna IS') returning id into club_id;

  insert into teams (club_id, name, join_code) values (club_id, 'Flickor 11', 'F11-SOL') returning id into f11;
  insert into teams (club_id, name, join_code) values (club_id, 'Flickor 17/18', 'F17-RÖD') returning id into f17;
  insert into teams (club_id, name, join_code) values (club_id, 'Pojkar 13', 'P13-BLÅ') returning id into p13;

  insert into team_settings (team_id) values (f11), (f17), (p13);

  -- Trupper (8 spelare i F11 → tröskel 4, plus coacher)
  insert into players (team_id, first_name, color, role) values
    (f11, 'Alva',  '#e11d48', 'player'),
    (f11, 'Liam',  '#2563eb', 'player'),
    (f11, 'Maja',  '#16a34a', 'player'),
    (f11, 'Noah',  '#d97706', 'player'),
    (f11, 'Ella',  '#7c3aed', 'player'),
    (f11, 'Hugo',  '#0891b2', 'player'),
    (f11, 'Wilma', '#db2777', 'player'),
    (f11, 'Leo',   '#65a30d', 'player'),
    (f11, 'Daniel','#475569', 'coach'),
    (f17, 'Saga',  '#e11d48', 'player'),
    (f17, 'Vera',  '#2563eb', 'player'),
    (f17, 'Nova',  '#16a34a', 'player'),
    (f17, 'Iris',  '#d97706', 'player'),
    (f17, 'Elsa',  '#7c3aed', 'player'),
    (f17, 'Tuva',  '#0891b2', 'player'),
    (f17, 'Karin', '#475569', 'coach'),
    (p13, 'Elias', '#e11d48', 'player'),
    (p13, 'Oscar', '#2563eb', 'player'),
    (p13, 'Vidar', '#16a34a', 'player'),
    (p13, 'Melvin','#d97706', 'player'),
    (p13, 'Nils',  '#7c3aed', 'player'),
    (p13, 'Ludvig','#0891b2', 'player'),
    (p13, 'Frank', '#db2777', 'player'),
    (p13, 'Sixten','#65a30d', 'player'),
    (p13, 'Ivar',  '#c026d3', 'player'),
    (p13, 'Peter', '#475569', 'coach');

  -- Veckor (delade på klubbnivå → team_id = null)
  insert into weeks (team_id, club_id, week_number, theme, date_range, status)
    values (null, club_id, 27, 'Teknikveckan', '29 juni–5 juli', 'archived') returning id into w_teknik;
  insert into weeks (team_id, club_id, week_number, theme, date_range, status)
    values (null, club_id, 28, 'Kondition & VM', '6–12 juli', 'active') returning id into w_kond;

  -- Aktiv vecka: 24 övningar med tre nivåer (index 12 = FRI)
  insert into tasks (week_id, cell_index, title, level_easy_text, level_medium_text, level_hard_text) values
    (w_kond, 0,  'Jonglering',    '5 i rad',                        '20 i rad',                               '50 i rad utan att tappa'),
    (w_kond, 1,  'Touch mot vägg','50 touchar',                     '100 touchar, insida båda fötter',        '200 touchar på 2 min utan paus'),
    (w_kond, 2,  'Nick',          '5 nickar mot vägg',              '15 nickar i rad med kompis',             '30 nickar i rad, styr mot mål'),
    (w_kond, 3,  'Eget pass',     '10 väggpass insida',             '25 pass, växla fot',                     '50 pass på 90 sek utan miss'),
    (w_kond, 4,  'VM-finta',      'Lär dig en VM-finta',            'Gör den i fart 5 ggr/fot',               'Kombinera två fintor förbi en kon i full fart'),
    (w_kond, 5,  'Dribbling',     'Slalom genom 5 koner',           '8 koner tight, båda fötter',             '8 koner på tid, under 12 sek'),
    (w_kond, 6,  'Planka',        '30 sek',                         '60 sek',                                 '2 min (eller 3×45 sek)'),
    (w_kond, 7,  'Lär ut',        'Visa en övning för en kompis',   'Lär ut en finta så kompisen klarar den', 'Håll ett eget 10-min pass för minst 2 spelare'),
    (w_kond, 8,  'Svagfot pass',  '10 pass med svag fot',           '25 pass mot vägg, svag fot',             '40 pass svag fot på 2 min'),
    (w_kond, 9,  'Hopprep',       '30 hopp',                        '100 hopp utan miss',                     '200 hopp eller 3 min non-stop'),
    (w_kond, 10, 'Skott',         '3/10 i mål',                     '6/10 i mål',                             '8/10 i ett litet mål (hink/koner)'),
    (w_kond, 11, 'Explosivitet',  '5 utfallshopp per ben',          '10 sprintstarter 10 m',                  '8×20 m sprint med kort vila'),
    (w_kond, 12, 'FRI RUTA',      null, null, null),
    (w_kond, 13, 'Film & analys', 'Se ett proffsklipp och härma en rörelse', 'Filma dig själv och jämför',    'Analysera en match, skriv 3 lärdomar'),
    (w_kond, 14, 'Spela & lek',   'Spela fotboll 20 min',           'Spela 45 min med kompisar',              'Arrangera en liten turnering'),
    (w_kond, 15, 'Egen övning',   'Hitta på en egen övning',        'Gör din övning i 10 min',                'Lär ut din övning till laget'),
    (w_kond, 16, 'Straffar',      '3/5 i mål',                      '5/5 i valfritt hörn',                    '8/10 placerade i anvisat hörn'),
    (w_kond, 17, 'Svaga foten',   '20 touchar med svag fot',        'Dribbla en bana enbart svag fot',        'Gör mål med svag fot 5 ggr'),
    (w_kond, 18, 'Löpning',       'Spring 1 km / cykla 3 km',       'Spring 2 km, ta tiden',                  'Spring 3 km eller slå din 2 km-tid med 30 sek'),
    (w_kond, 19, 'Barfota',       '5 min bollkänsla barfota',       '50 touchar barfota på gräs',             'Jonglera 20 barfota'),
    (w_kond, 20, 'Nya fintor',    'Lär dig 1 ny finta',             'Lär dig 2 nya fintor',                   'Använd 3 nya fintor i spel'),
    (w_kond, 21, 'Allround-jong', '10 jonglering med fötterna',     'Fot–lår–fot 10 gånger',                  'Fot–lår–huvud–cykel, 15 träffar'),
    (w_kond, 22, 'Inkast',        '5 korrekta inkast',              'Kasta 10 m med rätt teknik',             'Kasta 15 m eller längre korrekt'),
    (w_kond, 23, 'Med lagkompis', 'Passa med en kompis 10 min',     '30 pass i rad tillsammans',              '2-mot-1-övning ihop i 10 min'),
    (w_kond, 24, 'Återhämtning',  'Stretcha 10 min',                'Stretcha + 8 tim sömn',                  'Stretch, vätska och sömn 2 dagar i rad');

  -- Arkiverad vecka: enkla övningar utan nivåer (endast titel)
  insert into tasks (week_id, cell_index, title) values
    (w_teknik, 0,  '50 jong i rad'),
    (w_teknik, 1,  'Insida-utsida x20'),
    (w_teknik, 2,  'Stoppa hög boll x10'),
    (w_teknik, 3,  'Åtta runt koner'),
    (w_teknik, 4,  'Härma VM-vändning'),
    (w_teknik, 5,  'Passningsvägg x30'),
    (w_teknik, 6,  'Tå-touch x50'),
    (w_teknik, 7,  'Lär ut en finta'),
    (w_teknik, 8,  'Svagfotsskott x10'),
    (w_teknik, 9,  'Sula fram-bak 1 min'),
    (w_teknik, 10, 'Träffa ribban x3'),
    (w_teknik, 11, 'Snabba fötter'),
    (w_teknik, 12, 'FRI RUTA'),
    (w_teknik, 13, 'Visa din bästa finta'),
    (w_teknik, 14, 'Cruyff x10/fot'),
    (w_teknik, 15, 'Egen trick-rörelse'),
    (w_teknik, 16, 'Volley mot vägg x10'),
    (w_teknik, 17, 'Dribbla 8 koner'),
    (w_teknik, 18, 'Nick-jong 5 rad'),
    (w_teknik, 19, 'Klackpass x5'),
    (w_teknik, 20, 'Härma målgest'),
    (w_teknik, 21, 'Knä/fot/bröst'),
    (w_teknik, 22, 'Long ball 30 m'),
    (w_teknik, 23, 'Trick med kompis'),
    (w_teknik, 24, 'Stretcha ordentligt');
end $$;
