# Mitgelieferte Schriften — Herkunft, Urheber und Lizenz

Diese Dateien werden mit der Anwendung ausgeliefert und in
[`frontend/src/index.css`](../../src/index.css) per `@font-face` eingebunden. Sie
liegen lokal, damit beim Seitenaufruf keine Anfrage an einen fremden Font-Dienst
geht (Datenschutz: keine Übertragung der Besucher-IP an Dritte).

Alle Angaben unten stammen aus der `name`-Tabelle der jeweiligen Datei selbst,
sind also am ausgelieferten Artefakt überprüfbar — nicht aus dem Gedächtnis
notiert.

## IBM Plex Sans

- Dateien: `ibm-plex-sans-latin.woff2` (45.712 Byte),
  `ibm-plex-sans-latin-ext.woff2` (30.964 Byte)
- Familie/Schnitt: IBM Plex Sans, Regular · Version 3.201
- Copyright (Name-ID 0): `Copyright 2019 IBM Corp. All rights reserved.`
- Lizenzhinweis (Name-ID 14): `http://scripts.sil.org/OFL` — SIL Open Font License
- Verwendung: Titel-Pillen der Panels (`ui/PanelSlot.tsx`)
- SHA-256:
  - `e2291e842cf5af167122a22881a740c7f2dda7716f1e8cd76680264f4a859470` (latin)
  - `d160e20920ae4d6556518d352d3af27a74e9b0de3d8fe17b1c1044fc75aa2f81` (latin-ext)

## Press Start 2P

- Dateien: `press-start-2p-latin.woff2` (12.512 Byte),
  `press-start-2p-latin-ext.woff2` (9.856 Byte)
- Familie/Schnitt: Press Start 2P, Regular · Version 3.000
- Copyright (Name-ID 0):
  `Copyright 2012 The Press Start 2P Project Authors (cody@zone38.net), with Reserved Font Name "Press Start 2P"`
- Lizenzhinweis (Name-ID 14): `http://scripts.sil.org/OFL` — SIL Open Font License
- Verwendung: derzeit keine. Die `@font-face`-Regeln existieren, aber kein
  `font-family: 'Press Start 2P'` im Frontend (siehe BACKLOG).
- SHA-256:
  - `afec86997fdaf54af1f59358fa2c1e2a0f1d04146edad18e5cd141d0384a7548` (latin)
  - `3c7df3a15e173b8fa04ec9191171e72c314ddbac1b395e2b2e2092bb4f47cc8c` (latin-ext)

## Bezugsquelle und Bearbeitung

Beide Familien wurden früher zur Laufzeit vom Google-Fonts-CDN geladen; die
`woff2`-Dateien sind die von dort ausgelieferten Web-Subsets (latin und
latin-ext), unverändert übernommen. Keine eigene Bearbeitung der Schriftdaten.

Offener Punkt (im BACKLOG vermerkt): Die Web-Subsets enthalten nur die
Lizenz-URL (Name-ID 14), nicht den Lizenztext (Name-ID 13). Der vollständige
Text der SIL Open Font License gehört noch als Datei danebengelegt, bevor die
Schriften weitergegeben werden.
