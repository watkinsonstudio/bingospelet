## GameUI – HUD, förmågefält, minikarta, notiser, dialoger och menyer
## (titel, Skogsboken med kompisar/karta/galleri/kontroller/testläge,
## Smedjan, seger och bekräftelse). Byggs i kod med ett eget tema.
## Allt går att styra med mus, tangentbord och handkontroll.
class_name GameUI
extends CanvasLayer

const F_REG := preload("res://fonts/Nunito-400.woff2")
const F_BOLD := preload("res://fonts/Nunito-800.woff2")
const F_DISPLAY := preload("res://fonts/Fondamento.woff2")
const INK := Color("#070b26")
const PANEL := Color(0.05, 0.07, 0.22, 0.82)
const LINE := Color(0.5, 0.95, 1.0, 0.22)
const TEXT := Color("#eef4ff")
const MUTED := Color("#a9b4d8")
const CYAN := Color("#7ff3ff")
const LIME := Color("#c8ff6a")
const MAGENTA := Color("#ff6ae8")
const GOLD := Color("#ffd27a")
const STORM := Color("#c8b0ff")

var game
var root: Control
var hud: Control
var overlay: Control
var dialog_open := false
var minimap_dirty := true
var _mini_t := 0.0
var _toast_t := 0.0
var _banner_t := 0.0
var _last := {}

# HUD-delar
var energy_box: HBoxContainer
var arrow_box: HBoxContainer
var shield_lbl: Label
var comp_name: Label
var comp_level: Label
var comp_xp: ProgressBar
var storm_state: Label
var storm_bar: ProgressBar
var res_lbl: Label
var minimap_rect: TextureRect
var minimap_img: Image
var minimap_tex: ImageTexture
var minimap_dots: Control
## HUD-kartan visar ett utsnitt runt Signe; Skogsbokens karta visar hela skogen.
var minimap_atlas: AtlasTexture
const MINI_VIEW := Vector2(36, 48)
var sector_lbl: Label
var slots := {}
var hint_lbl: RichTextLabel
var toast_panel: PanelContainer
var toast_lbl: Label
var banner_box: VBoxContainer
var banner_sub: Label
var banner_title: Label
var dialog_panel: PanelContainer
var dialog_text: RichTextLabel

# paneler
var title_panel: Control
var menu_panel: Control
var menu_tabs: TabContainer
var forge_panel: Control
var forge_tabs: TabContainer
var forge_res: Label
var win_panel: Control
var win_text: Label
var confirm_panel: Control
var confirm_text: Label
var _confirm_yes: Callable
var continue_btn: Button
var sound_btn: Button

# 3D-förhandsvisningar
var portrait_vp: SubViewport
var portrait_pivot: Node3D
var gallery_vp: SubViewport
var gallery_pivot: Node3D
var forge_vp: SubViewport
var forge_pivot: Node3D
var forge_signe: SigneModel
var gallery_idx := 0
var gallery_lvl := 1
var _gallery_info: RichTextLabel


func setup(g) -> void:
	game = g
	layer = 10
	root = Control.new()
	root.set_anchors_preset(Control.PRESET_FULL_RECT)
	root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	root.theme = _make_theme()
	add_child(root)
	overlay = Control.new()
	overlay.set_anchors_preset(Control.PRESET_FULL_RECT)
	overlay.mouse_filter = Control.MOUSE_FILTER_IGNORE
	overlay.draw.connect(_draw_overlay)
	root.add_child(overlay)
	_build_hud()
	_build_title()
	_build_menu()
	_build_forge()
	_build_win()
	_build_confirm()
	Controls.device_changed.connect(func(_d: String) -> void: refresh_prompts())
	refresh_prompts()


# ---------------------------------------------------------------
# Tema
# ---------------------------------------------------------------
func _box(bg: Color, border: Color = LINE, radius: int = 14, pad: int = 12) -> StyleBoxFlat:
	var s := StyleBoxFlat.new()
	s.bg_color = bg
	s.border_color = border
	s.set_border_width_all(1)
	s.set_corner_radius_all(radius)
	s.set_content_margin_all(pad)
	s.shadow_color = Color(0, 0, 0, 0.3)
	s.shadow_size = 6
	return s


func _make_theme() -> Theme:
	var t := Theme.new()
	t.default_font = F_REG
	t.default_font_size = 17
	t.set_color("font_color", "Label", TEXT)
	t.set_color("default_color", "RichTextLabel", TEXT)
	t.set_font("bold_font", "RichTextLabel", F_BOLD)
	t.set_font("font", "Button", F_BOLD)
	t.set_font_size("font_size", "Button", 16)
	t.set_color("font_color", "Button", TEXT)
	t.set_color("font_hover_color", "Button", TEXT)
	t.set_color("font_focus_color", "Button", TEXT)
	t.set_color("font_pressed_color", "Button", TEXT)
	t.set_color("font_disabled_color", "Button", Color(MUTED, 0.5))
	t.set_stylebox("normal", "Button", _box(Color(0.5, 0.95, 1.0, 0.08), LINE, 10, 10))
	t.set_stylebox("hover", "Button", _box(Color(0.5, 0.95, 1.0, 0.18), Color(0.5, 0.95, 1.0, 0.5), 10, 10))
	t.set_stylebox("pressed", "Button", _box(Color(0.5, 0.95, 1.0, 0.25), CYAN, 10, 10))
	t.set_stylebox("disabled", "Button", _box(Color(1, 1, 1, 0.03), Color(1, 1, 1, 0.08), 10, 10))
	var focus := _box(Color(0, 0, 0, 0), GOLD, 10, 10)
	focus.set_border_width_all(2)
	focus.shadow_size = 0
	t.set_stylebox("focus", "Button", focus)
	t.set_stylebox("panel", "PanelContainer", _box(PANEL))
	t.set_stylebox("panel", "TabContainer", StyleBoxEmpty.new())
	t.set_font("font", "TabContainer", F_BOLD)
	t.set_font_size("font_size", "TabContainer", 14)
	t.set_color("font_selected_color", "TabContainer", TEXT)
	t.set_color("font_unselected_color", "TabContainer", MUTED)
	t.set_color("font_hovered_color", "TabContainer", TEXT)
	var tab_sel := StyleBoxFlat.new()
	tab_sel.bg_color = Color(0, 0, 0, 0)
	tab_sel.border_color = LIME
	tab_sel.border_width_bottom = 2
	tab_sel.set_content_margin_all(10)
	var tab_un := tab_sel.duplicate() as StyleBoxFlat
	tab_un.border_color = Color(1, 1, 1, 0.1)
	t.set_stylebox("tab_selected", "TabContainer", tab_sel)
	t.set_stylebox("tab_unselected", "TabContainer", tab_un)
	t.set_stylebox("tab_hovered", "TabContainer", tab_un)
	t.set_stylebox("tab_focus", "TabContainer", focus)
	var bg := StyleBoxFlat.new()
	bg.bg_color = Color(1, 1, 1, 0.1)
	bg.set_corner_radius_all(3)
	var fill := StyleBoxFlat.new()
	fill.bg_color = LIME
	fill.set_corner_radius_all(3)
	t.set_stylebox("background", "ProgressBar", bg)
	t.set_stylebox("fill", "ProgressBar", fill)
	t.set_constant("separation", "VBoxContainer", 8)
	t.set_constant("separation", "HBoxContainer", 10)
	return t


func _label(text: String, size: int = 17, color: Color = TEXT, font: Font = null) -> Label:
	var l := Label.new()
	l.text = text
	l.add_theme_font_size_override("font_size", size)
	l.add_theme_color_override("font_color", color)
	if font:
		l.add_theme_font_override("font", font)
	l.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return l


func _eyebrow(text: String, color: Color = LIME) -> Label:
	var l := _label(text, 12, color, F_BOLD)
	return l


func _rich(text: String, size: int = 16) -> RichTextLabel:
	var r := RichTextLabel.new()
	r.bbcode_enabled = true
	r.fit_content = true
	r.scroll_active = false
	r.text = text
	r.add_theme_font_size_override("normal_font_size", size)
	r.add_theme_font_size_override("bold_font_size", size)
	r.add_theme_color_override("default_color", MUTED)
	r.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return r


func _glass(pad: int = 12) -> PanelContainer:
	var p := PanelContainer.new()
	p.add_theme_stylebox_override("panel", _box(PANEL, LINE, 14, pad))
	p.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return p


