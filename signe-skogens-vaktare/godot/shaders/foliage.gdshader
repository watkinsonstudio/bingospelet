// Vertexfärgad vegetation och miljöobjekt. Vajar i vinden (global "wind")
// och skär ut ett ditrat genomsiktshål runt Signe när hon står bakom något.
shader_type spatial;
render_mode cull_back, diffuse_lambert;

uniform float sway_amount = 0.0;
uniform float roughness_v = 0.85;
uniform bool cutout = true;
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
	if (cutout && cut_r > 0.0 && -VERTEX.z < cut_z - 1.2) {
		vec2 uv = FRAGCOORD.xy / VIEWPORT_SIZE;
		float d = length((uv - cut_pos) * vec2(cut_aspect, 1.0));
		if (d < cut_r) {
			float edge = smoothstep(cut_r, cut_r * 0.55, d);
			float bayer = fract(FRAGCOORD.x * 0.5 + FRAGCOORD.y * 0.25 + mod(floor(FRAGCOORD.y), 2.0) * 0.5);
			if (bayer < edge * 0.85 + 0.1) discard;
		}
	}
	ALBEDO = COLOR.rgb;
	ROUGHNESS = roughness_v;
}
