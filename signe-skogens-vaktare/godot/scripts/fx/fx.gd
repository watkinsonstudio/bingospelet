## Fx – effekter: gnistor och damm (CPUParticles3D), chockvågsringar,
## flytande skadetal och pratbubblor (Label3D), projektiler, blixtar,
## glödande prickar samt omgivningspartiklar (eldflugor, regn, snö,
## stormgnistor och bubblor vid kristallerna).
class_name Fx
extends Node3D

const RING_SHADER := preload("res://shaders/ring.gdshader")
const FONT := preload("res://fonts/Nunito-800.woff2")

var rings: Array = []
var motes: Array = []
var floaters: Array = []
var bolts: Array = []
var _spark_mat: StandardMaterial3D
var _quad: QuadMesh
var fireflies: GPUParticles3D
var rain: GPUParticles3D
var storm_sparks: GPUParticles3D
var snow: GPUParticles3D


func _ready() -> void:
	_spark_mat = StandardMaterial3D.new()
	_spark_mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	_spark_mat.vertex_color_use_as_albedo = true
	_spark_mat.billboard_mode = BaseMaterial3D.BILLBOARD_PARTICLES
	_spark_mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	_spark_mat.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
	_spark_mat.albedo_texture = Props.radial_texture(Color.WHITE)
	_quad = QuadMesh.new()
	_quad.size = Vector2(0.16, 0.16)
	_quad.material = _spark_mat
	fireflies = _ambient(170, 7.0, Vector3(16, 1.4, 16), Vector3(0, 1.4, 0), Color("#c8ff6a"), 0.18, 0.0, 0.25)
	fireflies.process_material.color_ramp = _ramp([Color(0, 0, 0, 0), Color(1, 1, 1, 1), Color(1, 1, 1, 0.3), Color(1, 1, 1, 1), Color(0, 0, 0, 0)])
	fireflies.process_material.hue_variation_min = -0.25
	fireflies.process_material.hue_variation_max = 0.35
	rain = _ambient(900, 0.9, Vector3(20, 1, 20), Vector3(0, 14, 0), Color(0.55, 0.65, 1.0, 0.5), 0.05, 22.0, 0.0, Vector2(0.03, 0.8))
	storm_sparks = _ambient(260, 1.2, Vector3(16, 2.5, 16), Vector3(0, 2.0, 0), Color("#d8a8ff"), 0.1, 0.0, 2.0)
	snow = _ambient(220, 6.0, Vector3(18, 1, 18), Vector3(0, 8, 0), Color(0.9, 0.9, 1.0, 0.85), 0.07, 1.2, 0.3)
	snow.emitting = false


func _ramp(colors: Array) -> GradientTexture1D:
	var g := Gradient.new()
	g.offsets = PackedFloat32Array([])
	g.colors = PackedColorArray([])
	for i in colors.size():
		g.add_point(float(i) / (colors.size() - 1), colors[i])
	var t := GradientTexture1D.new()
	t.gradient = g
	return t


func _ambient(amount: int, life: float, box: Vector3, offset: Vector3, color: Color, size: float, fall: float, wander: float, stretch: Vector2 = Vector2.ZERO) -> GPUParticles3D:
	var p := GPUParticles3D.new()
	p.amount = amount
	p.lifetime = life
	p.preprocess = life
	p.local_coords = false
	p.visibility_aabb = AABB(Vector3(-30, -10, -30), Vector3(60, 40, 60))
	var pm := ParticleProcessMaterial.new()
	pm.emission_shape = ParticleProcessMaterial.EMISSION_SHAPE_BOX
	pm.emission_box_extents = box
	pm.gravity = Vector3(0, -fall, 0)
	pm.direction = Vector3(0, -1 if fall > 0 else 1, 0)
	pm.spread = 180.0 if wander > 0 else 5.0
	pm.initial_velocity_min = wander * 0.3 if wander > 0 else fall * 0.5
	pm.initial_velocity_max = wander if wander > 0 else fall * 0.6
	pm.color = color
	pm.scale_min = 0.6
	pm.scale_max = 1.4
	p.process_material = pm
	var q := QuadMesh.new()
	q.size = stretch if stretch != Vector2.ZERO else Vector2(size, size)
	var m := StandardMaterial3D.new()
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	m.vertex_color_use_as_albedo = true
	m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	m.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
	m.albedo_texture = Props.radial_texture(Color.WHITE) if stretch == Vector2.ZERO else null
	m.billboard_mode = BaseMaterial3D.BILLBOARD_PARTICLES if stretch == Vector2.ZERO else BaseMaterial3D.BILLBOARD_FIXED_Y
	q.material = m
	p.draw_pass_1 = q
	p.position = offset
	add_child(p)
	p.set_meta("offset", offset)
	return p


