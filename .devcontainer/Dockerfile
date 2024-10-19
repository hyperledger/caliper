FROM mcr.microsoft.com/vscode/devcontainers/python:3.8

RUN apt-get update && apt-get install -y \
    git \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /workspace

COPY . .

RUN pip install -r docs/pip-requirements.txt

ENV MKDOCS_PORT=8000

EXPOSE ${MKDOCS_PORT}

CMD ["mkdocs", "serve", "-a", "0.0.0.0:8000"]