# Je Kaijuclub-website beheren

| Wat wil je aanpassen? | Open het beheer |
| --- | --- |
| Teksten, foto's, knoppen en uitstraling | [Website bewerken](https://alldaydigital.github.io/Kaijuclub_kc/beheer/website/) |
| Events waar we aanwezig zijn | [Agenda](https://alldaydigital.github.io/Kaijuclub_kc/beheer/agenda/) |
| Eventreportages en fotogalerijen | [Events & fotoportfolio](https://alldaydigital.github.io/Kaijuclub_kc/beheer/events/) |
| Clubwagens en hun dossiers | [Garage](https://alldaydigital.github.io/Kaijuclub_kc/beheer/) |
| Partners, sponsors en logo's | [Partners & sponsors](https://alldaydigital.github.io/Kaijuclub_kc/beheer/partners/) |

De vier beheerders gebruiken dezelfde GitHub-koppeling. Je hoeft geen code of GitHub-formulieren te gebruiken om inhoud toe te voegen. GitHub verzorgt achterliggend de opslag en publicatie.

## De website bewerken

1. Open **Website bewerken** en kies links een onderdeel. Je kunt zoeken naar een tekst of rechtstreeks op een onderdeel in het websitevoorbeeld klikken.
2. Pas de teksten, knoppen of links aan. Het voorbeeld volgt meteen. Ook de partnerpagina, navigatie, voettekst, contactgegevens en zoekmachineteksten hebben eigen velden.
3. Upload een foto vanaf je telefoon of computer. JPG, PNG en WebP worden automatisch webklaar gemaakt; HEIC wordt niet ondersteund. Geef de foto een omschrijving en stel de uitsnede apart in voor desktop en mobiel.
4. Onder de website-instellingen kun je de accentkleur, achtergrondkleuren en kopstijl aanpassen. Je kunt de homepage-onderdelen herschikken of verbergen. De header blijft bovenaan staan.
5. Wissel het voorbeeld tussen **Homepage**, **Partners & sponsors**, **Desktop** en **Mobiel**. Met de vergrootknop bekijk je het op een groter scherm. Op een telefoon wissel je tussen **Bewerken** en **Voorbeeld bekijken**.
6. Kies **Bewaar concept** om later verder te werken of **Publiceer website** om je wijzigingen zichtbaar te maken.

Het voorbeeld toont de echte website met jouw wijzigingen. Formulieren in het voorbeeld kunnen geen aanvragen versturen. Wagengegevens wijzig je onder **Garage**; partnerkaarten en logo's onder **Partners**.

**Bewaar concept** verandert je live website niet. Ook als je een bestaande tekst of foto bewerkt, blijft de gepubliceerde versie staan tot je publiceert. Een opgeslagen concept kun je op een ander toestel openen na verbinden. Niet-bewaarde wijzigingen krijgen daarnaast een lokale herstelkopie in deze browser.

Met **Herstel** zet je het gekozen onderdeel terug naar de laatst opgeslagen inhoud; andere onderdelen blijven behouden. **Versies** laat eerdere publicaties zien. Een versie terugzetten maakt eerst een nieuw concept. Publiceer wanneer je die versie weer live wilt zetten. Er blijven maximaal vijf vorige publicaties beschikbaar.

## Eerste keer: het beheer verbinden

1. Klik op **Verbind beheer** en open de uitleg om eenmalig je GitHub-account te koppelen.
2. Open **Beheersleutel aanmaken**. Je GitHub-account moet schrijfrechten hebben op `alldaydigital/Kaijuclub_kc`.
3. Kies een fine-grained personal access token met **Resource owner → alldaydigital**, **Repository access → Only select repositories → Kaijuclub_kc** en **Repository permissions → Contents → Read and write**. Metadata wordt automatisch toegevoegd.
4. Klik **Generate token** en plak de volledige sleutel uitsluitend in het afgeschermde veld op de beheerpagina. Deel hem nooit in chat of website-inhoud.
5. In website- of garagebeheer kun je **Onthoud de koppeling in deze browser** aanvinken. Kies een eigen beheerwachtwoord van minimaal 12 tekens. Later open je de vier beheerders op dit toestel met dat wachtwoord.

De koppeling controleert echte schrijfrechten. Het wachtwoord ontgrendelt versleutelde opslag in deze browser; op een ander toestel maak je de koppeling opnieuw. Bij een verlopen sleutel koppel je opnieuw. GitHub toont de vervaldatum bij het aanmaken.

Kun je `alldaydigital` niet kiezen als Resource owner, of ben je een externe bijdrager aan deze persoonlijke repository? GitHub ondersteunt de fine-grained route dan mogelijk niet. Gebruik **Klassieke beheersleutel aanmaken**, selecteer alleen `public_repo` en plak de volledige `ghp_`-waarde. Je account moet zelf schrijftoegang hebben. Een klassieke sleutel kan meerdere openbare repositories van je account bereiken; een tot deze repository beperkte sleutel heeft de voorkeur wanneer GitHub die ondersteunt. Zie de [GitHub-beperkingen](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens#fine-grained-personal-access-tokens-limitations).

## Wagens toevoegen en aanpassen

1. Open **Garage** en kies **Wagen toevoegen**.
2. Vul de naam en discipline in. Serie, herkomst, verhaal en details zijn optioneel.
3. Sleep foto's in het fotovak of selecteer ze. JPG, PNG en WebP zijn ondersteund: maximaal 12 foto's, 10 MB en 40 megapixels per bronfoto. Foto's worden verkleind tot maximaal 2400 pixels; je bronbestand blijft op je toestel.
4. De eerste foto is de omslag. Gebruik de pijlen of sleep miniaturen om de volgorde te wijzigen. Voeg foto-omschrijvingen toe en stel de omslaguitsnede in.
5. Bekijk de garagekaart, wagenfiche en volledige website op desktop en mobiel. Kies **Concept bewaren** of **Publiceren**.

Een bestaande wagen selecteer je in de collectie. **Concept bewaren** behoudt de live gegevens; **Wijzigingen publiceren** vervangt ze. Een uitgelichte wagen krijgt voorrang. De headerfoto wordt beheerd in de website-editor en blijft onafhankelijk van de garage.

**Verbergen** haalt een wagen van de website, maar bewaart de fiche en foto's. **Terug publiceren** zet hem terug. Je eerste eigen publicatie vervangt de gemarkeerde referentiewagens. Als je alle eigen wagens verbergt, verschijnen de voorbeelden niet opnieuw.

## Partners en sponsors

Open **Partners & sponsors**, kies **Partner toevoegen** en vul naam, type, introductie en eventueel een HTTPS-website en logo in. Rasterlogo's worden automatisch verkleind met behoud van transparantie. Het directe voorbeeld gebruikt dezelfde kaartvormgeving als de bezoekerspagina.

**Bewaar concept** verandert een gepubliceerde kaart niet. **Publiceer** plaatst de kaart na de websitepublicatie op de partnerpagina. **Verberg op de site** haalt de kaart daar weg. De omliggende teksten en het aanvraagformulier pas je aan via **Website bewerken → Partners & sponsors**.

## Bewaren en publiceren

Gegevens en bijbehorende foto's worden samen in één wijziging bewaard. Een gelijktijdige wijziging door iemand anders geeft een conflictmelding en overschrijft je lokale werk niet. Laad of verbind opnieuw om de actuele versie op te halen; bewaar je eigen werk voordat je wijzigingen vervangt.

Na publiceren wordt de website gecontroleerd en gebouwd. Dit duurt doorgaans enkele minuten. Het beheer meldt eerst dat de inhoud is opgeslagen en daarna de publicatiestatus. Een mislukte controle houdt de eerdere website online. Controleer de melding en corrigeer de inhoud voordat je opnieuw publiceert.

Je beheersleutel staat nooit in de repository of het websitevoorbeeld. **Vergrendel** wist de actieve koppeling uit het geheugen. De versleutelde lokale koppeling blijft beschikbaar. Het beheer vergrendelt ook na 30 minuten zonder activiteit.

## Openbare opslag

De GitHub-repository is openbaar. **Opgeslagen concepten en foto's zijn daar ook zichtbaar**, hoewel alleen gepubliceerde inhoud op de bezoekerswebsite verschijnt. Verbergen verwijdert inhoud niet uit de repository of GitHub-versiegeschiedenis. Gebruik het beheer voor openbare portfolio-informatie.

De lokale herstelkopie is een extra reserve op dit toestel. Kies **Bewaar concept** om je werk in GitHub op te slaan en op andere toestellen te kunnen openen.

## Event- en partneraanvragen

Het ontvangstadres stel je in via de website-editor. Het huidige adres is **kaijuclub.be@gmail.com**. FormSubmit stuurt bij het eerste gebruik een activatiemail: bevestig die in de mailbox, controleer spam en test daarna met een eigen aanvraag. Als je het adres wijzigt, activeer je ook de nieuwe mailbox.

De echte mailboxbezorging is nog niet geverifieerd. Bij een onzekere verzending blijven de ingevulde velden staan. Aanvragen worden niet in de openbare repository opgeslagen.

## Als verbinden niet lukt

Het afgeschermde veld accepteert een fine-grained sleutel (`github_pat_`) of klassieke sleutel (`ghp_`). Een SSH-sleutel en je lokale beheerwachtwoord zijn geen GitHub-token. Deel de sleutel alleen via dit veld.

**Controleer verbinding met GitHub** test bereikbaarheid zonder je sleutel te versturen. Open het beheer rechtstreeks via een van de HTTPS-links hierboven. Controleer bij blokkades privacy-extensies voor `api.github.com` of probeer een ander netwerk. Ongeldige of verlopen sleutels, ontbrekende rechten, verkeerde repositoryselectie, SSO en GitHub-limieten krijgen een eigen melding. Bij een netwerkfout wordt ook de mislukte stap vermeld.

Verschijnt **“We failed to generate the API credential, please try again”** op GitHub na **Generate token**, dan is daar nog geen sleutel aangemaakt. Gebruik de klassieke aanmaaklink met alleen `public_repo` wanneer de fine-grained route niet werkt. Als ook die generatie mislukt, controleer je GitHub-sessie en probeer de aanmaakpagina opnieuw; het websitebeheer kan geen persoonlijke sleutel namens je account uitgeven.

De verbinding gebruikt de standaard HTTP-client van de browser met actuele versiecontroles. Dat geldt ook voor Edge. Vernieuw de beheerpagina om de nieuwste versie te laden. Werking met je eigen Edge-instellingen en persoonlijke sleutel moet op je toestel worden bevestigd.

Kan de browser de koppeling niet onthouden, dan blijft de werkende sessie open en verschijnt een aparte melding. Opnieuw verbinden herstelt geen ontbrekende GitHub-rechten; een sleutel geeft nooit meer toegang dan je account zelf heeft.

## Events en fotoreportages

1. Open [Events & fotoportfolio beheren](https://alldaydigital.github.io/Kaijuclub_kc/beheer/events/) en kies **Reportage toevoegen**.
2. Geef het clubmoment een naam en kies het type. Datum en locatie zijn optioneel. Voor een eerste clubgalerij hoef je geen eventgegevens te verzinnen.
3. Selecteer meerdere foto's tegelijk, of sleep ze naar het uploadvak. JPG, PNG en WebP worden automatisch verkleind; maximaal24 foto's van10MB per foto. HEIC wordt niet ondersteund.
4. Kies **Cover** bij de foto die vooraan moet staan. Met de pijlen bepaal je de volgorde. Onder **Omschrijving & uitsnede** voeg je onderschriften, fotograaf en aparte desktop-/mobiele uitsnede toe. De galerij laat foto's volledig zien; uitsnede geldt voor de cover.
5. Voeg een korte inleiding en eventueel een verhaal toe. Een lege regel begint een nieuwe alinea. Controleer de echte reportage in het desktop-, mobiele of vergrote voorbeeld.
6. **Bewaar concept** om later verder te werken. **Publiceer reportage** zet de reportage op de aparte Events-pagina. Een bewerkt concept vervangt de gepubliceerde foto's pas bij opnieuw publiceren.
7. **Verberg op de website** haalt een reportage van de pagina; de inhoud blijft in het beheer en kan opnieuw worden gepubliceerd.

De bestaande GitHub-koppeling en het onthouden beheerwachtwoord werken hier ook. Niet-opgeslagen werk krijgt een eigen herstelkopie in deze browser. Op een ander toestel laad je opgeslagen reportages door het beheer te verbinden. De pagina begint met een clubgalerij van jullie reeds beschikbare beelden; eventnamen, datums en locaties worden pas ingevuld wanneer jullie die toevoegen.

De algemene teksten en de uitstraling van de Events-pagina pas je aan bij **Website → Events: pagina & portfolio**. Bezoekers kunnen reportages, onderschriften en vergrote foto's op de website bekijken. De aanvraagknop leidt naar het bestaande eventformulier.


## Agenda: waar zijn we aanwezig?

1. Open [Agenda beheren](https://alldaydigital.github.io/Kaijuclub_kc/beheer/agenda/) en kies **Event toevoegen +**.
2. Vul de naam, datum en locatie in. Kies jullie aanwezigheid: bevestigd, in planning of deelname geannuleerd. Uur, adres, praktische info en een officiële eventlink zijn optioneel. Het directe voorbeeld toont hoe bezoekers het event zien.
3. Kies **Bewaar concept** om later verder te werken, of **Publiceer event** om het in de [publieke agenda](https://alldaydigital.github.io/Kaijuclub_kc/agenda/) te plaatsen. Gebruik dezelfde GitHub-koppeling als bij het wagenbeheer. Het beheer bevestigt zodra de publicatie live is.

Komende events staan automatisch op datum. Een event blijft tot en met de einddatum zichtbaar als komend event en verschuift daarna naar **Eerdere events**, op basis van de Belgische datum. Voor een meerdaags event vul je ook de einddatum in. Bij een nacht-event loopt die einddatum door naar de volgende dag. Tijden zijn lokale Belgische tijden en mogen leeg blijven. **Verberg op de website** haalt een gepubliceerd event weg; opnieuw publiceren maakt het weer zichtbaar.

Agenda is voor jullie aanwezigheid; **Events & fotoportfolio** blijft de plek voor foto's en reportages. De teksten boven en onder de agenda zijn aanpasbaar via **Website → Agenda & aanwezigheid**. Er staan nog geen geplande events in de agenda: voeg jullie echte datums toe. Niet-opgeslagen werk wordt waar mogelijk in deze browser hersteld. Opgeslagen concepten zijn leesbaar in de openbare GitHub-repository.


## Ons verhaal aanpassen

Open **Website → Ons verhaal**. **Ons verhaal — één doorlopende tekst** bevat het volledige clubverhaal. Pas de titel, clubfoto, uitsnede en onderschrift aan in hetzelfde onderdeel. Het voorbeeld toont direct het resultaat. Bewaar als concept of publiceer zoals bij de andere websiteteksten. Het verhaal heeft één vaste foto en één tekst; er zijn geen aparte tabbladen meer.
