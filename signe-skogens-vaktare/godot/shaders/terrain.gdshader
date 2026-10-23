// Markens höjdfält: vertexfärg i RGB, glöd i A (stigar, grottgolv).
shader_type spatial;
render_mode cull_disabled, diffuse_lambert;

void fragment() {
	ALBEDO = COLOR.rgb;
	ROUGHNESS = 0.95;
	SPECULAR = 0.2;
	EMISSION = COLOR.rgb * COLOR.a * 2.0;
}
