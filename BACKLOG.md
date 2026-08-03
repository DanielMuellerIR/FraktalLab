# Backlog-Kandidaten FraktalLab

Vor Übernahme jeden Punkt gegen aktuellen Code und bestehenden Projekt-Backlog prüfen.

## Produkt/Qualität

- Schwächere Hardware mit mehreren Canvas-/GL-Panels messen; nur bestätigte Engpässe bearbeiten.
- Archiviertes Daggerfall-Panel nur auf ausdrücklichen Wunsch modernisieren.
- Lizenz-/Attributions-Registry für weitere externe Demoszene-Werke ausbauen.
- Vollständigen Text der SIL Open Font License zu den mitgelieferten Schriften
  legen. Die Web-Subsets in `frontend/public/fonts/` tragen nur die Lizenz-URL
  (Name-ID 14), nicht den Lizenztext; Urheber, Version und Prüfsummen sind in
  `frontend/public/fonts/README.md` dokumentiert.
- `Press Start 2P` wird nirgends als `font-family` verwendet — nur die beiden
  `@font-face`-Regeln in `frontend/src/index.css` nennen die Familie. Entweder an
  der gedachten Stelle einsetzen oder Regeln und die beiden woff2-Dateien
  (22.368 Byte) entfernen.
- **Enhance-Panel wieder einschalten, sobald es neue Motive gibt.** Entschieden am
  2026-08-03: `EnhanceView` steht in `frontend/src/panels/panel-registry.ts` auf
  `active: false`, die 17 kuratierten Großstadt-Fotos liegen unter
  `frontend/disabled-assets/enhance-curated/` und damit außerhalb des Builds. Grund
  war die fehlende Zuordnung zu Urheber, Original und Bearbeitung — ein Verstoß
  gegen die Invariante aus `AGENTS.md` (Fremdwerke nur mit verifizierter Lizenz und
  sichtbarer Attribution). Die alten Bilder kommen nicht zurück. Ein
  Wiedereinschalten braucht neue Motive mit:
  1. nachweislich freier Lizenz (Public Domain/CC0 oder freie Lizenz mit
     dokumentierter Quelle) — die Herkunft beim Beschaffen festhalten, nicht
     hinterher rekonstruieren;
  2. dem gewünschten Thema: Aufnahmen, die wie eine Überwachungskamera im
     öffentlichen Raum wirken (passend zum Panel-Text „CCTV FEED");
  3. einem versionierten Manifest je Bild mit Quelle, Urheber, Lizenz und
     Bearbeitung, nach dem Vorbild von `frontend/public/fonts/README.md`;
  4. sichtbarer Attribution im Panel, sobald die Lizenz sie verlangt.
  Details: `frontend/disabled-assets/enhance-curated/README.md`.
- Die sechs verbliebenen Fotos `frontend/public/enhance/street-*.jpg` haben dieselbe
  Lücke wie die stillgelegten Motive, nur mit bekannter Quellplattform:
  `scripts/fetch-images.mjs` hat sie 2026-05-20 als 400-px-Vorschaubilder von
  Wikimedia Commons geladen (Suchbegriff „pedestrian street crossing"). Das Skript
  gibt die Dateititel nur auf der Konsole aus und schreibt in `manifest.json` nur
  die Dateinamen — Commons-Datei, Urheber und Lizenz je Bild sind also nicht
  festgehalten, und die meisten Commons-Lizenzen verlangen Namensnennung. Die
  Bilder werden weiterhin ausgeliefert (337 KB) und laufen im Review-Modus noch im
  deaktivierten Enhance-Panel. Beim Neuaufbau der Motive mit erledigen — belegen
  oder ebenfalls ersetzen. Nebenbefund: Der Kommentar in `scripts/fetch-images.mjs`
  behauptet, `EnhancePhoto.tsx` lese `manifest.json`; tatsächlich zählt die
  Komponente `street-0` bis `street-5` fest auf und liest das Manifest nie.
- **Wartet auf Daniels Entscheidung:** Die BotB-Stücke stehen unter CC BY-NC-SA und
  werden über `dm0.de/x` von einer Domain ausgeliefert, die auf kommerzielle Beratung
  verweist — die NC-Klausel wird dadurch angreifbar. Vier Optionen (so lassen, auf eine
  private Domain umziehen und nur als Bastelprojekt verlinken, Urheber direkt fragen,
  freier lizenzierte Stücke nehmen). Mechanik und Abstufung in theplans
  `knowledge/cc-nc-kommerzieller-kontext.md`; die ältere Bewertung
  `Rechtliche Einschätzung zu mods und sids.md` betrifft die frühere gerippte
  Spielmusik und beantwortet diese Frage nicht.
- Neue Demoszene-Integrationen einzeln scopen: Emulatoren, WebGPU, Storytelling und Hero-Modus
  bleiben Ideen, keine Daueranweisung.
- Neue Panels nur, wenn eine Session einen vollständigen, testbaren Stand liefern kann.

## Hygiene

- Panelinventar aus `panel-registry.ts` generierbar machen statt manuell duplizieren.
- Historische Audit-Tabellen und erledigte Versionseinträge in ARCHIVE konsolidieren.
- Veralteten Nested-AGENTS-Snapshot unter `archive/v0.9.4` in normale Archivdoku umwandeln.
