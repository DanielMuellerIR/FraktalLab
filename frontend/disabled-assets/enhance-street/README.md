# Stillgelegte Enhance-Motive (6 Wikimedia-Commons-Vorschauen)

Diese sechs JPEGs lagen bis 2026-08-03 unter `frontend/public/enhance/` und
wurden vom Panel `EnhanceView` (Komponente `src/components/EnhancePhoto.tsx`)
angezeigt. Alles unterhalb von `frontend/public/` kopiert Vite unverändert in
den Build — die Bilder wurden also mit ausgeliefert.

**Warum sie hier liegen:** Ein Skript `scripts/fetch-images.mjs` hatte sie am
2026-05-20 als 500-px-Vorschaubilder von Wikimedia Commons geladen (Suchbegriff
„pedestrian street crossing"). Das Skript gab die Commons-Dateititel nur auf der
Konsole aus und schrieb in die beiliegende `manifest.json` ausschließlich die
Dateinamen. Welche Commons-Datei, welcher Urheber und welche Lizenz zu
`street-N.jpg` gehören, ist damit nicht festgehalten. Auf Commons liegen Dateien
unter sehr verschiedenen Lizenzen (CC0, CC BY, CC BY-SA, gemeinfrei); die
meisten verlangen Namensnennung. Damit verletzten sie dieselbe Invariante aus
`AGENTS.md` wie die 17 kuratierten Fotos nebenan: „Fremdwerke nur mit
verifizierter Lizenz und sichtbarer Attribution integrieren; Autoren und
Modifikationen dokumentieren."

Frühere Dokumentation nannte als Quelle irrtümlich Unsplash. Die Quellplattform
ist Wikimedia Commons; nachweisbar am Skript, das die Dateien geholt hat.

Dieser Ordner liegt außerhalb von `frontend/public/` und ist deshalb **nicht**
Teil des Builds. Die Dateien bleiben nur als früherer Stand versioniert; sie
werden nicht wieder eingebaut.

Die `manifest.json` liegt unverändert dabei. Sie enthält nur die sechs
Dateinamen und wurde von der Anwendung nie gelesen — die Komponente zählte die
Namen `street-0` bis `street-5` fest auf.

## Was stattdessen ausgeliefert wird

Seit 2026-08-03 zeigt das Panel sechs selbst erzeugte Motive in
Überwachungskamera-Optik. Herkunft, Erzeugung, Lizenzlage und Prüfsummen stehen
in [`frontend/public/enhance/README.md`](../../public/enhance/README.md).
