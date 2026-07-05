"""StudyBase — auth. Verifies Supabase access tokens, auto-detecting ES256 (newer
projects) vs HS256 (older projects). Demo mode when nothing is configured."""
import os
from functools import wraps

import jwt
from jwt import PyJWKClient
from flask import request, jsonify, g

SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SUPABASE_JWT_SECRET = os.environ.get("SUPABASE_JWT_SECRET", "")

_jwk_client = (
    PyJWKClient(f"{SUPABASE_URL}/auth/v1/.well-known/jwks.json")
    if SUPABASE_URL else None
)


def _verify(token: str):
    alg = jwt.get_unverified_header(token).get("alg", "")
    if alg in ("ES256", "RS256") and _jwk_client:
        key = _jwk_client.get_signing_key_from_jwt(token).key
        return jwt.decode(token, key, algorithms=[alg], audience="authenticated")
    if alg == "HS256" and SUPABASE_JWT_SECRET:
        return jwt.decode(token, SUPABASE_JWT_SECRET,
                          algorithms=["HS256"], audience="authenticated")
    raise jwt.InvalidTokenError(
        f"Token uses '{alg}' but the server isn't configured to verify it."
    )


def require_user(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        if not SUPABASE_URL and not SUPABASE_JWT_SECRET:
            g.user_id = "demo-user"
            return fn(*args, **kwargs)
        header = request.headers.get("Authorization", "")
        if not header.startswith("Bearer "):
            return jsonify({"error": "Missing bearer token"}), 401
        token = header.split(" ", 1)[1]
        try:
            g.user_id = _verify(token)["sub"]
        except Exception as e:
            return jsonify({"error": f"Invalid token: {e}"}), 401
        return fn(*args, **kwargs)

    return wrapper