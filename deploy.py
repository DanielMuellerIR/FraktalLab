#!/usr/bin/env python3
"""
deploy.py — Upload des Production-Builds auf den Netcup-Webspace (dm0.de) per FTPS.

Lädt NUR den fertigen Build (frontend/dist/) hoch — also exakt das, was zum
Betrieb der Seite nötig ist. KEINE Quell-/Doku-Dateien (AGENTS.md etc.).

Sicherheit:
  • Die Zugangsdaten werden aus einer Env-Datei gelesen (Default: Sticky/chili.env).
    Sie tauchen NICHT in der Prozessliste auf (lftp-Kommandos kommen über stdin,
    Passwort URL-kodiert in der ftp://-URL) und werden NIE ausgegeben.
  • Der Upload läuft ohne `--delete` (lftp `mirror -R`): es wird nie ein
    Verzeichnis gelöscht und nie etwas, das der Build zufällig nicht enthält.
    Gelöscht werden ausschließlich die einzelnen, namentlich in
    STALE_REMOTE_FILES aufgeführten Altdateien.
  • Der Hostname für die TLS-Zertifikatsprüfung kommt ausschließlich aus der
    Konfiguration, nie aus einer DNS-Antwort (siehe resolve_tls_host).

Benutzung:
  python3 deploy.py            # baut + lädt hoch
  python3 deploy.py --dry-run  # zeigt nur, was hochgeladen würde (kein Schreiben)
  python3 deploy.py --no-build # ohne Neubau (nutzt vorhandenes frontend/dist)
  python3 deploy.py --env PFAD # andere Env-Datei
  python3 deploy.py --remote /pfad  # anderes Zielverzeichnis
  python3 deploy.py --tls-host name.example  # TLS-Name, wenn FTP_HOST eine IP ist

  Umgebungsvariablen (Alternative zu --env):
    DEPLOY_ENV_FILE=/pfad/zur/chili.env python3 deploy.py
    DEPLOY_TLS_HOST=upload.example.com python3 deploy.py

Voraussetzungen: `lftp` (brew install lftp), `npm` (für den Build).
"""

import argparse
import ipaddress
import os
import re
import shutil
import socket
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
    # Nur nötig, wenn "host" eine IP-Adresse ist: der Name, gegen den das
    # TLS-Zertifikat geprüft wird (siehe resolve_tls_host).
    "tls_host": ["FTP_TLS_HOST", "SFTP_TLS_HOST", "DEPLOY_TLS_HOST", "TLS_HOST"],
}

# ── Altdateien auf dem Server ─────────────────────────────────────────────────
# Der Upload spiegelt frontend/dist nur HINZU (`mirror -R` ohne `--delete`).
# Das ist Absicht: Ein fehlgeschlagener oder unvollständiger Build würde mit
# `--delete` die komplette Seite auf dem Webspace löschen. Die Kehrseite ist,
# dass eine Datei, die aus dem Build genommen wurde, oben liegen bleibt und
# öffentlich abrufbar ist. Deshalb hier eine ausdrückliche Liste einzelner
# Dateien, die nach dem Upload gelöscht werden — bewusst KEINE Verzeichnisse.
#
# Woher die Einträge kommen:
#   • .DS_Store: macOS-Reste aus früheren Uploads.
#   • enhance/street-*.jpg, enhance/manifest.json, enhance/curated/curated-*.jpg:
#     am 2026-08-03 aus dem Build genommene Bilder ohne belegte Lizenz. Sie
#     liegen jetzt unter frontend/disabled-assets/ und dürfen nicht länger
#     ausgeliefert werden (siehe deren README-Dateien).
# Pfade sind relativ zum Remote-Wurzelverzeichnis, also genau die Pfade, unter
# denen die Dateien auch in frontend/dist lagen.
STALE_REMOTE_FILES = (
    [
        ".DS_Store",
        "audio/.DS_Store",
        "audio/botb/.DS_Store",
        "assets/.DS_Store",
    ]
    + [f"enhance/street-{n}.jpg" for n in range(6)]
    + ["enhance/manifest.json"]
    + [f"enhance/curated/curated-{n}.jpg" for n in range(17)]
)


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


def forward_addresses(name):
    """Alle IP-Adressen, auf die ein Hostname aktuell zeigt (Vorwärtsauflösung).
    Eigene Funktion, damit die Tests sie ohne echtes DNS ersetzen können."""
    return {info[4][0] for info in socket.getaddrinfo(name, None)}


