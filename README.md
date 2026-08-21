# Bingo 75/90 PWA

Een kleine, frameworkvrije bingo-app met een keuze voor 75 of 90 getallen en een instelbaar tempo van 2, 3, 5 of 10 seconden. Het overzicht met getrokken getallen kan worden verborgen zonder de trekking te wissen. De gekozen variant, het tempo, de weergavevoorkeur en de spelstatus blijven lokaal in de browser bewaard en de app werkt na de eerste volledige laadbeurt offline.

## Experimentele cameracontrole

Na de eerste trekking wordt **Controleer bingo** beschikbaar. Op een iPhone opent **Foto maken of kiezen** de camera of fotobibliotheek. De app zoekt eerst het grootste lichte kaartvlak en verwijdert lange rasterlijnen. Daarna gebruikt hij Tesseract.js 5 in de browser om cijfers te lezen en eenvoudige lokale beeldanalyse om extra inkt of gekleurde markeringen rond een nummer te vinden. De foto wordt niet naar een backend gestuurd.

Controleer de herkende nummers en de vinkjes onder **Afgestreept** altijd handmatig voordat je vergelijkt. Deze eerste versie controleert alleen of alle aangevinkte nummers daadwerkelijk zijn getrokken; een winnend rij-, kolom- of kaartpatroon wordt nog niet beoordeeld. OCR werkt het best met een rechte, scherpe foto, gelijkmatig licht en duidelijke markeringen.

Tesseract.js 5.1.1, de browserworker, de LSTM-WASM-engine en uitsluitend het Engelse cijfermodel worden lokaal uit `vendor/tesseract` geladen. De service worker bewaart deze bestanden tijdens de installatie samen met de app, zodat ook de fotoherkenning daarna zonder internet werkt. De eerste volledige laadbeurt kan door de OCR-bestanden ongeveer 11 MB downloaden.

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
- `bingo-camera.js`: foto, OCR, correctiescherm en cameraworkflow.
- `bingo-check.js`: herkenningsheuristiek en vergelijking met getrokken nummers.
- `vendor/tesseract`: lokale OCR-code, worker, WASM-engine en Engels cijfermodel.
- `manifest.webmanifest`: installatiegegevens en iconen.
- `service-worker.js`: offline cache.

De actuele trekking is later opvraagbaar via `window.bingoGame.getDrawnNumbers()`. Daardoor kan een toekomstige cameracontrole de getrokken nummers gebruiken zonder de spelregels aan de interface te koppelen.

## Op normale webhosting zetten

Upload alle bestanden en de mappen `icons` en `vendor` ongewijzigd naar één map op een webserver. Gebruik HTTPS; dat is buiten `localhost` vereist voor installatie en offline caching. Er is geen buildstap, backend of database nodig.

Werk bij een nieuwe versie ook `CACHE_NAME` in `service-worker.js` bij, zodat geïnstalleerde apparaten de nieuwe bestanden ophalen.

## GitHub Pages

De app gebruikt uitsluitend relatieve runtimepaden en kan daardoor vanuit een projectsubmap zoals `https://<gebruiker>.github.io/bingo-app/` draaien. `manifest.webmanifest` houdt de PWA-identiteit, start-URL en scope binnen die projectsubmap. De service worker en de lokale OCR-bestanden volgen dezelfde scope.

Publiceer later de volledige projectmap vanaf de repository-root. Neem vooral `vendor/tesseract` mee: deze bestanden zijn nodig voor offline fotoherkenning. Het bestand `.nojekyll` zorgt dat GitHub Pages de map als ongewijzigde statische website behandelt.

## Toevoegen aan het iPhone-beginscherm

1. Open de HTTPS-webpagina in Safari.
2. Tik op **Deel**.
3. Kies **Zet op beginscherm** en daarna **Voeg toe**.

Open Bingo daarna via het nieuwe beginschermicoon. Laad de website eenmaal volledig met internetverbinding voordat je de offline werking test.
