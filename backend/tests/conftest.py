import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


@pytest.fixture(scope="session")
def engine():
    from atlas.pipeline import get_engine

    return get_engine()
