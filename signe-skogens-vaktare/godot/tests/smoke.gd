## Röktest: startar ett nytt spel, spelar med simulerad input (gå, elhugg,
## frostpilar, byta djur, menyer, smedjan) och tar skärmdumpar.
##   godot --path . --rendering-method gl_compatibility res://tests/smoke.tscn -- <utmapp>
extends Node

var game
var out_dir := "user://shots"


func _ready() -> void:
	var args := OS.get_cmdline_user_args()
	if args.size() > 0:
		out_dir = args[0]
	DirAccess.make_dir_recursive_absolute(out_dir)
	Sfx.set_muted(true)
	game = load("res://scenes/main.tscn").instantiate()
	add_child(game)
	await _frames(20)
	await _shot("01_title")
	game.new_game()
	game.ui.close_dialog()
	await _wait(2.5)
	game.ui.close_dialog()
	await _shot("02_base")
	# gå norrut och slåss
	var p0: Vector2 = game.player.pos
	await _hold(["move_up"], 2.0)
	await _hold(["move_up", "move_right"], 1.5)
	print("Signe gick %.1f m (paused=%s)" % [p0.distance_to(game.player.pos), game.paused])
	for i in 6:
		await _tap("staff")
		await _wait(0.25)
		await _tap("frost")
		await _wait(0.25)
	await _tap("coop")
	await _shot("03_explore")
	# strid: ställ robotar framför Signe (siktet följer rörelsen med handkontroll)
	Controls.device = "pad"
	game.player.pos = game.world.spawn + Vector2(0, -12)
	game.snap_camera()
	var p: Vector2 = game.player.pos
	game.player.face = -PI / 2
	for i in 3:
		var r = game._add_robot(["bear", "hound", "drone"][i], p + Vector2.from_angle(-PI / 2 + (i - 1) * 0.5) * (2.2 + i * 0.6))
		r.set_state("chase")
	game.player.energy = 99
	await _wait(0.6)
	for i in 3:
		game.player.face = (game.robots[-3].pos - game.player.pos).angle()
		game.player.fire_frost(game)
		await _wait(0.15)
	game.player.strike(game)
	await _wait(0.12)
	await _shot("04_combat")
	await _wait(2.0)
	# kristallgrotta
	var g: Dictionary = game.world.grottos[0]
	game.player.pos = Vector2(g.x + 0.5, g.y + 1.5)
	game.snap_camera()
	await _wait(2.5)
	await _shot("05_grotto")
	# storm
	game.env.storm_intensity = 1.0
	game.env.visual = 1.0
	game.player.pos = game.world.spawn + Vector2(0, -20)
	game.snap_camera()
	await _wait(1.5)
	await _shot("06_storm")
	game.env.storm_intensity = 0.3
	game.env.visual = 0.3
	# byta djur, menyer, smedjan
	game.companions.unlock("fox", false)
	game.companions.unlock("owl", false)
	await _tap("swap")
	await _wait(0.5)
	game.player.pos = game.world.spawn
	game.snap_camera()
	game.player.scrap = 60
	game.player.chips = 6
	game.ui.open_forge()
	await _wait(0.5)
	await _shot("07_forge")
	game.ui.close_forge()
	game.ui.open_menu("")
	await _wait(0.4)
	await _shot("08_menu")
	game.ui.open_menu("map")
	await _wait(0.4)
	await _shot("09_map")
	# klicka igenom varje flik i Skogsboken och varje knapp i flikarna
	for tab in ["comps", "map", "gallery", "help", "test"]:
		await _press_all_in_tab(tab)
	# bläddra igenom hela galleriet och visa djuren på alla tre nivåer
	for k in game.ui.GALLERY.size():
		for lvl in ["Nivå 1", "Nivå 2", "Nivå 3"]:
			game.ui.open_menu("gallery")
			await _frames(2)
			for b in _buttons(game.ui.menu_tabs.get_current_tab_control()):
				if b.text == lvl:
					b.pressed.emit()
					await _frames(3)
					break
		game.ui.open_menu("gallery")
		await _frames(2)
		await _wait(0.2)
		await _shot("gallery_%02d" % k)
		for b in _buttons(game.ui.menu_tabs.get_current_tab_control()):
			if b.text == "Nästa":
				b.pressed.emit()
				await _frames(3)
				break
	print("galleri: %d figurer visade" % game.ui.GALLERY.size())
	game.ui.close_menu()
	# smedjans båda flikar, alla knappar
	game.player.scrap = 999
	game.player.chips = 99
	for t in 2:
		var n := 999
		var i := 0
		while i < n:
			game.ui.open_forge()
			game.ui.forge_tabs.current_tab = t
			await _frames(2)
			var bs := _buttons(game.ui.forge_tabs.get_current_tab_control())
			n = bs.size()
			if i < n:
				bs[i].pressed.emit()
				await _frames(2)
			i += 1
			if game.ui.forge_panel.visible:
				game.ui.close_forge()
	print("smedjan: alla knappar tryckta")
	game.ui.close_menu()
	game.save_game()
	print("RÖKTEST KLART")
	get_tree().quit()


func _buttons(root: Node) -> Array:
	var out: Array = []
	for c in root.get_children():
		if c is BaseButton and not c.is_queued_for_deletion():
			out.append(c)
		out.append_array(_buttons(c))
	return out


## Öppnar fliken på nytt inför varje knapp eftersom knapparna bygger om fliken.
func _press_all_in_tab(tab: String) -> void:
	var n := 999
	var i := 0
	while i < n:
		game.ui.open_menu(tab)
		await _frames(2)
		var bs := _buttons(game.ui.menu_tabs.get_current_tab_control())
		n = bs.size()
		if i < n:
			print("  %s: %s" % [tab, bs[i].text.replace("\n", " ")])
			bs[i].pressed.emit()
			await _frames(3)
		i += 1
	game.ui.close_dialog()
	print("flik %s: %d knappar tryckta" % [tab, n])


func _frames(n: int) -> void:
	for i in n:
		await get_tree().process_frame


func _wait(s: float) -> void:
	await get_tree().create_timer(s).timeout


func _hold(actions: Array, s: float) -> void:
	for a in actions:
		Input.action_press(a)
	await _wait(s)
	for a in actions:
		Input.action_release(a)


func _tap(a: String) -> void:
	Input.action_press(a)
	await get_tree().process_frame
	await get_tree().process_frame
	Input.action_release(a)


func _shot(name: String) -> void:
	await RenderingServer.frame_post_draw
	var img := get_viewport().get_texture().get_image()
	img.save_png(out_dir.path_join(name + ".png"))
	print("skärmdump: ", name)
