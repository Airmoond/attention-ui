"""Original deterministic engineering fixtures, not student documents.
Requires PyMuPDF 1.27.2.3. Generated PDFs contain no third-party article text.
"""
from pathlib import Path
import hashlib
import json
import fitz

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "fixtures"
OUT.mkdir(exist_ok=True)
manifest = []

for index in range(1, 11):
    zh = index <= 5
    columns = 2 if index in (3, 5, 8, 10) else 1
    doc = fitz.open()
    anchors = []
    for number in range(1, 4):
        page = doc.new_page(width=595, height=842)
        font = "china-s" if zh else "helv"
        title = f"学习资料 P{index:02d} - 第 {number} 页" if zh else f"Study notes P{index:02d} - Page {number}"
        page.insert_text((44, 48), title, fontsize=18, fontname=font)
        anchor = f"本页锚点：样本{index:02d}，页码{number}。" if zh else f"Page anchor: sample {index:02d}, page {number}."
        page.insert_text((44, 82), anchor, fontsize=12, fontname=font)
        anchors.append(anchor)
        for column in range(columns):
            left = 44 + column * 265
            width = 507 if columns == 1 else 242
            if zh:
                paragraph = (
                    f"第{column + 1}栏：这是一份用于阅读验证的原创学习资料。"
                    "阅读时先识别问题，再整理关键概念。用自己的话解释概念，可以帮助检查理解是否完整。"
                    "记录来源页码便于回到原文核对。页面显示和文字提取应保持一致，不能把相邻两栏混在一起。"
                )
            else:
                paragraph = (
                    f"Column {column + 1}: These original study notes are engineering fixtures. "
                    "Read the question before collecting evidence. Explain each concept in your own words. "
                    "Keep the source page so that a reader can return to the original passage. "
                    "Selection should not mix unrelated columns."
                )
            for block in range(3):
                available = page.insert_textbox(fitz.Rect(left, 120 + block * 180, left + width, 280 + block * 180),
                                               paragraph, fontsize=12, fontname=font, lineheight=1.6)
                if available < 0:
                    raise RuntimeError("Fixture text overflow")
        page.insert_text((44, 790), f"FocusUI original fixture / {index:02d} / {number}", fontsize=10)
    target = OUT / f"sample-{index:02d}.pdf"
    doc.save(target, deflate=True, no_new_id=True)
    doc.close()
    with fitz.open(target) as check:
        assert len(check) == 3
        for n, page in enumerate(check):
            assert anchors[n] in page.get_text(), (target.name, n)
    manifest.append({"file": target.name, "pages": 3, "language": "zh" if zh else "en",
                     "layout": f"{columns}-column", "anchors": anchors,
                     "sha256": hashlib.sha256(target.read_bytes()).hexdigest()})

with fitz.open(OUT / "sample-01.pdf") as original:
    scanned = fitz.open()
    for source in original:
        page = scanned.new_page(width=595, height=842)
        page.insert_image(page.rect, stream=source.get_pixmap(matrix=fitz.Matrix(1, 1)).tobytes("png"))
    scanned.save(OUT / "scanned.pdf", deflate=True, no_new_id=True)
    scanned.close()
    original.save(OUT / "encrypted.pdf", encryption=fitz.PDF_ENCRYPT_AES_256,
                  owner_pw="fixture-owner-only", user_pw="fixture-password", no_new_id=True)
(OUT / "corrupt.pdf").write_bytes(b"%PDF-1.7\nThis is intentionally broken.\n")
oversized = fitz.open()
for _ in range(121):
    oversized.new_page(width=595, height=842)
oversized.save(OUT / "too-many-pages.pdf", no_new_id=True)
oversized.close()
(OUT / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
print("Generated 10 three-page text PDFs and 4 negative fixtures.")

# Twelve-page navigation fixture for bitmap eviction and return-to-page tests.
with fitz.open(OUT / "sample-06.pdf") as source:
    continuous = fitz.open()
    for _ in range(4):
        continuous.insert_pdf(source)
    continuous.save(OUT / "continuous.pdf", deflate=True, no_new_id=True)
    continuous.close()
print("Generated twelve-page continuous reading fixture.")
