## Main – spelets huvudnod. Knyter ihop scenstrukturen från GDD §6:
## Player, CompanionManager och EnvironmentController som fristående noder,
## plus WorldBuilder (3D-världen), Fx (effekter) och GameUI (HUD och menyer).
extends Node3D

const SAVE_PATH := "user://signe_save.json"
const CRYSTALS_NEEDED := 8
const PITCH := 0.92

@onready var env: EnvironmentController = $EnvironmentController
@onready var world_env: WorldEnvironment = $WorldEnvironment
@onready var moon: DirectionalLight3D = $Moon
@onready var camera: Camera3D = $Camera3D
@onready var world_root: Node3D = $World
@onready var actors: Node3D = $Actors
@onready var companions: CompanionManager = $CompanionManager
@onready var fx: Fx = $Fx
@onready var ui: GameUI = $UI

var world: WorldData
var builder: WorldBuilder
var player: Player
var robots: Array = []
var pickups: Array = []
var projectiles: Array = []
var decoy := {}
var started := false
var paused := true
var time := 0.0
var player_down := false
var down_t := 0.0
var won := false
var visited := {"moss": true}
var current_sector := {}
var in_grotto := false
var near_campfire := false
var interact_target := {}
var dialog_anchor := Vector2.INF
var mouse_world := Vector2.ZERO
var mouse_aim_ok := false
var cam_yaw := PI / 4.0
var zoom := 21.0
var zoom_target := 21.0
var cam_target := Vector3.ZERO
var shake_amt := 0.0
var screen_flash := 0.0
var save_t := 0.0
var camp_t := 0.0
var grotto_k := 0.0
var fog_dirty := false
var stats := {"robots": 0, "start": 0}
var hidden_bonus := false
var reinforce_toast := false
var decoy_node: SigneModel


func _ready() -> void:
	add_to_group("game")
	camera.fov = 30.0
	companions.game = self
	if RenderingServer.get_current_rendering_method() != "forward_plus":
		# SSAO och volymetrisk dimma finns bara i Forward+ (dator); mobil/kompatibel kör utan
		world_env.environment.ssao_enabled = false
		world_env.environment.volumetric_fog_enabled = false
	env.particle_emitter = fx.storm_sparks
	env.set_rain(fx.rain)
	env.lightning.connect(_on_lightning)
	ui.setup(self)
	new_state({})
	ui.show_title(FileAccess.file_exists(SAVE_PATH))


# ---------------------------------------------------------------
# Nytt spel / laddning
# ---------------------------------------------------------------
func new_state(save: Dictionary) -> void:
	for c in world_root.get_children():
		c.queue_free()
	for c in actors.get_children():
		# lämna grupperna direkt så att Sköldskall inte hittar gamla noder
		c.remove_from_group("player")
		c.remove_from_group("robots")
		c.queue_free()
	for c in companions.get_children():
		c.queue_free()
	for pr in projectiles:
		fx.free_projectile(pr)
	for pk in pickups:
		if pk.has("node"):
			pk.node.queue_free()
	companions.roster = {}
	companions.unlocked = []
	companions.active_kind = ""
	robots = []
	pickups = []
	projectiles = []
	decoy = {}
	decoy_node = null
	world = WorldData.new()
	builder = WorldBuilder.new()
	world_root.add_child(builder)
	builder.build(world)
	for c in world.crystals:
		fx.add_bubbles(builder.crystal_nodes[c.id])
	env.storm_intensity = 0.3
	env.visual = 0.3
	player = Player.new()
	player.pos = world.spawn
	player.add_to_group("player")
	actors.add_child(player)
	companions.unlock("dog", true)
	for s in world.spawns:
		_add_robot(s.type, s.pos)
	visited = {"moss": true}
	current_sector = world.sector_at(floori(player.pos.y))
	won = false
	player_down = false
	in_grotto = false
	stats = {"robots": 0, "start": Time.get_unix_time_from_system()}
	hidden_bonus = false
	reinforce_toast = false
	if not save.is_empty():
		apply_save(save)
	world.reveal(player.pos, companions.reveal_radius())
	builder.update_fog()
	ui.rebuild_minimap()
	snap_camera()


func _add_robot(type: String, p: Vector2) -> Robot:
	var r := Robot.new(type, p)
	r.add_to_group("robots")
	actors.add_child(r)
	robots.append(r)
	return r


func start_game(save: Dictionary) -> void:
	ui.close_dialog()
	ui.hide_title()
	new_state(save)
	started = true
	set_paused(false)
	if save.is_empty():
		ui.banner("SEKTOR", "Mossdalen")
		var intro := func() -> void:
			say(player.pos, "[b]Signe:[/b] Tidsstormen laddar upp sig över skogen. Hunden och jag måste hitta energikristallerna i grottorna innan den växer sig för stark. Smedjan här i Skogsbasen hjälper mig rusta upp.")
		get_tree().create_timer(1.6).timeout.connect(intro)
	else:
		ui.toast("Välkommen tillbaka till skogen!")


