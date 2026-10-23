## WorldData – kartan som rutnät (1 ruta = 1 meter i 3D). Genererar sektorerna
## Mossdalen, Järnforsen och Dimkronorna, kristallgrottorna, älven, sjön, stigen
## och alla platser. Ingen grafik här: WorldBuilder läser rutnätet.
class_name WorldData
extends RefCounted

signal changed(what: String, x: int, y: int)

enum G { GRASS, MOSS, DARK, SNOW, DIRT, MUD, SHALLOW, DEEP, BRIDGE, FLOOR, SITE, THICKET, HIDDEN, CAVE }
enum B { NONE, PINE, PINE_SNOW, SPRUCE, BIRCH, ROCK, ROCK_MOSS, RUIN, LOG, BARRICADE, SCRAPHEAP, RUNESTONE, PYLON, PART, CAMPFIRE, SPRUCE_DARK, CAVEWALL }
enum D { NONE, FLOWER_W, FLOWER_Y, FLOWER_B, MUSHROOM, TUFT, PEBBLE, BERRY, BOLT, LICHEN }

const W := 96
const H := 128
const SECTORS := [
	{"id": "dim", "name": "Dimkronorna", "y0": 0, "y1": 44},
	{"id": "jarn", "name": "Järnforsen", "y0": 44, "y1": 86},
	{"id": "moss", "name": "Mossdalen", "y0": 86, "y1": 9999},
]

var seed_value := 20261023
var ground := PackedByteArray()
var block := PackedByteArray()
var deco := PackedByteArray()
var variant := PackedByteArray()
var revealed := PackedByteArray()
var block_hp := {}
var scrap_heap_used := {}
var big: Array = [] # {kind, x, y, w, h}
var crystals: Array = []
var chests: Array = []
var animals: Array = []
var runestones: Array = []
var buried: Array = []
var spawns: Array = []
var bridge_sites := {}
var grottos: Array = []
var changes: Array = []
var path: Array = []
var base := Vector2(48, 116)
var spawn := Vector2(48.5, 118)
var campfire := Vector2(46.5, 116.6)
var forge_pos := Vector2(52, 114)
var core := {"pos": Vector2(48, 9), "pylons": [[42, 5], [54, 5], [42, 11], [54, 11]]}
var rng := RandomNumberGenerator.new()


func _init(s: int = 20261023) -> void:
	seed_value = s
	for arr in [ground, block, deco, variant, revealed]:
		arr.resize(W * H)
		arr.fill(0)
	generate()


# ---------------------------------------------------------------
# Åtkomst
# ---------------------------------------------------------------
func idx(x: int, y: int) -> int:
	return y * W + x


func in_bounds(x: int, y: int) -> bool:
	return x >= 0 and y >= 0 and x < W and y < H


func g(x: int, y: int) -> int:
	return ground[y * W + x] if in_bounds(x, y) else G.DEEP


func b(x: int, y: int) -> int:
	return block[y * W + x] if in_bounds(x, y) else B.ROCK


func set_g(x: int, y: int, v: int) -> void:
	if in_bounds(x, y):
		ground[y * W + x] = v


func set_b(x: int, y: int, v: int) -> void:
	if in_bounds(x, y):
		block[y * W + x] = v


func sector_at(ty: int) -> Dictionary:
	for s in SECTORS:
		if ty >= s.y0 and ty < s.y1:
			return s
	return SECTORS[2]


func is_water_g(gt: int) -> bool:
	return gt == G.DEEP or gt == G.SHALLOW or gt == G.SITE


