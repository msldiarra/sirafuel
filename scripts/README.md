# Scripts d'Import

## Import des Stations depuis BkoFuel API

Ce script importe toutes les stations depuis l'API BkoFuel (https://api.bkofuel.com/stations) dans votre base de données Supabase.

### Prérequis

1. Avoir configuré `.env.local` avec vos identifiants Supabase :
   ```env
   NEXT_PUBLIC_SUPABASE_URL=votre_url
   SUPABASE_SERVICE_ROLE_KEY=votre_service_role_key
   ```

2. Avoir exécuté la migration SQL (`supabase/migrations/001_initial_schema.sql`)

### Utilisation

```bash
npm run import-stations
```

### Fonctionnalités

- ✅ Importe toutes les stations depuis l'API BkoFuel
- ✅ Met à jour les stations existantes (basé sur nom + ville)
- ✅ Crée les statuts de station (ESSENCE/GASOIL) basés sur `latest_report`
- ✅ Crée des contributions pour chaque rapport
- ✅ Gère les types de carburant : `essence`, `diesel`, `both`
- ✅ Mappe les statuts : `available` → `AVAILABLE`, `out` → `OUT`, etc.

### Mapping des Données

| BkoFuel API | SiraFuel DB |
|------------|-------------|
| `name` | `station.name` |
| `brand` | `station.brand` |
| `commune` | `station.city` |
| `quartier` | `station.area` |
| `latitude` | `station.latitude` |
| `longitude` | `station.longitude` |
| `latest_report.fuel_type` | `station_status.fuel_type` (ESSENCE/GASOIL) |
| `latest_report.status` | `station_status.availability` (AVAILABLE/LIMITED/OUT) |

### Notes

- Le script utilise `SUPABASE_SERVICE_ROLE_KEY` pour contourner les RLS policies
- Les contributions sont créées avec `source_type: 'PUBLIC'` et `user_id: null`
- Les stations existantes sont mises à jour si elles ont le même nom et ville

