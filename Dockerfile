# syntax=docker/dockerfile:1
# The control room's image: prove the whole sim suite in a verify stage,
# then ship the slim runtime with only what the server imports.
FROM python:3.11-slim AS verify
WORKDIR /src
COPY engine/sim/ engine/sim/
RUN pip install --no-cache-dir -r engine/sim/requirements.txt
RUN python -m pytest engine/sim -q

FROM python:3.11-slim
WORKDIR /app
COPY engine/sim/ engine/sim/
# hostbench imports the twin, which speaks Modbus; nothing else is needed.
RUN pip install --no-cache-dir "pymodbus>=3.6,<3.7"
# The platform's probes should hit /health for liveness and /ready for
# readiness; both stay open alongside /metrics and the control room page.
ENV PORT=8092
EXPOSE 8092
ENTRYPOINT ["python", "engine/sim/workbench.py"]
