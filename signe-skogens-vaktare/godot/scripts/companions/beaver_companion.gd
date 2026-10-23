# BeaverCompanion.gd – Bävern: terrängmodifiering och vattenteknik.
class_name BeaverCompanion
extends Companion


func _init() -> void:
	super._init("beaver")
	companion_name = "Bävern"
	speed = 4.1


func do_coop(id: String) -> bool:
	if id == "build":
		var site: Dictionary = game.near_bridge_site(3.0)
		if not site.is_empty():
			game.build_bridge(site)
			return true
	# Plask: blöta robotar kortsluts lättare
	var R := 4.0 if id == "build" else 3.25
	var n := 0
	for r in game.robots:
		if r.active() and r.pos.distance_to(game.player.pos) < R:
			r.wet = 6.0
			r.chill += 1.0
			n += 1
	game.add_fx({"type": "splash", "pos": game.player.pos, "r1": R, "life": 0.5})
	Sfx.play("frost")
	say("Plask!" if n else "*plask*", 1.0)
	if n:
		game.toast("Robotarna är blöta – elhuggen gör extra skada!")
	return true


# Superattack: Översvämning
func execute_super_ability() -> void:
	Sfx.play("super")
	game.toast("Översvämning! Vattenvågen kortsluter robotarna.")
	game.shake(6)
	game.add_fx({"type": "splash", "pos": game.player.pos, "r1": 11.9, "life": 1.1, "big": true})
	for r in game.robots:
		if r.active() and r.pos.distance_to(game.player.pos) < 11.9:
			r.wet = 8.0
			r.apply_stun(3.0)
			r.take_damage(25, "shock", game, game.player.pos)
	game.damage_barricades_near(game.player.pos, 11.9, 99)
