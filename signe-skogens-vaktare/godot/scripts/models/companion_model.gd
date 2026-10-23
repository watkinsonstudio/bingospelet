## CompanionModel – fluffiga pastellvarelser med stora glansiga ögon
## (referens: Signes "kanin"). Pälsen är fur.gdshader på ett MultiMesh där
## varje instans är ett skal.
class_name CompanionModel
extends Node3D

const FUR_SHADER := preload("res://shaders/fur.gdshader")
const RING_SHADER := preload("res://shaders/ring.gdshader")
const PALETTES := {
	"dog": ["#fdeedb", "#f0c48a", "#ffd8f0"],
	"lynx": ["#f4eefc", "#c8b0f0", "#a8f0e0"],
	"owl": ["#f8f0e8", "#d8b890", "#ffd0a8"],
	"moose": ["#f4ecf8", "#d8c0e8", "#ffd8b0"],
	"fox": ["#fff4ec", "#f8b48c", "#f4a0d0"],
	"beaver": ["#f8ece4", "#e0b49a", "#a8e8d8"],
}

static var fur_layers := 14

var kind := "dog"
var body := Node3D.new()
var head := Node3D.new()
var leg_nodes: Array[Node3D] = []
var ear_nodes: Array[Node3D] = []
var wing_nodes: Array[Node3D] = []
var tail := Node3D.new()
var aura: MeshInstance3D
var aura_mat: ShaderMaterial
var antlers: Node3D
var big_antlers: Node3D
var t := 0.0


func _init(k: String = "dog") -> void:
	kind = k
	t = randf() * 10.0
	_build()


func _fur(mesh: Mesh, pal: Array, length: float = 0.06, density: Vector2 = Vector2(110, 60), gravity: float = 0.4) -> MultiMeshInstance3D:
	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.use_custom_data = true
	mm.mesh = mesh
	mm.instance_count = fur_layers
	for i in fur_layers:
		mm.set_instance_transform(i, Transform3D.IDENTITY)
		mm.set_instance_custom_data(i, Color(float(i) / (fur_layers - 1), 0, 0, 0))
	var m := ShaderMaterial.new()
	m.shader = FUR_SHADER
	m.set_shader_parameter("col_a", Color(pal[0]))
	m.set_shader_parameter("col_b", Color(pal[1]))
	m.set_shader_parameter("col_c", Color(pal[2]))
	m.set_shader_parameter("fur_length", length)
	m.set_shader_parameter("density", density)
	m.set_shader_parameter("gravity", gravity)
	var inst := MultiMeshInstance3D.new()
	inst.multimesh = mm
	inst.material_override = m
	inst.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	inst.extra_cull_margin = 0.2
	return inst


func _place(n: Node3D, parent: Node3D, pos: Vector3, rot: Vector3 = Vector3.ZERO, scl: Vector3 = Vector3.ONE) -> Node3D:
	n.position = pos
	n.rotation = rot
	n.scale = scl
	parent.add_child(n)
	return n


func _big_eye(iris: Color, rim: Color, r: float) -> Node3D:
	var g := Node3D.new()
	var m := StandardMaterial3D.new()
	m.albedo_color = iris
	m.roughness = 0.05
	m.clearcoat_enabled = true
	m.clearcoat = 1.0
	m.rim_enabled = true
	m.rim = 1.0
	m.rim_tint = 0.0
	var rim_m := Kit.mat(rim, 0.2)
	g.add_child(Kit.mi(Kit.sphere(r, 20, 12), rim_m))
	g.add_child(Kit.mi(Kit.sphere(r * 0.86, 20, 12), m, Vector3(0, 0, r * 0.2)))
	g.add_child(Kit.mi(Kit.sphere(r * 0.45, 12, 8), Kit.mat(Color("#140a20"), 0.05), Vector3(0, 0, r * 0.62)))
	g.add_child(Kit.mi(Kit.sphere(r * 0.3, 8, 6), Kit.glow(Color.WHITE, 2.5), Vector3(-r * 0.32, r * 0.36, r * 0.86)))
	g.add_child(Kit.mi(Kit.sphere(r * 0.14, 6, 4), Kit.glow(Color.WHITE, 2.0), Vector3(r * 0.3, -r * 0.3, r * 0.92)))
	return g


