## Props – miljöns modeller: vegetationskit för MultiMesh (skymningsträd,
## frostgranar, ljusbjörkar, jättesvampar, stenar, grottväggar, ruiner …) och
## enskilda föremål (kristall, kista, runsten, smedja, tält, lägereld,
## reaktor, Urkärnan, barrikad, brostolpar och upplockbart).
class_name Props
extends RefCounted


static func _rng(s: int) -> RandomNumberGenerator:
	var r := RandomNumberGenerator.new()
	r.seed = s
	return r


static func _c(hex: String) -> Color:
	return Color(hex)


## Bygger alla vegetationskit. Returnerar {namn: [ArrayMesh, …]} (varianter).
static func build_kits() -> Dictionary:
	var K := {}
	var lit := Kit.foliage_mat(0.0, false)
	var glow := Kit.foliage_mat(0.0, true)
	var lit_s := Kit.foliage_mat(0.06, false)
	var glow_s := Kit.foliage_mat(0.06, true)
	var lit_g := Kit.foliage_mat(0.25, false)

	# Skymningsträd: indigoblå stam, kala grenar, djupturkos krona med lysknoppar
	K.tree_blue = []
	for v in 3:
		var R := _rng(10 + v)
		var b := Kit.Builder.new()
		var h := 2.4 + R.randf() * 0.8
		b.add(Kit.cyl(0.14, 0.3, h, 7, 4), [_c("#1c1f4a"), _c("#2e3478")], {"p": Vector3(0, h / 2, 0), "jitter": 0.15, "seed": v})
		for i in 3:
			var a := R.randf() * TAU
			b.add(Kit.cyl(0.03, 0.07, 1.1, 5), _c("#2a2f6a"), {"p": Vector3(cos(a) * 0.35, h * 0.62 + i * 0.2, sin(a) * 0.35), "r": Vector3(sin(a) * 0.9, 0, -cos(a) * 0.9)})
		for i in 4:
			var a := TAU * i / 4.0 + R.randf()
			var rr := 0.85 + R.randf() * 0.45
			var cp := Vector3(cos(a) * 0.5, h + 0.15 + R.randf() * 0.5, sin(a) * 0.5)
			b.add(Kit.blob(rr), [_c("#0a1f45"), _c("#1d5a62")], {"p": cp, "s": Vector3(1, 0.78, 1), "displace": 0.22, "seed": v * 10 + i, "jitter": 0.35, "top": _c("#3f8a5a"), "top_at": 0.7})
			for k in 5:
				var bb := R.randf() * TAU
				var e := R.randf() * 0.9
				b.add(Kit.octa(0.06 + R.randf() * 0.04), _c("#7ff3ff") if R.randf() < 0.6 else _c("#d8ff6a"), {"p": cp + Vector3(cos(bb) * rr * 0.95, e * rr * 0.6, sin(bb) * rr * 0.95), "glow": true})
		K.tree_blue.append(b.build(lit_s, glow_s))

	# Frostgran (Dimkronorna)
	K.tree_frost = []
	for v in 2:
		var R := _rng(40 + v)
		var b := Kit.Builder.new()
		b.add(Kit.cyl(0.1, 0.22, 1.2, 6), _c("#22264e"), {"p": Vector3(0, 0.6, 0)})
		for i in 4:
			var r := 1.1 - i * 0.22
			var y := 0.9 + i * 0.62
			b.add(Kit.cone(r, 1.1, 8), [_c("#141c46"), _c("#3a3a82")], {"p": Vector3(0, y + 0.45, 0), "displace": 0.12, "seed": v * 7 + i, "top": _c("#b8b4f0"), "top_at": 0.8, "jitter": 0.25})
			for k in 6:
				var a := R.randf() * TAU
				b.add(Kit.octa(0.05), _c("#e8e0ff"), {"p": Vector3(cos(a) * r * 0.95, y, sin(a) * r * 0.95), "glow": true})
		K.tree_frost.append(b.build(lit_s, glow_s))

	# Ljusbjörk
	K.tree_birch = []
	for v in 2:
		var R := _rng(70 + v)
		var b := Kit.Builder.new()
		b.add(Kit.cyl(0.1, 0.16, 2.2, 6), [_c("#b8b4d8"), _c("#ecebf6")], {"p": Vector3(0, 1.1, 0), "jitter": 0.2})
		for i in 3:
			var a := R.randf() * TAU
			var p := Vector3(cos(a) * 0.4, 2.3 + R.randf() * 0.5, sin(a) * 0.4)
			b.add(Kit.blob(0.75), [_c("#2f6a22"), _c("#8ac83a")], {"p": p, "displace": 0.25, "seed": v * 5 + i, "jitter": 0.3})
			for k in 4:
				var bb := R.randf() * TAU
				b.add(Kit.octa(0.05), _c("#fff27a"), {"p": p + Vector3(cos(bb) * 0.7, (R.randf() - 0.3) * 0.5, sin(bb) * 0.7), "glow": true})
		K.tree_birch.append(b.build(lit_s, glow_s))

	# Jättesvamp med lysande hatt
	K.mushroom = []
	var hues := [[_c("#c84a10"), _c("#d8a020")], [_c("#b83a18"), _c("#c8b020")], [_c("#c86a10"), _c("#a8c820")]]
	for v in 3:
		var R := _rng(90 + v)
		var b := Kit.Builder.new()
		var h := 1.0 + R.randf() * 0.9
		var w := 0.6 + R.randf() * 0.5
		b.add(Kit.cyl(0.1, 0.16, h, 8), [_c("#d8ccb0"), _c("#f4ecd8")], {"p": Vector3(0, h / 2, 0), "r": Vector3(0, 0, (R.randf() - 0.5) * 0.25)})
		b.add(Kit.sphere(w, 16, 6, true), hues[v], {"p": Vector3(0, h - 0.05, 0), "s": Vector3(1, 1.1, 1), "glow": true})
		b.add(Kit.cyl(w * 0.98, w * 0.98, 0.02, 16), _c("#c8501a"), {"p": Vector3(0, h - 0.06, 0), "glow": true})
		K.mushroom.append(b.build(lit, glow))

	# Sten med mossa (en med turkos runring)
	K.rock = []
	for v in 3:
		var b := Kit.Builder.new()
		b.add(Kit.sphere(0.55, 14, 9), _c("#3a4878"), {"p": Vector3(0, 0.3, 0), "s": Vector3(1.1, 0.75, 1), "displace": 0.35, "seed": 120 + v, "top": _c("#86a830"), "top_at": 0.5, "jitter": 0.2})
		if v == 2:
			b.add(Kit.torus(0.16, 0.025, 16), _c("#5ff0e0"), {"p": Vector3(0, 0.38, 0.47), "r": Vector3(PI / 2, 0, 0), "glow": true})
		K.rock.append(b.build(lit, glow))

	# Grottvägg: hög mörk sten, mossa, orange tickor och kristallflisor
	K.cave_wall = []
	for v in 3:
		var R := _rng(150 + v)
		var b := Kit.Builder.new()
		var h := 1.5 + R.randf() * 0.7
		b.add(Kit.sphere(0.8, 14, 9), [_c("#1a1e48"), _c("#38407a")], {"p": Vector3(0, h / 2, 0), "s": Vector3(0.85, h / 1.6, 0.85), "displace": 0.3, "seed": 150 + v, "top": _c("#7a9a2a"), "top_at": 0.6, "jitter": 0.25})
		for i in 2:
			var a := R.randf() * TAU
			b.add(Kit.cyl(0.22, 0.22, 0.05, 14), [_c("#ff7a1a"), _c("#ffc04a")], {"p": Vector3(cos(a) * 0.62, 0.4 + R.randf() * 0.8, sin(a) * 0.62), "glow": true})
		if v == 1:
			b.add(Kit.octa(0.16), _c("#7ab8ff"), {"p": Vector3(0.4, h * 0.85, 0.2), "s": Vector3(0.6, 1.6, 0.6), "r": Vector3(0.3, 0, 0.4), "glow": true})
		K.cave_wall.append(b.build(lit, glow))

	# Ruin: vit teknikpelare med cyan panel och rankor
	K.ruin = []
	for v in 2:
		var b := Kit.Builder.new()
		b.add(Kit.cyl(0.42, 0.5, 1.5 + v * 0.4, 6), [_c("#9aa2b8"), _c("#e4e8f2")], {"p": Vector3(0, 0.75 + v * 0.2, 0), "jitter": 0.1})
		b.add(Kit.box(0.5, 0.5, 0.1), _c("#1c2030"), {"p": Vector3(0, 0.9, 0.45)})
		b.add(Kit.torus(0.47, 0.05, 12), _c("#3a8a3a"), {"p": Vector3(0, 1.1 + v * 0.3, 0), "r": Vector3(0.2, 0, 0)})
		b.add(Kit.box(0.36, 0.08, 0.04), _c("#5ff0ff"), {"p": Vector3(0, 0.98, 0.5), "glow": true})
		b.add(Kit.box(0.36, 0.08, 0.04), _c("#5ff0ff"), {"p": Vector3(0, 0.82, 0.5), "glow": true})
		K.ruin.append(b.build(lit, glow))

	# Fallen stock med tickor
	var lb := Kit.Builder.new()
	lb.add(Kit.cyl(0.32, 0.38, 1.9, 9), [_c("#2a2550"), _c("#4a3a6a")], {"p": Vector3(0, 0.32, 0), "r": Vector3(0, 0, PI / 2), "jitter": 0.2})
	lb.add(Kit.cyl(0.36, 0.36, 0.02, 9), _c("#c8a070"), {"p": Vector3(-0.96, 0.32, 0), "r": Vector3(0, 0, PI / 2)})
	for i in 3:
		lb.add(Kit.cyl(0.16, 0.16, 0.04, 12), [_c("#ff7a1a"), _c("#ffc04a")], {"p": Vector3(-0.5 + i * 0.5, 0.5 + (i % 2) * 0.1, 0.3), "r": Vector3(PI / 2, 0, 0), "glow": true})
	K.log = [lb.build(lit, glow)]

	# Skrothög
	K.scrap = []
	for v in 2:
		var R := _rng(200 + v)
		var b := Kit.Builder.new()
		for i in 9:
			b.add(Kit.box(0.2 + R.randf() * 0.3, 0.06 + R.randf() * 0.1, 0.15 + R.randf() * 0.25), _c("#d8dce8") if R.randf() < 0.6 else _c("#3a3f50"), {"p": Vector3((R.randf() - 0.5) * 0.7, 0.05 + R.randf() * 0.35, (R.randf() - 0.5) * 0.7), "r": Vector3(R.randf(), R.randf() * 3, R.randf())})
		b.add(Kit.box(0.1, 0.1, 0.1), _c("#5ff0ff"), {"p": Vector3(0.1, 0.4, 0), "glow": true})
		K.scrap.append(b.build(lit, glow))

	# Energipelare
	var pb := Kit.Builder.new()
	pb.add(Kit.cyl(0.07, 0.12, 2.2, 6), [_c("#8a92a8"), _c("#e8ecf4")], {"p": Vector3(0, 1.1, 0)})
	pb.add(Kit.box(0.7, 0.07, 0.07), _c("#c8ccd8"), {"p": Vector3(0, 1.9, 0)})
	pb.add(Kit.sphere(0.1, 8, 6), _c("#5ff0ff"), {"p": Vector3(0, 2.25, 0), "glow": true})
	K.pylon = [pb.build(lit, glow)]

	# Snår
	K.bush = []
	for v in 2:
		var R := _rng(260 + v)
		var b := Kit.Builder.new()
		for i in 4:
			b.add(Kit.blob(0.42 + R.randf() * 0.2), [_c("#0f3440"), _c("#2a7a5a")], {"p": Vector3((R.randf() - 0.5) * 0.6, 0.35 + R.randf() * 0.3, (R.randf() - 0.5) * 0.6), "displace": 0.3, "seed": v * 9 + i, "jitter": 0.3})
		for i in 5:
			var a := R.randf() * TAU
			b.add(Kit.cone(0.08, 0.7, 4), [_c("#3a8a2a"), _c("#c8f04a")], {"p": Vector3(cos(a) * 0.4, 0.6, sin(a) * 0.4), "r": Vector3(sin(a) * 0.6, 0, -cos(a) * 0.6)})
		for i in 4:
			b.add(Kit.octa(0.05), _c("#ff6ad8") if R.randf() < 0.5 else _c("#7ff3ff"), {"p": Vector3((R.randf() - 0.5) * 0.9, 0.5 + R.randf() * 0.4, (R.randf() - 0.5) * 0.9), "glow": true})
		K.bush.append(b.build(lit_g, glow_s))

	# Markdetaljer
	K.grass = []
	for v in 2:
		var R := _rng(300 + v)
		var b := Kit.Builder.new()
		for i in 3:
			var a := R.randf() * TAU
			b.add(Kit.cone(0.04, 0.35 + R.randf() * 0.25, 3), [_c("#3a6a1a"), _c("#c0e84a")], {"p": Vector3(cos(a) * 0.12, 0.17, sin(a) * 0.12), "r": Vector3((R.randf() - 0.5) * 0.5, 0, (R.randf() - 0.5) * 0.5)})
		K.grass.append(b.build(lit_g, glow))
	var fb := Kit.Builder.new()
	for i in 5:
		var a := i * 1.256
		fb.add(Kit.cone(0.07, 0.6, 3), [_c("#1f5a3a"), _c("#7ad84a")], {"p": Vector3(cos(a) * 0.18, 0.18, sin(a) * 0.18), "r": Vector3(sin(a) * 1.1, 0, -cos(a) * 1.1), "s": Vector3(1, 1, 0.3)})
	K.fern = [fb.build(lit_g, glow)]
	K.flower = []
	for c in [_c("#bff8ff"), _c("#ff9ae8"), _c("#fff27a")]:
		var b := Kit.Builder.new()
		b.add(Kit.cyl(0.012, 0.015, 0.4, 3), _c("#3a8a3a"), {"p": Vector3(0, 0.2, 0)})
		b.add(Kit.sphere(0.06, 6, 4), c, {"p": Vector3(0, 0.42, 0), "glow": true})
		K.flower.append(b.build(lit, glow))
	var sb := Kit.Builder.new()
	sb.add(Kit.cyl(0.03, 0.04, 0.2, 5), _c("#f0e8d8"), {"p": Vector3(0, 0.1, 0)})
	sb.add(Kit.sphere(0.1, 8, 4, true), [_c("#ff5a2a"), _c("#ffb04a")], {"p": Vector3(0, 0.18, 0), "s": Vector3(1, 1.2, 1), "glow": true})
	K.small_shroom = [sb.build(lit, glow)]
	var rb := Kit.Builder.new()
	rb.add(Kit.cyl(0.28, 0.28, 0.03, 18), [_c("#ff7a1a"), _c("#ffc04a")], {"p": Vector3(0, 0.02, 0), "glow": true})
	rb.add(Kit.torus(0.28, 0.025, 18), _c("#fff0c0"), {"p": Vector3(0, 0.03, 0), "glow": true})
	K.fungi_ring = [rb.build(lit, glow)]
	var pe := Kit.Builder.new()
	pe.add(Kit.sphere(0.1, 6, 3), _c("#5a6a9a"), {"p": Vector3(0, 0.05, 0), "s": Vector3(1, 0.6, 1)})
	K.pebble = [pe.build(lit, glow)]
	var bo := Kit.Builder.new()
	bo.add(Kit.cyl(0.04, 0.04, 0.18, 6), _c("#c8ccd8"), {"p": Vector3(0, 0.04, 0), "r": Vector3(PI / 2, 0, 0.4)})
	K.bolt = [bo.build(lit, glow)]
	var pl := Kit.Builder.new()
	for z in [-0.33, 0.0, 0.33]:
		pl.add(Kit.box(1.02, 0.1, 0.22), [_c("#5a3a2a"), _c("#8a5a3a")], {"p": Vector3(0, 0, z)})
	K.plank = [pl.build(lit, glow)]
	return K


