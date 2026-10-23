## Robot – vilsna mekaniska varelser (GDD §3): Björnrobot (tung närstrid),
## Svävardrönare (avstånd, strålkastare) och Mekanisk varg (snabb flock).
## Tillstånd: patrol → alert → chase → windup → attack, samt flee, stun,
## frusen och disabled (kortsluten, tappar skrot).
class_name Robot
extends Node3D

const TYPES := {
	"bear": {"name": "Björnrobot", "hp": 60, "speed": 1.25, "chase": 2.1, "detect": 4.6, "dmg": 3.0, "r": 0.56, "fly": false, "scrap": [5, 7], "chips": [1, 2], "xp": 18},
	"drone": {"name": "Svävardrönare", "hp": 22, "speed": 2.1, "chase": 3.1, "detect": 6.0, "dmg": 1.0, "r": 0.38, "fly": true, "scrap": [2, 3], "chips": [0, 1], "xp": 10},
	"hound": {"name": "Mekanisk varg", "hp": 14, "speed": 1.9, "chase": 4.0, "detect": 3.9, "dmg": 1.0, "r": 0.31, "fly": false, "scrap": [1, 3], "chips": [0, 0], "xp": 6},
}

var type := "bear"
var def: Dictionary
var pos := Vector2.ZERO
var home := Vector2.ZERO
var hp := 60.0
var max_hp := 60.0
var radius := 0.5
var state := "patrol"
var state_t := 0.0
var stun := 0.0
var frozen := 0.0
var chill := 0.0
var wet := 0.0
var blind := 0.0
var distract := {} # {target: Object/Dictionary med pos, t}
var flash := 0.0
var wander := Vector2.INF
var lost_t := 0.0
var fire_cd := 1.0
var lunge := {}
var search_a := 0.0
var fade := 0.0
var knock := Vector2.ZERO
var alert_t := 0.0
var atk_a := 0.0
var avoid := 0.0
var avoid_side := 1.0
var heading := 0.0
var model: RobotModel
var _prev := Vector2.ZERO


func _init(t: String = "bear", p: Vector2 = Vector2.ZERO) -> void:
	type = t
	def = TYPES[t]
	pos = p
	home = p
	hp = def.hp
	max_hp = def.hp
	radius = def.r
	fire_cd = 1.0 + randf()
	search_a = randf() * TAU
	heading = randf() * TAU
	_prev = p
	model = RobotModel.new(t)
	model.scale = Vector3.ONE * 1.15
	add_child(model)


func active() -> bool:
	return state != "disabled"


## GDD: robot.apply_stun(4.0)
func apply_stun(seconds: float) -> void:
	if state == "disabled":
		return
	stun = maxf(stun, seconds)
	lunge = {}
	if state == "windup" or state == "attack":
		set_state("chase")


func set_state(s: String) -> void:
	state = s
	state_t = 0.0


func take_damage(amount: float, kind: String, game, from: Vector2 = Vector2.INF) -> void:
	if state == "disabled":
		return
	var dmg := amount
	if kind == "shock" or kind == "emp":
		if frozen > 0.0:
			dmg *= 1.5 # termisk chock
		if wet > 0.0:
			dmg *= 1.5 # kortslutning i vatten
	dmg = roundf(dmg)
	hp -= dmg
	flash = 0.12
	if kind != "emp" and from != Vector2.INF and from != pos:
		knock = (pos - from).normalized() * (2.5 if type == "bear" else 6.9)
	game.floater(pos, str(int(dmg)), Color("#9fe6ff") if kind == "frost" else Color("#fff27a"))
	game.add_fx({"type": "sparks", "pos": pos, "n": 5})
	Sfx.play("hit")
	if state == "patrol":
		set_state("chase")
	if hp <= 0:
		disable(game)


func disable(game, double_loot: bool = false) -> void:
	if state == "disabled":
		return
	hp = 0
	set_state("disabled")
	stun = 0.0
	frozen = 0.0
	Sfx.play("robot_down")
	game.add_fx({"type": "sparks", "pos": pos, "n": 16})
	var mult := 2 if double_loot else 1
	var s := randi_range(def.scrap[0], def.scrap[1]) * mult
	var c := randi_range(def.chips[0], def.chips[1]) * mult
	game.spawn_loot(pos, {"scrap": s, "chips": c})
	game.on_robot_disabled(self)


