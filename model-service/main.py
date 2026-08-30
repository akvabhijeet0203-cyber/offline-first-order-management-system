"""Hinglish order-parser service for the PEFT adapter supplied with this project."""
import json
import os
import re
from pathlib import Path

import torch
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from peft import PeftModel
from transformers import AutoModelForCausalLM, AutoTokenizer

MODEL_PATH = Path(os.environ.get("MODEL_PATH", "./model"))
BASE_MODEL = os.environ.get("BASE_MODEL", "Qwen/Qwen2.5-1.5B-Instruct")
MAX_NEW_TOKENS = int(os.environ.get("MAX_NEW_TOKENS", "320"))
app = FastAPI(title="Hinglish Order Parser")
tokenizer = None
model = None

class ParseRequest(BaseModel):
    message: str = Field(min_length=1, max_length=4000)

class Item(BaseModel):
    description: str
    quantity: int = Field(ge=1)
    attributes: dict[str, str | int | float | bool] = {}

class ParseResponse(BaseModel):
    customer: str | None = None
    items: list[Item]
    dueDate: str | None = None
    amount: float | None = None
    needsClarification: bool = False

def load_model():
    global tokenizer, model
    if model is not None:
        return
    if not (MODEL_PATH / "adapter_config.json").is_file():
        raise RuntimeError(f"PEFT adapter not found at {MODEL_PATH}")
    tokenizer = AutoTokenizer.from_pretrained(MODEL_PATH, trust_remote_code=True)
    dtype = torch.float16 if torch.cuda.is_available() else torch.float32
    base = AutoModelForCausalLM.from_pretrained(BASE_MODEL, torch_dtype=dtype, device_map="auto" if torch.cuda.is_available() else None)
    model = PeftModel.from_pretrained(base, MODEL_PATH)
    model.eval()

def extract_json(text: str) -> dict:
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if not match:
        raise ValueError("Model did not return JSON")
    return json.loads(match.group(0))

def normalize(payload: dict) -> ParseResponse:
    # Accept the original competition schema while returning the frontend's camelCase contract.
    raw_items = payload.get("items") or []
    return ParseResponse(
        customer=payload.get("customer"),
        items=[Item(description=str(i.get("description", "Order")), quantity=max(1, int(i.get("quantity", 1))), attributes=i.get("attributes") or {}) for i in raw_items],
        dueDate=payload.get("dueDate", payload.get("due_date")),
        amount=payload.get("amount"),
        needsClarification=bool(payload.get("needsClarification", payload.get("needs_clarification", False))),
    )

@app.get("/health")
def health():
    return {"status": "ok", "loaded": model is not None, "modelPath": str(MODEL_PATH)}

@app.post("/parse", response_model=ParseResponse)
def parse_order(request: ParseRequest):
    try:
        load_model()
        prompt = """Extract an order from the Hinglish customer message. Return JSON only, with customer, items (description, quantity, attributes), due_date, amount, and needs_clarification. Do not invent facts.\n\nMessage: """ + request.message
        messages = [{"role": "system", "content": "You are a precise order-extraction assistant."}, {"role": "user", "content": prompt}]
        inputs = tokenizer.apply_chat_template(messages, tokenize=True, add_generation_prompt=True, return_tensors="pt").to(model.device)
        with torch.inference_mode():
            output = model.generate(inputs, max_new_tokens=MAX_NEW_TOKENS, do_sample=False, pad_token_id=tokenizer.eos_token_id)
        generated = tokenizer.decode(output[0][inputs.shape[-1]:], skip_special_tokens=True)
        return normalize(extract_json(generated))
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Model parsing unavailable: {exc}") from exc