func new_game() -> void:
	if FileAccess.file_exists(SAVE_PATH):
		DirAccess.remove_absolute(SAVE_PATH)
	start_game({})


func set_paused(p: bool) -> void:
	paused = p


# ---------------------------------------------------------------
# Bildruta
# ---------------------------------------------------------------
func _process(delta: float) -> void:
	var dt := minf(delta, 0.05)
	time += dt
	if started and not ui.is_blocking():
		if Input.is_action_just_pressed("menu"):
			ui.open_menu("")
		elif Input.is_action_just_pressed("map"):
			ui.open_menu("map")
	if started and not paused:
		tick(dt)
	else:
		env.focus = player.pos
	_update_visuals(dt)
	ui.update(dt)


func tick(dt: float) -> void:
	env.focus = player.pos
	if player_down:
		down_t -= dt
		if down_t <= 0.0:
			player_down = false
			return_to_base("Signe drog sig tillbaka till Skogsbasen för att ladda om. Allt hon samlat är kvar.")
	else:
		player.tick(dt, self)
	var c := companions.active
	if not player_down and c:
		if Input.is_action_just_pressed("super"):
			if c.current_level < 3:
				Sfx.play("deny")
				ui.toast("%s låses upp när %s når nivå 3." % [c.info().super.name, c.companion_name.to_lower()])
			elif not c.is_super_available:
				Sfx.play("deny")
				ui.toast("Supermätaren laddas när ni kortsluter robotar tillsammans (%d %%)." % int(c.super_meter))
			else:
				c.trigger_super()
		if Input.is_action_just_pressed("coop") and not c.use_coop():
			Sfx.play("deny")
		if Input.is_action_just_pressed("swap"):
			companions.cycle()
	companions.tick(dt)
	if Input.is_action_just_pressed("interact") and not interact_target.is_empty() and not player_down:
		Sfx.play("ui")
		interact_target.action.call()
	for r in robots:
		r.tick(dt, self)
	for r in robots.duplicate():
		if r.state == "disabled" and r.fade > 4.0:
			robots.erase(r)
			r.queue_free()
	_separate_robots()
	_update_projectiles(dt)
	_update_pickups(dt)
	if not decoy.is_empty():
		decoy.t -= dt
		if decoy.t <= 0.0:
			add_fx({"type": "puff", "pos": decoy.pos})
			decoy = {}
	for b in world.buried:
		b.marked = maxf(0.0, b.marked - dt)
	for cr in world.crystals:
		cr.ping = maxf(0.0, cr.ping - dt)

	# utforskning: dimman lyfts och stormen laddas
	var n := world.reveal(player.pos, companions.reveal_radius())
	if n:
		on_reveal(n)
	var sec := world.sector_at(floori(player.pos.y))
	if sec.id != current_sector.get("id", ""):
		current_sector = sec
		ui.banner("SEKTOR", sec.name)
		if not visited.has(sec.id):
			visited[sec.id] = true
			env.storm_intensity += 0.05
			ui.toast("Luften blir mer laddad här. Tidsstormen växer.")
	var cave := world.in_grotto(player.pos)
	if cave != in_grotto:
		in_grotto = cave
		if cave:
			for g in world.grottos:
				if Vector2(g.x + 0.5, g.y + 0.5).distance_to(player.pos) < g.r + 3.0 and not g.visited:
					g.visited = true
					ui.banner("DU HAR HITTAT", "En kristallgrotta")
					Sfx.play("crystal")
	for cr in world.crystals:
		if not cr.taken and not cr.buried and cr.pos.distance_to(player.pos) < 0.8:
			take_crystal(cr)
		if not cr.seen and not cr.buried and world.revealed[world.idx(cr.tx, cr.ty)]:
			cr.seen = true
	near_campfire = world.campfire.distance_to(player.pos) < 2.5
	if near_campfire and player.energy < player.max_energy():
		camp_t += dt
		if camp_t > 0.8:
			camp_t = 0.0
			player.energy = minf(player.max_energy(), player.energy + 1.0)
			floater(player.pos, "+1", Color("#5ef59a"))
	interact_target = find_interact()
	if ui.dialog_open and dialog_anchor != Vector2.INF and player.pos.distance_to(dialog_anchor) > 4.4:
		ui.close_dialog()
	save_t += dt
	if save_t > 10.0:
		save_t = 0.0
		save_game()


