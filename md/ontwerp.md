# Dartmiddag: ontwerpnotities

Website voor een darts-middagje met 6 spelers (jij + 5 vrienden).

## Concept
Kroeg-sfeer in flessengroen, crème, amber en dartbord-rood. Lettertypes: Bowlby One (koppen) en Figtree (tekst).

## Wat staat erop
1. **Uitnodiging**: datum, tijd en locatie invullen. Daaronder een countdown en een WhatsApp-knop om de groep uit te nodigen.
2. **Het spel**: een echt dartbord met een zwevend vizier. Elke speler gooit één pijl. De laagste score betaalt het eerste rondje. Bij gelijkstand volgt een beslissingsworp tussen de laagste scores.
3. **Straf van de middag**: willekeurige grappige straf voor de verliezer.
4. **Huisregels**: zes regels om aan de muur te hangen.

## Spelregels in de code
- Score volgt echte dartregels: bull 50, outer bull 25, dubbel x2, triple x3, naast het bord 0.
- Elke worp krijgt een kleine "handtrilling" mee.
- Namen, datum, tijd en locatie worden onthouden in de browser.

## Bestanden
- `project/Main.dc.html`: de hele pagina (opmaak en spel).
- `project/canvas.json`: indeling van het ontwerp.
- Online versie: https://claude.ai/artifact/FATn52VjeZ9rPQyE94DsD8

## Aanpassen
Teksten van de huisregels, de straffen en de ticker staan onderaan `Main.dc.html` in het scriptdeel (`rules`, `drawPunish`, `ticker`).
