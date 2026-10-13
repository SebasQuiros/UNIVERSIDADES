#!/usr/bin/env python
"""
Genera el PDF del manual de uso de ContaSJ.

Lee el MISMO contenido que la pagina de Ayuda (src/content/manual.json), asi
que no hay dos manuales que puedan desincronizarse.

    python scripts/manual-pdf.py [salida.pdf]

Las capturas son opcionales: si un archivo de public/manual/ no existe, la
seccion se imprime solo con su texto. Un manual sin fotos sigue sirviendo;
uno con recuadros rotos, no.

Requiere reportlab.
"""
import json
import os
import sys
from datetime import date

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    BaseDocTemplate, Frame, Image, KeepTogether, NextPageTemplate, PageBreak,
    PageTemplate, Paragraph, Spacer, Table, TableStyle,
)

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.dirname(AQUI)
JSON_MANUAL = os.path.join(RAIZ, 'src', 'content', 'manual.json')
DIR_CAPTURAS = os.path.join(RAIZ, 'public', 'manual')
LOGO = os.path.join(RAIZ, 'public', 'sjqa-logo-transparente.png')

# Paleta: la misma del sistema.
AZUL = colors.HexColor('#1B2E6E')
AZUL_CLARO = colors.HexColor('#1D4ED8')
ORO = colors.HexColor('#B8860B')
GRIS = colors.HexColor('#475569')
GRIS_TENUE = colors.HexColor('#94A3B8')
AMBAR_FONDO = colors.HexColor('#FFFBEB')
AMBAR_BORDE = colors.HexColor('#FDE68A')

ROL_NOMBRE = {'ADMIN': 'Administración', 'TEACHER': 'Profesorado', 'STUDENT': 'Estudiantes'}

MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
         'agosto', 'setiembre', 'octubre', 'noviembre', 'diciembre']


