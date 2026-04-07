"""
Local diffusion inference server for the Future Wall prototype.

Runs stabilityai/sd-turbo on Apple Silicon (MPS) or CUDA for real
diffusion-based image generation and interpolation transitions.

Endpoints:
  GET  /health        — Model status + device info
  POST /generate      — txt2img from prompt
  POST /img2img       — img2img with controllable denoising strength
  POST /interpolate   — Generate N interpolation frames between images
"""

import io
import os
import time
import uuid
import base64
from pathlib import Path

import torch
import numpy as np
from PIL import Image
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from diffusers import AutoPipelineForImage2Image, AutoPipelineForText2Image

# ── Config ──────────────────────────────────────────────────────────

MODEL_ID = os.environ.get("SD_MODEL", "stabilityai/sd-turbo")
DEFAULT_WIDTH = int(os.environ.get("SD_WIDTH", "512"))
DEFAULT_HEIGHT = int(os.environ.get("SD_HEIGHT", "216"))
DEFAULT_STEPS = int(os.environ.get("SD_STEPS", "4"))
OUTPUT_DIR = Path(__file__).parent / "outputs"
OUTPUT_DIR.mkdir(exist_ok=True)

# ── Device selection ────────────────────────────────────────────────

def get_device():
    if torch.cuda.is_available():
        return "cuda"
    if torch.backends.mps.is_available():
        return "mps"
    return "cpu"

DEVICE = get_device()
DTYPE = torch.float16 if DEVICE in ("cuda", "mps") else torch.float32

print(f"Device: {DEVICE}, dtype: {DTYPE}, model: {MODEL_ID}")

# ── Load pipelines ──────────────────────────────────────────────────

print("Loading img2img pipeline...")
pipe_i2i = AutoPipelineForImage2Image.from_pretrained(
    MODEL_ID,
    torch_dtype=DTYPE,
    variant="fp16" if DTYPE == torch.float16 else None,
)
pipe_i2i = pipe_i2i.to(DEVICE)

print("Loading txt2img pipeline (shared components)...")
pipe_t2i = AutoPipelineForText2Image.from_pipe(pipe_i2i)
pipe_t2i = pipe_t2i.to(DEVICE)

# Disable safety checker for museum prototype (faster inference)
if hasattr(pipe_i2i, "safety_checker"):
    pipe_i2i.safety_checker = None
if hasattr(pipe_t2i, "safety_checker"):
    pipe_t2i.safety_checker = None

print("Pipelines ready.")

# ── FastAPI app ─────────────────────────────────────────────────────

app = FastAPI(title="Future Wall Inference Server")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve generated images as static files
app.mount("/outputs", StaticFiles(directory=str(OUTPUT_DIR)), name="outputs")

# ── Helpers ─────────────────────────────────────────────────────────

def decode_image(image_b64: str) -> Image.Image:
    """Decode base64 image string to PIL Image."""
    data = base64.b64decode(image_b64)
    return Image.open(io.BytesIO(data)).convert("RGB")


def load_image_from_path_or_b64(value: str, width: int, height: int) -> Image.Image:
    """Load image from local path, URL-like path, or base64 string."""
    if value.startswith("data:"):
        # data:image/png;base64,...
        value = value.split(",", 1)[1]
        return decode_image(value).resize((width, height), Image.LANCZOS)
    elif value.startswith("/") or value.startswith("http"):
        # Local path (relative to public/) or absolute
        local = Path(__file__).parent.parent / "public" / value.lstrip("/")
        if local.exists():
            return Image.open(local).convert("RGB").resize((width, height), Image.LANCZOS)
        # Try outputs directory
        out_path = OUTPUT_DIR / Path(value).name
        if out_path.exists():
            return Image.open(out_path).convert("RGB").resize((width, height), Image.LANCZOS)
        raise HTTPException(400, f"Image not found: {value}")
    else:
        # Assume base64
        return decode_image(value).resize((width, height), Image.LANCZOS)


def save_image(img: Image.Image, prefix: str = "frame") -> str:
    """Save PIL image to outputs directory, return relative URL path."""
    filename = f"{prefix}_{uuid.uuid4().hex[:8]}.png"
    path = OUTPUT_DIR / filename
    img.save(path, "PNG")
    return f"/outputs/{filename}"


# ── Request/Response models ─────────────────────────────────────────

