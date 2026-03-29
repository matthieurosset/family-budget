from pathlib import Path

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "sqlite:///./data/family-budget.db"
    data_dir: Path = Path("./data")
    upload_dir: Path = Path("./data/uploads")
    cors_origins: list[str] = ["http://localhost:5173", "http://localhost:8086"]

    model_config = {"env_prefix": "FB_"}


settings = Settings()
