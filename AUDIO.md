# Audio

Die Dateien stammen aus `C:\Users\danie\Downloads\Durak-Trainer Sounds`. Originale wurden unverändert kopiert; längere Effektaufnahmen werden bei der Wiedergabe auf kurze Ausschnitte mit Fade begrenzt. Einstellungen: Sounds 65 %, Musik 15 %, beide standardmäßig AN. Erst der erste echte Tap/Klick/Tastendruck aktiviert Web Audio und die Musik. Bei Rückkehr aus dem Hintergrund gegebenenfalls erneut tippen.

## MP3-Dateien ablegen

Effekte: **C:\Users\danie\Documents\Automaten\durak\dist\assets\audio\sfx\**

| Dateiname | Aktuell verwendete Aufnahme |
| --- | --- |
| `card-play.mp3` | `oxidvideos-taking-playing-card-2-522516.mp3` |
| `card-defend.mp3` | `freesound_community-cards-thrown-83045.mp3` |
| `card-draw.mp3` | `freesound_community-playing-cards-being-delt-29099.mp3` |
| `cards-pickup.mp3` | `freesound_community-cards-thrown-83045.mp3` |
| `discard.mp3` | `freesound_community-cards-thrown-83045.mp3` |
| `shuffle.mp3` | `freesound_community-card-flipping-75622.mp3` |
| `win.mp3` | Noch nicht vorhanden; Ereignis bleibt stumm |
| `lose.mp3` | Noch nicht vorhanden; Ereignis bleibt stumm |

Musik: **C:\Users\danie\Documents\Automaten\durak\dist\assets\audio\music\background.mp3**, kopiert aus `background music.mp3`.

Fehlende oder fehlerhafte Dateien erzeugen höchstens eine Warnung pro Datei und Seitenladung. Ein neues Spiel wird dadurch nie blockiert. Neue MP3s ergänzen/ersetzen, `npm.cmd run build` ausführen und committen/pushen. Der Build übernimmt vorhandene MP3s automatisch in den optionalen Offline-Cache. `_site/` nicht manuell bearbeiten. Nach einem Update alle App-Fenster schließen und neu öffnen.

## Architektur

- `src/audio/config.js`: Dateinamen, Ausschnittlängen, Vorgaben und validierte Einstellungen.
- `src/audio/manager.js`: ein Web-Audio-Kontext, separate Gain-Knoten, überlappende Effekte und ein einzelner Musikloop. Musik wird bei neuen Spielen nicht neu gestartet. Hintergrundwechsel pausiert sie; beim nächsten Tap wird die Position fortgesetzt.
- `src/audio/events.js`: ordnet ausschließlich abgeschlossene UI-Spielübergänge Sounds zu. Nachziehen wird pro Nachziehvorgang gebündelt, Aufnahme erst beim tatsächlichen Einsammeln. Ein menschliches Ausscheiden löst einmal `win` aus; ein Unentschieden nicht.
- `src/ui/audioUI.js`: Einstellungen und echte Nutzerinteraktionen. Speicherung unter `durak.audio.v1` in localStorage; bei gesperrtem Speicher funktionieren die Einstellungen für die Sitzung.

Es werden keine Spiel-, Bot- oder Trainingsregeln verändert. Audio ist optional. Alle URLs sind relativ zum Modul und funktionieren deshalb auch unter `/Durak-Trainer/`. Es wird bewusst Web Audio mit Gain-Knoten statt `HTMLAudioElement.volume` verwendet, damit die getrennte Lautstärkeregelung auch auf iOS vorgesehen ist.

## iPhone/PWA prüfen

1. Nach dem Deployment die GitHub-Pages-Adresse in Safari öffnen und vollständig laden lassen.
2. Einmal tippen, Audio öffnen und Musik/Effekte sowie beide Regler ausprobieren.
3. Zum Home-Bildschirm hinzufügen, dort starten und erneut tippen.
4. Nach vollständigem Cachen offline starten, tippen und eine Partie beginnen.
5. App in den Hintergrund legen, zurückkehren und gegebenenfalls erneut tippen. Lautlosmodus und Systemlautstärke können die Ausgabe beeinflussen.

Die Hardware-/Safari-Ausgabe auf einem echten iPhone lässt sich vom Windows-Arbeitsplatz aus nicht garantieren. Automatisierte Tests prüfen Freischaltung, Unterpfad-URLs, Überlappung, getrennte Lautstärken, Wiederaufnahme und fehlende Dateien; der tatsächliche Gerätetest bleibt notwendig.
