import re
import unicodedata

_NON_WORD = re.compile(r"[^\w\s-]", re.UNICODE)
_SPACES = re.compile(r"[-\s]+")


def slugify(value: str) -> str:
    value = unicodedata.normalize("NFKD", str(value))
    value = value.encode("ascii", "ignore").decode()
    value = _NON_WORD.sub("", value).strip().lower()
    return _SPACES.sub("-", value) or "item"