func _bar(color: Color, w: float, h: float = 7.0) -> ProgressBar:
	var b := ProgressBar.new()
	b.show_percentage = false
	b.custom_minimum_size = Vector2(w, h)
	var fill := StyleBoxFlat.new()
	fill.bg_color = color
	fill.set_corner_radius_all(3)
	b.add_theme_stylebox_override("fill", fill)
	b.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return b


func _button(text: String, cb: Callable, primary: bool = false) -> Button:
	var b := Button.new()
	b.text = text
	b.pressed.connect(func() -> void:
		Sfx.play("ui")
		cb.call())
	if primary:
		b.add_theme_stylebox_override("normal", _box(LIME, Color(0, 0, 0, 0), 10, 10))
		b.add_theme_stylebox_override("hover", _box(LIME.lightened(0.2), Color(0, 0, 0, 0), 10, 10))
		b.add_theme_color_override("font_color", Color("#0a1a08"))
		b.add_theme_color_override("font_hover_color", Color("#0a1a08"))
		b.add_theme_color_override("font_focus_color", Color("#0a1a08"))
	return b


func _center_panel(w: float) -> Array:
	var shade := ColorRect.new()
	shade.color = Color(0.015, 0.02, 0.08, 0.62)
	shade.set_anchors_preset(Control.PRESET_FULL_RECT)
	shade.visible = false
	root.add_child(shade)
	var center := CenterContainer.new()
	center.set_anchors_preset(Control.PRESET_FULL_RECT)
	shade.add_child(center)
	var p := PanelContainer.new()
	p.add_theme_stylebox_override("panel", _box(Color(0.05, 0.08, 0.25, 0.95), LINE, 20, 24))
	p.custom_minimum_size = Vector2(w, 0)
	center.add_child(p)
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 14)
	p.add_child(v)
	return [shade, v]


# ---------------------------------------------------------------
# HUD
# ---------------------------------------------------------------
func _build_hud() -> void:
	hud = Control.new()
	hud.set_anchors_preset(Control.PRESET_FULL_RECT)
	hud.mouse_filter = Control.MOUSE_FILTER_IGNORE
	root.add_child(hud)

	# uppe till vänster: energi, frostpilar, djurkort
	var tl := VBoxContainer.new()
	tl.position = Vector2(18, 18)
	hud.add_child(tl)
	var vit := _glass(12)
	tl.add_child(vit)
	var vv := VBoxContainer.new()
	vit.add_child(vv)
	var r1 := HBoxContainer.new()
	vv.add_child(r1)
	var l1 := _label("ENERGI", 12, MUTED, F_BOLD)
	l1.custom_minimum_size.x = 92
	r1.add_child(l1)
	energy_box = HBoxContainer.new()
	energy_box.add_theme_constant_override("separation", 5)
	r1.add_child(energy_box)
	shield_lbl = _label("", 13, GOLD, F_BOLD)
	r1.add_child(shield_lbl)
	var r2 := HBoxContainer.new()
	vv.add_child(r2)
	var l2 := _label("FROSTPILAR", 12, MUTED, F_BOLD)
	l2.custom_minimum_size.x = 92
	r2.add_child(l2)
	arrow_box = HBoxContainer.new()
	arrow_box.add_theme_constant_override("separation", 4)
	r2.add_child(arrow_box)

	var card := Button.new()
	card.custom_minimum_size = Vector2(300, 84)
	card.focus_mode = Control.FOCUS_NONE
	card.add_theme_stylebox_override("normal", _box(PANEL, LINE, 14, 8))
	card.add_theme_stylebox_override("hover", _box(PANEL, Color(0.5, 0.95, 1.0, 0.5), 14, 8))
	card.add_theme_stylebox_override("pressed", _box(PANEL, CYAN, 14, 8))
	card.pressed.connect(func() -> void: open_menu("comps"))
	tl.add_child(card)
	var ch := HBoxContainer.new()
	ch.set_anchors_preset(Control.PRESET_FULL_RECT)
	ch.offset_left = 8
	ch.offset_top = 8
	ch.mouse_filter = Control.MOUSE_FILTER_IGNORE
	card.add_child(ch)
	var pc := SubViewportContainer.new()
	pc.custom_minimum_size = Vector2(68, 68)
	pc.stretch = true
	pc.mouse_filter = Control.MOUSE_FILTER_IGNORE
	ch.add_child(pc)
	portrait_vp = _make_preview_viewport(Vector2i(136, 136), 1.6, Vector3(0, 0.55, 0))
	pc.add_child(portrait_vp)
	portrait_pivot = portrait_vp.get_meta("pivot")
	var cv := VBoxContainer.new()
	cv.add_theme_constant_override("separation", 2)
	ch.add_child(cv)
	comp_name = _label("Hunden", 22, TEXT, F_DISPLAY)
	cv.add_child(comp_name)
	comp_level = _label("Nivå 1 · Nyfiken hjälpare", 13, LIME, F_BOLD)
	cv.add_child(comp_level)
	comp_xp = _bar(LIME, 190)
	cv.add_child(comp_xp)

	# uppe i mitten: tidsstormen
	var tc := _glass(10)
	tc.anchor_left = 0.5
	tc.anchor_right = 0.5
	tc.offset_left = -130
	tc.offset_right = 130
	tc.offset_top = 18
	hud.add_child(tc)
	var sv := VBoxContainer.new()
	sv.alignment = BoxContainer.ALIGNMENT_CENTER
	sv.add_theme_constant_override("separation", 3)
	tc.add_child(sv)
	var sl := _label("TIDSSTORMEN", 11, MUTED, F_BOLD)
	sl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	sv.add_child(sl)
	storm_state = _label("Lugnt", 22, STORM, F_DISPLAY)
	storm_state.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	sv.add_child(storm_state)
	storm_bar = _bar(Color("#a98aff"), 230, 6)
	sv.add_child(storm_bar)

	# uppe till höger: resurser, minikarta, meny
	var tr := VBoxContainer.new()
	tr.anchor_left = 1.0
	tr.anchor_right = 1.0
	tr.offset_left = -268
	tr.offset_right = -18
	tr.offset_top = 18
	tr.alignment = BoxContainer.ALIGNMENT_END
	hud.add_child(tr)
	var rp := _glass(10)
	rp.size_flags_horizontal = Control.SIZE_SHRINK_END
	tr.add_child(rp)
	res_lbl = _label("", 16, TEXT, F_BOLD)
	rp.add_child(res_lbl)
	var mp := _glass(8)
	mp.size_flags_horizontal = Control.SIZE_SHRINK_END
	tr.add_child(mp)
	var mv := VBoxContainer.new()
	mv.add_theme_constant_override("separation", 4)
	mp.add_child(mv)
	minimap_img = Image.create(WorldData.W, WorldData.H, false, Image.FORMAT_RGB8)
	minimap_tex = ImageTexture.create_from_image(minimap_img)
	minimap_rect = TextureRect.new()
	minimap_atlas = AtlasTexture.new()
	minimap_atlas.atlas = minimap_tex
	minimap_atlas.region = Rect2(Vector2.ZERO, MINI_VIEW)
	minimap_rect.texture = minimap_atlas
	minimap_rect.custom_minimum_size = Vector2(144, 192)
	minimap_rect.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	minimap_rect.stretch_mode = TextureRect.STRETCH_SCALE
	minimap_rect.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	minimap_rect.mouse_filter = Control.MOUSE_FILTER_IGNORE
	mv.add_child(minimap_rect)
	minimap_dots = Control.new()
	minimap_dots.set_anchors_preset(Control.PRESET_FULL_RECT)
	minimap_dots.mouse_filter = Control.MOUSE_FILTER_IGNORE
	minimap_dots.draw.connect(func() -> void: _draw_map_dots(minimap_dots, false))
	minimap_rect.add_child(minimap_dots)
	sector_lbl = _label("Mossdalen", 16, MUTED, F_DISPLAY)
	sector_lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	mv.add_child(sector_lbl)
	var mb := _button("Meny", func() -> void: open_menu(""))
	mb.focus_mode = Control.FOCUS_NONE
	mb.size_flags_horizontal = Control.SIZE_SHRINK_END
	tr.add_child(mb)

	# nere i mitten: förmågefältet
	var bc := VBoxContainer.new()
	bc.anchor_left = 0.5
	bc.anchor_right = 0.5
	bc.anchor_top = 1.0
	bc.anchor_bottom = 1.0
	bc.offset_left = -310
	bc.offset_right = 310
	bc.offset_top = -132
	bc.offset_bottom = -16
	bc.alignment = BoxContainer.ALIGNMENT_END
	hud.add_child(bc)
	var ab := HBoxContainer.new()
	ab.alignment = BoxContainer.ALIGNMENT_CENTER
	bc.add_child(ab)
	for s in [["staff", "Elhugg", CYAN], ["frost", "Frostpil", Color("#bfe8ff")], ["coop", "Nosa", LIME], ["super", "Sköldskall", GOLD]]:
		var p := _glass(10)
		p.custom_minimum_size = Vector2(146, 0)
		p.add_theme_stylebox_override("panel", _box(PANEL, Color(s[2], 0.45), 14, 10))
		ab.add_child(p)
		var v := VBoxContainer.new()
		v.add_theme_constant_override("separation", 2)
		p.add_child(v)
		var key := _label("", 12, s[2], F_BOLD)
		v.add_child(key)
		var name_l := _label(s[1], 16, TEXT, F_BOLD)
		v.add_child(name_l)
		var sub := _label("", 12, MUTED)
		v.add_child(sub)
		slots[s[0]] = {"panel": p, "key": key, "name": name_l, "sub": sub, "color": s[2]}
	slots.frost.sub.text = "Tre träffar fryser"
	hint_lbl = _rich("", 13)
	hint_lbl.custom_minimum_size = Vector2(620, 0)
	hint_lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	bc.add_child(hint_lbl)

	# notis, banner, dialog
	toast_panel = _glass(12)
	toast_panel.anchor_left = 0.5
	toast_panel.anchor_right = 0.5
	toast_panel.offset_top = 112
	toast_panel.grow_horizontal = Control.GROW_DIRECTION_BOTH
	toast_panel.visible = false
	root.add_child(toast_panel)
	toast_lbl = _label("", 17, TEXT, F_BOLD)
	toast_panel.add_child(toast_lbl)
	banner_box = VBoxContainer.new()
	banner_box.set_anchors_preset(Control.PRESET_CENTER_TOP)
	banner_box.anchor_top = 0.28
	banner_box.grow_horizontal = Control.GROW_DIRECTION_BOTH
	banner_box.mouse_filter = Control.MOUSE_FILTER_IGNORE
	banner_box.modulate.a = 0.0
	root.add_child(banner_box)
	banner_sub = _label("SEKTOR", 14, LIME, F_BOLD)
	banner_sub.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	banner_box.add_child(banner_sub)
	banner_title = _label("Mossdalen", 64, TEXT, F_DISPLAY)
	banner_title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	banner_title.add_theme_constant_override("outline_size", 10)
	banner_title.add_theme_color_override("font_outline_color", Color(0.15, 0.02, 0.2, 0.7))
	banner_box.add_child(banner_title)
	dialog_panel = _glass(16)
	dialog_panel.anchor_left = 0.5
	dialog_panel.anchor_right = 0.5
	dialog_panel.anchor_top = 1.0
	dialog_panel.anchor_bottom = 1.0
	dialog_panel.offset_left = -330
	dialog_panel.offset_right = 330
	dialog_panel.offset_bottom = -160
	dialog_panel.grow_vertical = Control.GROW_DIRECTION_BEGIN
	dialog_panel.visible = false
	dialog_panel.mouse_filter = Control.MOUSE_FILTER_STOP
	dialog_panel.gui_input.connect(func(e: InputEvent) -> void:
		if e is InputEventMouseButton and e.pressed:
			close_dialog())
	root.add_child(dialog_panel)
	dialog_text = _rich("", 18)
	dialog_text.add_theme_color_override("default_color", TEXT)
	dialog_panel.add_child(dialog_text)


