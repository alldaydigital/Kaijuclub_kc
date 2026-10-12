"""Security and publication tests for the club's GitHub-backed vehicle CMS.

These tests use synthetic GitHub issues and in-memory images. They require no
GitHub token and never reach the network.
"""

from __future__ import annotations

import base64
import hashlib
import importlib.util
import io
import json
from pathlib import Path
import struct
import sys
import tempfile
import unittest
from unittest.mock import Mock
import zlib


REPO_ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location(
    "sync_vehicles", REPO_ROOT / "scripts" / "sync_vehicles.py"
)
assert SPEC and SPEC.loader
cms = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = cms
SPEC.loader.exec_module(cms)

REPOSITORY = "alldaydigital/Kaijuclub_kc"
PHOTO_URL = (
    "https://github.com/user-attachments/assets/"
    "12345678-1234-4234-9234-123456789abc"
)


def png_bytes(width: int = 2, height: int = 3) -> bytes:
    """Create a complete, decodable RGB PNG without fixture dependencies."""

    def chunk(kind: bytes, body: bytes) -> bytes:
        return (
            struct.pack(">I", len(body))
            + kind
            + body
            + struct.pack(">I", zlib.crc32(kind + body) & 0xFFFFFFFF)
        )

    header = struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)
    pixels = b"".join(b"\0" + b"\x20\x40\x60" * width for _ in range(height))
    return (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", header)
        + chunk(b"IDAT", zlib.compress(pixels))
        + chunk(b"IEND", b"")
    )


PNG = png_bytes()
JPEG = base64.b64decode(
    "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRof"
    "Hh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIR"
    "whMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIy"
    "MjIyMjIyMjIyMjL/wAARCAADAAIDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQF"
    "BgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0Kx"
    "wRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlq"
    "c3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJ"
    "ytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAEC"
    "AwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKR"
    "obHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVm"
    "Z2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbH"
    "yMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDzmiiivTPOP//Z"
)
WEBP = base64.b64decode(
    "UklGRjQAAABXRUJQVlA4ICgAAACQAQCdASoCAAMAAUAmJYgCdLoAA5gA/vfEX+SR6uY6D8VvqBmkAAAA"
)


def issue_body(**changes: str) -> str:
    fields = {
        "Wagen": "Nissan Skyline R32",
        "Discipline": "drift",
        "Foto's": f"![Skyline]({PHOTO_URL})",
        "Serie / model": "Skyline R32 · 1992",
        "Herkomst": "Japan",
        "Verhaal": "Gebouwd om samen te rijden.\n\nElke aanpassing heeft een reden.",
        "Specificaties": "Motor: RB20DET\nOnderstel: Coilovers",
        "Naam van de eigenaar": "Clubmember",
        "Publicatie": "Publiceren",
        "Uitgelicht": "Nee",
    }
    fields.update(changes)
    return "\n\n".join(f"### {heading}\n\n{value}" for heading, value in fields.items())


def issue(number: int = 17, **changes: object) -> dict:
    payload = {
        "number": number,
        "title": "[WAGEN] Nissan Skyline R32",
        "body": issue_body(),
        "labels": [{"name": "wagen"}],
        "state": "open",
        "author_association": "OWNER",
        "user": {"login": "clubowner"},
        "updated_at": "2026-10-12T13:00:00Z",
        "html_url": f"https://github.com/{REPOSITORY}/issues/{number}",
    }
    payload.update(changes)
    return payload


def can_write(username: str) -> bool:
    return username == "clubowner"


def image_asset(url: str = PHOTO_URL, repository: str = REPOSITORY):
    return cms.ImageAsset(
        data=PNG,
        extension="png",
        width=2,
        height=3,
        digest=hashlib.sha256(PNG).hexdigest(),
    )


class FakeResponse(io.BytesIO):
    def __init__(self, data: bytes, url: str = PHOTO_URL, **headers: str):
        super().__init__(data)
        self.status = 200
        self.url = url
        self.headers = {"Content-Type": "image/png", **headers}

    def geturl(self) -> str:
        return self.url


