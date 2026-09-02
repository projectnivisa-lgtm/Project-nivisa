"""File storage, behind one interface.

Three providers, one interface:

  * `local` writes to a Docker volume and the API serves the files back;
  * `s3`    is any S3-compatible bucket - AWS, R2, Spaces, Wasabi;
  * `bunny` is Bunny Edge Storage over Bunny's own API, with a pull zone in
            front. Bunny's S3 endpoint is still in public preview, so it gets
            a provider of its own rather than being filed under `s3`.

The API always hands out a URL, never a filesystem path, so the storefront and
dashboard are already written against the production shape.
"""
import logging
import mimetypes
import os
import re
import struct
import uuid
from abc import ABC, abstractmethod
from datetime import date
from pathlib import Path

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/avif", "image/svg+xml"}
ALLOWED_DOC_TYPES = {"application/pdf"}

# 3D models for AR. Browsers and operating systems are inconsistent about the
# Content-Type they attach to these - a .glb often arrives as
# application/octet-stream and a .usdz as application/zip, because USDZ *is* a
# zip - so the extension is checked alongside the type rather than trusting
# either alone.
ALLOWED_MODEL_TYPES = {
    "model/gltf-binary", "model/gltf+json", "model/vnd.usdz+zip",
    "application/octet-stream", "application/zip",
}
ALLOWED_MODEL_EXTENSIONS = {".glb", ".gltf", ".usdz"}
_SAFE_NAME = re.compile(r"[^A-Za-z0-9._-]+")


class UnsupportedFile(ValueError):
    pass


def safe_filename(original: str) -> str:
    """A name that cannot escape the upload root or collide.

    The uuid prefix is what makes it safe: without it, two people uploading
    `sofa.jpg` overwrite each other, and a crafted `../../.env` would be
    merely renamed rather than made harmless.
    """
    stem = _SAFE_NAME.sub("-", Path(original).stem)[:60].strip("-") or "file"
    suffix = _SAFE_NAME.sub("", Path(original).suffix)[:10].lower()
    return f"{uuid.uuid4().hex[:12]}-{stem}{suffix}"


def check_type(content_type: str | None, *, allow_documents: bool = False) -> None:
    allowed = ALLOWED_IMAGE_TYPES | (ALLOWED_DOC_TYPES if allow_documents else set())
    if content_type not in allowed:
        raise UnsupportedFile(
            f"{content_type or 'That file type'} is not accepted. "
            f"Allowed: {', '.join(sorted(allowed))}."
        )


def check_model(filename: str, content_type: str | None) -> str:
    """Validate a 3D upload and return its normalised extension.

    The extension is the authority here, not the Content-Type: a .glb is
    routinely sent as application/octet-stream, so trusting the type alone
    would reject valid models, and trusting it *instead* of the extension
    would accept an .exe renamed by a browser that guessed generously.
    """
    suffix = Path(filename).suffix.lower()
    if suffix not in ALLOWED_MODEL_EXTENSIONS:
        raise UnsupportedFile(
            f"{suffix or 'That file'} is not a 3D model. "
            f"Upload one of: {', '.join(sorted(ALLOWED_MODEL_EXTENSIONS))}."
        )
    if content_type and content_type not in ALLOWED_MODEL_TYPES:
        raise UnsupportedFile(f"{content_type} is not accepted for a 3D model.")
    return suffix


