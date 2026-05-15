import fitz
from pathlib import Path

BASE = Path(__file__).parent
pdf = BASE / "2026학년도-대학수학능력시험-수학-문제.pdf"

doc = fitz.open(pdf)
out_lines = []
for pno in [0, 4, 5, 14]:
    page = doc[pno]
    out_lines.append(f"=== PAGE {pno+1} ===\n")
    out_lines.append(page.get_text("text"))
    out_lines.append("\n\n")
doc.close()

out_path = BASE / "_text_sample.txt"
out_path.write_text("".join(out_lines), encoding="utf-8")
print(f"wrote {out_path}")
