# Wagens beheren

Je bestaande GitHub-account is de beheerderslogin. Je hoeft geen code aan te passen of bestanden te deployen.

**[Nieuwe wagen toevoegen](https://github.com/alldaydigital/Kaijuclub_kc/issues/new?template=vehicle.yml)** · **[Wagenfiches beheren](https://github.com/alldaydigital/Kaijuclub_kc/issues?q=is%3Aissue+label%3Awagen+-label%3Acms-test)** · **[Website](https://alldaydigital.github.io/Kaijuclub_kc/)**

## Een wagen toevoegen

1. Open het formulier en log in met het GitHub-account dat deze repository beheert.
2. Vul de wagennaam en discipline in. Sleep 1 tot 12 eigen foto's in het fotoveld. De eerste foto is de omslag. JPEG, PNG en WebP worden ondersteund, maximaal 10 MB en 40 megapixels per foto.
3. Voeg desgewenst serie, herkomst, verhaal en specificaties toe. Specificaties hebben één regel per item, bijvoorbeeld `Motor: RB26DETT`. Kies **Ja** bij Uitgelicht om de wagen bovenaan te plaatsen.
4. Kies **Concept** om de fiche alvast te bewaren, of **Publiceren** om ze op de website te zetten. Klik op **Create** om de fiche op te slaan.

Het publiceren duurt doorgaans enkele minuten. De automatische controle geeft de fiche een label: `cms:live` na een geslaagde publicatie, `cms:concept` voor een verborgen fiche, of `cms:fout` als een controle of publicatie is mislukt. De titel wordt automatisch de wagennaam.

## Een bestaande wagen wijzigen

Open de wagenfiche uit de beheerlijst. Kies het menu met drie puntjes bij de **eerste beschrijving**, daarna **Edit**. Bewerk de inhoud onder de bestaande veldtitels en sla op. GitHub opent bestaande fiches als tekst; laat de `###` veldtitels staan. Je kunt nieuwe foto's in het veld Fotos slepen, de volgorde wijzigen en foto's verwijderen. Onder Status staat `Concept` of `Publiceren`.

Nieuwe gegevens en foto's verschijnen na de automatische controle. De website biedt een fotogalerij, specificaties, verhaal, disciplinefilter en een directe deelbare link per wagen. De eerste gepubliceerde clubwagen vervangt de voorbeeldfoto in de hero; de voorbeeldcollectie wordt vervangen door jullie eigen collectie.

## Verbergen en terugzetten

- Zet **Status** op `Concept`, of sluit de fiche met **Close issue**, om de wagen van de website te halen.
- Open een gesloten fiche opnieuw en zet **Status** op `Publiceren` om de wagen terug te zetten.
- Verwijder of wijzig het label `wagen` niet: dat label koppelt de fiche aan het beheer.

## Als een publicatie mislukt

Open [Wagenbeheer en publicatie](https://github.com/alldaydigital/Kaijuclub_kc/actions/workflows/manage-vehicles.yml) en bekijk de mislukte stap. Corrigeer een ongeldige foto, discipline of specificatie via Edit; opslaan start de controle opnieuw. Bij een tijdelijke storing kun je de mislukte run opnieuw uitvoeren, of **Run workflow** op branch `main` gebruiken zonder testnummer. Ook als de gegevens al zijn opgeslagen, publiceert een nieuwe run de website opnieuw.

Alle fiches worden samen gecontroleerd. Een ongeldige gepubliceerde fiche blokkeert de nieuwe collectie, zodat de bestaande website behouden blijft. Zet een onvolledige fiche terug op Concept om andere wagens te kunnen publiceren. Foto's worden volledig gevalideerd en op de eigen website gehost. Er staat geen beheertoken in de browser. Alleen de eigenaar en medewerkers met schrijf-, maintain- of adminrechten kunnen publiceren; inzendingen van andere bezoekers verschijnen niet op de website.

## Openbare repository

Deze repository is openbaar. **Ook conceptfiches en hun uploads zijn zichtbaar op GitHub**, hoewel ze niet op de website verschijnen. Gebruik dit beheer voor openbare portfolio-informatie. Verbergen op de website verwijdert de foto's niet uit GitHub of de versiegeschiedenis.

De huidige voorbeeldwagens zijn herkenbaar als referenties. Er staan nog geen bevestigde clubwagens in het beheer. Testfiches met het label `cms-test` worden altijd uitgesloten van gewone publicaties.