# ---------------------------------------------------------------
# Generering
# ---------------------------------------------------------------
func generate() -> void:
	rng.seed = seed_value
	var s := seed_value
	# 1. Grundterräng per sektor med brusiga gränser
	for y in H:
		for x in W:
			var jy := y + (SV.noise(x * 0.15, 3, s) - 0.5) * 6.0
			var n := SV.fbm(x * 0.09, y * 0.09, s + 1)
			var gt := G.GRASS
			if jy >= 86:
				gt = G.MOSS if n > 0.56 else G.GRASS
			elif jy >= 44:
				gt = G.MUD if SV.fbm(x * 0.12, y * 0.12, s + 2) > 0.66 else (G.GRASS if n > 0.6 else G.DARK)
			else:
				gt = G.SNOW if n > 0.47 else (G.MOSS if SV.fbm(x * 0.2, y * 0.2, s + 9) > 0.5 else G.DARK)
			set_g(x, y, gt)
			variant[idx(x, y)] = int(SV.hash2(x, y, s) * 255.0)

	# 2. Skog i dungar och gläntor + markdetaljer
	for y in H:
		for x in W:
			var sec: String = sector_at(y).id
			var clump := SV.fbm(x * 0.11, y * 0.11, s + 4)
			var base_d := 0.1 if sec == "moss" else (0.09 if sec == "jarn" else 0.15)
			var dens := base_d * maxf(0.0, clump - 0.3) * 3.2
			var h := SV.hash2(x, y, s + 5)
			if h < dens:
				var bt := B.PINE
				if sec == "moss":
					bt = B.BIRCH if SV.hash2(x, y, 6) < 0.4 else B.PINE
				elif sec == "jarn":
					bt = B.SPRUCE_DARK if SV.hash2(x, y, 6) < 0.25 else B.PINE
				else:
					bt = B.SPRUCE if SV.hash2(x, y, 6) < 0.35 else B.PINE_SNOW
				set_b(x, y, bt)
			elif h < dens + 0.012:
				set_b(x, y, B.ROCK_MOSS if sec == "moss" else B.ROCK)
			var dh := SV.hash2(x, y, s + 8)
			var d := D.NONE
			if sec == "moss":
				if dh < 0.06: d = D.FLOWER_W
				elif dh < 0.1: d = D.FLOWER_Y
				elif dh < 0.13: d = D.FLOWER_B
				elif dh < 0.15: d = D.MUSHROOM
				elif dh < 0.2: d = D.TUFT
				elif dh < 0.22: d = D.BERRY
			elif sec == "jarn":
				if dh < 0.04: d = D.BOLT
				elif dh < 0.1: d = D.TUFT
				elif dh < 0.13: d = D.PEBBLE
				elif dh < 0.145: d = D.MUSHROOM
			else:
				if dh < 0.08: d = D.LICHEN
				elif dh < 0.12: d = D.PEBBLE
				elif dh < 0.14: d = D.FLOWER_B
			deco[idx(x, y)] = d

	# 3. Ytterkant av tät skog
	for y in H:
		for x in W:
			var edge := mini(mini(x, y), mini(W - 1 - x, H - 1 - y))
			var thick := 2 + int(SV.noise(x * 0.3, y * 0.3, s + 11) * 2.5)
			if edge < thick:
				set_b(x, y, B.PINE_SNOW if y < 44 else B.PINE)

	# 4. Älven genom Järnforsen
	for x in W:
		var cy := river_y(x)
		for y in range(floori(cy - 4), ceili(cy + 4) + 1):
			var dd := absf(y + 0.5 - cy)
			if dd <= 1.7:
				water(x, y, G.DEEP)
			elif dd <= 2.6:
				water(x, y, G.SHALLOW)

	# 5. Sjön i öster med en ö
	disc(80, 54, 7.5, func(x: int, y: int, dd: float) -> void:
		if dd < 2.2:
			set_g(x, y, G.MOSS)
			set_b(x, y, B.NONE)
		elif dd < 6.3:
			water(x, y, G.DEEP)
		else:
			water(x, y, G.SHALLOW))
	var site: Array = []
	for x in range(73, 78):
		if g(x, 54) == G.DEEP:
			set_g(x, 54, G.SITE)
			site.append([x, 54])
	bridge_sites["lake"] = {"id": "lake", "tiles": site, "built": false, "post": [72, 54], "dir": "h"}

	# 6. Bäcken och dammen i Mossdalen
	for y in range(84, 112):
		var cx := 27.0 + sin(y * 0.28) * 2.2
		for x in range(floori(cx - 1), ceili(cx + 1) + 1):
			if absf(x + 0.5 - cx) < 1.3:
				water(x, y, G.SHALLOW)
	disc(29, 98, 4.2, func(x: int, y: int, dd: float) -> void:
		if dd < 1.2:
			set_g(x, y, G.MOSS)
			set_b(x, y, B.NONE)
		else:
			water(x, y, G.SHALLOW))

	# 7. Stigen från Skogsbasen till Urkärnan
	path = [[48, 120], [47, 110], [40, 103], [52, 92], [46, 80], [33, 72], [36, 66], [44, 60], [58, 54], [62, 46], [50, 38], [36, 28], [42, 20], [50, 16], [48, 12]]
	for i in path.size() - 1:
		carve(path[i], path[i + 1], 1.3)

	# 8. Skogsbasen
	disc(48, 115, 6.5, func(x: int, y: int, dd: float) -> void:
		set_b(x, y, B.NONE)
		if dd < 3.6:
			set_g(x, y, G.FLOOR)
		elif g(x, y) != G.DIRT:
			set_g(x, y, G.MOSS))
	add_big("forge", 51, 113, 2, 2)
	add_big("tent", 43, 113, 2, 1)
	set_b(46, 116, B.CAMPFIRE)

	# 9. Urkärnan
	disc(48, 8, 7.5, func(x: int, y: int, dd: float) -> void:
		set_b(x, y, B.NONE)
		set_g(x, y, G.FLOOR if dd < 4.8 else G.MOSS))
	add_big("core", 46, 7, 4, 2)
	for p in core.pylons:
		set_b(p[0], p[1], B.PYLON)

	# 10. Snårgläntan med Lodjurets dolda stig
	disc(13, 103, 5.6, func(x: int, y: int, dd: float) -> void:
		set_b(x, y, B.NONE)
		set_g(x, y, G.THICKET if dd >= 3.9 else G.MOSS))
	for x in range(16, 22):
		set_b(x, 103, B.NONE)
		if g(x, 103) == G.THICKET:
			set_g(x, 103, G.HIDDEN)
	for i in 9:
		var cx := rng.randi_range(8, 86)
		var cy := rng.randi_range(90, 122)
		var rr := rng.randf_range(1.2, 2.4)
		if Vector2(cx, cy).distance_to(Vector2(48, 115)) < 10 or Vector2(cx, cy).distance_to(Vector2(13, 103)) < 9:
			continue
		disc(cx, cy, rr, func(x: int, y: int, _dd: float) -> void:
			if g(x, y) != G.DIRT and g(x, y) != G.SHALLOW:
				set_g(x, y, G.THICKET)
				set_b(x, y, B.NONE))

	# 11. Stenringen i Dimkronorna, spärrad av fallna stockar (Älgen)
	disc(80, 22, 5.6, func(x: int, y: int, dd: float) -> void:
		if dd >= 4:
			set_b(x, y, B.ROCK if SV.hash2(x, y, 3) < 0.5 else B.RUIN)
		else:
			set_b(x, y, B.NONE)
			set_g(x, y, G.SNOW))
	for x in range(74, 77):
		set_b(x, 22, B.LOG)
	for x in range(70, 74):
		set_b(x, 22, B.NONE)
		set_g(x, 22, G.SNOW)

	# 12. Robotdepån med el-barrikad
	for y in range(48, 57):
		for x in range(9, 20):
			var edge := x == 9 or x == 19 or y == 48 or y == 56
			set_b(x, y, B.RUIN if edge else B.NONE)
			if not edge:
				set_g(x, y, G.FLOOR)
	set_b(19, 51, B.BARRICADE)
	set_b(19, 52, B.BARRICADE)
	block_hp["19,51"] = 3
	block_hp["19,52"] = 3
	for x in range(20, 25):
		for y in range(51, 53):
			set_b(x, y, B.NONE)
			if g(x, y) != G.DEEP and g(x, y) != G.SHALLOW:
				set_g(x, y, G.DIRT)
	set_b(11, 50, B.SCRAPHEAP)
	set_b(17, 55, B.SCRAPHEAP)

	# 13. Ruiner, reaktorer, energiledningar och skrot
	add_reactor(58, 79)
	add_reactor(30, 57)
	for x in range(8, 41, 6):
		place_if_free(x, 82, B.PYLON)
	for y in range(46, 61, 5):
		place_if_free(70, y, B.PYLON)
	for i in 26:
		place_if_free(rng.randi_range(5, 90), rng.randi_range(46, 84), B.SCRAPHEAP)
	for i in 14:
		var x := rng.randi_range(5, 88)
		var y := rng.randi_range(46, 84)
		var ln := rng.randi_range(2, 4)
		var hor := rng.randf() < 0.5
		for k in ln:
			place_if_free(x + (k if hor else 0), y + (0 if hor else k), B.RUIN)
	for i in 6:
		place_if_free(rng.randi_range(60, 90), rng.randi_range(92, 120), B.RUIN)
	for i in 6:
		place_if_free(rng.randi_range(5, 90), rng.randi_range(6, 40), B.RUIN)
	for i in 5:
		place_if_free(rng.randi_range(8, 88), rng.randi_range(90, 122), B.SCRAPHEAP)

	# 14. Kristallgrottor: rundade klippväggar med en smal öppning mot stigen
	for gr in [[53, 99, 3.2], [80, 106, 3.4], [62, 74, 3.0], [20, 30, 3.6], [64, 33, 3.0], [30, 12, 3.2]]:
		grotto(gr[0], gr[1], gr[2])

	# Stigen ska alltid vara fri
	for i in path.size() - 1:
		carve(path[i], path[i + 1], 1.3)

	# 15. Runstenar
	var runes := [
		[41, 108, "Runan lyser svagt: \"Där snåren är tätast går lodjurets stig. Bara den som smyger ser vägen.\""],
		[57, 84, "Runan: \"Älven är bred, men bävern bygger där stolparna står.\""],
		[27, 45, "Runan: \"Stockarna i norr flyttas inte av händer – men av en konungs horn.\""],
		[57, 16, "Runan: \"Åtta kristaller väcker Urkärnan. Då höjs skölden och stormen tystnar.\""],
	]
	for i in runes.size():
		var r: Array = runes[i]
		clear_around(r[0], r[1], 1)
		set_b(r[0], r[1], B.RUNESTONE)
		runestones.append({"id": "r%d" % i, "tx": r[0], "ty": r[1], "pos": Vector2(r[0] + 0.5, r[1] + 0.5), "text": r[2], "read": false})

	# 16. Energikristaller (12 st)
	var cr := [
		[53, 99, "Mossdalens grotta"], [13, 103, "Snårgläntan"], [29, 98, "Dammen"], [80, 106, "Ruingrottan"],
		[80, 54, "Ön i sjön"], [14, 52, "Robotdepån"], [62, 74, "Reaktorgrottan"], [34, 77, "Begravd", true],
		[80, 22, "Stenringen"], [20, 30, "Drönargrottan"], [64, 33, "Klippgrottan"], [30, 12, "Kärnans grotta"],
	]
	for i in cr.size():
		var c: Array = cr[i]
		set_b(c[0], c[1], B.NONE)
		var gt := g(c[0], c[1])
		if gt == G.DEEP or gt == G.SHALLOW or gt == G.THICKET:
			set_g(c[0], c[1], G.MOSS)
		crystals.append({"id": "c%d" % i, "tx": c[0], "ty": c[1], "pos": Vector2(c[0] + 0.5, c[1] + 0.6), "where": c[2], "buried": c.size() > 3, "taken": false, "seen": false, "ping": 0.0})

	# 17. Kistor
	var ch := [[11, 101], [12, 54], [81, 53], [82, 21], [70, 96], [22, 74], [12, 30], [56, 40], [86, 70]]
	for i in ch.size():
		set_b(ch[i][0], ch[i][1], B.NONE)
		var gt2 := g(ch[i][0], ch[i][1])
		if gt2 == G.THICKET or gt2 == G.DEEP:
			set_g(ch[i][0], ch[i][1], G.MOSS)
		chests.append({"id": "k%d" % i, "tx": ch[i][0], "ty": ch[i][1], "pos": Vector2(ch[i][0] + 0.5, ch[i][1] + 0.6), "open": false})

	# 18. Djur att bli vän med
	for a in [["fox", 67, 107], ["beaver", 24, 92], ["lynx", 40, 76], ["moose", 72, 74], ["owl", 52, 48]]:
		clear_around(a[1], a[2], 1)
		animals.append({"kind": a[0], "pos": Vector2(a[1] + 0.5, a[2] + 0.6), "met": false})

	# 19. Begravt skrot som Hunden hittar
	var tries := 0
	while buried.size() < 46 and tries < 2000:
		tries += 1
		var x := rng.randi_range(4, W - 5)
		var y := rng.randi_range(4, H - 5)
		if is_solid_tile(x, y) or g(x, y) == G.SHALLOW or g(x, y) == G.FLOOR:
			continue
		buried.append({"id": "b%d" % buried.size(), "pos": Vector2(x + 0.5, y + 0.5), "dug": false, "marked": 0.0})

	# 20. Robotpatruller
	var sp := [
		["hound", 70, 100, 3], ["hound", 30, 110, 2], ["hound", 80, 108, 3], ["bear", 18, 92, 1],
		["bear", 62, 76, 1], ["bear", 22, 58, 1], ["bear", 46, 70, 1], ["bear", 84, 80, 1],
		["hound", 30, 80, 3], ["hound", 70, 60, 3], ["drone", 50, 56, 2], ["drone", 14, 46, 1], ["drone", 86, 62, 1],
		["drone", 20, 30, 3], ["drone", 62, 30, 2], ["drone", 36, 16, 2], ["bear", 30, 14, 1], ["bear", 76, 30, 1],
		["hound", 44, 24, 3], ["hound", 14, 20, 2], ["bear", 60, 40, 1],
	]
	for e in sp:
		for k in e[3]:
			var f := find_free(e[1] + (k % 2) * 2 - 1, e[2] + int(k / 2) * 2)
			if f != Vector2i(-1, -1):
				spawns.append({"type": e[0], "pos": Vector2(f.x + 0.5, f.y + 0.5)})


