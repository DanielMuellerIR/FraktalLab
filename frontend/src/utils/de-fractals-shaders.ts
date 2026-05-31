// ── Distance Estimator Raymarching Shaders ────────────────────────────────────
// Used for Cluster 2: Mandelbulb, Apollonian Gasket, Menger Sponge, VoxelMatrix, and NeuralLink

export const MANDELBULB_SHADER = `
  precision highp float;

  // Per-mount hue rotation (uHueShift uniform) for a random start color.
  vec3 hueShift(vec3 c, float a){ vec3 k=vec3(0.57735); float ca=cos(a); return c*ca + cross(k,c)*sin(a) + k*dot(k,c)*(1.0-ca); }

  // Animate power over time
  float getPower() {
    return 7.0 + 3.0 * sin(iTime * 0.15);
  }

  float de(vec3 p) {
    vec3 z = p;
    float dr = 1.0;
    float r = 0.0;
    float power = getPower();
    
    for (int i = 0; i < 6; i++) {
      r = length(z);
      if (r > 2.0) break;
      
      // Convert to polar coordinates
      float theta = acos(z.y / r);
      float phi = atan(z.x, z.z);
      dr = pow(r, power - 1.0) * power * dr + 1.0;
      
      // Scale and rotate potential
      float zr = pow(r, power);
      theta = theta * power;
      phi = phi * power;
      
      // Convert back to cartesian coordinates
      z = zr * vec3(sin(theta) * sin(phi), cos(theta), sin(theta) * cos(phi));
      z += p;
    }
    return 0.5 * log(r) * r / dr;
  }

  vec3 getNormal(vec3 p) {
    vec2 e = vec2(0.001, 0.0);
    return normalize(vec3(
      de(p + e.xyy) - de(p - e.xyy),
      de(p + e.yxy) - de(p - e.yxy),
      de(p + e.yyx) - de(p - e.yyx)
    ));
  }

  void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
    float time = iTime * 0.12;
    
    // Slow orbiting camera
    vec3 ro = vec3(2.4 * sin(time), 1.2 * cos(time * 0.7), 2.4 * cos(time));
    vec3 ta = vec3(0.0, 0.0, 0.0);
    
    vec3 ww = normalize(ta - ro);
    vec3 uu = normalize(cross(ww, vec3(0.0, 1.0, 0.0)));
    vec3 vv = cross(uu, ww);
    vec3 rd = normalize(uv.x * uu + uv.y * vv + 1.2 * ww);
    
    float d = 0.0;
    float maxD = 6.0;
    float steps = 0.0;
    float glow = 0.0;
    
    for (int i = 0; i < 80; i++) {
      vec3 p = ro + rd * d;
      float dist = de(p);
      glow += exp(-dist * 12.0) * 0.06;
      if (dist < 0.001 || d > maxD) break;
      d += dist * 0.85;
      steps += 1.0;
    }
    
    vec3 col = vec3(0.0);
    
    if (d < maxD) {
      vec3 p = ro + rd * d;
      vec3 normal = getNormal(p);
      vec3 lightDir = normalize(vec3(1.5 * sin(time * 2.0), 2.0, 1.5 * cos(time * 2.0)));
      
      // Procedural color based on hit position
      vec3 matCol = mix(vec3(0.85, 0.15, 0.45), vec3(0.98, 0.82, 0.12), sin(length(p) * 4.0) * 0.5 + 0.5);
      
      float diff = max(0.0, dot(normal, lightDir));
      float ao = clamp(1.0 - steps / 80.0, 0.0, 1.0);
      col = matCol * (0.2 + 0.8 * diff) * ao;
      
      // Specular highlight
      vec3 halfV = normalize(lightDir - rd);
      col += vec3(pow(max(0.0, dot(normal, halfV)), 16.0) * 0.4 * ao);
    }
    
    // Add neon vapor glow
    vec3 glowCol = mix(vec3(0.12, 0.62, 0.98), vec3(0.85, 0.12, 0.98), sin(time + d) * 0.5 + 0.5);
    col += glowCol * glow;
    
    // Atmospheric fog
    col = mix(col, vec3(0.03, 0.01, 0.08), 1.0 - exp(-0.4 * d * d));
    
    // Grid scanlines
    col *= 0.93 + 0.07 * sin(fragCoord.y * 1.6);
    col = hueShift(col, uHueShift);
    fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
  }
`;

