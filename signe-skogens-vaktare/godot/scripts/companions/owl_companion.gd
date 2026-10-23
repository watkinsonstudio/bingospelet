# OwlCompanion.gd – Ugglan: rekognosering och synfält.
class_name OwlCompanion
extends Companion


func _init() -> void:
	super._init("owl")
	companion_name = "Ugglan"
	speed = 5.6


func reveal_radius() -> float:
	return 13.0 if current_level >= 2 else 11.5


func think(_dt: float) -> void:
	z = 0.9 + sin(Time.get_ticks_msec() * 0.003) * 0.12


func do_coop(id: String) -> bool:
	var R := 26.0 if id == "scout2" else 17.0
	var n: int = game.world.reveal(game.player.pos, R)
	game.on_reveal(n, true)
	for c in game.world.crystals:
		if not c.taken and c.pos.distance_to(game.player.pos) < R * 1.3:
			c.seen = true
			c.ping = 6.0
	say("Hoo-hoo!", 1.5)
	game.add_fx({"type": "ring", "pos": game.player.pos, "r0": 0.6, "r1": R, "life": 0.9, "col": Color("#ffe6a8")})
	return true


# Superattack: Bländande Vingslag
func execute_super_ability() -> void:
	Sfx.play("super")
	game.toast("Bländande Vingslag! Robotarnas sensorer är utslagna.")
	game.screen_flash = 0.9
	for r in game.robots:
		if r.active() and r.pos.distance_to(game.player.pos) < 14.4:
			r.blind = 7.0
			r.apply_stun(1.2)
			if r.state == "chase" or r.state == "alert":
				r.set_state("patrol")
	game.add_fx({"type": "ring", "pos": pos, "r0": 0.25, "r1": 12.5, "life": 0.8, "col": Color("#fff8d8"), "w": 0.15})