func speed_mult(game) -> float:
	var m: float = 1.0 + game.env.visual * 0.3
	if chill > 0.0:
		m *= maxf(0.35, 1.0 - chill * 0.22)
	return m


func detect_radius(game) -> float:
	if blind > 0.0:
		return 0.0
	return def.detect * (1.0 + game.env.visual * 0.25) * game.detection_mod(self)


func can_see_player(game) -> bool:
	if game.player_down:
		return false
	var p: Vector2 = game.player.pos
	var d := pos.distance_to(p)
	var R := detect_radius(game)
	if type == "drone":
		if d < R * 0.35:
			return true
		return d < R * 1.15 and absf(SV.angle_diff(search_a, (p - pos).angle())) < 0.5
	return d < R


## Vad roboten jagar just nu: distraktion (Hunden), skenbild (Räven) eller Signe.
func target_pos(game) -> Vector2:
	if not distract.is_empty() and distract.t > 0.0:
		return distract.target.pos
	if not game.decoy.is_empty() and game.decoy.t > 0.0 and pos.distance_to(game.decoy.pos) < 10.6:
		return game.decoy.pos
	return game.player.pos


func targeting_player(game) -> bool:
	return target_pos(game) == game.player.pos


func tick(dt: float, game) -> void:
	flash = maxf(0.0, flash - dt)
	if state == "disabled":
		fade += dt
		return
	wet = maxf(0.0, wet - dt)
	blind = maxf(0.0, blind - dt)
	chill = maxf(0.0, chill - dt * 0.45)
	if not distract.is_empty():
		distract.t -= dt
		if distract.t <= 0.0:
			distract = {}
	var fly: bool = def.fly
	if knock.length() > 0.06:
		pos = game.world.move_body(pos, knock * dt, radius * 0.6, 0.19, false, fly)[0]
		knock *= pow(0.002, dt)
	if frozen > 0.0:
		frozen -= dt
		return
	if stun > 0.0:
		stun -= dt
		if randf() < dt * 6.0:
			game.add_fx({"type": "sparks", "pos": pos, "n": 1})
		return
	state_t += dt
	var p: Vector2 = game.player.pos
	var spd := speed_mult(game)
	var tgt := target_pos(game)
	var is_player := targeting_player(game)
	var shy: bool = type == "drone" and game.player.style.id == "neon"
	if type == "drone" and state == "patrol":
		search_a += dt * 0.9

	match state:
		"patrol":
			if wander == Vector2.INF or state_t > 4.0 or pos.distance_to(wander) < 0.25:
				var a := randf() * TAU
				wander = home + Vector2.from_angle(a) * randf() * 3.0
				state_t = 0.0
			move_toward_point(wander, def.speed * spd, dt, game)
			var lured := not is_player and pos.distance_to(tgt) < 10.6
			if lured or can_see_player(game):
				if shy and not lured:
					set_state("flee")
				else:
					set_state("alert")
					alert_t = 0.55
					Sfx.play("alert")
					game.companions.on_robot_alert(self)
		"alert":
			alert_t -= dt
			if alert_t <= 0.0:
				set_state("chase")
		"flee":
			var away := (pos - p).normalized()
			move_toward_point(pos + away * 2.0, def.chase * spd, dt, game)
			if pos.distance_to(p) > 8.75 or state_t > 4.0:
				set_state("patrol")
		"chase":
			var d := pos.distance_to(tgt)
			if is_player and not can_see_player(game) and d > detect_radius(game) * 1.6:
				lost_t += dt
				if lost_t > 2.5:
					lost_t = 0.0
					set_state("patrol")
					return
			else:
				lost_t = 0.0
			if shy and is_player:
				set_state("flee")
				return
			if type == "drone":
				search_a = (tgt - pos).angle()
				var want := -1.0 if d < 3.5 else (1.0 if d > 5.4 else 0.0)
				var a := search_a + (PI / 2.0 if want == 0.0 else 0.0)
				var sgn := sin(state_t * 2.0) if want == 0.0 else want
				move_toward_point(pos + Vector2.from_angle(a) * 1.25 * sgn, def.chase * spd, dt, game)
				fire_cd -= dt
				if fire_cd <= 0.0 and d < 8.1 and is_player:
					fire_cd = 1.7
					var aa := (p - pos).angle()
					game.projectiles.append({"kind": "bolt", "pos": pos, "vel": Vector2.from_angle(aa) * 5.0, "life": 2.0, "r": 0.19, "dmg": def.dmg})
					Sfx.play("zap")
			else:
				var reach := 1.25 if type == "bear" else 1.9
				if d < reach:
					set_state("windup")
					atk_a = (tgt - pos).angle()
				else:
					move_toward_point(tgt, def.chase * spd, dt, game)
		"windup":
			var wind := 0.65 if type == "bear" else 0.35
			if state_t >= wind:
				set_state("attack")
				if type == "hound":
					lunge = {"v": Vector2.from_angle(atk_a) * 9.4, "t": 0.22, "hit": false}
				else:
					var s := pos + Vector2.from_angle(atk_a) * 0.75
					game.add_fx({"type": "ring", "pos": s, "r0": 0.25, "r1": 1.4, "life": 0.3, "col": Color("#ffcf5a")})
					game.shake(3)
					Sfx.play("emp")
					if s.distance_to(p) < 1.4 and not game.player_down:
						game.player.hurt(def.dmg, game, {"from": pos})
					if not game.decoy.is_empty() and s.distance_to(game.decoy.pos) < 1.5:
						game.decoy.t = 0.0
		"attack":
			if not lunge.is_empty():
				pos = game.world.move_body(pos, lunge.v * dt, radius * 0.6, 0.19, false, fly)[0]
				lunge.t -= dt
				if not lunge.hit and pos.distance_to(p) < 0.62 and not game.player_down:
					lunge.hit = true
					game.player.hurt(def.dmg, game, {"from": pos})
				if lunge.t <= 0.0:
					lunge = {}
			if state_t > (0.9 if type == "bear" else 0.6):
				set_state("chase")


