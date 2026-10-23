## Controls (autoload) – tangentbord, mus och handkontroll (Xbox/PlayStation).
## Handlingarna skapas i koden så att de alltid finns, även i en ny export.
## Spellogiken frågar bara efter handlingar (t.ex. "staff"), aldrig efter knappar,
## vilket gör det enkelt att lägga till pekskärm senare.
extends Node

signal device_changed(device: String)

const DEADZONE := 0.2

var device := "kbm" # "kbm" eller "pad"
var pad_name := ""


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	_bind("move_left", [KEY_A, KEY_LEFT], [], [[JOY_AXIS_LEFT_X, -1.0]])
	_bind("move_right", [KEY_D, KEY_RIGHT], [], [[JOY_AXIS_LEFT_X, 1.0]])
	_bind("move_up", [KEY_W, KEY_UP], [], [[JOY_AXIS_LEFT_Y, -1.0]])
	_bind("move_down", [KEY_S, KEY_DOWN], [], [[JOY_AXIS_LEFT_Y, 1.0]])
	_bind("staff", [KEY_J], [JOY_BUTTON_X], [], [MOUSE_BUTTON_LEFT])
	_bind("frost", [KEY_K, KEY_SPACE], [], [[JOY_AXIS_TRIGGER_RIGHT, 1.0]], [MOUSE_BUTTON_RIGHT])
	_bind("coop", [KEY_Q], [JOY_BUTTON_LEFT_SHOULDER], [[JOY_AXIS_TRIGGER_LEFT, 1.0]])
	_bind("super", [KEY_F], [JOY_BUTTON_RIGHT_SHOULDER])
	_bind("interact", [KEY_E], [JOY_BUTTON_A])
	_bind("swap", [KEY_TAB], [JOY_BUTTON_Y])
	_bind("menu", [KEY_ESCAPE, KEY_P], [JOY_BUTTON_START])
	_bind("map", [KEY_M], [JOY_BUTTON_BACK])
	_bind("zoom_in", [KEY_EQUAL, KEY_KP_ADD], [JOY_BUTTON_RIGHT_STICK], [], [MOUSE_BUTTON_WHEEL_UP])
	_bind("zoom_out", [KEY_MINUS, KEY_KP_SUBTRACT], [JOY_BUTTON_LEFT_STICK], [], [MOUSE_BUTTON_WHEEL_DOWN])
	for p in Input.get_connected_joypads():
		pad_name = Input.get_joy_name(p)
	Input.joy_connection_changed.connect(func(id: int, connected: bool) -> void:
		if connected:
			pad_name = Input.get_joy_name(id)
			_set_device("pad"))


func _bind(action: String, keys: Array = [], buttons: Array = [], axes: Array = [], mouse: Array = []) -> void:
	if InputMap.has_action(action):
		InputMap.erase_action(action)
	InputMap.add_action(action, 0.25)
	for k in keys:
		var e := InputEventKey.new()
		e.physical_keycode = k
		InputMap.action_add_event(action, e)
	for b in buttons:
		var e := InputEventJoypadButton.new()
		e.button_index = b
		InputMap.action_add_event(action, e)
	for a in axes:
		var e := InputEventJoypadMotion.new()
		e.axis = a[0]
		e.axis_value = a[1]
		InputMap.action_add_event(action, e)
	for m in mouse:
		var e := InputEventMouseButton.new()
		e.button_index = m
		InputMap.action_add_event(action, e)


func _input(event: InputEvent) -> void:
	if event is InputEventJoypadButton or (event is InputEventJoypadMotion and absf(event.axis_value) > 0.35):
		_set_device("pad")
	elif event is InputEventKey or event is InputEventMouseButton or (event is InputEventMouseMotion and event.relative.length() > 2.0):
		_set_device("kbm")


func _set_device(d: String) -> void:
	if d == device:
		return
	device = d
	device_changed.emit(d)


## Rörelse i skärmriktning (x höger, y ner), -1..1.
func move_vector() -> Vector2:
	return Input.get_vector("move_left", "move_right", "move_up", "move_down")


## Höger spak för siktning, eller nollvektor.
func aim_stick() -> Vector2:
	var v := Vector2(Input.get_joy_axis(0, JOY_AXIS_RIGHT_X), Input.get_joy_axis(0, JOY_AXIS_RIGHT_Y))
	if v.length() < 0.3:
		return Vector2.ZERO
	return v.normalized()


func is_playstation() -> bool:
	return pad_name.to_lower().contains("playstation") or pad_name.to_lower().contains("dualsense") or pad_name.to_lower().contains("dualshock") or pad_name.to_lower().contains("ps4") or pad_name.to_lower().contains("ps5")


## Knappnamn för hjälptexter, beroende på vad spelaren senast rörde.
func label(action: String) -> String:
	if device == "pad":
		var ps := is_playstation()
		var pad := {
			"staff": "□" if ps else "X", "frost": "R2" if ps else "RT", "coop": "L1" if ps else "LB",
			"super": "R1" if ps else "RB", "interact": "✕" if ps else "A", "swap": "△" if ps else "Y",
			"menu": "Options" if ps else "Start", "map": "Share" if ps else "Back", "back": "○" if ps else "B",
		}
		return pad.get(action, "")
	var kbm := {
		"staff": "Vänsterklick", "frost": "Högerklick", "coop": "Q", "super": "F", "interact": "E",
		"swap": "Tab", "menu": "Esc", "map": "M", "back": "Esc",
	}
	return kbm.get(action, "")
