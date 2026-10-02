import hashlib
import hmac
import secrets
import time
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import Depends, FastAPI, HTTPException, Request, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

import models
from database import engine, SessionLocal

SESSION_COOKIE = "matchwork_session"
SESSION_MAX_AGE = 60 * 60 * 24 * 7
PASSWORD_ITERATIONS = 310_000
STATIC_DIRECTORY = Path(__file__).resolve().parent / "static"


@asynccontextmanager
async def lifespan(_app: FastAPI):
    models.Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(title="Matchwork API", lifespan=lifespan)


class ResumeCreate(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    email: str = Field(min_length=5, max_length=255)
    skills: str = Field(max_length=4000)
    education: str = Field(max_length=4000)


class RegisterRequest(BaseModel):
    full_name: str = Field(min_length=2, max_length=100)
    email: str = Field(min_length=5, max_length=255)
    password: str = Field(min_length=8, max_length=128)


class LoginRequest(BaseModel):
    email: str = Field(min_length=5, max_length=255)
    password: str = Field(min_length=1, max_length=128)


class ProfileUpdate(BaseModel):
    full_name: str = Field(min_length=2, max_length=100)
    resume_skills: list[str] = Field(max_length=40)


class MatchCreate(BaseModel):
    job_title: str = Field(min_length=1, max_length=120)
    company: str = Field(default="", max_length=120)
    job_description: str = Field(min_length=1, max_length=20000)
    resume_skills: list[str] = Field(min_length=1, max_length=40)
    role_skills: list[str] = Field(min_length=1, max_length=40)
    matched_skills: list[str] = Field(max_length=40)
    missing_skills: list[str] = Field(max_length=40)
    score: int = Field(ge=0, le=100)


def get_db():
    db = SessionLocal()

    try:
        yield db
    finally:
        db.close()


def normalize_email(email: str) -> str:
    normalized = email.strip().lower()
    if "@" not in normalized or "." not in normalized.rsplit("@", 1)[-1]:
        raise HTTPException(status_code=422, detail="Enter a valid email address.")
    return normalized


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    derived = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, PASSWORD_ITERATIONS)
    return f"{salt.hex()}${derived.hex()}"


def verify_password(password: str, stored_hash: str) -> bool:
    try:
        salt_hex, expected_hash = stored_hash.split("$", 1)
        salt = bytes.fromhex(salt_hex)
    except (ValueError, TypeError):
        return False
    actual_hash = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, PASSWORD_ITERATIONS).hex()
    return hmac.compare_digest(actual_hash, expected_hash)


