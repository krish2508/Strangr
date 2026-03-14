import logging
import sys

# Configure basic logging structure
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)

def get_logger(name: str):
    """Returns a configured logger with the specified name"""
    return logging.getLogger(name)