func _make_preview_viewport(size: Vector2i, dist: float, look: Vector3) -> SubViewport:
	var vp := SubViewport.new()
	vp.size = size
	vp.own_world_3d = true
	vp.transparent_bg = true
	vp.msaa_3d = Viewport.MSAA_4X
	var w := WorldEnvironment.new()
	var e := Environment.new()
	e.background_mode = Environment.BG_CLEAR_COLOR
	e.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	e.ambient_light_color = Color("#bfd8ff")
	e.ambient_light_energy = 0.75
	e.tonemap_mode = Environment.TONE_MAPPER_ACES
	w.environment = e
	vp.add_child(w)
	var key := DirectionalLight3D.new()
	key.rotation = Vector3(-0.7, 0.5, 0)
	key.light_energy = 1.25
	vp.add_child(key)
	var rim := DirectionalLight3D.new()
	rim.rotation = Vector3(-0.3, PI + 0.6, 0)
	rim.light_color = CYAN
	rim.light_energy = 1.2
	vp.add_child(rim)
	var cam := Camera3D.new()
	cam.fov = 30
	vp.add_child(cam)
	cam.position = look + Vector3(0, dist * 0.18, dist)
	cam.rotation.x = -0.18
	var pivot := Node3D.new()
	vp.add_child(pivot)
	vp.set_meta("pivot", pivot)
	vp.set_meta("camera", cam)
	return vp


func _set_preview(pivot: Node3D, model: Node3D) -> void:
	for c in pivot.get_children():
		c.queue_free()
	pivot.add_child(model)


## Skalar och centrerar modellen så att den ryms i förhandsvisningen
## (höjd h, bredd w) med fötterna på y = floor.
func _fit_preview(pivot: Node3D, model: Node3D, h: float, w: float, floor: float) -> void:
	var inv := pivot.global_transform.affine_inverse()
	var box := AABB()
	var first := true
	for n in model.find_children("*", "VisualInstance3D", true, false):
		if not (n as Node3D).is_visible_in_tree():
			continue
		var b: AABB = (inv * (n as VisualInstance3D).global_transform) * (n as VisualInstance3D).get_aabb()
		box = b if first else box.merge(b)
		first = false
	if first or box.size.y <= 0.0:
		return
	var k := minf(h / box.size.y, w / maxf(box.size.x, box.size.z))
	var p := model.position
	model.scale *= k
	model.position = Vector3(-(box.get_center().x - p.x) * k, floor - (box.position.y - p.y) * k, -(box.get_center().z - p.z) * k)


# ---------------------------------------------------------------
# Uppdatering varje bildruta
# ---------------------------------------------------------------
func update(dt: float) -> void:
	hud.visible = game.started
	overlay.queue_redraw()
	if _toast_t > 0.0:
		_toast_t -= dt
		if _toast_t <= 0.0:
			toast_panel.visible = false
	if _banner_t > 0.0:
		_banner_t -= dt
		banner_box.modulate.a = clampf(minf(_banner_t, 2.8 - _banner_t) * 2.0, 0.0, 1.0)
	# en SubViewport är ingen CanvasItem; synligheten avgörs av dess container
	if is_instance_valid(gallery_vp) and (gallery_vp.get_parent() as Control).is_visible_in_tree():
		gallery_pivot.rotation.y += dt * 0.6
	if forge_vp and forge_panel.visible:
		forge_pivot.rotation.y += dt * 0.7
	if portrait_pivot.get_child_count() > 0:
		var m := portrait_pivot.get_child(0)
		if m is CompanionModel:
			m.animate({"dt": dt, "level": 1})
	if not game.started:
		return
	var p: Player = game.player
	var L := _last
	var ekey := "%.1f/%d" % [p.energy, int(p.max_energy())]
	if L.get("energy") != ekey:
		L.energy = ekey
		for c in energy_box.get_children():
			c.queue_free()
		for i in int(p.max_energy() / 2.0):
			var v := clampf(p.energy - i * 2.0, 0.0, 2.0)
			var cell := Panel.new()
			cell.custom_minimum_size = Vector2(18, 18)
			var sb := _box(LIME if v >= 1.5 else (Color("#ffcf5a") if v >= 0.5 else Color(1, 1, 1, 0.08)), Color(LIME, 0.35), 9, 0)
			sb.shadow_color = Color(LIME, 0.5) if v >= 1.5 else Color(0, 0, 0, 0)
			sb.shadow_size = 6 if v >= 1.5 else 0
			cell.add_theme_stylebox_override("panel", sb)
			energy_box.add_child(cell)
	shield_lbl.text = "Sköld ×%d" % p.shield if p.shield > 0 else ""
	var ckey := "%d/%d" % [int(p.coolant), int(p.max_coolant())]
	if L.get("cool") != ckey:
		L.cool = ckey
		for c in arrow_box.get_children():
			c.queue_free()
		for i in int(p.max_coolant()):
			var a := Panel.new()
			a.custom_minimum_size = Vector2(6, 18)
			a.add_theme_stylebox_override("panel", _box(CYAN if i < int(p.coolant) else Color(1, 1, 1, 0.1), Color(0, 0, 0, 0), 3, 0))
			arrow_box.add_child(a)
	res_lbl.text = "⚙ %d    ▣ %d    ◆ %d / %d" % [p.scrap, p.chips, game.crystal_count(), game.CRYSTALS_NEEDED]
	storm_bar.value = game.env.storm_intensity * 100.0
	storm_state.text = game.env.label()
	sector_lbl.text = "Kristallgrotta" if game.in_grotto else game.current_sector.get("name", "")
	var c: Companion = game.companions.active
	if c:
		var key := "%s|%d|%d|%s|%d" % [c.kind, c.current_level, int(c.current_xp), c.is_super_available, int(c.super_meter)]
		if L.get("comp") != key:
			L.comp = key
			comp_name.text = c.companion_name
			comp_level.text = "Nivå %d · %s" % [c.current_level, c.title()]
			var need: float = c.xp_to_next_level[c.current_level - 1]
			comp_xp.value = 100.0 if c.current_level >= 3 else c.current_xp / need * 100.0
			if L.get("portrait") != c.kind:
				L.portrait = c.kind
				_set_preview(portrait_pivot, CompanionModel.new(c.kind))
			slots.coop.name.text = c.coop().name
			slots.super.name.text = c.info().super.name
			slots.super.sub.text = "Låses upp på nivå 3" if c.current_level < 3 else ("Redo!" if c.is_super_available else "%d %%" % int(c.super_meter))
			slots.super.panel.modulate.a = 0.5 if c.current_level < 3 else 1.0
		slots.coop.sub.text = ("%d s" % ceili(c.coop_cd)) if c.coop_cd > 0.0 else "Redo"
		slots.coop.panel.modulate.a = 0.55 if c.coop_cd > 0.0 else 1.0
		var ready_glow: float = 0.5 + sin(game.time * 6.0) * 0.5 if c.is_super_available else 0.0
		slots.super.panel.self_modulate = Color(1, 1, 1).lerp(Color(1.4, 1.25, 0.8), ready_glow)
	slots.staff.sub.text = ("EMP om %d s" % ceili(p.emp_cd)) if p.emp_cd > 0.0 else "Håll in: EMP"
	_mini_t += dt
	if minimap_dirty and _mini_t > 0.25:
		_mini_t = 0.0
		rebuild_minimap()
	var pp: Vector2 = game.player.pos
	var origin := (pp - MINI_VIEW / 2.0).clamp(Vector2.ZERO, Vector2(WorldData.W, WorldData.H) - MINI_VIEW)
	minimap_atlas.region = Rect2(origin.round(), MINI_VIEW)
	minimap_dots.queue_redraw()


