## Player – Signe. Rör sig i förhållande till den isometriska kameran, siktar
## med musen eller höger spak. Väktarbågen: elhugg (håll in = EMP) och
## frostpilar som fryser robotarnas hydraulik.
class_name Player
extends Node3D

var pos := Vector2.ZERO
var face := -PI * 0.75
var move_dir := 0.0
var moving := false
var aimed := false
var speed := 4.0
var energy := 10.0
var invuln := 0.0
var shield := 0
var staff_cd := 0.0
var emp_cd := 0.0
var frost_cd := 0.0
var coolant := 6.0
var cool_timer := 0.0
var water_timer := 0.0
var knock := Vector2.ZERO
var swing := 0.0
var shot := 0.0
var staff_hold := 0.0
var charge_fx := 0.0
var stats := {"staff": 1, "frost": 1, "cool": 1, "plate": 1}
var scrap := 0
var chips := 0
var armor := {"helmet": "#2f8a5a", "chest": "#4fc27a", "legs": "#3a4a6a"}
var unlocked_palettes: Array = ["original"]
var painter_unlocked := false
var style: Dictionary = ArmorStyle.STYLES.balanced
var model: SigneModel
var shield_mesh: MeshInstance3D


func _init() -> void:
	model = SigneModel.new(armor)
	model.scale = Vector3.ONE * 1.35
	add_child(model)
	var sm := Kit.glow(Color("#ffd25e"), 0.6, true)
	sm.albedo_color = Color(0.6, 0.5, 0.2, 0.3)
	shield_mesh = Kit.mi(Kit.sphere(0.9, 24, 12), sm, Vector3(0, 0.8, 0))
	shield_mesh.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	shield_mesh.visible = false
	add_child(shield_mesh)
	set_armor(armor)


func max_energy() -> float:
	return 8.0 + stats.plate * 2.0


func max_coolant() -> float:
	return 4.0 + stats.cool * 2.0


func staff_damage() -> int:
	return 6 + (stats.staff - 1) * 4


func emp_radius() -> float:
	return 2.9 + stats.staff * 0.25


func frost_chill() -> float:
	return 1.0 + (stats.frost - 1) * 0.4


func frost_duration() -> float:
	return 2.2 + (stats.frost - 1) * 0.5


func set_armor(a: Dictionary) -> void:
	armor = a.duplicate()
	style = ArmorStyle.classify(armor)
	model.apply_armor(armor)


## GDD: player.apply_energy_shield(2)
func apply_energy_shield(hits: int) -> void:
	shield = maxi(shield, hits)


func terrain_speed(game) -> float:
	var gt: int = game.world.ground_at(pos)
	var comp = game.companions.active
	if (gt == WorldData.G.MUD or gt == WorldData.G.SNOW) and not (comp and comp.kind == "moose" and comp.near(pos, 5.6)):
		return 0.55 if gt == WorldData.G.MUD else 0.7
	if gt == WorldData.G.SHALLOW and not (comp and comp.kind == "beaver"):
		return 0.55
	return 1.0


func tick(dt: float, game) -> void:
	var mv: Vector2 = game.to_world_dir(Controls.move_vector())
	var mag := mv.length()
	moving = mag > 0.05
	if moving:
		move_dir = mv.angle()
	aimed = false
	var stick := Controls.aim_stick()
	if stick != Vector2.ZERO:
		face = game.to_world_dir(stick).angle()
		aimed = true
	elif Controls.device == "kbm" and game.mouse_aim_ok:
		face = (game.mouse_world - pos).angle()
		aimed = true
	elif moving:
		face = move_dir
	var charging := Input.is_action_pressed("staff") and staff_hold > 0.3
	var sp := speed * terrain_speed(game) * (0.5 if charging else 1.0) * minf(1.0, mag)
	var d := (Vector2.from_angle(move_dir) * sp if moving else Vector2.ZERO) + knock
	var was_hidden: bool = game.world.ground_at(pos) == WorldData.G.HIDDEN
	var res: Array = game.world.move_body(pos, d * dt, 0.25, 0.19, game.companions.hidden_paths_open())
	pos = res[0]
	if not was_hidden and game.world.ground_at(pos) == WorldData.G.HIDDEN:
		game.on_hidden_path()
	knock *= pow(0.001, dt)
	invuln = maxf(0.0, invuln - dt)
	staff_cd = maxf(0.0, staff_cd - dt)
	emp_cd = maxf(0.0, emp_cd - dt)
	frost_cd = maxf(0.0, frost_cd - dt)
	swing = maxf(0.0, swing - dt)
	shot = maxf(0.0, shot - dt)
	if coolant < max_coolant():
		cool_timer += dt * (3.0 if game.near_campfire else 1.0)
		if cool_timer >= 0.8:
			cool_timer = 0.0
			coolant += 1.0
	# Kallt vatten tär på energin (om inte Bävern hjälper till)
	var comp = game.companions.active
	if game.world.ground_at(pos) == WorldData.G.SHALLOW and not (comp and comp.kind == "beaver"):
		water_timer += dt
		if water_timer > 2.5:
			water_timer = 0.0
			hurt(1.0, game, {"electric": false, "silent": true})
			game.floater(pos, "Kallt!", Color("#9fe6ff"))
	else:
		water_timer = 0.0

	# Väktarbågen: elhugg direkt, laddad EMP när knappen släpps
	if Input.is_action_pressed("staff"):
		staff_hold += dt
	if Input.is_action_just_pressed("staff") and staff_cd <= 0.0:
		staff_hold = 0.0
		strike(game)
	if charging and emp_cd <= 0.0:
		charge_fx += dt
		if int(charge_fx * 6.0) != int((charge_fx - dt) * 6.0):
			Sfx.play("charge")
	if Input.is_action_just_released("staff"):
		if staff_hold >= 0.6 and emp_cd <= 0.0:
			emp(game)
		staff_hold = 0.0
		charge_fx = 0.0
	if Input.is_action_pressed("frost") and frost_cd <= 0.0:
		if coolant >= 1.0:
			fire_frost(game)
		elif Input.is_action_just_pressed("frost"):
			Sfx.play("deny")
			game.floater(pos, "Kogret är tomt", Color("#9fe6ff"))


