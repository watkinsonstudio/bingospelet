// ArmorColorShader.gdshader – exakt enligt speldesigndokumentet (§5.3).
// Byter ut färgpaletter på Signes sprite-ark baserat på valda RGB-värden i UI:t.
// Används i 2D (t.ex. porträtt); 3D-modellen använder armor_color_3d.gdshader.
shader_type canvas_item;

// Ursprungliga färger på spriten som ska ersättas
uniform vec4 target_primary : source_color = vec4(0.2, 0.6, 0.4, 1.0);
uniform vec4 target_secondary : source_color = vec4(0.8, 0.5, 0.2, 1.0);

// Nya färger valda av spelaren
uniform vec4 new_primary : source_color;
uniform vec4 new_secondary : source_color;
uniform float tolerance : hint_range(0.0, 0.5) = 0.1;

void fragment() {
	vec4 tex_color = texture(TEXTURE, UV);

	// Beräkna avstånd mellan nuvarande pixel och målfärger
	float dist_primary = distance(tex_color.rgb, target_primary.rgb);
	float dist_secondary = distance(tex_color.rgb, target_secondary.rgb);

	if (dist_primary < tolerance) {
		COLOR = vec4(new_primary.rgb, tex_color.a);
	} else if (dist_secondary < tolerance) {
		COLOR = vec4(new_secondary.rgb, tex_color.a);
	} else {
		COLOR = tex_color;
	}
}