class IssueFormTests(unittest.TestCase):
    def test_unavailable_permission_check_fails_instead_of_removing_existing_cars(self):
        api = cms.GitHub('test-token', REPOSITORY)
        api.get = Mock(side_effect=cms.error.HTTPError('https://api.github.com/', 403, 'Forbidden', {}, None))
        with tempfile.TemporaryDirectory() as directory:
            public = Path(directory)
            cms.sync_catalog([issue()], public, REPOSITORY, can_write, image_fetcher=image_asset)
            saved = (public / 'data' / 'vehicles.json').read_bytes()
            with self.assertRaises(cms.ValidationError):
                cms.sync_catalog([issue()], public, REPOSITORY, api.can_write, image_fetcher=image_asset)
            self.assertEqual((public / 'data' / 'vehicles.json').read_bytes(), saved)

    def test_missing_collaborator_is_not_authorized(self):
        api = cms.GitHub('test-token', REPOSITORY)
        api.get = Mock(side_effect=cms.error.HTTPError('https://api.github.com/', 404, 'Not Found', {}, None))
        self.assertFalse(api.can_write('outsider'))

    def test_form_heading_parser_preserves_story_and_specification_lines(self):
        parsed = cms.parse_issue_body(issue_body())
        self.assertEqual(parsed["Wagen"], "Nissan Skyline R32")
        self.assertEqual(parsed["Discipline"], "drift")
        self.assertEqual(
            parsed["Verhaal"],
            "Gebouwd om samen te rijden.\n\nElke aanpassing heeft een reden.",
        )
        self.assertIn("Motor: RB20DET\nOnderstel: Coilovers", parsed["Specificaties"])

    def test_unrelated_and_test_issues_are_excluded_from_ordinary_sync(self):
        self.assertFalse(cms.is_managed_issue(issue(labels=[])))
        test_issue = issue(labels=[{"name": "wagen"}, {"name": "cms-test"}])
        self.assertFalse(cms.is_managed_issue(test_issue))
        self.assertTrue(cms.is_managed_issue(test_issue, test_mode=True))

    def test_owner_member_and_collaborator_each_require_actual_write_permission(self):
        for association in ("OWNER", "MEMBER", "COLLABORATOR"):
            with self.subTest(association=association):
                payload = issue(author_association=association)
                self.assertIsNotNone(cms.validate_issue(payload, REPOSITORY, can_write))
                self.assertIsNone(
                    cms.validate_issue(payload, REPOSITORY, lambda username: False)
                )

    def test_public_contributor_is_not_allowed_to_publish_even_with_matching_name(self):
        for association in ("NONE", "CONTRIBUTOR", "FIRST_TIMER", "FIRST_TIME_CONTRIBUTOR"):
            with self.subTest(association=association):
                self.assertIsNone(
                    cms.validate_issue(issue(author_association=association), REPOSITORY, can_write)
                )

    def test_drafts_closed_and_unrelated_issues_do_not_become_public_cars(self):
        excluded = [
            issue(body=issue_body(Publicatie="Concept")),
            issue(state="closed"),
            issue(labels=[]),
        ]
        for payload in excluded:
            with self.subTest(payload=payload):
                self.assertIsNone(cms.validate_issue(payload, REPOSITORY, can_write))

    def test_each_published_car_requires_name_discipline_and_photo(self):
        for field in ("Wagen", "Discipline", "Foto's"):
            with self.subTest(field=field):
                with self.assertRaises(cms.ValidationError):
                    cms.validate_issue(
                        issue(body=issue_body(**{field: "_No response_"})),
                        REPOSITORY,
                        can_write,
                    )

    def test_allowed_disciplines_work_and_unknown_discipline_is_rejected(self):
        for discipline in ("drift", "stance", "track", "street"):
            with self.subTest(discipline=discipline):
                self.assertIsNotNone(
                    cms.validate_issue(
                        issue(body=issue_body(Discipline=discipline)), REPOSITORY, can_write
                    )
                )
        with self.assertRaises(cms.ValidationError):
            cms.validate_issue(
                issue(body=issue_body(Discipline="Drag racing")), REPOSITORY, can_write
            )

    def test_too_many_photos_is_rejected_before_any_publication(self):
        photos = "\n".join(
            f"https://github.com/user-attachments/assets/12345678-1234-4234-9234-{n:012d}"
            for n in range(13)
        )
        with self.assertRaises(cms.ValidationError):
            cms.validate_issue(
                issue(body=issue_body(**{"Foto's": photos})), REPOSITORY, can_write
            )

    def test_very_long_name_is_rejected(self):
        with self.assertRaises(cms.ValidationError):
            cms.validate_issue(
                issue(body=issue_body(Wagen="A" * 10000)), REPOSITORY, can_write
            )


