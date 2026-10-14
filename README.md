# Agrivalor Dispatch

Tour de contrôle transport d'Agrivalor. Sur un seul écran : carte de la flotte, missions et livraisons du jour, retards, timeline d'exploitation et comparaison des distances prévues et parcourues.

> **État actuel : mode démonstration.** Aucune connexion à Webfleet ni à Business Central n'est configurée dans ce dépôt. L'interface affiche des données **fictives**, signalées en permanence par un bandeau et par l'état des sources dans l'en-tête.

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

## Brancher Webfleet et Business Central

### Principe de sécurité

Le navigateur **n'appelle jamais** Webfleet ni Business Central directement. Les identifiants (compte, utilisateur et clé API Webfleet ; application Entra ID pour Business Central) doivent rester sur une **passerelle serveur** (BFF) qui :

1. s'authentifie auprès des deux services ;
2. convertit leurs réponses vers le format ci-dessous ;
3. filtre les données personnelles, en particulier les noms des conducteurs, selon ce qui est autorisé.

Ensuite, renseigner `VITE_DISPATCH_API_URL` dans `.env.local` (voir `.env.example`). Ne mettez **jamais** de clé dans une variable `VITE_*` : ces variables sont incluses dans le code envoyé au navigateur.

### Contrat attendu de la passerelle

Ce contrat est défini par l'application. Ce n'est **pas** l'API Webfleet ni l'API Business Central. La correspondance avec les champs réels de ces deux services reste à établir à partir de leur documentation et de la configuration du tenant Agrivalor.

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
| **Retard** : l'arrivée (réelle, ou ETA fournie par une source) dépasse la fin du créneau prévu de plus de la tolérance, ou la tolérance est dépassée sans livraison enregistrée. Le retard commence à la fin du créneau. Sans fin de créneau, le retard est « indéterminé ». | tolérance 15 min |
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

- Aucune intégration réelle : la passerelle serveur reste à développer et la correspondance des champs Webfleet / Business Central reste à faire.
- Les règles métier ci-dessus sont des propositions à valider.
- L'affichage des noms de conducteurs dépend uniquement de leur présence dans les données : le filtrage RGPD doit être fait par la passerelle.
- Il n'y a pas de tests de composants d'interface. Les tests couvrent les règles, la timeline et la validation des données externes.