func move_toward_point(target: Vector2, spd: float, dt: float, game) -> void:
	var d := target - pos
	var l := d.length()
	if l < 0.06:
		return
	var v := d / l * spd * dt
	if avoid > 0.0:
		avoid -= dt
		v = Vector2(-v.y, v.x) * avoid_side
	var res: Array = game.world.move_body(pos, v, radius * 0.6, 0.19, false, def.fly)
	pos = res[0]
	if res[1] and avoid <= 0.0:
		avoid = 0.5
		avoid_side = 1.0 if randf() < 0.5 else -1.0


func sync(dt: float, game) -> void:
	position = Vector3(pos.x, game.height_at(pos.x, pos.y), pos.y)
	var mv := pos.distance_to(_prev)
	if type == "drone":
		if state != "patrol" and active():
			heading = (game.player.pos - pos).angle()
		elif mv > 0.003:
			heading = (pos - _prev).angle()
	elif state == "windup" or state == "attack":
		heading = atk_a
	elif mv > 0.003:
		heading = (pos - _prev).angle()
	_prev = pos
	if active():
		model.rotation.y = lerp_angle(model.rotation.y, SV.yaw_from_angle(heading), minf(1.0, dt * 8.0))
	model.animate({
		"dt": dt, "moving": mv > 0.003, "alert": state != "patrol" and state != "flee", "windup": state == "windup",
		"frozen": frozen > 0.0, "stunned": stun > 0.0, "flash": flash > 0.0, "disabled": not active(), "blind": blind > 0.0,
		"fade": 0.0 if active() else maxf(0.0, fade - 2.5) / 1.5,
		"beam": active() and blind <= 0.0 and stun <= 0.0 and frozen <= 0.0,
		"beam_yaw": SV.yaw_from_angle(search_a) - model.rotation.y,
	})
