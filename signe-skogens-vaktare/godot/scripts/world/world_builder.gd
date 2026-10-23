## WorldBuilder – bygger 3D-världen ur WorldData: höjdfält med vertexfärger
## (limegröna ljusfläckar mot djupblå skuggor), glödande vatten, dimslöjor
## över outforskad mark, lummig vegetation i MultiMesh-chunks, broar och
## världens föremål (kristaller, kistor, runstenar, Urkärnan …).
class_name WorldBuilder
extends Node3D

const TERRAIN_SHADER := preload("res://shaders/terrain.gdshader")
const WATER_SHADER := preload("res://shaders/water.gdshader")
const MIST_SHADER := preload("res://shaders/mist.gdshader")
const RES := 2 # höjdpunkter per ruta
const CHUNK := 24

# höjd, färg, glöd per marktyp
const STYLE := {
	"deep": [-0.95, Color("#071c48"), 0.0],
	"shallow": [-0.38, Color("#14507a"), 0.0],
	"cave": [-0.04, Color("#2e1850"), 0.12],
	"thicket": [0.08, Color("#123c38"), 0.0],
	"dirt": [-0.02, Color("#9a7034"), 0.08],
	"mud": [-0.05, Color("#3a2244"), 0.02],
	"floor": [0.03, Color("#6a6478"), 0.02],
	"snow": [0.05, Color("#9a94d6"), 0.05],
	"moss": [0.0, Color("#6e8e1e"), 0.05],
	"grass": [0.0, Color("#5a8a26"), 0.04],
	"dark": [0.0, Color("#226452"), 0.03],
}

var world: WorldData
var kits: Dictionary
var tile_h := PackedFloat32Array()
var tile_c := PackedColorArray()
var tile_g := PackedFloat32Array()
var tile_mag := PackedFloat32Array()
var props_root: Node3D
var bridge_root: Node3D
var fog_image: Image
var fog_texture: ImageTexture
var mist_mats: Array[ShaderMaterial] = []

var crystal_nodes := {}
var chest_nodes := {}
var rune_nodes := {}
var barricade_nodes := {}
var post_nodes := {}
var animal_nodes := {}
var core_node: Node3D
var core_pylons: Array[Node3D] = []
var campfire_node: Node3D


func build(w: WorldData) -> void:
	world = w
	kits = Props.build_kits()
	_prepare_tiles()
	_build_ground()
	_build_water()
	_build_mist()
	props_root = Node3D.new()
	add_child(props_root)
	_build_props()
	bridge_root = Node3D.new()
	add_child(bridge_root)
	_build_bridges()
	_build_objects()
	world.changed.connect(_on_world_changed)


# ---------------------------------------------------------------
# Höjdfält
# ---------------------------------------------------------------
func _tile_key(tx: int, ty: int) -> String:
	var G := WorldData.G
	var sec := "dim" if ty < 44 else ("jarn" if ty < 86 else "moss")
	match world.g(tx, ty):
		G.DEEP, G.SITE, G.BRIDGE:
			return "deep"
		G.SHALLOW:
			return "shallow"
		G.CAVE:
			return "cave"
		G.THICKET, G.HIDDEN:
			return "thicket"
		G.DIRT:
			return "dirt"
		G.MUD:
			return "mud"
		G.FLOOR:
			return "floor"
		G.SNOW:
			return "snow"
		G.MOSS:
			return "snow" if sec == "dim" else "moss"
		G.DARK:
			return "grass" if sec == "moss" else "dark"
	return "dark" if sec == "jarn" else "grass"


func _prepare_tiles() -> void:
	var n := WorldData.W * WorldData.H
	tile_h.resize(n)
	tile_c.resize(n)
	tile_g.resize(n)
	tile_mag.resize(n)
	tile_mag.fill(0.0)
	for ty in WorldData.H:
		for tx in WorldData.W:
			var st: Array = STYLE[_tile_key(tx, ty)]
			var i := ty * WorldData.W + tx
			tile_h[i] = st[0]
			tile_c[i] = st[1]
			tile_g[i] = st[2]
	# magentaglöd på grottgolven nära kristallerna
	for c in world.crystals:
		for dy in range(-5, 6):
			for dx in range(-5, 6):
				var x: int = c.tx + dx
				var y: int = c.ty + dy
				if not world.in_bounds(x, y) or world.g(x, y) != WorldData.G.CAVE:
					continue
				var d := Vector2(dx, dy).length()
				if d < 4.5:
					var i := y * WorldData.W + x
					tile_mag[i] = maxf(tile_mag[i], 1.0 - d / 4.5)


