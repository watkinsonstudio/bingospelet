# CompanionBase.gd – gemensam basklass för alla djurkompisar (GDD §5.1).
# Hanterar erfarenhetspoäng, nivåsteg och exekvering av superattacker.
# Arterna (DogCompanion, LynxCompanion …) ärver och överskuggar
# execute_super_ability() och sina samarbetsförmågor.
class_name Companion
extends Node3D

signal level_changed(new_level: int)
signal super_ready()

const LEVEL_TITLES := ["Nyfiken hjälpare", "Skogsväktare", "Skogens Mästare"]
const LEVEL_SCALE := [0.8, 1.0, 1.28]
const INFO := {
	"dog": {
		"name": "Hunden", "trait": "Modig & lojal", "focus": "Beskydd och resurssökning",
		"levels": ["Hittar dolt skrot i marken nära er. Skäller när fiender närmar sig.", "Större sökradie. Kan distrahera en robot genom att skälla.", "Låser upp Superattacken Sköldskall."],
		"coop": [{"id": "sniff", "name": "Nosa", "cd": 9.0, "desc": "Söker av ett stort område efter begravt skrot."}, {"id": "distract", "name": "Distrahera", "cd": 12.0, "desc": "Skäller och lockar till sig en robot i 5 sekunder."}],
		"super": {"name": "Sköldskall", "desc": "Sonisk chockvåg i 360°: alla robotar i närheten paralyseras i 4 s och Signe får en sköld som tål 2 träffar."},
	},
	"lynx": {
		"name": "Lodjuret", "trait": "Smygande & snabb", "focus": "Agilitet och överraskningsattacker",
		"levels": ["Avslöjar dolda stigar genom täta snår.", "Minskar hela gruppens stegljud (robotar ser er sämre).", "Låser upp Superattacken Skugghopp."],
		"coop": [{"id": "stealth", "name": "Smyg", "cd": 14.0, "desc": "I 5 s ser robotarna er knappt."}, {"id": "stealth2", "name": "Skuggsmyg", "cd": 12.0, "desc": "I 8 s ser robotarna er knappt."}],
		"super": {"name": "Skugghopp", "desc": "Lodjuret hoppar från trädkronorna och slår ut minneskretsarna på den starkaste roboten i området."},
	},
	"owl": {
		"name": "Ugglan", "trait": "Vis & klarsynt", "focus": "Rekognosering och synfält",
		"levels": ["Skingrar dimman i en större radie runt Signe.", "Markerar energikristaller och kistor på minikartan.", "Låser upp Superattacken Bländande Vingslag."],
		"coop": [{"id": "scout", "name": "Spana", "cd": 15.0, "desc": "Lyfter dimman långt bort och pekar ut kristaller."}, {"id": "scout2", "name": "Högspaning", "cd": 15.0, "desc": "Lyfter dimman ännu längre bort."}],
		"super": {"name": "Bländande Vingslag", "desc": "Ett intensivt ljus bländar alla robotars optiska sensorer och strålkastare."},
	},
	"moose": {
		"name": "Älgen", "trait": "Kraftfull & lugn", "focus": "Tunga hinder och terräng",
		"levels": ["Signe tar sig fram i snö och gyttja utan att sakta in.", "Knuffar undan fallna träd och mindre blockader.", "Låser upp Superattacken Urkraftens Rusning."],
		"coop": [{"id": "push", "name": "Knuff", "cd": 8.0, "desc": "Knuffar undan robotar runt Signe."}, {"id": "push2", "name": "Stockknuff", "cd": 8.0, "desc": "Knuffar robotar och fallna stockar ur vägen."}],
		"super": {"name": "Urkraftens Rusning", "desc": "Älgen rusar framåt och plöjer igenom hinder och barrikader och slår omkull tunga björnrobotar."},
	},
	"fox": {
		"name": "Räven", "trait": "Listig & teknisk", "focus": "Sensorstörning och stöld",
		"levels": ["Samlar automatiskt upp skrot som tappats på marken.", "Kan placera ut en elektronisk skenbild som lurar patrullerna.", "Låser upp Superattacken Kretskupp."],
		"coop": [{"id": "fetch", "name": "Hämta", "cd": 8.0, "desc": "Hämtar allt skrot i närheten."}, {"id": "decoy", "name": "Skenbild", "cd": 12.0, "desc": "En elektronisk skenbild lockar robotarna i 6 s."}],
		"super": {"name": "Kretskupp", "desc": "Räven smyger fram och knycker en robots batteri – roboten blir strömlös och tappar dubbelt skrot."},
	},
	"beaver": {
		"name": "Bävern", "trait": "Byggare & vattenexpert", "focus": "Terräng och vattenteknik",
		"levels": ["Signe korsar grunt vatten utan att frysa eller sakta in.", "Bygger träbroar där brostolparna står.", "Låser upp Superattacken Översvämning."],
		"coop": [{"id": "splash", "name": "Plask", "cd": 6.0, "desc": "Blöter ner robotar – elhuggen gör 50 % mer skada."}, {"id": "build", "name": "Bygg / Plask", "cd": 6.0, "desc": "Bygger bro vid brostolpar, annars Plask."}],
		"super": {"name": "Översvämning", "desc": "En vattenvåg sköljer över stridsfältet och kortsluter robotar och el-barrikader."},
	},
}