## Bubblor som stiger kring en kristall.
func add_bubbles(parent: Node3D) -> void:
	var p := GPUParticles3D.new()
	p.amount = 14
	p.lifetime = 4.0
	p.preprocess = 4.0
	var pm := ParticleProcessMaterial.new()
	pm.emission_shape = ParticleProcessMaterial.EMISSION_SHAPE_BOX
	pm.emission_box_extents = Vector3(2.2, 0.2, 2.2)
	pm.gravity = Vector3(0, 0.35, 0)
	pm.initial_velocity_min = 0.1
	pm.initial_velocity_max = 0.3
	pm.scale_min = 0.6
	pm.scale_max = 1.6
	pm.color_ramp = _ramp([Color(1, 1, 1, 0), Color(1, 1, 1, 0.9), Color(1, 1, 1, 0)])
	p.process_material = pm
	var q := QuadMesh.new()
	q.size = Vector2(0.22, 0.22)
	var m := StandardMaterial3D.new()
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	m.vertex_color_use_as_albedo = true
	m.billboard_mode = BaseMaterial3D.BILLBOARD_PARTICLES
	m.albedo_texture = _bubble_texture()
	m.albedo_color = Color(0.8, 0.95, 1.0)
	q.material = m
	p.draw_pass_1 = q
	p.position.y = 0.1
	parent.add_child(p)


static var _bubble_tex: Texture2D


static func _bubble_texture() -> Texture2D:
	if _bubble_tex:
		return _bubble_tex
	var g := Gradient.new()
	g.offsets = PackedFloat32Array([0.0, 0.62, 0.8, 0.9, 1.0])
	g.colors = PackedColorArray([Color(1, 1, 1, 0.06), Color(1, 1, 1, 0.06), Color(1, 1, 1, 0.9), Color(0.7, 0.9, 1, 0.5), Color(1, 1, 1, 0)])
	var t := GradientTexture2D.new()
	t.gradient = g
	t.fill = GradientTexture2D.FILL_RADIAL
	t.fill_from = Vector2(0.5, 0.5)
	t.fill_to = Vector2(1.0, 0.5)
	_bubble_tex = t
	return t


## Omgivningspartiklarna följer Signe.
func follow(p: Vector3, storm: float, snowy: bool) -> void:
	for e in [fireflies, rain, storm_sparks, snow]:
		e.global_position = p + e.get_meta("offset")
	fireflies.amount_ratio = 1.0 - storm * 0.6
	if snow.emitting != snowy:
		snow.emitting = snowy