# ---------------------------------------------------------------
# Enskilda föremål
# ---------------------------------------------------------------
static func crystal() -> Node3D:
	var g := Node3D.new()
	var m := StandardMaterial3D.new()
	m.albedo_color = Color("#6ab0ff")
	m.emission_enabled = true
	m.emission = Color("#3a7aff")
	m.emission_energy_multiplier = 2.2
	m.roughness = 0.05
	m.metallic = 0.2
	for s in [[0, 0.55, 0, 0.16, 1.0], [0.14, 0.32, 0.05, 0.1, 0.6], [-0.13, 0.3, -0.04, 0.09, 0.55], [0.03, 0.25, -0.15, 0.08, 0.5]]:
		g.add_child(Kit.mi(Kit.octa(s[3]), m, Vector3(s[0], s[1], s[2]), Vector3(s[0] * 2, s[1] * 3, s[2]), Vector3(1, s[4] * 3.2, 1)))
	var halo := Sprite3D.new()
	halo.texture = radial_texture(Color("#ff4ae0"))
	halo.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	halo.pixel_size = 0.03
	halo.modulate = Color(1.6, 1.0, 1.6, 0.9)
	halo.position.y = 0.5
	halo.shaded = false
	halo.alpha_cut = SpriteBase3D.ALPHA_CUT_DISABLED
	halo.set_draw_flag(SpriteBase3D.FLAG_TRANSPARENT, true)
	g.add_child(halo)
	var light := OmniLight3D.new()
	light.light_color = Color("#ff5ae8")
	light.light_energy = 2.4
	light.omni_range = 7.0
	light.position.y = 1.0
	light.shadow_enabled = false
	g.add_child(light)
	g.scale = Vector3.ONE * 1.6
	g.set_meta("halo", halo)
	return g


