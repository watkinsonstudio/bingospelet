## Gemensamma hjälpfunktioner: deterministisk hash och värdebrus för
## världsgenereringen, samt små vinkel- och färghjälpare.
class_name SV
extends RefCounted


## Snabb heltalshash → 0..1 (samma resultat varje gång för samma indata).
static func hash2(x: int, y: int, s: int = 0) -> float:
	var h: int = (x * 374761393 + y * 668265263 + s * 2147483647) & 0xFFFFFFFF
	h = ((h ^ (h >> 13)) * 1274126177) & 0xFFFFFFFF
	h = h ^ (h >> 16)
	return float(h & 0xFFFFFFFF) / 4294967296.0


## Mjukt värdebrus 0..1.
static func noise(x: float, y: float, s: int = 0) -> float:
	var xi := floori(x)
	var yi := floori(y)
	var xf := x - xi
	var yf := y - yi
	var u := xf * xf * (3.0 - 2.0 * xf)
	var v := yf * yf * (3.0 - 2.0 * yf)
	var a := hash2(xi, yi, s)
	var b := hash2(xi + 1, yi, s)
	var c := hash2(xi, yi + 1, s)
	var d := hash2(xi + 1, yi + 1, s)
	return lerpf(lerpf(a, b, u), lerpf(c, d, u), v)


static func fbm(x: float, y: float, s: int = 0) -> float:
	return noise(x, y, s) * 0.6 + noise(x * 2.1, y * 2.1, s + 7) * 0.3 + noise(x * 4.3, y * 4.3, s + 13) * 0.1


static func angle_diff(a: float, b: float) -> float:
	return wrapf(b - a, -PI, PI)


## Vinkel i spelplanet (x, z) → rotation.y för en modell som tittar längs +Z.
static func yaw_from_angle(a: float) -> float:
	return PI / 2.0 - a


static func approach(v: float, target: float, step: float) -> float:
	if v < target:
		return minf(v + step, target)
	return maxf(v - step, target)


static func v3(p: Vector2, y: float = 0.0) -> Vector3:
	return Vector3(p.x, y, p.y)
