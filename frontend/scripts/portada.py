#!/usr/bin/env python
"""
Publica las imagenes de la tablet de la portada.

Toma lo que haya en una carpeta de entrada -con cualquier nombre y cualquier
formato- y deja en public/portada/ las imagenes listas: recortadas al formato
de la tablet, redimensionadas, comprimidas y listadas en un manifest.json.

    python scripts/portada.py "C:/Users/quiro/Downloads/PORTADA-CONTASJ"

El orden: si los archivos empiezan por un numero (1-algo.png) se respeta ese
orden; si no, se usan por fecha de modificacion. Asi el dueno del sistema
decide el orden sin tocar codigo.

Se recorta al centro en vez de deformar: una captura estirada se nota
inmediatamente y es justo lo que da aspecto de plantilla.

Requiere Pillow.
"""
import json
import os
import re
import shutil
import sys

from PIL import Image, ImageOps

# Se exporta al doble del ancho maximo en pantalla (880 px) para que se vea
# nitido en pantallas Retina. La ALTURA no es fija: la decide la primera
# imagen, y el marco de la portada se adapta a ella.
#
# Fijar el marco en 16:10 obligaba a elegir entre dos males con una captura
# apaisada -una franja de panel, por ejemplo-: recortarla y perder medio
# contenido, o encajarla y dejarla diminuta en medio de un relleno enorme.
# Que mande la imagen y no el marco resuelve los dos casos.
ANCHO = 1760
ALTO_MAXIMO = 1200
ALTO_MINIMO = 300
CALIDAD = 82
EXTENSIONES = {'.png', '.jpg', '.jpeg', '.webp', '.bmp', '.tif', '.tiff'}


# Si la proporcion de la imagen se parece a la del marco, se recorta al
# centro. Si es muy distinta -una captura apaisada de un panel, por
# ejemplo- recortar se comeria el contenido: ahi se encaja entera y se
# rellena con el color de su propio borde, que se nota mucho menos que
# unas bandas negras y mucho menos que perder media captura.
TOLERANCIA_PROPORCION = 0.25


def color_de_borde(im: Image.Image):
    """Color dominante del borde, para rellenar sin que se note el pegado."""
    chico = im.resize((40, 25), Image.LANCZOS)
    px = chico.load()
    muestras = []
    for x in range(40):
        muestras += [px[x, 0], px[x, 24]]
    for y in range(25):
        muestras += [px[0, y], px[39, y]]
    n = len(muestras)
    return tuple(sum(m[i] for m in muestras) // n for i in range(3))


def encajar(im: Image.Image, alto: int) -> Image.Image:
    """Lleva la imagen a ANCHO x alto.

    Si su proporcion se parece a la del marco, recorta al centro. Si es muy
    distinta, la encaja entera y rellena con el color de su propio borde:
    se nota mucho menos que unas bandas negras, y muchisimo menos que
    perder media captura.
    """
    objetivo = ANCHO / alto
    propia = im.width / im.height
    if abs(propia - objetivo) / objetivo <= TOLERANCIA_PROPORCION:
        return ImageOps.fit(im, (ANCHO, alto), method=Image.LANCZOS, centering=(0.5, 0.5))

    lienzo = Image.new('RGB', (ANCHO, alto), color_de_borde(im))
    copia = im.copy()
    copia.thumbnail((ANCHO, alto), Image.LANCZOS)
    lienzo.paste(copia, ((ANCHO - copia.width) // 2, (alto - copia.height) // 2))
    return lienzo


def orden(nombre: str):
    """Numero inicial del nombre, si lo hay; si no, None."""
    m = re.match(r'^\s*(\d+)', nombre)
    return int(m.group(1)) if m else None


def main() -> int:
    if len(sys.argv) < 2:
        print('uso: python scripts/portada.py <carpeta-con-las-imagenes>')
        return 2

    entrada = sys.argv[1]
    if not os.path.isdir(entrada):
        print(f'no existe la carpeta: {entrada}')
        return 2

    aqui = os.path.dirname(os.path.abspath(__file__))
    destino = os.path.join(os.path.dirname(aqui), 'public', 'portada')

    archivos = [
        f for f in os.listdir(entrada)
        if os.path.splitext(f)[1].lower() in EXTENSIONES
        and os.path.isfile(os.path.join(entrada, f))
    ]
    if not archivos:
        print(f'no hay imagenes en {entrada}')
        return 1

    # Numeradas primero y en su orden; el resto por fecha.
    numeradas = sorted([f for f in archivos if orden(f) is not None], key=orden)
    resto = sorted(
        [f for f in archivos if orden(f) is None],
        key=lambda f: os.path.getmtime(os.path.join(entrada, f)),
    )
    ordenadas = numeradas + resto

    # Se limpia el destino: el manifiesto es la unica fuente de verdad y no
    # queremos arrastrar imagenes de una tanda anterior.
    if os.path.isdir(destino):
        shutil.rmtree(destino)
    os.makedirs(destino, exist_ok=True)

    # La primera imagen fija la forma del marco; las demas se llevan a esa
    # misma forma para que la rotacion no salte de tamano.
    with Image.open(os.path.join(entrada, ordenadas[0])) as primera:
        primera = ImageOps.exif_transpose(primera)
        alto = round(ANCHO * primera.height / primera.width)
    alto = max(ALTO_MINIMO, min(ALTO_MAXIMO, alto))
    print(f'marco: {ANCHO}x{alto}  (lo define "{ordenadas[0]}")')

    publicadas = []
    for i, nombre in enumerate(ordenadas, start=1):
        ruta = os.path.join(entrada, nombre)
        try:
            with Image.open(ruta) as im:
                # Respeta la orientacion EXIF: una foto de celular puede venir
                # girada y se publicaria de lado.
                im = ImageOps.exif_transpose(im)
                im = im.convert('RGB')
                im = encajar(im, alto)
                salida = f'{i}.webp'
                im.save(os.path.join(destino, salida), 'WEBP', quality=CALIDAD, method=6)
                kb = os.path.getsize(os.path.join(destino, salida)) // 1024
                publicadas.append(f'/portada/{salida}')
                print(f'  {nombre}  ->  {salida}  ({kb} KB)')
        except Exception as e:  # noqa: BLE001 — una imagen mala no debe cortar el resto
            print(f'  {nombre}  -> OMITIDA: {e}')

    if not publicadas:
        print('ninguna imagen se pudo procesar')
        return 1

    with open(os.path.join(destino, 'manifest.json'), 'w', encoding='utf-8') as fh:
        json.dump(
            {'imagenes': publicadas, 'aspecto': round(ANCHO / alto, 4)},
            fh, ensure_ascii=False, indent=2,
        )

    print(f'\n{len(publicadas)} imagenes publicadas en public/portada/')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
