#!/usr/bin/env python3
"""Regenerate sales/脳リフレクソ_購入者案内.pdf from sales/purchaser-guide.txt"""
from pathlib import Path
from fpdf import FPDF
import sys

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / 'sales' / 'purchaser-guide.txt'
OUT = ROOT / 'sales' / '脳リフレクソ_購入者案内.pdf'
FONT = ROOT / 'sales' / '_hiragino_w3.ttf'
FALLBACK = Path('/System/Library/Fonts/Supplemental/Arial Unicode.ttf')

def ensure_font():
    if FONT.exists():
        return FONT
    src = Path('/System/Library/Fonts/ヒラギノ角ゴシック W3.ttc')
    if src.exists():
        from fontTools.ttLib import TTCollection
        TTCollection(str(src)).fonts[0].save(str(FONT))
        return FONT
    if FALLBACK.exists():
        return FALLBACK
    sys.exit('No Japanese font available')

def main():
    font = ensure_font()
    text = SRC.read_text(encoding='utf-8')
    clean_lines = []
    for line in text.splitlines():
        s = line.strip()
        if s and set(s) <= {'=', '-'}:
            clean_lines.append(None)
            continue
        clean_lines.append(line.replace('—', ' - ').replace('–', '-'))

    class GuidePDF(FPDF):
        def footer(self):
            self.set_y(-12)
            self.set_font('JP', size=8)
            self.set_text_color(130, 130, 130)
            self.cell(0, 6, str(self.page_no()), align='C')

    pdf = GuidePDF(format='A4', unit='mm')
    pdf.set_auto_page_break(auto=True, margin=14)
    pdf.add_page()
    LEFT = 16
    pdf.set_left_margin(LEFT)
    pdf.set_right_margin(16)
    pdf.add_font('JP', fname=str(font))

    def write_line(txt, size=10.5, h=6.2, color=(25, 25, 25)):
        pdf.set_x(LEFT)
        pdf.set_font('JP', size=size)
        pdf.set_text_color(*color)
        pdf.multi_cell(w=pdf.epw, h=h, text=txt or ' ', new_x='LMARGIN', new_y='NEXT')

    write_line('脳リフレクソ - 購入者さま向けご利用案内', size=15, h=9)
    pdf.set_x(LEFT)
    pdf.set_draw_color(40, 90, 130)
    pdf.set_line_width(0.5)
    y = pdf.get_y() + 0.5
    pdf.line(LEFT, y, LEFT + pdf.epw, y)
    pdf.ln(4)

    started = False
    for line in clean_lines:
        if line is None:
            pdf.ln(1.5)
            pdf.set_x(LEFT)
            pdf.set_draw_color(210, 215, 220)
            pdf.set_line_width(0.2)
            y = pdf.get_y()
            pdf.line(LEFT, y, LEFT + pdf.epw, y)
            pdf.ln(3)
            continue
        if not started:
            if '購入者さま向けご利用案内' in line:
                continue
            started = True
        if not line.strip():
            pdf.ln(1.2)
            continue
        if line.startswith('http'):
            write_line(line, size=9.5, h=5.5, color=(10, 90, 170))
            pdf.ln(1)
        elif line.startswith('【') or line.startswith('■') or (len(line) > 2 and line[0].isdigit() and line[1] in '.).'):
            write_line(line, size=11.5, h=7)
        else:
            write_line(line, size=10.5, h=6.2)

    pdf.output(str(OUT))
    print(f'wrote {OUT} ({OUT.stat().st_size} bytes, {pdf.page} page(s))')

if __name__ == '__main__':
    main()
