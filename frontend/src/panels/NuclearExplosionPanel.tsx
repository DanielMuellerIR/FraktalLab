import { memo, useEffect, useMemo, useState } from 'react'
import ShaderPanel from '../ui/ShaderPanel'

// ============================================================================
//  NuclearExplosionPanel ("Oppenheimer") — volumetrisches Raymarching
// ----------------------------------------------------------------------------
//  WICHTIG: Trotz des Aufgaben-Titels "Canvas2D" rendert dieses Panel NICHT
//  auf einem 2D-Canvas, sondern ueber einen WebGL-Fragment-Shader (GLSL), den
//  die wiederverwendbare <ShaderPanel>-Komponente kompiliert und pro Frame mit
//  Uniforms versorgt. Die komplette Animation laeuft also in der GPU.
//
//  Ablauf einer Variante (klare zeitliche Sequenz, siehe Aufgabe 1):
//    Phase A  (0.0 .. ~2.0 s)   ruhiges Terrain + Himmel, noch keine Explosion
//    Phase B  (~2.0 .. ~6.0 s)  grell-weisser Blitz / Lichtkugel (3-5 s)
//    Phase C  (~6.0 .. CYCLE)   aufsteigender Atompilz (Saeule + Kappe),
//                               der am Ende STEHEN bleibt (Aufgabe 5)
//
//  Zwei Varianten wechseln sich alle CYCLE Sekunden ab:
//    uMode == 0  -> "Oppenheimer Day"   (Tag, Farbe)
//    uMode == 1  -> "Twin Peaks Night"  (Nacht, S/W, Blitz erhellt die Szene)
//
//  Per-Mount-Varianz (Aufgabe 4): Beim Mounten wuerfeln wir einen Seed sowie
//  Start-Offsets fuer Timing/Position/Form aus und reichen sie als Uniforms in
//  den Shader. So sieht jede Instanz leicht anders aus, ohne den Shader-Quelltext
//  zu veraendern (der Quelltext bleibt stabil -> kein WebGL-Neuaufbau).
// ============================================================================

// Laenge einer Variante in Sekunden. Eine volle Runde (Tag + Nacht) = 2 * CYCLE.
const CYCLE_SECONDS = 26.0

