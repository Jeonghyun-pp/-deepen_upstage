import fitz
from pathlib import Path

BASE = Path(__file__).parent
DPI = 220

pdfs = [
    "2025년-9월-고3-모의고사-수학-문제.pdf",
    "2026학년도-대학수학능력시험-수학-문제.pdf",
    "2026학년도-6월-모의평가-수학-문제.pdf",
]

for pdf_name in pdfs:
    pdf_path = BASE / pdf_name
    out_dir = BASE / "_pages" / pdf_path.stem
    out_dir.mkdir(parents=True, exist_ok=True)
    doc = fitz.open(pdf_path)
    for i, page in enumerate(doc, start=1):
        pix = page.get_pixmap(dpi=DPI)
        pix.save(out_dir / f"p{i:02d}.png")
    print(pdf_name, "->", len(doc), "pages")
    doc.close()