export const APOLLONIAN_SHADER = `
  precision highp float;

  float de(vec3 p) {
    float scale = 1.0;
    float time = iTime * 0.05;
    
    // Infinite space folds and inversion
    for (int i = 0; i < 7; i++) {
      p = -1.0 + 2.0 * fract(0.5 + 0.5 * p);
      float r2 = dot(p, p);
      float k = 1.25 / clamp(r2, 0.15, 1.0);
      p *= k;
      scale *= k;
    }
    
    return 0.25 * abs(p.y) / scale;
  }

  vec3 getNormal(vec3 p) {
    vec2 e = vec2(0.001, 0.0);
    return normalize(vec3(
      de(p + e.xyy) - de(p - e.xyy),
      de(p + e.yxy) - de(p - e.yxy),
      de(p + e.yyx) - de(p - e.yyx)
    ));
  }

  void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
    float time = iTime * 0.15;
    
    // Fly through camera path
    vec3 ro = vec3(0.1 * sin(time * 0.5), 0.1 * cos(time * 0.3), time * 0.4);
    vec3 ta = ro + vec3(0.15 * sin(time * 0.5 + 0.5), 0.15 * cos(time * 0.3 + 0.5), 1.0);
    
    vec3 ww = normalize(ta - ro);
    vec3 uu = normalize(cross(ww, vec3(0.0, 1.0, 0.0)));
    vec3 vv = cross(uu, ww);
    vec3 rd = normalize(uv.x * uu + uv.y * vv + 1.2 * ww);
    
    // Roll the camera slightly
    float roll = sin(time * 0.3) * 0.2;
    float cr = cos(roll), sr = sin(roll);
    rd.xy = rd.xy * mat2(cr, -sr, sr, cr);

    float d = 0.0;
    float maxD = 5.0;
    float steps = 0.0;
    float glow = 0.0;
    
    for (int i = 0; i < 90; i++) {
      vec3 p = ro + rd * d;
      float dist = de(p);
      glow += exp(-dist * 20.0) * 0.08;
      if (dist < 0.0008 || d > maxD) break;
      d += dist * 0.72;
      steps += 1.0;
    }
    
    vec3 col = vec3(0.0);
    
    if (d < maxD) {
      vec3 p = ro + rd * d;
      vec3 normal = getNormal(p);
      vec3 lightDir = normalize(vec3(0.5, 1.0, -0.5));
      
      // Cyan/Blue cyber palette
      vec3 matCol = mix(vec3(0.0, 0.85, 0.95), vec3(0.5, 0.0, 1.0), sin(p.z * 10.0) * 0.5 + 0.5);
      
      float diff = max(0.0, dot(normal, lightDir));
      float ao = clamp(1.0 - steps / 90.0, 0.0, 1.0);
      col = matCol * (0.15 + 0.85 * diff) * ao;
      
      // Add neon outline specular
      col += vec3(0.2, 0.9, 1.0) * pow(max(0.0, 1.0 - dot(-rd, normal)), 4.0) * 0.5 * ao;
    }
    
    // Add volumetric blue/cyan glow
    col += vec3(0.0, 0.7, 0.95) * glow;
    
    // Dark depth fog
    col = mix(col, vec3(0.0, 0.0, 0.02), 1.0 - exp(-0.8 * d * d));
    
    // Subtle CRT scanlines
    col *= 0.95 + 0.05 * sin(fragCoord.y * 1.5);
    fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
  }
`;

export const MENGER_SHADER = `
  precision highp float;

  // Per-mount hue rotation (uHueShift uniform) so Menger isn't always orange.
  vec3 hueShift(vec3 c, float a){ vec3 k=vec3(0.57735); float ca=cos(a); return c*ca + cross(k,c)*sin(a) + k*dot(k,c)*(1.0-ca); }

  float sdBox(vec3 p, vec3 b) {
    vec3 d = abs(p) - b;
    return min(max(d.x, max(d.y, d.z)), 0.0) + length(max(d, 0.0));
  }

  float de(vec3 p) {
    // Infinite Sierpinski Menger Sponge
    float d = sdBox(p, vec3(1.2));
    float s = 1.0;
    for (int m = 0; m < 4; m++) {
      vec3 a = fract(p * s) - 0.5;
      s *= 3.0;
      vec3 r = abs(1.0 - 6.0 * abs(a));
      float da = max(r.x, r.y);
      float db = max(r.y, r.z);
      float dc = max(r.z, r.x);
      float c = (min(da, min(db, dc)) - 1.0) / s;
      d = max(d, c);
    }
    return d;
  }

  vec3 getNormal(vec3 p) {
    vec2 e = vec2(0.001, 0.0);
    return normalize(vec3(
      de(p + e.xyy) - de(p - e.xyy),
      de(p + e.yxy) - de(p - e.yxy),
      de(p + e.yyx) - de(p - e.yyx)
    ));
  }

  void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
    float time = iTime * 0.15;
    
    // Orbital rotation around Menger block
    vec3 ro = vec3(1.8 * sin(time), 1.0 * sin(time * 0.5), 1.8 * cos(time));
    vec3 ta = vec3(0.0, 0.0, 0.0);
    
    vec3 ww = normalize(ta - ro);
    vec3 uu = normalize(cross(ww, vec3(0.0, 1.0, 0.0)));
    vec3 vv = cross(uu, ww);
    vec3 rd = normalize(uv.x * uu + uv.y * vv + 1.2 * ww);
    
    float d = 0.0;
    float maxD = 4.0;
    float steps = 0.0;
    float glow = 0.0;
    
    for (int i = 0; i < 75; i++) {
      vec3 p = ro + rd * d;
      float dist = de(p);
      glow += exp(-dist * 15.0) * 0.05;
      if (dist < 0.0015 || d > maxD) break;
      d += dist * 0.8;
      steps += 1.0;
    }
    
    vec3 col = vec3(0.0);
    
    if (d < maxD) {
      vec3 p = ro + rd * d;
      vec3 normal = getNormal(p);
      vec3 lightDir = normalize(vec3(1.0, 1.5, -1.0));
      
      // Metallic cyber steel/gold colors
      vec3 matCol = mix(vec3(0.12, 0.45, 0.72), vec3(0.98, 0.58, 0.12), sin(p.y * 5.0) * 0.5 + 0.5);
      
      float diff = max(0.0, dot(normal, lightDir));
      float ao = clamp(1.0 - steps / 75.0, 0.0, 1.0);
      col = matCol * (0.2 + 0.8 * diff) * ao;
      
      // Specular highlight
      vec3 halfV = normalize(lightDir - rd);
      col += vec3(pow(max(0.0, dot(normal, halfV)), 12.0) * 0.3 * ao);
    }
    
    // Add warm orange/amber glow
    col += vec3(0.98, 0.48, 0.12) * glow;
    
    // Depth fog
    col = mix(col, vec3(0.04, 0.02, 0.0), 1.0 - exp(-0.5 * d * d));
    
    // CRT scanlines
    col *= 0.94 + 0.06 * sin(fragCoord.y * 1.5);
    col = hueShift(col, uHueShift);
    fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
  }
`;