const VOLUMETRIC_EXPLOSION_SHADER = `
  precision highp float;

  // --- Per-Mount-Uniforms (von React gesetzt, siehe unten) -----------------
  // uStartSec : iTime-Wert (Sekunden) zum Mount-Zeitpunkt -> lokale Zeit = iTime - uStartSec
  // uSeed     : Zufalls-Seed 0..1 fuer Form/Detail-Varianz
  // uPosX     : kleiner horizontaler Versatz der Explosion (Position-Varianz)
  // uTimeJit  : kleiner Zeit-Versatz fuer die Sequenz (Timing-Varianz)
  // uMode     : 0.0 = Tag, 1.0 = Nacht (von React deterministisch berechnet)
  uniform float uStartSec;
  uniform float uSeed;
  uniform float uPosX;
  uniform float uTimeJit;
  uniform float uMode;
  uniform float uCycle;   // Laenge einer Variante in Sekunden (von React, = CYCLE_SECONDS)

  // 3D pseudo-random hash
  float hash(vec3 p) {
    p = fract(p * 0.3183099 + .1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }

  // 2D-Hash fuer Sternenfeld / Bodendetails
  float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  // 3D Value Noise mit quintischer Interpolation fuer weichere Verlaeufe
  float noise(in vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f*f*f*(f*(f*6.0-15.0)+10.0); // quintic Hermite
    return mix(mix(mix(hash(i+vec3(0,0,0)), hash(i+vec3(1,0,0)),f.x),
                   mix(hash(i+vec3(0,1,0)), hash(i+vec3(1,1,0)),f.x),f.y),
               mix(mix(hash(i+vec3(0,0,1)), hash(i+vec3(1,0,1)),f.x),
                   mix(hash(i+vec3(0,1,1)), hash(i+vec3(1,1,1)),f.x),f.y),f.z);
  }

  // 6-octave fBm mit Lacunarity 2.03 fuer nicht-repetitives Detail
  float fbm(vec3 p) {
    float v = 0.0;
    float a = 0.5;
    mat3 rot = mat3(0.0, 0.8, 0.6,
                   -0.8, 0.36,-0.48,
                   -0.6,-0.48, 0.64); // Rotation bricht Achsen-Ausrichtung
    for (int i = 0; i < 6; i++) {
      v += a * noise(p);
      p = rot * p * 2.03 + vec3(100.0);
      a *= 0.49;
    }
    return v;
  }

  // 3-octave fBm fuer Schattenstrahlen (schneller als der 6er)
  float fbmShadow(vec3 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 3; i++) {
      v += a * noise(p);
      p = p * 2.03 + vec3(100.0);
      a *= 0.49;
    }
    return v;
  }

  // 2D-fBm fuer Himmel-/Bodentexturen (Wolken, Berge)
  float fbm2(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
    for (int i = 0; i < 5; i++) {
      v += a * noise(vec3(p, 0.0));
      p = m * p;
      a *= 0.5;
    }
    return v;
  }

  // Blackbody-Temperatur -> RGB (warmer Glutkern)
  vec3 blackbody(float temp) {
    vec3 col;
    col.r = 1.0 / (1.0 + exp(-(temp - 900.0) / 200.0));
    col.g = 1.0 / (1.0 + exp(-(temp - 1600.0) / 250.0));
    col.b = 1.0 / (1.0 + exp(-(temp - 2500.0) / 320.0));
    float intensity = temp / 1000.0;
    if (temp > 3500.0) {
      intensity *= 1.8 + (temp - 3500.0) * 0.0015;
    }
    return col * intensity;
  }

  // ==========================================================================
  //  Sequenz-Steuerung
  // --------------------------------------------------------------------------
  //  "grow" (0..1) ist der eigentliche Animations-Fortschritt der Wolke. Er
  //  startet ERST nach dem Blitz und faehrt dann bis 1 hoch und BLEIBT dort
  //  (Aufgabe 5: Pilz bleibt am Ende stehen). Das entkoppelt die Pilz-Form vom
  //  globalen Zyklus-Fortschritt und sorgt fuer einen sauberen Ablauf.
  // ==========================================================================

  // Zeitpunkte (Sekunden) innerhalb einer Variante, leicht per Seed/Jitter variiert
  // FLASH_START : Beginn des Blitzes
  // FLASH_END   : Ende des Blitzes / Beginn des Pilz-Aufstiegs
  // GROW_END    : Pilz ist voll aufgestiegen, danach steht er still
  float flashStart() { return 1.6 + uTimeJit; }
  float flashEnd()   { return 5.2 + uTimeJit; } // ~3.6 s Blitzdauer (im 3-5s-Fenster)
  float growEnd()    { return 20.0 + uTimeJit; }

  // Blitz-Intensitaet (0..1): kurzes hartes Aufflammen, dann exponentielles Abklingen
  float flashAmount(float lt) {
    float fs = flashStart();
    float fe = flashEnd();
    // Anstieg in den ersten ~0.18 s, danach exponentieller Abfall ...
    float rise = smoothstep(fs, fs + 0.18, lt);
    float fall = exp(-(lt - fs) * 1.4); // weiches Nachgluehen
    // ... und sauber gegen Ende des Blitzfensters auf 0 ziehen (kein Dauerschein)
    float cutoff = 1.0 - smoothstep(fe - 0.8, fe, lt);
    return rise * fall * cutoff;
  }

  // Wachstums-Fortschritt der Wolke (0..1), bleibt nach growEnd auf 1
  float growProgress(float lt) {
    float fe = flashEnd();
    return clamp((lt - fe) / (growEnd() - fe), 0.0, 1.0);
  }

  // ==========================================================================
  //  Mushroom Cloud SDF
  // --------------------------------------------------------------------------
  //  BUGFIX (Aufgabe 3): Die Saeule war frueher "krumm" (sin/cos-Bend auf x/z)
  //  und verlor durch waist/flare den Kontakt zu Boden und Kappe. Jetzt ist die
  //  Saeule KERZENGERADE (kein seitlicher Bend mehr) und wird per Klammerung
  //  garantiert vom Boden (groundY) bis in die Kappe (capY) durchgehend gefuellt.
  // ==========================================================================
  const float GROUND_Y = -0.55;

  float mushroomDist(vec3 p, float grow) {
    // Versatz der gesamten Wolke entlang X (Positions-Varianz)
    p.x -= uPosX;

    // Kappe steigt mit dem Wachstum auf und wird breiter
    float capY = mix(GROUND_Y + 0.10, 0.62, smoothstep(0.0, 0.85, grow));
    float capR = mix(0.05, 0.46, smoothstep(0.0, 0.60, grow));

    // --- Saeule: GERADE (keine seitliche Auslenkung mehr) ------------------
    // Radiusprofil: breiter Fuss am Boden, schlanke Taille, wieder breiter
    // direkt unter der Kappe -> klassische Pilz-Silhouette, aber durchgehend.
    float h = clamp((p.y - GROUND_Y) / max(0.001, capY - GROUND_Y), 0.0, 1.0);
    float baseStemR = mix(0.02, 0.085, smoothstep(0.0, 0.5, grow));
    // breiter Fuss (h~0), schlanke Mitte (h~0.55), Aufweitung in die Kappe (h~1)
    float profile = 0.55 + 0.85 * pow(1.0 - h, 1.6) + 0.55 * smoothstep(0.7, 1.0, h);
    float stemR = baseStemR * profile;
    // leichte, von der Hoehe abhaengige Verdrehung des Querschnitts (kein Bend!)
    float wob = 1.0 + 0.06 * sin(p.y * 9.0 + uSeed * 6.28);
    float dStem = length(p.xz) * wob - stemR;
    // Saeule oben an der Kappe und unten am Boden sauber kappen
    dStem = max(dStem, p.y - (capY + 0.02));      // nicht ueber die Kappe hinaus
    dStem = max(dStem, GROUND_Y - p.y);            // nicht unter den Boden

    // --- Kappe: toroidaler Wirbelring mit asymmetrischem Querschnitt -------
    vec3 capP = p - vec3(0.0, capY, 0.0);
    capP.y *= 1.5;
    float rXZ = length(capP.xz);
    vec2 torusP = vec2(rXZ - capR, capP.y);
    torusP.y *= (torusP.y > 0.0) ? 1.25 : 0.85; // oben flacher, unten bauchiger
    float dCap = length(torusP) - capR * 0.50;

    // --- Pileus-Kuppel (Blumenkohl-Krone obenauf) --------------------------
    vec3 crownP = p - vec3(0.0, capY + capR * 0.30, 0.0);
    float dCrown = length(crownP) - capR * 0.36;

    // --- Verbindungswulst zwischen Saeule und Kappe ------------------------
    // Garantiert, dass Saeule und Kappe sich UEBERLAPPEN (kein Spalt mehr).
    float dNeck = length(p - vec3(0.0, capY - capR * 0.45, 0.0)) - capR * 0.40;

    // --- Boden-Staubrock (Skirt) -------------------------------------------
    float skirtR = mix(0.03, 0.56, smoothstep(0.0, 0.75, grow));
    vec3 skirtP = p - vec3(0.0, GROUND_Y + 0.03, 0.0);
    skirtP.y *= 3.5;
    vec2 skirtTorus = vec2(length(skirtP.xz) - skirtR, skirtP.y);
    float dSkirt = length(skirtTorus) - skirtR * 0.30;

    return min(min(dStem, dNeck), min(min(dCap, dCrown), dSkirt));
  }

  // Primaere Dichte mit Domain-Warping fuer wirbelnde Billows
  float mushroomDensity(vec3 p, float grow) {
    float d = mushroomDist(p, grow);

    if (d < 0.30) {
      float capY = mix(GROUND_Y + 0.10, 0.62, smoothstep(0.0, 0.85, grow));
      float capR = mix(0.05, 0.46, smoothstep(0.0, 0.60, grow));
      vec3 capP = p - vec3(uPosX, capY, 0.0);

      float noiseScale = mix(8.0, 5.0, grow);
      vec3 nc = p * noiseScale + vec3(uSeed * 50.0); // Seed verschiebt das Rauschfeld

      // Toroidaler Wirbelfluss in der Kappe, aufsteigende Konvektion in der Saeule
      if (p.y > capY - capR * 0.7) {
        float phi = atan(capP.z, capP.x + 0.0001);
        float theta = atan(capP.y, length(capP.xz) - capR + 0.001);
        vec3 flowDir = vec3(cos(phi) * cos(theta), sin(theta), sin(phi) * cos(theta));
        nc += flowDir * grow * 4.5;
        nc.xz += vec2(sin(phi * 5.0), cos(phi * 5.0)) * 0.15 * grow;
      } else {
        nc.y -= grow * 5.0;
        nc.xz += vec2(sin(p.y * 12.0), cos(p.y * 10.0)) * 0.08;
      }

      // Dual-Pass Domain-Warping (Curl-Noise-Naeherung)
      vec3 warp1 = vec3(
        noise(nc + vec3(0.0, 0.0, 0.0)),
        noise(nc + vec3(5.2, 1.3, 0.0)),
        noise(nc + vec3(1.3, 5.2, 3.7))
      );
      vec3 nc2 = nc + warp1 * 0.55;
      vec3 warp2 = vec3(
        noise(nc2 * 1.7 + vec3(7.1, 3.3, 0.0)),
        noise(nc2 * 1.7 + vec3(0.0, 9.1, 2.8)),
        noise(nc2 * 1.7 + vec3(3.5, 0.0, 8.6))
      );
      float n = fbm(nc2 + warp2 * 0.25);

      float edgeFade = smoothstep(0.30, 0.05, d);
      float density = (-d + n * 0.32) * edgeFade;
      density = smoothstep(0.0, 0.22, density);
      // KEIN Ausblenden am Ende mehr -> Pilz bleibt stehen (Aufgabe 5)
      return density;
    }
    return 0.0;
  }

  // Schatten-Dichte — 3-octave, ein Warp-Pass
  float mushroomDensityShadow(vec3 p, float grow) {
    float d = mushroomDist(p, grow);
    if (d < 0.30) {
      float edgeFade = smoothstep(0.30, 0.05, d);
      vec3 nc = p * 6.0 - vec3(0.0, grow * 5.0, 0.0) + vec3(uSeed * 50.0);
      float n = fbmShadow(nc);
      float density = (-d + n * 0.28) * edgeFade;
      density = smoothstep(0.0, 0.22, density);
      return density;
    }
    return 0.0;
  }

  // ==========================================================================
  //  Himmel + Terrain (Aufgabe 7: komplexer/schoener, Tag & Nacht)
  // ==========================================================================

  vec3 skyColor(vec2 uv, float lt) {
    if (uMode < 0.5) {
      // --- TAG: Verlauf von tiefem Azur oben zu warmem Dunst am Horizont ----
      vec3 zenith  = vec3(0.24, 0.45, 0.82);
      vec3 mid     = vec3(0.55, 0.72, 0.95);
      vec3 horizon = vec3(0.92, 0.90, 0.84);
      vec3 col = mix(horizon, mid, smoothstep(-0.15, 0.30, uv.y));
      col = mix(col, zenith, smoothstep(0.15, 0.65, uv.y));

      // Wolkenbaender (2D-fBm, langsam treibend)
      float clouds = fbm2(vec2(uv.x * 2.2 + lt * 0.02, uv.y * 3.5 - 1.0));
      clouds = smoothstep(0.55, 0.95, clouds) * smoothstep(-0.1, 0.45, uv.y);
      col = mix(col, vec3(1.0, 0.99, 0.97), clouds * 0.6);

      // Warme Sonne oben rechts als weicher Lichtpunkt
      vec2 sunPos = vec2(0.55, 0.42);
      float sun = smoothstep(0.28, 0.0, length(uv - sunPos));
      col += vec3(1.0, 0.85, 0.55) * sun * 0.7;
      return col;
    } else {
      // --- NACHT: tiefes Indigo, Sternenfeld, kalter Bodendunst ------------
      float h = clamp(uv.y * 0.5 + 0.5, 0.0, 1.0);
      vec3 col = mix(vec3(0.02, 0.03, 0.06), vec3(0.04, 0.05, 0.11), h);

      // Sternenfeld: feines Raster, nur ein Bruchteil leuchtet
      vec2 grid = uv * 90.0;
      vec2 gi = floor(grid);
      float star = hash21(gi);
      float bright = step(0.978, star);
      float tw = 0.6 + 0.4 * sin(lt * 3.0 + star * 30.0); // Funkeln
      float starGlow = bright * tw * smoothstep(0.0, 0.55, uv.y);
      col += vec3(0.8, 0.85, 1.0) * starGlow * 0.9;

      // Schwacher Mondhof
      vec2 moonPos = vec2(-0.5, 0.45);
      float moon = smoothstep(0.10, 0.0, length(uv - moonPos));
      col += vec3(0.5, 0.55, 0.7) * moon;
      col += vec3(0.2, 0.22, 0.3) * smoothstep(0.30, 0.0, length(uv - moonPos)) * 0.4;
      return col;
    }
  }

  void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;

    // Globale Zeit seit Mount (synchron zum React-Label, siehe Aufgabe 6).
    float gt = iTime - uStartSec;
    // Zeit INNERHALB der aktuellen Variante: jede Variante spielt ihre eigene
    // Detonations-Sequenz (Blitz -> Aufstieg) von vorne ab. Der Pilz bleibt bis
    // zum Variantenwechsel stehen (Aufgabe 5), weil grow am Zyklusende auf 1 ist.
    float lt = mod(gt, uCycle);

    // Sequenz-Werte (auf Basis der varianten-lokalen Zeit)
    float flash = flashAmount(lt);
    float grow = growProgress(lt);

    // Kamera: leichter, langsamer Pull-Back waehrend die Wolke waechst
    float camZ = -1.8 + grow * 0.15;
    vec3 ro = vec3(0.0, 0.12, camZ);
    vec3 rd = normalize(vec3(uv, 1.35));

    // Hintergrund (Himmel)
    vec3 bgCol = skyColor(uv, lt);

    // Boden-Schnittpunkt
    float tGround = 999.0;
    if (rd.y < 0.0) {
      tGround = (GROUND_Y - ro.y) / rd.y;
    }
    float tMax = min(2.8, tGround);

    float t = 0.0;
    // Temporales Jitter gegen Banding
    t += hash(vec3(fragCoord, fract(iTime))) * 0.016;

    // 1. Sphere-Tracing, um leeren Raum zu ueberspringen
    for (int i = 0; i < 35; i++) {
      vec3 p = ro + rd * t;
      float d = mushroomDist(p, grow);
      if (d < 0.28 || t >= tMax) break;
      t += max(0.012, d * 0.75 - 0.12);
    }

    // 2. Volumetrisches Marching
    float stepSize = 0.018;
    float accumOpacity = 0.0;
    vec3 accumColor = vec3(0.0);

    // Vor dem Blitz (Phase A) und waehrend des Blitz-Peaks ist noch kein Pilz da.
    // grow == 0 bis flashEnd -> die Wolke erscheint erst danach. Wir marchen
    // trotzdem (kostet wenig, da die Dichte 0 ist), halten den Ablauf aber sauber.
    for (int i = 0; i < 48; i++) {
      if (t >= tMax || accumOpacity >= 0.98) break;

      vec3 p = ro + rd * t;
      float d = (grow > 0.0) ? mushroomDensity(p, grow) : 0.0;

      if (d > 0.008) {
        // Sonnen-Schattenstrahl fuer Selbstschattierung
        vec3 sunDir = normalize(vec3(1.0, 1.8, -1.0));
        float sunDensity = 0.0;
        for (int j = 1; j <= 5; j++) {
          sunDensity += mushroomDensityShadow(p + sunDir * (float(j) * 0.055), grow);
        }
        float sunT = exp(-sunDensity * 5.5);

        // Glutkern-Strahl
        float capY = mix(GROUND_Y + 0.10, 0.62, smoothstep(0.0, 0.85, grow));
        float capR = mix(0.05, 0.46, smoothstep(0.0, 0.60, grow));
        // Kernposition relativ zum (um uPosX versetzten) Explosionszentrum:
        // in der Kappe auf dem Wirbelring, in der Saeule mittig auf der Achse.
        vec2 radialDir = normalize((p.xz - vec2(uPosX, 0.0)) + 0.001);
        vec3 corePos;
        if (p.y > capY - 0.2) {
          corePos = vec3(uPosX + radialDir.x * capR * 0.5, capY, radialDir.y * capR * 0.5);
        } else {
          corePos = vec3(uPosX, p.y, 0.0);
        }
        vec3 toCore = corePos - p;
        float distToCore = length(toCore);
        vec3 coreDir = toCore / (distToCore + 0.001);
        float coreDensity = 0.0;
        float cStep = max(0.02, distToCore / 4.0);
        for (int j = 1; j <= 3; j++) {
          coreDensity += mushroomDensityShadow(p + coreDir * (float(j) * cStep), grow);
        }
        float coreT = exp(-coreDensity * 6.0);

        // Temperatur: nur kurz nach dem Aufstieg gluehend, dann abkuehlend
        float heat = smoothstep(0.45, 0.0, distToCore);
        float earlyGlow = smoothstep(0.30, 0.0, grow); // Glut nur in den ersten ~30% des Aufstiegs
        float temperature = heat * (2600.0 + earlyGlow * 4200.0) * (1.0 - smoothstep(0.0, 0.65, grow));

        vec3 fireEmit = blackbody(temperature) * 2.5;
        float stepOpacity = d * stepSize * 20.0;

        if (uMode < 0.5) {
          // TAG: warmes braun-graues Rauchvolumen
          vec3 smokeAlbedo = mix(
            vec3(0.74, 0.68, 0.58),
            vec3(0.14, 0.12, 0.11),
            smoothstep(-0.35, 0.80, p.y + d * 0.3)
          );
          vec3 sunLight = vec3(1.0, 0.96, 0.88) * 1.8 * sunT;
          vec3 ambient = vec3(0.50, 0.68, 0.92) * 0.50 * (0.3 + 0.7 * sunT);
          float fwdScatter = pow(max(0.0, dot(rd, sunDir)), 5.0) * 0.5 * sunT;

          vec3 col = smokeAlbedo * (sunLight + ambient + fwdScatter * vec3(1.0, 0.88, 0.65));
          col += fireEmit * coreT * 1.8;
          col += fireEmit * 1.0;
          accumColor += col * stepOpacity * (1.0 - accumOpacity);
        } else {
          // NACHT: S/W — der Pilz ist KONTRASTREICHER als der weiche Hintergrund.
          // Heller Rauch oben, tiefes Schwarz unten -> hoher Eigenkontrast.
          float grey = mix(0.92, 0.02, smoothstep(-0.35, 0.80, p.y + d * 0.35));
          float fireI = dot(fireEmit, vec3(0.299, 0.587, 0.114));
          float sunL = 0.55 * sunT;   // staerker als zuvor -> deutlich heller
          float ambL = 0.06 * (0.3 + 0.7 * sunT);

          vec3 col = vec3(grey) * (sunL + ambL) + vec3(fireI) * coreT * 2.5 + vec3(fireI) * 1.2;
          accumColor += col * stepOpacity * (1.0 - accumOpacity);
        }
        accumOpacity += stepOpacity * (1.0 - accumOpacity);
      }
      t += stepSize;
    }

    // Boden / Terrain-Oberflaeche
    if (rd.y < 0.0 && accumOpacity < 1.0) {
      vec3 pG = ro + rd * tGround;
      float groundShadow = 0.0;
      vec3 sDir = normalize(vec3(1.0, 1.8, -1.0));
      for (int j = 0; j < 6; j++) {
        groundShadow += mushroomDensityShadow(pG + sDir * (0.04 + float(j) * 0.07), grow) * 0.22;
      }
      float sf = exp(-groundShadow * 5.0);

      float r = length(pG.xz - vec2(uPosX, 0.0));
      // Schockwelle laeuft mit dem Aufstieg nach aussen und verblasst
      float waveDist = grow * 1.8;
      float shockGlow = 0.0;
      if (grow > 0.0 && grow < 0.6) {
        shockGlow += smoothstep(0.08, 0.0, abs(r - waveDist));
        shockGlow += smoothstep(0.05, 0.0, abs(r - waveDist * 0.75)) * 0.45;
        shockGlow += smoothstep(0.03, 0.0, abs(r - waveDist * 0.5)) * 0.25;
        shockGlow *= (0.3 + 0.7 * fbmShadow(vec3(pG.xz * 15.0, iTime * 2.5))) * (1.0 - grow);
      }
      // Greller Bodenblitz exakt waehrend des Blitzes (Aufgabe 1/2)
      float epicFlash = smoothstep(0.45, 0.0, r) * flash * 2.4;

      vec3 groundCol;
      if (uMode < 0.5) {
        // TAG-Terrain: Wuestenboden mit Hoehen-/Farbvariation und Felssprenkeln
        float relief = fbm2(pG.xz * 2.0) * 0.5 + fbm2(pG.xz * 7.0) * 0.25;
        vec3 sand  = vec3(0.62, 0.52, 0.38);
        vec3 dark  = vec3(0.30, 0.25, 0.19);
        vec3 baseCol = mix(sand, dark, smoothstep(0.2, 0.9, relief));
        baseCol = mix(baseCol, vec3(0.18, 0.16, 0.14), smoothstep(0.0, 2.2, r)); // Tiefenabdunklung
        baseCol += (fbmShadow(vec3(pG.xz * 18.0, 0.0)) - 0.5) * 0.05; // feine Koernung
        vec3 dustC = mix(vec3(0.88, 0.78, 0.62), vec3(0.35, 0.32, 0.28), smoothstep(0.0, 1.8, r));
        vec3 fireG = vec3(1.0, 0.4, 0.1) * 3.5;
        // Frueh im Aufstieg ist der Bodenstaub noch glutrot, spaeter nur Staub
        float dustFire = smoothstep(0.25, 0.0, grow);
        groundCol = baseCol * (0.2 + 0.8 * sf)
                  + mix(dustC, fireG, dustFire) * shockGlow
                  + vec3(1.0, 0.55, 0.15) * epicFlash;
      } else {
        // NACHT-Terrain: fast schwarz, nur dezente Struktur, kalter Schimmer
        float relief = fbm2(pG.xz * 3.0);
        vec3 baseCol = vec3(0.012) + vec3(0.02, 0.022, 0.03) * relief;
        baseCol += (fbmShadow(vec3(pG.xz * 15.0, 0.0)) - 0.5) * 0.006;
        groundCol = baseCol * (0.15 + 0.85 * sf)
                  + vec3(0.5) * shockGlow
                  + vec3(2.5) * epicFlash;
      }
      accumColor += groundCol * (1.0 - accumOpacity);
      accumOpacity = 1.0;
    }

    vec3 finalCol = mix(bgCol, accumColor, accumOpacity);

    // ========================================================================
    //  Blitz / Lichtkugel (Aufgabe 1 & 2)
    // ------------------------------------------------------------------------
    //  Der Blitz ist ein bildschirmweites Aufflammen. Tag: blau-weiss -> warm.
    //  Nacht: der Blitz erhellt die ganze Szene kurz hell (heller Overlay).
    // ========================================================================
    // Lichtkugel als heller Kern um die Explosionsbasis herum
    vec2 ballC = vec2(uPosX, GROUND_Y + 0.05);
    float ball = smoothstep(0.45, 0.0, length(uv - ballC)) * flash;

    if (uMode < 0.5) {
      vec3 flashCol = vec3(0.92, 0.95, 1.0);
      finalCol += flashCol * flash * 3.5;        // bildschirmweites Aufblitzen
      finalCol += vec3(1.0, 0.9, 0.7) * ball * 2.0; // gleissende Lichtkugel
    } else {
      // Nacht: heller Blitz erleuchtet kurz die ganze Szene
      finalCol += vec3(0.95, 0.97, 1.0) * flash * 2.6;
      finalCol += vec3(1.0) * ball * 1.8;
    }

    // ========================================================================
    //  NACHT-Nachbearbeitung (Aufgabe 2)
    // ------------------------------------------------------------------------
    //  Nach dem Blitz wird die Nacht "entschaerft": der Hintergrund wirkt
    //  weichgezeichnet/verschwommen. Wir simulieren das per Box-Unschaerfe des
    //  Himmels und mischen sie ueber den Bereich OHNE Pilz (accumOpacity klein).
    //  Der Pilz selbst bleibt scharf und damit kontrastreicher.
    // ========================================================================
    if (uMode > 0.5) {
      // Weichgezeichneter Himmel (4-Tap Box-Blur)
      float bo = 0.018;
      vec3 blurred =
        skyColor(uv + vec2( bo,  bo), lt) +
        skyColor(uv + vec2(-bo,  bo), lt) +
        skyColor(uv + vec2( bo, -bo), lt) +
        skyColor(uv + vec2(-bo, -bo), lt);
      blurred *= 0.25;
      // Erst nach dem Blitz greift die Weichzeichnung (Szene "entschaerft")
      float soften = smoothstep(flashEnd() - 0.5, flashEnd() + 1.5, lt);
      // nur dort weichzeichnen, wo kein dichter Pilz ist
      float bgMask = (1.0 - accumOpacity) * soften;
      finalCol = mix(finalCol, mix(finalCol, blurred, 0.7), bgMask);

      // Twin-Peaks-Filmkorn + leichte Scanline
      finalCol += vec3(hash(vec3(fragCoord, iTime)) * 0.07);
      finalCol *= 0.86 + 0.14 * sin(fragCoord.y * 1.5 + iTime * 6.0);
    }

    fragColor = vec4(finalCol, 1.0);
  }
`;

