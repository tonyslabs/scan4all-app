FROM python:3.13-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY main.py .
RUN useradd --system --uid 1000 app
USER app
EXPOSE 8008
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8008/').status==200 else 1)"
# Un solo proceso: el rate limit vive en memoria.
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8008", "--no-server-header"]