func river_y(x: float) -> float:
	return 66.0 + sin(x * 0.13) * 2.6 + sin(x * 0.05 + 1.0) * 2.0


func water(x: int, y: int, t: int) -> void:
	if not in_bounds(x, y):
		return
	var cur := g(x, y)
	if t == G.SHALLOW and (cur == G.DEEP or cur == G.SITE):
		return
	set_g(x, y, t)
	set_b(x, y, B.NONE)
	deco[idx(x, y)] = 0


func disc(cx: float, cy: float, r: float, fn: Callable) -> void:
	for y in range(floori(cy - r), ceili(cy + r) + 1):
		for x in range(floori(cx - r), ceili(cx + r) + 1):
			if not in_bounds(x, y):
				continue
			var d := Vector2(x - cx, y - cy).length()
			if d <= r:
				fn.call(x, y, d)


func carve(a: Array, bb: Array, r: float) -> void:
	var n := ceili(Vector2(bb[0] - a[0], bb[1] - a[1]).length() * 2.0)
	for i in n + 1:
		var t := float(i) / n
		var cx := lerpf(a[0], bb[0], t) + sin(t * TAU + a[0]) * 0.6
		var cy := lerpf(a[1], bb[1], t)
		disc(cx, cy, r, func(x: int, y: int, _d: float) -> void:
			var bt := b(x, y)
			if bt == B.PART or bt == B.PYLON:
				return
			var cur := g(x, y)
			set_b(x, y, B.NONE)
			if cur == G.DEEP or cur == G.SHALLOW or cur == G.SITE or cur == G.BRIDGE:
				set_g(x, y, G.BRIDGE)
			elif cur != G.FLOOR:
				set_g(x, y, G.DIRT)
			deco[idx(x, y)] = D.PEBBLE if SV.hash2(x, y, 2) < 0.1 else D.NONE)


