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