static var _radial := {}


static func radial_texture(c: Color) -> Texture2D:
	var key := c.to_html()
	if _radial.has(key):
		return _radial[key]
	var grad := Gradient.new()
	grad.set_color(0, Color(c, 0.9))
	grad.set_color(1, Color(c, 0.0))
	grad.add_point(0.35, Color(c, 0.35))
	var t := GradientTexture2D.new()
	t.gradient = grad
	t.fill = GradientTexture2D.FILL_RADIAL
	t.fill_from = Vector2(0.5, 0.5)
	t.fill_to = Vector2(1.0, 0.5)
	t.width = 128
	t.height = 128
	_radial[key] = t
	return t


static func chest() -> Node3D:
	var g := Node3D.new()
	var wood := Kit.mat(Color("#6a3a2a"), 0.7)
	var gold := Kit.mat(Color("#e8b84a"), 0.3, 0.85)
	g.add_child(Kit.mi(Kit.box(0.6, 0.32, 0.4), wood, Vector3(0, 0.16, 0)))
	g.add_child(Kit.mi(Kit.box(0.62, 0.04, 0.42), gold, Vector3(0, 0.3, 0)))
	var lid := Node3D.new()
	lid.position = Vector3(0, 0.32, -0.2)
	lid.add_child(Kit.mi(Kit.box(0.6, 0.12, 0.4), wood, Vector3(0, 0.06, 0.2)))
	lid.add_child(Kit.mi(Kit.box(0.1, 0.1, 0.05), Kit.glow(Color("#5ff0ff"), 3.0), Vector3(0, 0.04, 0.41)))
	g.add_child(lid)
	var shine := Kit.mi(Kit.cyl(0.18, 0.18, 0.01, 16), Kit.glow(Color("#ffd27a"), 3.0), Vector3(0, 0.33, 0))
	shine.visible = false
	g.add_child(shine)
	g.set_meta("lid", lid)
	g.set_meta("shine", shine)
	return g