func add_big(kind: String, x: int, y: int, w: int, h: int) -> void:
	for j in h:
		for i in w:
			set_b(x + i, y + j, B.PART)
			deco[idx(x + i, y + j)] = 0
	big.append({"kind": kind, "x": x, "y": y, "w": w, "h": h})


func add_reactor(x: int, y: int) -> void:
	clear_around(x + 1, y, 2)
	add_big("reactor", x, y, 3, 2)


func place_if_free(x: int, y: int, bt: int) -> void:
	if not in_bounds(x, y):
		return
	var gt := g(x, y)
	if b(x, y) != B.NONE or gt in [G.DIRT, G.DEEP, G.SHALLOW, G.SITE, G.BRIDGE, G.FLOOR, G.THICKET, G.HIDDEN, G.CAVE]:
		return
	set_b(x, y, bt)


func clear_around(cx: int, cy: int, r: int) -> void:
	for y in range(cy - r, cy + r + 1):
		for x in range(cx - r, cx + r + 1):
			if b(x, y) != B.PART:
				set_b(x, y, B.NONE)
			if g(x, y) == G.THICKET:
				set_g(x, y, G.MOSS)


func find_free(x: int, y: int) -> Vector2i:
	for r in 6:
		for j in range(-r, r + 1):
			for i in range(-r, r + 1):
				if not is_solid_tile(x + i, y + j) and g(x + i, y + j) != G.SHALLOW:
					return Vector2i(x + i, y + j)
	return Vector2i(-1, -1)


