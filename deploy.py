#!/usr/bin/env python3
"""
deploy.py — Upload des Production-Builds auf den Netcup-Webspace (dm0.de) per SFTP.

Lädt NUR den fertigen Build (frontend/dist/) hoch — also exakt das, was zum
Betrieb der Seite nötig ist. KEINE Quell-/Doku-Dateien (AGENTS.md etc.).

Sicherheit:
  • Die Zugangsdaten werden aus einer Env-Datei gelesen (Default: Sticky/chili.env).
    Sie tauchen NICHT in der Prozessliste auf (lftp-Kommandos kommen über stdin,
    Passwort URL-kodiert in der sftp://-URL) und werden NIE ausgegeben.
  • Es wird NICHTS auf dem Server gelöscht (lftp `mirror -R` ohne `--delete`),
    bestehende Unterordner bleiben unangetastet.

Benutzung:
  python3 deploy.py            # baut + lädt hoch
  python3 deploy.py --dry-run  # zeigt nur, was hochgeladen würde (kein Schreiben)
  python3 deploy.py --no-build # ohne Neubau (nutzt vorhandenes frontend/dist)
  python3 deploy.py --env PFAD # andere Env-Datei
  python3 deploy.py --remote /pfad  # anderes Zielverzeichnis

Voraussetzungen: `lftp` (brew install lftp), `npm` (für den Build).
"""

import argparse
import os
import shutil
import subprocess
import sys
from urllib.parse import quote

# ── Defaults ──────────────────────────────────────────────────────────────────
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DEFAULT_ENV = "/Users/dm0/local/Beispiele/Templates/Sticky/.env/chili.env"
DEFAULT_REMOTE = "/dm0.de/httpdocs/x"
LOCAL_DIST = os.path.join(SCRIPT_DIR, "frontend", "dist")

# Mögliche Schlüssel-Namen in der Env-Datei (erste Übereinstimmung gewinnt).
ALIASES = {
    "host": ["SFTP_HOST", "FTP_HOST", "SSH_HOST", "DEPLOY_HOST", "HOST", "SERVER"],
    "user": ["SFTP_USER", "FTP_USER", "SSH_USER", "DEPLOY_USER", "USERNAME", "USER", "LOGIN"],
    "password": ["SFTP_PASSWORD", "SFTP_PASS", "FTP_PASSWORD", "FTP_PASS",
                 "SSH_PASSWORD", "DEPLOY_PASSWORD", "PASSWORD", "PASS"],
    "port": ["SFTP_PORT", "FTP_PORT", "SSH_PORT", "DEPLOY_PORT", "PORT"],
    "remote": ["DEPLOY_REMOTE_PATH", "REMOTE_PATH", "SFTP_PATH", "FTP_PATH"],
}


def parse_env_file(path):
    """KEY=VALUE-Datei einlesen. Kommentare (#) und Leerzeilen ignorieren."""
    if not os.path.isfile(path):
        sys.exit(f"FEHLER: Env-Datei nicht gefunden: {path}")
    data = {}
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, val = line.partition("=")
            key = key.strip()
            val = val.strip().strip('"').strip("'")
            if key:
                data[key] = val
    return data


def resolve(env, kind, default=None):
    for k in ALIASES[kind]:
        if env.get(k):
            return env[k]
    return default


def main():
    ap = argparse.ArgumentParser(description="SFTP-Deploy von frontend/dist auf dm0.de")
    ap.add_argument("--env", default=os.environ.get("DEPLOY_ENV_FILE", DEFAULT_ENV))
    ap.add_argument("--remote", default=None, help="Zielverzeichnis auf dem Server")
    ap.add_argument("--dry-run", action="store_true", help="nichts schreiben, nur anzeigen")
    ap.add_argument("--no-build", action="store_true", help="frontend/dist nicht neu bauen")
    args = ap.parse_args()

    if not shutil.which("lftp"):
        sys.exit("FEHLER: 'lftp' nicht gefunden. Installieren: brew install lftp")

    # 1) Build
    if not args.no_build:
        print("→ Baue Production-Build (npm run build) …")
        r = subprocess.run(["npm", "--prefix", os.path.join(SCRIPT_DIR, "frontend"), "run", "build"])
        if r.returncode != 0:
            sys.exit("FEHLER: Build fehlgeschlagen.")
    if not os.path.isdir(LOCAL_DIST) or not os.listdir(LOCAL_DIST):
        sys.exit(f"FEHLER: Build-Ordner fehlt/leer: {LOCAL_DIST} (ohne --no-build bauen).")

    # 2) Zugangsdaten (werden NICHT ausgegeben)
    env = parse_env_file(args.env)
    host = resolve(env, "host")
    user = resolve(env, "user")
    password = resolve(env, "password")
    port = resolve(env, "port", "22")
    remote = args.remote or os.environ.get("DEPLOY_REMOTE_PATH") or resolve(env, "remote", DEFAULT_REMOTE)

    missing = [n for n, v in (("host", host), ("user", user), ("password", password)) if not v]
    if missing:
        sys.exit(f"FEHLER: In der Env-Datei fehlen Werte für: {', '.join(missing)} "
                 f"(erwartete Schlüssel-Namen u.a.: {ALIASES['host'][0]}/{ALIASES['user'][0]}/{ALIASES['password'][0]}).")

    print(f"→ Ziel: sftp://{user}@{host}:{port}{remote}   (Passwort verborgen)")
    print(f"→ Quelle: {LOCAL_DIST}")
    print(f"→ Modus: {'DRY-RUN (kein Schreiben)' if args.dry_run else 'UPLOAD'} · kein Löschen auf dem Server")

    # 3) lftp-Skript (Passwort URL-kodiert in der URL, kommt über stdin → nicht in ps)
    url = f"sftp://{quote(user, safe='')}:{quote(password, safe='')}@{host}:{port}"
    dry = "--dry-run" if args.dry_run else ""
    # mirror -R = reverse mirror (LOKAL → REMOTE). KEIN --delete → nichts wird gelöscht.
    # WICHTIG: KEIN --verbose! lftps Verbose-Modus würde pro Datei die volle
    # sftp://user:PASSWORT@host-URL ausgeben und so das Passwort im Terminal leaken.
    # Ohne --verbose zeigt lftp nur eine Transfer-Zusammenfassung.
    cmds = (
        "set sftp:auto-confirm yes\n"
        "set net:max-retries 2\n"
        "set net:timeout 25\n"
        "set cmd:fail-exit yes\n"
        f"open {url}\n"
        f'mirror -R --no-perms --parallel=3 {dry} "{LOCAL_DIST}/" "{remote}/"\n'
        "bye\n"
    )

    proc = subprocess.run(["lftp"], input=cmds, text=True)
    if proc.returncode != 0:
        sys.exit(f"FEHLER: lftp endete mit Code {proc.returncode}.")
    print("✓ Fertig." + ("  (Dry-Run — nichts geschrieben)" if args.dry_run else "  Upload abgeschlossen."))


if __name__ == "__main__":
    main()