def check_model_bytes(suffix: str, data: bytes) -> None:
    """Check the file is the format its name claims, by reading its container.

    An extension is a claim, not a fact. Anything at all renamed `.glb` used
    to pass every check here, be stored, be published, and reach a customer's
    phone - where Scene Viewer fails silently and the piece simply never
    appears in their room. Nobody finds out, because the one person who would
    is the customer, and they just leave.

    Both formats declare themselves in their first bytes, so this is cheap and
    certain. It is deliberately a container check and not a full parse: the
    job is to catch a file that is not the format at all, not to lint a model
    a real exporter produced.
    """
    if suffix == ".usdz":
        # USDZ is an uncompressed zip archive, so it starts with the zip
        # local-file-header signature like any other.
        if data[:4] != b"PK":
            raise UnsupportedFile(
                "That file is not a .usdz. A USDZ is a zip archive, and this one "
                "does not begin like one - it may have been renamed."
            )
        return

    if suffix not in (".glb", ".gltf"):
        return

    if suffix == ".gltf":
        # Text glTF: JSON, and it has to name a version.
        head = data[:512].lstrip()
        if not head.startswith(b"{") or b'"asset"' not in data[:4096]:
            raise UnsupportedFile(
                "That file is not a .gltf. A glTF file is JSON with an \"asset\" block."
            )
        return

    # Binary glTF: a 12-byte header, then length-prefixed chunks, the first
    # of which is the JSON scene description.
    if len(data) < 20 or data[:4] != b"glTF":
        raise UnsupportedFile(
            "That file is not a .glb. A GLB begins with the bytes 'glTF' and this "
            "one does not - it may have been renamed."
        )

    version, declared = struct.unpack_from("<II", data, 4)
    if version != 2:
        raise UnsupportedFile(
            f"That .glb is glTF version {version}. Only version 2 is supported."
        )
    if declared != len(data):
        raise UnsupportedFile(
            f"That .glb says it is {declared} bytes but is {len(data)}. It is "
            "truncated, or it is not really a GLB."
        )

    chunk_length, chunk_type = struct.unpack_from("<I4s", data, 12)
    if chunk_type != b"JSON":
        raise UnsupportedFile(
            "That .glb does not start with a JSON chunk, so it is not a readable "
            "model. Re-export it from the program that made it."
        )
    if 20 + chunk_length > len(data):
        raise UnsupportedFile("That .glb is truncated - its JSON chunk runs past the end.")


class StorageProvider(ABC):
    name: str

    @abstractmethod
    async def save(self, *, data: bytes, filename: str, content_type: str, folder: str) -> str:
        """Returns the URL the file is readable at."""

    @abstractmethod
    async def delete(self, url: str) -> None:
        ...


class LocalStorage(StorageProvider):
    name = "local"

    def __init__(self) -> None:
        self.root = Path(settings.MEDIA_ROOT)
        self.root.mkdir(parents=True, exist_ok=True)

    def _key(self, folder: str, filename: str) -> str:
        # Dated subfolders keep any single directory small enough that `ls`
        # and a backup rsync stay usable once there are 50k images.
        today = date.today()
        return f"{folder}/{today:%Y/%m}/{filename}"

    async def save(self, *, data: bytes, filename: str, content_type: str, folder: str) -> str:
        key = self._key(folder, safe_filename(filename))
        target = self.root / key
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)
        return f"{settings.MEDIA_URL_PREFIX}/{key}"

    async def delete(self, url: str) -> None:
        if not url.startswith(settings.MEDIA_URL_PREFIX):
            return
        key = url[len(settings.MEDIA_URL_PREFIX):].lstrip("/")
        target = (self.root / key).resolve()
        # Refuse anything that resolved outside the media root - a stored URL
        # is data, and data can be tampered with.
        if not str(target).startswith(str(self.root.resolve())):
            logger.warning("Refusing to delete outside media root: %s", url)
            return
        try:
            os.remove(target)
        except FileNotFoundError:
            pass


class S3Storage(StorageProvider):
    name = "s3"

    def __init__(self) -> None:
        import boto3  # imported lazily so `local` needs no AWS dependency at runtime

        missing = [k for k in ("S3_BUCKET", "S3_ACCESS_KEY", "S3_SECRET_KEY") if not getattr(settings, k)]
        if missing:
            raise RuntimeError("STORAGE_PROVIDER=s3 but these are unset: " + ", ".join(missing))

        self._bucket = settings.S3_BUCKET
        self._public_base = settings.S3_PUBLIC_BASE_URL.rstrip("/")
        self._client = boto3.client(
            "s3",
            endpoint_url=settings.S3_ENDPOINT_URL or None,
            region_name=settings.S3_REGION,
            aws_access_key_id=settings.S3_ACCESS_KEY,
            aws_secret_access_key=settings.S3_SECRET_KEY,
        )

    async def save(self, *, data: bytes, filename: str, content_type: str, folder: str) -> str:
        today = date.today()
        key = f"{folder}/{today:%Y/%m}/{safe_filename(filename)}"
        self._client.put_object(
            Bucket=self._bucket,
            Key=key,
            Body=data,
            ContentType=content_type or mimetypes.guess_type(filename)[0] or "application/octet-stream",
            CacheControl="public, max-age=31536000, immutable",
        )
        return f"{self._public_base}/{key}"

    async def delete(self, url: str) -> None:
        if not url.startswith(self._public_base):
            return
        key = url[len(self._public_base):].lstrip("/")
        self._client.delete_object(Bucket=self._bucket, Key=key)