func _tile_val(arr, x: int, y: int, fallback):
	if x < 0 or y < 0 or x >= WorldData.W or y >= WorldData.H:
		return fallback
	return arr[y * WorldData.W + x]


func height_at(x: float, z: float) -> float:
	var h := 0.0
	for oy in [-0.5, 0.0, 0.5]:
		for ox in [-0.5, 0.0, 0.5]:
			h += _tile_val(tile_h, floori(x + ox), floori(z + oy), -0.95)
	h /= 9.0
	if h > -0.2:
		h += (SV.noise(x * 0.35, z * 0.35, 4) - 0.5) * 0.14
	return h


func _build_ground() -> void:
	var nx := WorldData.W * RES + 1
	var nz := WorldData.H * RES + 1
	var verts := PackedVector3Array()
	var cols := PackedColorArray()
	verts.resize(nx * nz)
	cols.resize(nx * nz)
	var shadow := Color("#10245e")
	var magenta := Color("#d03ab8")
	for j in nz:
		for i in nx:
			var x := float(i) / RES
			var z := float(j) / RES
			var c := Color(0, 0, 0)
			var gl := 0.0
			var mag := 0.0
			for oy in [-0.5, 0.0, 0.5]:
				for ox in [-0.5, 0.0, 0.5]:
					var tx := floori(x + ox)
					var tz := floori(z + oy)
					c += _tile_val(tile_c, tx, tz, Color("#071c48"))
					gl += _tile_val(tile_g, tx, tz, 0.0)
					mag = maxf(mag, _tile_val(tile_mag, tx, tz, 0.0))
			c /= 9.0
			gl /= 9.0
			var pool := SV.fbm(x * 0.07, z * 0.07, 11)
			var dark := 1.0 - smoothstep(0.32, 0.62, pool)
			c = c.lerp(shadow, dark * 0.55)
			var detail := 0.88 + SV.noise(x * 1.7, z * 1.7, 3) * 0.24
			c = Color(c.r * detail, c.g * detail, c.b * detail)
			if mag > 0.0:
				c = c.lerp(magenta, mag * 0.6)
				gl += mag * 0.35
			gl += (1.0 - dark) * 0.04
			var k := j * nx + i
			verts[k] = Vector3(x, height_at(x, z), z)
			cols[k] = Color(c.r, c.g, c.b, gl)
	var norms := PackedVector3Array()
	norms.resize(nx * nz)
	for j in nz:
		for i in nx:
			var hl := verts[j * nx + maxi(i - 1, 0)].y
			var hr := verts[j * nx + mini(i + 1, nx - 1)].y
			var hd := verts[maxi(j - 1, 0) * nx + i].y
			var hu := verts[mini(j + 1, nz - 1) * nx + i].y
			norms[j * nx + i] = Vector3(hl - hr, 2.0 / RES, hd - hu).normalized()
	var idx := PackedInt32Array()
	idx.resize((nx - 1) * (nz - 1) * 6)
	var p := 0
	for j in nz - 1:
		for i in nx - 1:
			var a := j * nx + i
			var b := a + 1
			var c2 := a + nx
			var d := c2 + 1
			idx[p] = a
			idx[p + 1] = b
			idx[p + 2] = c2
			idx[p + 3] = b
			idx[p + 4] = d
			idx[p + 5] = c2
			p += 6
	var arr := []
	arr.resize(Mesh.ARRAY_MAX)
	arr[Mesh.ARRAY_VERTEX] = verts
	arr[Mesh.ARRAY_NORMAL] = norms
	arr[Mesh.ARRAY_COLOR] = cols
	arr[Mesh.ARRAY_INDEX] = idx
	var am := ArrayMesh.new()
	am.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arr)
	var mat := ShaderMaterial.new()
	mat.shader = TERRAIN_SHADER
	am.surface_set_material(0, mat)
	var ground := MeshInstance3D.new()
	ground.mesh = am
	ground.name = "Mark"
	add_child(ground)
	var outer := MeshInstance3D.new()
	var pm := PlaneMesh.new()
	pm.size = Vector2(400, 400)
	outer.mesh = pm
	outer.material_override = Kit.mat(Color("#0a1430"), 1.0)
	outer.position = Vector3(WorldData.W / 2.0, -0.3, WorldData.H / 2.0)
	add_child(outer)


