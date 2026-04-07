"""Pre-download sd-turbo model weights to HuggingFace cache."""

from diffusers import AutoPipelineForImage2Image
import torch

MODEL_ID = "stabilityai/sd-turbo"

print(f"Downloading {MODEL_ID}...")
pipe = AutoPipelineForImage2Image.from_pretrained(
    MODEL_ID,
    torch_dtype=torch.float16,
    variant="fp16",
)
print(f"Model cached at ~/.cache/huggingface/hub/")
print("Done.")