def escapar(t: str) -> str:
    """ReportLab interpreta XML en los parrafos."""
    return (str(t).replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;'))


def estilos():
    base = getSampleStyleSheet()
    s = {}
    s['titulo_portada'] = ParagraphStyle(
        'tp', parent=base['Title'], fontName='Helvetica-Bold', fontSize=34,
        leading=38, textColor=AZUL, alignment=TA_CENTER, spaceAfter=6)
    s['sub_portada'] = ParagraphStyle(
        'sp', parent=base['Normal'], fontName='Helvetica', fontSize=12.5,
        leading=17, textColor=GRIS, alignment=TA_CENTER)
    s['eyebrow'] = ParagraphStyle(
        'eb', parent=base['Normal'], fontName='Helvetica-Bold', fontSize=7.5,
        leading=10, textColor=ORO, spaceAfter=2)
    s['capitulo'] = ParagraphStyle(
        'cap', parent=base['Heading1'], fontName='Helvetica-Bold', fontSize=19,
        leading=23, textColor=AZUL, spaceAfter=4)
    s['intro'] = ParagraphStyle(
        'in', parent=base['Normal'], fontName='Helvetica', fontSize=9.5,
        leading=14, textColor=GRIS, spaceAfter=12, alignment=TA_JUSTIFY)
    s['seccion'] = ParagraphStyle(
        'se', parent=base['Heading2'], fontName='Helvetica-Bold', fontSize=12,
        leading=15, textColor=colors.HexColor('#0B1A3A'), spaceBefore=4, spaceAfter=3)
    s['roles'] = ParagraphStyle(
        'ro', parent=base['Normal'], fontName='Helvetica', fontSize=7.5,
        leading=10, textColor=GRIS_TENUE, spaceAfter=4)
    s['cuerpo'] = ParagraphStyle(
        'cu', parent=base['Normal'], fontName='Helvetica', fontSize=9.5,
        leading=14, textColor=colors.HexColor('#334155'), spaceAfter=6, alignment=TA_JUSTIFY)
    s['paso'] = ParagraphStyle(
        'pa', parent=base['Normal'], fontName='Helvetica', fontSize=9.5,
        leading=13.5, textColor=colors.HexColor('#334155'))
    s['aviso'] = ParagraphStyle(
        'av', parent=base['Normal'], fontName='Helvetica', fontSize=8.8,
        leading=12.5, textColor=colors.HexColor('#78350F'))
    s['indice'] = ParagraphStyle(
        'ix', parent=base['Normal'], fontName='Helvetica', fontSize=10,
        leading=18, textColor=colors.HexColor('#1E293B'))
    return s


def construir(salida: str) -> int:
    with open(JSON_MANUAL, encoding='utf-8') as fh:
        datos = json.load(fh)
    meta = datos['meta']
    capitulos = datos['capitulos']
    s = estilos()

    hoy = date.today()
    fecha = f'{hoy.day} de {MESES[hoy.month - 1]} de {hoy.year}'

    def pie(canvas, doc):
        """Numero de pagina y firma, salvo en la portada."""
        canvas.saveState()
        if doc.page > 1:
            canvas.setFont('Helvetica', 7.5)
            canvas.setFillColor(GRIS_TENUE)
            canvas.drawString(20 * mm, 12 * mm, f"{meta['sistema']} · Manual de uso v{meta['version']}")
            canvas.drawRightString(A4[0] - 20 * mm, 12 * mm, str(doc.page - 1))
            canvas.setStrokeColor(colors.HexColor('#E2E8F0'))
            canvas.setLineWidth(0.4)
            canvas.line(20 * mm, 16 * mm, A4[0] - 20 * mm, 16 * mm)
        canvas.restoreState()

    doc = BaseDocTemplate(
        salida, pagesize=A4,
        leftMargin=20 * mm, rightMargin=20 * mm,
        topMargin=18 * mm, bottomMargin=20 * mm,
        title=f"{meta['sistema']} — Manual de uso",
        author=meta['empresa'],
        subject=meta['subtitulo'],
    )
    marco = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id='normal')
    doc.addPageTemplates([PageTemplate(id='base', frames=[marco], onPage=pie)])

    hist = []

    # ── Portada ──
    if os.path.exists(LOGO):
        logo = Image(LOGO)
        prop = logo.imageHeight / logo.imageWidth
        logo.drawWidth = 62 * mm
        logo.drawHeight = 62 * mm * prop
        logo.hAlign = 'CENTER'
        hist += [Spacer(1, 42 * mm), logo, Spacer(1, 14 * mm)]
    else:
        hist += [Spacer(1, 60 * mm)]

    hist += [
        Paragraph(escapar(meta['sistema']), s['titulo_portada']),
        Paragraph(escapar(meta['subtitulo']), s['sub_portada']),
        Spacer(1, 10 * mm),
        Paragraph('<b>MANUAL DE USO</b>', ParagraphStyle(
            'mu', fontName='Helvetica-Bold', fontSize=13, leading=16,
            textColor=ORO, alignment=TA_CENTER)),
        Spacer(1, 4 * mm),
        Paragraph(f"Versión {escapar(meta['version'])} · {escapar(fecha)}", s['sub_portada']),
        Spacer(1, 34 * mm),
        Paragraph(
            f"Desarrollado por <b>{escapar(meta['empresa'])}</b><br/>"
            'Los documentos que genera el sistema son ejercicios académicos, '
            'sin validez fiscal ni legal.',
            ParagraphStyle('pie', fontName='Helvetica', fontSize=8.5, leading=13,
                           textColor=GRIS_TENUE, alignment=TA_CENTER)),
        PageBreak(),
    ]

    # ── Índice ──
    hist += [Paragraph('CONTENIDO', s['eyebrow']),
             Paragraph('Índice', s['capitulo']), Spacer(1, 5 * mm)]
    filas = []
    for c in capitulos:
        filas.append([
            Paragraph(f"<font color='#94A3B8'>{c['numero']}.</font>", s['indice']),
            Paragraph(escapar(c['titulo']), s['indice']),
            Paragraph(f"<font size=8 color='#94A3B8'>{len(c['secciones'])} temas</font>", s['indice']),
        ])
    t = Table(filas, colWidths=[12 * mm, doc.width - 42 * mm, 30 * mm])
    t.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('LINEBELOW', (0, 0), (-1, -2), 0.3, colors.HexColor('#F1F5F9')),
    ]))
    hist += [t, PageBreak()]

    # ── Capítulos ──
    capturas_usadas = 0
    for ci, c in enumerate(capitulos):
        hist += [
            Paragraph(f"CAPÍTULO {c['numero']}", s['eyebrow']),
            Paragraph(escapar(c['titulo']), s['capitulo']),
            Paragraph(escapar(c['intro']), s['intro']),
        ]

        for sec in c['secciones']:
            bloque = [Paragraph(escapar(sec['titulo']), s['seccion'])]
            roles = ' · '.join(ROL_NOMBRE.get(r, r) for r in sec.get('paraQuien', []))
            if roles:
                bloque.append(Paragraph(escapar(roles).upper(), s['roles']))
            bloque.append(Paragraph(escapar(sec['resumen']), s['cuerpo']))

            pasos = sec.get('pasos') or []
            if pasos:
                filas_p = [[
                    Paragraph(f"<font color='#1D4ED8'><b>{i}</b></font>", s['paso']),
                    Paragraph(escapar(p), s['paso']),
                ] for i, p in enumerate(pasos, 1)]
                tp = Table(filas_p, colWidths=[8 * mm, doc.width - 8 * mm])
                tp.setStyle(TableStyle([
                    ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                    ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
                    ('TOPPADDING', (0, 0), (-1, -1), 2),
                    ('LEFTPADDING', (0, 0), (0, -1), 0),
                ]))
                bloque += [tp, Spacer(1, 3 * mm)]

            captura = sec.get('captura')
            if captura:
                ruta = os.path.join(DIR_CAPTURAS, captura)
                if os.path.exists(ruta):
                    try:
                        img = Image(ruta)
                        prop = img.imageHeight / img.imageWidth
                        img.drawWidth = doc.width
                        img.drawHeight = doc.width * prop
                        # Una captura mas alta que la caja de texto rompe el
                        # flujo: se acota y se deja que respire.
                        tope = 110 * mm
                        if img.drawHeight > tope:
                            img.drawWidth *= tope / img.drawHeight
                            img.drawHeight = tope
                        img.hAlign = 'CENTER'
                        bloque += [img, Spacer(1, 4 * mm)]
                        capturas_usadas += 1
                    except Exception as e:  # noqa: BLE001 — una imagen mala no tumba el manual
                        print(f'  aviso: no se pudo incrustar {captura}: {e}')

            for av in (sec.get('avisos') or []):
                ta = Table([[Paragraph(escapar(av), s['aviso'])]], colWidths=[doc.width])
                ta.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (-1, -1), AMBAR_FONDO),
                    ('BOX', (0, 0), (-1, -1), 0.6, AMBAR_BORDE),
                    ('LEFTPADDING', (0, 0), (-1, -1), 7),
                    ('RIGHTPADDING', (0, 0), (-1, -1), 7),
                    ('TOPPADDING', (0, 0), (-1, -1), 5),
                    ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
                ]))
                bloque += [ta, Spacer(1, 2.5 * mm)]

            bloque.append(Spacer(1, 5 * mm))
            # KeepTogether evita que un titulo quede solo al pie de pagina.
            hist.append(KeepTogether(bloque))

        if ci < len(capitulos) - 1:
            hist.append(PageBreak())

    doc.build(hist)

    secciones = sum(len(c['secciones']) for c in capitulos)
    kb = os.path.getsize(salida) // 1024
    print(f'{salida}')
    print(f'  {len(capitulos)} capitulos · {secciones} secciones · {capturas_usadas} capturas · {kb} KB')
    return 0


if __name__ == '__main__':
    destino = sys.argv[1] if len(sys.argv) > 1 else os.path.join(RAIZ, 'public', 'manual-contasj.pdf')
    os.makedirs(os.path.dirname(destino), exist_ok=True)
    raise SystemExit(construir(destino))