func _build_water() -> void:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	for y in WorldData.H:
		for x in WorldData.W:
			var gt := world.g(x, y)
			if not (world.is_water_g(gt) or gt == WorldData.G.BRIDGE):
				continue
			var a := Vector3(x, 0, y)
			var b := Vector3(x + 1, 0, y)
			var c := Vector3(x + 1, 0, y + 1)
			var d := Vector3(x, 0, y + 1)
			for v in [a, b, c, a, c, d]:
				st.set_normal(Vector3.UP)
				st.add_vertex(v)
	var mi := MeshInstance3D.new()
	mi.mesh = st.commit()
	var m := ShaderMaterial.new()
	m.shader = WATER_SHADER
	mi.material_override = m
	mi.position.y = -0.16
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	mi.name = "Vatten"
	add_child(mi)


# ---------------------------------------------------------------
# Dimslöjor över outforskad mark
# ---------------------------------------------------------------
func _build_mist() -> void:
	fog_image = Image.create(WorldData.W, WorldData.H, false, Image.FORMAT_L8)
	fog_texture = ImageTexture.create_from_image(fog_image)
	update_fog()
	for layer in [[0.9, 0.55], [2.2, 0.42], [3.6, 0.32]]:
		var m := ShaderMaterial.new()
		m.shader = MIST_SHADER
		m.set_shader_parameter("fog_map", fog_texture)
		m.set_shader_parameter("map_size", Vector2(WorldData.W, WorldData.H))
		m.set_shader_parameter("strength", layer[1])
		var pm := PlaneMesh.new()
		pm.size = Vector2(WorldData.W + 40, WorldData.H + 40)
		var mi := MeshInstance3D.new()
		mi.mesh = pm
		mi.material_override = m
		mi.position = Vector3(WorldData.W / 2.0, layer[0], WorldData.H / 2.0)
		mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		add_child(mi)
		mist_mats.append(m)


func update_fog() -> void:
	var data := PackedByteArray()
	data.resize(world.revealed.size())
	for i in world.revealed.size():
		data[i] = 255 if world.revealed[i] else 0
	fog_image.set_data(WorldData.W, WorldData.H, false, Image.FORMAT_L8, data)
	fog_texture.update(fog_image)


func set_mist_color(c: Color) -> void:
	for m in mist_mats:
		m.set_shader_parameter("mist_color", c)


