// ArmorColorShader i 3D: samma logik som GDD:ns shader, men per material.
// Varje rustningsdel är "målad" i en målfärg (paint). Ligger paint inom
// tolerance från en målfärg ersätts den med spelarens valda färg.
shader_type spatial;
render_mode cull_back, diffuse_lambert;

uniform vec4 paint : source_color = vec4(0.2, 0.6, 0.4, 1.0);
uniform vec4 target_primary : source_color = vec4(0.2, 0.6, 0.4, 1.0);
uniform vec4 target_secondary : source_color = vec4(0.8, 0.5, 0.2, 1.0);
uniform vec4 target_tertiary : source_color = vec4(0.24, 0.29, 0.48, 1.0);
uniform vec4 new_primary : source_color = vec4(0.18, 0.54, 0.35, 1.0);
uniform vec4 new_secondary : source_color = vec4(0.31, 0.76, 0.48, 1.0);
uniform vec4 new_tertiary : source_color = vec4(0.23, 0.29, 0.42, 1.0);
uniform float shade = 1.0;
uniform float tolerance : hint_range(0.0, 0.5) = 0.1;
uniform float metallic_v = 0.25;
uniform float roughness_v = 0.45;

void fragment() {
	vec3 c = paint.rgb;
	if (distance(paint.rgb, target_primary.rgb) < tolerance) {
		c = new_primary.rgb;
	} else if (distance(paint.rgb, target_secondary.rgb) < tolerance) {
		c = new_secondary.rgb;
	} else if (distance(paint.rgb, target_tertiary.rgb) < tolerance) {
		c = new_tertiary.rgb;
	}
	ALBEDO = c * shade;
	METALLIC = metallic_v;
	ROUGHNESS = roughness_v;
}
