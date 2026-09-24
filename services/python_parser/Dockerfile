# --- WellQC Python parser/imputation service (dev container) ---
#
# Built with the REPO ROOT as build context (see docker-compose.yml's
# `context: .` / `dockerfile: services/python_parser/Dockerfile`) because
# main.py uses package-relative imports (`from .diagnostics import ...`),
# so it must run as the `python_parser` package, not a loose script.

FROM python:3.12-slim

WORKDIR /app

# scikit-learn/scipy sometimes need to compile on architectures without
# prebuilt wheels. Slows the first build slightly; safe to leave in.
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY services/python_parser/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY services/python_parser ./python_parser

EXPOSE 8000

CMD ["uvicorn", "python_parser.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload", "--reload-dir", "python_parser"]
