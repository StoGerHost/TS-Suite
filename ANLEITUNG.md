# TS-Suite — Mandanten-Setup (Option A: ein Deployment pro Kunde)

## Was wurde umgebaut

Alle kundenspezifischen Werte liegen jetzt in **einer einzigen Datei: `config.js`**.
Die vier Kern-Dateien (`index.html`, `arbeitsbericht.html`, `uebersicht.html`, `crm.html`)
binden sie im `<head>` ein und lesen alles aus dem `TENANT`-Objekt:

| Wert | vorher | jetzt |
|---|---|---|
| Supabase-URL + anon key | 4× hart codiert | `TENANT.supabaseUrl` / `TENANT.supabaseKey` |
| Zugangscode `sto7808` | 2× hart codiert | `TENANT.zugangscode` |
| Bucket `berichte-medien` | arbeitsbericht.html | `TENANT.bucketBerichte` |
| Bucket `angebote` | crm.html (2×) | `TENANT.bucketAngebote` |
| Techniker-Vorbelegung | arbeitsbericht.html | `TENANT.techniker` |
| Stober-Logo (Base64) | index.html | `TENANT.logoDataUrl` |

Zusätzlich gibt es `TENANT.features` als Feature-Flags für spätere Paket-Unterschiede
(Basis vs. Pro) — aktuell noch ohne Wirkung, aber der Platz dafür ist reserviert.

**Wichtig:** Die Dateien wurden vom Stand des `main`-Branch (heute) umgestellt.
Falls du lokal neuere, noch nicht gepushte Änderungen hast, erst pushen und den
Umbau auf dem aktuellen Stand wiederholen — sonst überschreibst du deine Arbeit.

## Einmalig: Template einrichten

1. Umgebaute Dateien ins bestehende Repo committen und testen (siehe Checkliste unten).
2. Auf GitHub: **Settings → Template repository** aktivieren.
3. Fertig — das Repo ist jetzt gleichzeitig deine eigene Instanz und die Vorlage.

## Neuen Kunden anlegen (Ziel: unter 30 Minuten)

1. **Repo:** „Use this template" → `ts-suite-kundenname`, GitHub Pages aktivieren.
2. **Supabase:** Neues Projekt anlegen, `setup.sql` im SQL-Editor ausführen
   (siehe unten), beide Storage-Buckets anlegen (`berichte-medien`, `angebote`).
3. **config.js** im neuen Repo anpassen: Name, Logo, Supabase-URL + anon key,
   Zugangscode, Techniker-Namen.
4. Einmal alle vier Seiten durchklicken (Checkliste unten).

## setup.sql erzeugen (aus deinem bestehenden Projekt)

Damit du das Schema nicht abtippen musst, exportiere es aus dem laufenden Projekt:

```bash
npx supabase db dump --db-url "postgresql://postgres:[DB-PASSWORT]@db.guuywhrzygcnpzrnnlsw.supabase.co:5432/postgres" --schema public -f setup.sql
```

(DB-Passwort: Supabase Dashboard → Project Settings → Database.)
Die `setup.sql` ins Template-Repo legen — dann ist sie bei jedem Kunden dabei.
Storage-Buckets und deren Policies musst du im Dashboard je Projekt anlegen,
die exportiert der Dump nicht.

## Updates verteilen

**Eiserne Regel: Fixes IMMER zuerst im Template, nie direkt im Kunden-Repo.**

Dann: `./update-kunden.sh` (Skript liegt bei, Kunden-Repos oben eintragen).
Es zieht `template/main` in jedes Kunden-Repo und stellt sicher, dass die
kundeneigene `config.js` dabei niemals überschrieben wird.

Kundenwünsche nur über `config.js` / Feature-Flags lösen, nie über
Code-Abweichungen im Kunden-Repo — sonst laufen die Stände auseinander.

## Test-Checkliste nach dem Umbau

- [ ] `index.html`: Logo sichtbar, Kontakt-Schnellsuche liefert Treffer
- [ ] `arbeitsbericht.html`: Bauvorhaben-Liste lädt, Foto-Upload funktioniert, PDF-Erzeugung OK
- [ ] `uebersicht.html`: Zugangscode `sto7808` funktioniert, Berichte + Fotos laden
- [ ] `crm.html`: Kunden/Aktivitäten laden, Angebots-Upload funktioniert, Trello-Karte anlegen OK
- [ ] Browser-Konsole: keine `TENANT is not defined`-Fehler

## Offene Punkte (Phase 1, nächste Schritte)

1. **Supabase Auth** statt Zugangscode — Pflicht vor dem ersten Fremdkunden.
   `TENANT.zugangscode` ist nur die Brücke bis dahin.
2. **setup.sql** erzeugen und ins Template legen (Befehl oben).
3. **Export-Funktion** (CSV/PDF-Gesamtexport) als Kaufargument.
