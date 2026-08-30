FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY main.py .
COPY my_hinglish_model.zip .
RUN python -m zipfile -e my_hinglish_model.zip model && rm my_hinglish_model.zip
ENV MODEL_PATH=/app/model
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]
