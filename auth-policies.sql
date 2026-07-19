-- ============================================================
-- TS-SUITE — AUTH SCHARF SCHALTEN (auth-policies.sql)
--
-- ERST AUSFÜHREN, WENN:
--   1. der neue Code (ts-auth.js + angepasste Seiten) deployed ist
--   2. mindestens ein Nutzer unter Authentication > Users angelegt ist
--   3. der Login auf allen Seiten getestet wurde
--
-- Ab dann kommen nur noch angemeldete Nutzer an die Daten.
-- Rückweg im Notfall: siehe Block ganz unten.
-- ============================================================

-- ---------- Alte offene Policies entfernen ----------
DROP POLICY IF EXISTS "anon voller Zugriff berichte" ON berichte;
DROP POLICY IF EXISTS "anon alles" ON crm_aktivitaeten;
DROP POLICY IF EXISTS "anon alles" ON crm_angebote;
DROP POLICY IF EXISTS "anon alles" ON crm_ansprechpartner;
DROP POLICY IF EXISTS "anon alles" ON crm_preisliste;
DROP POLICY IF EXISTS "anon alles" ON crm_wartungsplan;
DROP POLICY IF EXISTS "anon alles" ON crm_wartungspositionen;
DROP POLICY IF EXISTS "anon alles" ON crm_wiedervorlagen;
DROP POLICY IF EXISTS "anon voller Zugriff kontakte" ON kontakte;
DROP POLICY IF EXISTS "anon alles" ON kunden;

-- ---------- Neue Policies: nur angemeldete Nutzer ----------
CREATE POLICY "auth alles" ON berichte              FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth alles" ON crm_aktivitaeten      FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth alles" ON crm_angebote          FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth alles" ON crm_ansprechpartner   FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth alles" ON crm_preisliste        FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth alles" ON crm_wartungsplan      FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth alles" ON crm_wartungspositionen FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth alles" ON crm_wiedervorlagen    FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth alles" ON kontakte              FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth alles" ON kunden                FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ---------- Storage: Uploads nur für angemeldete Nutzer ----------
-- Öffentliches LESEN der Buckets bleibt erhalten (public buckets),
-- damit Foto- und Datei-URLs in PDFs/Links weiter funktionieren.
-- WICHTIG: Vorhandene eigene Upload-Policies auf storage.objects
-- (Dashboard > Storage > Policies) danach manuell löschen, falls
-- sie anon-Uploads erlauben.
CREATE POLICY "auth upload berichte-medien" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'berichte-medien');
CREATE POLICY "auth update berichte-medien" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'berichte-medien');
CREATE POLICY "auth upload angebote" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'angebote');
CREATE POLICY "auth update angebote" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'angebote');

-- ============================================================
-- NOTFALL-RÜCKWEG (nur falls etwas klemmt): stellt den alten,
-- offenen Zustand wieder her. Danach in Ruhe Fehler suchen.
-- ============================================================
-- DROP POLICY IF EXISTS "auth alles" ON berichte;
-- CREATE POLICY "anon voller Zugriff berichte" ON berichte FOR ALL TO public USING (true) WITH CHECK (true);
-- (sinngemäß für die übrigen Tabellen)
