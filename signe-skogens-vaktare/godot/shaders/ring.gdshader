// Chockvågsring / aura på en platt QuadMesh.
shader_type spatial;
render_mode unshaded, blend_add, cull_disabled, depth_draw_never, shadows_disabled;

uniform vec3 color : source_color = vec3(0.5, 0.95, 1.0);
uniform float energy = 2.0;
uniform float opacity = 1.0;
uniform float width = 0.08;

void fragment() {
	float d = length(UV - 0.5) * 2.0;
	float ring = smoothstep(1.0, 1.0 - width, d) * smoothstep(1.0 - width * 3.0, 1.0 - width, d);
	ALBEDO = color * energy * ring * opacity;
	ALPHA = ring * opacity;
}