# ---------------------------------------------------------------
# Engångseffekter från spellogiken
# ---------------------------------------------------------------
func add(f: Dictionary) -> void:
	var p: Vector2 = f.get("pos", Vector2.ZERO)
	var h := 0.6
	var col: Color = f.get("col", Color("#7ff3ff"))
	match f.type:
		"sparks":
			burst(Vector3(p.x, h, p.y), f.get("n", 6), Color("#fff27a") if randf() < 0.5 else Color("#7ff3ff"), 2.5, 6.0, 0.6)
		"dirt":
			burst(Vector3(p.x, 0.15, p.y), 6, Color("#8a6a4a"), 1.5, 8.0, 0.5)
		"puff":
			burst(Vector3(p.x, 0.3, p.y), 8, Color(0.8, 0.82, 0.9, 0.6), 0.8, -1.0, 0.8)
		"frost":
			burst(Vector3(p.x, 0.9, p.y), 2, Color("#bff8ff"), 0.4, 0.0, 0.35)
		"frostburst":
			burst(Vector3(p.x, 0.9, p.y), 12, Color("#d8faff"), 2.0, 2.0, 0.4)
		"splash":
			burst(Vector3(p.x, 0.2, p.y), 140 if f.get("big", false) else 40, Color("#7ac8ff"), f.get("r1", 3.0) * 1.4, 8.0, 0.9)
			ring(p, 0.2, f.get("r1", 3.0), f.get("life", 0.6), Color("#bfe8ff"), 0.15)
		"ring":
			ring(p, f.get("r0", 0.2), f.get("r1", 2.0), f.get("life", 0.5), col, f.get("w", 0.08))
		"arc":
			var a: float = f.a
			ring(p + Vector2.from_angle(a) * 0.6, 0.3, 1.3, 0.22, Color("#9ff8ff"), 0.18)
			burst(Vector3(p.x + cos(a) * 1.1, 0.75, p.y + sin(a) * 1.1), 10, Color("#bff8ff"), 2.0, 0.0, 0.3)


func burst(at: Vector3, n: int, color: Color, speed: float, gravity: float, life: float) -> void:
	var c := CPUParticles3D.new()
	c.amount = maxi(1, n)
	c.lifetime = life
	c.one_shot = true
	c.explosiveness = 1.0
	c.mesh = _quad
	c.direction = Vector3.UP
	c.spread = 180.0
	c.initial_velocity_min = speed * 0.4
	c.initial_velocity_max = speed
	c.gravity = Vector3(0, -gravity, 0)
	c.color = color * Color(2.0, 2.0, 2.0, 1.0)
	c.scale_amount_min = 0.5
	c.scale_amount_max = 1.2
	c.position = at
	add_child(c)
	c.emitting = true
	get_tree().create_timer(life + 0.3).timeout.connect(c.queue_free)


func ring(p: Vector2, r0: float, r1: float, life: float, color: Color, width: float = 0.08) -> void:
	var m := ShaderMaterial.new()
	m.shader = RING_SHADER
	m.set_shader_parameter("color", color)
	m.set_shader_parameter("energy", 2.5)
	m.set_shader_parameter("width", width)
	var q := QuadMesh.new()
	q.size = Vector2(2, 2)
	var mi := MeshInstance3D.new()
	mi.mesh = q
	mi.material_override = m
	mi.rotation.x = -PI / 2
	mi.position = Vector3(p.x, 0.15, p.y)
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(mi)
	rings.append({"node": mi, "mat": m, "t": 0.0, "life": life, "r0": r0, "r1": r1})


func emit_mote(at: Vector3, color: Color) -> void:
	if motes.size() > 120:
		return
	var mi := MeshInstance3D.new()
	var q := QuadMesh.new()
	q.size = Vector2(0.09, 0.09)
	var m := StandardMaterial3D.new()
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	m.billboard_mode = BaseMaterial3D.BILLBOARD_ENABLED
	m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	m.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
	m.albedo_texture = Props.radial_texture(Color.WHITE)
	m.albedo_color = color * 2.5
	q.material = m
	mi.mesh = q
	mi.position = at
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(mi)
	motes.append({"node": mi, "mat": m, "t": 0.0, "life": 1.2, "v": Vector3(0, 0.4, 0)})


