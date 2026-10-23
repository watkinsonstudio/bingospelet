## SigneModel – Signe som ståtlig alvkrigare (9 år) i heltäckande bladrustning
## med guldkanter, långt guldorange hår, spetsiga öron, bladkrona och
## Väktarbågen. Rustningszonerna färgas med ArmorColorShader (GDD §5.3).
class_name SigneModel
extends Node3D

const ARMOR_SHADER := preload("res://shaders/armor_color_3d.gdshader")
# Målfärgerna som rustningen är "målad" i (target_primary/secondary från GDD).
const TARGET_PRIMARY := Color(0.2, 0.6, 0.4)
const TARGET_SECONDARY := Color(0.8, 0.5, 0.2)
const TARGET_TERTIARY := Color(0.24, 0.29, 0.48)

var zone_mats: Array[ShaderMaterial] = []
var hips := Node3D.new()
var torso := Node3D.new()
var head := Node3D.new()
var hair := Node3D.new()
var legs: Array = [] # [{hip, knee}]
var arms: Array = [] # [{sh, elbow}]
var bow := Node3D.new()
var bow_edge: MeshInstance3D
var t := 0.0


func _init(armor: Dictionary = {}) -> void:
	_build()
	if not armor.is_empty():
		apply_armor(armor)


func _zone(paint: Color, shade: float = 1.0, metal: float = 0.25, rough: float = 0.45) -> ShaderMaterial:
	var m := ShaderMaterial.new()
	m.shader = ARMOR_SHADER
	m.set_shader_parameter("paint", paint)
	m.set_shader_parameter("target_primary", TARGET_PRIMARY)
	m.set_shader_parameter("target_secondary", TARGET_SECONDARY)
	m.set_shader_parameter("target_tertiary", TARGET_TERTIARY)
	m.set_shader_parameter("shade", shade)
	m.set_shader_parameter("metallic_v", metal)
	m.set_shader_parameter("roughness_v", rough)
	zone_mats.append(m)
	return m


## ArmorColorShader: skickar spelarens färger till alla rustningsmaterial.
func apply_armor(armor: Dictionary) -> void:
	for m in zone_mats:
		m.set_shader_parameter("new_primary", Color(armor.helmet))
		m.set_shader_parameter("new_secondary", Color(armor.chest))
		m.set_shader_parameter("new_tertiary", Color(armor.legs))


func _leaf(parent: Node3D, mat: Material, length: float, width: float, pos: Vector3, rot: Vector3) -> void:
	var pivot := Node3D.new()
	pivot.position = pos
	pivot.rotation = rot
	parent.add_child(pivot)
	pivot.add_child(Kit.mi(Kit.sphere(1.0, 10, 6), mat, Vector3(0, length / 2, 0), Vector3.ZERO, Vector3(width, length / 2, 0.025)))