func _build() -> void:
	var pal: Array = PALETTES[kind]
	var pink := Kit.mat(Color("#f6a8b8"), 0.5)
	add_child(body)
	var head_y := 0.42
	var head_z := 0.18
	var head_r := 0.2
	if kind == "owl":
		_place(_fur(Kit.sphere(0.24, 16, 12), pal, 0.06), body, Vector3(0, 0.3, 0), Vector3.ZERO, Vector3(1, 1.15, 0.95))
		head_y = 0.55
		head_z = 0.03
		for s in [-1, 1]:
			var w := _place(Node3D.new(), body, Vector3(s * 0.2, 0.36, -0.02))
			_place(_fur(Kit.sphere(0.16, 14, 10), pal, 0.05), w, Vector3(0, -0.08, 0), Vector3.ZERO, Vector3(0.35, 1, 0.8))
			wing_nodes.append(w)
		for s in [-1, 1]:
			body.add_child(Kit.mi(Kit.cone(0.03, 0.06, 4), Kit.mat(Color("#e8a040")), Vector3(s * 0.07, 0.03, 0.06)))
	else:
		var long := 0.3 if kind == "moose" else (0.22 if kind == "beaver" else 0.26)
		var body_r := 0.24 if kind == "beaver" else 0.19
		var leg_len := 0.42 if kind == "moose" else (0.08 if kind == "beaver" else 0.16)
		var torso := _fur(Kit.capsule(body_r, long, 14, 5), pal, 0.075, Vector2(96, 64))
		_place(torso, body, Vector3(0, leg_len + body_r * 0.9, 0), Vector3(PI / 2, 0, 0))
		var lr := 0.06 if kind == "moose" else 0.065
		for e in [[-1, 1], [1, 1], [-1, -1], [1, -1]]:
			var g := _place(Node3D.new(), body, Vector3(e[0] * body_r * 0.6, leg_len, e[1] * long * 0.5))
			_place(_fur(Kit.capsule(lr, leg_len, 8, 3), pal, 0.04, Vector2(64, 38)), g, Vector3(0, -leg_len / 2, 0))
			g.add_child(Kit.mi(Kit.sphere(lr * 1.05, 10, 6), pink, Vector3(0, -leg_len - 0.01, 0.02), Vector3.ZERO, Vector3(1, 0.6, 1.1)))
			leg_nodes.append(g)
		head_y = leg_len + body_r * 0.9 + body_r * (1.3 if kind == "moose" else 1.0)
		head_z = long * 0.5 + body_r * 0.75
		head_r = 0.19 if kind == "moose" else 0.21

	_place(head, body, Vector3(0, head_y, head_z))
	head.add_child(_fur(Kit.sphere(head_r, 16, 12), pal, 0.065))
	var iris := Color("#c86a10") if kind == "owl" else (Color("#4a2a7a") if kind == "lynx" else Color("#3a1f4a"))
	var rim := Color("#ffd040") if kind == "owl" else Color("#f0b080")
	for s in [-1, 1]:
		var e := _big_eye(iris, rim, head_r * (0.42 if kind == "owl" else 0.38))
		_place(e, head, Vector3(s * head_r * 0.42, head_r * 0.12, head_r * 0.82), Vector3(0, s * 0.25, 0))
	head.add_child(Kit.mi(Kit.sphere(head_r * 0.1, 8, 6), pink, Vector3(0, -head_r * 0.2, head_r * 1.02)))

	# öron per art
	var ear_m := StandardMaterial3D.new()
	ear_m.albedo_color = Color("#ffe0f0")
	ear_m.roughness = 0.3
	ear_m.rim_enabled = true
	ear_m.rim = 0.8
	ear_m.cull_mode = BaseMaterial3D.CULL_DISABLED
	ear_m.emission_enabled = true
	ear_m.emission = Color("#c8f0ff")
	ear_m.emission_energy_multiplier = 0.25
	var add_ear := func(pos: Vector3, rot: Vector3, scl: Vector3, inner: bool, tuft: Variant) -> void:
		var g := _place(Node3D.new(), head, pos, rot)
		_place(_fur(Kit.sphere(0.1, 14, 10), pal, 0.04, Vector2(64, 38)), g, Vector3(0, scl.y * 0.08, 0), Vector3.ZERO, scl)
		if inner:
			g.add_child(Kit.mi(Kit.sphere(0.1, 12, 8), ear_m, Vector3(0, scl.y * 0.08, 0.035), Vector3.ZERO, Vector3(scl.x * 0.7, scl.y * 0.85, scl.z * 0.4)))
		if tuft != null:
			g.add_child(Kit.mi(Kit.cone(0.02, 0.12, 5), Kit.glow(tuft, 2.0), Vector3(0, scl.y * 0.19, 0)))
		ear_nodes.append(g)
	match kind:
		"dog":
			for s in [-1, 1]:
				add_ear.call(Vector3(s * head_r * 1.0, head_r * 0.35, -0.02), Vector3(0.2, 0, s * 2.5), Vector3(1.2, 2.6, 0.55), true, null)
		"lynx":
			for s in [-1, 1]:
				add_ear.call(Vector3(s * head_r * 0.62, head_r * 0.82, -0.02), Vector3(0, 0, s * -0.3), Vector3(0.75, 1.35, 0.45), true, Color("#6a3ac8"))
		"fox":
			for s in [-1, 1]:
				add_ear.call(Vector3(s * head_r * 0.62, head_r * 0.75, -0.02), Vector3(0, 0, s * -0.45), Vector3(1.3, 2.6, 0.5), true, null)
		"owl":
			for s in [-1, 1]:
				add_ear.call(Vector3(s * head_r * 0.6, head_r * 0.85, 0), Vector3(0, 0, s * -0.4), Vector3(0.5, 1.4, 0.4), false, null)
		"beaver":
			for s in [-1, 1]:
				add_ear.call(Vector3(s * head_r * 0.75, head_r * 0.6, 0), Vector3(0, 0, s * -0.6), Vector3(0.6, 0.6, 0.4), true, null)
			head.add_child(Kit.mi(Kit.box(0.05, 0.05, 0.015), Kit.mat(Color("#fff8f0"), 0.2), Vector3(0, -head_r * 0.5, head_r * 0.98)))
		"moose":
			for s in [-1, 1]:
				add_ear.call(Vector3(s * head_r * 0.95, head_r * 0.45, -0.03), Vector3(0, 0, s * -1.2), Vector3(0.7, 1.6, 0.4), true, null)

	# lysande detaljer
	if kind == "dog":
		head.add_child(Kit.mi(Kit.torus(head_r * 0.7, 0.02, 20), Kit.glow(Color("#5ff0ff"), 3.0), Vector3(0, -head_r * 0.65, -0.02), Vector3(0.3, 0, 0)))
	if kind == "moose":
		antlers = Node3D.new()
		for s in [-1, 1]:
			antlers.add_child(Kit.mi(Kit.cone(0.035, 0.14, 6), Kit.glow(Color("#ffd27a"), 2.0), Vector3(s * 0.08, head_r, 0), Vector3(0, 0, s * -0.3)))
		head.add_child(antlers)
		big_antlers = Node3D.new()
		for s in [-1, 1]:
			var pts := PackedVector3Array([Vector3(s * 0.06, head_r, 0), Vector3(s * 0.22, head_r + 0.12, -0.02), Vector3(s * 0.34, head_r + 0.2, 0.02)])
			big_antlers.add_child(Kit.mi(Kit.tube(pts, 0.025, 5), Kit.glow(Color("#ffd27a"), 2.2)))
			for k in 3:
				big_antlers.add_child(Kit.mi(Kit.cone(0.02, 0.12, 5), Kit.glow(Color("#ffe6a8"), 2.2), Vector3(s * (0.18 + k * 0.07), head_r + 0.2 + k * 0.02, 0), Vector3(0, 0, s * -0.2)))
		big_antlers.visible = false
		head.add_child(big_antlers)

	# svans
	body.add_child(tail)
	match kind:
		"fox":
			tail.position = Vector3(0, 0.36, -0.28)
			var prev: Node3D = tail
			for i in 4:
				var seg := _place(Node3D.new(), prev, Vector3(0, 0.08, -0.08), Vector3(0.35, 0, 0))
				var r := 0.13 + sin(i / 3.0 * PI) * 0.06
				seg.add_child(_fur(Kit.sphere(r, 14, 10), ["#ffffff" if i == 3 else pal[1], "#f4a0d0", "#ffe0c0"], 0.07, Vector2(70, 42), 0.2))
				prev = seg
		"beaver":
			tail.position = Vector3(0, 0.12, -0.32)
			var paddle := Kit.mat(Color("#3a6a8a"), 0.3)
			paddle.emission_enabled = true
			paddle.emission = Color("#3af0d0")
			paddle.emission_energy_multiplier = 0.5
			tail.add_child(Kit.mi(Kit.sphere(0.16, 14, 8), paddle, Vector3(0, 0, -0.14), Vector3.ZERO, Vector3(0.9, 0.18, 1.3)))
		"owl":
			tail.position = Vector3(0, 0.12, -0.18)
			tail.add_child(Kit.mi(Kit.cone(0.07, 0.15, 6), Kit.mat(Color("#c8a070")), Vector3(0, 0, -0.04), Vector3(-1.2, 0, 0)))
		_:
			var n := 1 if kind == "lynx" or kind == "moose" else 2
			tail.position = Vector3(0, 0.7 if kind == "moose" else 0.42, -0.3)
			var prev2: Node3D = tail
			for i in n + 1:
				var seg := _place(Node3D.new(), prev2, Vector3(0, 0.05, -0.07), Vector3(0.4, 0, 0))
				var tp: Array = ["#6a3aa8", "#8a5ad8", "#c8a8ff"] if (i == n and kind == "lynx") else pal
				seg.add_child(_fur(Kit.sphere(0.08 - i * 0.012, 12, 8), tp, 0.06, Vector2(56, 32)))
				prev2 = seg

	# aura (nivå 2 och 3)
	aura_mat = ShaderMaterial.new()
	aura_mat.shader = RING_SHADER
	var q := QuadMesh.new()
	q.size = Vector2(1.0, 1.0)
	aura = Kit.mi(q, aura_mat, Vector3(0, 0.03, 0), Vector3(-PI / 2, 0, 0))
	aura.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	aura.visible = false
	add_child(aura)


