## RobotModel – vita, blanka robotdjur med cyanlysande paneler (referens:
## robot-isbjörnen): Björnrobot, Mekanisk varg och Svävardrönare.
class_name RobotModel
extends Node3D

var type := "bear"
var body := Node3D.new()
var head: Node3D
var legs: Array[Node3D] = []
var lowers: Array[Node3D] = []
var rotors: Array[Node3D] = []
var beam: Node3D
var beam_mat: StandardMaterial3D
var ice: MeshInstance3D
var shell: StandardMaterial3D
var panel: StandardMaterial3D
var eye: StandardMaterial3D
var base_y := 0.0
var fall := 0.0
var t := 0.0

const EYE_PATROL := Color("#4ab0ff")
const EYE_ALERT := Color("#ff3a6a")


func _init(k: String = "bear") -> void:
	type = k
	t = randf() * 10.0
	_build()


func _leg(len: float, thick: float, inner: StandardMaterial3D, joint: StandardMaterial3D, claw: StandardMaterial3D) -> Node3D:
	var g := Node3D.new()
	g.add_child(Kit.mi(Kit.capsule(thick, len * 0.4), shell, Vector3(0, -len * 0.25, 0)))
	g.add_child(Kit.mi(Kit.cyl(thick * 0.8, thick * 0.8, thick * 1.6, 12), joint, Vector3(0, -len * 0.55, 0), Vector3(0, 0, PI / 2)))
	g.add_child(Kit.mi(Kit.torus(thick * 0.55, thick * 0.12, 16), panel, Vector3(thick * 0.82, -len * 0.55, 0), Vector3(0, 0, PI / 2)))
	var lower := Node3D.new()
	lower.position.y = -len * 0.55
	lower.add_child(Kit.mi(Kit.capsule(thick * 0.8, len * 0.3), shell, Vector3(0, -len * 0.22, 0.02)))
	lower.add_child(Kit.mi(Kit.box(thick * 2.1, thick * 0.7, thick * 2.4), shell, Vector3(0, -len * 0.45, thick * 0.3)))
	for i in [-1, 0, 1]:
		lower.add_child(Kit.mi(Kit.cone(thick * 0.18, thick * 0.6, 4), claw, Vector3(i * thick * 0.6, -len * 0.47, thick * 1.5), Vector3(PI / 2, 0, 0)))
	g.add_child(lower)
	lowers.append(lower)
	return g


