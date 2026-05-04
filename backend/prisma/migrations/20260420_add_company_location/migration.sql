-- ================================================================
-- Migration: add_company_location
-- Adds province, canton, district columns to companies table
-- for complete Hacienda v4.4 XML Ubicacion section.
-- ================================================================

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS province VARCHAR(2),
  ADD COLUMN IF NOT EXISTS canton   VARCHAR(3),
  ADD COLUMN IF NOT EXISTS district VARCHAR(3);

COMMENT ON COLUMN companies.province IS 'Provincia Hacienda CR: 1=SJ 2=Alajuela 3=Cartago 4=Heredia 5=Guanacaste 6=Puntarenas 7=Limon';
COMMENT ON COLUMN companies.canton   IS 'Codigo canton CR, ej: 01';
COMMENT ON COLUMN companies.district IS 'Codigo distrito CR, ej: 01';
