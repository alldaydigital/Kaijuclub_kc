# Je garage beheren op de website

**[Open het Kaijuclub-beheer](https://alldaydigital.github.io/Kaijuclub_kc/beheer/)**

Je voegt wagens, foto's en informatie toe in de website zelf. De rechterkant toont de echte bezoekerswebsite: volledige site, garagekaart of wagenfiche. Je kunt wisselen tussen desktop en mobiel en het voorbeeld vergroten. Ontwerpen en bekijken kan meteen; verbinden is nodig om te bewaren.

## Eerste keer: je beheer verbinden

1. Klik in het beheer op **Verbind beheer**, daarna **Eerste keer verbinden?**.
2. Open **Beheersleutel aanmaken** en log in met een GitHub-account dat schrijfrechten heeft op `alldaydigital/Kaijuclub_kc`.
3. Kies een fine-grained personal access token met **Repository access → Only select repositories → Kaijuclub_kc**. Geef **Repository permissions → Contents → Read and write**. Metadata wordt automatisch toegevoegd. Je hebt geen andere rechten nodig.
4. Maak de sleutel aan en plak hem uitsluitend in het afgeschermde veld op de beheerpagina. Deel de sleutel niet in chat of in een wagenfiche.
5. Vink **Onthoud deze verbinding op dit toestel** aan en kies een eigen beheerwachtwoord van minimaal 12 tekens. De sleutel wordt lokaal versleuteld opgeslagen; later open je het beheer op dit toestel met dat wachtwoord.

De koppeling wordt gecontroleerd op echte schrijfrechten. Een verkeerde of verlopen sleutel geeft een foutmelding. Het wachtwoord ontgrendelt de koppeling op deze browser; op een ander toestel moet je de koppeling opnieuw maken. Bij een verlopen GitHub-sleutel kies je **Opnieuw koppelen**. De aanmaaklink stelt 90 dagen geldigheid voor; GitHub toont de gekozen vervaldatum.

Je hoeft geen GitHub-formulieren of code te gebruiken om een wagen toe te voegen of te wijzigen. GitHub verzorgt achterliggend de opslag en publicatie.

## Een wagen toevoegen

1. Klik **Wagen toevoegen**.
2. Vul de naam en discipline in. Serie, herkomst, verhaal en details zijn optioneel.
3. Sleep foto's in het fotovak, of kies ze van je telefoon/computer. JPG, PNG en WebP zijn ondersteund: maximaal 12 foto's, 10 MB en 40 megapixels per bronfoto. HEIC wordt niet ondersteund.
4. Foto's worden automatisch verkleind tot maximaal 2400 pixels en webklaar gemaakt. Je bronbestand blijft op je toestel behouden. De eerste foto is de omslag; gebruik de pijlen of sleep de miniaturen om de volgorde te wijzigen. Je kunt een beschrijving per foto toevoegen en de zichtbare uitsnede van de omslag bijstellen.
5. Bekijk je kaart, fiche en volledige website op desktop en mobiel.
6. Kies **Concept bewaren** om later verder te werken, of **Publiceren** om de wagen zichtbaar te maken.

Concepten worden echt in de repository opgeslagen en kunnen na opnieuw inloggen ook op een ander toestel worden geopend. Niet-bewaarde wijzigingen krijgen aanvullend een lokale herstelkopie in de browser. De editor geeft aan wanneer werk nog niet bewaard is.

## Een bestaande wagen aanpassen

Selecteer de wagen in de garage. Bewerk foto's, verhaal of details. Met **Concept bewaren** blijven bestaande live gegevens en foto's behouden; pas **Wijzigingen publiceren** vervangt de live versie. Een uitgelichte wagen krijgt voorrang in de collectie. De eerste live wagen bepaalt de grote foto bovenaan de website.

**Verbergen** haalt de wagen van de website, maar bewaart de fiche en foto's. **Terug publiceren** zet hem terug. De website herstelt nooit voorbeeldwagens wanneer alle eigen wagens verborgen zijn.

## Bewaren en publiceren

Foto's, concepten en de publieke collectie worden samen in één wijziging bewaard. Een gelijktijdige wijziging door iemand anders geeft een conflictmelding en overschrijft geen werk. Klik **Vernieuwen** om de actuele collectie te laden; je lokale wijzigingen blijven in de editor staan.

Na publiceren wordt de website automatisch gecontroleerd en gebouwd. Dit duurt doorgaans enkele minuten. De editor toont eerst dat de gegevens bewaard zijn en vervolgens de publicatiestatus. Een mislukte controle behoudt de eerdere website. Corrigeer de fiche en publiceer opnieuw; ook een ongewijzigde wagen kan opnieuw worden gepubliceerd.

De controle valideert alle foto's en collectiegegevens voordat de site live gaat. De beheersleutel staat nooit in de repository of in de publieke website. Vergrendelen wist de ontsleutelde sleutel uit het beheer; de lokaal versleutelde koppeling blijft beschikbaar. Het beheer vergrendelt ook na 30 minuten zonder activiteit.

## Openbare opslag

De GitHub-repository is openbaar. **Opgeslagen conceptgegevens en foto's zijn daar ook zichtbaar**, hoewel concepten buiten de bezoekerswebsite blijven. Verbergen verwijdert foto's niet uit de repository of versiegeschiedenis. Gebruik dit beheer voor openbare portfolio-informatie.

De huidige bezoekerscollectie bevat nog duidelijk gemarkeerde referentiewagens. Je eigen gepubliceerde wagens vervangen die collectie. De oude GitHub Issue Form-route is vervangen door dit beheer en verwerkt geen automatische wijzigingen meer.
