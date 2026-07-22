#!/usr/bin/env python3
"""
deploy.py — Upload des Production-Builds auf den Netcup-Webspace (dm0.de) per FTPS.

Lädt NUR den fertigen Build (frontend/dist/) hoch — also exakt das, was zum
Betrieb der Seite nötig ist. KEINE Quell-/Doku-Dateien (AGENTS.md etc.).

Sicherheit:
  • Die Zugangsdaten werden aus einer Env-Datei gelesen (Default: Sticky/chili.env).
    Sie tauchen NICHT in der Prozessliste auf (lftp-Kommandos kommen über stdin,
    Passwort URL-kodiert in der ftp://-URL) und werden NIE ausgegeben.
  • Es wird NICHTS auf dem Server gelöscht (lftp `mirror -R` ohne `--delete`),
    bestehende Unterordner bleiben unangetastet.

Benutzung:
  python3 deploy.py            # baut + lädt hoch
  python3 deploy.py --dry-run  # zeigt nur, was hochgeladen würde (kein Schreiben)
  python3 deploy.py --no-build # ohne Neubau (nutzt vorhandenes frontend/dist)
  python3 deploy.py --env PFAD # andere Env-Datei
  python3 deploy.py --remote /pfad  # anderes Zielverzeichnis

  Umgebungsvariablen (Alternative zu --env):
    DEPLOY_ENV_FILE=/pfad/zur/chili.env python3 deploy.py

Voraussetzungen: `lftp` (brew install lftp), `npm` (für den Build).
"""

import argparse
import ipaddress
import os
import re
import shutil
import subprocess
import sys
from urllib.parse import quote

# ── Defaults ──────────────────────────────────────────────────────────────────
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
# Env-Datei-Pfad: über Umgebungsvariable DEPLOY_ENV_FILE setzen, kein Hardcode.
DEFAULT_ENV = os.environ.get("DEPLOY_ENV_FILE", "")
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
    """KEY=VALUE-Datei einlesen. Kommentare (#) und Leerzeilen ignorieren.
    Leerer oder fehlender Pfad → leeres Dict (Fehler erscheint später bei fehlenden Pflichtfeldern)."""
    if not path or not os.path.isfile(path):
        if path:
            sys.exit(f"FEHLER: Env-Datei nicht gefunden: {path}\n"
                     f"  Tipp: DEPLOY_ENV_FILE=/pfad/zur/deploy.env python3 deploy.py")
        return {}  # kein Pfad gesetzt → leeres Dict; Pflichtfeld-Check gibt Hinweis
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


def validate_ftps_target(host, port, remote):
    """FTPS-Ziel validieren, bevor Zugangsdaten in ein lftp-Skript gelangen."""
    try:
        ipaddress.ip_address(host)
    except ValueError:
        pass
    else:
        sys.exit("FEHLER: FTP_HOST muss der zum TLS-Zertifikat passende FQDN sein, keine IP-Adresse.")

    fqdn = host.rstrip(".")
    labels = fqdn.split(".")
    valid_label = re.compile(r"^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?$")
    if len(labels) < 2 or len(fqdn) > 253 or not all(valid_label.fullmatch(label) for label in labels):
        sys.exit("FEHLER: FTP_HOST ist kein gültiger FQDN für die TLS-Zertifikatsprüfung.")
    if not str(port).isdigit() or not 1 <= int(port) <= 65535:
        sys.exit("FEHLER: FTP_PORT muss zwischen 1 und 65535 liegen.")
    if not remote.startswith("/") or any(char in remote for char in ('\r', '\n', '"')):
        sys.exit("FEHLER: Das Remote-Ziel muss ein absoluter Pfad ohne Steuerzeichen oder Anführungszeichen sein.")


