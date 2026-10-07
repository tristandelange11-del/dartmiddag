# Dartmaatje (website)

- `/` : de Dartmaatje-app als website. Eén telefoon, 2 tot 15 spelers, drie snelheden. Gemaakt door `tools/export_web.py` in het app-project (https://github.com/tristandelange11-del/dartmaatje-app). Pas de app daar aan en exporteer opnieuw.
- `/middag/` : de uitnodiging, het oefenbord en de huisregels van de dartmiddag met vrienden
- `/spel.html` : het live spel van de middag (naam kiezen met code, aanwezig of afwezig, één pijl), opslag in Supabase
- `/beheer.html` : nieuwe ronde starten (beheerderscode nodig, niet gelinkt)
- `/privacy.html` : privacyverklaring (ook nodig voor de App Store en Google Play)
- `board-middag.js`, `site.css`, `config.js` : onderdelen van de middag-pagina's
- `app.css`, `app.js`, `board.js`, `fonts/` : onderdelen van de app-website op `/`
- `claude-versie/` : eerdere versie op claude.ai

Gebruik in `config.js` nooit een `service_role` of `sb_secret_` sleutel.