# ---------------------------------------------------------------
# Vegetation och miljöobjekt i MultiMesh-chunks
# ---------------------------------------------------------------
func _build_props() -> void:
	for c in props_root.get_children():
		c.queue_free()
	var B := WorldData.B
	var G := WorldData.G
	var D := WorldData.D
	var buckets := {}
	var add := func(kit: String, v: int, p: Vector3, rot: float, s: float, shadow: bool) -> void:
		var key := "%d,%d|%s|%d" % [floori(p.x / CHUNK), floori(p.z / CHUNK), kit, v]
		if not buckets.has(key):
			buckets[key] = {"kit": kit, "v": v, "list": [], "shadow": shadow}
		buckets[key].list.append(Transform3D(Basis(Vector3.UP, rot).scaled(Vector3.ONE * s), p))
	# grottväggar på kamerasidan (+x, +z) hålls låga så att grottan syns
	var wall_scale := func(tx: int, ty: int) -> float:
		for gr in world.grottos:
			var d := Vector2(tx - gr.x, ty - gr.y)
			if d.length() < gr.r + 3.0:
				return clampf(1.0 - (d.x + d.y) / (gr.r * 1.2), 0.3, 1.0)
		return 1.0
	var core_p := {}
	for pp in world.core.pylons:
		core_p["%d,%d" % [pp[0], pp[1]]] = true
	for ty in WorldData.H:
		for tx in WorldData.W:
			var i := ty * WorldData.W + tx
			var bt := world.block[i]
			var gt := world.ground[i]
			var h := SV.hash2(tx, ty, 77)
			var h2 := SV.hash2(tx, ty, 78)
			var x := tx + 0.5 + (h - 0.5) * 0.3
			var z := ty + 0.5 + (h2 - 0.5) * 0.3
			var y := height_at(tx + 0.5, ty + 0.5)
			var rot := h * TAU
			var sec := "dim" if ty < 44 else ("jarn" if ty < 86 else "moss")
			match bt:
				B.PINE, B.SPRUCE_DARK:
					if sec == "moss" and h2 < 0.3:
						add.call("mushroom", int(h * 3), Vector3(x, y, z), rot, 0.9 + h2 * 0.8, true)
					else:
						add.call("tree_blue", int(h * 3), Vector3(x, y, z), rot, 0.85 + h2 * 0.35, true)
				B.PINE_SNOW, B.SPRUCE:
					add.call("tree_frost", int(h * 2), Vector3(x, y, z), rot, 0.8 + h2 * 0.4, true)
				B.BIRCH:
					add.call("tree_birch", int(h * 2), Vector3(x, y, z), rot, 0.85 + h2 * 0.3, true)
				B.ROCK, B.ROCK_MOSS:
					add.call("rock", int(h * 3), Vector3(x, y, z), rot, 0.9 + h2 * 0.5, true)
				B.CAVEWALL:
					var ws: float = wall_scale.call(tx, ty)
					var key := "%d,%d|cave_wall|%d" % [floori((tx + 0.5) / CHUNK), floori((ty + 0.5) / CHUNK), int(h * 3)]
					if not buckets.has(key):
						buckets[key] = {"kit": "cave_wall", "v": int(h * 3), "list": [], "shadow": true}
					var k := 0.95 + h2 * 0.3
					buckets[key].list.append(Transform3D(Basis(Vector3.UP, rot).scaled(Vector3(k, k * ws, k)), Vector3(tx + 0.5, y, ty + 0.5)))
					if h2 < 0.25:
						add.call("mushroom", int(h * 3), Vector3(tx + 0.5 + (h - 0.5) * 0.6, y, ty + 0.5 + (h2 - 0.5)), rot, 0.55, false)
				B.RUIN:
					add.call("ruin", int(h * 2), Vector3(tx + 0.5, y, ty + 0.5), floorf(h * 4) * PI / 2, 1.0, true)
				B.LOG:
					add.call("log", 0, Vector3(tx + 0.5, y, ty + 0.5), PI / 2 + (h - 0.5) * 0.3, 1.0, true)
				B.SCRAPHEAP:
					add.call("scrap", int(h * 2), Vector3(x, y, z), rot, 1.0, false)
				B.PYLON:
					if not core_p.has("%d,%d" % [tx, ty]):
						add.call("pylon", 0, Vector3(tx + 0.5, y, ty + 0.5), rot, 1.0, true)
			if bt != B.NONE:
				continue
			if gt == G.THICKET or gt == G.HIDDEN:
				add.call("bush", int(h * 2), Vector3(x, y, z), rot, 1.1 + h2 * 0.3, false)
				continue
			if world.is_water_g(gt) or gt == G.BRIDGE or gt == G.FLOOR:
				continue
			var d := world.deco[i]
			var fp := Vector3(tx + 0.2 + h2 * 0.6, y, ty + 0.2 + h * 0.6)
			if d == D.FLOWER_W or d == D.FLOWER_B:
				add.call("flower", 0, fp, rot, 1.0, false)
			elif d == D.FLOWER_Y:
				add.call("flower", 2, fp, rot, 1.0, false)
			elif d == D.BERRY:
				add.call("flower", 1, fp, rot, 1.0, false)
			elif d == D.MUSHROOM:
				add.call("small_shroom", 0, fp, rot, 1.0 + h2, false)
			elif d == D.PEBBLE:
				add.call("pebble", 0, fp, rot, 1.0 + h2, false)
			elif d == D.BOLT:
				add.call("bolt", 0, fp, rot, 1.0, false)
			elif d == D.LICHEN:
				add.call("fungi_ring", 0, fp + Vector3(0, 0.01, 0), rot, 0.7, false)
			if gt == G.DIRT:
				if h < 0.05:
					add.call("fungi_ring", 0, Vector3(tx + h2, y + 0.01, ty + 0.5), rot, 0.6 + h * 6.0, false)
				continue
			var lush := 0.55 if sec == "moss" else (0.4 if sec == "jarn" else 0.3)
			if h < lush:
				add.call("grass", int(h2 * 2), Vector3(tx + 0.5 + (h2 - 0.5) * 0.7, y, ty + 0.5 + (h - 0.5) * 0.7), rot, 0.8 + h * 0.8, false)
			if h2 < 0.12 and gt != G.CAVE:
				add.call("fern", 0, Vector3(tx + 0.3 + h * 0.4, y, ty + 0.3 + h2 * 3.0), rot, 0.9 + h, false)
			if gt == G.CAVE and h2 < 0.25:
				add.call("flower", int(h * 3), fp, rot, 1.2, false)
			if gt == G.CAVE and h < 0.06:
				add.call("fungi_ring", 0, fp + Vector3(0, 0.01, 0), rot, 0.8, false)
	for key in buckets:
		var bkt: Dictionary = buckets[key]
		var variants: Array = kits[bkt.kit]
		var mesh: Mesh = variants[mini(bkt.v, variants.size() - 1)]
		var mm := MultiMesh.new()
		mm.transform_format = MultiMesh.TRANSFORM_3D
		mm.mesh = mesh
		mm.instance_count = bkt.list.size()
		for k in bkt.list.size():
			mm.set_instance_transform(k, bkt.list[k])
		var mmi := MultiMeshInstance3D.new()
		mmi.multimesh = mm
		mmi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON if bkt.shadow else GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		props_root.add_child(mmi)


