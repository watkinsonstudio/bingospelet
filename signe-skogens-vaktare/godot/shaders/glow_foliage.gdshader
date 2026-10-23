// Lysande delar av vegetationen (knoppar, svamphattar, tickor, runor).
shader_type spatial;
render_mode unshaded, cull_back;

uniform float sway_amount = 0.0;
uniform float energy = 1.8;
global uniform float wind;
global uniform vec2 cut_pos;
global uniform float cut_z;
global uniform float cut_r;
global uniform float cut_aspect;

void vertex() {
	vec3 ip = MODEL_MATRIX[3].xyz;
	float hgt = max(0.0, VERTEX.y - 0.3);
	float ph = TIME * (1.1 + wind) + ip.x * 0.6 + ip.z * 0.45;
	VERTEX.x += sin(ph) * hgt * sway_amount * (0.4 + wind);
	VERTEX.z += cos(ph * 0.8) * hgt * sway_amount * 0.6 * (0.4 + wind);
}

void fragment() {
	if (cut_r > 0.0 && -VERTEX.z < cut_z - 1.2) {
		vec2 uv = FRAGCOORD.xy / VIEWPORT_SIZE;
		float d = length((uv - cut_pos) * vec2(cut_aspect, 1.0));
		if (d < cut_r * 0.7) discard;
	}
	float pulse = 0.85 + 0.15 * sin(TIME * 2.0 + MODEL_MATRIX[3].x * 1.3 + MODEL_MATRIX[3].z);
	ALBEDO = COLOR.rgb * energy * pulse;
}
