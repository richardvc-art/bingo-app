# Bingo 75/90 PWA

Een kleine, frameworkvrije bingo-app met een keuze voor 75 of 90 getallen en een instelbaar tempo van 2, 3, 5 of 10 seconden. Het overzicht met getrokken getallen kan worden verborgen zonder de trekking te wissen. De gekozen variant, het tempo, de weergavevoorkeur en de spelstatus blijven lokaal in de browser bewaard en de app werkt na de eerste volledige laadbeurt offline.

## Lokaal testen op Windows

Een service worker werkt alleen via `http://localhost` of HTTPS, niet wanneer `index.html` rechtstreeks als bestand wordt geopend.

1. Open deze map in Windows Terminal.
2. Start een eenvoudige lokale webserver met `py -m http.server 8080`.
3. Open `http://localhost:8080` in de browser.

Als Python niet is geïnstalleerd, kan dezelfde map bijvoorbeeld met de extensie **Live Server** in Visual Studio Code worden geopend.

## Belangrijke bestanden

- `index.html`: schermopbouw en PWA-instellingen.
- `styles.css`: responsive iPhone- en desktopopmaak.
- `game-state.js`: spelregels, trekking in volgorde en lokale opslag.
- `app.js`: bediening, timer en weergave.
- `manifest.webmanifest`: installatiegegevens en iconen.
- `service-worker.js`: offline cache.

## Op normale webhosting zetten

Upload alle bestanden en de map `icons` ongewijzigd naar één map op een webserver. Gebruik HTTPS; dat is buiten `localhost` vereist voor installatie en offline caching. Er is geen buildstap, backend of database nodig.

Werk bij een nieuwe versie ook `CACHE_NAME` in `service-worker.js` bij, zodat geïnstalleerde apparaten de nieuwe bestanden ophalen.

## GitHub Pages

De app gebruikt uitsluitend relatieve runtimepaden en kan daardoor vanuit een projectsubmap zoals `https://<gebruiker>.github.io/bingo-app/` draaien. `manifest.webmanifest` houdt de PWA-identiteit, start-URL en scope binnen die projectsubmap. De service worker volgt dezelfde scope.

Publiceer later de volledige projectmap vanaf de repository-root. Het bestand `.nojekyll` zorgt dat GitHub Pages de map als ongewijzigde statische website behandelt.

## Toevoegen aan het iPhone-beginscherm

1. Open de HTTPS-webpagina in Safari.
2. Tik op **Deel**.
3. Kies **Zet op beginscherm** en daarna **Voeg toe**.

Open Bingo daarna via het nieuwe beginschermicoon. Laad de website eenmaal volledig met internetverbinding voordat je de offline werking test.
