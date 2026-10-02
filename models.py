from sqlalchemy import Column, ForeignKey, Integer, String, Text
from sqlalchemy.types import JSON
from database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String(100), nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(256), nullable=False)
    resume_skills = Column(JSON, nullable=False, default=list)
    created_at = Column(Integer, nullable=False)


class AuthSession(Base):
    __tablename__ = "auth_sessions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    token_hash = Column(String(64), unique=True, nullable=False, index=True)
    expires_at = Column(Integer, nullable=False, index=True)


class Resume(Base):
    __tablename__ = "resumes"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    name = Column(String(100), nullable=False)
    email = Column(String(255), nullable=False)
    skills = Column(Text, nullable=False)
    education = Column(Text, nullable=False)


class SavedMatch(Base):
    __tablename__ = "saved_matches"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    job_title = Column(String(120), nullable=False)
    company = Column(String(120), nullable=False, default="")
    job_description = Column(Text, nullable=False)
    resume_skills = Column(JSON, nullable=False)
    role_skills = Column(JSON, nullable=False)
    matched_skills = Column(JSON, nullable=False)
    missing_skills = Column(JSON, nullable=False)
    score = Column(Integer, nullable=False)
    created_at = Column(Integer, nullable=False, index=True)