func _separate_robots() -> void:
	for i in robots.size():
		var a: Robot = robots[i]
		if not a.active():
			continue
		for j in range(i + 1, robots.size()):
			var b: Robot = robots[j]
			if not b.active() or a.def.fly != b.def.fly:
				continue
			var d := b.pos - a.pos
			var l := d.length()
			var mn := (a.radius + b.radius) * 0.8
			if l > 0.0 and l < mn:
				var push := d / l * (mn - l) / 2.0
				a.pos = world.move_body(a.pos, -push, a.radius * 0.6, 0.19, false, a.def.fly)[0]
				b.pos = world.move_body(b.pos, push, b.radius * 0.6, 0.19, false, b.def.fly)[0]


# ---------------------------------------------------------------
# Visuellt: kamera, synk, sikte, genomsiktshål
# ---------------------------------------------------------------
func _update_visuals(dt: float) -> void:
	player.sync(dt, self)
	for r in robots:
		r.sync(dt, self)
	companions.sync(dt)
	builder.animate(dt, time, won)
	for pk in pickups:
		_sync_pickup(pk)
	fx.sync_projectiles(projectiles)
	fx.tick(dt)
	fx.follow(player.position, env.visual, player.pos.y < 46)
	_sync_decoy()
	if fog_dirty:
		fog_dirty = false
		builder.update_fog()

	# kamera
	if Input.is_action_just_pressed("zoom_in"):
		zoom_target = clampf(zoom_target - 1.6, 12.0, 34.0)
	if Input.is_action_just_pressed("zoom_out"):
		zoom_target = clampf(zoom_target + 1.6, 12.0, 34.0)
	grotto_k = lerpf(grotto_k, 1.0 if in_grotto else 0.0, minf(1.0, dt * 2.5))
	env.grotto = grotto_k
	var zt := minf(zoom_target, 15.0) if in_grotto else zoom_target
	zoom = lerpf(zoom, zt, minf(1.0, dt * 3.0))
	var yaw := cam_yaw if started else cam_yaw + time * 0.04
	var lead := 1.2 if player.aimed else 0.6
	var tgt := Vector3(player.pos.x + cos(player.face) * lead, height_at(player.pos.x, player.pos.y) + 0.6, player.pos.y + sin(player.face) * lead)
	cam_target = cam_target.lerp(tgt, minf(1.0, dt * 5.0))
	var sh := shake_amt * 0.025
	shake_amt = maxf(0.0, shake_amt - dt * 18.0)
	screen_flash = maxf(0.0, screen_flash - dt * 1.2)
	var off := Vector3(sin(yaw) * cos(PITCH), sin(PITCH), cos(yaw) * cos(PITCH)) * zoom
	camera.look_at_from_position(cam_target + off + Vector3(randf_range(-sh, sh), randf_range(-sh, sh), 0), cam_target)
	moon.global_position = cam_target + Vector3(-10, 22, 6)
	moon.look_at(cam_target)

	# sikte med musen
	var vp := get_viewport()
	var mp := vp.get_mouse_position()
	var vs := vp.get_visible_rect().size
	mouse_aim_ok = Controls.device == "kbm" and Rect2(Vector2.ZERO, vs).has_point(mp) and started and not ui.is_blocking()
	if mouse_aim_ok:
		var o := camera.project_ray_origin(mp)
		var d := camera.project_ray_normal(mp)
		if absf(d.y) > 0.001:
			var t := (0.7 - o.y) / d.y
			var hit := o + d * t
			mouse_world = Vector2(hit.x, hit.z)

	# genomsiktshålet följer Signes huvud
	var head := player.position + Vector3(0, 1.4, 0)
	var sp := camera.unproject_position(head)
	RenderingServer.global_shader_parameter_set("cut_pos", sp / vs)
	RenderingServer.global_shader_parameter_set("cut_z", -(camera.global_transform.affine_inverse() * head).z)
	RenderingServer.global_shader_parameter_set("cut_aspect", vs.x / vs.y)
	RenderingServer.global_shader_parameter_set("cut_r", 0.2 * (21.0 / zoom) if started and not player_down else 0.0)
	builder.set_mist_color(world_env.environment.background_color.lightened(0.25))


func snap_camera() -> void:
	cam_target = Vector3(player.pos.x, 0.6, player.pos.y)


func height_at(x: float, z: float) -> float:
	return builder.height_at(x, z) if builder else 0.0


## Skärmriktning (upp = bort från kameran) → riktning i världen.
func to_world_dir(v: Vector2) -> Vector2:
	var c := cos(cam_yaw)
	var s := sin(cam_yaw)
	return Vector2(c * v.x + s * v.y, -s * v.x + c * v.y)


