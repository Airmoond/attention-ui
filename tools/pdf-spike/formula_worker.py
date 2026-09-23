"""Bounded, offline-only formula OCR worker. JSON via stdin/stdout; no document paths."""
import base64
import io
import json
import socket
import sys
from pathlib import Path


def main():
    # Models must be prepared explicitly; inference must never download anything.
    def offline(*args, **kwargs):
        raise RuntimeError("NETWORK_DISABLED")
    socket.socket.connect = offline
    socket.create_connection = offline
    import rapid_latex_ocr
    from rapid_latex_ocr import LaTeXOCR
    from PIL import Image, ImageStat
    models = Path(rapid_latex_ocr.__file__).parent / "models"
    names = ["image_resizer.onnx", "encoder.onnx", "decoder.onnx", "tokenizer.json"]
    if not all((models / name).is_file() for name in names):
        raise RuntimeError("MODEL_MISSING")
    raw = sys.stdin.buffer.read(4_000_001)
    if len(raw) > 4_000_000:
        raise ValueError("INPUT_TOO_LARGE")
    payload = json.loads(raw)
    images = payload.get("images")
    if not isinstance(images, list) or not 1 <= len(images) <= 12:
        raise ValueError("INVALID_IMAGES")
    decoded = []
    Image.MAX_IMAGE_PIXELS = 4_000_000
    for value in images:
        if not isinstance(value, str) or not value.startswith("data:image/png;base64,"):
            raise ValueError("INVALID_IMAGE")
        data = base64.b64decode(value.split(",", 1)[1], validate=True)
        image = Image.open(io.BytesIO(data))
        if image.format != "PNG" or image.width * image.height > 4_000_000 or min(image.size) < 4:
            raise ValueError("INVALID_IMAGE")
        image.load()
        if ImageStat.Stat(image.convert("L")).stddev[0] < 1:
            raise ValueError("BLANK_IMAGE")
        decoded.append(data)
    model = LaTeXOCR(image_resizer_path=models / names[0], encoder_path=models / names[1],
                     decoder_path=models / names[2], tokenizer_json=models / names[3])
    results = []
    for data in decoded:
        try:
            latex, elapsed = model(data)
            if not isinstance(latex, str) or not latex.strip() or len(latex) > 8000:
                raise ValueError("INVALID_RESULT")
            results.append({"latex": latex, "seconds": round(elapsed, 3)})
        except Exception:
            results.append({"error": "RECOGNITION_FAILED"})
    print(json.dumps({"results": results}, ensure_ascii=True), flush=True)

if __name__ == "__main__":
    try:
        main()
    except Exception:
        # Never log document contents, image data or model exception payloads.
        print(json.dumps({"error": "LOCAL_OCR_UNAVAILABLE"}), flush=True)
        sys.exit(1)