static func set_chest_open(g: Node3D, open: bool) -> void:
	(g.get_meta("lid") as Node3D).rotation.x = -1.9 if open else 0.0
	(g.get_meta("shine") as Node3D).visible = open


static func runestone() -> Node3D:
	var g := Node3D.new()
	g.add_child(Kit.mi(Kit.capsule(0.3, 0.9), Kit.mat(Color("#5a6a98"), 0.85), Vector3(0, 0.7, 0), Vector3.ZERO, Vector3(1, 1, 0.45)))
	var rune := Kit.glow(Color("#3ab8b0"), 1.5)
	for i in 3:
		g.add_child(Kit.mi(Kit.torus(0.07 + i * 0.06, 0.012, 24, 4), rune, Vector3(0, 0.8, 0.15), Vector3(PI / 2, 0, 0)))
	g.add_child(Kit.mi(Kit.torus(0.34, 0.06, 14), Kit.mat(Color("#7aa030")), Vector3(0, 0.12, 0)))
	g.set_meta("rune", rune)
	return g


static func forge() -> Node3D:
	var g := Node3D.new()
	var stone := Kit.mat(Color("#4a5478"), 0.9)
	g.add_child(Kit.mi(Kit.cyl(0.55, 0.7, 1.3, 8), stone, Vector3(-0.4, 0.65, 0)))
	g.add_child(Kit.mi(Kit.cyl(0.12, 0.16, 0.8, 8), stone, Vector3(-0.4, 1.6, 0)))
	g.add_child(Kit.mi(Kit.cyl(0.3, 0.3, 0.02, 16), Kit.glow(Color("#ff8a2a"), 4.0), Vector3(-0.4, 0.5, 0.62), Vector3(PI / 2, 0, 0)))
	g.add_child(Kit.mi(Kit.box(0.6, 0.18, 0.3), Kit.mat(Color("#3a4058"), 0.3, 0.9), Vector3(0.5, 0.62, 0.1)))
	g.add_child(Kit.mi(Kit.box(0.25, 0.45, 0.22), Kit.mat(Color("#2a2e3a"), 0.4, 0.8), Vector3(0.5, 0.3, 0.1)))
	g.add_child(Kit.mi(Kit.box(0.3, 0.06, 0.2), Kit.glow(Color("#5ff0ff"), 3.0), Vector3(0.55, 0.74, 0.1)))
	var l := OmniLight3D.new()
	l.light_color = Color("#ff8a3a")
	l.light_energy = 1.6
	l.omni_range = 4.0
	l.position = Vector3(-0.4, 0.6, 0.9)
	g.add_child(l)
	return g