func floater(p: Vector3, text: String, color: Color, size: int = 44) -> void:
	var l := Label3D.new()
	l.text = text
	l.font = FONT
	l.font_size = size
	l.outline_size = 10
	l.outline_modulate = Color(0.03, 0.04, 0.12, 0.9)
	l.modulate = color
	l.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	l.no_depth_test = true
	l.pixel_size = 0.006
	l.position = p
	add_child(l)
	floaters.append({"node": l, "t": 0.0, "life": 1.0})


func lightning(p: Vector2) -> void:
	var pts := PackedVector3Array()
	var x := p.x + randf_range(-2, 2)
	var z := p.y + randf_range(-2, 2)
	for i in 13:
		var y := 16.0 - i / 12.0 * 16.0
		x += (p.x - x) * 0.25 + randf_range(-0.6, 0.6)
		z += (p.y - z) * 0.25 + randf_range(-0.6, 0.6)
		pts.append(Vector3(x, y, z))
	var m := Kit.glow(Color("#d8e8ff"), 8.0)
	var mi := Kit.mi(Kit.tube(pts, 0.06, 4), m)
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(mi)
	bolts.append({"node": mi, "t": 0.35})
	burst(Vector3(p.x, 0.3, p.y), 30, Color("#d8b8ff"), 4.0, 6.0, 0.6)


func tick(dt: float) -> void:
	for r in rings.duplicate():
		r.t += dt
		var k: float = r.t / r.life
		if k >= 1.0:
			r.node.queue_free()
			rings.erase(r)
			continue
		var rad: float = lerpf(r.r0, r.r1, 1.0 - pow(1.0 - k, 2.0))
		r.node.scale = Vector3(rad, rad, 1)
		r.mat.set_shader_parameter("opacity", 1.0 - k)
	for m in motes.duplicate():
		m.t += dt
		if m.t >= m.life:
			m.node.queue_free()
			motes.erase(m)
			continue
		m.node.position += m.v * dt
		m.mat.albedo_color.a = 1.0 - m.t / m.life
	for f in floaters.duplicate():
		f.t += dt
		if f.t >= f.life:
			f.node.queue_free()
			floaters.erase(f)
			continue
		f.node.position.y += dt * 0.9
		f.node.modulate.a = 1.0 - maxf(0.0, f.t - 0.6) / 0.4
	for b in bolts.duplicate():
		b.t -= dt
		if b.t <= 0.0:
			b.node.queue_free()
			bolts.erase(b)


## Ritar projektilerna (frostpilar och drönarnas elbollar).
func sync_projectiles(list: Array) -> void:
	for pr in list:
		if not pr.has("node"):
			var n := Node3D.new()
			if pr.kind == "frost":
				n.add_child(Kit.mi(Kit.cyl(0.02, 0.02, 0.6, 5), Kit.glow(Color("#e8fcff"), 3.0), Vector3.ZERO, Vector3(0, 0, PI / 2)))
				n.add_child(Kit.mi(Kit.cone(0.06, 0.18, 5), Kit.glow(Color("#7ff3ff"), 5.0), Vector3(0.36, 0, 0), Vector3(0, 0, -PI / 2)))
			else:
				n.add_child(Kit.mi(Kit.sphere(0.12, 10, 6), Kit.glow(Color("#ff6ab8"), 5.0)))
				var l := OmniLight3D.new()
				l.light_color = Color("#ff6ab8")
				l.light_energy = 1.2
				l.omni_range = 2.5
				n.add_child(l)
			add_child(n)
			pr.node = n
		var y: float = 0.85 if pr.kind == "frost" else 0.6 + pr.life * 0.4
		pr.node.position = Vector3(pr.pos.x, y, pr.pos.y)
		if pr.kind == "frost":
			pr.node.rotation.y = -pr.vel.angle()
			if randf() < 0.5:
				emit_mote(pr.node.position, Color("#bff8ff"))


func free_projectile(pr: Dictionary) -> void:
	if pr.has("node") and is_instance_valid(pr.node):
		pr.node.queue_free()
