"""Loads one day's solution, runs both parts, writes a single JSON line on fd 3."""

import importlib.util
import json
import os
import sys
import time
from pathlib import Path

def load(path: str):
    """
    Imports a day, either py/<year>/dayNN.py or py/<year>/dayNN/__init__.py.
    Puts py/ on the path so `from lib import …` works, and registers the folder
    form as a package so its own `from .helper import …` resolves.
    """
    solution = Path(path).resolve()
    package = solution.name == "__init__.py"
    sys.path.insert(0, str(solution.parents[2] if package else solution.parents[1]))

    spec = importlib.util.spec_from_file_location(
        "solution",
        solution,
        submodule_search_locations=[str(solution.parent)] if package else None,
    )
    module = importlib.util.module_from_spec(spec)
    sys.modules["solution"] = module
    spec.loader.exec_module(module)
    return module


def timed(fn, text: str) -> dict:
    """Caught per part, so a half-written part 2 does not hide part 1's answer."""
    if fn is None:
        return {"answer": None, "micros": 0}

    start = time.perf_counter()
    try:
        value = fn(text)
    except Exception as error:
        micros = round((time.perf_counter() - start) * 1_000_000)
        return {"answer": None, "micros": micros, "error": f"{type(error).__name__}: {error}"}
    micros = round((time.perf_counter() - start) * 1_000_000)

    answer = "" if value is None else str(value).strip()
    return {"answer": answer or None, "micros": micros}


def emit(payload: str) -> None:
    """
    fd 3 is the harness's channel, so stdout belongs entirely to your print().
    Falls back to stdout when the driver is run by hand, with no fd 3 open.
    """
    try:
        os.write(3, (payload + "\n").encode())
    except OSError:
        print(payload)


def main() -> None:
    solution_path, input_path = sys.argv[1], sys.argv[2]
    text = Path(input_path).read_text().rstrip()
    module = load(solution_path)

    emit(
        json.dumps(
            {
                "part1": timed(getattr(module, "part1", None), text),
                "part2": timed(getattr(module, "part2", None), text),
            }
        )
    )


if __name__ == "__main__":
    main()