class PhotoSecurityTests(unittest.TestCase):
    def test_github_attachment_url_and_exact_repository_image_url_are_accepted(self):
        allowed = [
            PHOTO_URL,
            "https://user-images.githubusercontent.com/123456/12345678-car.png",
            "https://github-production-user-asset-6210df.s3.amazonaws.com/123456/car.png?X-Amz-Signature=fixture",
            f"https://raw.githubusercontent.com/{REPOSITORY}/main/public/images/skyline.jpg",
        ]
        for url in allowed:
            with self.subTest(url=url):
                self.assertEqual(cms.validate_image_url(url, REPOSITORY), url)

    def test_non_github_private_plaintext_and_traversal_urls_are_rejected(self):
        disallowed = [
            "http://github.com/user-attachments/assets/12345678-1234-4234-9234-123456789abc",
            "https://127.0.0.1/car.png",
            "https://localhost/car.png",
            "https://169.254.169.254/latest/meta-data/",
            "https://[::1]/car.png",
            "https://example.com/car.png",
            "https://github.com.evil.example/user-attachments/assets/12345678-1234-4234-9234-123456789abc",
            "https://github.com@evil.example/car.png",
            "https://someone:password@github.com/user-attachments/assets/12345678-1234-4234-9234-123456789abc",
            "https://github.com:8443/user-attachments/assets/12345678-1234-4234-9234-123456789abc",
            "https://github.com/alldaydigital/Kaijuclub_kc/blob/main/private.txt",
            "https://github.com/user-attachments/assets/not-a-uuid",
            "https://raw.githubusercontent.com/another/repository/main/public/images/car.jpg",
            f"https://raw.githubusercontent.com/{REPOSITORY}/main/private.txt",
            f"https://raw.githubusercontent.com/{REPOSITORY}/main/public/images/../../private.txt",
            f"https://raw.githubusercontent.com/{REPOSITORY}/main/public/images/%2e%2e/private.txt",
            "file:///etc/passwd",
            "data:image/png;base64,aGVsbG8=",
        ]
        for url in disallowed:
            with self.subTest(url=url):
                with self.assertRaises(cms.ValidationError):
                    cms.validate_image_url(url, REPOSITORY)

    def test_png_is_decoded_and_dimensions_and_checksum_are_recorded(self):
        opener = Mock()
        opener.open.return_value = FakeResponse(PNG)
        asset = cms.fetch_image(PHOTO_URL, REPOSITORY, opener=opener)
        self.assertEqual(asset.data, PNG)
        self.assertEqual((asset.extension, asset.width, asset.height), ("png", 2, 3))
        self.assertEqual(asset.digest, hashlib.sha256(PNG).hexdigest())
        request = opener.open.call_args.args[0]
        self.assertEqual(request.full_url, PHOTO_URL)

    def test_jpeg_and_webp_are_supported_with_verified_dimensions(self):
        for data, extension in ((JPEG, "jpg"), (WEBP, "webp")):
            with self.subTest(extension=extension):
                opener = Mock()
                opener.open.return_value = FakeResponse(data)
                asset = cms.fetch_image(PHOTO_URL, REPOSITORY, opener=opener)
                self.assertEqual((asset.extension, asset.width, asset.height), (extension, 2, 3))

    def test_invalid_image_svg_and_gif_are_rejected(self):
        gif = b"GIF89a\x01\x00\x01\x00\x80\x00\x00\x00\x00\x00\xff\xff\xff!\xf9\x04\x01\x00\x00\x00\x00,\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02\x02D\x01\x00;"
        for data in (b"not an image", b"<svg xmlns='http://www.w3.org/2000/svg'></svg>", gif):
            with self.subTest(data=data[:20]):
                opener = Mock()
                opener.open.return_value = FakeResponse(data)
                with self.assertRaises(cms.ValidationError):
                    cms.fetch_image(PHOTO_URL, REPOSITORY, opener=opener)

    def test_truncated_png_cannot_be_published(self):
        opener = Mock()
        opener.open.return_value = FakeResponse(PNG[:40])
        with self.assertRaises(cms.ValidationError):
            cms.fetch_image(PHOTO_URL, REPOSITORY, opener=opener)

    def test_oversized_declared_and_actual_downloads_are_rejected(self):
        for data, headers in (
            (PNG, {"Content-Length": str(16 * 1024 * 1024)}),
            (b"X" * (15 * 1024 * 1024 + 1), {}),
        ):
            with self.subTest(declared=headers):
                opener = Mock()
                opener.open.return_value = FakeResponse(data, **headers)
                with self.assertRaises(cms.ValidationError):
                    cms.fetch_image(PHOTO_URL, REPOSITORY, opener=opener)

    def test_unsafe_final_response_url_is_rejected(self):
        opener = Mock()
        opener.open.return_value = FakeResponse(PNG, url="https://127.0.0.1/private.png")
        with self.assertRaises(cms.ValidationError):
            cms.fetch_image(PHOTO_URL, REPOSITORY, opener=opener)


