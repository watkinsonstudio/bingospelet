# MooseCompanion.gd – Älgen: tunga hinder och terrängpåverkan.
class_name MooseCompanion
extends Companion


func _init() -> void:
	super._init("moose")
	companion_name = "Älgen"
	speed = 4.0


func do_coop(id: String) -> bool:
	var pushed := 0
	for r in game.robots:
		if r.active() and r.pos.distance_to(game.player.pos) < 3.0:
			r.knock = (r.pos - game.player.pos).normalized() * 16.0
			r.apply_stun(1.0)
			pushed += 1
	var cleared := 0
	if id == "push2":
		cleared = game.clear_logs_near(game.player.pos, 3.3)
	game.add_fx({"type": "ring", "pos": pos, "r0": 0.25, "r1": 3.0, "life": 0.35, "col": Color("#e8d6a6")})
	Sfx.play("emp")
	game.shake(3)
	if cleared:
		game.toast("Älgen knuffade undan stockarna!")
		game.companions.add_xp(40)
	elif pushed == 0:
		say("*frustar*", 1.0)
	return true


# Superattack: Urkraftens Rusning
func execute_super_ability() -> void:
	var a: float = game.player.face
	var start: Vector2 = game.player.pos
	var hit := {}
	pos = start
	Sfx.play("super")
	game.toast("Urkraftens Rusning!")
	var charge := func(_d: float) -> void:
		var k: float = 1.0 - action.t / 0.75
		pos = start + Vector2.from_angle(a) * 10.6 * k
		moving = true
		game.add_fx({"type": "dirt", "pos": pos})
		game.shake(2)
		for r in game.robots:
			if r.active() and not hit.has(r) and r.pos.distance_to(pos) < 1.4:
				hit[r] = true
				r.knock = Vector2.from_angle(a) * 18.0
				r.apply_stun(4.0 if r.type == "bear" else 3.0)
				r.take_damage(30, "impact", game, pos)
		game.smash_obstacles_at(pos)
	var stop := func() -> void:
		if game.world.is_solid_at(pos):
			place_at(game.player.pos + Vector2(0, 0.4))
	action = {"t": 0.75, "update": charge, "done": stop}
