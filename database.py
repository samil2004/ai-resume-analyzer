import os
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.engine import URL
from sqlalchemy.orm import sessionmaker, declarative_base

DATABASE_URL = os.getenv("DATABASE_URL")

if DATABASE_URL:
    engine = create_engine(DATABASE_URL, pool_pre_ping=True)
elif os.getenv("DB_HOST"):
    engine = create_engine(
        URL.create(
            drivername="postgresql+psycopg2",
            username=os.getenv("DB_USER", "postgres"),
            password=os.getenv("DB_PASSWORD", ""),
            host=os.environ["DB_HOST"],
            port=int(os.getenv("DB_PORT", "5432")),
            database=os.getenv("DB_NAME", "resume_db"),
        ),
        pool_pre_ping=True,
    )
else:
    DATABASE_PATH = Path(
        os.getenv("DATABASE_PATH", str(Path(__file__).resolve().parent / "resume_analyzer.db"))
    )
    DATABASE_PATH.parent.mkdir(parents=True, exist_ok=True)
    DATABASE_URL = f"sqlite:///{DATABASE_PATH.as_posix()}"
    engine = create_engine(
        DATABASE_URL,
        connect_args={"check_same_thread": False},
    )

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)

Base = declarative_base()