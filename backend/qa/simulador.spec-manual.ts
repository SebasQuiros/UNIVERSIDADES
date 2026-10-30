/**
 * Simulador financiero: la viabilidad tiene que RESPONDER a los datos.
 *
 * Reporte: "aunque se modifiquen los datos no sirve". Era cierto. Con los
 * valores por defecto, tres de las cinco señales del score ya estaban en su
 * tope (margen 50 %, utilidad 1× los fijos, recuperación 12 meses), asi que
 * 70 de los 100 puntos quedaban fijos. Subir el precio, bajar los costos o
 * multiplicar el mercado por cien dejaba la nota en 86.
 *
 * Lo que se vigila: que mejorar SIEMPRE suba la nota y empeorar SIEMPRE la
 * baje. Un simulador que no reacciona no enseña nada.
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { FinancialSimulatorService } from '../src/modules/simulator/financial-simulator.service';

let ok = 0, fallos = 0;
const detalle: string[] = [];
function chequear(nombre: string, cond: boolean, extra = '') {
  if (cond) { ok++; console.log(`  ok   ${nombre}`); }
  else { fallos++; detalle.push(`${nombre}${extra ? ' -> ' + extra : ''}`); console.log(`  FALLA ${nombre}${extra ? ' -> ' + extra : ''}`); }
}

const BASE: any = {
  sector: 'comercio',
  unitPrice: 5000,
  unitCost: 2000,
  monthlyFixedCosts: 500_000,
  initialInvestment: 3_000_000,
  innovationLevel: 3,
  competitionLevel: 3,
  estimatedMarketSizeUnits: 1000,
};

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const sim = app.get(FinancialSimulatorService);
  const prob = async (c: any) => (await sim.analyze({ ...BASE, ...c } as any) as any).successProbability;

  try {
    console.log('--- 1. Cada cambio mueve la aguja ---');
    const casos: Array<[string, any]> = [
      ['por defecto',                 {}],
      ['precio 20 000',               { unitPrice: 20_000 }],
      ['precio 2 100',                { unitPrice: 2_100 }],
      ['costo 4 900',                 { unitCost: 4_900 }],
      ['fijos 50 000',                { monthlyFixedCosts: 50_000 }],
      ['fijos 5 000 000',             { monthlyFixedCosts: 5_000_000 }],
      ['mercado 100 000 u',           { estimatedMarketSizeUnits: 100_000 }],
      ['innovacion 5 / competencia 1', { innovationLevel: 5, competitionLevel: 1 }],
      ['innovacion 1 / competencia 5', { innovationLevel: 1, competitionLevel: 5 }],
      ['inversion 100 000 000',       { initialInvestment: 100_000_000 }],
    ];
    const vistos = new Set<number>();
    for (const [etq, c] of casos) {
      const p = await prob(c);
      vistos.add(p);
      console.log(`       ${etq.padEnd(30)} ${String(p).padStart(3)}`);
    }
    chequear('al menos 8 resultados distintos entre 10 escenarios', vistos.size >= 8,
      `${vistos.size} distintos; si son pocos, el score esta saturado otra vez`);

    console.log('\n--- 2. Mejorar SIEMPRE sube (margen) ---');
    const margenes = [2_100, 3_000, 5_000, 9_000, 20_000];
    const porMargen: number[] = [];
    for (const precio of margenes) porMargen.push(await prob({ unitPrice: precio }));
    console.log(`       precios ${margenes.join(', ')} -> ${porMargen.join(', ')}`);
    chequear('subir el precio nunca baja la nota',
      porMargen.every((v, i) => i === 0 || v >= porMargen[i - 1]),
      porMargen.join(' '));
    chequear('y entre el peor y el mejor hay diferencia real',
      porMargen[porMargen.length - 1] - porMargen[0] >= 15,
      `${porMargen[0]} -> ${porMargen[porMargen.length - 1]}`);

    console.log('\n--- 3. Empeorar SIEMPRE baja (costos fijos) ---');
    const fijos = [50_000, 500_000, 1_500_000, 3_000_000, 6_000_000];
    const porFijos: number[] = [];
    for (const f of fijos) porFijos.push(await prob({ monthlyFixedCosts: f }));
    console.log(`       fijos ${fijos.join(', ')} -> ${porFijos.join(', ')}`);
    chequear('subir los costos fijos nunca sube la nota',
      porFijos.every((v, i) => i === 0 || v <= porFijos[i - 1]),
      porFijos.join(' '));

    console.log('\n--- 4. La inversion pesa (recuperacion) ---');
    const inv = [500_000, 3_000_000, 20_000_000, 100_000_000];
    const porInv: number[] = [];
    for (const v of inv) porInv.push(await prob({ initialInvestment: v }));
    console.log(`       inversion ${inv.join(', ')} -> ${porInv.join(', ')}`);
    chequear('mas inversion para la misma utilidad nunca sube la nota',
      porInv.every((v, i) => i === 0 || v <= porInv[i - 1]), porInv.join(' '));

    console.log('\n--- 5. Un modelo que pierde plata se nota ---');
    const malo = await prob({ unitPrice: 2_100 });
    const bueno = await prob({});
    chequear('perder plata puntua claramente peor', malo < bueno - 30, `${malo} vs ${bueno}`);
    chequear('y no da un numero absurdo', malo >= 0 && malo <= 100, String(malo));

    console.log('\n--- 6. El score se queda dentro de 0-100 ---');
    const extremos = [
      await prob({ unitPrice: 1_000_000, monthlyFixedCosts: 1, initialInvestment: 1, innovationLevel: 5, competitionLevel: 1 }),
      await prob({ unitPrice: 2_001, unitCost: 2_000, monthlyFixedCosts: 50_000_000, initialInvestment: 500_000_000, innovationLevel: 1, competitionLevel: 5 }),
    ];
    console.log(`       extremos -> ${extremos.join(', ')}`);
    chequear('ningun extremo se sale del rango',
      extremos.every((v) => v >= 0 && v <= 100), extremos.join(' '));
  } finally {
    await app.close();
  }

  console.log(`\n================ RESULTADO: ${ok} ok / ${fallos} fallos ================`);
  if (fallos) { console.log('FALLOS:'); detalle.forEach((d) => console.log('  - ' + d)); }
  process.exit(fallos ? 1 : 0);
}

main().catch((e) => { console.error('FATAL:', e?.stack ?? e); process.exit(1); });