func grotto(cx: int, cy: int, r: float) -> void:
	var best: Array = path[0]
	var bd := INF
	for p in path:
		var d := Vector2(p[0] - cx, p[1] - cy).length()
		if d < bd:
			bd = d
			best = p
	var open := atan2(best[1] - cy, best[0] - cx)
	disc(cx, cy, r + 1.6, func(x: int, y: int, d: float) -> void:
		var a := atan2(y - cy, x - cx)
		var in_gap := absf(SV.angle_diff(open, a)) < 0.42
		if b(x, y) == B.PART:
			return
		if d < r or (in_gap and d < r + 1.7):
			set_b(x, y, B.NONE)
			set_g(x, y, G.CAVE)
			deco[idx(x, y)] = 0
		elif g(x, y) != G.DIRT and g(x, y) != G.BRIDGE:
			set_b(x, y, B.CAVEWALL))
	var a0 := Vector2(cx + cos(open) * r, cy + sin(open) * r)
	var a1 := Vector2(cx + cos(open) * (r + 2.2), cy + sin(open) * (r + 2.2))
	var n := ceili(a0.distance_to(a1) * 2.0)
	for i in n + 1:
		var p := a0.lerp(a1, float(i) / n)
		disc(p.x, p.y, 0.9, func(x: int, y: int, _d: float) -> void:
			if b(x, y) == B.PART:
				return
			set_b(x, y, B.NONE)
			if not is_water_g(g(x, y)) and g(x, y) != G.BRIDGE:
				set_g(x, y, G.CAVE))
	grottos.append({"x": cx, "y": cy, "r": r, "open": open, "visited": false})


