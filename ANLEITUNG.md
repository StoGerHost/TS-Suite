# TS-Suite — Anleitung: Neuen Kunden aufsetzen

Stand: 19.07.2026 · gilt ab der Supabase-Auth-Umstellung

## Wie das System aufgebaut ist

Jeder Kunde bekommt eine **komplett eigene Instanz**:

- ein eigenes **GitHub-Repo** (Kopie des Templates `StoGerHost/TS-Suite`),
  ausgeliefert über GitHub Pages
- ein eigenes **Supabase-Projekt** (Datenbank + Storage + Nutzer-Logins)
- genau **eine** kundenspezifische Datei: `config.js` (Name, Logo, Supabase-
  Zugangsdaten, Admin-Code, Techniker, Feature-Flags)

Alle anderen Dateien sind bei allen Kunden identisch und werden zentral über
das Template gepflegt. Der Zugriff auf Daten läuft über Supabase Auth: Jeder
Mitarbeiter hat ein eigenes Login (E-Mail + Passwort), die Anmeldung gilt
dauerhaft pro Gerät.

## Voraussetzungen (einmalig)

Für die automatische Routine (Weg A) brauchst du einen PC oder Mac mit:

- **Git** — https://git-scm.com
- **GitHub CLI** — https://cli.github.com, danach einmalig `gh auth login`

Ohne PC geht es auch komplett manuell vom iPad (Weg B).

---

## Weg A: Automatische Installationsroutine (PC/Mac)

1. `neuer-kunde.bat` (Windows, Doppelklick — `neuer-kunde.ps1` muss daneben
   liegen) oder `./neuer-kunde.sh` (Mac/Linux) starten.
2. Die Routine fragt ab: Kundenname, Repo-Kurzname, Untertitel, Supabase-URL
   und anon key, Admin-Code, Techniker-Namen.
   (Supabase-Daten können leer bleiben und später in der `config.js`
   nachgetragen werden, falls das Projekt noch nicht existiert.)
3. Sie erzeugt automatisch: Kunden-Repo aus dem Template, fertige
   `config.js`, ersten Push, GitHub Pages.