func refresh_prompts() -> void:
	for k in slots:
		slots[k].key.text = Controls.label(k)
	var pad := Controls.device == "pad"
	var L := func(a: String) -> String: return "[color=#7ff3ff][b]%s[/b][/color]" % Controls.label(a)
	if pad:
		hint_lbl.text = "[center]Vänster spak går · höger spak siktar · %s byt djur · %s karta · %s meny · håll %s för EMP[/center]" % [L.call("swap"), L.call("map"), L.call("menu"), L.call("staff")]
	else:
		hint_lbl.text = "[center][color=#7ff3ff][b]WASD[/b][/color] gå · musen siktar · %s byt djur · %s karta · %s meny · håll vänsterklick för EMP[/center]" % [L.call("swap"), L.call("map"), L.call("menu")]
	_last.erase("comp")


func rebuild_minimap() -> void:
	minimap_dirty = false
	var w: WorldData = game.world
	for y in WorldData.H:
		for x in WorldData.W:
			var col := w.tile_map_color(x, y) if w.revealed[y * WorldData.W + x] else Color("#0b1030")
			minimap_img.set_pixel(x, y, col)
	minimap_tex.update(minimap_img)


func _draw_map_dots(c: Control, big: bool) -> void:
	if not game.started and not big:
		return
	var w: WorldData = game.world
	var view := Rect2(0, 0, WorldData.W, WorldData.H) if big else minimap_atlas.region
	var sx := c.size.x / view.size.x
	var sy := c.size.y / view.size.y
	var k := 1.8 if big else 1.0
	var to_map := func(p: Vector2) -> Vector2: return Vector2((p.x - view.position.x) * sx, (p.y - view.position.y) * sy)
	var dot := func(p: Vector2, col: Color, r: float) -> void:
		if big or view.grow(1.0).has_point(p):
			c.draw_circle(to_map.call(p), r * k, col)
	var owl2: bool = game.companions.active_kind == "owl" and game.companions.active.current_level >= 2
	var blink := int(game.time * 3.0) % 2 == 0
	for cr in w.crystals:
		if cr.taken or (cr.buried and not owl2):
			continue
		if (owl2 or cr.seen or w.revealed[w.idx(cr.tx, cr.ty)]) and (blink or big):
			dot.call(cr.pos, MAGENTA, 2.6)
	if owl2:
		for ch in w.chests:
			if not ch.open:
				dot.call(ch.pos, GOLD, 2.0)
	dot.call(w.base, Color("#ff9a2a"), 2.6)
	dot.call(w.core.pos, Color("#a98aff"), 3.2)
	for a in w.animals:
		if not a.met and w.revealed[w.idx(floori(a.pos.x), floori(a.pos.y))]:
			dot.call(a.pos, Color("#8fef8a"), 2.2)
	var pp: Vector2 = game.player.pos
	var f: float = game.player.face
	var tip: Vector2 = to_map.call(pp)
	var pts := PackedVector2Array([tip + Vector2.from_angle(f) * 6 * k, tip + Vector2.from_angle(f + 2.5) * 4 * k, tip + Vector2.from_angle(f - 2.5) * 4 * k])
	c.draw_colored_polygon(pts, Color.WHITE)


# Etiketter ovanpå 3D-scenen: robotarnas hälsa, "!", djurens pratbubblor,
# "?" över väntande djur och knappen för att interagera.
func _draw_overlay() -> void:
	if not game.started or game.paused:
		return
	var cam: Camera3D = game.camera
	var font := F_BOLD
	var proj := func(p: Vector2, h: float) -> Variant:
		var v3 := Vector3(p.x, game.height_at(p.x, p.y) + h, p.y)
		if cam.is_position_behind(v3):
			return null
		return cam.unproject_position(v3)
	for r in game.robots:
		if not r.active() or r.pos.distance_to(game.player.pos) > 20.0:
			continue
		var top := 2.4 if r.type == "drone" else (2.0 if r.type == "bear" else 1.2)
		var s = proj.call(r.pos, top)
		if s == null:
			continue
		if r.state == "alert":
			overlay.draw_string_outline(F_DISPLAY, s + Vector2(-6, -18), "!", HORIZONTAL_ALIGNMENT_LEFT, -1, 34, 8, Color(0.1, 0, 0.1))
			overlay.draw_string(F_DISPLAY, s + Vector2(-6, -18), "!", HORIZONTAL_ALIGNMENT_LEFT, -1, 34, Color("#ff5a7a"))
		if r.hp < r.max_hp:
			overlay.draw_rect(Rect2(s + Vector2(-24, 0), Vector2(48, 6)), Color(0.02, 0.03, 0.1, 0.85))
			overlay.draw_rect(Rect2(s + Vector2(-24, 0), Vector2(48.0 * maxf(0.0, r.hp / r.max_hp), 6)), Color("#9fe6ff") if r.frozen > 0.0 else Color("#ff8a7a"))
	for a in game.world.animals:
		if a.met or a.pos.distance_to(game.player.pos) > 16.0:
			continue
		var s2 = proj.call(a.pos, 1.5 + sin(game.time * 3.0) * 0.08)
		if s2 != null:
			overlay.draw_string_outline(F_DISPLAY, s2 + Vector2(-8, 0), "?", HORIZONTAL_ALIGNMENT_LEFT, -1, 36, 8, Color(0.1, 0.05, 0))
			overlay.draw_string(F_DISPLAY, s2 + Vector2(-8, 0), "?", HORIZONTAL_ALIGNMENT_LEFT, -1, 36, GOLD)
	for k in game.companions.unlocked:
		var c: Companion = game.companions.roster[k]
		if c.bubble.is_empty():
			continue
		var s3 = proj.call(c.pos, 1.3 + c.z)
		if s3 == null:
			continue
		var tw := font.get_string_size(c.bubble.text, HORIZONTAL_ALIGNMENT_LEFT, -1, 16).x
		var rect := Rect2(s3 + Vector2(-tw / 2 - 10, -30), Vector2(tw + 20, 28))
		overlay.draw_style_box(_box(Color(0.93, 0.96, 1.0, 0.95), Color(0, 0, 0, 0), 12, 0), rect)
		overlay.draw_string(font, rect.position + Vector2(10, 20), c.bubble.text, HORIZONTAL_ALIGNMENT_LEFT, -1, 16, Color("#10163a"))
	var it: Dictionary = game.interact_target
	if not it.is_empty():
		var s4 = proj.call(it.pos, 2.0)
		if s4 != null:
			var key := Controls.label("interact")
			var kw := font.get_string_size(key, HORIZONTAL_ALIGNMENT_LEFT, -1, 14).x
			var lw := font.get_string_size(it.label, HORIZONTAL_ALIGNMENT_LEFT, -1, 16).x
			var w := kw + lw + 34
			var rect2 := Rect2(s4 + Vector2(-w / 2, -34), Vector2(w, 32))
			overlay.draw_style_box(_box(PANEL, GOLD, 10, 0), rect2)
			overlay.draw_style_box(_box(Color(GOLD, 0.15), Color(GOLD, 0.5), 6, 0), Rect2(rect2.position + Vector2(6, 6), Vector2(kw + 10, 20)))
			overlay.draw_string(font, rect2.position + Vector2(11, 21), key, HORIZONTAL_ALIGNMENT_LEFT, -1, 14, GOLD)
			overlay.draw_string(font, rect2.position + Vector2(kw + 24, 22), it.label, HORIZONTAL_ALIGNMENT_LEFT, -1, 16, TEXT)