static func tent() -> Node3D:
	var g := Node3D.new()
	var cloth := Kit.mat(Color("#c89a5a"), 0.9)
	cloth.cull_mode = BaseMaterial3D.CULL_DISABLED
	g.add_child(Kit.mi(Kit.cone(0.9, 1.4, 6), cloth, Vector3(0, 0.7, 0)))
	var cols := [Color("#ffd27a"), Color("#7ff3ff"), Color("#ff9ae8")]
	for i in 5:
		var a := TAU * i / 5.0
		g.add_child(Kit.mi(Kit.sphere(0.05, 8, 6), Kit.glow(cols[i % 3], 3.0), Vector3(cos(a) * 0.62, 0.55, sin(a) * 0.62)))
	return g


static func campfire() -> Node3D:
	var g := Node3D.new()
	for i in 3:
		g.add_child(Kit.mi(Kit.cyl(0.06, 0.06, 0.6, 6), Kit.mat(Color("#4a2a2a")), Vector3(0, 0.08, 0), Vector3(PI / 2, i * 1.05, 0)))
	var flames := Node3D.new()
	for f in [[Color("#ff5a1a"), 0.22, 0.55], [Color("#ffa02a"), 0.15, 0.45], [Color("#ffe27a"), 0.08, 0.32]]:
		flames.add_child(Kit.mi(Kit.cone(f[1], f[2], 8), Kit.glow(f[0], 4.0), Vector3(0, f[2] / 2 + 0.05, 0)))
	g.add_child(flames)
	var l := OmniLight3D.new()
	l.light_color = Color("#ff9a3a")
	l.light_energy = 2.5
	l.omni_range = 7.0
	l.position.y = 0.8
	l.shadow_enabled = true
	g.add_child(l)
	g.set_meta("flames", flames)
	g.set_meta("light", l)
	return g


