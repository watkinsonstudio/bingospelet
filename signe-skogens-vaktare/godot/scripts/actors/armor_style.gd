## ArmorStyle – rustningens utseende påverkar fiendernas AI (GDD §3):
## Kamouflage (−35 % upptäckt), Neon (lockar robotar, skrämmer drönare),
## Isolerande grafit (halverad elskada) eller Balanserad.
class_name ArmorStyle
extends RefCounted

const STYLES := {
	"camo": {"id": "camo", "name": "Kamouflage", "effect": "Robotarnas upptäcktsradie minskar med 35 %. Lättare att smyga."},
	"neon": {"id": "neon", "name": "Neon", "effect": "Drar till sig robotarnas uppmärksamhet, men skrämmer bort skygga drönare."},
	"graphite": {"id": "graphite", "name": "Isolerande grafit", "effect": "Halverar skadan från robotarnas elektriska motattacker."},
	"balanced": {"id": "balanced", "name": "Balanserad", "effect": "Ingen särskild effekt på robotarna."},
}


static func classify(armor: Dictionary) -> Dictionary:
	var hsl: Array = []
	for z in ["helmet", "chest", "legs"]:
		var c := Color(armor[z])
		hsl.append([c.h * 360.0, _sat(c), _light(c)])
	var avg_s := 0.0
	var avg_l := 0.0
	var bright := 0
	var earthy := 0
	for v in hsl:
		avg_s += v[1] / 3.0
		avg_l += v[2] / 3.0
		if v[1] > 0.7 and v[2] > 0.45 and v[2] < 0.85:
			bright += 1
		if v[0] >= 25 and v[0] <= 160 and v[1] < 0.6 and v[2] < 0.5 and v[2] > 0.12:
			earthy += 1
	if bright >= 2:
		return STYLES.neon
	if avg_l < 0.32 and avg_s < 0.22:
		return STYLES.graphite
	if earthy >= 3 or (earthy >= 2 and avg_s < 0.45):
		return STYLES.camo
	return STYLES.balanced


# HSL-mättnad och ljushet (Godots Color har HSV).
static func _light(c: Color) -> float:
	return (maxf(c.r, maxf(c.g, c.b)) + minf(c.r, minf(c.g, c.b))) / 2.0


static func _sat(c: Color) -> float:
	var mx := maxf(c.r, maxf(c.g, c.b))
	var mn := minf(c.r, minf(c.g, c.b))
	if mx == mn:
		return 0.0
	var l := (mx + mn) / 2.0
	var d := mx - mn
	return d / (2.0 - mx - mn) if l > 0.5 else d / (mx + mn)
