## Headless-tester av spellogiken (GDD §5–6). Körs med:
##   godot --headless --path . res://tests/run_tests.tscn
## Laddar huvudscenen så att autoloads (Controls, Sfx) finns, och testar
## sedan klasserna direkt. Avslutar med kod 1 om något test misslyckas.
extends Node

var game
var passed := 0
var failed := 0


func _ready() -> void:
	Sfx.set_muted(true)
	game = load("res://scenes/main.tscn").instantiate()
	add_child(game)
	await get_tree().process_frame
	_run()
	print("\n%d tester gick igenom, %d misslyckades." % [passed, failed])
	get_tree().quit(1 if failed else 0)


func check(cond: bool, msg: String) -> void:
	if not cond:
		if _fail_msg == "":
			_fail_msg = msg


var _fail_msg := ""


func test(name: String, fn: Callable) -> void:
	_fail_msg = ""
	game.new_state({})
	fn.call()
	if _fail_msg == "":
		passed += 1
		print("  ✓ " + name)
	else:
		failed += 1
		print("  ✗ " + name + "\n    " + _fail_msg)


func _add_bots(at: Vector2, n: int, dist: float, type: String = "hound") -> Array:
	var bots: Array = []
	for i in n:
		var p := at + Vector2.from_angle(TAU * i / n) * dist
		var r: Robot = game._add_robot(type, p)
		r.position = Vector3(p.x, 0, p.y)
		bots.append(r)
	return bots