function NuclearExplosionPanel() {
  // Per-Mount-Varianz: Seed + Offsets werden EINMAL beim Mounten gewuerfelt und
  // bleiben dann stabil (useMemo mit leerem Dep-Array). Dadurch sieht jede
  // Instanz/jeder Reload leicht anders aus (Aufgabe 4).
  const seed = useMemo(() => Math.random(), [])
  const posX = useMemo(() => (Math.random() - 0.5) * 0.18, [])   // horizontaler Versatz
  const timeJit = useMemo(() => (Math.random() - 0.5) * 1.6, []) // Timing-Versatz in Sekunden

  // Startzeit (Sekunden seit Page-Load). iTime im Shader ist die rAF-Zeit in
  // Sekunden seit Page-Load; performance.now() ebenso. Durch Uebergabe von
  // uStartSec rechnet der Shader mit "Zeit seit Mount" und ist damit SYNCHRON
  // zum React-Label unten (Aufgabe 6: kein Name/Variant-Mismatch mehr).
  const startSec = useMemo(() => performance.now() / 1000, [])

  const [modeLabel, setModeLabel] = useState('SYS: DETONATION VOLUMETRIC MODEL')

  // Aktuelle Variante (0 = Tag, 1 = Nacht) — wird sowohl fuer das Label als auch
  // (per Uniform) fuer den Shader verwendet, beide aus derselben Zeitbasis.
  const [mode, setMode] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      // Lokale Zeit seit Mount, identisch zur Shader-Rechnung lt = iTime - uStartSec
      const lt = (performance.now() / 1000) - startSec
      const m = Math.floor(lt / CYCLE_SECONDS) % 2
      setMode(m)
      if (m === 0) {
        setModeLabel('SIMULATION: OPPENHEIMER TRINITY (DAY)')
      } else {
        setModeLabel('SIMULATION: TWIN PEAKS NIGHT (B&W MONO)')
      }
    }, 100)
    return () => clearInterval(interval)
  }, [startSec])

  return (
    <ShaderPanel
      fragmentShader={VOLUMETRIC_EXPLOSION_SHADER}
      title={modeLabel}
      attribution="Volumetric Raymarching"
      // Uniforms steuern Variante, Mount-Zeit und die Zufalls-Varianz.
      // Wichtig: Die SCHLUESSEL bleiben konstant -> kein WebGL-Neuaufbau,
      // nur die Werte aendern sich pro Frame.
      uniforms={{ uStartSec: startSec, uSeed: seed, uPosX: posX, uTimeJit: timeJit, uMode: mode, uCycle: CYCLE_SECONDS }}
    />
  )
}

export default memo(NuclearExplosionPanel)
