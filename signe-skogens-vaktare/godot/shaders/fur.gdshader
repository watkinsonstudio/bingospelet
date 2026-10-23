// Fluffig päls med "shell"-teknik. Kroppsdelen ritas som ett MultiMesh där
// varje instans är ett skal längre ut längs normalen (INSTANCE_CUSTOM.r = lager).
// Fragmentet skär ut tunna strån som smalnar mot spetsen.
shader_type spatial;
render_mode cull_back, diffuse_lambert, specular_disabled;

uniform vec3 col_a : source_color = vec3(0.96, 0.94, 0.96);
uniform vec3 col_b : source_color = vec3(0.85, 0.75, 0.94);
uniform vec3 col_c : source_color = vec3(0.66, 0.94, 0.88);
uniform float fur_length = 0.07;
uniform vec2 density = vec2(110.0, 60.0);
uniform float pattern = 3.0;
uniform float shimmer = 0.6;
uniform float gravity = 0.4;
uniform float glow = 0.0;
global uniform float wind;

varying float layer;
varying vec3 obj;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p) {
	vec2 i = floor(p), f = fract(p);
	f = f * f * (3.0 - 2.0 * f);
	return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}

void vertex() {
	layer = INSTANCE_CUSTOM.r;
	obj = VERTEX;
	VERTEX += NORMAL * fur_length * layer;
	float k = layer * layer;
	vec3 gw = vec3(sin(TIME * 2.3 + VERTEX.z * 3.0) * wind * 0.6, -gravity, 0.0) * k * fur_length;
	VERTEX += (inverse(MODEL_MATRIX) * vec4(gw, 0.0)).xyz;
}

void fragment() {
	vec2 cell = UV * density;
	vec2 id = floor(cell);
	vec2 f = fract(cell) - 0.5;
	float r = hash(id);
	float len = 0.45 + 0.55 * r;
	if (layer > len) discard;
	float thick = (1.0 - layer / len) * 0.8;
	vec2 off = vec2(hash(id + 3.1), hash(id + 7.7)) - 0.5;
	if (layer > 0.04 && length(f + off * 0.35) > thick) discard;
	float n = vnoise(obj.xy * pattern + obj.z * 1.7);
	vec3 col = mix(col_a, col_b, smoothstep(0.5, 0.85, n));
	float fres = pow(1.0 - clamp(dot(NORMAL, VIEW), 0.0, 1.0), 2.0);
	col = mix(col, col_c, (fres * 0.6 + layer * 0.35) * shimmer);
	col *= mix(0.72, 1.08, layer / len);
	ALBEDO = col * 0.82;
	ROUGHNESS = 0.95;
	RIM = 0.4;
	RIM_TINT = 0.6;
	// pastellerna ska förbli ljusa i skogens blå nattljus utan att fräta ut
	EMISSION = col * (0.05 + glow) + col_c * fres * 0.1;
}