func _build() -> void:
	shell = Kit.glossy(Color("#eef2f8"))
	var inner := Kit.mat(Color("#1a1e2c"), 0.45, 0.7)
	var joint := Kit.mat(Color("#4a5068"), 0.3, 0.9)
	panel = Kit.glow(Color("#3ad8ff"), 3.0)
	eye = Kit.glow(EYE_PATROL, 4.0)
	var disc := Kit.mat(Color("#c8ccd8"), 0.25, 0.8)
	var claw := Kit.mat(Color("#2a2e3a"), 0.3, 0.6)
	add_child(body)
	if type == "bear" or type == "hound":
		var S := 1.0 if type == "bear" else 0.55
		var leg_len := (0.62 if type == "bear" else 0.85) * S
		var thick := (0.13 if type == "bear" else 0.1) * S
		body.position.y = leg_len + 0.1 * S
		if type == "hound":
			body.scale = Vector3(0.75, 0.9, 1.15)
		body.add_child(Kit.mi(Kit.capsule(0.32 * S, 0.7 * S), inner, Vector3(0, 0.12 * S, 0), Vector3(PI / 2, 0, 0), Vector3(1, 1, 0.9)))
		body.add_child(Kit.mi(Kit.sphere(0.42 * S, 20, 10, true), shell, Vector3(0, 0.2 * S, -0.22 * S), Vector3.ZERO, Vector3(1, 1.6, 1.2)))
		body.add_child(Kit.mi(Kit.sphere(0.42 * S, 20, 10, true), shell, Vector3(0, 0.22 * S, 0.24 * S), Vector3(0.15, 0, 0), Vector3(1, 1.6, 1.1)))
		for i in 5:
			body.add_child(Kit.mi(Kit.box(0.16 * S, 0.035 * S, 0.06 * S), panel, Vector3(0, 0.62 * S, -0.35 * S + i * 0.16 * S)))
		for sx in [-1, 1]:
			for i in 3:
				body.add_child(Kit.mi(Kit.box(0.03 * S, 0.12 * S, 0.14 * S), panel, Vector3(sx * 0.41 * S, 0.34 * S, -0.3 * S + i * 0.2 * S), Vector3(0, 0, sx * -0.5)))
			for sz in [-1, 1]:
				body.add_child(Kit.mi(Kit.cyl(0.18 * S, 0.18 * S, 0.06 * S, 24), disc, Vector3(sx * 0.33 * S, 0.2 * S, sz * 0.3 * S), Vector3(0, 0, PI / 2)))
				body.add_child(Kit.mi(Kit.torus(0.11 * S, 0.012 * S, 20), panel, Vector3(sx * 0.37 * S, 0.2 * S, sz * 0.3 * S), Vector3(0, 0, PI / 2)))
				var leg := _leg(leg_len, thick, inner, joint, claw)
				leg.position = Vector3(sx * 0.28 * S, 0.05 * S, sz * 0.3 * S)
				body.add_child(leg)
				legs.append(leg)
		head = Node3D.new()
		head.position = Vector3(0, 0.32 * S, 0.62 * S)
		body.add_child(head)
		head.add_child(Kit.mi(Kit.cyl(0.13 * S, 0.16 * S, 0.2 * S, 12), joint, Vector3(0, -0.04 * S, -0.12 * S), Vector3(PI / 2, 0, 0)))
		if type == "bear":
			head.add_child(Kit.mi(Kit.sphere(0.22, 18, 12), shell, Vector3(0, 0.04, 0), Vector3.ZERO, Vector3(1, 0.9, 1.05)))
			head.add_child(Kit.mi(Kit.cyl(0.1, 0.13, 0.22, 14), shell, Vector3(0, -0.02, 0.2), Vector3(PI / 2, 0, 0)))
			head.add_child(Kit.mi(Kit.sphere(0.05, 10, 6), inner, Vector3(0, 0.0, 0.32), Vector3.ZERO, Vector3(1.3, 0.9, 0.8)))
			for s in [-1, 1]:
				head.add_child(Kit.mi(Kit.sphere(0.06, 10, 6), shell, Vector3(s * 0.15, 0.2, -0.04), Vector3.ZERO, Vector3(1, 1, 0.6)))
		else:
			head.add_child(Kit.mi(Kit.sphere(0.12, 16, 10), shell, Vector3(0, 0.04, 0)))
			head.add_child(Kit.mi(Kit.cone(0.07, 0.2, 10), shell, Vector3(0, 0, 0.16), Vector3(PI / 2, 0, 0)))
			for s in [-1, 1]:
				head.add_child(Kit.mi(Kit.cone(0.04, 0.12, 4), shell, Vector3(s * 0.07, 0.15, -0.02), Vector3(0, 0, s * -0.2)))
			body.add_child(Kit.mi(Kit.box(0.03, 0.12, 0.5), panel, Vector3(0, 0.42 * S + 0.06, -0.05)))
		var er := 0.035 if type == "bear" else 0.022
		for s in [-1, 1]:
			head.add_child(Kit.mi(Kit.sphere(er, 10, 6), eye, Vector3(s * (0.09 if type == "bear" else 0.055), 0.08, 0.17 if type == "bear" else 0.1)))
	else:
		body.position.y = 1.5
		body.add_child(Kit.mi(Kit.cyl(0.42, 0.34, 0.14, 32), shell))
		body.add_child(Kit.mi(Kit.torus(0.36, 0.02, 32), panel, Vector3(0, 0.03, 0)))
		body.add_child(Kit.mi(Kit.torus(0.22, 0.015, 28), disc, Vector3(0, 0.08, 0)))
		body.add_child(Kit.mi(Kit.sphere(0.14, 16, 8, true), shell, Vector3(0, 0.07, 0)))
		body.add_child(Kit.mi(Kit.sphere(0.1, 14, 8), inner, Vector3(0, -0.08, 0)))
		body.add_child(Kit.mi(Kit.sphere(0.06, 12, 8), eye, Vector3(0, -0.13, 0.04)))
		for i in 3:
			var a := TAU * i / 3.0
			var pod := Node3D.new()
			pod.position = Vector3(cos(a) * 0.48, 0.02, sin(a) * 0.48)
			pod.add_child(Kit.mi(Kit.cyl(0.08, 0.08, 0.06, 16), disc))
			var rotor := Kit.mi(Kit.box(0.22, 0.01, 0.03), joint, Vector3(0, 0.05, 0))
			pod.add_child(rotor)
			body.add_child(pod)
			rotors.append(rotor)
		beam = Node3D.new()
		beam_mat = Kit.glow(Color("#fff2b0"), 0.6, true)
		beam_mat.albedo_color = Color(0.5, 0.48, 0.3, 0.25)
		var cone := Kit.mi(Kit.cyl(0.0, 0.9, 1.6, 24), beam_mat, Vector3(0, -0.8, 0))
		cone.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		beam.add_child(cone)
		body.add_child(beam)
	var ice_m := Kit.mat(Color(0.75, 0.94, 1.0, 0.42), 0.05)
	ice_m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	ice_m.emission_enabled = true
	ice_m.emission = Color("#4ab0ff")
	ice_m.emission_energy_multiplier = 0.4
	var ir := 0.9 if type == "bear" else (0.55 if type == "drone" else 0.5)
	ice = Kit.mi(Kit.sphere(ir, 8, 5), ice_m, Vector3(0, 1.5 if type == "drone" else (0.75 if type == "bear" else 0.42), 0))
	ice.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	ice.visible = false
	add_child(ice)
	base_y = body.position.y