func _sync_decoy() -> void:
	if decoy.is_empty():
		if decoy_node:
			decoy_node.visible = false
		return
	if decoy_node == null:
		decoy_node = SigneModel.new(player.armor)
		decoy_node.scale = Vector3.ONE * 1.35
		var holo := Kit.glow(Color("#ff9a4a"), 1.2, true)
		holo.albedo_color = Color(1.0, 0.6, 0.3, 0.45)
		_apply_override(decoy_node, holo)
		actors.add_child(decoy_node)
	decoy_node.visible = true
	decoy_node.position = Vector3(decoy.pos.x, height_at(decoy.pos.x, decoy.pos.y), decoy.pos.y)
	decoy_node.rotation.y = time * 2.0


func _apply_override(n: Node, m: Material) -> void:
	for c in n.get_children():
		if c is GeometryInstance3D:
			c.material_override = m
		_apply_override(c, m)


# ---------------------------------------------------------------
# Händelser (anropas av spelare, robotar och djur)
# ---------------------------------------------------------------
func toast(text: String, secs: float = 2.8) -> void:
	ui.toast(text, secs)


func floater(p: Vector2, text: String, color: Color) -> void:
	fx.floater(Vector3(p.x, height_at(p.x, p.y) + 1.8, p.y), text, color)


func add_fx(f: Dictionary) -> void:
	fx.add(f)


func shake(n: float) -> void:
	shake_amt = maxf(shake_amt, n)


func detection_mod(r) -> float:
	var m := companions.detection_mod()
	if player.style.id == "camo":
		m *= 0.65
	if player.style.id == "neon" and r.type != "drone":
		m *= 1.35
	return m


func on_reveal(n: int, from_coop: bool = false) -> void:
	env.storm_intensity += n * 0.00009
	companions.add_xp(n * (0.08 if from_coop else 0.2))
	fog_dirty = true
	ui.minimap_dirty = true


func crystal_count() -> int:
	var n := 0
	for c in world.crystals:
		if c.taken:
			n += 1
	return n


func take_crystal(cr: Dictionary) -> void:
	cr.taken = true
	env.storm_intensity -= 0.12
	Sfx.play("crystal")
	add_fx({"type": "ring", "pos": cr.pos, "r0": 0.1, "r1": 2.9, "life": 0.7, "col": Color("#ff8af0"), "w": 0.12})
	fx.burst(Vector3(cr.pos.x, 1.0, cr.pos.y), 30, Color("#ffb0f8"), 3.0, 2.0, 0.9)
	companions.add_xp(35)
	var n := crystal_count()
	if n == CRYSTALS_NEEDED:
		ui.banner("ÅTTA KRISTALLER", "Urkärnan kan väckas")
	else:
		ui.toast("Energikristall! Stormen pressas tillbaka. (%d/%d)" % [n, CRYSTALS_NEEDED])


func on_robot_disabled(r) -> void:
	stats.robots += 1
	companions.add_xp(r.def.xp)
	companions.charge_super(12)


func on_hidden_path() -> void:
	if hidden_bonus:
		return
	hidden_bonus = true
	ui.toast("Lodjuret visar vägen genom snåren!")
	companions.add_xp(20)


func on_player_down() -> void:
	if player_down:
		return
	player_down = true
	down_t = 1.6
	Sfx.play("robot_down")
	add_fx({"type": "puff", "pos": player.pos})


func return_to_base(msg: String) -> void:
	player.pos = world.spawn
	player.energy = player.max_energy()
	player.coolant = player.max_coolant()
	player.invuln = 1.5
	player.knock = Vector2.ZERO
	snap_camera()
	var c := companions.active
	if c:
		c.action = {}
		c.task = {}
		c.z = 0.0
		c.place_at(player.pos + Vector2(-0.75, 0.25))
	for r in robots:
		if r.active() and r.state != "patrol":
			r.set_state("patrol")
	current_sector = world.sector_at(floori(player.pos.y))
	ui.toast(msg, 3.5)


func _on_lightning(p: Vector2) -> void:
	fx.lightning(p)
	if not started or won or env.visual < 0.6:
		return
	if p.distance_to(player.pos) < 5.6:
		return
	var near := 0
	var total := 0
	for r in robots:
		if r.active():
			total += 1
			if r.pos.distance_to(player.pos) < 20.0:
				near += 1
	if near >= 5 or total > 36:
		return
	var tx := floori(p.x)
	var ty := floori(p.y)
	if world.is_solid_tile(tx, ty) or world.g(tx, ty) == WorldData.G.SHALLOW:
		return
	var type := "drone" if ty < 44 else ("hound" if randf() < 0.6 else "drone")
	var r := _add_robot(type, p)
	r.set_state("chase")
	add_fx({"type": "ring", "pos": p, "r0": 0.1, "r1": 1.25, "life": 0.5, "col": Color("#e0b8ff")})
	if not reinforce_toast:
		reinforce_toast = true
		ui.toast("Blixten laddade liv i en robot! Samla kristaller för att lugna stormen.", 3.5)


