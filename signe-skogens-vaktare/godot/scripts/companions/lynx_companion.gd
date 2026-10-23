# LynxCompanion.gd – Lodjuret: agilitet och överraskningsattacker.
class_name LynxCompanion
extends Companion

var stealth := 0.0


func _init() -> void:
	super._init("lynx")
	companion_name = "Lodjuret"
	speed = 5.1


func think(dt: float) -> void:
	stealth = maxf(0.0, stealth - dt)


func detection_mod() -> float:
	var m := 0.75 if current_level >= 2 else 1.0 # tystare steg
	if stealth > 0.0:
		m *= 0.35
	return m


func do_coop(id: String) -> bool:
	stealth = 8.0 if id == "stealth2" else 5.0
	say("*smyger*", 1.5)
	game.toast("Smyg! Robotarna har svårt att upptäcka er.")
	for r in game.robots:
		if r.active() and r.state == "chase" and r.pos.distance_to(game.player.pos) > 2.5:
			r.set_state("patrol")
	return true


func can_execute_super() -> bool:
	if strongest_robot(13.75) == null:
		game.toast("Skugghopp behöver en robot i närheten.")
		return false
	return true


# Superattack: Skugghopp – slår ut minneskretsarna på den starkaste roboten
func execute_super_ability() -> void:
	var target := strongest_robot(13.75)
	var start := pos
	Sfx.play("super")
	game.toast("Skugghopp! Lodjuret slår ut minneskretsarna.")
	var leap := func(_d: float) -> void:
		var k: float = 1.0 - action.t / 0.55
		pos = start.lerp(target.pos, k)
		z = sin(k * PI) * 2.5
	var land := func() -> void:
		z = 0.0
		game.shake(5)
		game.add_fx({"type": "ring", "pos": target.pos, "r0": 0.1, "r1": 1.9, "life": 0.4, "col": Color("#c9a6ff")})
		game.floater(target.pos, "Minne raderat!", Color("#e0c8ff"))
		target.disable(game)
	action = {"t": 0.55, "update": leap, "done": land}
