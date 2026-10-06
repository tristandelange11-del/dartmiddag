# Dartmiddag

Website voor een dartmiddag met 6 vrienden: oefenbord, huisregels en een live spel waarbij de laagste score het eerste rondje betaalt.

## Bestanden
- `index.html`: homepage met uitnodiging, oefenbord en huisregels
- `spel.html`: het echte spel (naam kiezen, aanwezig of afwezig, één pijl gooien)
- `site.css`, `board.js`: gedeelde stijl en dartbord
- `config.js`: Supabase-adres en publishable key (bedoeld om openbaar te zijn)
- `claude-versie/`: eerdere versie die op claude.ai stond
- `md/`, `memory/`: ontwerpnotities en gegevens

## Opslag
Supabase, tabel `players`. Bezoekers mogen alleen lezen en bijwerken, niet toevoegen of verwijderen (Row Level Security).
Gebruik in `config.js` nooit een `service_role` of `sb_secret_` sleutel.