# ---------------------------------------------------------------
# Interaktion
# ---------------------------------------------------------------
func find_interact() -> Dictionary:
	if player_down:
		return {}
	var p := player.pos
	if world.forge_pos.distance_to(p) < 1.9:
		return {"label": "Smedja", "pos": world.forge_pos, "action": func() -> void: ui.open_forge()}
	for a in world.animals:
		if not a.met and a.pos.distance_to(p) < 1.6:
			return {"label": "Bli vän", "pos": a.pos, "action": func() -> void: befriend(a)}
	for k in world.chests:
		if not k.open and k.pos.distance_to(p) < 1.4:
			return {"label": "Öppna", "pos": k.pos, "action": func() -> void: open_chest(k)}
	for r in world.runestones:
		if r.pos.distance_to(p) < 1.5:
			return {"label": "Läs", "pos": r.pos, "action": func() -> void: read_rune(r)}
	if world.core.pos.distance_to(p) < 2.9:
		return {"label": "Urkärnan" if won else "Väck kärnan", "pos": world.core.pos + Vector2(0, -1), "action": activate_core}
	for id in world.bridge_sites:
		var s: Dictionary = world.bridge_sites[id]
		var sp := Vector2(s.post[0] + 0.5, s.post[1] + 0.5)
		if not s.built and sp.distance_to(p) < 2.1:
			return {"label": "Bygg bro", "pos": sp, "action": func() -> void: try_bridge(s)}
	var tx := floori(p.x)
	var ty := floori(p.y)
	for j in range(-1, 2):
		for i in range(-1, 2):
			var bt := world.b(tx + i, ty + j)
			var cp := Vector2(tx + i + 0.5, ty + j + 0.5)
			if cp.distance_to(p) >= 1.4:
				continue
			if bt == WorldData.B.LOG:
				var log_text := func() -> void:
					say(cp, "Tunga fallna stockar. [b]Älgen[/b] på nivå 2 kan knuffa undan dem med sin Stockknuff, och Urkraftens Rusning plöjer rakt igenom.")
				return {"label": "Stock", "pos": cp, "action": log_text}
			if bt == WorldData.B.BARRICADE:
				var key := "%d,%d" % [tx + i, ty + j]
				var bar_text := func() -> void:
					say(cp, "En el-barrikad (%d laddningar kvar). Håll in elhugget för en [b]EMP[/b], eller låt Älgens rusning eller Bäverns översvämning kortsluta den." % int(world.block_hp.get(key, 0)))
				return {"label": "Barrikad", "pos": cp, "action": bar_text}
	return {}


func say(p: Vector2, bbcode: String) -> void:
	dialog_anchor = p
	ui.dialog(bbcode)


func befriend(a: Dictionary) -> void:
	a.met = true
	companions.unlock(a.kind, true)
	var info: Dictionary = Companion.INFO[a.kind]
	Sfx.play("level")
	ui.banner("NY VÄN", info.name)
	add_fx({"type": "ring", "pos": a.pos, "r0": 0.1, "r1": 1.75, "life": 0.6, "col": Color("#8fcf6a"), "w": 0.12})
	say(a.pos, "[b]%s[/b] (%s) följer nu med dig. %s\nSamarbete: [b]%s[/b]. De andra djuren väntar vid lägerelden – byt med %s." % [info.name, info.trait.to_lower(), info.levels[0], info.coop[0].name, Controls.label("swap")])


func open_chest(k: Dictionary) -> void:
	k.open = true
	Sfx.play("pickup")
	spawn_loot(k.pos, {"scrap": randi_range(6, 11), "chips": randi_range(1, 2), "berry": 1})
	companions.add_xp(15)
	ui.toast("Kistan innehöll skrot, kretsar och en bärkaka åt ditt djur.")


func read_rune(r: Dictionary) -> void:
	if not r.read:
		r.read = true
		companions.add_xp(10)
	say(r.pos, r.text)


func try_bridge(site: Dictionary) -> void:
	var c := companions.active
	if c and c.kind == "beaver" and c.current_level >= 2:
		build_bridge(site)
	else:
		say(Vector2(site.post[0] + 0.5, site.post[1] + 0.5), "Gamla brostolpar vid strandkanten. [b]Bävern[/b] på nivå 2 kan bygga en träbro härifrån.")


