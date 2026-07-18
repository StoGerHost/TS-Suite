#!/usr/bin/env bash
# ============================================================
# TS-Suite — Updates vom Template in alle Kunden-Repos ziehen
#
# Voraussetzung: Alle Kunden-Repos liegen als Ordner nebeneinander,
# z. B.:  ~/ts-suite/ts-suite-template
#         ~/ts-suite/ts-suite-stober
#         ~/ts-suite/ts-suite-kundeX
#
# Aufruf:  ./update-kunden.sh
# ============================================================
set -e

TEMPLATE_URL="https://github.com/stogerhost/TS-Suite.git"  # ggf. anpassen
KUNDEN_REPOS=(
  "../ts-suite-stober"
  # "../ts-suite-kundeX"   # neue Kunden hier eintragen
)

for REPO in "${KUNDEN_REPOS[@]}"; do
  echo "=== Update: $REPO ==="
  cd "$REPO"

  # Template als Remote hinterlegen (nur beim ersten Mal nötig)
  git remote get-url template >/dev/null 2>&1 || git remote add template "$TEMPLATE_URL"

  git fetch template
  # config.js ist die einzige kundenspezifische Datei -> vor dem Merge sichern
  cp config.js /tmp/config-backup.js

  if git merge template/main --no-edit; then
    echo "Merge OK"
  else
    echo "Merge-Konflikt! Wahrscheinlich in config.js — Kundenversion wird wiederhergestellt."
    git checkout --theirs . 2>/dev/null || true
    cp /tmp/config-backup.js config.js
    git add -A && git commit -m "Template-Update (config.js beibehalten)"
  fi

  # Sicherheitsnetz: config.js darf nie vom Template überschrieben werden
  cp /tmp/config-backup.js config.js
  git diff --quiet config.js || { git add config.js; git commit -m "config.js: Kundenwerte beibehalten"; }

  git push
  cd - >/dev/null
  echo ""
done

echo "Alle Kunden-Repos aktualisiert."
