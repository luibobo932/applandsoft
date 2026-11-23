import time
from types import SimpleNamespace

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa

from app.core import github_oidc


WORKFLOW = "example/bot/.github/workflows/chotot-monitor.yml@refs/heads/main"
TRUSTED = f"123456:{WORKFLOW}"


@pytest.fixture
def make_token(monkeypatch):
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    monkeypatch.setattr(
        github_oidc._SIGNING_KEYS,
        "get_signing_keys",
        lambda: [SimpleNamespace(key_id="test-key", key=key.public_key())],
    )
    now = int(time.time())
    claims = {
        "iss": github_oidc.ISSUER,
        "aud": github_oidc.AUDIENCE,
        "exp": now + 300,
        "iat": now - 1,
        "nbf": now - 1,
        "repository_id": "123456",
        "workflow_ref": WORKFLOW,
        "ref": "refs/heads/main",
        "event_name": "schedule",
        "runner_environment": "github-hosted",
    }

    def encode(**overrides):
        return jwt.encode({**claims, **overrides}, key, algorithm="RS256", headers={"kid": "test-key"})

    return encode


def test_accepts_exact_workflow_identity(make_token):
    assert github_oidc.is_trusted_listing_workflow(make_token(), TRUSTED)
    assert github_oidc.is_trusted_listing_workflow(make_token(event_name="workflow_dispatch"), TRUSTED)


@pytest.mark.parametrize("overrides", [
    {"repository_id": "987654"},
    {"workflow_ref": WORKFLOW.replace("chotot-monitor.yml", "another.yml")},
    {"ref": "refs/heads/feature"},
    {"event_name": "pull_request"},
    {"aud": "unrelated-service"},
    {"runner_environment": "self-hosted"},
    {"exp": 1},
])
def test_rejects_other_workflows_and_expired_tokens(make_token, overrides):
    assert not github_oidc.is_trusted_listing_workflow(make_token(**overrides), TRUSTED)


def test_rejects_altered_signature(make_token):
    header, payload, signature = make_token().split(".")
    first_char = "B" if signature.startswith("A") else "A"
    forged = f"{header}.{payload}.{first_char}{signature[1:]}"
    assert not github_oidc.is_trusted_listing_workflow(forged, TRUSTED)