func near_bridge_site(d: float) -> Dictionary:
	for id in world.bridge_sites:
		var s: Dictionary = world.bridge_sites[id]
		if not s.built and Vector2(s.post[0] + 0.5, s.post[1] + 0.5).distance_to(player.pos) < d:
			return s
	return {}


func build_bridge(site: Dictionary) -> void:
	if not world.build_bridge(site.id):
		return
	Sfx.play("build")
	ui.toast("Bävern byggde en bro!")
	for t in site.tiles:
		add_fx({"type": "dirt", "pos": Vector2(t[0] + 0.5, t[1] + 0.5)})
	companions.add_xp(60)
	ui.minimap_dirty = true


func clear_logs_near(p: Vector2, r_tiles: float) -> int:
	var n := 0
	var r := ceili(r_tiles)
	for y in range(floori(p.y) - r, floori(p.y) + r + 1):
		for x in range(floori(p.x) - r, floori(p.x) + r + 1):
			if world.b(x, y) == WorldData.B.LOG and Vector2(x - floori(p.x), y - floori(p.y)).length() <= r_tiles:
				world.clear_block(x, y)
				add_fx({"type": "dirt", "pos": Vector2(x + 0.5, y + 0.5)})
				n += 1
	if n:
		ui.minimap_dirty = true
	return n


func smash_obstacles_at(p: Vector2) -> void:
	for y in range(floori(p.y) - 1, floori(p.y) + 2):
		for x in range(floori(p.x) - 1, floori(p.x) + 2):
			var bt := world.b(x, y)
			if bt == WorldData.B.LOG or bt == WorldData.B.BARRICADE or bt == WorldData.B.SCRAPHEAP:
				world.clear_block(x, y)
				add_fx({"type": "sparks", "pos": Vector2(x + 0.5, y + 0.5), "n": 10})
				if bt == WorldData.B.SCRAPHEAP:
					spawn_loot(Vector2(x + 0.5, y + 0.5), {"scrap": 2})
				ui.minimap_dirty = true


func damage_barricades_near(p: Vector2, R: float, dmg: int) -> void:
	var r := ceili(R)
	for y in range(floori(p.y) - r, floori(p.y) + r + 1):
		for x in range(floori(p.x) - r, floori(p.x) + r + 1):
			if world.b(x, y) != WorldData.B.BARRICADE:
				continue
			if p.distance_to(Vector2(x + 0.5, y + 0.5)) > R + 0.5:
				continue
			var key := "%d,%d" % [x, y]
			world.block_hp[key] = int(world.block_hp.get(key, 1)) - dmg
			add_fx({"type": "sparks", "pos": Vector2(x + 0.5, y + 0.3), "n": 10})
			if world.block_hp[key] <= 0:
				world.clear_block(x, y)
				ui.toast("Barrikaden kortslöts!")
				companions.add_xp(15)
			else:
				floater(Vector2(x + 0.5, y + 0.5), "Barriär %d/3" % world.block_hp[key], Color("#ff9ab0"))


func activate_core() -> void:
	if won:
		say(world.core.pos, "Urkärnan sjunger lågt. Skölden vilar över skogen.")
		return
	var n := crystal_count()
	if n < CRYSTALS_NEEDED:
		say(world.core.pos, "Urkärnan sover. Den behöver [b]%d energikristaller[/b] för att höja skölden – du har %d." % [CRYSTALS_NEEDED, n])
		return
	won = true
	Sfx.play("win")
	shake(8)
	screen_flash = 1.0
	env.storm_intensity = 0.0
	for r in robots:
		if r.active():
			r.apply_stun(6.0)
	add_fx({"type": "ring", "pos": world.core.pos, "r0": 0.6, "r1": 16.0, "life": 2.0, "col": Color("#b6f7ff"), "w": 0.1})
	ui.banner("URKÄRNAN", "Skölden höjs")
	var finish := func() -> void:
		var mins := maxi(1, int((Time.get_unix_time_from_system() - stats.start) / 60.0))
		ui.show_win("Med %d energikristaller väckte Signe Urkärnan. Tidsstormen har lagt sig och skogen andas ut. %d robotar kortslöts, %d av 6 djur blev vänner, och %d %% av skogen utforskades på ungefär %d minuter." % [n, stats.robots, companions.unlocked.size(), roundi(world.revealed_fraction() * 100), mins])
		save_game()
	get_tree().create_timer(2.6).timeout.connect(finish)