class GenerateRequest(BaseModel):
    prompt: str
    width: int = DEFAULT_WIDTH
    height: int = DEFAULT_HEIGHT
    steps: int = DEFAULT_STEPS
    seed: int | None = None

class Img2ImgRequest(BaseModel):
    prompt: str
    image: str  # base64, data URI, or path
    strength: float = Field(0.5, ge=0.0, le=1.0)
    width: int = DEFAULT_WIDTH
    height: int = DEFAULT_HEIGHT
    steps: int = DEFAULT_STEPS
    seed: int | None = None

class InterpolateRequest(BaseModel):
    image_a: str  # base64, data URI, or path (source image)
    prompt_b: str  # target prompt for interpolation guidance
    image_b: str | None = None  # optional pre-generated target
    num_frames: int = Field(8, ge=2, le=20)
    strength_start: float = Field(0.1, ge=0.05, le=0.5)
    strength_end: float = Field(0.85, ge=0.5, le=1.0)
    width: int = DEFAULT_WIDTH
    height: int = DEFAULT_HEIGHT
    steps: int = DEFAULT_STEPS
    seed: int | None = None

# ── Endpoints ───────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {
        "ok": True,
        "model": MODEL_ID,
        "device": DEVICE,
        "dtype": str(DTYPE),
        "default_resolution": f"{DEFAULT_WIDTH}x{DEFAULT_HEIGHT}",
    }


@app.post("/generate")
async def generate(req: GenerateRequest):
    t0 = time.time()
    generator = torch.Generator(device=DEVICE)
    if req.seed is not None:
        generator.manual_seed(req.seed)

    result = pipe_t2i(
        prompt=req.prompt,
        width=req.width,
        height=req.height,
        num_inference_steps=req.steps,
        guidance_scale=0.0,  # sd-turbo uses no CFG
        generator=generator,
    )

    image_url = save_image(result.images[0], "gen")
    elapsed = int((time.time() - t0) * 1000)

    return {"image_url": image_url, "elapsed_ms": elapsed}


@app.post("/img2img")
async def img2img(req: Img2ImgRequest):
    t0 = time.time()
    init_image = load_image_from_path_or_b64(req.image, req.width, req.height)

    generator = torch.Generator(device=DEVICE)
    if req.seed is not None:
        generator.manual_seed(req.seed)

    result = pipe_i2i(
        prompt=req.prompt,
        image=init_image,
        strength=req.strength,
        num_inference_steps=req.steps,
        guidance_scale=0.0,
        generator=generator,
    )

    image_url = save_image(result.images[0], "i2i")
    elapsed = int((time.time() - t0) * 1000)

    return {"image_url": image_url, "elapsed_ms": elapsed}


@app.post("/interpolate")
async def interpolate(req: InterpolateRequest):
    """Generate N interpolation frames from image_a toward prompt_b.

    Uses chained img2img: each frame's output feeds the next frame's input
    with linearly increasing denoising strength. This creates smooth
    progressive transformation via actual diffusion steps.
    """
    t0 = time.time()
    current_image = load_image_from_path_or_b64(req.image_a, req.width, req.height)

    generator = torch.Generator(device=DEVICE)
    base_seed = req.seed if req.seed is not None else torch.randint(0, 2**32, (1,)).item()

    strengths = np.linspace(req.strength_start, req.strength_end, req.num_frames).tolist()
    frames = []

    for i, strength in enumerate(strengths):
        # Use consistent seed for temporal coherence
        generator.manual_seed(base_seed + i)

        result = pipe_i2i(
            prompt=req.prompt_b,
            image=current_image,
            strength=strength,
            num_inference_steps=req.steps,
            guidance_scale=0.0,
            generator=generator,
        )

        current_image = result.images[0]
        frame_url = save_image(current_image, f"interp_{i:03d}")
        frames.append(frame_url)

    elapsed = int((time.time() - t0) * 1000)

    return {
        "frames": frames,
        "num_frames": len(frames),
        "elapsed_ms": elapsed,
        "avg_frame_ms": elapsed // len(frames),
    }


@app.on_event("startup")
async def startup():
    """Warm up the pipeline with a tiny inference."""
    print("Warming up pipeline...")
    try:
        _ = pipe_t2i(
            prompt="test",
            width=64,
            height=64,
            num_inference_steps=1,
            guidance_scale=0.0,
        )
        print("Pipeline warm-up complete.")
    except Exception as e:
        print(f"Warm-up failed (non-fatal): {e}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
