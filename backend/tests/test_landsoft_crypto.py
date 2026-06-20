from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.core.landsoft_crypto import decrypt_landsoft_password


def test_decrypt_landsoft_password_matches_desktop_sample() -> None:
    cipher_text = (
        "oFx9g+E4rmmxA0SPYof5lR+EdqS+1PIkXRFhRQ+lRFx8iBwA58LhKw3f7Pw0QzrEHg54aiEl7WBH"
        "SOe5rsLfcCaOYGj8KQxTVuzUoN1wQj1N8JQQ6SPBv1Bei0xlgR27hsyDnk/nE4HSgtWFt7E1kfAIX"
        "d9uFq7HxLzuA+vQBRA="
    )
    assert decrypt_landsoft_password(cipher_text) == "1"
