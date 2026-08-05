# Enhance-Motive — Herkunft, Erzeugung und Lizenz

Diese sechs JPEGs werden mit der Anwendung ausgeliefert und vom Panel
`EnhanceView` (Komponente [`src/components/EnhancePhoto.tsx`](../../src/components/EnhancePhoto.tsx))
angezeigt. Sie liegen lokal, damit beim Seitenaufruf keine Anfrage an einen
fremden Bilddienst geht (Datenschutz: keine Übertragung der Besucher-IP an
Dritte).

## Herkunft in einem Satz

**Alle sechs Bilder sind am 2026-08-03 selbst erzeugt worden** — lokal auf
Daniels eigenem Rechner, mit dem Bildmodell **Z-Image-Turbo** über das Werkzeug
`mflux`. Es ist also **kein Fremdwerk** darunter: keine Fotografie eines Dritten,
keine Bildagentur, kein Download aus dem Netz. Damit gibt es keinen Urheber, der
genannt werden müsste, und keine Lizenzbedingung, die zu erfüllen wäre.

## Lizenzlage

- **Bilder:** Eigenerzeugung, frei verwendbar. Es besteht keine
  Attributionspflicht; im Panel ist deshalb bewusst keine Namensnennung
  eingeblendet.
- **Modell:** Z-Image-Turbo steht unter **Apache-2.0**. Diese Lizenz erlaubt
  auch die kommerzielle Verwertung der erzeugten Bilder. Das war der Grund, die
  ebenfalls verfügbaren FLUX-Modelle *nicht* zu nehmen — deren Lizenz (BFL
  Non-Commercial) hätte eine Einschränkung in ein öffentlich ausgeliefertes
  Projekt getragen.

## Motivvorgabe

Aufnahmen, die wie das Bild einer fest montierten Überwachungskamera im
öffentlichen Raum wirken — passend zum Panel-Text „CCTV FEED ● DOWNTOWN
SECTOR". Gemeinsame Merkmale aller sechs Motive: leicht erhöhter, fester
Blickwinkel, Weitwinkel mit leichter Verzeichnung, entsättigte und flaue
Farben, sichtbares Bildrauschen.

Bewusst ausgeschlossen und an jedem Bild geprüft: keine erkennbaren Gesichter,
keine lesbaren Kennzeichen, keine lesbaren Firmenschilder, keine eingebrannten
Wasserzeichen oder Zeitstempel. Die Statuszeile und das Kamera-Label malt die
Komponente selbst — das Bildmaterial bleibt frei davon.

## Erzeugung und Nachbearbeitung

Aufruf je Motiv (Werkzeug: `theplan/tools/bildgen-cli.py`, Modell
`z-image-turbo`, 8 Steps, 1024 × 576 px, Ausgabe PNG):

```
bildgen-cli.py "<Motivsatz>, <gemeinsamer Stilzusatz>" \
    --model z-image-turbo --width 1024 --height 576
```

Gemeinsamer Stilzusatz für alle sechs Motive:

> grainy low-quality security camera video still, fixed wall-mounted camera
> about four metres above the ground looking down the scene at a shallow angle,
> wide-angle lens with slight barrel distortion, washed-out desaturated colours,
> flat low contrast, visible video noise and compression artefacts, full frame
> edge to edge, no letterbox, no black bars, no camera visible in frame, no
> text, no watermark, no timestamp, no logos, no readable signage, no license
> plates, faces not identifiable

Nachbearbeitung, für alle Dateien gleich: schwarze Letterbox-Balken abgeschnitten,
mittig auf exaktes 16:9 beschnitten, mit Lanczos auf 800 × 450 px verkleinert und
als progressives JPEG (Qualität 72, Farbunterabtastung 4:2:0) ohne EXIF-Daten
gespeichert. 800 × 450 px reicht, weil das Panel laut
[`panel-registry.ts`](../../src/panels/panel-registry.ts) auf `size: 'no-large'`
steht, also nie in einer großen Zelle landet.

Die Läufe verwendeten Zufalls-Startwerte („Seeds"), die nicht mitprotokolliert
wurden. Ein erneuter Aufruf mit demselben Prompt liefert deshalb denselben Stil,
aber nicht dasselbe Einzelbild. Für die Lizenzfrage spielt das keine Rolle — die
ausgelieferten Dateien sind unten über ihre Prüfsumme eindeutig festgehalten.

## Die sechs Dateien

| Datei | Motiv | Größe | SHA-256 |
| --- | --- | --- | --- |
| `cctv-0.jpg` | Straßenkreuzung mit Zebrastreifen bei bedecktem Tageslicht, einzelne Passanten | 45.478 Byte | `a4e27a3193a3b67c89d1ffc89033273cfc63d9ea37b2ef7943ef2fccdf6f6fb5` |
| `cctv-1.jpg` | Fußgängerzone in der Dämmerung, beleuchtete Schaufenster, Passanten von hinten | 40.800 Byte | `e11acddc92b772219e49b9a055ed047a3a7ae233a1129425ae137df0cb4a0190` |
| `cctv-2.jpg` | Leerer Platz bei Nacht, nasses Pflaster, eine einzelne Gestalt | 34.364 Byte | `f599cb7f902b821510203d90d6179a71ddfe207f34f82eff4e7191ef541f8d0e` |
| `cctv-3.jpg` | Bushaltestelle an einer breiten Straße im Regen, Wartende von hinten | 38.800 Byte | `4477ce35e33f1d38a20fb6aab1f26b1b43e6de37311bb03a22a92580c16e392f` |
| `cctv-4.jpg` | Fußgängerunterführung mit Leuchtstoffröhren, eine Person geht weg | 27.521 Byte | `fac2f4256d9c3c3ab4f8e684ea781a3efeb099e97ebff3a93d0a6777a9750992` |
| `cctv-5.jpg` | Parkplatz vor einem Wohnblock im Morgennebel, eine Person quert | 29.044 Byte | `671b832099366a573e0e9f374e2793c3df33dbb34c250e205cb4571aa42a1b0d` |

Zusammen 216.007 Byte. Der vorherige Bestand — sechs Wikimedia-Commons-Vorschauen
mit 500 px Breite — belegte 337.322 Byte; die neuen Bilder sind also kleiner und
haben trotzdem die 1,6-fache Breite und mindestens die 1,2-fache Höhe
(800 × 450 statt 500 × 333–375).

## Was vorher hier lag

Bis zum 2026-08-03 lagen in diesem Ordner sechs Dateien `street-0.jpg` bis
`street-5.jpg` samt einer `manifest.json`, die nur die Dateinamen enthielt. Ein
Skript `scripts/fetch-images.mjs` hatte sie am 2026-05-20 als 500-px-Vorschauen
von Wikimedia Commons geladen. Welche Commons-Datei, welcher Urheber und welche
Lizenz zu welcher Nummer gehörten, war nirgends festgehalten — und die meisten
Lizenzen auf Commons verlangen Namensnennung. Die sechs Dateien liegen jetzt
unter [`frontend/disabled-assets/enhance-street/`](../../disabled-assets/enhance-street/)
und sind nicht mehr Teil des Builds. Das Skript ist entfernt worden; Motive
werden seither selbst erzeugt statt beschafft.

Ebenfalls am 2026-08-03 aus dem Build genommen wurden 17 kuratierte
Großstadtfotos; sie liegen unter
[`frontend/disabled-assets/enhance-curated/`](../../disabled-assets/enhance-curated/).
