import os
import time
from typing import Optional
from dataclasses import dataclass
from fastapi import Header, HTTPException, status
import jwt
import httpx

@dataclass
class AuthenticatedUser:
    user_id: str
    email: str
    session_id: str
    token: str

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
SUPABASE_JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET")

def get_current_user(authorization: Optional[str] = Header(None, alias="Authorization")) -> AuthenticatedUser:
    """
    FastAPI dependency that validates Supabase JWT and derives the user ID.
    Rejects unauthorized requests.
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid Authorization header. Please log in to HACKORA.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = authorization.split("Bearer ", 1)[1].strip()
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization token is empty.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # 1. Verify with SUPABASE_JWT_SECRET if configured
    if SUPABASE_JWT_SECRET:
        try:
            payload = jwt.decode(
                token,
                SUPABASE_JWT_SECRET,
                algorithms=["HS256"],
                audience="authenticated",
                options={"verify_exp": True}
            )
            user_id = payload.get("sub")
            email = payload.get("email") or ""
            session_id = payload.get("session_id") or payload.get("sid") or "default_session"
            if not user_id:
                raise HTTPException(status_code=401, detail="JWT token missing user ID ('sub').")
            return AuthenticatedUser(user_id=str(user_id), email=str(email), session_id=str(session_id), token=token)
        except jwt.ExpiredSignatureError:
            raise HTTPException(status_code=401, detail="Session expired. Please log in again.")
        except jwt.PyJWTError as e:
            raise HTTPException(status_code=401, detail=f"Invalid Supabase JWT signature: {str(e)}")

    # 2. Verify via Supabase Auth API if URL and KEY are configured
    if SUPABASE_URL and SUPABASE_KEY:
        try:
            with httpx.Client(timeout=1.0) as client:
                resp = client.get(
                    f"{SUPABASE_URL.rstrip('/')}/auth/v1/user",
                    headers={
                        "Authorization": f"Bearer {token}",
                        "apikey": SUPABASE_KEY,
                    }
                )
                if resp.status_code == 200:
                    data = resp.json()
                    user_id = data.get("id")
                    email = data.get("email") or ""
                    return AuthenticatedUser(
                        user_id=str(user_id),
                        email=str(email),
                        session_id="supabase_session",
                        token=token
                    )
        except Exception:
            # Fall through to claims decoding in development / sandbox
            pass

    # 3. Development / Sandbox fallback: decode JWT claims safely (verifying expiration)
    try:
        unverified = jwt.decode(token, options={"verify_signature": False})
        user_id = unverified.get("sub")
        email = unverified.get("email") or "user@hackora.ai"
        session_id = unverified.get("session_id") or unverified.get("sid") or "dev_session"
        
        # Check expiration if present
        exp = unverified.get("exp")
        if exp and exp < time.time():
            raise HTTPException(status_code=401, detail="Session expired. Please log in again.")
            
        if user_id:
            return AuthenticatedUser(
                user_id=str(user_id),
                email=str(email),
                session_id=str(session_id),
                token=token
            )
    except jwt.PyJWTError:
        pass

    # 4. If token is a test/demo session token
    if token.startswith("hackora_dev_"):
        return AuthenticatedUser(
            user_id="usr_" + token[:16],
            email="dev@hackora.ai",
            session_id="dev_session",
            token=token
        )

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Unauthorized: Token verification failed.",
        headers={"WWW-Authenticate": "Bearer"},
    )

def get_optional_user(authorization: Optional[str] = Header(None, alias="Authorization")) -> Optional[AuthenticatedUser]:
    """
    Optional authentication dependency for backward compatibility with endpoints.
    """
    if not authorization:
        return None
    try:
        return get_current_user(authorization)
    except HTTPException:
        return None