func _build_bridges() -> void:
	for c in bridge_root.get_children():
		c.queue_free()
	var list: Array = []
	for y in WorldData.H:
		for x in WorldData.W:
			if world.g(x, y) != WorldData.G.BRIDGE:
				continue
			var vertical := world.g(x, y - 1) == WorldData.G.BRIDGE or world.g(x, y + 1) == WorldData.G.BRIDGE or world.is_water_g(world.g(x - 1, y))
			list.append(Transform3D(Basis(Vector3.UP, 0.0 if vertical else PI / 2), Vector3(x + 0.5, -0.02, y + 0.5)))
	if list.is_empty():
		return
	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.mesh = kits.plank[0]
	mm.instance_count = list.size()
	for i in list.size():
		mm.set_instance_transform(i, list[i])
	var mmi := MultiMeshInstance3D.new()
	mmi.multimesh = mm
	bridge_root.add_child(mmi)


func _on_world_changed(what: String, x: int, y: int) -> void:
	if what == "bridge":
		_build_bridges()
		if post_nodes.has("lake"):
			post_nodes.lake.visible = false
		return
	if what == "block:%d" % WorldData.B.BARRICADE:
		var key := "%d,%d" % [x, y]
		if barricade_nodes.has(key):
			barricade_nodes[key].queue_free()
			barricade_nodes.erase(key)
	_build_props()


# ---------------------------------------------------------------
# Föremål
# ---------------------------------------------------------------
func _place(n: Node3D, p: Vector2, yaw: float = 0.0) -> Node3D:
	n.position = Vector3(p.x, height_at(p.x, p.y), p.y)
	n.rotation.y = yaw
	add_child(n)
	return n