## state: {dt, moving, z, level, flying}
func animate(st: Dictionary) -> void:
	var dt: float = st.dt
	t += dt
	var moving: bool = st.get("moving", false)
	var run := 1.0 if moving else 0.0
	var k := t * (11.0 if moving else 2.5)
	for i in leg_nodes.size():
		leg_nodes[i].rotation.x = run * sin(k + (0.0 if i == 0 or i == 3 else PI)) * 0.7
	body.position.y = (absf(sin(k)) * 0.04 if moving else sin(t * 2.0) * 0.008) + st.get("z", 0.0)
	for i in ear_nodes.size():
		ear_nodes[i].rotation.x = sin(t * 3.0 + i) * 0.08 - run * 0.3
	tail.rotation.y = sin(t * (14.0 if moving else 5.0)) * 0.45
	tail.rotation.x = run * 0.25
	head.rotation.y = 0.0 if moving else sin(t * 0.6) * 0.3
	head.rotation.z = 0.0 if moving else sin(t * 0.43) * 0.12
	var flying: bool = st.get("flying", false)
	for i in wing_nodes.size():
		wing_nodes[i].rotation.z = (-1.0 if i else 1.0) * (0.25 + sin(t * (18.0 if flying else 2.0)) * (0.9 if flying else 0.05))
	var lvl: int = st.get("level", 1)
	aura.visible = lvl >= 2
	if aura.visible:
		aura_mat.set_shader_parameter("color", Color("#ffd25e") if lvl == 3 else Color("#5ff0e0"))
		aura_mat.set_shader_parameter("energy", 1.6 + sin(t * 3.0) * 0.4)
		aura.rotation.y = t * 0.5
	if big_antlers:
		big_antlers.visible = lvl == 3
		antlers.visible = lvl < 3
