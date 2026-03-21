import os

from dotenv import load_dotenv

load_dotenv(override=True)


def get_env(name: str, default: str | None = None) -> str | None:
    value = os.getenv(name, default)
    if value is None:
        return None
    return value.strip()


def get_required_env(name: str) -> str:
    value = get_env(name)
    if not value:
        raise RuntimeError(f"{name} environment variable is required")
    return value


def get_csv_env(name: str, default: str = "") -> list[str]:
    raw_value = get_env(name, default) or ""
    return [item.strip().rstrip("/") for item in raw_value.split(",") if item.strip()]


ENVIRONMENT = (get_env("ENVIRONMENT", "development") or "development").lower()
IS_PRODUCTION = ENVIRONMENT == "production"
