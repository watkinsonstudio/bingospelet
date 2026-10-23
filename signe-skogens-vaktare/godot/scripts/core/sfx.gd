## Sfx (autoload) – små syntljud som räknas fram vid start (inga ljudfiler).
extends Node

const RATE := 22050

var muted := false
var _sounds := {}
var _players: Array[AudioStreamPlayer] = []
var _next := 0


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	for i in 10:
		var p := AudioStreamPlayer.new()
		p.volume_db = -8.0
		add_child(p)
		_players.append(p)
	_build()


func play(sound: String) -> void:
	if muted or not _sounds.has(sound):
		return
	var p := _players[_next]
	_next = (_next + 1) % _players.size()
	p.stream = _sounds[sound]
	p.play()


func set_muted(m: bool) -> void:
	muted = m


# ---------------------------------------------------------------
# Syntes
# ---------------------------------------------------------------
func _build() -> void:
	_sounds["zap"] = _mix([_tone("square", 1400, 300, 0.09, 0.25), _noise(0.08, 0.3, 0.6)])
	_sounds["charge"] = _mix([_tone("sine", 300, 900, 0.25, 0.2)])
	_sounds["emp"] = _mix([_tone("saw", 200, 40, 0.5, 0.4), _noise(0.4, 0.4, 0.08)])
	_sounds["frost"] = _mix([_noise(0.15, 0.25, 0.9), _tone("sine", 900, 1800, 0.12, 0.2)])
	_sounds["freeze"] = _mix([_tone("triangle", 1800, 2600, 0.2, 0.3), _delay(_tone("triangle", 2400, 3200, 0.2, 0.2), 0.06)])
	_sounds["hit"] = _mix([_noise(0.06, 0.4, 0.35)])
	_sounds["robot_down"] = _mix([_tone("saw", 600, 60, 0.6, 0.3), _delay(_noise(0.3, 0.25, 0.6), 0.1)])
	_sounds["hurt"] = _mix([_tone("square", 220, 110, 0.18, 0.3)])
	_sounds["pickup"] = _mix([_tone("square", 660, 660, 0.05, 0.15), _delay(_tone("square", 990, 990, 0.07, 0.15), 0.05)])
	_sounds["crystal"] = _mix([_arp([523, 659, 784, 1046], 0.08, 0.25, "triangle", 0.25)])
	_sounds["bark"] = _mix([_tone("square", 420, 260, 0.08, 0.3), _delay(_tone("square", 420, 240, 0.09, 0.3), 0.13)])
	_sounds["alert"] = _mix([_tone("square", 880, 1200, 0.08, 0.15)])
	_sounds["level"] = _mix([_arp([392, 523, 659, 784, 1046], 0.07, 0.12, "square", 0.18)])
	_sounds["super"] = _mix([_tone("saw", 120, 900, 0.5, 0.3), _delay(_arp([523, 784, 1046], 0.09, 0.3, "triangle", 0.22), 0.2)])
	_sounds["thunder"] = _mix([_noise(1.2, 0.6, 0.03)])
	_sounds["ui"] = _mix([_tone("square", 740, 740, 0.04, 0.12)])
	_sounds["deny"] = _mix([_tone("square", 200, 160, 0.12, 0.18)])
	_sounds["build"] = _mix([_noise(0.07, 0.4, 0.2), _delay(_noise(0.07, 0.4, 0.2), 0.12), _delay(_noise(0.07, 0.4, 0.2), 0.24)])
	_sounds["win"] = _mix([_arp([523, 659, 784, 1046, 784, 1046, 1318], 0.13, 0.3, "triangle", 0.25)])


func _tone(kind: String, f0: float, f1: float, dur: float, vol: float) -> PackedFloat32Array:
	var n := int(dur * RATE)
	var out := PackedFloat32Array()
	out.resize(n)
	var phase := 0.0
	for i in n:
		var t := float(i) / n
		var f := f0 * pow(f1 / f0, t)
		phase += f / RATE
		var p := fmod(phase, 1.0)
		var s := 0.0
		match kind:
			"square":
				s = 1.0 if p < 0.5 else -1.0
			"saw":
				s = p * 2.0 - 1.0
			"triangle":
				s = 1.0 - absf(p * 4.0 - 2.0)
			_:
				s = sin(phase * TAU)
		out[i] = s * vol * pow(0.001, t)
	return out


# Brus med enkel lågpassfiltrering (k nära 0 = mörkt, 1 = ljust).
func _noise(dur: float, vol: float, k: float) -> PackedFloat32Array:
	var n := int(dur * RATE)
	var out := PackedFloat32Array()
	out.resize(n)
	var y := 0.0
	for i in n:
		var t := float(i) / n
		y += (randf() * 2.0 - 1.0 - y) * k
		out[i] = y * vol * pow(0.001, t)
	return out


func _delay(a: PackedFloat32Array, secs: float) -> PackedFloat32Array:
	var pad := PackedFloat32Array()
	pad.resize(int(secs * RATE))
	pad.append_array(a)
	return pad


func _arp(freqs: Array, step: float, dur: float, kind: String, vol: float) -> PackedFloat32Array:
	var parts: Array = []
	for i in freqs.size():
		parts.append(_delay(_tone(kind, freqs[i], freqs[i], dur, vol), i * step))
	return _sum(parts)


func _sum(parts: Array) -> PackedFloat32Array:
	var n := 0
	for p in parts:
		n = maxi(n, p.size())
	var out := PackedFloat32Array()
	out.resize(n)
	for p in parts:
		for i in p.size():
			out[i] += p[i]
	return out


func _mix(parts: Array) -> AudioStreamWAV:
	var pcm := _sum(parts)
	var n := pcm.size()
	var data := PackedByteArray()
	data.resize(n * 2)
	for i in n:
		data.encode_s16(i * 2, int(clampf(pcm[i], -1.0, 1.0) * 32000.0))
	var w := AudioStreamWAV.new()
	w.format = AudioStreamWAV.FORMAT_16_BITS
	w.mix_rate = RATE
	w.stereo = false
	w.data = data
	return w
