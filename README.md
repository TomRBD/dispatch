# Agrivalor Dispatch

Tour de contrôle transport d'Agrivalor. Sur un seul écran : carte de la flotte, missions et livraisons du jour, retards, timeline d'exploitation et comparaison des distances prévues et parcourues.

> Sans configuration, l'application tourne en **mode démonstration** : données **fictives**, signalées en permanence par un bandeau et par l'état des sources dans l'en-tête. Le branchement Business Central est décrit plus bas.

## Démarrage

```bash
npm install
npm run dev        # http://localhost:5173
```

| Commande            | Rôle                                   |
| ------------------- | -------------------------------------- |
| `npm run dev`       | serveur de développement               |
| `npm run build`     | vérification de types + build de production (`dist/`) |
| `npm run typecheck` | vérification TypeScript                |
| `npm run lint`      | ESLint                                 |
| `npm test`          | tests unitaires (Vitest)               |
| `npm run server`    | passerelle Business Central / Webfleet |
| `npm run bc:inspect`| liste des champs réels de Tournee_Excel / Mission_Excel |
| `npm run webfleet:inspect` | vérifie l'accès Webfleet et liste les champs reçus |
| `npm run live`      | passerelle + application en mode connecté |

Stack : Vite, React 19, TypeScript strict, Leaflet (carte), CSS sans framework.

## Architecture

```
src/
  domain/            modèle et règles métier, sans dépendance à l'interface
    types.ts         Vehicle, Mission, Delivery, OpsEvent, Lateness, DistanceComparison…
    rules.ts         règles explicites : retard, position ancienne, écart de distance
    status.ts        libellés français, tonalités et pictogrammes des statuts (source unique)
    time.ts          formats et conversions de dates (fuseau Europe/Paris)
    timeline.ts      construction de la timeline à partir des horodatages réels
    selectors.ts     vues véhicule et indicateurs du jour
  data/
    repository.ts    point d'entrée unique : mode démo ou mode connecté
    adapters/        webfleet.ts, businessCentral.ts, normalize.ts (validation défensive), http.ts
    demo/demoData.ts données de démonstration fictives
    useDispatchData.ts  chargement, rafraîchissement manuel et automatique
    config.ts        variables VITE_* publiques (aucun secret)
  components/        interface : en-tête, indicateurs, carte, listes, fiches, timeline, distances
```

L'interface ne dépend que de `DispatchRepository`. Pour passer aux données réelles, il suffit de fournir la passerelle décrite ci-dessous : aucun composant n'est à modifier.

## Brancher Business Central (missions et tournées)

