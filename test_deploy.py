import os
import re
import tempfile
import unittest
from unittest import mock

import deploy


class DeploySecurityTests(unittest.TestCase):
    def test_accepts_fqdn_and_builds_verified_ftps_script(self):
        deploy.validate_ftps_target("upload.example.com", "21", "/htdocs/x")
        script = deploy.build_lftp_commands(
            "ftp://user:password@upload.example.com:21",
            "/htdocs/x",
            True,
        )
        self.assertIn("set ftp:ssl-force true", script)
        self.assertIn("set ftp:ssl-protect-data true", script)
        self.assertIn("set ssl:verify-certificate yes", script)
        self.assertIn("set ssl:check-hostname yes", script)
        self.assertNotIn("set ssl:verify-certificate no", script)
        self.assertIn("--dry-run", script)

    def test_rejects_ip_target_before_credentials_are_used(self):
        with self.assertRaisesRegex(SystemExit, "FQDN"):
            deploy.validate_ftps_target("192.0.2.1", "21", "/htdocs/x")

    def test_rejects_command_injection_in_remote_path(self):
        with self.assertRaisesRegex(SystemExit, "Remote-Ziel"):
            deploy.validate_ftps_target("upload.example.com", "21", '/htdocs"\nbye')


class StaleRemoteFileTests(unittest.TestCase):
    """Der Upload spiegelt nur hinzu. Aus dem Build genommene Dateien muessen
    deshalb ausdruecklich geloescht werden, sonst bleiben sie oeffentlich
    abrufbar — genau das war bei den 23 Enhance-JPEGs und der manifest.json
    passiert. Diese Tests gleichen Archiv, historische Ausnahmen und das
    erzeugte lftp-Skript gegeneinander ab."""

    REMOTE = "/htdocs/x"

    def upload_script(self):
        """Das echte (nicht dry-run) Skript, so wie es an lftp geht."""
        return deploy.build_lftp_commands(
            "ftp://user:password@upload.example.com:21", self.REMOTE, False,
        )

    def test_stale_list_is_exactly_archive_plus_explicit_history(self):
        expected = deploy.LEGACY_STALE_REMOTE_FILES + deploy.disabled_asset_remote_files()
        self.assertEqual(deploy.STALE_REMOTE_FILES, expected)

        removed = re.findall(r'^rm -f "([^"]+)"$', self.upload_script(), re.MULTILINE)
        self.assertEqual(removed, [f"{self.REMOTE}/{name}" for name in expected])

    def test_history_only_files_are_removed_too(self):
        required = {
            "target.jpg",
            "audio/botb/botb-14870.sid",
            "audio/track_142827.mod.bin",
            "audio/track_58072.mod.bin",
            "audio/track_87180.mod.bin",
        }
        self.assertLessEqual(required, set(deploy.STALE_REMOTE_FILES))

    def test_archive_scan_ignores_docs_hidden_files_and_symlinks(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            base = os.path.join(temp_dir, "disabled-assets")
            street = os.path.join(base, "enhance-street")
            curated = os.path.join(base, "enhance-curated")
            os.makedirs(os.path.join(street, "nested"))
            os.makedirs(curated)
            for path in (
                os.path.join(street, "README.md"),
                os.path.join(street, ".DS_Store"),
                os.path.join(street, "street-0.jpg"),
                os.path.join(street, "nested", "manifest.json"),
            ):
                with open(path, "wb") as file:
                    file.write(b"x")
            os.symlink(
                os.path.join(street, "street-0.jpg"),
                os.path.join(curated, "link.jpg"),
            )
            self.assertEqual(
                deploy.disabled_asset_remote_files(base),
                ("enhance/street-0.jpg", "enhance/nested/manifest.json"),
            )

    def test_archive_scan_rejects_unmapped_folder(self):
        with tempfile.TemporaryDirectory() as base:
            for folder in (*deploy.DISABLED_ASSET_REMOTE_DIRS, "new-disabled-assets"):
                os.makedirs(os.path.join(base, folder))
            with self.assertRaisesRegex(RuntimeError, "new-disabled-assets"):
                deploy.disabled_asset_remote_files(base)

    def test_upload_never_deletes_directories_or_mirrors_with_delete(self):
        # Die gesamte Spiegelzeile ist der Vertrag. So fallen auch Kurzformen
        # wie `-e` oder Varianten wie --Remove-source-files auf.
        script = self.upload_script()
        mirror = next(line for line in script.splitlines() if line.startswith("mirror "))
        self.assertEqual(
            mirror,
            f'mirror -R --no-perms --parallel=1 -X .DS_Store '
            f'"{deploy.LOCAL_DIST}/" "{self.REMOTE}/"',
        )
        self.assertNotIn("rm -r", script)
        self.assertNotIn("rmdir", script)

    def test_rejects_traversal_and_noncanonical_paths(self):
        with tempfile.TemporaryDirectory() as local_dist:
            for path in ("../index.html", "/index.html", "assets//x.js", "assets\\x.js"):
                with self.subTest(path=path):
                    with self.assertRaisesRegex(ValueError, "Unsicherer"):
                        deploy.validate_stale_remote_files((path,), local_dist)

    def test_rejects_stale_name_that_exists_in_current_build(self):
        with tempfile.TemporaryDirectory() as local_dist:
            collision = os.path.join(local_dist, "enhance", "manifest.json")
            os.makedirs(os.path.dirname(collision))
            with open(collision, "wb") as file:
                file.write(b"current")
            with self.assertRaisesRegex(ValueError, "kollidiert"):
                deploy.build_lftp_commands(
                    "opaque-test-url",
                    self.REMOTE,
                    False,
                    local_dist=local_dist,
                    stale_files=("enhance/manifest.json",),
                )

    def test_no_stale_name_exists_in_public_source(self):
        public = os.path.join(deploy.SCRIPT_DIR, "frontend", "public")
        for name in deploy.STALE_REMOTE_FILES:
            with self.subTest(name=name):
                self.assertFalse(os.path.exists(os.path.join(public, *name.split("/"))))

    def test_dry_run_deletes_nothing_at_all(self):
        script = deploy.build_lftp_commands(
            "ftp://user:password@upload.example.com:21", self.REMOTE, True,
        )
        self.assertNotIn("rm -f", script)

    def test_dry_run_lists_every_planned_delete_without_claiming_to_delete(self):
        lines = deploy.stale_mode_lines(self.REMOTE, True, ("old-a.jpg", "old-b.sid"))
        self.assertIn("2 geplante Altdatei-Löschungen", lines[0])
        self.assertIn("nur angezeigt", lines[0])
        self.assertEqual(lines[1:], [
            f"  - {self.REMOTE}/old-a.jpg",
            f"  - {self.REMOTE}/old-b.sid",
        ])


class ResolveTlsHostTests(unittest.TestCase):
    """Der TLS-Name entscheidet, wem die Zugangsdaten anvertraut werden. Diese
    Tests faelschen die Namensaufloesung und pruefen, dass DNS ihn nie bestimmt."""

    def test_configured_hostname_is_used_without_any_dns_lookup(self):
        with mock.patch.object(deploy, "forward_addresses",
                               side_effect=AssertionError("kein DNS noetig")):
            self.assertEqual(
                deploy.resolve_tls_host("upload.example.com", None),
                "upload.example.com",
            )

    def test_ip_without_configured_tls_host_fails_closed(self):
        with self.assertRaisesRegex(SystemExit, "FTP_TLS_HOST"):
            deploy.resolve_tls_host("192.0.2.1", None)

    def test_reverse_dns_answer_never_becomes_the_target(self):
        # Regression: frueher uebernahm resolve_host_to_fqdn den PTR-Namen
        # ungeprueft. Selbst ein "perfekter" PTR-Eintrag darf jetzt nichts mehr
        # entscheiden — ohne konfigurierten TLS-Host bricht der Deploy ab.
        with mock.patch("socket.gethostbyaddr", return_value=("angreifer.example.net", [], ["192.0.2.1"])):
            with self.assertRaises(SystemExit):
                deploy.resolve_tls_host("192.0.2.1", None)

    def test_configured_tls_host_is_forward_checked_against_the_ip(self):
        with mock.patch.object(deploy, "forward_addresses", return_value={"192.0.2.1"}):
            self.assertEqual(
                deploy.resolve_tls_host("192.0.2.1", "upload.example.com"),
                "upload.example.com",
            )

    def test_tls_host_pointing_elsewhere_aborts(self):
        with mock.patch.object(deploy, "forward_addresses", return_value={"198.51.100.7"}):
            with self.assertRaisesRegex(SystemExit, "zeigt nicht auf"):
                deploy.resolve_tls_host("192.0.2.1", "angreifer.example.net")

    def test_unresolvable_tls_host_aborts(self):
        with mock.patch.object(deploy, "forward_addresses", side_effect=OSError("kein DNS")):
            with self.assertRaisesRegex(SystemExit, "nicht auflösbar"):
                deploy.resolve_tls_host("192.0.2.1", "upload.example.com")

    def test_ipv6_host_is_compared_normalized(self):
        # 2001:db8::1 und 2001:0db8:0000::0001 sind dieselbe Adresse.
        with mock.patch.object(deploy, "forward_addresses", return_value={"2001:0db8:0000:0000:0000:0000:0000:0001"}):
            self.assertEqual(
                deploy.resolve_tls_host("2001:db8::1", "upload.example.com"),
                "upload.example.com",
            )


if __name__ == "__main__":
    unittest.main()
