# Öffentliche Kartenkenntnis, Bots und Coach

## Bedienung

Unter **Gegner** stehen Anfänger, Amateur, Profi und Meister zur Auswahl; die Einstellung gilt für beide Bots ab ihrem nächsten Zug. **Training AN** schaltet den manuellen Button **Tipp anzeigen** frei. Tipps erscheinen nur auf Wunsch am eigenen Zug und werden bei Zustands- oder Levelwechsel verworfen.

Die Augen zeigen ab Level 3 acht Sekunden lang ausschließlich bekannte, noch nicht wieder ausgespielte Aufnahmekarten und die Anzahl unbekannter Karten. Sie zeigen niemals die vollständige echte Hand. Training AUS blendet Augen, Coach, Kontrolle und Replay aus.

## Datengrenzen

`game/engine.js` behält die echten Hände und den geordneten Nachziehstapel. `observation()` erzeugt eine öffentliche Beobachtung mit eigener Hand, Tisch, Trumpf, Kartenanzahlen, öffentlichen Ereignissen und legalen Aktionen. Neu hinzugekommen ist nur die öffentliche Angriffsgrenze `limit`; die Spielregeln bleiben gleich.

`knowledge/publicGameKnowledge.js` berechnet gemeinsame Fakten aus öffentlichen Aufnahme-/Ausspielereignissen und dem Ablagestapel. Aufnahme fügt bekannte Karten hinzu, sichtbares Ausspielen entfernt sie. Nur tatsächlich abgelegte Karten zählen als raus. Farbschwächen bleiben ausdrücklich Vermutungen. Diese Schicht enthält weder echte Gegnerhände noch zukünftige Stapelkarten.

`bots/view.js` kopiert ausdrücklich erlaubte Felder. Bots erhalten keine Trainingsnotizen oder Augen-Daten. Anfänger liest keine Historie. Profi und Meister verwenden exakt dieselbe öffentliche Information; ihre Verarbeitung unterscheidet sich.

`knowledge/trainingKnowledge.js` und `coach/knowledge.js` bilden eine zweite, engere Grenze für Training, Augen, Kontrollpanel und Coach. Rohe Ereignisse werden nicht an den Coach weitergereicht. Tests verwenden verbotene Getter, die bei einem Zugriff sofort werfen, sowie unterschiedliche verdeckte Deals bei identischer öffentlicher Sicht.

## Freigaben pro Level

Eigene Hand, aktueller Tisch, Trumpffarbe, Kartenanzahlen und legale Aktionen bilden die normale Spielgrundlage.

| Level | Zusätzlich verwendbare Gedächtnisinformation |
| --- | --- |
| 1 | Rausgegangene hohe Trümpfe J, Q, K, A |
| 2 | Anzahl rausgegangener Zahlentrümpfe 0–5; keine einzelnen Identitäten dieser Zahlentrümpfe |
| 3 | Bekannte gegnerische Aufnahmekarten, abzüglich später ausgespielter Karten |
| 4 | Öffentlich abgeleitete und vom Menschen markierte Farb-Schwächen als Vermutungen |

Auch manuelle Kontrolle zeigt nur diese Freigaben. Es gibt in Level 1–4 keine vollständige Liste abgelegter Nicht-Trümpfe. Weitere Level können über `trainingLevels.js` und die Projektion `trainingKnowledge.js` ergänzt werden; Coach-Faktoren und UI müssen passende neue Fähigkeiten ausdrücklich freigeben.

## Strategien und Gewichte

Amateur bleibt die vorhandene additive Bewertung legaler Züge: günstige Verteidigung, Trümpfe sparen, Nachwurfränge, bekannte Antworten, öffentliche Aufnahme-Indizien und Endspiel.

Profi ergänzt die Bewertung der verbleibenden Hand und stärkeres Abgeben hoher Nicht-Trümpfe. Benannte Konstanten stehen in `bots/profi.js`: Handstruktur 1, gleiche Ränge 5, Farbkontrolle 2, Trumpfreserve 3, hohe Nicht-Trümpfe 6. Weitere Zusatzgewichte sind bewusst 0, weil entsprechende Merkmale bereits aus der Amateur-Bewertung übernommen werden und sonst doppelt zählen würden.

Meister ergänzt eine begrenzte Suche mit denselben Fakten. `bots/meister.js`: Kartenanzahl 8, gleiche Ränge 5, Trumpfreserve 3, Aufnahmedruck 3, Risiko 6, leere Endspielhand 100; Suchbeitrag 0,3. `explainDecision()` liefert gewählte Aktion, Alternativen, Scores und Gründe; bei Meister zusätzlich Suchdetails. Auswahl ist deterministisch, optionales RNG betrifft nur Gleichstände.

Der Coach hat eigene Gewichte in `coach/evaluation.js`, unabhängig von den Bot-Scores. Beispiele: Verteidigung 32, Trumpfeinsatz −10, hoher Trumpf zusätzlich bis −22, Rangpaar 7, bekannte Gegenkarte −18, Farbvermutung 5, Endspielabschluss 120, Suchbeitrag 0,8.

## Bedingte Mehrzugplanung und Grenzen

