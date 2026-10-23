// Dimslöjor över outforskad mark. fog_map: vitt = utforskat.
shader_type spatial;
render_mode unshaded, cull_disabled, depth_draw_never, shadows_disabled;

uniform sampler2D fog_map : filter_linear;
uniform vec2 map_size = vec2(96.0, 128.0);
uniform vec3 mist_color : source_color = vec3(0.1, 0.16, 0.4);
uniform float strength = 0.6;
varying vec3 wpos;

float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n(vec2 p) {
	vec2 i = floor(p), f = fract(p);
	f = f * f * (3.0 - 2.0 * f);
	return mix(mix(h(i), h(i + vec2(1.0, 0.0)), f.x), mix(h(i + vec2(0.0, 1.0)), h(i + vec2(1.0, 1.0)), f.x), f.y);
}

void vertex() {
	wpos = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
}

void fragment() {
	float rev = texture(fog_map, wpos.xz / map_size).r;
	float m = n(wpos.xz * 0.35 + vec2(TIME * 0.05, TIME * 0.03)) * 0.6 + n(wpos.xz * 0.9 - TIME * 0.07) * 0.4;
	ALBEDO = mist_color * (0.8 + m * 0.6) + vec3(0.25, 0.35, 0.7) * m * 0.25;
	ALPHA = (1.0 - smoothstep(0.15, 0.85, rev)) * (0.55 + m * 0.45) * strength;
}
