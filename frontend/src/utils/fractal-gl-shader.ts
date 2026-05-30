/**
 * GLSL-Shader für die GPU-Fraktal-Renderung (Audit-Befund B-4, PERF_NOTES.md).
 *
 * Hintergrund: Die Fraktale wurden bisher pixelweise in Rust/WASM auf dem
 * Haupt-Thread berechnet (~60 ms/Frame bei Review-Größe → ~15 FPS). Auf der GPU
 * läuft jede Pixel-Iteration massiv parallel → 60 FPS auch bei voller Auflösung.
 *
 * Knackpunkt Präzision: WebGL-1-Shader rechnen mit `float` (32 Bit, ~7 signifikante
 * Dezimalstellen). Beim Tief-Zoom (die Panels gehen bis Zoom 1e9–1e10) reicht das
 * NICHT — ab ~1e5 würden grobe Pixel-Artefakte sichtbar. Lösung: "double-single"-
 * Arithmetik. Eine Zahl wird als Paar `vec2(hi, lo)` dargestellt, ihr Wert ist
 * `hi + lo`. Damit erreichen wir effektiv ~2× die Mantissen-Bits (~1e13 statt 1e7)
 * — genug für den gewünschten Zoom. Die ds_*-Funktionen unten sind die bekannten
 * Dekker/Knuth-Routinen für fehlerkompensierte Addition und Multiplikation.
 *
 * Der Shader rendert Mandelbrot UND Julia (Uniform `uMode`) und repliziert die
 * Färbung des alten WASM-Renderers (Hue-Rotation, HSL bei S=1/L=0.5) plus die
 * Farb-Transforms der FractalScenes-Panels (mono/cold/hot/neon/invert).
 */

// Vertex-Shader: zeichnet nur ein bildschirmfüllendes Rechteck. Die ganze Arbeit
// passiert im Fragment-Shader (ein Aufruf pro Pixel).
export const FRACTAL_VERTEX_SHADER = `
  attribute vec2 position;
  void main() {
    gl_Position = vec4(position, 0.0, 1.0);
  }
`

