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

# El marco de la tablet es 16:10. Se exporta al doble de su ancho maximo en
# pantalla (880 px) para que se vea nitido en pantallas Retina.
ANCHO = 1760
ALTO = 1100
CALIDAD = 82
EXTENSIONES = {'.png', '.jpg', '.jpeg', '.webp', '.bmp', '.tif', '.tiff'}


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

    publicadas = []
    for i, nombre in enumerate(ordenadas, start=1):
        ruta = os.path.join(entrada, nombre)
        try:
            with Image.open(ruta) as im:
                # Respeta la orientacion EXIF: una foto de celular puede venir
                # girada y se publicaria de lado.
                im = ImageOps.exif_transpose(im)
                im = im.convert('RGB')
                # Recorte centrado al 16:10, sin deformar.
                im = ImageOps.fit(im, (ANCHO, ALTO), method=Image.LANCZOS, centering=(0.5, 0.5))
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
        json.dump({'imagenes': publicadas}, fh, ensure_ascii=False, indent=2)

    print(f'\n{len(publicadas)} imagenes publicadas en public/portada/')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