@export var companion_name: String = ""
@export var current_level: int = 1
@export var current_xp: float = 0.0
@export var xp_to_next_level: Array[float] = [100.0, 350.0, 0.0]

var is_super_available: bool = false
var super_meter: float = 0.0 # laddas i strid när nivå 3 är nådd

var kind := ""
var game = null # Game (main.gd), sätts av CompanionManager
var pos := Vector2.ZERO
var z := 0.0
var moving := false
var task := {} # {pos, timeout, on_arrive}
var action := {} # {t, update, done}
var coop_cd := 0.0
var speed := 4.6
var bubble := {} # {text, t}
var model: CompanionModel
var _prev := Vector2.ZERO
var _yaw := 0.0


func _init(k: String = "") -> void:
	kind = k
	if k != "":
		model = CompanionModel.new(k)
		add_child(model)


func add_xp(amount: float) -> void:
	if current_level >= 3:
		return

	current_xp += amount
	if current_xp >= xp_to_next_level[current_level - 1]:
		level_up()


func level_up() -> void:
	if current_level < 3:
		current_level += 1
		current_xp = 0.0
		emit_signal("level_changed", current_level)
		if current_level == 3:
			is_super_available = true
			super_meter = 100.0
			emit_signal("super_ready")


func trigger_super() -> bool:
	if current_level == 3 and is_super_available:
		if not can_execute_super():
			return false
		execute_super_ability()
		is_super_available = false
		super_meter = 0.0
		return true
	return false


## Supermätaren fylls av samarbete i strid.
func charge_super(amount: float) -> void:
	if current_level < 3 or is_super_available:
		return
	super_meter = minf(100.0, super_meter + amount)
	if super_meter >= 100.0:
		is_super_available = true
		emit_signal("super_ready")


# Överskuggas av specifika djurklasser
func execute_super_ability() -> void:
	pass


func can_execute_super() -> bool:
	return true


# ---------------------------------------------------------------
# Samarbetsförmågor och passiva egenskaper (överskuggas)
# ---------------------------------------------------------------
func info() -> Dictionary:
	return INFO[kind]


func title() -> String:
	return LEVEL_TITLES[current_level - 1]


func coop() -> Dictionary:
	return info().coop[mini(current_level, 2) - 1]


func use_coop() -> bool:
	if coop_cd > 0.0:
		return false
	var c := coop()
	if do_coop(c.id):
		coop_cd = c.cd
		return true
	return false


func do_coop(_id: String) -> bool:
	return false


func reveal_radius() -> float:
	return 8.0


func detection_mod() -> float:
	return 1.0