`planning/publicLines.js` untersucht maximal 8 Kandidaten, Beam-Breite 4, bis zu 4 eigene Aktionen und 48 Knoten pro Kandidat: höchstens 384 Knoten je Anfrage. Es prüft bekannte Antworten, eine plausible unbekannte Antwort aus dem öffentlichen Möglichkeitsraum sowie eine bedingte Aufnahme. Es zieht niemals echte verdeckte Karten zur Simulation heran.

Jeder Knoten führt Resthand, Tischränge, Angriffsgrenze, bekannte Gegnerkarten und Kartenanzahlen fort. Nachwürfe müssen zum Tisch passen. Eine folgende Runde nach Verteidigung steht ausdrücklich unter der Bedingung, dass keine weiteren Nachwürfe folgen. Es werden keine Nachziehkarten erfunden. Deshalb sind Linien bedingte Pläne, keine vollständigen Spielsimulationen oder garantierten Gewinnwege. Bei weniger sinnvollen Aktionen wird eine kürzere Linie gezeigt.

Der Coach nutzt ab Level 3 diese Suche und zeigt bis zu zwei ähnlich bewertete Linien (Score-Abstand höchstens 8), jeweils mit Resthand und bis zu vier eigenen Aktionen. Unbekannte Antworten werden als Möglichkeiten formuliert. Es gibt keine dauernden Tipps oder Hintergrundsuche.

## Prüfung und Kalibrierung

`node --test` führt alle Regel-, Bot-, Wissens-, Coach-, Training-, Replay-, Audio- und Deploymenttests aus. `node scripts/build.mjs` baut den Pages-Unterpfad und generiert die Offline-Dateiliste einschließlich neuer Module.

`node scripts/benchmark-advanced.mjs 12` vergleicht pro Strategie 36 feste Partien gegen zwei Amateure, mit wechselnden Sitzpositionen. Bei der aktuellen Kalibrierung: Amateur 12 Niederlagen, Profi 3, Meister 7; Profi/Meister jeweils 4 Unentschieden. Keine Partie überschritt das Aktionslimit. Meister benötigte hier durchschnittlich ca. 3 ms, maximal ca. 50 ms pro Entscheidung auf dem Entwicklungs-PC. Das ist keine iPhone-Messung und keine universelle Spielstärke-Garantie: Meister schlägt Profi in dieser Stichprobe noch nicht durchgehend.

Die bestehende PWA wird weiter statisch ausgeliefert. Neue Module sind im Entwicklungs-Service-Worker und automatisch im Production-Cache enthalten. Reale Safari-/iPhone-Installation und Offlinebetrieb auf dem Gerät müssen zusätzlich auf dem Zielgerät geprüft werden.

Abschließender Stand: 99 Tests bestanden, keine Fehler oder übersprungenen Tests. Production-Build erfolgreich mit 48 Cache-Dateien. Browserprüfung: Level-1-Tipp, Level-3-Mehrzuglinie, bekannte Augenansicht, Ausblenden bei Training AUS und 320-Pixel-Layout ohne horizontalen Überlauf.

## Alle Dateien dieser Änderung

Neu:

- `src/knowledge/publicGameKnowledge.js` – gemeinsame öffentliche Fakten
- `src/knowledge/trainingKnowledge.js` – Level-Projektion und bekannte Augenansicht
- `src/bots/profi.js` – erweiterte Handbewertung
- `src/bots/meister.js` – Bot mit begrenzter Suche
- `src/planning/publicLines.js` – öffentliche bedingte Szenarien
- `src/coach/knowledge.js` – Coach-Eingabefilter
- `src/coach/evaluation.js` – eigene Coach-Gewichte und Bewertung
- `src/coach/coach.js` – Empfehlung und Mehrzuglinien
- `src/ui/coachUI.js` – manuelle Tippoberfläche
- `tests/advancedBots.test.js` – Wissensgrenze, Legalität, Suche, vollständige Partien
- `tests/knowledgeLevels.test.js` – Augen, bekannte Karten und Level-Grenzen
- `tests/coach.test.js` – Coach-Filter, Empfehlungen und Linien
- `scripts/benchmark-advanced.mjs` – reproduzierbarer Vergleich gegen Amateur
- `BOTS-COACH.md` – Architektur, Bedienung, Grenzen und Dateiliste

Geändert:

- `src/game/engine.js` – öffentliche Angriffsgrenze in Beobachtung
- `src/bots/view.js` – erlaubte Bot-Eingaben
- `src/bots/strategy.js` – Auswahl der vier Schwierigkeitsgrade
- `src/bots/knowledge.js` – Adapter zur gemeinsamen Wissensbasis
- `src/bots/amateur.js` – vereinfachte Formulierungen in Debug-Gründen
- `src/training/analysis.js` – gemeinsame Wissensbasis statt doppelter Berechnung
- `src/ui/app.js` – Augen-Projektion, Coach-Anbindung und Zustandswechsel
- `src/ui/trainingUI.js` – levelgefilterte Analyse und Bezeichnungen
- `src/ui/cards.js` – levelgefilterte Stapelkontrolle
- `dist/index.html` – Schwierigkeitsauswahl, Coach-Bereich, Kontrolltexte
- `dist/style.css` – kompakte Coach- und Wissensdarstellung
- `dist/sw.js` – neue Offline-Module und Cache-Version
- `README.md` – aktuelle Bedienung und Architekturverweis

`_site/` wurde neu generiert und bleibt als Buildausgabe vom Git-Tracking ausgeschlossen.