// Fragment-Shader. WebGL 1 / GLSL ES 1.00.
export const FRACTAL_FRAGMENT_SHADER = `
  precision highp float;

  // ── Uniforms ──────────────────────────────────────────────────────────────
  uniform vec2  uResolution;     // Canvas-Größe in Pixeln
  // Viewport-Mittelpunkt in double-single: getrennt nach hi und lo.
  // uCenterHi.x/uCenterLo.x = Realteil, .y = Imaginärteil.
  uniform vec2  uCenterHi;
  uniform vec2  uCenterLo;
  uniform vec2  uPixelScale;     // komplexe Einheiten pro Pixel (x, y) — Aspekt eingerechnet
  uniform float uAngle;          // Rotation in Radiant
  uniform int   uMaxIter;        // Iterationstiefe
  uniform int   uMode;           // 0 = Mandelbrot, 1 = Julia
  uniform vec2  uJuliaC;         // Julia-Parameter c des primären Fraktals
  uniform vec2  uJuliaC2;        // Julia-Parameter c des Crossfade-Partners
  uniform int   uColorMode;      // 0 base,1 mono,2 cold,3 hot,4 neon,5 invert

  // Crossfade: optional ein zweites Fraktal (andere Location) einblenden.
  uniform float uFade;           // 0 = kein Fade (nur Fraktal 1), sonst Mix-Anteil 0..1
  uniform vec2  uCenter2Hi;
  uniform vec2  uCenter2Lo;
  uniform vec2  uPixelScale2;
  uniform float uAngle2;

  // Maximale Schleifen-Obergrenze. GLSL ES 1.0 erlaubt nur KONSTANTE Schleifen-
  // grenzen, deshalb iterieren wir bis MAX_ITER_CAP und brechen per uMaxIter ab.
  const int MAX_ITER_CAP = 256;

  // ── double-single-Arithmetik ────────────────────────────────────────────────
  // Wert einer Zahl x: x.x + x.y  (hi + lo).

  // Float → double-single (lo = 0)
  vec2 ds_set(float a) { return vec2(a, 0.0); }

  // Fehlerkompensierte Addition (Knuth two-sum)
  vec2 ds_add(vec2 a, vec2 b) {
    float t1 = a.x + b.x;
    float e  = t1 - a.x;
    float t2 = ((b.x - e) + (a.x - (t1 - e))) + a.y + b.y;
    float hi = t1 + t2;
    float lo = t2 - (hi - t1);
    return vec2(hi, lo);
  }

  vec2 ds_sub(vec2 a, vec2 b) { return ds_add(a, vec2(-b.x, -b.y)); }

  // Fehlerkompensierte Multiplikation — kanonische DSFUN90-Form (wie sie in
  // funktionierenden WebGL-Deep-Zoom-Shadern verwendet wird). Split 4097 = 2^12+1
  // halbiert die 24-Bit-float-Mantisse. Die Akkumulations-Reihenfolge (Kreuzterm
  // c2 ZUERST in t1, c21 erst in t2) ist bewusst so — sie übersteht die
  // Compiler-Kontraktion auf ANGLE/Metal besser als die naive Variante.
  vec2 ds_mul(vec2 dsa, vec2 dsb) {
    float split = 4097.0;
    float cona = dsa.x * split;
    float conb = dsb.x * split;
    float a1 = cona - (cona - dsa.x);
    float a2 = dsa.x - a1;
    float b1 = conb - (conb - dsb.x);
    float b2 = dsb.x - b1;

    float c11 = dsa.x * dsb.x;
    float c21 = a2 * b2 + (a2 * b1 + (a1 * b2 + (a1 * b1 - c11)));
    float c2  = dsa.x * dsb.y + dsa.y * dsb.x;

    float t1 = c11 + c2;
    float e  = t1 - c11;
    float t2 = dsa.y * dsb.y + ((c2 - e) + (c11 - t1 + e)) + c21;

    float hi = t1 + t2;
    float lo = t2 - (hi - t1);
    return vec2(hi, lo);
  }

  // ── Farb-Helfer ─────────────────────────────────────────────────────────────
  // Repliziert hue_to_rgb aus wasm/src/lib.rs (HSL bei S=1, L=0.5).
  vec3 hueToRgb(float hue) {
    hue = mod(hue, 360.0);
    float sector = floor(hue / 60.0);
    float f = mod(hue, 60.0) / 60.0;
    float q = 1.0 - f;
    if (sector < 1.0) return vec3(1.0, f,   0.0);
    if (sector < 2.0) return vec3(q,   1.0, 0.0);
    if (sector < 3.0) return vec3(0.0, 1.0, f);
    if (sector < 4.0) return vec3(0.0, q,   1.0);
    if (sector < 5.0) return vec3(f,   0.0, 1.0);
    return vec3(1.0, 0.0, q);
  }

  // Farb-Transforms der FractalScenes-Panels. Repliziert applyTransform() aus
  // FractalScenes.tsx exakt (dort in 0–255, hier normiert 0–1). Wird NUR auf
  // Nicht-Mengen-Pixel angewandt — in-set bleibt schwarz (siehe renderFractal).
  vec3 applyColorMode(vec3 c, int mode) {
    if (mode == 1) {                       // mono: nur Grün-Kanal = Luminanz
      float lum = dot(c, vec3(0.299, 0.587, 0.114));
      return vec3(0.0, lum, 0.0);
    } else if (mode == 2) {                // cold: Blau/Cyan betonen + Dunkel-Boost
      float lum = (c.r + c.g + c.b) / 3.0;
      float boost = max(0.0, 0.156863 - lum);   // 40/255
      return min(vec3(1.0), vec3(
        c.r * 0.1 + boost * 0.3,
        c.g * 0.5 + boost * 0.6,
        c.b * 1.5 + c.r * 0.4 + boost
      ));
    } else if (mode == 3) {                // hot: Rot/Orange
      return min(vec3(1.0), vec3(c.r * 1.5 + c.g * 0.25, c.g * 0.45, c.b * 0.05));
    } else if (mode == 4) {                // neon: Magenta/Violett
      return min(vec3(1.0), vec3(c.r * 1.3, c.g * 0.15, c.b * 1.6));
    } else if (mode == 5) {                // invert
      return vec3(1.0) - c;
    }
    return c;                              // 0 = base (reine Hue-Färbung)
  }

  // ── Iterations-Kern (double-single) ─────────────────────────────────────────
  // Berechnet die Escape-Iteration für komplexes c (cx,cy als ds) und Startwert
  // z0 (z0x,z0y als ds). Mandelbrot: z0=0, c=Pixel. Julia: z0=Pixel, c=uJuliaC.
  int iterate(vec2 cx, vec2 cy, vec2 z0x, vec2 z0y, int maxIter) {
    vec2 zx = z0x;
    vec2 zy = z0y;
    int iter = maxIter;
    for (int i = 0; i < MAX_ITER_CAP; i++) {
      if (i >= maxIter) break;
      vec2 zx2 = ds_mul(zx, zx);
      vec2 zy2 = ds_mul(zy, zy);
      // Betrag² = zx² + zy²; Vergleich über hi-Anteil reicht (>4 = entkommen)
      if (zx2.x + zy2.x > 4.0) { iter = i; break; }
      // z = z² + c
      vec2 two_zx_zy = ds_mul(ds_mul(ds_set(2.0), zx), zy);
      zy = ds_add(two_zx_zy, cy);
      zx = ds_add(ds_sub(zx2, zy2), cx);
    }
    return iter;
  }

  // Rendert EIN Fraktal für den aktuellen Pixel und gibt die fertige Farbe zurück.
  // centerHi/Lo + scale + angle beschreiben den Viewport (für Crossfade variabel).
  vec3 renderFractal(vec2 fragPx, vec2 centerHi, vec2 centerLo, vec2 scale, float angle, vec2 jc) {
    // Pixel → Offset in der komplexen Ebene (klein genug für einfache floats).
    float dx = (fragPx.x - uResolution.x * 0.5) * scale.x;
    float dy = (fragPx.y - uResolution.y * 0.5) * scale.y;

    // Rotation
    float ca = cos(angle);
    float sa = sin(angle);
    float rx = dx * ca - dy * sa;
    float ry = dx * sa + dy * ca;

    // Viewport-Punkt in double-single: center + offset
    vec2 px = ds_add(vec2(centerHi.x, centerLo.x), ds_set(rx));
    vec2 py = ds_add(vec2(centerHi.y, centerLo.y), ds_set(ry));

    int iter;
    if (uMode == 1) {
      // Julia: Startwert = Pixelpunkt, c = übergebener Parameter
      iter = iterate(ds_set(jc.x), ds_set(jc.y), px, py, uMaxIter);
    } else {
      // Mandelbrot: Startwert = 0, c = Pixelpunkt
      iter = iterate(px, py, ds_set(0.0), ds_set(0.0), uMaxIter);
    }
    // In der Menge → schwarz (Color-Transform wird hier NICHT angewandt, genau
    // wie applyTransform() schwarze Pixel überspringt).
    if (iter >= uMaxIter) return vec3(0.0);
    vec3 col = hueToRgb((float(iter) / float(uMaxIter)) * 360.0);
    return applyColorMode(col, uColorMode);
  }

  void main() {
    vec3 col = renderFractal(gl_FragCoord.xy, uCenterHi, uCenterLo, uPixelScale, uAngle, uJuliaC);

    // Crossfade: nur wenn aktiv das zweite Fraktal berechnen (spart Kosten).
    if (uFade > 0.0) {
      vec3 col2 = renderFractal(gl_FragCoord.xy, uCenter2Hi, uCenter2Lo, uPixelScale2, uAngle2, uJuliaC2);
      col = mix(col, col2, uFade);
    }

    gl_FragColor = vec4(col, 1.0);
  }
`