func on_robot_alert(_r) -> void:
	pass


func near(p: Vector2, d: float) -> bool:
	return pos.distance_to(p) < d


func say(text: String, t: float = 1.2) -> void:
	bubble = {"text": text, "t": t}


func place_at(p: Vector2) -> void:
	pos = p
	_prev = p


func robots() -> Array:
	return get_tree().get_nodes_in_group("robots") if is_inside_tree() else game.robots


func nearest_robot(from: Vector2, max_d: float) -> Robot:
	var best: Robot = null
	var bd := max_d
	for r in game.robots:
		if r.active() and from.distance_to(r.pos) < bd:
			bd = from.distance_to(r.pos)
			best = r
	return best


func strongest_robot(max_d: float) -> Robot:
	var best: Robot = null
	for r in game.robots:
		if not r.active() or game.player.pos.distance_to(r.pos) > max_d:
			continue
		if best == null or r.max_hp > best.max_hp or (r.max_hp == best.max_hp and r.hp > best.hp):
			best = r
	return best


# ---------------------------------------------------------------
# Rörelse: följ Signe, utför uppdrag (gräva, hämta) och handlingar
# ---------------------------------------------------------------
func tick(dt: float) -> void:
	coop_cd = maxf(0.0, coop_cd - dt)
	if not bubble.is_empty():
		bubble.t -= dt
		if bubble.t <= 0.0:
			bubble = {}
	if not action.is_empty():
		action.t -= dt
		if action.has("update"):
			action.update.call(dt)
		if not action.is_empty() and action.t <= 0.0:
			var a := action
			action = {}
			if a.has("done"):
				a.done.call()
		return
	think(dt)
	var p: Vector2 = game.player.pos
	var target: Vector2
	var sp := speed
	if not task.is_empty():
		target = task.pos
		task.timeout -= dt
		if pos.distance_to(target) < 0.3:
			var tk := task
			task = {}
			if tk.has("on_arrive"):
				tk.on_arrive.call()
			return
		elif task.timeout <= 0.0:
			task = {}
		sp *= 1.3
	else:
		var back: float = game.player.face + PI
		target = p + Vector2.from_angle(back) * 1.25 + Vector2.from_angle(back + PI / 2) * 0.4
	var d := pos.distance_to(target)
	moving = d > 0.4
	if d > 13.75:
		place_at(p + Vector2(-0.6, 0.25))
		game.add_fx({"type": "puff", "pos": pos})
	elif moving:
		var k := minf(1.0, (d - 0.25) / 1.9)
		var v := (target - pos) / d * sp * (0.4 + k * 0.9) * dt
		var res: Array = game.world.move_body(pos, v, 0.19, 0.12, true, kind == "owl")
		pos = res[0]
		if res[1] and d > 3.75:
			pos += v # fastnat: smyg igenom


func think(_dt: float) -> void:
	pass


func sync(dt: float, active: bool) -> void:
	position = Vector3(pos.x, game.height_at(pos.x, pos.y), pos.y)
	var mv := pos.distance_to(_prev)
	if mv > 0.003:
		_yaw = SV.yaw_from_angle((pos - _prev).angle())
	elif active and not moving:
		_yaw = SV.yaw_from_angle((game.player.pos - pos).angle())
	_prev = pos
	model.rotation.y = lerp_angle(model.rotation.y, _yaw, minf(1.0, dt * 10.0))
	var sc: float = LEVEL_SCALE[current_level - 1] * 1.35
	model.scale = model.scale.lerp(Vector3.ONE * sc, minf(1.0, dt * 3.0))
	model.animate({"dt": dt, "moving": moving or mv > 0.02, "z": z, "level": current_level, "flying": kind == "owl" and active})
	if current_level == 3 and randf() < dt * 8.0:
		game.fx.emit_mote(position + Vector3(randf_range(-0.4, 0.4), randf_range(0.3, 1.1), randf_range(-0.4, 0.4)), Color("#ffe27a"))
