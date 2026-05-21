use wasm_bindgen::prelude::*;

/// Parameter für einen Mandelbrot-Render-Aufruf.
/// Alle Koordinaten beziehen sich auf die komplexe Ebene.
#[wasm_bindgen]
pub struct RenderParams {
    /// X-Koordinate des Viewport-Mittelpunkts (Realteil)
    pub center_x: f64,
    /// Y-Koordinate des Viewport-Mittelpunkts (Imaginärteil)
    pub center_y: f64,
    /// Zoom-Faktor: kleinere Werte = mehr Ausschnitt sichtbar
    pub zoom: f64,
    /// Maximale Iterationstiefe (Default: 256)
    pub max_iter: u32,
}

#[wasm_bindgen]
impl RenderParams {
    #[wasm_bindgen(constructor)]
    pub fn new(center_x: f64, center_y: f64, zoom: f64, max_iter: u32) -> Self {
        Self { center_x, center_y, zoom, max_iter }
    }
}

/// Rendert die Mandelbrot-Menge in einen Pixel-Buffer (RGBA, row-major).
///
/// Gibt einen `Vec<u8>` zurück, den der JS-Caller via `ImageData` auf ein
/// `<canvas>`-Element überträgt. Buffer-Länge = width * height * 4 Bytes.
#[wasm_bindgen]
pub fn render(width: u32, height: u32, params: &RenderParams) -> Vec<u8> {
    let mut buffer = vec![0u8; (width * height * 4) as usize];

    for py in 0..height {
        for px in 0..width {
            // Pixel-Koordinate → Position in der komplexen Ebene
            let cx = params.center_x + (px as f64 - width as f64 / 2.0) / (params.zoom * width as f64 / 4.0);
            let cy = params.center_y + (py as f64 - height as f64 / 2.0) / (params.zoom * height as f64 / 4.0);

            let iter = mandelbrot_iter(cx, cy, params.max_iter);
            let color = iter_to_color(iter, params.max_iter);

            let idx = ((py * width + px) * 4) as usize;
            buffer[idx]     = color.0; // R
            buffer[idx + 1] = color.1; // G
            buffer[idx + 2] = color.2; // B
            buffer[idx + 3] = 255;     // A (volle Deckkraft)
        }
    }

    buffer
}

/// Zählt Iterationen bis zum Entkommen aus dem Betrag-2-Radius.
/// Gibt `max_iter` zurück wenn der Punkt in der Menge liegt.
fn mandelbrot_iter(cx: f64, cy: f64, max_iter: u32) -> u32 {
    let (mut zx, mut zy) = (0.0f64, 0.0f64);
    for i in 0..max_iter {
        let zx2 = zx * zx;
        let zy2 = zy * zy;
        if zx2 + zy2 > 4.0 {
            return i;
        }
        // z = z² + c
        zy = 2.0 * zx * zy + cy;
        zx = zx2 - zy2 + cx;
    }
    max_iter
}

/// Rendert die Julia-Menge in einen Pixel-Buffer (RGBA, row-major).
///
/// Im Gegensatz zu Mandelbrot ist der Parameter `c = cx + i*cy` fest —
/// der Startpunkt `z` variiert pro Pixel.
/// Buffer muss exakt `width * height * 4` Bytes groß sein.
#[wasm_bindgen]
pub fn render_julia(
    buf: &mut [u8],   // RGBA-Pixel-Buffer, vom JS-Caller bereitgestellt
    width: u32,
    height: u32,
    cx: f64,          // Julia-Parameter — Realteil von c
    cy: f64,          // Julia-Parameter — Imaginärteil von c
    center_x: f64,    // Viewport-Mittelpunkt (Realteil)
    center_y: f64,    // Viewport-Mittelpunkt (Imaginärteil)
    zoom: f64,        // Pixel pro Einheit in der komplexen Ebene
    max_iter: u32,
) {
    for py in 0..height {
        for px in 0..width {
            // Pixel → komplexe Koordinate z₀
            let mut zx = center_x + (px as f64 - width  as f64 / 2.0) / zoom;
            let mut zy = center_y + (py as f64 - height as f64 / 2.0) / zoom;

            // Julia-Iteration: z ← z² + c  (c ist fest, z ist der Startpunkt)
            let mut iter = 0u32;
            while iter < max_iter {
                let zx2 = zx * zx;
                let zy2 = zy * zy;
                if zx2 + zy2 > 4.0 {
                    break;
                }
                zy = 2.0 * zx * zy + cy;
                zx = zx2 - zy2 + cx;
                iter += 1;
            }

            let color = iter_to_color(iter, max_iter);
            let idx = ((py * width + px) * 4) as usize;
            buf[idx]     = color.0; // R
            buf[idx + 1] = color.1; // G
            buf[idx + 2] = color.2; // B
            buf[idx + 3] = 255;     // A (volle Deckkraft)
        }
    }
}

/// Mappt Iterationszahl auf RGB-Farbe (einfache Hue-Rotation).
fn iter_to_color(iter: u32, max_iter: u32) -> (u8, u8, u8) {
    if iter == max_iter {
        return (0, 0, 0); // Punkte in der Menge → schwarz
    }
    // Normierter Wert 0.0–1.0
    let t = iter as f64 / max_iter as f64;
    let hue = (t * 360.0) as u32 % 360;
    hue_to_rgb(hue)
}

/// Vereinfachte HSL→RGB-Konvertierung bei S=1, L=0.5.
fn hue_to_rgb(hue: u32) -> (u8, u8, u8) {
    let h = hue % 360;
    let sector = h / 60;
    let f = (h % 60) as f64 / 60.0;
    let q = (255.0 * (1.0 - f)) as u8;
    let t = (255.0 * f) as u8;
    match sector {
        0 => (255, t,   0),
        1 => (q,   255, 0),
        2 => (0,   255, t),
        3 => (0,   q,   255),
        4 => (t,   0,   255),
        _ => (255, 0,   q),
    }
}