4. Danach die angezeigten **Supabase-Restschritte** abarbeiten
   (siehe „Supabase einrichten" unten).

Dauer: ca. 10 Minuten plus Supabase-Klickarbeit.

## Weg B: Manuell (auch vom iPad)

1. **Repo:** github.com → Template-Repo `TS-Suite` öffnen →
   „Use this template" → Name `ts-suite-kundenname` → erstellen.
2. **Pages:** Im neuen Repo Settings → Pages → Branch `main`, Ordner `/` →
   Save. Die Seite liegt dann unter
   `https://<account>.github.io/ts-suite-kundenname/`.
3. **config.js** im neuen Repo direkt auf GitHub bearbeiten
   (Stift-Symbol) und alle Werte anpassen — siehe Feld-Referenz unten.
4. **Supabase einrichten** (nächster Abschnitt).

## Supabase einrichten (bei beiden Wegen)

Im Dashboard (https://supabase.com/dashboard):

1. **Neues Projekt** anlegen (Name = Kundenname, Region EU).
   Free-Tier erlaubt 2 aktive Projekte, danach ~25 $/Monat pro Projekt.
2. **Schema:** SQL-Editor öffnen, kompletten Inhalt der `setup.sql` aus dem
   Repo einfügen, Run. Legt alle Tabellen, Constraints und die
   Auth-Policies an (Zugriff nur für angemeldete Nutzer).
3. **Storage:** Zwei Buckets anlegen, beide **public**:
   `berichte-medien` und `angebote`.
4. **Nutzer:** Authentication → Users → „Add user" für jeden Mitarbeiter:
   E-Mail + Passwort vergeben, **„Auto Confirm User" anhaken**.
   Ohne Nutzer kommt niemand an die Daten.
5. **Zugangsdaten in config.js:** Project Settings → API →
   „Project URL" und „anon public"-Key kopieren und in die `config.js`
   des Kunden-Repos eintragen (falls nicht schon über die Routine erledigt).
6. **Mitarbeiter-Function:** Edge Functions → „Deploy a new function" →
   Name `mitarbeiter` → Inhalt von `mitarbeiter-function.ts` einfügen →
   Deploy. Danach in den Function-Einstellungen **„Enforce JWT
   verification" ausschalten** (die Funktion prüft Anmeldungen selbst).
   Über sie legt das Admin-Tool Konto + Kürzel in einem Schritt an;
   die Konfiguratoren beziehen die Kürzel daraus (mit Gerätecache und
   `ma-codes.json` als Offline-Fallback).
7. Optional (nur wenn der Kunde Trello nutzt): Edge Function
   `create-trello-card` deployen und in `config.js` `features.trello: true`
   setzen.

## config.js — Feld-Referenz

| Feld | Bedeutung |
|---|---|
| `name` | Firmenname, erscheint u. a. als Logo-Alt-Text |
| `untertitel` | Zeile unter dem Namen auf der Startseite |
| `logoDataUrl` | Logo als Base64-Data-URL oder Pfad (z. B. `assets/logo.png`) |
| `supabaseUrl` / `supabaseKey` | Project URL + anon key des Kundenprojekts |
| `adminCode` | Code für sensible Schalter (aktuell: GPS im Arbeitsbericht). Steht im Klartext in der Datei — Komfortschutz, kein Geheimnis |
| `bucketBerichte` / `bucketAngebote` | Storage-Bucket-Namen (Standard lassen) |
| `techniker` | Vorbelegung der Techniker-Liste im Arbeitsbericht |
| `features` | Flags für Kundenpakete (crm, konfiguratoren, trello) |

## Test-Checkliste (vor Übergabe an den Kunden)

- [ ] Startseite lädt, Logo und Name stimmen
- [ ] Login-Fenster erscheint auf: Arbeitsbericht, Berichtsübersicht, CRM, Admin
- [ ] Anmeldung mit einem angelegten Nutzer funktioniert; nach Neuladen
      bleibt man angemeldet
- [ ] Gegenprobe im privaten Tab ohne Login: keine Daten abrufbar
- [ ] Arbeitsbericht: Bauvorhaben-Liste lädt, Foto-Upload klappt,
      PDF-Erzeugung klappt, GPS-Schalter verlangt den Admin-Code
- [ ] Berichtsübersicht: Berichte + Fotos + Karte laden
- [ ] CRM: Kunden laden, Angebots-Upload klappt
- [ ] Startseiten-Suche: ohne Login Hinweis „bitte anmelden",
      mit Login Treffer inkl. Telefonnummer
- [ ] Backbar „← STOBER Werkzeuge" oben auf allen Unterseiten

## Updates an alle Kunden verteilen

**Eiserne Regel: Fixes IMMER zuerst im Template-Repo, nie direkt im
Kunden-Repo.** Kundenwünsche nur über `config.js`/Feature-Flags lösen.

Verteilen per `./update-kunden.sh` (Kunden-Repos im Skript eintragen).
Das Skript zieht `template/main` in jedes Kunden-Repo und stellt sicher,
dass die kundeneigene `config.js` nie überschrieben wird.

## Wenn etwas klemmt

- **Schwarzer Bildschirm auf einer geschützten Seite:** Fast immer Cache —
  im privaten Tab prüfen. Sonst Browser-Konsole: Meldung
  „config.js muss VOR ts-auth.js eingebunden sein" heißt, die Einbinde-
  Reihenfolge im HTML stimmt nicht.
- **„E-Mail oder Passwort falsch" trotz korrekter Daten:** Nutzer im
  Dashboard prüfen — ohne „Auto Confirm" ist das Konto noch nicht aktiv.
- **Daten laden nicht nach Policy-Umstellung:** Nutzer angemeldet? Token
  abgelaufen? Einmal ab- und wieder anmelden (TSAuth.logout() in der
  Konsole oder Website-Daten löschen).
- **Notfall-Rückweg:** Auskommentierter Block am Ende der
  `auth-policies.sql` stellt den offenen Zustand wieder her.
