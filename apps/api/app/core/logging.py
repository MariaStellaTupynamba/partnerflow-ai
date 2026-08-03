import logging
import sys

from app.core.config import get_settings


def configure_logging() -> None:
    settings = get_settings()

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(
        logging.Formatter(
            fmt="%(asctime)s %(levelname)s %(name)s %(message)s",
            datefmt="%Y-%m-%dT%H:%M:%S%z",
        )
    )

    root_logger = logging.getLogger()
    root_logger.handlers = [handler]
    root_logger.setLevel(settings.log_level)

    # Quiet noisy access logs unless explicitly debugging.
    logging.getLogger("uvicorn.access").setLevel(
        logging.WARNING if settings.environment == "production" else logging.INFO
    )