def token_digest(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def public_user(user: models.User) -> dict:
    return {
        "id": user.id,
        "full_name": user.full_name,
        "email": user.email,
        "resume_skills": user.resume_skills or [],
    }


def match_data(match: models.SavedMatch) -> dict:
    return {
        "id": match.id,
        "job_title": match.job_title,
        "company": match.company,
        "job_description": match.job_description,
        "resume_skills": match.resume_skills,
        "role_skills": match.role_skills,
        "matched_skills": match.matched_skills,
        "missing_skills": match.missing_skills,
        "score": match.score,
        "created_at": match.created_at,
    }


def set_session(response: Response, user: models.User, db: Session, request: Request) -> None:
    token = secrets.token_urlsafe(32)
    db.add(models.AuthSession(
        user_id=user.id,
        token_hash=token_digest(token),
        expires_at=int(time.time()) + SESSION_MAX_AGE,
    ))
    db.commit()
    response.set_cookie(
        key=SESSION_COOKIE,
        value=token,
        max_age=SESSION_MAX_AGE,
        httponly=True,
        secure=request.url.scheme == "https",
        samesite="lax",
        path="/",
    )


def get_current_user(request: Request, db: Session = Depends(get_db)) -> models.User:
    token = request.cookies.get(SESSION_COOKIE)
    if not token:
        raise HTTPException(status_code=401, detail="Sign in to continue.")

    auth_session = db.query(models.AuthSession).filter_by(token_hash=token_digest(token)).first()
    if auth_session is None or auth_session.expires_at <= int(time.time()):
        if auth_session is not None:
            db.delete(auth_session)
            db.commit()
        raise HTTPException(status_code=401, detail="Your session has expired. Sign in again.")

    user = db.query(models.User).filter_by(id=auth_session.user_id).first()
    if user is None:
        raise HTTPException(status_code=401, detail="Your account is unavailable.")
    return user


@app.post("/api/auth/register", status_code=201)
def register(payload: RegisterRequest, request: Request, response: Response, db: Session = Depends(get_db)):
    email = normalize_email(payload.email)
    if db.query(models.User).filter_by(email=email).first():
        raise HTTPException(status_code=409, detail="An account with that email already exists.")

    user = models.User(
        full_name=payload.full_name.strip(),
        email=email,
        password_hash=hash_password(payload.password),
        resume_skills=[],
        created_at=int(time.time()),
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(status_code=409, detail="An account with that email already exists.") from error
    db.refresh(user)
    set_session(response, user, db, request)
    return public_user(user)


@app.post("/api/auth/login")
def login(payload: LoginRequest, request: Request, response: Response, db: Session = Depends(get_db)):
    email = normalize_email(payload.email)
    user = db.query(models.User).filter_by(email=email).first()
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Email or password is incorrect.")
    set_session(response, user, db, request)
    return public_user(user)


@app.post("/api/auth/logout")
def logout(request: Request, response: Response, db: Session = Depends(get_db)):
    token = request.cookies.get(SESSION_COOKIE)
    if token:
        auth_session = db.query(models.AuthSession).filter_by(token_hash=token_digest(token)).first()
        if auth_session is not None:
            db.delete(auth_session)
            db.commit()
    response.delete_cookie(SESSION_COOKIE, path="/", httponly=True, samesite="lax")
    return {"message": "Signed out."}


@app.get("/api/auth/me")
def get_me(user: models.User = Depends(get_current_user)):
    return public_user(user)


@app.get("/api/profile")
def get_profile(user: models.User = Depends(get_current_user)):
    return public_user(user)


@app.put("/api/profile")
def update_profile(payload: ProfileUpdate, user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    user.full_name = payload.full_name.strip()
    user.resume_skills = [skill.strip() for skill in payload.resume_skills if skill.strip()]
    db.commit()
    return public_user(user)


@app.get("/api/matches")
def list_matches(user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    matches = db.query(models.SavedMatch).filter_by(user_id=user.id).order_by(models.SavedMatch.created_at.desc()).all()
    return [match_data(match) for match in matches]


@app.post("/api/matches", status_code=201)
def create_match(payload: MatchCreate, user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    match = models.SavedMatch(
        user_id=user.id,
        job_title=payload.job_title.strip(),
        company=payload.company.strip(),
        job_description=payload.job_description.strip(),
        resume_skills=[skill.strip() for skill in payload.resume_skills if skill.strip()],
        role_skills=payload.role_skills,
        matched_skills=payload.matched_skills,
        missing_skills=payload.missing_skills,
        score=payload.score,
        created_at=int(time.time()),
    )
    user.resume_skills = match.resume_skills
    db.add(match)
    db.commit()
    db.refresh(match)
    return match_data(match)


@app.delete("/api/matches/{match_id}", status_code=204)
def delete_match(match_id: int, user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    match = db.query(models.SavedMatch).filter_by(id=match_id, user_id=user.id).first()
    if match is None:
        raise HTTPException(status_code=404, detail="Saved match not found.")
    db.delete(match)
    db.commit()
    return Response(status_code=204)


@app.post("/resume")
def create_resume(
    resume: ResumeCreate,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):

    new_resume = models.Resume(
        user_id=user.id,
        name=resume.name,
        email=resume.email,
        skills=resume.skills,
        education=resume.education
    )

    db.add(new_resume)
    db.commit()
    db.refresh(new_resume)

    return {
        "message": "Resume saved successfully",
        "id": new_resume.id
    }


app.mount("/", StaticFiles(directory=STATIC_DIRECTORY, html=True), name="frontend")