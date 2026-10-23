## ForgeData – Smedjans paletter och uppgraderingar (betalas med skrot och
## kretsar från kortslutna robotar).
class_name ForgeData
extends RefCounted

const PALETTES := [
	{"id": "original", "name": "Väktarens grönska", "helmet": "#2f8a5a", "chest": "#4fc27a", "legs": "#3a4a6a", "cost": 0},
	{"id": "opal", "name": "Opalalv", "helmet": "#c8b0f0", "chest": "#f4e8ff", "legs": "#8a7ac8", "cost": 6},
	{"id": "mossvaktare", "name": "Mossväktare", "helmet": "#4a6b3a", "chest": "#6b5a3a", "legs": "#3b4d2e", "cost": 6},
	{"id": "lavskog", "name": "Lavskog", "helmet": "#76875a", "chest": "#5c6e45", "legs": "#6e5f45", "cost": 6},
	{"id": "norrsken", "name": "Neonnorrsken", "helmet": "#39ff9a", "chest": "#ff3df0", "legs": "#3dd8ff", "cost": 8},
	{"id": "solflamma", "name": "Solflamma", "helmet": "#ffd23d", "chest": "#ff6a3d", "legs": "#ff2d6f", "cost": 8},
	{"id": "grafit", "name": "Grafit", "helmet": "#3a3d44", "chest": "#2b2d33", "legs": "#45474f", "cost": 8},
	{"id": "jarnmalm", "name": "Järnmalm", "helmet": "#4d4a52", "chest": "#3a3340", "legs": "#55505c", "cost": 8},
	{"id": "lingon", "name": "Lingon & björk", "helmet": "#c8324a", "chest": "#efe6d8", "legs": "#5a3a3a", "cost": 6},
	{"id": "fjallsjo", "name": "Fjällsjö", "helmet": "#4d8fd6", "chest": "#e8f2ff", "legs": "#2d4a7a", "cost": 6},
]
const PAINTER_COST := {"scrap": 12}
const UPGRADES := [
	{"stat": "staff", "name": "Väktarbågens elhugg", "max": 5, "costs": [{"scrap": 10}, {"scrap": 18, "chips": 1}, {"scrap": 28, "chips": 3}, {"scrap": 40, "chips": 5}]},
	{"stat": "frost", "name": "Frostpilar", "max": 5, "costs": [{"scrap": 10}, {"scrap": 18, "chips": 1}, {"scrap": 28, "chips": 3}, {"scrap": 40, "chips": 5}]},
	{"stat": "cool", "name": "Pilkoger", "max": 4, "costs": [{"scrap": 8}, {"scrap": 16, "chips": 1}, {"scrap": 26, "chips": 2}]},
	{"stat": "plate", "name": "Rustningsplätering", "max": 4, "costs": [{"scrap": 12}, {"scrap": 24, "chips": 2}, {"scrap": 36, "chips": 4}]},
]


static func describe(stat: String, p: Player) -> String:
	match stat:
		"staff":
			return "Skada %d · EMP-radie %.1f m" % [p.staff_damage(), p.emp_radius()]
		"frost":
			return "Kyla per träff %.1f · Frystid %.1f s" % [p.frost_chill(), p.frost_duration()]
		"cool":
			return "%d frostpilar innan kogret måste fyllas på" % int(p.max_coolant())
	return "%d energiceller" % int(p.max_energy() / 2.0)


static func can_afford(p: Player, cost: Dictionary) -> bool:
	return p.scrap >= cost.get("scrap", 0) and p.chips >= cost.get("chips", 0)


static func pay(p: Player, cost: Dictionary) -> bool:
	if not can_afford(p, cost):
		return false
	p.scrap -= cost.get("scrap", 0)
	p.chips -= cost.get("chips", 0)
	return true


static func cost_text(cost: Dictionary) -> String:
	var parts: Array = []
	if cost.get("scrap", 0):
		parts.append("%d skrot" % cost.scrap)
	if cost.get("chips", 0):
		parts.append("%d kretsar" % cost.chips)
	return " + ".join(parts) if parts.size() else "Gratis"