func _build() -> void:
	var skin := Kit.mat(Color("#f2c4a2"), 0.55)
	var hair_m := Kit.mat(Color("#f0a028"), 0.45)
	hair_m.emission_enabled = true
	hair_m.emission = Color("#ff9a20")
	hair_m.emission_energy_multiplier = 0.15
	hair_m.cull_mode = BaseMaterial3D.CULL_DISABLED
	var hair_l := hair_m.duplicate() as StandardMaterial3D
	hair_l.albedo_color = Color("#ffd060")
	var gold := Kit.mat(Color("#e8b84a"), 0.3, 0.85)
	var helmet := _zone(TARGET_PRIMARY, 1.0, 0.3)
	var chest := _zone(TARGET_SECONDARY, 1.0, 0.25, 0.4)
	var chest2 := _zone(TARGET_SECONDARY, 0.68, 0.2, 0.5)
	var leg_m := _zone(TARGET_TERTIARY, 1.0, 0.1, 0.6)
	var leg2 := _zone(TARGET_TERTIARY, 0.7, 0.1, 0.7)
	var boots := Kit.mat(Color("#3a2a2a"), 0.7)
	var eye := Kit.mat(Color("#2a5ad8"), 0.15)
	eye.emission_enabled = true
	eye.emission = Color("#2a6aff")
	eye.emission_energy_multiplier = 0.5

	hips.position.y = 0.58
	add_child(hips)
	for side in [-1, 1]:
		var hip := Node3D.new()
		hip.position.x = side * 0.09
		hip.add_child(Kit.mi(Kit.capsule(0.065, 0.2), leg_m, Vector3(0, -0.15, 0)))
		var knee := Node3D.new()
		knee.position.y = -0.29
		knee.add_child(Kit.mi(Kit.capsule(0.058, 0.16), leg2, Vector3(0, -0.12, 0)))
		knee.add_child(Kit.mi(Kit.capsule(0.065, 0.12), boots, Vector3(0, -0.21, 0.03), Vector3(PI / 2.4, 0, 0)))
		knee.add_child(Kit.mi(Kit.torus(0.07, 0.015, 12), gold, Vector3(0, -0.1, 0)))
		_leaf(knee, chest, 0.14, 0.07, Vector3(0, -0.04, 0.06), Vector3(-0.2, 0, 0))
		hip.add_child(knee)
		hips.add_child(hip)
		legs.append({"hip": hip, "knee": knee})
	# bladkjol
	for i in 9:
		var a := TAU * i / 9.0
		_leaf(hips, chest if i % 2 else chest2, 0.26, 0.09, Vector3(sin(a) * 0.15, 0.02, cos(a) * 0.15), Vector3(PI - 0.32, a, 0))
	hips.add_child(Kit.mi(Kit.torus(0.16, 0.025, 20), gold, Vector3(0, 0.03, 0)))

	torso.position.y = 0.04
	hips.add_child(torso)
	torso.add_child(Kit.mi(Kit.capsule(0.135, 0.18), chest2, Vector3(0, 0.16, 0), Vector3.ZERO, Vector3(1, 1, 0.8)))
	torso.add_child(Kit.mi(Kit.sphere(0.15, 14, 8, true), chest, Vector3(0, 0.21, 0.01), Vector3(PI / 2 - 0.15, 0, 0), Vector3(1, 0.75, 1.05)))
	torso.add_child(Kit.mi(Kit.octa(0.035), Kit.glow(Color("#5ff0ff"), 3.5), Vector3(0, 0.22, 0.135)))
	torso.add_child(Kit.mi(Kit.torus(0.1, 0.012, 16), gold, Vector3(0, 0.2, 0.08), Vector3(PI / 2, 0, 0), Vector3(1, 1, 0.3)))
	for side in [-1, 1]:
		torso.add_child(Kit.mi(Kit.sphere(0.09, 10, 6, true), chest, Vector3(side * 0.17, 0.3, 0), Vector3(0, 0, side * -0.5), Vector3(1.2, 0.8, 1)))
		_leaf(torso, chest2, 0.16, 0.07, Vector3(side * 0.21, 0.32, 0), Vector3(0, 0, side * -1.9))
		torso.add_child(Kit.mi(Kit.torus(0.085, 0.01, 14), gold, Vector3(side * 0.18, 0.28, 0), Vector3(0, 0, side * -0.5)))
	# mantel
	var cape_m := Kit.mat(Color("#1f5a4a"), 0.8)
	cape_m.cull_mode = BaseMaterial3D.CULL_DISABLED
	torso.add_child(Kit.mi(Kit.cyl(0.17, 0.27, 0.55, 12), cape_m, Vector3(0, 0.06, -0.06), Vector3.ZERO, Vector3(1, 1, 0.45)))

	for side in [-1, 1]:
		var sh := Node3D.new()
		sh.position = Vector3(side * 0.19, 0.28, 0)
		sh.add_child(Kit.mi(Kit.capsule(0.048, 0.14), leg_m, Vector3(0, -0.1, 0)))
		var elbow := Node3D.new()
		elbow.position.y = -0.2
		elbow.add_child(Kit.mi(Kit.capsule(0.045, 0.12), helmet, Vector3(0, -0.08, 0)))
		elbow.add_child(Kit.mi(Kit.torus(0.05, 0.012, 12), gold, Vector3(0, -0.13, 0)))
		elbow.add_child(Kit.mi(Kit.sphere(0.042, 8, 6), skin, Vector3(0, -0.19, 0)))
		sh.add_child(elbow)
		torso.add_child(sh)
		arms.append({"sh": sh, "elbow": elbow})

	head.position.y = 0.48
	torso.add_child(head)
	head.add_child(Kit.mi(Kit.cyl(0.04, 0.05, 0.08, 8), skin, Vector3(0, -0.06, 0)))
	head.add_child(Kit.mi(Kit.sphere(0.13, 18, 12), skin, Vector3(0, 0.05, 0), Vector3.ZERO, Vector3(0.95, 1.05, 1)))
	for side in [-1, 1]:
		head.add_child(Kit.mi(Kit.sphere(0.026, 10, 6), eye, Vector3(side * 0.05, 0.06, 0.112), Vector3.ZERO, Vector3(1, 1.2, 0.6)))
		head.add_child(Kit.mi(Kit.sphere(0.009, 6, 4), Kit.glow(Color.WHITE, 2.0), Vector3(side * 0.05 - 0.008, 0.07, 0.126)))
		head.add_child(Kit.mi(Kit.cone(0.03, 0.15, 6), skin, Vector3(side * 0.14, 0.08, -0.01), Vector3(0, 0, side * -1.15), Vector3(1, 1, 0.5)))
	head.add_child(Kit.mi(Kit.sphere(0.012, 6, 4), Kit.mat(Color("#c86a6a")), Vector3(0, 0.0, 0.123)))
	head.add_child(Kit.mi(Kit.sphere(0.145, 18, 10, true), hair_m, Vector3(0, 0.08, -0.01), Vector3(-0.25, 0, 0), Vector3(1, 1.5, 1)))
	for i in range(-3, 4):
		head.add_child(Kit.mi(Kit.cone(0.03, 0.12, 5), hair_l, Vector3(i * 0.032, 0.11, 0.11), Vector3(PI - 0.5, 0, i * 0.08)))
	hair.position = Vector3(0, 0.1, -0.06)
	head.add_child(hair)
	for i in 11:
		var a := (i - 5) / 5.0 * 1.25
		var ln := 0.5 + absf(sin(i * 1.7)) * 0.22
		var pts := PackedVector3Array([Vector3(sin(a) * 0.1, 0, cos(a) * 0.03), Vector3(sin(a) * 0.15, -ln * 0.35, -0.08), Vector3(sin(a) * 0.13, -ln * 0.7, -0.14), Vector3(sin(a) * 0.1 + sin(i) * 0.05, -ln, -0.12)])
		hair.add_child(Kit.mi(Kit.tube(pts, 0.035, 6, 0.7), hair_m if i % 3 else hair_l))
	# bladkrona
	var crown := Node3D.new()
	crown.position.y = 0.11
	head.add_child(crown)
	crown.add_child(Kit.mi(Kit.torus(0.142, 0.018, 24), gold, Vector3.ZERO, Vector3(0.2, 0, 0)))
	for i in 7:
		var a := (i - 3) / 3.0 * 1.1
		_leaf(crown, helmet, 0.13 - absf(i - 3) * 0.015, 0.05, Vector3(sin(a) * 0.14, 0.02, cos(a) * 0.14 - 0.02), Vector3(-0.35, a, 0))
	crown.add_child(Kit.mi(Kit.octa(0.025), Kit.glow(Color("#5ff0ff"), 4.0), Vector3(0, 0.03, 0.15)))

	# Väktarbågen: ornamenterad båge med bladkanter (närstrid) och sträng
	var bow_m := Kit.mat(Color("#7a2a22"), 0.4, 0.2)
	var pts := PackedVector3Array()
	for i in 17:
		var tt := i / 16.0 - 0.5
		pts.append(Vector3(0, tt * 0.9, -cos(tt * PI) * 0.16 + sin(tt * 18.0) * 0.012))
	bow.add_child(Kit.mi(Kit.tube(pts, 0.02, 6), bow_m))
	for s in [-1, 1]:
		bow.add_child(Kit.mi(Kit.cone(0.03, 0.18, 4), bow_m, Vector3(0, s * 0.5, 0.02), Vector3(0.4 * s + (PI if s < 0 else 0.0), 0, 0)))
		bow.add_child(Kit.mi(Kit.cone(0.018, 0.1, 4), gold, Vector3(0, s * 0.33, -0.12), Vector3(-PI / 2, 0, 0)))
	bow.add_child(Kit.mi(Kit.cyl(0.004, 0.004, 0.92, 4), Kit.glow(Color("#c8f8ff"), 2.0), Vector3(0, 0, 0.16)))
	bow_edge = Kit.mi(Kit.tube(pts, 0.012, 4), Kit.glow(Color("#5ff0ff"), 5.0))
	bow_edge.visible = false
	bow.add_child(bow_edge)
	bow.position = Vector3(0, -0.2, 0.04)
	bow.rotation = Vector3(0, PI / 2, 0)
	arms[0].elbow.add_child(bow)
	# pilkoger
	torso.add_child(Kit.mi(Kit.cyl(0.045, 0.04, 0.32, 8), Kit.mat(Color("#5a3a2a")), Vector3(0.08, 0.2, -0.14), Vector3(0.35, 0, -0.3)))
	for i in 3:
		torso.add_child(Kit.mi(Kit.cone(0.02, 0.06, 4), Kit.glow(Color("#9fe6ff"), 3.0), Vector3(0.1 + i * 0.015, 0.39, -0.2 + i * 0.01), Vector3(0.35, 0, -0.3)))


