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

## Wie es weiterging: Motive werden erzeugt statt beschafft

Daniels Entscheidung vom 2026-08-03 lief zunächst darauf hinaus, neue Bilder mit
belegter freier Lizenz zu **beschaffen**. Noch am selben Tag hat er den Weg
gewechselt: Die Motive werden **selbst erzeugt**. Das löst die Lizenzfrage
vollständig — an einem eigenen Bild gibt es keinen fremden Urheber, der genannt
werden müsste, und keine Lizenzbedingung, die zu erfüllen wäre.

Seither zeigt das Panel sechs lokal erzeugte Motive in Überwachungskamera-Optik
unter `frontend/public/enhance/cctv-0.jpg` bis `cctv-5.jpg`. Der Eintrag
`EnhanceView` in `src/panels/panel-registry.ts` ist wieder aktiv. Werkzeug,
Modell, Prompt, Nachbearbeitung, Lizenzlage und Prüfsummen je Datei stehen in
[`frontend/public/enhance/README.md`](../../public/enhance/README.md) — nach dem
Vorbild von `frontend/public/fonts/README.md`.

Die 17 Bilder in diesem Ordner sind davon nicht berührt: Sie bleiben stillgelegt
und kommen nicht zurück.

Ebenfalls ersetzt wurden die sechs Fotos, die bis dahin noch unter
`frontend/public/enhance/street-*.jpg` ausgeliefert wurden. Sie hatten dieselbe
Lücke, nur mit bekannter Quellplattform: `scripts/fetch-images.mjs` hatte sie am
2026-05-20 als 500-px-Vorschaubilder von Wikimedia Commons geladen. Sie liegen
jetzt unter
[`frontend/disabled-assets/enhance-street/`](../enhance-street/); das Skript ist
entfernt worden, weil Motive nicht mehr beschafft werden.
