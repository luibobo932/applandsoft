import jwt

ISSUER = "https://token.actions.githubusercontent.com"
AUDIENCE = "landsoft-listing-address-lookup"
_SIGNING_KEYS = jwt.PyJWKClient(f"{ISSUER}/.well-known/jwks", timeout=5)


def is_trusted_listing_workflow(token: str, trusted_workflow: str) -> bool:
    repository_id, separator, workflow_ref = trusted_workflow.partition(":")
    if not separator or not repository_id.isascii() or not repository_id.isdecimal():
        return False
    if "@refs/heads/" not in workflow_ref or len(token) > 8192:
        return False

    try:
        # Filter unrelated tokens before retrieving a public signing key.
        unverified = jwt.decode(token, options={"verify_signature": False})
        if unverified.get("iss") != ISSUER or unverified.get("aud") != AUDIENCE:
            return False
        if unverified.get("repository_id") != repository_id or unverified.get("workflow_ref") != workflow_ref:
            return False

        header = jwt.get_unverified_header(token)
        if header.get("alg") != "RS256" or not header.get("kid"):
            return False
        key = next((item.key for item in _SIGNING_KEYS.get_signing_keys() if item.key_id == header["kid"]), None)
        if key is None:
            return False
        claims = jwt.decode(
            token,
            key,
            algorithms=["RS256"],
            issuer=ISSUER,
            audience=AUDIENCE,
            options={"require": ["exp", "iat", "nbf"], "strict_aud": True},
        )
    except (jwt.PyJWTError, TypeError, ValueError):
        return False

    return (
        claims.get("repository_id") == repository_id
        and claims.get("workflow_ref") == workflow_ref
        and claims.get("ref") == workflow_ref.rsplit("@", 1)[1]
        and claims.get("event_name") in ("schedule", "workflow_dispatch")
        and claims.get("runner_environment") == "github-hosted"
    )
