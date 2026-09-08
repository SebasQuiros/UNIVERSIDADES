# Suites de verificacion manual

Se ejecutan contra una base de datos real (la de pruebas, NO produccion).
Crean entidades desechables con prefijo `__QA_` y las borran al terminar,
pase o falle la prueba.

    npx ts-node -r tsconfig-paths/register qa/cursos.spec-manual.ts
    npx ts-node -r tsconfig-paths/register qa/contable.spec-manual.ts

Quedan FUERA del build: `tsconfig.json` compila solo `src/**/*`, asi que
nada de esto llega a la imagen de produccion.

- `cursos` — alta de cursos, designacion de responsable y aislamiento
  entre instituciones (19 comprobaciones).
- `contable` — ciclo completo: catalogo, cliente, factura de contado y a
  credito, emision, partida doble, balanza, ecuacion contable, estado de
  resultados escalonado, auxiliar de clientes contra el mayor, y reversa
  (34 comprobaciones).