# ---------------------------------------------------------------
# Loot och projektiler
# ---------------------------------------------------------------
func spawn_loot(p: Vector2, loot: Dictionary) -> void:
	var add := func(kind: String, value: int) -> void:
		var a := randf() * TAU
		var s := randf_range(1.9, 4.4)
		pickups.append({"kind": kind, "value": value, "pos": p, "vel": Vector2(cos(a) * s, sin(a) * s * 0.6), "z": 0.0, "vz": randf_range(3.75, 6.25), "age": 0.0, "claimed": false})
	var scrap: int = loot.get("scrap", 0)
	while scrap > 0:
		var v := 2 if scrap > 6 else 1
		add.call("scrap", v)
		scrap -= v
	for i in loot.get("chips", 0):
		add.call("chip", 1)
	for i in loot.get("berry", 0):
		add.call("berry", 1)


func collect_pickup(pk: Dictionary, via_fox: bool = false) -> void:
	var i := pickups.find(pk)
	if i < 0:
		return
	pickups.remove_at(i)
	if pk.has("node"):
		pk.node.queue_free()
	match pk.kind:
		"scrap":
			player.scrap += pk.value
			floater(pk.pos if via_fox else player.pos, "+%d skrot" % pk.value, Color("#d4e2f2"))
		"chip":
			player.chips += pk.value
			floater(player.pos, "+1 krets", Color("#8fef8a"))
		_:
			companions.add_xp(50)
			var c := companions.active
			floater(c.pos if c else player.pos, "Mums! +50", Color("#ff9aa8"))
	Sfx.play("pickup")


func _update_pickups(dt: float) -> void:
	for k in pickups.duplicate():
		k.age += dt
		if k.z > 0.0 or k.vz > 0.0:
			k.vz -= 16.0 * dt
			k.z = maxf(0.0, k.z + k.vz * dt)
			if k.z == 0.0:
				k.vz = -k.vz * 0.35 if k.vz < -2.5 else 0.0
			var np: Vector2 = k.pos + k.vel * dt
			if not world.is_solid_at(np):
				k.pos = np
			k.vel *= pow(0.05, dt)
		var d: float = k.pos.distance_to(player.pos)
		if k.age > 0.4 and d < 1.75 and not player_down:
			k.pos += (player.pos - k.pos) / maxf(d, 0.01) * 8.75 * dt
		if k.age > 0.4 and d < 0.5:
			collect_pickup(k)


func _sync_pickup(k: Dictionary) -> void:
	if not k.has("node"):
		k.node = Props.pickup(k.kind)
		actors.add_child(k.node)
	k.node.position = Vector3(k.pos.x, height_at(k.pos.x, k.pos.y) + 0.2 + k.z + sin(time * 4.0 + k.pos.x) * 0.04, k.pos.y)
	k.node.rotation.y = time * 2.0 + k.pos.x


func _update_projectiles(dt: float) -> void:
	for pr in projectiles.duplicate():
		pr.life -= dt
		pr.pos += pr.vel * dt
		var dead: bool = pr.life <= 0.0
		if not dead and pr.kind == "frost":
			var bt := world.b(floori(pr.pos.x), floori(pr.pos.y + 0.35))
			if bt != WorldData.B.NONE and bt != WorldData.B.CAMPFIRE:
				add_fx({"type": "frostburst", "pos": pr.pos})
				dead = true
			else:
				for r in robots:
					if r.active() and pr.pos.distance_to(r.pos) < r.radius + 0.25:
						r.chill += player.frost_chill()
						r.take_damage(2 + player.stats.frost, "frost", self, pr.pos)
						if r.active() and r.chill >= 3.0 and r.frozen <= 0.0:
							r.frozen = player.frost_duration()
							r.chill = 3.0
							r.lunge = {}
							Sfx.play("freeze")
							floater(r.pos, "Fryst!", Color("#b6f7ff"))
						companions.charge_super(2)
						add_fx({"type": "frostburst", "pos": pr.pos})
						dead = true
						break
		elif not dead:
			if not player_down and pr.pos.distance_to(player.pos) < 0.45:
				player.hurt(pr.dmg, self, {"from": pr.pos})
				dead = true
			elif not decoy.is_empty() and pr.pos.distance_to(decoy.pos) < 0.5:
				dead = true
		if dead:
			fx.free_projectile(pr)
			projectiles.erase(pr)


# ---------------------------------------------------------------
# Testläge: GDD §6.3 – Hundens Sköldskall mot fiendernas stun
# ---------------------------------------------------------------
func test_shield_bark() -> String:
	companions.unlock("dog", true)
	var dog := companions.active
	while dog.current_level < 3:
		dog.add_xp(dog.xp_to_next_level[dog.current_level - 1])
	dog.is_super_available = true
	var bots: Array = []
	for i in 4:
		var a := TAU * i / 4.0
		var p := player.pos + Vector2.from_angle(a) * 2.9
		if world.is_solid_at(p):
			p = player.pos + Vector2.from_angle(a) * 1.25
		var r := _add_robot("hound", p)
		r.set_state("chase")
		r.position = Vector3(p.x, 0, p.y)
		bots.append(r)
	dog.place_at(player.pos + Vector2(-0.5, 0.12))
	dog.position = Vector3(dog.pos.x, 0, dog.pos.y)
	var ok := dog.trigger_super()
	var stunned := 0
	for r in bots:
		if r.stun >= 3.99:
			stunned += 1
	if ok:
		return "Sköldskall testat: %d/4 robotar paralyserade i 4 s, Signes sköld: %d träffar." % [stunned, player.shield]
	return "Sköldskall kunde inte utlösas."