func _build_objects() -> void:
	for c in world.crystals:
		crystal_nodes[c.id] = _place(Props.crystal(), c.pos)
	for k in world.chests:
		chest_nodes[k.id] = _place(Props.chest(), k.pos, SV.hash2(k.tx, k.ty) * TAU)
	for r in world.runestones:
		rune_nodes[r.id] = _place(Props.runestone(), r.pos, PI / 4 + 0.3)
	for o in world.big:
		var center := Vector2(o.x + o.w / 2.0, o.y + o.h / 2.0)
		match o.kind:
			"forge":
				_place(Props.forge(), center, PI / 4)
			"tent":
				_place(Props.tent(), center, PI / 4)
			"reactor":
				_place(Props.reactor(), center, PI / 4)
			"core":
				core_node = _place(Props.core_tree(), center)
	for pp in world.core.pylons:
		core_pylons.append(_place(Props.core_pylon(), Vector2(pp[0] + 0.5, pp[1] + 0.5)))
	campfire_node = _place(Props.campfire(), world.campfire)
	for y in WorldData.H:
		for x in WorldData.W:
			if world.b(x, y) == WorldData.B.BARRICADE:
				barricade_nodes["%d,%d" % [x, y]] = _place(Props.barricade(), Vector2(x + 0.5, y + 0.5))
	for id in world.bridge_sites:
		var s: Dictionary = world.bridge_sites[id]
		var n := _place(Props.bridge_posts(), Vector2(s.post[0] + 0.5, s.post[1] + 0.5), 0.0 if s.dir == "h" else PI / 2)
		n.visible = not s.built
		post_nodes[id] = n
	for a in world.animals:
		var m := CompanionModel.new(a.kind)
		m.scale = Vector3.ONE * Companion.LEVEL_SCALE[0] * 1.35
		animal_nodes[a.kind] = _place(m, a.pos, PI / 4)


## Animerar föremålen (kristaller, eld, runor, kärnan) varje bildruta.
func animate(dt: float, t: float, won: bool) -> void:
	for c in world.crystals:
		var n: Node3D = crystal_nodes[c.id]
		n.visible = not c.taken and not c.buried
		if n.visible:
			n.rotation.y = t * 0.6
			var halo: Sprite3D = n.get_meta("halo")
			halo.modulate.a = 0.7 + sin(t * 3.0 + c.pos.x) * 0.25
	for k in world.chests:
		Props.set_chest_open(chest_nodes[k.id], k.open)
	for r in world.runestones:
		var rm: StandardMaterial3D = rune_nodes[r.id].get_meta("rune")
		rm.emission_energy_multiplier = (2.6 + sin(t * 3.0) * 0.5) if r.read else 1.2
	for a in world.animals:
		var m: CompanionModel = animal_nodes[a.kind]
		m.visible = not a.met
		if m.visible:
			m.animate({"dt": dt, "level": 1})
	var flames: Node3D = campfire_node.get_meta("flames")
	flames.scale = Vector3(1 + sin(t * 13.0) * 0.08, 1 + sin(t * 17.0) * 0.15, 1 + cos(t * 11.0) * 0.08)
	(campfire_node.get_meta("light") as OmniLight3D).light_energy = 2.5 + sin(t * 15.0) * 0.4
	for i in core_pylons.size():
		var orb: StandardMaterial3D = core_pylons[i].get_meta("orb")
		orb.emission = Color("#7ff3ff") if won else Color("#3a3a5a")
		orb.emission_energy_multiplier = (3.0 + sin(t * 3.0 + i)) if won else 1.0
	if core_node:
		var cm: StandardMaterial3D = core_node.get_meta("core_mat")
		cm.emission = Color("#bff8ff") if won else Color("#8a6aff")
		cm.emission_energy_multiplier = 5.0 if won else 1.6 + sin(t * 1.5) * 0.4
		(core_node.get_meta("lights") as Node3D).rotation.y = t * 0.05
		(core_node.get_meta("light") as OmniLight3D).light_energy = 5.0 if won else 2.0
	for key in barricade_nodes:
		var fm: StandardMaterial3D = barricade_nodes[key].get_meta("field")
		fm.albedo_color.a = 0.4 + sin(t * 12.0) * 0.15