static func reactor() -> Node3D:
	var g := Node3D.new()
	g.add_child(Kit.mi(Kit.cyl(1.4, 1.5, 0.4, 16), Kit.mat(Color("#c8ccd8"), 0.3, 0.6), Vector3(0, 0.2, 0)))
	var dome := Kit.mat(Color(0.54, 0.85, 1.0, 0.45), 0.05)
	dome.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	dome.emission_enabled = true
	dome.emission = Color("#2a7aff")
	dome.emission_energy_multiplier = 0.5
	g.add_child(Kit.mi(Kit.sphere(1.25, 20, 10, true), dome, Vector3(0, 0.4, 0)))
	g.add_child(Kit.mi(Kit.torus(0.35, 0.08, 24), Kit.glow(Color("#5ff0ff"), 3.0), Vector3(0, 0.9, 0), Vector3(PI / 2, 0, 0)))
	for i in 8:
		var a := TAU * i / 8.0
		g.add_child(Kit.mi(Kit.torus(0.3, 0.05, 10), Kit.mat(Color("#3a8a3a")), Vector3(cos(a) * 1.35, 0.35, sin(a) * 1.35), Vector3(PI / 2, -a, 0)))
	return g


static func core_tree() -> Node3D:
	var g := Node3D.new()
	var bark := Kit.mat(Color("#2a2560"), 0.8)
	# vriden stam
	var trunk := Kit.cyl(0.9, 1.6, 5.0, 12, 8)
	var arr := trunk.surface_get_arrays(0)
	var verts: PackedVector3Array = arr[Mesh.ARRAY_VERTEX]
	for i in verts.size():
		var v := verts[i]
		var a := v.y * 0.5
		verts[i] = Vector3(v.x * cos(a) - v.z * sin(a), v.y, v.x * sin(a) + v.z * cos(a))
	arr[Mesh.ARRAY_VERTEX] = verts
	var am := ArrayMesh.new()
	am.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arr)
	g.add_child(Kit.mi(am, bark, Vector3(0, 2.5, 0)))
	for i in 7:
		var a := TAU * i / 7.0
		var pts := PackedVector3Array([Vector3(cos(a) * 0.8, 1.0, sin(a) * 0.8), Vector3(cos(a) * 1.8, 0.4, sin(a) * 1.8), Vector3(cos(a) * 2.6, 0.05, sin(a) * 2.6)])
		g.add_child(Kit.mi(Kit.tube(pts, 0.22, 6, 0.5), bark))
	var core_mat := Kit.glow(Color("#8a6aff"), 2.0)
	g.add_child(Kit.mi(Kit.sphere(0.55, 24, 16), core_mat, Vector3(0, 2.0, 1.2)))
	var leaf := Kit.mat(Color("#1a6a7a"), 0.7)
	leaf.emission_enabled = true
	leaf.emission = Color("#0a3a4a")
	leaf.emission_energy_multiplier = 0.6
	for i in 9:
		var a := TAU * i / 9.0
		g.add_child(Kit.mi(Kit.blob(1.6 + (i % 3) * 0.3), leaf, Vector3(cos(a) * 2, 5.2 + (i % 2) * 0.7, sin(a) * 2)))
	g.add_child(Kit.mi(Kit.blob(2.2), leaf, Vector3(0, 6.4, 0)))
	var lights := Node3D.new()
	var R := _rng(5)
	for i in 40:
		var a := R.randf() * TAU
		var r := 1.0 + R.randf() * 3.0
		lights.add_child(Kit.mi(Kit.sphere(0.07, 6, 4), Kit.glow(Color("#7ff3ff") if i % 3 else Color("#ff9ae8"), 4.0), Vector3(cos(a) * r, 3.8 + R.randf() * 3.2, sin(a) * r)))
	g.add_child(lights)
	var l := OmniLight3D.new()
	l.light_color = Color("#8a6aff")
	l.light_energy = 2.0
	l.omni_range = 12.0
	l.position = Vector3(0, 2.5, 1.6)
	g.add_child(l)
	g.set_meta("core_mat", core_mat)
	g.set_meta("lights", lights)
	g.set_meta("light", l)
	return g


