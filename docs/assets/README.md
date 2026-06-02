# FraktalLab Medien

Dieser Ordner nimmt README- und GitHub-Social-Preview-Bilder auf.

## Social Preview erzeugen

1. Proxima-Screenshot selbst aufnehmen.
2. Bild aus dem Screenshot erzeugen:

```bash
python3 scripts/make-social-preview.py ~/Desktop/fraktallab-proxima.png
```

Ausgabe:

- `docs/assets/fraktallab-proxima.jpg` — README-Hero
- `docs/assets/social-preview.jpg` — GitHub Social Preview, exakt 1280x640

Falls der Zuschnitt zu tief sitzt:

```bash
python3 scripts/make-social-preview.py ~/Desktop/fraktallab-proxima.png --anchor center
```

## GitHub Social Preview setzen

GitHub verwendet nicht automatisch eine Datei aus dem Repo. Das Bild muss in den
Repository-Einstellungen hochgeladen werden:

`Settings` -> `General` -> `Social preview` -> `Upload an image`

Empfohlene Datei: `docs/assets/social-preview.jpg`.
