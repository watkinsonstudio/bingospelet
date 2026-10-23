# FoxCompanion.gd – Räven: sensorstörning och stöld.
class_name FoxCompanion
extends Companion


func _init() -> void:
	super._init("fox")
	companion_name = "Räven"
	speed = 5.5


# Nivå 1: samlar automatiskt upp skrot som tappats på marken
func think(_dt: float) -> void:
	if not task.is_empty():
		return
	for pk in game.pickups:
		if not pk.claimed and pk.age > 0.5 and pk.pos.distance_to(pos) < 6.25:
			pk.claimed = true
			var grab := func() -> void: game.collect_pickup(pk, true)
			task = {"pos": pk.pos, "timeout": 3.0, "on_arrive": grab}
			break


func do_coop(id: String) -> bool:
	if id == "fetch":
		var n := 0
		for pk in game.pickups.duplicate():
			if pk.pos.distance_to(game.player.pos) < 12.5:
				game.collect_pickup(pk, true)
				n += 1
		say("Hämtat!" if n else "*sniffar*", 1.2)
		game.add_fx({"type": "ring", "pos": pos, "r0": 0.25, "r1": 2.5, "life": 0.3, "col": Color("#ff9a4a")})
		return true
	# Nivå 2: elektronisk skenbild
	game.decoy = {"pos": game.player.pos + Vector2(0, 0.12), "t": 6.0}
	for r in game.robots:
		if r.active() and r.pos.distance_to(game.decoy.pos) < 10.6:
			r.distract = {"target": game.decoy, "t": 6.0}
			if r.state == "patrol":
				r.set_state("chase")
	say("*fniss*", 1.2)
	game.toast("Skenbild utplacerad – robotarna luras!")
	return true


func can_execute_super() -> bool:
	if nearest_robot(game.player.pos, 11.25) == null:
		game.toast("Kretskupp behöver en robot i närheten.")
		return false
	return true


# Superattack: Kretskupp
func execute_super_ability() -> void:
	var target := nearest_robot(game.player.pos, 11.25)
	var start := pos
	Sfx.play("super")
	game.toast("Kretskupp! Räven knycker batteriet.")
	var sneak := func(_d: float) -> void:
		var k: float = 1.0 - action.t / 0.5
		pos = start.lerp(target.pos, k)
		moving = true
	var steal := func() -> void:
		game.floater(target.pos, "Strömlös!", Color("#ffcf5a"))
		target.disable(game, true)
	action = {"t": 0.5, "update": sneak, "done": steal}
