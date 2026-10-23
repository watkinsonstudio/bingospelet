# EnvironmentController.gd – GDD §5.2.
# Atmosfären styrs dynamiskt baserat på framstegsvariabeln storm_intensity
# utan tidsbaserad nedräkning. Kristaller pressar tillbaka stormen.
class_name EnvironmentController
extends Node

signal lightning(pos: Vector2)

@export_range(0.0, 1.0) var storm_intensity: float = 0.0:
	set(value):
		storm_intensity = clamp(value, 0.0, 1.0)
		_update_environment()

@export var sky_directional_light: DirectionalLight3D
@export var particle_emitter: GPUParticles3D
@export var world_environment: WorldEnvironment
## Månljusets färg från lugn (0) till tidsstorm (1).
@export var sky_gradient: Gradient
## Dimmans och himlens färg från lugn till storm.
@export var fog_gradient: Gradient

## Det synliga värdet glider mjukt mot storm_intensity (ca 8 s för hela skalan).
var visual := 0.0
var wind := 0.3
var flash := 0.0
var time := 0.0
var grotto := 0.0 # 0..1, sätts av spelet när Signe är i en kristallgrotta
var focus := Vector2.ZERO
var lightning_enabled := true
var _next_lightning := 4.0
var _rain: GPUParticles3D


func _ready() -> void:
	if sky_gradient == null:
		sky_gradient = Gradient.new()
		sky_gradient.set_color(0, Color("#c8e8ff"))
		sky_gradient.set_color(1, Color("#d08aff"))
		sky_gradient.add_point(0.5, Color("#b0a8ff"))
	if fog_gradient == null:
		fog_gradient = Gradient.new()
		fog_gradient.set_color(0, Color("#123072"))
		fog_gradient.set_color(1, Color("#2a0c4a"))
		fog_gradient.add_point(0.4, Color("#1a2a7a"))
		fog_gradient.add_point(0.7, Color("#2a1a6a"))
	_update_environment()


func label() -> String:
	if storm_intensity < 0.25:
		return "Lugnt"
	if storm_intensity < 0.5:
		return "Blåsigt"
	if storm_intensity < 0.75:
		return "Laddat"
	return "Tidsstorm"


func set_rain(r: GPUParticles3D) -> void:
	_rain = r


func _update_environment() -> void:
	var s := visual
	# Justera färgton och ljus baserat på stormens intensitet
	if sky_directional_light and sky_gradient:
		sky_directional_light.light_color = sky_gradient.sample(s)
		sky_directional_light.light_energy = lerp(1.0, 0.55, s) * lerp(1.0, 0.45, grotto) + flash * 2.5

	# Öka partikelmängd (elektriska urladdningar/vind)
	if particle_emitter:
		particle_emitter.amount_ratio = maxf(0.0, (s - 0.45) / 0.55)
		particle_emitter.speed_scale = lerp(0.5, 2.5, s)
	if _rain:
		_rain.amount_ratio = maxf(0.0, (s - 0.3) / 0.7)
		_rain.speed_scale = lerp(0.8, 1.6, s)

	if world_environment and world_environment.environment and fog_gradient:
		var e := world_environment.environment
		var fog := fog_gradient.sample(s).lerp(Color("#3a0a4a"), grotto * 0.6)
		e.background_color = fog
		e.fog_light_color = fog.lightened(0.15)
		e.fog_density = 0.012 + s * 0.012 + grotto * 0.01
		e.ambient_light_color = fog.lightened(0.55).lerp(Color("#bfe0ff"), 0.4)
		e.ambient_light_energy = lerp(1.1, 0.75, s) * lerp(1.0, 0.7, grotto)
		e.glow_intensity = 0.85 + grotto * 0.3 + s * 0.15
		e.adjustment_saturation = 1.12
		e.tonemap_exposure = 1.0 + flash * 0.5
		if e.volumetric_fog_enabled:
			e.volumetric_fog_albedo = fog.lightened(0.3)
			e.volumetric_fog_density = 0.008 + s * 0.012 + grotto * 0.015
	RenderingServer.global_shader_parameter_set("storm", s)
	RenderingServer.global_shader_parameter_set("wind", wind)


func _process(dt: float) -> void:
	time += dt
	visual = SV.approach(visual, storm_intensity, dt * 0.12)
	var s := visual
	wind = lerpf(0.15, 1.6, s) * (0.8 + sin(time * 0.4) * 0.2)
	if lightning_enabled and s > 0.55:
		_next_lightning -= dt
		if _next_lightning <= 0.0:
			_next_lightning = lerpf(9.0, 3.0, (s - 0.55) / 0.45) * randf_range(0.6, 1.4)
			flash = 0.6 + s * 0.4
			var a := randf() * TAU
			var d := randf_range(5.6, 15.6)
			Sfx.play("thunder")
			lightning.emit(focus + Vector2.from_angle(a) * d)
	flash = maxf(0.0, flash - dt * 2.2)
	_update_environment()