# ---------------------------------------------------------------
# Notiser och dialoger
# ---------------------------------------------------------------
func toast(text: String, secs: float = 2.8) -> void:
	toast_lbl.text = text
	toast_panel.visible = true
	toast_panel.reset_size()
	toast_panel.offset_left = -toast_panel.size.x / 2
	toast_panel.offset_right = toast_panel.size.x / 2
	_toast_t = secs


func banner(sub: String, title: String) -> void:
	banner_sub.text = sub
	banner_title.text = title
	_banner_t = 2.8


func dialog(bbcode: String) -> void:
	dialog_text.text = bbcode + "\n[font_size=13][color=#a9b4d8]%s eller klick stänger[/color][/font_size]" % Controls.label("back")
	dialog_panel.visible = true
	dialog_open = true


func close_dialog() -> void:
	dialog_panel.visible = false
	dialog_open = false


func confirm(text: String, on_yes: Callable) -> void:
	confirm_text.text = text
	_confirm_yes = on_yes
	confirm_panel.visible = true
	_focus_first(confirm_panel)


func is_blocking() -> bool:
	return title_panel.visible or menu_panel.visible or forge_panel.visible or win_panel.visible or confirm_panel.visible


func _focus_first(panel: Control) -> void:
	var b := _find_button(panel)
	if b:
		b.call_deferred("grab_focus")


func _find_button(n: Node) -> Control:
	for c in n.get_children():
		if c is Button and c.visible and not c.disabled and c.focus_mode != Control.FOCUS_NONE:
			return c
		var r := _find_button(c)
		if r:
			return r
	return null


func _input(event: InputEvent) -> void:
	var back := event.is_action_pressed("ui_cancel") or event.is_action_pressed("menu")
	if back:
		if confirm_panel.visible:
			confirm_panel.visible = false
		elif forge_panel.visible:
			close_forge()
		elif menu_panel.visible:
			close_menu()
		elif win_panel.visible:
			_close_win()
		elif dialog_open:
			close_dialog()
		elif game.started and event.is_action_pressed("menu"):
			open_menu("")
		else:
			return
		get_viewport().set_input_as_handled()
	elif event.is_action_pressed("map") and game.started and not is_blocking():
		open_menu("map")
		get_viewport().set_input_as_handled()


# ---------------------------------------------------------------
# Titel
# ---------------------------------------------------------------
func _build_title() -> void:
	title_panel = Control.new()
	title_panel.set_anchors_preset(Control.PRESET_FULL_RECT)
	root.add_child(title_panel)
	var grad := Gradient.new()
	grad.set_color(0, Color(0.015, 0.02, 0.08, 0.92))
	grad.set_color(1, Color(0.015, 0.02, 0.08, 0.0))
	var gt := GradientTexture2D.new()
	gt.gradient = grad
	gt.fill_to = Vector2(0.75, 0)
	var bg := TextureRect.new()
	bg.texture = gt
	bg.set_anchors_preset(Control.PRESET_FULL_RECT)
	bg.stretch_mode = TextureRect.STRETCH_SCALE
	bg.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	title_panel.add_child(bg)
	var v := VBoxContainer.new()
	v.anchor_top = 0.5
	v.anchor_bottom = 0.5
	v.offset_left = 120
	v.offset_top = -230
	v.custom_minimum_size = Vector2(620, 0)
	v.add_theme_constant_override("separation", 18)
	title_panel.add_child(v)
	v.add_child(_eyebrow("ETT ÄVENTYR I DEN LYSANDE SKOGEN"))
	var t := RichTextLabel.new()
	t.bbcode_enabled = true
	t.fit_content = true
	t.scroll_active = false
	t.custom_minimum_size = Vector2(640, 0)
	t.add_theme_font_override("normal_font", F_DISPLAY)
	t.add_theme_font_size_override("normal_font_size", 84)
	t.text = "Signe och\n[color=#c8ff6a]Skogens[/color] Väktare"
	v.add_child(t)
	var p := _rich("Tidsstormen laddar upp sig över skogen. Hitta energikristallerna i de dolda grottorna, kortslut vilsna robotar och bli vän med skogens djur. Med åtta kristaller kan du väcka Urkärnan och höja skölden.", 19)
	p.add_theme_color_override("default_color", TEXT)
	p.custom_minimum_size = Vector2(560, 0)
	v.add_child(p)
	var row := HBoxContainer.new()
	v.add_child(row)
	row.add_child(_button("Starta äventyret", func() -> void:
		if FileAccess.file_exists(game.SAVE_PATH):
			confirm("Starta ett nytt äventyr? Din sparade skog skrivs över.", func() -> void: game.new_game())
		else:
			game.start_game({}), true))
	continue_btn = _button("Fortsätt", func() -> void: game.start_game(game.load_save()))
	row.add_child(continue_btn)
	row.add_child(_button("Avsluta", func() -> void: get_tree().quit()))
	var hint := _rich("[color=#a9b4d8]Tangentbord och mus, eller handkontroll (Xbox/PlayStation).\nWASD går · musen siktar · vänsterklick elhugg · högerklick frostpil · E interagera[/color]", 14)
	v.add_child(hint)


func show_title(has_save: bool) -> void:
	title_panel.visible = true
	continue_btn.visible = has_save
	_focus_first(title_panel)


func hide_title() -> void:
	title_panel.visible = false
	get_viewport().gui_release_focus()


# ---------------------------------------------------------------
# Skogsboken (pausmeny)
# ---------------------------------------------------------------
func _build_menu() -> void:
	var a := _center_panel(1000)
	menu_panel = a[0]
	var v: VBoxContainer = a[1]
	var head := HBoxContainer.new()
	v.add_child(head)
	var hv := VBoxContainer.new()
	hv.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	hv.add_theme_constant_override("separation", 0)
	head.add_child(hv)
	hv.add_child(_eyebrow("PAUS"))
	hv.add_child(_label("Skogsboken", 38, TEXT, F_DISPLAY))
	head.add_child(_button("Fortsätt spela", close_menu, true))
	menu_tabs = TabContainer.new()
	menu_tabs.custom_minimum_size = Vector2(950, 520)
	menu_tabs.tab_changed.connect(func(_i: int) -> void: _fill_menu_tab())
	v.add_child(menu_tabs)
	for t in [["comps", "KOMPISAR"], ["map", "KARTA"], ["gallery", "GALLERI"], ["help", "KONTROLLER"], ["test", "TESTLÄGE"]]:
		var sc := ScrollContainer.new()
		sc.name = t[1]
		sc.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
		sc.set_meta("id", t[0])
		menu_tabs.add_child(sc)
	var row := HBoxContainer.new()
	v.add_child(row)
	sound_btn = _button("Ljud: på", func() -> void:
		Sfx.set_muted(not Sfx.muted)
		sound_btn.text = "Ljud: " + ("av" if Sfx.muted else "på"))
	row.add_child(sound_btn)
	var fs := _button("Helskärm", func() -> void:
		var full := DisplayServer.window_get_mode() == DisplayServer.WINDOW_MODE_FULLSCREEN
		DisplayServer.window_set_mode(DisplayServer.WINDOW_MODE_WINDOWED if full else DisplayServer.WINDOW_MODE_FULLSCREEN))
	row.add_child(fs)
	row.add_child(_button("Återvänd till Skogsbasen", func() -> void:
		close_menu()
		game.return_to_base("Signe tar genvägen hem till Skogsbasen.")))
	row.add_child(_button("Nytt spel", func() -> void:
		confirm("Börja om från början? Allt du samlat försvinner.", func() -> void:
			close_menu()
			game.new_game())))
	row.add_child(_button("Spara och avsluta", func() -> void:
		game.save_game()
		get_tree().quit()))


