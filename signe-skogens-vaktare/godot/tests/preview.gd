## Renderar en testbild av modellerna (används vid utveckling):
## godot --path . --rendering-method gl_compatibility --script res://tests/preview.gd -- out.png
extends SceneTree

func _initialize() -> void:
	var args := OS.get_cmdline_user_args()
	var out: String = args[0] if args.size() > 0 else "user://preview.png"
	var root3d := Node3D.new()
	get_root().add_child(root3d)
	var env := WorldEnvironment.new()
	var e := Environment.new()
	e.background_mode = Environment.BG_COLOR
	e.background_color = Color("#141c4a")
	e.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	e.ambient_light_color = Color("#8ab0ff")
	e.ambient_light_energy = 0.6
	e.tonemap_mode = Environment.TONE_MAPPER_ACES
	e.glow_enabled = true
	env.environment = e
	root3d.add_child(env)
	var sun := DirectionalLight3D.new()
	sun.rotation = Vector3(-0.9, 0.6, 0)
	sun.light_energy = 1.4
	root3d.add_child(sun)
	var cam := Camera3D.new()
	root3d.add_child(cam)
	cam.look_at_from_position(Vector3(3.0, 3.0, 8.5), Vector3(3.0, 0.7, 0.5))
	var signe := SigneModel.new({"helmet": "#2f8a5a", "chest": "#4fc27a", "legs": "#3a4a6a"})
	signe.scale = Vector3.ONE * 1.6
	signe.rotation.y = 0.4
	root3d.add_child(signe)
	var signe2 := SigneModel.new({"helmet": "#39ff9a", "chest": "#ff3df0", "legs": "#3dd8ff"})
	signe2.position.x = 1.4
	signe2.scale = Vector3.ONE * 1.6
	signe2.rotation.y = PI + 0.3
	root3d.add_child(signe2)
	var kits := Props.build_kits()
	var x := 3.2
	for k in ["tree_blue", "mushroom", "rock", "cave_wall", "tree_frost", "ruin", "bush"]:
		var m := MeshInstance3D.new()
		m.mesh = kits[k][0]
		m.position = Vector3(x, 0, -1.5)
		root3d.add_child(m)
		x += 1.6
	var cx := -2.4
	for k in ["dog", "lynx", "owl", "moose", "fox", "beaver"]:
		var c := CompanionModel.new(k)
		c.position = Vector3(cx, 0, 2.2)
		c.scale = Vector3.ONE * 1.35
		c.rotation.y = 0.5
		c.animate({"dt": 0.016, "level": 3 if k == "moose" else 1})
		root3d.add_child(c)
		cx += 1.0
	var rx := 4.6
	for k in ["bear", "hound", "drone"]:
		var r := RobotModel.new(k)
		r.position = Vector3(rx, 0 if k != "drone" else -0.6, 2.0)
		r.rotation.y = -0.6
		r.animate({"dt": 0.016, "beam": false})
		root3d.add_child(r)
		rx += 1.8
	var cr := Props.crystal()
	cr.position = Vector3(5, 0, 1.5)
	root3d.add_child(cr)
	for i in 6:
		await process_frame
	await RenderingServer.frame_post_draw
	var img := get_root().get_texture().get_image()
	img.save_png(out)
	print("sparade ", out)
	quit()