class BunnyStorage(StorageProvider):
    """Bunny Edge Storage, over Bunny's own HTTP API.

    Separate from `S3Storage` on purpose. Bunny's S3-compatible endpoint was
    still in public preview when this was written, and the thing it would be
    storing is every product photograph and 3D model the shop owns. The native
    Edge Storage API has been stable for years and is three verbs, so this
    costs less than the risk does.

    Two hosts, and mixing them up is the usual first failure:

      * the STORAGE host (`storage.bunnycdn.com`, or a regional variant) is
        where files are written, authenticated with the zone's password;
      * the PULL ZONE host (`something.b-cdn.net`, or your own CNAME) is where
        the public reads them, cached at the edge.

    `BUNNY_PUBLIC_BASE_URL` must be the pull zone. Point it at the storage
    host and every image on the site is served from origin, uncached, with the
    storage password in play - which works in testing and is a bill in
    production.

    ONE THING BUNNY DOES NOT DO
        It ignores the Content-Type sent with an upload and serves files by
        its own extension table. Tested against a real zone: a .usdz uploaded
        as model/vnd.usdz+zip comes back as application/octet-stream, and so
        does a .bin uploaded with that same header. The header below is still
        sent - it costs nothing and other backends honour it - but on Bunny it
        decides nothing.

        This matters for exactly one format. iOS AR Quick Look refuses a USDZ
        that is not served as model/vnd.usdz+zip, so a .usdz behind a Bunny
        pull zone needs an Edge Rule setting that response header, or AR does
        nothing at all on iPhones and says nothing about why. .glb is fine -
        Bunny's table already knows it. See docs/DEPLOY-CPANEL.md.
    """

    name = "bunny"

    def __init__(self) -> None:
        missing = [
            k for k in ("BUNNY_STORAGE_ZONE", "BUNNY_ACCESS_KEY", "BUNNY_PUBLIC_BASE_URL")
            if not getattr(settings, k)
        ]
        if missing:
            raise RuntimeError(
                "STORAGE_PROVIDER=bunny but these are unset: " + ", ".join(missing)
            )

        self._zone = settings.BUNNY_STORAGE_ZONE
        self._key = settings.BUNNY_ACCESS_KEY
        self._host = settings.BUNNY_STORAGE_HOST.strip("/")
        self._public_base = settings.BUNNY_PUBLIC_BASE_URL.rstrip("/")

    def _endpoint(self, key: str) -> str:
        return f"https://{self._host}/{self._zone}/{key}"

    async def save(self, *, data: bytes, filename: str, content_type: str, folder: str) -> str:
        today = date.today()
        key = f"{folder}/{today:%Y/%m}/{safe_filename(filename)}"

        # A client per call rather than one held on the instance. This process
        # may be run by Passenger under a WSGI bridge, where the event loop a
        # long-lived client was bound to is not guaranteed to be the loop the
        # next request runs on - and a client bound to a dead loop fails in a
        # way that reads like a network fault. Uploads are rare; a connection
        # setup each time is not the cost worth optimising here.
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.put(
                self._endpoint(key),
                content=data,
                headers={
                    "AccessKey": self._key,
                    "Content-Type": (
                        content_type
                        or mimetypes.guess_type(filename)[0]
                        or "application/octet-stream"
                    ),
                },
            )

        if response.status_code not in (200, 201):
            logger.error(
                "Bunny upload failed for %s: HTTP %s %s",
                key, response.status_code, response.text[:200],
            )
            raise RuntimeError(
                f"Upload to Bunny failed (HTTP {response.status_code}). "
                "Check the storage zone name, the access key, and the region host."
            )

        return f"{self._public_base}/{key}"

    async def delete(self, url: str) -> None:
        # Only ever deletes what this provider wrote. A stored URL is data,
        # and data from an older provider - or a tampered row - must not turn
        # into a delete against a path this key can reach.
        if not url.startswith(self._public_base):
            return
        key = url[len(self._public_base):].lstrip("/")

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.delete(
                self._endpoint(key), headers={"AccessKey": self._key}
            )

        # 404 means somebody already removed it, which is the state we wanted.
        if response.status_code not in (200, 204, 404):
            logger.warning(
                "Bunny delete failed for %s: HTTP %s", key, response.status_code
            )


_provider: StorageProvider | None = None


def get_storage() -> StorageProvider:
    global _provider
    if _provider is None:
        if settings.STORAGE_PROVIDER == "bunny":
            _provider = BunnyStorage()
        elif settings.STORAGE_PROVIDER == "s3":
            _provider = S3Storage()
        else:
            _provider = LocalStorage()
    return _provider
