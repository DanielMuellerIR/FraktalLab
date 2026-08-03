# Stillgelegte Enhance-Motive (17 Großstadt-Fotos)

Diese 17 JPEGs lagen bis 2026-08-03 unter `frontend/public/enhance/curated/` und
wurden vom Panel `EnhanceView` (Komponente `src/components/EnhancePhoto.tsx`)
angezeigt. Alles unterhalb von `frontend/public/` kopiert Vite unverändert in den
Build — die Bilder wurden also mit ausgeliefert.

**Warum sie hier liegen:** Zu keinem der 17 Bilder ist belegt, wer es aufgenommen
hat, welches Original es ist und was daran bearbeitet wurde; im Panel erschien
keine Attribution. Das verletzt die Invariante aus `AGENTS.md`: „Fremdwerke nur
mit verifizierter Lizenz und sichtbarer Attribution integrieren; Autoren und
Modifikationen dokumentieren." Aus der Git-Historie (Stand vor Commit `777d808`)
lassen sich nur 19 Unsplash-Kennungen mit Motivbeschreibung rekonstruieren, nicht
aber die Urheber — und welche Kennung zu welcher Datei `curated-N.jpg` gehört,
ist ohne Bildvergleich nicht sicher. EXIF-/IPTC-Angaben tragen die Dateien nicht.

Dieser Ordner liegt außerhalb von `frontend/public/` und ist deshalb **nicht**
Teil des Builds. Die Dateien bleiben nur als früherer Stand versioniert; sie
werden nicht wieder eingebaut.

## Was ein Wiedereinschalten des Panels braucht

Daniels Entscheidung vom 2026-08-03: Das Panel bleibt deaktiviert
(`active: false` in `src/panels/panel-registry.ts`), bis es neue Motive gibt.
Bedingungen für die neuen Bilder:

1. **Lizenz.** Nachweislich Public Domain (z. B. CC0) oder eine freie Lizenz mit
   dokumentierter Quelle. „Vermutlich frei" reicht nicht; die Herkunft muss beim
   Beschaffen festgehalten werden, nicht hinterher rekonstruiert.
2. **Motiv-Thema.** Die Bilder sollen wie Aufnahmen einer Überwachungskamera im
   öffentlichen Raum aussehen. Das passt zum Panel-Text („CCTV FEED ● DOWNTOWN
   SECTOR") und zum Enhance-Gag.
3. **Manifest je Bild.** Eine versionierte Datei neben den Bildern mit je Datei:
   Quelle (URL), Urheber, Lizenz und Bearbeitung (Zuschnitt, Skalierung,
   Kompression). Vorbild ist `frontend/public/fonts/README.md`, das dasselbe für
   die mitgelieferten Schriften leistet.
4. **Sichtbare Attribution**, sobald die Lizenz sie verlangt. Bei echter Public
   Domain entfällt die Pflicht, das Manifest bleibt trotzdem nötig.

Achtung: Die sechs verbliebenen Fotos `frontend/public/enhance/street-*.jpg`
haben dieselbe Lücke, nur mit bekannter Quellplattform. `scripts/fetch-images.mjs`
hat sie 2026-05-20 als 400-px-Vorschaubilder von Wikimedia Commons geladen
(Suchbegriff „pedestrian street crossing"). Das Skript gibt die Dateititel nur
auf der Konsole aus und schreibt in `manifest.json` ausschließlich die
Dateinamen — welche Commons-Datei, welcher Urheber und welche Lizenz zu
`street-N.jpg` gehören, ist damit nicht festgehalten. Auf Commons liegen Dateien
unter sehr verschiedenen Lizenzen (CC0, CC BY, CC BY-SA, gemeinfrei); die
meisten verlangen Namensnennung. Diese sechs Bilder werden weiterhin
ausgeliefert und laufen im Review-Modus noch im deaktivierten Panel. Beim
Neuaufbau der Motive gehören sie mit in das Manifest oder mit auf den
Austausch-Zettel; siehe `BACKLOG.md`.

Nebenbefund: Der Kommentar in `scripts/fetch-images.mjs` behauptet,
`EnhancePhoto.tsx` lese `manifest.json`. Das stimmt nicht — die Komponente
zählt die Dateinamen `street-0` bis `street-5` fest auf, `manifest.json` wird
nirgends gelesen.