static func core_pylon() -> Node3D:
	var g := Node3D.new()
	g.add_child(Kit.mi(Kit.cyl(0.12, 0.2, 2.6, 8), Kit.mat(Color("#d8dce8"), 0.25, 0.6), Vector3(0, 1.3, 0)))
	var orb := Kit.glow(Color("#3a3a5a"), 1.0)
	g.add_child(Kit.mi(Kit.sphere(0.22, 16, 12), orb, Vector3(0, 2.75, 0)))
	g.set_meta("orb", orb)
	return g


static func barricade() -> Node3D:
	var g := Node3D.new()
	var post := Kit.glossy(Color("#e8ecf4"))
	for z in [-0.45, 0.45]:
		g.add_child(Kit.mi(Kit.box(0.18, 1.4, 0.18), post, Vector3(0, 0.7, z)))
		g.add_child(Kit.mi(Kit.sphere(0.08, 8, 6), Kit.glow(Color("#ff4a8a"), 4.0), Vector3(0, 1.45, z)))
	var field_mat := Kit.glow(Color("#ff4ae0"), 1.5, true)
	field_mat.albedo_color = Color(1.4, 0.4, 1.3, 0.5)
	var q := QuadMesh.new()
	q.size = Vector2(0.9, 1.2)
	var field := Kit.mi(q, field_mat, Vector3(0, 0.7, 0), Vector3(0, PI / 2, 0))
	field.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	g.add_child(field)
	g.set_meta("field", field_mat)
	return g