def build_lftp_commands(url, remote, dry_run):
    """Vollständiges lftp-Skript erzeugen; wird separat ohne Netzwerk getestet."""
    dry = "--dry-run" if dry_run else ""
    rm_dsstore = "" if dry_run else (
        f'rm -f "{remote}/.DS_Store"\n'
        f'rm -f "{remote}/audio/.DS_Store"\n'
        f'rm -f "{remote}/audio/botb/.DS_Store"\n'
        f'rm -f "{remote}/assets/.DS_Store"\n'
    )
    return (
        "set ftp:ssl-force true\n"
        "set ftp:ssl-protect-data true\n"
        "set ssl:verify-certificate yes\n"
        "set ssl:check-hostname yes\n"
        "set net:max-retries 2\n"
        "set net:timeout 25\n"
        "set cmd:fail-exit yes\n"
        f"open {url}\n"
        f'mirror -R --no-perms --parallel=1 -X .DS_Store {dry} "{LOCAL_DIST}/" "{remote}/"\n'
        f"{rm_dsstore}"
        "bye\n"
    )


def main():
    ap = argparse.ArgumentParser(description="FTPS-Deploy von frontend/dist auf dm0.de")
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
    # FTPS (FTP über TLS), Port 21. Der Upload-Account kann nur FTP, kein SFTP —
    # daher explizites FTPS mit erzwungenem TLS (Steuer- UND Datenkanal verschlüsselt).
    port = resolve(env, "port", "21")
    remote = args.remote or os.environ.get("DEPLOY_REMOTE_PATH") or resolve(env, "remote", DEFAULT_REMOTE)

    missing = [n for n, v in (("host", host), ("user", user), ("password", password)) if not v]
    if missing:
        sys.exit(f"FEHLER: In der Env-Datei fehlen Werte für: {', '.join(missing)} "
                 f"(erwartete Schlüssel-Namen u.a.: {ALIASES['host'][0]}/{ALIASES['user'][0]}/{ALIASES['password'][0]}).")

    validate_ftps_target(host, port, remote)

    print(f"→ Ziel: ftp(es)://{user}@{host}:{port}{remote}   (FTPS/TLS · Passwort verborgen)")
    print(f"→ Quelle: {LOCAL_DIST}")
    print(f"→ Modus: {'DRY-RUN (kein Schreiben)' if args.dry_run else 'UPLOAD'} · kein Löschen auf dem Server")

    # 3) lftp-Skript (Passwort URL-kodiert in der URL, kommt über stdin → nicht in ps)
    url = f"ftp://{quote(user, safe='')}:{quote(password, safe='')}@{host}:{port}"
    # mirror -R = reverse mirror (LOKAL → REMOTE). KEIN --delete → nichts wird gelöscht.
    # WICHTIG: KEIN --verbose! lftps Verbose-Modus würde pro Datei die volle
    # ftp://user:PASSWORT@host-URL ausgeben und so das Passwort im Terminal leaken.
    # Ohne --verbose zeigt lftp nur eine Transfer-Zusammenfassung.
    # .DS_Store (macOS) NIE hochladen (-X) und bereits hochgeladene Reste gezielt
    # entfernen (rm -f bricht nicht ab, wenn die Datei fehlt). Nur einzelne Dateien
    # werden gelöscht, KEINE Verzeichnisse.
    # FTPS-Zertifikatspruefung und single-connection Upload sind zentral im
    # testbaren Skript-Builder festgelegt.
    cmds = build_lftp_commands(url, remote, args.dry_run)

    # WICHTIG: lftp-Ausgabe NIE ungefiltert durchreichen. `mirror --dry-run` (und
    # verbose Läufe) echoen jede Transfer-Zeile MIT der vollen ftp://user:pass@host-
    # URL → sonst landet das Passwort im Klartext in Terminal/Session-Log. Darum
    # Output abfangen und jede Form des Geheimnisses (roh + URL-kodiert + ganze URL)
    # durch *** ersetzen, bevor irgendetwas gedruckt wird.
    proc = subprocess.run(["lftp"], input=cmds, text=True, capture_output=True)
    out = (proc.stdout or "") + (proc.stderr or "")
    for secret in (url, quote(password, safe=""), password):
        if secret:
            out = out.replace(secret, "***")
    if out.strip():
        print(out, end="" if out.endswith("\n") else "\n")
    if proc.returncode != 0:
        sys.exit(f"FEHLER: lftp endete mit Code {proc.returncode}.")
    print("✓ Fertig." + ("  (Dry-Run — nichts geschrieben)" if args.dry_run else "  Upload abgeschlossen."))


if __name__ == "__main__":
    main()