func open_menu(tab: String) -> void:
	game.set_paused(true)
	menu_panel.visible = true
	if tab != "":
		for i in menu_tabs.get_child_count():
			if menu_tabs.get_child(i).get_meta("id") == tab:
				menu_tabs.current_tab = i
	_fill_menu_tab()
	_focus_first(menu_panel)


func close_menu() -> void:
	menu_panel.visible = false
	game.set_paused(false)
	get_viewport().gui_release_focus()


func _fill_menu_tab() -> void:
	var sc: ScrollContainer = menu_tabs.get_current_tab_control()
	for c in sc.get_children():
		c.queue_free()
	var v := VBoxContainer.new()
	v.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	v.add_theme_constant_override("separation", 12)
	sc.add_child(v)
	match sc.get_meta("id"):
		"comps":
			_fill_comps(v)
		"map":
			_fill_map(v)
		"gallery":
			_fill_gallery(v)
		"help":
			_fill_help(v)
		"test":
			_fill_test(v)


func _fill_comps(v: VBoxContainer) -> void:
	v.add_child(_rich("Ett djur i taget följer med Signe. De andra väntar vid lägerelden i Skogsbasen. Djuren får erfarenhet när ni utforskar, löser hinder och kortsluter robotar tillsammans."))
	var grid := GridContainer.new()
	grid.columns = 3
	grid.add_theme_constant_override("h_separation", 12)
	grid.add_theme_constant_override("v_separation", 12)
	v.add_child(grid)
	var cm: CompanionManager = game.companions
	for k in CompanionManager.ORDER:
		var info: Dictionary = Companion.INFO[k]
		var p := PanelContainer.new()
		p.custom_minimum_size = Vector2(300, 0)
		p.add_theme_stylebox_override("panel", _box(Color(1, 1, 1, 0.04), LIME if cm.active_kind == k else LINE, 14, 12))
		grid.add_child(p)
		var cv := VBoxContainer.new()
		cv.add_theme_constant_override("separation", 6)
		p.add_child(cv)
		if not cm.unlocked.has(k):
			cv.add_child(_label("Okänd vän", 22, MUTED, F_DISPLAY))
			cv.add_child(_label(info.trait, 13, MUTED))
			cv.add_child(_rich("Någonstans i skogen väntar ett djur på att bli din vän.", 14))
			continue
		var c: Companion = cm.roster[k]
		cv.add_child(_label(info.name, 24, TEXT, F_DISPLAY))
		cv.add_child(_eyebrow("NIVÅ %d · %s" % [c.current_level, c.title().to_upper()]))
		var b := _bar(LIME, 260, 6)
		var need: float = c.xp_to_next_level[c.current_level - 1]
		b.value = 100.0 if c.current_level >= 3 else c.current_xp / need * 100.0
		cv.add_child(b)
		var lv := ""
		for i in 3:
			lv += ("[color=#eef4ff]" if i < c.current_level else "[color=#6a7498]") + "%d. %s[/color]\n" % [i + 1, info.levels[i]]
		cv.add_child(_rich(lv, 13))
		cv.add_child(_rich("[b]Samarbete:[/b] %s. %s" % [c.coop().name, c.coop().desc], 13))
		cv.add_child(_rich("[color=#ffd27a][b]Superattack %s:[/b][/color] %s" % [info.super.name, info.super.desc], 13))
		if cm.active_kind == k:
			cv.add_child(_eyebrow("FÖLJER MED"))
		else:
			cv.add_child(_button("Ta med " + info.name.to_lower(), func() -> void:
				cm.set_active(k)
				_fill_menu_tab()
				_focus_first(menu_panel)))


func _fill_map(v: VBoxContainer) -> void:
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 24)
	v.add_child(row)
	var tr := TextureRect.new()
	tr.texture = minimap_tex
	tr.custom_minimum_size = Vector2(336, 448)
	tr.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	tr.stretch_mode = TextureRect.STRETCH_SCALE
	tr.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	row.add_child(tr)
	var dots := Control.new()
	dots.set_anchors_preset(Control.PRESET_FULL_RECT)
	dots.draw.connect(func() -> void: _draw_map_dots(dots, true))
	tr.add_child(dots)
	var side := VBoxContainer.new()
	side.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	row.add_child(side)
	side.add_child(_eyebrow("TECKENFÖRKLARING"))
	side.add_child(_rich("[color=#ffffff]▲[/color] Signe\n[color=#ff9a2a]●[/color] Skogsbasen och smedjan\n[color=#a98aff]●[/color] Urkärnan\n[color=#ff6ae8]●[/color] Energikristall\n[color=#8fef8a]●[/color] Djur som väntar\n[color=#ffd27a]●[/color] Kista (Ugglan nivå 2)", 16))
	var taken := 0
	for c in game.world.crystals:
		if c.taken:
			taken += 1
	side.add_child(_rich("%d av 12 kristaller hittade. %d behövs för att väcka Urkärnan längst i norr. Kristallerna ligger oftast i grottor med en smal öppning.\n\nUtforskat: %d %% av skogen." % [taken, game.CRYSTALS_NEEDED, roundi(game.world.revealed_fraction() * 100)], 16))


const GALLERY := [
	{"key": "signe", "name": "Signe", "sub": "SKOGENS VÄKTARE", "text": "Nioårig alvkrigare i heltäckande bladrustning. Väktarbågens bladkanter laddas med el i närstrid, och pilarna är fyllda med flytande kväve som fryser robotarnas hydraulik."},
	{"key": "dog"}, {"key": "lynx"}, {"key": "owl"}, {"key": "moose"}, {"key": "fox"}, {"key": "beaver"},
	{"key": "robot:bear", "name": "Björnrobot", "sub": "TUNG NÄRSTRID", "text": "Trög men kraftfull. Laddar upp ett hydrauliskt slag framför sig. Frys den och gör sedan ett elhugg, så tar den 50 % mer skada."},
	{"key": "robot:drone", "name": "Svävardrönare", "sub": "AVSTÅND OCH SPANING", "text": "Söker av skogen med strålkastare och skjuter elbollar på avstånd. Skygga drönare flyr från neonfärgad rustning."},
	{"key": "robot:hound", "name": "Mekanisk varg", "sub": "SNABB FLOCK", "text": "Patrullerar i flock och gör snabba utfall. Kamouflagerustning gör det lättare att smyga förbi."},
]


func _fill_gallery(v: VBoxContainer) -> void:
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 24)
	v.add_child(row)
	var vc := SubViewportContainer.new()
	vc.custom_minimum_size = Vector2(440, 440)
	vc.stretch = true
	row.add_child(vc)
	gallery_vp = _make_preview_viewport(Vector2i(440, 440), 4.2, Vector3(0, 0.8, 0))
	vc.add_child(gallery_vp)
	gallery_pivot = gallery_vp.get_meta("pivot")
	var side := VBoxContainer.new()
	side.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	row.add_child(side)
	var item: Dictionary = GALLERY[gallery_idx]
	var model: Node3D
	var nm: String
	var sub: String
	var text: String
	if item.key == "signe":
		model = SigneModel.new(game.player.armor)
		model.scale = Vector3.ONE * 1.6
		nm = item.name
		sub = item.sub
		text = item.text
	elif item.key.begins_with("robot:"):
		var t: String = item.key.substr(6)
		model = RobotModel.new(t)
		model.animate({"dt": 0.016})
		if t == "drone":
			model.position.y = -1.0
		elif t == "hound":
			model.scale = Vector3.ONE * 1.6
		nm = item.name
		sub = item.sub
		text = item.text
	else:
		var info: Dictionary = Companion.INFO[item.key]
		var cmod := CompanionModel.new(item.key)
		cmod.scale = Vector3.ONE * Companion.LEVEL_SCALE[gallery_lvl - 1] * 2.0
		cmod.animate({"dt": 0.016, "level": gallery_lvl})
		model = cmod
		nm = info.name
		sub = info.trait.to_upper()
		text = "%s. %s Superattack: %s." % [info.focus, info.levels[gallery_lvl - 1], info.super.name]
	_set_preview(gallery_pivot, model)
	var grow := 0.8 + 0.1 * gallery_lvl if item.key in Companion.INFO else 1.0
	_fit_preview(gallery_pivot, model, 1.6 * grow, 2.0 * grow, -0.25)
	side.add_child(_eyebrow(sub))
	side.add_child(_label(nm, 40, TEXT, F_DISPLAY))
	var desc := _rich(text, 16)
	desc.custom_minimum_size = Vector2(420, 0)
	side.add_child(desc)
	if not item.key.begins_with("robot:") and item.key != "signe":
		var lv := HBoxContainer.new()
		side.add_child(lv)
		for l in [1, 2, 3]:
			lv.add_child(_button("Nivå %d" % l, func() -> void:
				gallery_lvl = l
				_fill_menu_tab(), l == gallery_lvl))
	var nav := HBoxContainer.new()
	side.add_child(nav)
	nav.add_child(_button("Föregående", func() -> void:
		gallery_idx = (gallery_idx + GALLERY.size() - 1) % GALLERY.size()
		_fill_menu_tab()))
	nav.add_child(_button("Nästa", func() -> void:
		gallery_idx = (gallery_idx + 1) % GALLERY.size()
		_fill_menu_tab()))
	side.add_child(_label("%d / %d" % [gallery_idx + 1, GALLERY.size()], 13, MUTED))