La passerelle `server/` lit les entités OData **`Tournee_Excel`** (→ missions / tournées de l'application) et **`Mission_Excel`** (→ livraisons rattachées à une tournée) de la société `SUNDGAU COMPOST`. Le navigateur ne voit jamais le token.

### 1. Configuration (une fois)

```bash
cp server/.env.example server/.env      # tenant, environnement, société déjà pré-remplis
cp .env.example .env.local               # VITE_DISPATCH_API_URL=/api → l'appli passe en mode connecté
```

Le token d'accès est stocké dans **`token.txt`**. La passerelle l'obtient **elle-même** (client credentials Entra ID, sans Python) à partir du **`.env` racine**, les mêmes variables que `get_bc_token.py` :

```
# .env (racine, jamais versionné)
BC_TOKEN_CLIENT_ID=...
BC_TOKEN_CLIENT_SECRET=...
```

Il est renouvelé automatiquement quand il manque, expire ou est refusé (401). `get_bc_token.py` reste utilisable (`BC_TOKEN_COMMAND`, ou sur le VPS via le timer systemd), mais n'est plus nécessaire en local.

`.env`, `server/.env`, `token.txt` et `bc-inspect.txt` sont dans `.gitignore` : **ne les commitez jamais**.

### 2. Relever les champs réels

```bash
npm run bc:inspect
```

Affiche, pour chaque entité, le nom et le type des champs, leur taux de remplissage et les valeurs des champs à faible nombre de valeurs (statuts). Aucune ligne complète ni le token ne sont affichés. Le résultat est aussi écrit dans `bc-inspect.txt`.

Options : `npm run bc:inspect -- 2026-10-14` limite l'échantillon à une journée ; `npm run bc:inspect -- Mission_WCAP 2026-10-14` inspecte n'importe quelle entité OData (sans filtre de date si elle n'a pas de `Tour_Date`). Pour les heures, booléens et nombres, le relevé indique s'ils sont réellement renseignés (plage horaire, vrai/faux, non nuls).

### 3. Correspondance des champs (`server/bc/mapping.ts`)

Déjà renseignée pour SUNDGAU COMPOST :

| Application | Business Central |
| --- | --- |
| Mission / tournée | `Tournee_Excel` : `No`, `Description`, `Tour_Date`, `Vehicle_No`, `Status` |
| Début prévu | `Tour_Date` + `Planned_Starting_Time` (heure de Paris) |
| Fin prévue | début prévu + `Planned_Duration` (si durée non nulle) |
| Distance parcourue | `Ending_Mileage − Starting_Mileage` (si les deux compteurs sont cohérents) |
| Livraison | `Mission_Excel` : `No`, rattachée par `Tour_No`, ordre `Rank` |
| Client, lieu | `Destination_Name`, `Destination_City`, `Destination_Latitude/Longitude` |
| Fin de créneau (règle de retard) | `Tour_Date` + `Requested_Time` (`Requested_Date` est vide) |
| Statut de l'arrêt | `Mission_WCAP.Driver_Status` (`Finished` → Réalisé), fusionné sur `No` |
| Heures réelles | `Mission_WCAP.Work_Starting_Date` / `Work_Ending_Date`, retenues seulement si `Driver_Status = Finished` |
| Passage à vide | `Mission_WCAP.Empty_Run` / `Empty_Run_Reason` |
| Collecte / livraison | `Service_Type_Direction` (`Pickup` → Collecte) |

Limites des données BC actuelles :

- **Statut de tournée** : `Open` → Planifiée, `In Progress` → En cours, `Finished` et `ToControl` (terminée, contrôle administratif en attente) → Terminée. Toute autre valeur → « Statut inconnu ».
- **Collectes** (`Service_Type_Direction = Pickup`) : le client et le lieu sont pris dans les champs `Origin_*` (la destination est le site Agrivalor).
- **Statut des arrêts** : fourni par `Mission_WCAP.Driver_Status` (entité `BC_MISSION_DETAIL_ENTITY`). Seule la valeur `Finished` a été observée ; toute autre valeur → « Statut inconnu » jusqu'à confirmation. Si `Mission_WCAP` est indisponible, les arrêts restent affichés sans statut ni heures réelles.
- **Créneau** : `Requested_Time` est toujours à 00:00 sur les collectes observées : sans heure demandée, le retard d'un arrêt est « indéterminé ».
- **Pas d'heure réelle de départ / fin de tournée** ni de **distance prévue** : la timeline n'affiche que l'heure prévue de départ et de fin ; la comparaison prévu / parcouru est masquée (seuls les km parcourus des compteurs sont affichés). Elle réapparaît automatiquement si une distance prévue est fournie.
- **Nom du conducteur** (`Tour_Driver_Name`) : présent dans `Mission_WCAP` mais non affiché (donnée personnelle).

Tant que les champs obligatoires (`tournee.id`, `tournee.date`, `mission.id`, `mission.tourneeId`) sont vides, la passerelle répond « correspondance à configurer » plutôt que de deviner.

### 4. Lancer en mode connecté

```bash
npm run live     # passerelle + application, http://localhost:5173
```

`npm run live` lance la passerelle et l'application en mode connecté (`.env.live` : `VITE_DISPATCH_API_URL=/api`). `npm run dev` seul reste en mode démonstration.

L'en-tête indique l'état de chaque source : connecté, non configuré, ou l'erreur (token refusé, correspondance à configurer, BC injoignable).

## Brancher Webfleet (positions et état des véhicules)

Identifiants WEBFLEET.connect dans le **`.env` racine** :

```
WEBFLEET_BASE_URL=https://csv.webfleet.com
WEBFLEET_ACCOUNT=...
WEBFLEET_USERNAME=...
WEBFLEET_PASSWORD=...
WEBFLEET_API_KEY=...
# WEBFLEET_SHOW_DRIVER_NAMES=true   # noms des conducteurs : masqués par défaut (RGPD)
```

Vérification : `npm run webfleet:inspect` (champs reçus, immatriculations reconnues, états ; ni identifiants ni positions affichés).

- Action utilisée : `showObjectReportExtern` (dernière position connue). WEBFLEET.connect la limite à 6 requêtes/minute : la passerelle met le résultat en cache 30 s.
- Position : `latitude_mdeg` / `longitude_mdeg` (micro-degrés), horodatée par `pos_time`, lieu `postext`.
- État : `ignition` = 0 → Contact coupé ; contact + `standstill` = 0 → En route ; contact + `standstill` = 1 → À l'arrêt ; sinon État inconnu.
- Rapprochement avec BC : immatriculation extraite de `objectname` et de `Vehicle_No`, normalisée en `AA-123-AA`. Un objet Webfleet sans immatriculation reconnaissable reste affiché, sans lien avec une tournée.

## Contrat de la passerelle (format renvoyé au navigateur)

Ce contrat (servi par `server/`) est défini par l'application. Ce n'est **pas** l'API Webfleet ni l'API Business Central. La correspondance avec les champs réels de ces deux services reste à établir à partir de leur documentation et de la configuration du tenant Agrivalor.

Les dates sont au format ISO 8601. Tous les champs marqués `?` sont facultatifs : s'ils sont absents, l'interface affiche « Non disponible », sans valeur inventée.

`GET {VITE_DISPATCH_API_URL}/webfleet/fleet`

```jsonc
{
  "vehicles": [{
    "id": "string", "registration": "string", "label?": "string",
    "status": "driving | stopped | ignition_off | unknown",
    "position?": { "lat": 48.1, "lng": 7.3, "recordedAt": "ISO", "placeLabel?": "string" },
    "driverName?": "string",          // seulement si l'affichage est autorisé
    "distanceTodayKm?": 123
  }],
  "missionDistances?": [{ "missionId": "string", "actualDistanceKm": 42 }]
}
```

`GET {VITE_DISPATCH_API_URL}/business-central/missions?date=YYYY-MM-DD`

```jsonc
{
  "missions": [{
    "id": "string", "reference": "string", "label?": "string", "vehicleId?": "string",
    "status": "planned | in_progress | completed | cancelled | unknown",
    "plannedStart?": "ISO", "plannedEnd?": "ISO", "actualStart?": "ISO", "actualEnd?": "ISO",
    "plannedDistanceKm?": 100, "actualDistanceKm?": 96,
    "deliveries": [{
      "id": "string", "reference": "string", "orderReference?": "string", "sequence?": 1,
      "customerName": "string", "siteName?": "string", "location?": { "lat": 48.1, "lng": 7.3 },
      "status": "planned | in_progress | delivered | failed | cancelled | unknown",
      "plannedWindowStart?": "ISO", "plannedWindowEnd?": "ISO",
      "estimatedArrival?": "ISO", "actualArrival?": "ISO", "actualCompletion?": "ISO"
    }]
  }]
}
```

Les deux sources sont chargées indépendamment. Si l'une échoue, l'autre reste affichée et l'en-tête indique l'erreur. Une valeur de statut inconnue devient « Statut inconnu ». Une entrée invalide est écartée, et l'en-tête en indique le nombre.

## Règles métier (à valider par l'exploitation)

Ces règles sont centralisées dans `src/domain/rules.ts`. L'application les affiche aussi à côté des données concernées.

| Règle | Valeur de départ |
| --- | --- |
| **Retard d'une tournée** : dépassement de l'heure de fin prévue (début prévu + durée prévue) de plus de la tolérance — tournée encore en cours après cette heure, ou terminée plus tard (fin réelle = fin de tournée, à défaut fin du dernier arrêt réalisé). Le retard commence à l'heure de fin prévue. Sans durée prévue, le retard est « indéterminé » (non affiché). | tolérance 15 min |
| **Retard d'un arrêt** : l'arrivée dépasse la fin de son créneau de plus de la tolérance (créneaux absents dans les collectes BC actuelles). | tolérance 15 min |
| **Position ancienne** : aucune nouvelle mesure GPS depuis… | 15 min |
| **Écart de distance signalé** : \|parcouru − prévu\| / prévu, calculé uniquement pour les missions **terminées** qui ont les deux distances | > 20 % |
| **Action requise** (véhicule) : mission en retard, ou mission en cours sans position récente | — |

L'application ne calcule **aucune** ETA. Elle n'utilise que celles fournies par une source.

## Carte

Leaflet affiche par défaut les tuiles OpenStreetMap (`VITE_MAP_TILE_URL`). Si le service de tuiles est injoignable, un message s'affiche et les positions restent visibles sur un fond neutre. Pour un usage en production soutenu, prévoir un fournisseur de tuiles qui accepte ce volume (la politique d'usage d'OSM limite les gros volumes). Le tracé entre les arrêts d'une mission relie les points de livraison dans l'ordre de passage : ce n'est **pas** l'itinéraire routier, et la légende le précise.

## Accessibilité

- Chaque statut est porté par un libellé et un pictogramme, jamais par la couleur seule.
- Contrôles natifs (boutons, cases à cocher), focus visible, lien d'évitement, onglets ARIA.
- Marqueurs de carte accessibles au clavier, avec un nom complet (immatriculation, état, retard, âge de la position).
- Zones `aria-live` pour la fraîcheur des données et le panneau de détail.

## Limites connues

- Business Central : branché sur `Tournee_Excel` / `Mission_Excel` ; statuts de livraison, heures réelles et distance prévue absents de ces entités (voir plus haut).
- Webfleet : dernière position et état uniquement (pas d'historique de trajet ni de distance par tournée).
- Les règles métier ci-dessus sont des propositions à valider.
- L'affichage des noms de conducteurs dépend uniquement de leur présence dans les données : le filtrage RGPD doit être fait par la passerelle.
- Il n'y a pas de tests de composants d'interface. Les tests couvrent les règles, la timeline et la validation des données externes.
