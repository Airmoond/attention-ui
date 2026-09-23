"""Local comparison only; never used to choose or correct application OCR results.

Run with the experiment Python environment and five locally captured crop-N.png
files. No PDFs, images or model files are included in this benchmark script.
"""
import argparse
import json
import socket
import time
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input-dir', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()

    def offline(*_args, **_kwargs):
        raise RuntimeError('NETWORK_DISABLED')
    socket.socket.connect = offline
    socket.create_connection = offline

    import numpy as np
    import rapid_latex_ocr
    from PIL import Image, ImageOps
    from rapid_latex_ocr import LaTeXOCR

    models = Path(rapid_latex_ocr.__file__).parent / 'models'
    names = ['image_resizer.onnx', 'encoder.onnx', 'decoder.onnx', 'tokenizer.json']
    if not all((models / name).is_file() for name in names):
        raise RuntimeError('Prepare local model files before benchmarking')
    model = LaTeXOCR(image_resizer_path=models / names[0], encoder_path=models / names[1],
                     decoder_path=models / names[2], tokenizer_json=models / names[3])
    Image.MAX_IMAGE_PIXELS = 4_000_000
    results = []
    for index in range(5):
        path = args.input_dir / f'crop-{index}.png'
        with Image.open(path) as image:
            if image.format != 'PNG' or image.width * image.height > 4_000_000:
                raise ValueError('Invalid benchmark image')
            source = image.convert('RGB')
        bbox = ImageOps.invert(source.convert('L')).point(lambda x: 255 if x > 100 else 0).getbbox()
        if bbox is None:
            raise ValueError('Blank benchmark image')
        ink = source.crop(bbox)
        baseline, elapsed = model(np.array(source))
        row = {'file': path.name, 'size': source.size, 'ink': ink.size,
               'baseline': {'latex': baseline, 'seconds': round(elapsed, 3)}, 'variants': {}}
        # Compare fixed ink heights against the upstream learned resizer. This
        # deliberately bypasses that resizer; do not install it as a global fix.
        for height in (16, 24, 32, 48):
            started = time.perf_counter()
            resized = ink.resize((max(1, round(ink.width * height / ink.height)), height), Image.Resampling.LANCZOS)
            padded = model.pre_pro.pad(resized)
            array = model.pre_pro.transpose_and_four_dim(
                model.pre_pro.normalize(np.array(padded.convert('RGB')))).astype(np.float32)
            decoded = model.encoder_decoder(array, temperature=model.temperature)
            latex = model.post_process(model.tokenizer.token2str(decoded)[0])
            row['variants'][str(height)] = {'latex': latex, 'seconds': round(time.perf_counter() - started, 3)}
        results.append(row)
        print(f'Completed sample {index + 1}/5', flush=True)
    args.output.write_text(json.dumps(results, indent=2, ensure_ascii=True), encoding='utf-8')
    print('Saved local comparison; correctness requires visual review.', flush=True)


if __name__ == '__main__':
    main()