func _fill_help(v: VBoxContainer) -> void:
	var grid := GridContainer.new()
	grid.columns = 3
	grid.add_theme_constant_override("h_separation", 28)
	grid.add_theme_constant_override("v_separation", 6)
	v.add_child(grid)
	for h in ["HANDLING", "TANGENTBORD OCH MUS", "HANDKONTROLL"]:
		grid.add_child(_eyebrow(h))
	for r in [["Gå", "WASD / piltangenter", "Vänster spak"], ["Sikta", "Musen", "Höger spak"], ["Elhugg (håll in: EMP)", "Vänsterklick / J", "X / □"], ["Frostpil", "Högerklick / mellanslag / K", "RT / R2"], ["Samarbete", "Q", "LB / L1 (eller LT / L2)"], ["Superattack", "F", "RB / R1"], ["Interagera", "E", "A / ✕"], ["Byt djur", "Tab", "Y / △"], ["Karta", "M", "Back / Share"], ["Meny", "Esc", "Start / Options"], ["Zooma", "Mushjulet, + och −", "Tryck in spakarna"]]:
		grid.add_child(_label(r[0], 16, MUTED))
		grid.add_child(_label(r[1], 16, TEXT, F_BOLD))
		grid.add_child(_label(r[2], 16, TEXT, F_BOLD))
	v.add_child(_rich("[b]Väktarbågen:[/b] elhugget slår med bågens bladkanter. Håll in en stund och släpp för en EMP-pulsvåg som slår ut robotarnas motorer runt dig.\n[b]Frostpilar:[/b] tre träffar fryser en robot helt. En frusen robot tar 50 % mer skada av elhugg.\n[b]Tidsstormen:[/b] ingen klocka tickar. Stormen laddas upp när ni utforskar nya delar av skogen, och varje energikristall pressar tillbaka den. Ju högre storm, desto snabbare och vaksammare robotar.\n[b]Smedjan[/b] i Skogsbasen byter rustningens färger och uppgraderar utrustningen. Kamouflage gör dig svårare att upptäcka, neon lockar robotar men skrämmer drönare, grafit isolerar mot elstötar.\n[b]Ingen fara:[/b] tar energin slut går Signe tillbaka till Skogsbasen och behåller allt hon samlat.", 15))


func _fill_test(v: VBoxContainer) -> void:
	v.add_child(_rich("Verktyg för att prova mekaniken i prototypen."))
	var lbl := _eyebrow("STORM_INTENSITY: %.2f" % game.env.storm_intensity)
	v.add_child(lbl)
	var slider := HSlider.new()
	slider.min_value = 0
	slider.max_value = 1
	slider.step = 0.01
	slider.value = game.env.storm_intensity
	slider.custom_minimum_size = Vector2(500, 24)
	slider.value_changed.connect(func(val: float) -> void:
		game.env.storm_intensity = val
		game.env.visual = val
		lbl.text = "STORM_INTENSITY: %.2f" % val)
	v.add_child(slider)
	var log := _eyebrow("")
	var grid := GridContainer.new()
	grid.columns = 3
	v.add_child(grid)
	grid.add_child(_button("Testa Sköldskall mot 4 robotar", func() -> void:
		var res: String = game.test_shield_bark()
		close_menu()
		toast(res, 4.0)))
	grid.add_child(_button("Lås upp alla djur", func() -> void:
		for k in CompanionManager.ORDER:
			game.companions.unlock(k, false)
		for a in game.world.animals:
			a.met = true
		log.text = "ALLA DJUR VÄNTAR VID LÄGERELDEN."))
	grid.add_child(_button("Aktivt djur till nivå 3", func() -> void:
		var c: Companion = game.companions.active
		while c.current_level < 3:
			c.add_xp(c.xp_to_next_level[c.current_level - 1])
		log.text = c.companion_name.to_upper() + " ÄR NU NIVÅ 3."))
	grid.add_child(_button("+50 skrot, +10 kretsar", func() -> void:
		game.player.scrap += 50
		game.player.chips += 10
		log.text = "RESURSER TILLAGDA."))
	grid.add_child(_button("+1 kristall", func() -> void:
		for c in game.world.crystals:
			if not c.taken:
				game.take_crystal(c)
				break
		log.text = "KRISTALL TILLAGD."))
	grid.add_child(_button("Lyft all dimma", func() -> void:
		game.world.reveal(Vector2(48, 64), 200)
		game.fog_dirty = true
		rebuild_minimap()
		log.text = "DIMMAN ÄR BORTA."))
	grid.add_child(_button("Gå till en kristallgrotta", func() -> void:
		var g: Dictionary = game.world.grottos[0]
		game.player.pos = Vector2(g.x + 0.5 + cos(g.open) * (g.r - 1), g.y + 0.5 + sin(g.open) * (g.r - 1))
		game.player.face = g.open + PI
		game.snap_camera()
		close_menu()))
	v.add_child(log)


# ---------------------------------------------------------------
# Smedjan
# ---------------------------------------------------------------
func _build_forge() -> void:
	var a := _center_panel(1000)
	forge_panel = a[0]
	var v: VBoxContainer = a[1]
	var head := HBoxContainer.new()
	v.add_child(head)
	var hv := VBoxContainer.new()
	hv.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	hv.add_theme_constant_override("separation", 0)
	head.add_child(hv)
	hv.add_child(_eyebrow("SKOGSBASEN"))
	hv.add_child(_label("Smedjan", 38, TEXT, F_DISPLAY))
	forge_res = _label("", 16, TEXT, F_BOLD)
	head.add_child(forge_res)
	head.add_child(_button("Klar", close_forge, true))
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 22)
	v.add_child(row)
	var pv := VBoxContainer.new()
	row.add_child(pv)
	var vc := SubViewportContainer.new()
	vc.custom_minimum_size = Vector2(260, 340)
	vc.stretch = true
	pv.add_child(vc)
	forge_vp = _make_preview_viewport(Vector2i(260, 340), 6.2, Vector3(0, 1.3, 0))
	vc.add_child(forge_vp)
	forge_pivot = forge_vp.get_meta("pivot")
	var style_box := PanelContainer.new()
	style_box.name = "Style"
	style_box.custom_minimum_size = Vector2(260, 0)
	style_box.add_theme_stylebox_override("panel", _box(Color(1, 1, 1, 0.05), LINE, 12, 10))
	pv.add_child(style_box)
	var sv := VBoxContainer.new()
	style_box.add_child(sv)
	var st_name := _label("", 20, TEXT, F_DISPLAY)
	st_name.name = "Name"
	sv.add_child(st_name)
	var st_eff := _rich("", 14)
	st_eff.name = "Effect"
	st_eff.custom_minimum_size = Vector2(236, 0)
	sv.add_child(st_eff)
	forge_tabs = TabContainer.new()
	forge_tabs.custom_minimum_size = Vector2(660, 520)
	forge_tabs.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	forge_tabs.tab_changed.connect(func(_i: int) -> void: _fill_forge())
	row.add_child(forge_tabs)
	for t in ["RUSTNING", "VAPEN & UTRUSTNING"]:
		var sc := ScrollContainer.new()
		sc.name = t
		sc.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
		forge_tabs.add_child(sc)
	forge_panel.set_meta("style_name", st_name)
	forge_panel.set_meta("style_eff", st_eff)


