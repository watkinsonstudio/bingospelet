# DogCompanion.gd – Hunden: beskydd och resurssökning.
class_name DogCompanion
extends Companion

# GDD:ns 250 px motsvarar 7,5 meter i 3D-världen.
const SHIELD_BARK_RANGE := 7.5

var bark_cd := 0.0
var sniff := 0.0


func _init() -> void:
	super._init("dog")
	companion_name = "Hunden"


func sniff_radius() -> float:
	return (6.0 if current_level >= 2 else 3.25) * (2.5 if sniff > 0.0 else 1.0)


func think(dt: float) -> void:
	bark_cd = maxf(0.0, bark_cd - dt)
	sniff = maxf(0.0, sniff - dt)
	if not task.is_empty():
		return
	var R := sniff_radius()
	for spot in game.world.buried:
		if spot.dug or spot.pos.distance_to(pos) > R or spot.pos.distance_to(game.player.pos) > R + 2.5:
			continue
		spot.marked = 4.0
		var dig := func(_d: float) -> void:
			if randf() < 0.3:
				game.add_fx({"type": "dirt", "pos": pos})
		var found := func() -> void:
			spot.dug = true
			game.spawn_loot(spot.pos, {"scrap": randi_range(2, 4)})
			game.companions.add_xp(6)
			say("Voff!")
		var arrive := func() -> void:
			action = {"t": 0.8, "update": dig, "done": found}
		task = {"pos": spot.pos, "timeout": 5.0, "on_arrive": arrive}
		break
	# hittar även begravda kristaller
	for c in game.world.crystals:
		if c.buried and not c.taken and c.pos.distance_to(pos) < R:
			c.buried = false
			c.seen = true
			say("Voff! Voff!", 2.0)
			game.toast("Hunden grävde fram en dold energikristall!")
			game.add_fx({"type": "dirt", "pos": c.pos})


# Nivå 1: skäller när fiender närmar sig
func on_robot_alert(_r) -> void:
	if bark_cd > 0.0:
		return
	bark_cd = 5.0
	say("Voff!")
	Sfx.play("bark")


func do_coop(id: String) -> bool:
	if id == "sniff":
		sniff = 7.0
		say("*nosar*", 1.5)
		game.add_fx({"type": "ring", "pos": pos, "r0": 0.25, "r1": sniff_radius(), "life": 0.6, "col": Color("#ffd25e")})
		return true
	var target := nearest_robot(pos, 10.6)
	if target == null:
		game.toast("Ingen robot att distrahera i närheten.")
		return false
	target.distract = {"target": self, "t": 5.0}
	target.set_state("chase")
	Sfx.play("bark")
	say("VOFF!", 2.0)
	game.add_fx({"type": "ring", "pos": pos, "r0": 0.1, "r1": 1.6, "life": 0.4, "col": Color("#ffd25e")})
	var a0: float = (target.pos - pos).angle() + PI
	var state := {"ang": a0}
	var run := func(d: float) -> void:
		state.ang += d * 1.4
		var c: Vector2 = game.player.pos + Vector2.from_angle(a0) * 3.1
		var tgt: Vector2 = c + Vector2.from_angle(state.ang) * 1.9
		var v := (tgt - pos).normalized() * 5.9 * d
		pos = game.world.move_body(pos, v, 0.19, 0.12, true)[0]
		moving = true
	action = {"t": 5.0, "update": run}
	return true


# Superattack: Sköldskall
func execute_super_ability() -> void:
	# Implementering av "Sköldskall"
	print("Sköldskall aktiverat! Sonisk chockvåg utlöses.")
	game.toast("Sköldskall! Sonisk chockvåg utlöses.")
	Sfx.play("bark")
	Sfx.play("super")
	game.shake(6)
	game.add_fx({"type": "ring", "pos": pos, "r0": 0.25, "r1": SHIELD_BARK_RANGE, "life": 0.7, "col": Color("#ffd25e"), "w": 0.12})
	var targets = get_tree().get_nodes_in_group("robots")
	for robot in targets:
		if robot.active() and global_position.distance_to(robot.global_position) < SHIELD_BARK_RANGE:
			robot.apply_stun(4.0)

	# Ge Signe energisköld
	var player = get_tree().get_first_node_in_group("player")
	if player:
		player.apply_energy_shield(2)