static func bridge_posts() -> Node3D:
	var g := Node3D.new()
	var wood := Kit.mat(Color("#6a4a3a"), 0.8)
	for z in [-0.4, 0.4]:
		g.add_child(Kit.mi(Kit.cyl(0.08, 0.1, 0.9, 6), wood, Vector3(0, 0.45, z)))
	g.add_child(Kit.mi(Kit.box(0.04, 0.04, 0.8), Kit.mat(Color("#e8d8a0")), Vector3(0, 0.75, 0)))
	return g


static func pickup(kind: String) -> Node3D:
	var g := Node3D.new()
	match kind:
		"scrap":
			g.add_child(Kit.mi(Kit.torus(0.09, 0.04, 8), Kit.mat(Color("#dfe4ee"), 0.3, 0.8)))
		"chip":
			g.add_child(Kit.mi(Kit.box(0.18, 0.04, 0.18), Kit.mat(Color("#1f6a4a"), 0.4)))
			g.add_child(Kit.mi(Kit.box(0.08, 0.05, 0.08), Kit.glow(Color("#ffd25e"), 3.0), Vector3(0, 0.01, 0)))
		_:
			var red := Kit.mat(Color("#e0304a"), 0.3)
			red.emission_enabled = true
			red.emission = Color("#ff2a4a")
			red.emission_energy_multiplier = 0.5
			g.add_child(Kit.mi(Kit.sphere(0.08, 10, 8), red, Vector3(-0.05, 0, 0)))
			g.add_child(Kit.mi(Kit.sphere(0.07, 10, 8), red, Vector3(0.06, 0, 0.02)))
	return g