# ---------------------------------------------------------------
# Sparning (JSON i user://)
# ---------------------------------------------------------------
func serialize() -> Dictionary:
	var cr: Array = []
	for c in world.crystals:
		cr.append(2 if c.taken else (0 if c.buried else 1))
	var chests: Array = []
	for k in world.chests:
		if k.open:
			chests.append(k.id)
	var dug: Array = []
	for b in world.buried:
		if b.dug:
			dug.append(b.id)
	var met: Array = []
	for a in world.animals:
		if a.met:
			met.append(a.kind)
	var runes: Array = []
	for r in world.runestones:
		if r.read:
			runes.append(r.id)
	return {
		"v": 1,
		"player": {"x": player.pos.x, "y": player.pos.y, "energy": player.energy, "scrap": player.scrap, "chips": player.chips, "stats": player.stats, "armor": player.armor, "pal": player.unlocked_palettes, "painter": player.painter_unlocked},
		"comps": companions.serialize(),
		"storm": env.storm_intensity,
		"fog": Marshalls.raw_to_base64(world.revealed),
		"changes": world.changes,
		"crystals": cr, "chests": chests, "dug": dug, "met": met, "runes": runes,
		"heaps": world.scrap_heap_used.keys(),
		"block_hp": world.block_hp,
		"won": won,
		"visited": visited.keys(),
		"stats": stats,
		"hidden": hidden_bonus,
	}


func save_game() -> void:
	if not started:
		return
	var f := FileAccess.open(SAVE_PATH, FileAccess.WRITE)
	if f:
		f.store_string(JSON.stringify(serialize()))


func load_save() -> Dictionary:
	if not FileAccess.file_exists(SAVE_PATH):
		return {}
	var data = JSON.parse_string(FileAccess.get_file_as_string(SAVE_PATH))
	return data if data is Dictionary else {}


func apply_save(s: Dictionary) -> void:
	world.apply_changes(s.get("changes", []))
	for k in s.get("block_hp", {}):
		world.block_hp[k] = int(s.block_hp[k])
	for k in s.get("heaps", []):
		world.scrap_heap_used[k] = true
	if s.has("fog"):
		var raw := Marshalls.base64_to_raw(s.fog)
		if raw.size() == world.revealed.size():
			world.revealed = raw
	var cr: Array = s.get("crystals", [])
	for i in mini(cr.size(), world.crystals.size()):
		world.crystals[i].taken = int(cr[i]) == 2
		if int(cr[i]) >= 1:
			world.crystals[i].buried = false
	for k in world.chests:
		k.open = s.get("chests", []).has(k.id)
	for b in world.buried:
		b.dug = s.get("dug", []).has(b.id)
	for a in world.animals:
		a.met = s.get("met", []).has(a.kind)
	for r in world.runestones:
		r.read = s.get("runes", []).has(r.id)
	var sp: Dictionary = s.get("player", {})
	player.pos = Vector2(sp.get("x", world.spawn.x), sp.get("y", world.spawn.y))
	if world.is_solid_at(player.pos):
		player.pos = world.spawn
	player.scrap = int(sp.get("scrap", 0))
	player.chips = int(sp.get("chips", 0))
	var st: Dictionary = sp.get("stats", {})
	for key in player.stats:
		player.stats[key] = int(st.get(key, 1))
	player.energy = minf(player.max_energy(), float(sp.get("energy", player.max_energy())))
	player.coolant = player.max_coolant()
	player.unlocked_palettes = sp.get("pal", ["original"])
	player.painter_unlocked = bool(sp.get("painter", false))
	if sp.has("armor"):
		player.set_armor(sp.armor)
	companions.load_data(s.get("comps", {}))
	for k in companions.unlocked:
		if k != companions.active_kind:
			companions.park_at_base(companions.roster[k])
	env.storm_intensity = float(s.get("storm", 0.3))
	env.visual = env.storm_intensity
	won = bool(s.get("won", false))
	visited = {}
	for v in s.get("visited", ["moss"]):
		visited[v] = true
	stats = s.get("stats", stats)
	hidden_bonus = bool(s.get("hidden", false))