# ---------------------------------------------------------------
# Kollision och terräng
# ---------------------------------------------------------------
func is_solid_tile(x: int, y: int, hidden_open: bool = false, flying: bool = false) -> bool:
	if not in_bounds(x, y):
		return true
	if flying:
		return false
	var gt := ground[y * W + x]
	if gt == G.DEEP or gt == G.SITE or gt == G.THICKET:
		return true
	if gt == G.HIDDEN and not hidden_open:
		return true
	return block[y * W + x] != B.NONE


func is_solid_at(p: Vector2, hidden_open: bool = false, flying: bool = false) -> bool:
	return is_solid_tile(floori(p.x), floori(p.y), hidden_open, flying)


## Flyttar en kropp med glidning längs väggar. Returnerar [ny position, krock].
func move_body(p: Vector2, d: Vector2, hw: float, hh: float, hidden_open: bool = false, flying: bool = false) -> Array:
	var hit := false
	var test := func(q: Vector2) -> bool:
		return is_solid_at(q + Vector2(-hw, -hh), hidden_open, flying) or is_solid_at(q + Vector2(hw, -hh), hidden_open, flying) \
			or is_solid_at(q + Vector2(-hw, hh), hidden_open, flying) or is_solid_at(q + Vector2(hw, hh), hidden_open, flying)
	if d.x != 0.0:
		if not test.call(p + Vector2(d.x, 0)):
			p.x += d.x
		else:
			hit = true
	if d.y != 0.0:
		if not test.call(p + Vector2(0, d.y)):
			p.y += d.y
		else:
			hit = true
	return [p, hit]


