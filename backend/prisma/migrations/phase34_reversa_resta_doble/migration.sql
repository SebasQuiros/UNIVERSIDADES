-- phase34_reversa_resta_doble
--
-- Arregla los saldos de las empresas que ya revirtieron algun asiento.
--
-- En todo el sistema `is_reversed = false` significa "este asiento cuenta
-- para los saldos". Al revertir se marcaba SOLO el original, asi que la
-- reversa quedaba contando sola: revertir una venta de 250.000 no devolvia
-- el saldo a su lugar, lo dejaba en MENOS 250.000, y hacia desaparecer ese
-- dinero del activo. La partida doble seguia cuadrando (debe = haber), asi
-- que ninguna validacion se quejaba.
--
-- El codigo ya marca los dos (ver JournalService.reverseEntry). Esto corrige
-- los pares que quedaron a medias en la base.
--
-- Idempotente: solo toca reversas que apuntan a un original ya marcado y que
-- todavia estan sin marcar.
UPDATE "journal_entries" AS reversa
   SET "is_reversed" = true
  FROM "journal_entries" AS original
 WHERE original."reversed_by" = reversa."id"
   AND original."is_reversed"    = true
   AND reversa."is_reversed"     = false;