## state: {dt, moving, alert, windup, frozen, stunned, flash, disabled, blind, fade, beam, beam_yaw}
func animate(st: Dictionary) -> void:
	var dt: float = st.dt
	var frozen: bool = st.get("frozen", false)
	var stunned: bool = st.get("stunned", false)
	if not (frozen or stunned):
		t += dt
	var moving: bool = st.get("moving", false) and not frozen and not stunned
	var disabled: bool = st.get("disabled", false)
	fall = minf(1.0, fall + dt * 2.0) if disabled else 0.0
	if type == "drone":
		body.position.y = base_y + sin(t * 2.2) * 0.08 - fall * 1.3
		if not frozen:
			for r in rotors:
				r.rotation.y += dt * 30.0
		if beam:
			beam.visible = st.get("beam", false)
			beam.rotation = Vector3(0.6, st.get("beam_yaw", 0.0), 0)
			beam_mat.albedo_color = Color(0.6, 0.3, 0.3, 0.25) if st.get("alert", false) else Color(0.5, 0.48, 0.3, 0.25)
	else:
		var k := t * (9.0 if st.get("alert", false) else 6.0)
		for i in legs.size():
			var ph := k + (0.0 if i == 0 or i == 3 else PI)
			legs[i].rotation.x = sin(ph) * 0.45 if moving else 0.0
			lowers[i].rotation.x = maxf(0.0, sin(ph)) * 0.5 if moving else 0.0
		body.position.y = base_y + (absf(sin(k)) * 0.03 if moving else 0.0) - fall * base_y * 0.6
		body.rotation.z = fall * 1.2
		if head:
			head.rotation.x = (-0.4 + sin(t * 30.0) * 0.05) if st.get("windup", false) else (sin(k * 0.5) * 0.06 if moving else sin(t) * 0.05)
	var flicker := (1.0 if sin(t * 40.0) > 0.3 else 0.15) if stunned else 1.0
	var off: bool = disabled or st.get("blind", false)
	var ec := Color("#202430") if off else (EYE_ALERT if st.get("alert", false) else EYE_PATROL)
	eye.emission = ec
	eye.albedo_color = ec
	eye.emission_energy_multiplier = 0.0 if off else 4.0 * flicker
	panel.emission_energy_multiplier = 0.05 if disabled else 3.0 * flicker
	shell.emission_enabled = st.get("flash", false)
	shell.emission = Color.WHITE
	shell.emission_energy_multiplier = 1.5
	ice.visible = frozen
	visible = st.get("fade", 0.0) < 1.0