## state: {dt, moving, speed_k, shot, swing, charge}
func animate(st: Dictionary) -> void:
	var dt: float = st.dt
	var moving: bool = st.moving
	t += dt * (9.0 * st.get("speed_k", 1.0) if moving else 2.0)
	var w := sin(t) if moving else 0.0
	legs[0].hip.rotation.x = w * 0.7
	legs[1].hip.rotation.x = -w * 0.7
	legs[0].knee.rotation.x = maxf(0.0, -cos(t)) * 0.8 if moving else 0.0
	legs[1].knee.rotation.x = maxf(0.0, cos(t)) * 0.8 if moving else 0.0
	hips.position.y = 0.58 + (absf(cos(t)) * 0.035 if moving else sin(t) * 0.006)
	torso.rotation.x = 0.12 if moving else 0.0
	var bow_x := -w * 0.5 if moving else 0.1
	var bow_z := -0.15
	var draw_x := w * 0.5 if moving else 0.1
	var draw_z := 0.15
	var twist := 0.0
	var shot: float = st.get("shot", 0.0)
	var swing: float = st.get("swing", 0.0)
	var charge: float = st.get("charge", 0.0)
	if shot > 0.0:
		var k := minf(1.0, shot / 0.12)
		bow_x = -1.5
		bow_z = -0.1
		draw_x = -1.5 + k * 0.4
		draw_z = 0.6
		twist = 0.5
	if charge > 0.0:
		bow_x = -0.9
		draw_x = -1.1
		draw_z = 0.4
	if swing > 0.0:
		var k2 := 1.0 - swing / 0.18
		bow_x = -1.3
		bow_z = lerpf(-1.4, 1.0, k2)
		twist = lerpf(-0.8, 0.8, k2)
	arms[0].sh.rotation = Vector3(bow_x, 0, bow_z)
	arms[1].sh.rotation = Vector3(draw_x, 0, draw_z)
	arms[0].elbow.rotation.x = 0.0 if shot > 0.0 else -0.25
	arms[1].elbow.rotation.x = -1.4 if shot > 0.0 else -0.3
	torso.rotation.y = twist
	bow_edge.visible = swing > 0.0 or charge > 0.25
	hair.rotation.x = 0.15 + (0.45 * st.get("speed_k", 1.0) if moving else 0.05) + sin(t * 0.5) * 0.04
	hair.rotation.z = sin(t * 0.37) * 0.06