func _run() -> void:
	print("Djurkompisar (GDD §5.1 Companion)")
	test("add_xp når nivå 2 vid 100 och nivå 3 vid 350, xp nollställs", func() -> void:
		var c: Companion = CompanionManager.create("dog")
		c.add_xp(99)
		check(c.current_level == 1, "nivå efter 99 xp: %d" % c.current_level)
		c.add_xp(1)
		check(c.current_level == 2 and c.current_xp == 0, "nivå 2 och xp 0")
		c.add_xp(349)
		check(c.current_level == 2, "fortfarande nivå 2")
		c.add_xp(1)
		check(c.current_level == 3, "nivå 3")
		c.add_xp(1000)
		check(c.current_level == 3, "taket är nivå 3")
		c.free())
	test("signalerna level_changed och super_ready skickas", func() -> void:
		var c: Companion = CompanionManager.create("fox")
		var levels: Array = []
		var ready := [0]
		c.level_changed.connect(func(l: int) -> void: levels.append(l))
		c.super_ready.connect(func() -> void: ready[0] += 1)
		c.add_xp(100)
		c.add_xp(350)
		check(levels == [2, 3], "nivåsignaler: %s" % str(levels))
		check(ready[0] == 1 and c.is_super_available, "super_ready en gång")
		c.free())
	test("trigger_super fungerar bara på nivå 3 och förbrukar mätaren", func() -> void:
		var dog: Companion = game.companions.active
		check(not dog.trigger_super(), "nivå 1 ska nekas")
		dog.add_xp(100)
		dog.add_xp(350)
		check(dog.trigger_super(), "nivå 3 ska lyckas")
		check(not dog.is_super_available and dog.super_meter == 0.0, "mätaren töms")
		check(not dog.trigger_super(), "tom mätare ska nekas")
		dog.charge_super(100)
		check(dog.is_super_available, "mätaren laddas igen"))
	test("alla sex arter finns med tre nivåbeskrivningar", func() -> void:
		for k in CompanionManager.ORDER:
			var c: Companion = CompanionManager.create(k)
			check(c.kind == k, "art " + k)
			check(c.info().levels.size() == 3, "nivåer för " + k)
			c.free())

	print("Sköldskall mot robotarnas stun (GDD §6.3)")
	test("robotar inom 7,5 m paralyseras i 4 s, robotar långt bort påverkas inte", func() -> void:
		var dog: Companion = game.companions.active
		var at: Vector2 = game.player.pos
		dog.place_at(at)
		dog.position = Vector3(at.x, 0, at.y)
		var near := _add_bots(at, 4, 3.0)
		var far := _add_bots(at, 1, 20.0)
		dog.add_xp(100)
		dog.add_xp(350)
		check(dog.trigger_super(), "Sköldskall utlöses")
		for r in near:
			check(r.stun >= 3.99, "nära robot paralyserad (stun %.2f)" % r.stun)
		check(far[0].stun == 0.0, "robot långt bort opåverkad")
		check(game.player.shield == 2, "Signe får sköld 2"))
	test("testläget i Skogsboken ger 4/4 paralyserade", func() -> void:
		var s: String = game.test_shield_bark()
		check(s.contains("4/4"), s))
	test("energiskölden tar två träffar innan Signe skadas", func() -> void:
		var p: Player = game.player
		p.apply_energy_shield(2)
		var e0 := p.energy
		for i in 2:
			p.hurt(2, game, {})
			p.invuln = 0.0
		check(p.energy == e0, "skölden tog träffarna")
		p.hurt(2, game, {})
		check(p.energy == e0 - 2, "tredje träffen skadar"))

	print("Tidsstormen (GDD §5.2 EnvironmentController)")
	test("storm_intensity klampas till 0–1", func() -> void:
		var env: EnvironmentController = game.env
		env.storm_intensity = 1.7
		check(env.storm_intensity == 1.0, "övre gräns")
		env.storm_intensity = -3.0
		check(env.storm_intensity == 0.0, "undre gräns"))
	test("ljuset dämpas och partiklarna ökar med stormen, utan klocka", func() -> void:
		var env: EnvironmentController = game.env
		env.storm_intensity = 1.0
		env.lightning_enabled = false
		for i in 200:
			env._process(0.1)
		check(env.visual > 0.99, "visual följer stormen")
		check(game.moon.light_energy < 0.7, "månljuset dämpas (%.2f)" % game.moon.light_energy)
		check(env.particle_emitter.amount_ratio > 0.99, "partiklar på max")
		check(absf(env.particle_emitter.speed_scale - 2.5) < 0.05, "partikelfart")
		env.lightning_enabled = true)
	test("en kristall sänker stormen", func() -> void:
		game.env.storm_intensity = 0.6
		var cr: Dictionary = game.world.crystals[0]
		cr.buried = false
		game.take_crystal(cr)
		check(game.env.storm_intensity < 0.6, "storm efter kristall: %.2f" % game.env.storm_intensity))

	print("Rustning och strid")
	test("rustningsstilar klassas enligt GDD-tabellen", func() -> void:
		var c := func(h: String, ch: String, l: String) -> String: return ArmorStyle.classify({"helmet": h, "chest": ch, "legs": l}).id
		check(c.call("#4a6b3a", "#6b5a3a", "#3b4d2e") == "camo", "kamouflage")
		check(c.call("#39ff9a", "#ff3df0", "#3dd8ff") == "neon", "neon")
		check(c.call("#3a3d44", "#2b2d33", "#45474f") == "graphite", "grafit")
		check(c.call("#2f8a5a", "#4fc27a", "#3a4a6a") == "balanced", "standard"))
	test("kamouflage sänker upptäckt med 35 %", func() -> void:
		game.player.set_armor({"helmet": "#4a6b3a", "chest": "#6b5a3a", "legs": "#3b4d2e"})
		var r: Robot = _add_bots(game.player.pos, 1, 5.0)[0]
		check(absf(game.detection_mod(r) - 0.65) < 0.01, "detection_mod %.2f" % game.detection_mod(r)))
	test("grafit halverar elektrisk skada", func() -> void:
		var p: Player = game.player
		p.set_armor({"helmet": "#3a3d44", "chest": "#2b2d33", "legs": "#45474f"})
		var e0 := p.energy
		p.hurt(2, game, {})
		check(p.energy == e0 - 1, "energi %.1f" % p.energy))
	test("frusen robot tar 50 % mer skada av elhugg", func() -> void:
		var a: Robot = _add_bots(Vector2(10, 10), 1, 0.0, "bear")[0]
		var b: Robot = _add_bots(Vector2(12, 10), 1, 0.0, "bear")[0]
		b.frozen = 2.0
		var h0 := a.hp
		a.take_damage(10, "shock", game)
		b.take_damage(10, "shock", game)
		check(h0 - a.hp == 10 and h0 - b.hp == 15, "skada %.0f / %.0f" % [h0 - a.hp, h0 - b.hp]))
	test("smedjans paletter kostar skrot och kan köpas", func() -> void:
		var p: Player = game.player
		p.scrap = 7
		var cost := {"scrap": 6}
		check(ForgeData.pay(p, cost) and p.scrap == 1, "köp")
		check(not ForgeData.pay(p, cost), "för lite skrot"))

	print("Världen")
	test("världen är deterministisk", func() -> void:
		check(WorldData.new().ground == game.world.ground, "samma seed, samma karta"))
	test("minst åtta kristaller, Urkärnan och alla djur nås utan specialförmågor", func() -> void:
		var w: WorldData = game.world
		var seen := PackedByteArray()
		seen.resize(WorldData.W * WorldData.H)
		var st: Array = [Vector2i(floori(w.spawn.x), floori(w.spawn.y))]
		seen[w.idx(st[0].x, st[0].y)] = 1
		while st.size():
			var c: Vector2i = st.pop_back()
			for d in [Vector2i(1, 0), Vector2i(-1, 0), Vector2i(0, 1), Vector2i(0, -1)]:
				var n: Vector2i = c + d
				if not w.in_bounds(n.x, n.y) or seen[w.idx(n.x, n.y)] or w.is_solid_tile(n.x, n.y):
					continue
				seen[w.idx(n.x, n.y)] = 1
				st.append(n)
		var reach := 0
		for cr in w.crystals:
			if seen[w.idx(cr.tx, cr.ty)]:
				reach += 1
		check(reach >= 8, "nåbara kristaller: %d" % reach)
		check(seen[w.idx(48, 10)] or seen[w.idx(48, 11)], "Urkärnan")
		for a in w.animals:
			check(seen[w.idx(floori(a.pos.x), floori(a.pos.y))], "djur " + a.kind))
	test("sex kristallgrottor med grottgolv", func() -> void:
		var w: WorldData = game.world
		check(w.grottos.size() == 6, "antal grottor")
		for gr in w.grottos:
			check(w.g(gr.x, gr.y) == WorldData.G.CAVE, "grottgolv"))
	test("Bävern bygger bro och stockar röjs (sparas som ändringar)", func() -> void:
		var w3 := WorldData.new()
		check(w3.build_bridge("lake"), "bro byggs")
		w3.clear_block(74, 22)
		var kinds: Array = []
		for c in w3.changes:
			kinds.append(c.t)
		check(kinds == ["bridge", "clear"], "ändringar: %s" % str(kinds))
		var w4 := WorldData.new()
		w4.apply_changes(w3.changes)
		check(w4.bridge_sites.lake.built, "bron finns efter laddning")
		check(w4.b(74, 22) == WorldData.B.NONE, "stocken borta"))
	test("sparfil går fram och tillbaka", func() -> void:
		game.player.scrap = 42
		game.companions.unlock("fox", false)
		var s: Dictionary = JSON.parse_string(JSON.stringify(game.serialize()))
		game.new_state(s)
		check(game.player.scrap == 42, "skrot sparas")
		check(game.companions.unlocked.has("fox"), "räven sparas"))
