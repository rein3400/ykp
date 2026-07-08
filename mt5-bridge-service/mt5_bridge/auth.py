from fastapi import Header, HTTPException, status


def require_bearer(authorization: str | None = Header(default=None),
                   expected_token: str = "") -> None:
    """Validate Authorization: Bearer <token>. Pass expected_token via dependency injection."""
    if not expected_token:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                            detail="bridge token not configured")
    if not authorization or not str(authorization).startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                            detail="missing bearer token")
    provided = str(authorization)[len("Bearer "):].strip()
    if provided != expected_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                            detail="invalid token")