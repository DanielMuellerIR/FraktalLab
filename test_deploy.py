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
