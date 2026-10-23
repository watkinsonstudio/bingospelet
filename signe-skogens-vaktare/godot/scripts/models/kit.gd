## Kit – hjälpfunktioner för procedurella modeller: primitiver, material,
## rör längs kurvor och en byggare som slår ihop vertexfärgade delar till ett
## ArrayMesh (yta 0 = ljussatt, yta 1 = lysande) för MultiMesh-vegetation.
class_name Kit
extends RefCounted

const FOLIAGE := preload("res://shaders/foliage.gdshader")
const GLOW_FOLIAGE := preload("res://shaders/glow_foliage.gdshader")

static var _mat_cache := {}


# ---------------------------------------------------------------
# Primitiver
# ---------------------------------------------------------------
static func sphere(r: float, seg: int = 16, rings: int = 10, hemi: bool = false) -> SphereMesh:
	var m := SphereMesh.new()
	m.radius = r
	m.height = r * 2.0 if not hemi else r
	m.radial_segments = seg
	m.rings = rings
	m.is_hemisphere = hemi
	return m


static func cyl(top: float, bottom: float, h: float, seg: int = 8, rings: int = 1) -> CylinderMesh:
	var m := CylinderMesh.new()
	m.top_radius = top
	m.bottom_radius = bottom
	m.height = h
	m.radial_segments = seg
	m.rings = rings
	return m


static func cone(r: float, h: float, seg: int = 8) -> CylinderMesh:
	return cyl(0.0, r, h, seg)


static func capsule(r: float, mid: float, seg: int = 12, rings: int = 4) -> CapsuleMesh:
	var m := CapsuleMesh.new()
	m.radius = r
	m.height = mid + r * 2.0
	m.radial_segments = seg
	m.rings = rings
	return m


static func box(x: float, y: float, z: float) -> BoxMesh:
	var m := BoxMesh.new()
	m.size = Vector3(x, y, z)
	return m


## Ring i XZ-planet (som en armring som ligger ner).
static func torus(r: float, tube: float, seg: int = 20, ring_seg: int = 6) -> TorusMesh:
	var m := TorusMesh.new()
	m.inner_radius = maxf(0.001, r - tube)
	m.outer_radius = r + tube
	m.rings = seg
	m.ring_segments = ring_seg
	return m


static func octa(r: float) -> SphereMesh:
	return sphere(r, 4, 2)


static func blob(r: float) -> SphereMesh:
	return sphere(r, 12, 7)


## Rör längs punkter (hår, båge, rötter, horn). taper: tunnare mot slutet.
static func tube(points: PackedVector3Array, radius: float, seg: int = 6, taper: float = 0.0) -> ArrayMesh:
	var curve := Curve3D.new()
	for p in points:
		curve.add_point(p)
	# mjuka kurvor: sätt in-/ut-handtag från grannarna
	for i in curve.point_count:
		var prev := points[maxi(i - 1, 0)]
		var nxt := points[mini(i + 1, points.size() - 1)]
		var tng := (nxt - prev) * 0.25
		curve.set_point_in(i, -tng)
		curve.set_point_out(i, tng)
	var steps := maxi(8, points.size() * 5)
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var length := curve.get_baked_length()
	var rings: Array = []
	var prev_up := Vector3.UP
	for i in steps + 1:
		var t := float(i) / steps
		var pos := curve.sample_baked(t * length)
		var pos2 := curve.sample_baked(minf(t * length + 0.01, length))
		var fwd := (pos2 - pos)
		if fwd.length() < 0.0001:
			fwd = (pos - curve.sample_baked(maxf(t * length - 0.01, 0.0)))
		fwd = fwd.normalized()
		var side := fwd.cross(prev_up)
		if side.length() < 0.001:
			side = fwd.cross(Vector3.RIGHT)
		side = side.normalized()
		var up := side.cross(fwd).normalized()
		prev_up = up
		var rr := radius * (1.0 - taper * t)
		var ring: Array = []
		for k in seg:
			var a := TAU * k / seg
			var nrm := (side * cos(a) + up * sin(a))
			ring.append([pos + nrm * rr, nrm])
		rings.append(ring)
	for i in steps:
		for k in seg:
			var k2 := (k + 1) % seg
			var a: Array = rings[i][k]
			var b: Array = rings[i + 1][k]
			var c: Array = rings[i + 1][k2]
			var d: Array = rings[i][k2]
			for v in [a, b, c, a, c, d]:
				st.set_normal(v[1])
				st.add_vertex(v[0])
	return st.commit()


# ---------------------------------------------------------------
# Material
# ---------------------------------------------------------------
static func mat(color: Color, rough: float = 0.6, metal: float = 0.0) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_color = color
	m.roughness = rough
	m.metallic = metal
	return m


static func glossy(color: Color) -> StandardMaterial3D:
	var m := mat(color, 0.18, 0.35)
	m.clearcoat_enabled = true
	m.clearcoat = 1.0
	m.clearcoat_roughness = 0.1
	return m


## Självlysande material (fångas av glöden i WorldEnvironment).
static func glow(color: Color, energy: float = 2.0, additive: bool = false) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_color = color
	m.emission_enabled = true
	m.emission = color
	m.emission_energy_multiplier = energy
	if additive:
		m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		m.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
		m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		m.cull_mode = BaseMaterial3D.CULL_DISABLED
		m.no_depth_test = false
		m.albedo_color = color * energy
	return m