class CatalogPublicationTests(unittest.TestCase):
    def sync(self, issues, root, **options):
        return cms.sync_catalog(
            issues,
            Path(root),
            REPOSITORY,
            can_write,
            image_fetcher=image_asset,
            **options,
        )

    def test_catalog_has_local_media_and_complete_real_car_metadata(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary) / "public"
            result = self.sync([issue()], root)
            saved = json.loads((root / "data" / "vehicles.json").read_text())
            self.assertEqual(result, saved)
            self.assertEqual(saved["schemaVersion"], 1)
            self.assertEqual(len(saved["vehicles"]), 1)
            car = saved["vehicles"][0]
            self.assertEqual(car["id"], "club-17")
            self.assertEqual(car["name"], "Nissan Skyline R32")
            self.assertEqual(car["category"], "drift")
            self.assertIs(car["reference"], False)
            self.assertEqual((car["width"], car["height"]), (2, 3))
            self.assertEqual(car["gallery"][0]["src"], car["image"])
            self.assertTrue(car["image"].startswith("/images/vehicles/17/"))
            self.assertEqual((root / car["image"].lstrip("/")).read_bytes(), PNG)
            self.assertEqual(car["specs"][0], {"label": "Motor", "value": "RB20DET"})
            self.assertIn("Gebouwd om samen te rijden.", car["intro"])

    def test_second_invalid_issue_leaves_last_good_catalog_and_images_untouched(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary) / "public"
            self.sync([issue()], root)
            before = {
                str(path.relative_to(root)): path.read_bytes()
                for path in root.rglob("*")
                if path.is_file()
            }
            invalid = issue(number=18, body=issue_body(Discipline="invalid"))
            with self.assertRaises(cms.ValidationError):
                self.sync([issue(), invalid], root)
            after = {
                str(path.relative_to(root)): path.read_bytes()
                for path in root.rglob("*")
                if path.is_file()
            }
            self.assertEqual(before, after)

    def test_failed_image_download_leaves_existing_catalog_unchanged(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary) / "public"
            self.sync([issue()], root)
            before = (root / "data" / "vehicles.json").read_bytes()
            fetcher = Mock(side_effect=cms.ValidationError("Download failed"))
            with self.assertRaises(cms.ValidationError):
                cms.sync_catalog(
                    [issue(number=18)], root, REPOSITORY, can_write, image_fetcher=fetcher
                )
            self.assertEqual(before, (root / "data" / "vehicles.json").read_bytes())
            self.assertFalse((root / "images" / "vehicles" / "18").exists())

    def test_draft_cars_keep_a_managed_catalog_empty_instead_of_restoring_demo_cars(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary) / "public"
            draft = issue(body=issue_body(Publicatie="Concept"))
            result = self.sync([draft], root)
            self.assertEqual(result["vehicles"], [])

    def test_repeat_sync_is_deterministic(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary) / "public"
            self.sync([issue()], root)
            before = (root / "data" / "vehicles.json").read_bytes()
            self.sync([issue()], root)
            self.assertEqual(before, (root / "data" / "vehicles.json").read_bytes())

    def test_cleanup_preserves_unowned_files_and_files_outside_media_folder(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary) / "public"
            keep = root / "images" / "vehicles" / "17" / "notes.txt"
            keep.parent.mkdir(parents=True)
            keep.write_text("User file: do not delete.")
            other = root / "images" / "existing.jpg"
            other.write_bytes(b"existing photo")
            outside = Path(temporary) / "outside.txt"
            outside.write_text("Outside the public directory.")
            self.sync([issue()], root)
            self.sync([issue(state="closed")], root)
            self.assertEqual(keep.read_text(), "User file: do not delete.")
            self.assertEqual(other.read_bytes(), b"existing photo")
            self.assertEqual(outside.read_text(), "Outside the public directory.")

    def test_dry_run_never_writes_or_cleans_files(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary) / "public"
            result = self.sync([issue()], root, dry_run=True)
            self.assertEqual(len(result["vehicles"]), 1)
            self.assertFalse(root.exists())


if __name__ == "__main__":
    unittest.main()
