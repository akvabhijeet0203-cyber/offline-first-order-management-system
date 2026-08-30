# Hinglish model service

This is a server-side FastAPI wrapper for the supplied PEFT/LoRA adapter. It loads the adapter from `model/` and downloads its required base model, `Qwen/Qwen2.5-1.5B-Instruct`, on first startup.

## Prepare the model locally

The supplied `my_hinglish_model.zip` is packaged with this service for container deployment. For a local run, extract it so this layout exists:

```text
model-service/
  model/
    adapter_config.json
    adapter_model.safetensors
    tokenizer.json
```

Deploy this service separately on a host with at least 8 GB RAM/disk headroom for Qwen 1.5B; configure the main backend with `MODEL_SERVICE_URL=https://your-model-service.example`. It downloads the Qwen base model on first startup.

## Local run

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn main:app --port 8000
```
