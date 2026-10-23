// Glödande vatten med krusningar och glitter.
shader_type spatial;
render_mode unshaded, cull_disabled, depth_draw_never;

uniform vec3 deep : source_color = vec3(0.04, 0.16, 0.48);
uniform vec3 light : source_color = vec3(0.16, 0.85, 1.0);
varying vec3 wpos;

float h(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5); }

void vertex() {
	wpos = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
}

void fragment() {
	vec2 p = wpos.xz;
	float r = sin(p.x * 2.1 + TIME * 1.3) * sin(p.y * 1.7 - TIME * 1.1) + sin((p.x + p.y) * 3.3 + TIME * 2.0) * 0.5;
	vec3 c = mix(deep, light, smoothstep(0.2, 1.4, r) * 0.55 + 0.12);
	float glint = step(0.985, h(floor(p * 6.0) + floor(TIME * 2.0))) * 2.5;
	c += vec3(0.6, 0.95, 1.0) * glint;
	ALBEDO = c * 1.3;
	ALPHA = 0.8;
}
