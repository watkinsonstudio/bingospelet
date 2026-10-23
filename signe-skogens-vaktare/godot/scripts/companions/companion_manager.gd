## CompanionManager – fristående nod (GDD §6) som håller i följet. Ett djur
## följer med Signe; de andra väntar vid lägerelden i Skogsbasen.
class_name CompanionManager
extends Node3D

signal companion_level_changed(c: Companion, level: int)
signal companion_super_ready(c: Companion)
signal active_changed(c: Companion)

const ORDER := ["dog", "fox", "beaver", "lynx", "moose", "owl"]

var game = null
var roster := {}
var unlocked: Array = []
var active_kind := ""
var active: Companion:
	get:
		return roster.get(active_kind, null)


static func create(kind: String) -> Companion:
	match kind:
		"dog":
			return DogCompanion.new()
		"lynx":
			return LynxCompanion.new()
		"owl":
			return OwlCompanion.new()
		"moose":
			return MooseCompanion.new()
		"fox":
			return FoxCompanion.new()
	return BeaverCompanion.new()


func unlock(kind: String, make_active: bool = true) -> void:
	if not roster.has(kind):
		var c := create(kind)
		c.game = game
		c.level_changed.connect(func(l: int) -> void: companion_level_changed.emit(c, l))
		c.super_ready.connect(func() -> void: companion_super_ready.emit(c))
		roster[kind] = c
		add_child(c)
		park_at_base(c)
	if not unlocked.has(kind):
		unlocked.append(kind)
		unlocked.sort_custom(func(a, b) -> bool: return ORDER.find(a) < ORDER.find(b))
	if make_active:
		set_active(kind)


func set_active(kind: String) -> void:
	if not unlocked.has(kind):
		return
	var prev := active
	active_kind = kind
	var c := active
	c.task = {}
	c.action = {}
	c.z = 0.0
	c.place_at(game.player.pos + Vector2(-0.75, 0.25))
	if prev and prev != c:
		park_at_base(prev)
	active_changed.emit(c)


func cycle() -> void:
	if unlocked.size() < 2:
		return
	set_active(unlocked[(unlocked.find(active_kind) + 1) % unlocked.size()])


func park_at_base(c: Companion) -> void:
	var a := TAU * ORDER.find(c.kind) / ORDER.size()
	c.place_at(game.world.campfire + Vector2(cos(a) * 2.75, sin(a) * 1.9 + 0.4))
	c.task = {}
	c.action = {}
	c.z = 0.0


func tick(dt: float) -> void:
	if active:
		active.tick(dt)
	for k in unlocked:
		if k != active_kind:
			var r: Companion = roster[k]
			r.coop_cd = maxf(0.0, r.coop_cd - dt)
			r.moving = false
			r.z = 0.15 if k == "owl" else 0.0


func sync(dt: float) -> void:
	for k in unlocked:
		roster[k].sync(dt, k == active_kind)


func add_xp(n: float) -> void:
	if active:
		active.add_xp(n)


func charge_super(n: float) -> void:
	if active:
		active.charge_super(n)


func hidden_paths_open() -> bool:
	return active_kind == "lynx"


func reveal_radius() -> float:
	return active.reveal_radius() if active else 8.0


func detection_mod() -> float:
	return active.detection_mod() if active else 1.0


func on_robot_alert(r) -> void:
	if active and r.pos.distance_to(game.player.pos) < 10.0:
		active.on_robot_alert(r)


func serialize() -> Dictionary:
	var out := {"active": active_kind, "list": {}}
	for k in unlocked:
		var c: Companion = roster[k]
		out.list[k] = {"lvl": c.current_level, "xp": c.current_xp, "sup": c.is_super_available, "meter": c.super_meter}
	return out


func load_data(data: Dictionary) -> void:
	for k in data.get("list", {}):
		unlock(k, false)
		var v: Dictionary = data.list[k]
		var c: Companion = roster[k]
		c.current_level = int(v.lvl)
		c.current_xp = float(v.xp)
		c.is_super_available = bool(v.sup)
		c.super_meter = float(v.meter)
	if data.get("active", "") != "":
		set_active(data.active)