static func foliage_mat(sway: float, glow_part: bool) -> ShaderMaterial:
	var key := "%s-%.2f" % [glow_part, sway]
	if _mat_cache.has(key):
		return _mat_cache[key]
	var m := ShaderMaterial.new()
	m.shader = GLOW_FOLIAGE if glow_part else FOLIAGE
	m.set_shader_parameter("sway_amount", sway)
	_mat_cache[key] = m
	return m


# ---------------------------------------------------------------
# Instanser
# ---------------------------------------------------------------
static func mi(mesh: Mesh, material: Material, pos: Vector3 = Vector3.ZERO, rot: Vector3 = Vector3.ZERO, scl: Variant = 1.0) -> MeshInstance3D:
	var m := MeshInstance3D.new()
	m.mesh = mesh
	m.material_override = material
	m.position = pos
	m.rotation = rot
	m.scale = scl if scl is Vector3 else Vector3.ONE * float(scl)
	return m


# ---------------------------------------------------------------
# Byggare för vertexfärgade, sammanslagna kit
# ---------------------------------------------------------------
class Builder:
	var parts := {"lit": [PackedVector3Array(), PackedVector3Array(), PackedColorArray(), PackedInt32Array()], "glow": [PackedVector3Array(), PackedVector3Array(), PackedColorArray(), PackedInt32Array()]}

	## color: Color eller [nederkant, överkant]. opts: p, r, s, glow, displace,
	## seed, top, top_at, jitter.
	func add(mesh: Mesh, color: Variant, opts: Dictionary = {}) -> void:
		var arrays := mesh.surface_get_arrays(0)
		var verts: PackedVector3Array = arrays[Mesh.ARRAY_VERTEX]
		var norms: PackedVector3Array = arrays[Mesh.ARRAY_NORMAL]
		var idxs: PackedInt32Array = arrays[Mesh.ARRAY_INDEX] if arrays[Mesh.ARRAY_INDEX] != null else PackedInt32Array()
		if idxs.is_empty():
			for i in verts.size():
				idxs.append(i)
		var c0: Color = color[0] if color is Array else color
		var c1: Color = color[1] if color is Array else color
		var top: Variant = opts.get("top", null)
		var top_at: float = opts.get("top_at", 0.55)
		var jitter: float = opts.get("jitter", 0.0)
		var disp: float = opts.get("displace", 0.0)
		var sd: int = opts.get("seed", 1)
		var s: Variant = opts.get("s", 1.0)
		var scl: Vector3 = s if s is Vector3 else Vector3.ONE * float(s)
		var basis := Basis.from_euler(opts.get("r", Vector3.ZERO)).scaled_local(scl)
		var xf := Transform3D(basis, opts.get("p", Vector3.ZERO))
		var nbasis := basis.inverse().transposed()
		var min_y := INF
		var max_y := -INF
		for v in verts:
			min_y = minf(min_y, v.y)
			max_y = maxf(max_y, v.y)
		var t: Array = parts["glow" if opts.get("glow", false) else "lit"]
		var tv: PackedVector3Array = t[0]
		var tn: PackedVector3Array = t[1]
		var tc: PackedColorArray = t[2]
		var ti: PackedInt32Array = t[3]
		var off: int = tv.size()
		for i in verts.size():
			var v := verts[i]
			if disp > 0.0:
				var key := Vector3i(roundi(v.x * 500), roundi(v.y * 500), roundi(v.z * 500))
				var k := 1.0 + (SV.hash2(key.x * 7 + key.z, key.y, sd) - 0.5) * disp
				v *= k
			var n := norms[i] if i < norms.size() else Vector3.UP
			var ky := (verts[i].y - min_y) / (max_y - min_y) if max_y > min_y else 0.0
			var c := c0.lerp(c1, ky)
			if top != null and n.y > top_at:
				c = c.lerp(top, 0.85)
			if jitter > 0.0:
				var j := 1.0 + (SV.hash2(i, off, sd + 99) - 0.5) * jitter
				c = Color(c.r * j, c.g * j, c.b * j)
			tv.append(xf * v)
			tn.append((nbasis * n).normalized())
			tc.append(c)
		for ix in idxs:
			ti.append(ix + off)
		t[0] = tv
		t[1] = tn
		t[2] = tc
		t[3] = ti

	func build(lit_mat: Material, glow_mat: Material) -> ArrayMesh:
		var am := ArrayMesh.new()
		for key in ["lit", "glow"]:
			var t: Array = parts[key]
			if t[0].is_empty():
				continue
			var arr := []
			arr.resize(Mesh.ARRAY_MAX)
			arr[Mesh.ARRAY_VERTEX] = t[0]
			arr[Mesh.ARRAY_NORMAL] = t[1]
			arr[Mesh.ARRAY_COLOR] = t[2]
			arr[Mesh.ARRAY_INDEX] = t[3]
			am.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arr)
			am.surface_set_material(am.get_surface_count() - 1, lit_mat if key == "lit" else glow_mat)
		return am