func strike(game) -> void:
	staff_cd = 0.3
	swing = 0.18
	Sfx.play("zap")
	game.add_fx({"type": "arc", "pos": pos, "a": face, "life": 0.22})
	var hit_any := false
	for r in game.robots:
		if not r.active():
			continue
		var d := pos.distance_to(r.pos)
		var ang: float = (r.pos - pos).angle()
		if d < 1.5 + r.radius and (d < 0.75 or absf(SV.angle_diff(face, ang)) < 1.25):
			r.take_damage(staff_damage(), "shock", game, pos)
			hit_any = true
	# skrothögar ger lite skrot första gången
	var hp := pos + Vector2.from_angle(face) * 0.6
	for j in range(-1, 2):
		for i in range(-1, 2):
			var x := floori(hp.x) + i
			var y := floori(hp.y) + j
			var key := "%d,%d" % [x, y]
			if game.world.b(x, y) == WorldData.B.SCRAPHEAP and not game.world.scrap_heap_used.has(key) and hp.distance_to(Vector2(x + 0.5, y + 0.5)) < 1.25:
				game.world.scrap_heap_used[key] = true
				game.spawn_loot(Vector2(x + 0.5, y + 0.6), {"scrap": 2})
				game.add_fx({"type": "sparks", "pos": Vector2(x + 0.5, y + 0.5), "n": 8})
	if hit_any:
		game.companions.charge_super(3)


func emp(game) -> void:
	emp_cd = 3.0
	staff_cd = 0.4
	var R := emp_radius()
	Sfx.play("emp")
	game.shake(4)
	game.add_fx({"type": "ring", "pos": pos, "r0": 0.25, "r1": R, "life": 0.45, "col": Color("#7ff3ff")})
	for r in game.robots:
		if r.active() and pos.distance_to(r.pos) < R + r.radius:
			r.apply_stun(2.5)
			r.take_damage(4 + stats.staff * 2, "emp", game, pos)
	game.damage_barricades_near(pos, R, 1)
	game.companions.charge_super(6)


func fire_frost(game) -> void:
	frost_cd = 0.26
	coolant -= 1.0
	cool_timer = 0.0
	Sfx.play("frost")
	# siktesstöd när man inte siktar med mus/spak
	var a := face
	if not aimed:
		var best_score := INF
		for r in game.robots:
			if not r.active():
				continue
			var d := pos.distance_to(r.pos)
			if d > 9.4:
				continue
			var ang: float = (r.pos - pos).angle()
			var diff := absf(SV.angle_diff(face, ang))
			if diff > 1.0:
				continue
			if d + diff * 3.75 < best_score:
				best_score = d + diff * 3.75
				a = ang
	face = a
	shot = 0.25
	game.projectiles.append({"kind": "frost", "pos": pos + Vector2.from_angle(a) * 0.5, "vel": Vector2.from_angle(a) * 11.9, "a": a, "life": 0.8, "r": 0.25})


func hurt(dmg: float, game, src: Dictionary = {}) -> bool:
	var silent: bool = src.get("silent", false)
	if invuln > 0.0 and not silent:
		return false
	if shield > 0 and not silent:
		shield -= 1
		invuln = 0.6
		game.add_fx({"type": "ring", "pos": pos, "r0": 0.5, "r1": 1.1, "life": 0.3, "col": Color("#ffd25e")})
		game.floater(pos, "Sköld!", Color("#ffd25e"))
		return false
	var amount := dmg
	if src.get("electric", true) and style.id == "graphite":
		amount *= 0.5
	energy = maxf(0.0, energy - amount)
	if not silent:
		invuln = 1.0
		Sfx.play("hurt")
		game.shake(3)
		var from: Vector2 = src.get("from", pos)
		knock = (pos - from).normalized() * 8.75 if from != pos else Vector2.ZERO
	if energy <= 0.0:
		game.on_player_down()
	return true


## Visuell synk varje bildruta.
func sync(dt: float, game) -> void:
	position = Vector3(pos.x, game.height_at(pos.x, pos.y), pos.y)
	var want := SV.yaw_from_angle(face)
	model.rotation.y = lerp_angle(model.rotation.y, want, minf(1.0, dt * 14.0))
	model.visible = not game.player_down and not (invuln > 0.0 and int(game.time * 14.0) % 2 == 0)
	var charge := staff_hold if (Input.is_action_pressed("staff") and staff_hold > 0.3 and emp_cd <= 0.0) else 0.0
	model.animate({"dt": dt, "moving": moving, "speed_k": minf(1.3, Controls.move_vector().length() + 0.3), "shot": shot, "swing": swing, "charge": charge})
	shield_mesh.visible = shield > 0