func open_forge() -> void:
	game.set_paused(true)
	forge_panel.visible = true
	forge_signe = SigneModel.new(game.player.armor)
	forge_signe.scale = Vector3.ONE * 1.6
	_set_preview(forge_pivot, forge_signe)
	_fill_forge()
	_focus_first(forge_panel)


func close_forge() -> void:
	forge_panel.visible = false
	game.set_paused(false)
	game.save_game()
	get_viewport().gui_release_focus()


func _update_style() -> void:
	var p: Player = game.player
	(forge_panel.get_meta("style_name") as Label).text = p.style.name
	(forge_panel.get_meta("style_name") as Label).add_theme_color_override("font_color", LIME if p.style.id == "camo" else (MAGENTA if p.style.id == "neon" else (Color("#c8d0e0") if p.style.id == "graphite" else TEXT)))
	(forge_panel.get_meta("style_eff") as RichTextLabel).text = p.style.effect
	forge_res.text = "⚙ %d skrot    ▣ %d kretsar" % [p.scrap, p.chips]
	if forge_signe:
		forge_signe.apply_armor(p.armor)


func _fill_forge() -> void:
	if not forge_panel.visible or game.player == null:
		return
	var sc: ScrollContainer = forge_tabs.get_current_tab_control()
	for c in sc.get_children():
		c.queue_free()
	var v := VBoxContainer.new()
	v.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	v.add_theme_constant_override("separation", 12)
	sc.add_child(v)
	_update_style()
	var p: Player = game.player
	if forge_tabs.current_tab == 0:
		v.add_child(_label("Förvalda paletter", 18, TEXT, F_BOLD))
		var grid := GridContainer.new()
		grid.columns = 3
		grid.add_theme_constant_override("h_separation", 8)
		grid.add_theme_constant_override("v_separation", 8)
		v.add_child(grid)
		for pal in ForgeData.PALETTES:
			var owned: bool = p.unlocked_palettes.has(pal.id)
			var equipped: bool = pal.helmet == p.armor.helmet and pal.chest == p.armor.chest and pal.legs == p.armor.legs
			var st := ArmorStyle.classify(pal)
			var b := Button.new()
			b.custom_minimum_size = Vector2(200, 74)
			b.alignment = HORIZONTAL_ALIGNMENT_LEFT
			b.text = "%s\n%s%s" % [pal.name, st.name.to_upper(), " · BÄRS NU" if equipped else ("" if owned else " · %d skrot" % pal.cost)]
			b.add_theme_font_size_override("font_size", 14)
			if equipped:
				b.add_theme_stylebox_override("normal", _box(Color(1, 1, 1, 0.06), LIME, 10, 10))
			var sw := HBoxContainer.new()
			sw.add_theme_constant_override("separation", 3)
			sw.position = Vector2(110, 8)
			sw.mouse_filter = Control.MOUSE_FILTER_IGNORE
			for z in ["helmet", "chest", "legs"]:
				var cr := ColorRect.new()
				cr.color = Color(pal[z])
				cr.custom_minimum_size = Vector2(24, 14)
				cr.mouse_filter = Control.MOUSE_FILTER_IGNORE
				sw.add_child(cr)
			b.add_child(sw)
			b.pressed.connect(func() -> void: _choose_palette(pal))
			grid.add_child(b)
		v.add_child(_label("Fri målarverkstad", 18, TEXT, F_BOLD))
		if p.painter_unlocked:
			for z in [["helmet", "Hjälm"], ["chest", "Bröstplåt"], ["legs", "Ben"]]:
				var row := HBoxContainer.new()
				v.add_child(row)
				var l := _label(z[1], 16)
				l.custom_minimum_size.x = 110
				row.add_child(l)
				var cp := ColorPickerButton.new()
				cp.color = Color(p.armor[z[0]])
				cp.custom_minimum_size = Vector2(120, 34)
				cp.edit_alpha = false
				cp.get_picker().picker_shape = ColorPicker.SHAPE_HSV_WHEEL
				cp.color_changed.connect(func(c: Color) -> void:
					var a := p.armor.duplicate()
					a[z[0]] = "#" + c.to_html(false)
					p.set_armor(a)
					_update_style())
				row.add_child(cp)
		else:
			var row2 := HBoxContainer.new()
			v.add_child(row2)
			var info := _rich("Lås upp ett fritt RGB/HEX-färghjul för hjälm, bröstplåt och ben (%s)." % ForgeData.cost_text(ForgeData.PAINTER_COST), 15)
			info.custom_minimum_size = Vector2(400, 0)
			row2.add_child(info)
			var ub := _button("Lås upp", func() -> void:
				if ForgeData.pay(p, ForgeData.PAINTER_COST):
					p.painter_unlocked = true
					Sfx.play("level")
					_fill_forge())
			ub.disabled = not ForgeData.can_afford(p, ForgeData.PAINTER_COST)
			row2.add_child(ub)
	else:
		for u in ForgeData.UPGRADES:
			var lvl: int = p.stats[u.stat]
			var maxed: bool = lvl >= u.max
			var box := PanelContainer.new()
			box.add_theme_stylebox_override("panel", _box(Color(1, 1, 1, 0.04), LINE, 12, 12))
			v.add_child(box)
			var row3 := HBoxContainer.new()
			box.add_child(row3)
			var cv := VBoxContainer.new()
			cv.size_flags_horizontal = Control.SIZE_EXPAND_FILL
			cv.add_theme_constant_override("separation", 4)
			row3.add_child(cv)
			cv.add_child(_label("%s  %s" % [u.name, "●".repeat(lvl) + "○".repeat(u.max - lvl)], 17, TEXT, F_BOLD))
			cv.add_child(_label(ForgeData.describe(u.stat, p), 14, MUTED))
			var cost: Dictionary = {} if maxed else u.costs[lvl - 1]
			cv.add_child(_label("Max" if maxed else ForgeData.cost_text(cost), 14, CYAN))
			var ub2 := _button("Uppgradera", func() -> void:
				if ForgeData.pay(p, cost):
					p.stats[u.stat] += 1
					if u.stat == "plate":
						p.energy = p.max_energy()
					if u.stat == "cool":
						p.coolant = p.max_coolant()
					Sfx.play("level")
					_fill_forge()
					_focus_first(forge_panel))
			ub2.disabled = maxed or not ForgeData.can_afford(p, cost)
			row3.add_child(ub2)
		v.add_child(_rich("Kortslutna robotar tappar skrot och ibland kretsar. Skrothögar i Järnforsen ger lite extra om du ger dem ett elhugg.", 14))


func _choose_palette(pal: Dictionary) -> void:
	var p: Player = game.player
	if not p.unlocked_palettes.has(pal.id):
		if not ForgeData.pay(p, {"scrap": pal.cost}):
			Sfx.play("deny")
			return
		p.unlocked_palettes.append(pal.id)
		Sfx.play("level")
	p.set_armor({"helmet": pal.helmet, "chest": pal.chest, "legs": pal.legs})
	_fill_forge()


# ---------------------------------------------------------------
# Seger och bekräftelse
# ---------------------------------------------------------------
func _build_win() -> void:
	var a := _center_panel(640)
	win_panel = a[0]
	var v: VBoxContainer = a[1]
	v.add_child(_eyebrow("URKÄRNAN ÄR VAKEN"))
	var t := _label("Skölden är uppe – skogen är räddad!", 34, TEXT, F_DISPLAY)
	t.autowrap_mode = TextServer.AUTOWRAP_WORD
	v.add_child(t)
	win_text = _label("", 16, MUTED)
	win_text.autowrap_mode = TextServer.AUTOWRAP_WORD
	win_text.custom_minimum_size = Vector2(580, 0)
	v.add_child(win_text)
	v.add_child(_button("Fortsätt utforska", _close_win, true))


func show_win(text: String) -> void:
	win_text.text = text
	win_panel.visible = true
	game.set_paused(true)
	_focus_first(win_panel)


func _close_win() -> void:
	win_panel.visible = false
	game.set_paused(false)
	get_viewport().gui_release_focus()


func _build_confirm() -> void:
	var a := _center_panel(460)
	confirm_panel = a[0]
	var v: VBoxContainer = a[1]
	confirm_text = _label("", 19, TEXT, F_BOLD)
	confirm_text.autowrap_mode = TextServer.AUTOWRAP_WORD
	confirm_text.custom_minimum_size = Vector2(400, 0)
	v.add_child(confirm_text)
	var row := HBoxContainer.new()
	v.add_child(row)
	row.add_child(_button("Ja", func() -> void:
		confirm_panel.visible = false
		_confirm_yes.call()))
	row.add_child(_button("Avbryt", func() -> void: confirm_panel.visible = false))
