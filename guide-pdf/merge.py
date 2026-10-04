"""Join the per-page PDFs from build.mjs into one document.
   python3 guide-pdf/merge.py <dir> <out.pdf> <title>"""
import sys, glob, pymupdf
d, out, title = sys.argv[1], sys.argv[2], sys.argv[3]
doc = pymupdf.open()
for f in sorted(glob.glob(f"{d}/[0-9][0-9].pdf")):
    doc.insert_pdf(pymupdf.open(f))
doc.set_metadata({"title": title, "author": "BCN Student Concierge", "subject": "Student paperwork guide", "creator": "bcnstudent.com"})
doc.save(out, garbage=4, deflate=True)
print(out, len(doc), "pages")