def resolve_tls_host(host, tls_host):
    """Den Hostnamen bestimmen, gegen den lftp das TLS-Zertifikat prüft.

    Dieser Name entscheidet, wem die Zugangsdaten anvertraut werden — er MUSS
    deshalb aus der Konfiguration kommen und nie aus einer DNS-Antwort. Früher
    wurde bei einer konfigurierten IP der Reverse-DNS-Name (PTR) ungeprüft
    übernommen; ein falscher oder manipulierter PTR-Eintrag hätte damit das
    Upload-Ziel bestimmt und das FTP-Passwort an einen fremden Server geleitet.

    Ist "host" bereits ein Name, bleibt er unverändert. Ist "host" eine
    IP-Adresse, muss zusätzlich ein TLS-Host konfiguriert sein (Env-Datei,
    DEPLOY_TLS_HOST oder --tls-host); dessen Vorwärtsauflösung muss die
    konfigurierte IP enthalten. Fehlt der Wert oder passt er nicht, bricht der
    Deploy ab, bevor überhaupt Zugangsdaten zusammengebaut werden."""
    if not host:
        return host
    try:
        ip = ipaddress.ip_address(host)
    except ValueError:
        return host  # bereits ein Hostname, nichts zu tun

    key = ALIASES["tls_host"][0]
    if not tls_host:
        sys.exit(
            f"FEHLER: FTP_HOST ist eine IP-Adresse ({host}); für die TLS-Zertifikatsprüfung "
            f"wird der zugehörige Hostname gebraucht.\n"
            f"  Abhilfe: {key}=name.example.com in die Env-Datei eintragen "
            f"(oder DEPLOY_TLS_HOST setzen bzw. --tls-host übergeben).\n"
            f"  Der Name wird bewusst NICHT per Reverse-DNS geraten: eine DNS-Antwort darf "
            f"nicht entscheiden, wohin die Zugangsdaten gehen."
        )

    try:
        addresses = forward_addresses(tls_host)
    except OSError as err:
        sys.exit(f"FEHLER: {key} '{tls_host}' ist nicht auflösbar ({err}).")
    resolved = set()
    for addr in addresses:
        try:
            resolved.add(ipaddress.ip_address(addr))
        except ValueError:
            continue  # z.B. Adresse mit Scope-ID → für den Vergleich unbrauchbar
    if ip not in resolved:
        listed = ", ".join(sorted(str(a) for a in resolved)) or "keine"
        sys.exit(
            f"FEHLER: {key} '{tls_host}' zeigt nicht auf die konfigurierte FTP_HOST-Adresse "
            f"{host} (aufgelöst: {listed}). Deploy abgebrochen, bevor Zugangsdaten entstehen."
        )
    print(f"→ FTP_HOST ist eine IP; verbinde über '{tls_host}' aus der Konfiguration "
          f"(Vorwärtsauflösung auf {host} geprüft).")
    return tls_host


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
    # Jede Altdatei einzeln mit `rm -f` entfernen. `rm -f` meldet keinen Fehler,
    # wenn die Datei gar nicht (mehr) da ist — der Deploy läuft also auch dann
    # durch, wenn ein Eintrag längst gelöscht wurde.
    rm_stale = "" if dry_run else "".join(
        f'rm -f "{remote}/{name}"\n' for name in STALE_REMOTE_FILES
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
        f"{rm_stale}"
        "bye\n"
    )


def main():
    ap = argparse.ArgumentParser(description="FTPS-Deploy von frontend/dist auf dm0.de")
    ap.add_argument("--env", default=os.environ.get("DEPLOY_ENV_FILE", DEFAULT_ENV))
    ap.add_argument("--remote", default=None, help="Zielverzeichnis auf dem Server")
    ap.add_argument("--tls-host", default=None,
                    help="Hostname für die TLS-Zertifikatsprüfung, wenn FTP_HOST eine IP ist")
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
    # TLS-Name aus vertrauenswürdiger Konfiguration: CLI vor Umgebungsvariable
    # vor Env-Datei. Wird nur gebraucht, wenn FTP_HOST eine IP-Adresse ist.
    tls_host = args.tls_host or os.environ.get("DEPLOY_TLS_HOST") or resolve(env, "tls_host")
    host = resolve_tls_host(resolve(env, "host"), tls_host)
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
    print(f"→ Modus: {'DRY-RUN (kein Schreiben)' if args.dry_run else 'UPLOAD'} · "
          f"kein Verzeichnis-Löschen, nur {len(STALE_REMOTE_FILES)} bekannte Altdateien")

    # 3) lftp-Skript (Passwort URL-kodiert in der URL, kommt über stdin → nicht in ps)
    url = f"ftp://{quote(user, safe='')}:{quote(password, safe='')}@{host}:{port}"
    # mirror -R = reverse mirror (LOKAL → REMOTE). KEIN --delete → nichts wird gelöscht.
    # WICHTIG: KEIN --verbose! lftps Verbose-Modus würde pro Datei die volle
    # ftp://user:PASSWORT@host-URL ausgeben und so das Passwort im Terminal leaken.
    # Ohne --verbose zeigt lftp nur eine Transfer-Zusammenfassung.
    # .DS_Store (macOS) NIE hochladen (-X). Bereits hochgeladene Reste und aus dem
    # Build genommene Altdateien werden gezielt entfernt (rm -f bricht nicht ab,
    # wenn die Datei fehlt) — siehe STALE_REMOTE_FILES. Nur einzelne Dateien
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
