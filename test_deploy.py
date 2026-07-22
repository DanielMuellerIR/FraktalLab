import unittest

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


if __name__ == "__main__":
    unittest.main()