func ground_at(p: Vector2) -> int:
	return g(floori(p.x), floori(p.y))


func in_grotto(p: Vector2) -> bool:
	return ground_at(p) == G.CAVE


# ---------------------------------------------------------------
# Förändringar som sparas
# ---------------------------------------------------------------
func build_bridge(id: String) -> bool:
	var site: Dictionary = bridge_sites.get(id, {})
	if site.is_empty() or site.built:
		return false
	for t in site.tiles:
		set_g(t[0], t[1], G.BRIDGE)
	site.built = true
	changes.append({"t": "bridge", "id": id})
	changed.emit("bridge", 0, 0)
	return true


func clear_block(x: int, y: int) -> void:
	var was := b(x, y)
	if was == B.NONE:
		return
	set_b(x, y, B.NONE)
	changes.append({"t": "clear", "x": x, "y": y})
	changed.emit("block:%d" % was, x, y)


func apply_changes(list: Array) -> void:
	for c in list:
		if c.t == "bridge":
			build_bridge(c.id)
		elif c.t == "clear":
			clear_block(int(c.x), int(c.y))


# ---------------------------------------------------------------
# Utforskning (krigsdimma)
# ---------------------------------------------------------------
## Returnerar antal nyupptäckta rutor.
func reveal(p: Vector2, radius: float) -> int:
	var n := 0
	var r := ceili(radius)
	for y in range(floori(p.y) - r, floori(p.y) + r + 1):
		for x in range(floori(p.x) - r, floori(p.x) + r + 1):
			if not in_bounds(x, y):
				continue
			var i := y * W + x
			if revealed[i]:
				continue
			if Vector2(x + 0.5 - p.x, y + 0.5 - p.y).length() > radius:
				continue
			revealed[i] = 1
			n += 1
	return n


func revealed_fraction() -> float:
	var n := 0
	for v in revealed:
		n += v
	return float(n) / revealed.size()


func tile_map_color(x: int, y: int) -> Color:
	var gt := g(x, y)
	var bt := b(x, y)
	if bt in [B.PINE, B.PINE_SNOW, B.SPRUCE, B.BIRCH, B.SPRUCE_DARK]:
		return Color("#233a6a") if y < 44 else Color("#1f4a5a")
	if bt in [B.RUIN, B.PART, B.BARRICADE]:
		return Color("#9aa2b8")
	if bt in [B.ROCK, B.ROCK_MOSS]:
		return Color("#4a5a8a")
	if bt == B.CAVEWALL:
		return Color("#2a3a6a")
	match gt:
		G.CAVE:
			return Color("#8a3a9a")
		G.DEEP, G.SITE:
			return Color("#1a4aa3")
		G.SHALLOW:
			return Color("#3a8ac8")
		G.BRIDGE, G.DIRT:
			return Color("#b08a4a")
		G.MUD:
			return Color("#4a2a4a")
		G.SNOW:
			return Color("#a8a0e0")
		G.FLOOR:
			return Color("#6a6478")
		G.THICKET, G.HIDDEN:
			return Color("#123c38")
		G.MOSS:
			return Color("#6e8e1e")
		G.DARK:
			return Color("#226452")
	return Color("#5a8a26")
