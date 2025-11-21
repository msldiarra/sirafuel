# Guide de Configuration SiraFuel

## 🚀 Démarrage Rapide

### 1. Configuration Supabase

1. Créez un projet sur [Supabase](https://supabase.com)
2. Notez votre URL et vos clés API (disponibles dans Settings > API)

### 2. Configuration de la Base de Données

1. Dans votre projet Supabase, allez dans **SQL Editor**
2. Copiez le contenu de `supabase/migrations/001_initial_schema.sql`
3. Exécutez le script SQL

### 3. Activation de Realtime

1. Dans Supabase, allez dans **Database > Replication**
2. Activez la réplication pour les tables suivantes :
   - `station_status`
   - `contribution`
   - `alert`

### 4. Configuration des Variables d'Environnement

Créez un fichier `.env.local` à la racine :

```env
NEXT_PUBLIC_SUPABASE_URL=https://votre-projet.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=votre_anon_key
SUPABASE_SERVICE_ROLE_KEY=votre_service_role_key
```

### 5. Installation et Lancement

```bash
npm install
npm run dev
```

### 6. Import des Stations de Référence (Optionnel)

Pour importer les stations depuis l'API BkoFuel (https://api.bkofuel.com/stations) :

```bash
npm run import-stations
```

Ce script va :
- Récupérer toutes les stations depuis l'API BkoFuel
- Les importer dans votre base de données Supabase
- Créer les statuts de station basés sur les derniers rapports
- Créer des contributions pour chaque rapport

**Note**: Assurez-vous d'avoir configuré `SUPABASE_SERVICE_ROLE_KEY` dans `.env.local` pour que le script puisse contourner les RLS policies.

## 📝 Données de Test

Pour tester l'application, vous pouvez insérer des stations de test :

```sql
-- Exemple de stations à Bamako
INSERT INTO station (name, brand, city, area, latitude, longitude) VALUES
('Station Total Badalabougou', 'Total', 'Bamako', 'Badalabougou', 12.6392, -8.0029),
('Station Shell Hippodrome', 'Shell', 'Bamako', 'Hippodrome', 12.6500, -8.0100),
('Station Oryx ACI', 'Oryx', 'Bamako', 'ACI', 12.6200, -7.9900);
```

## 🔐 Création d'Utilisateurs

### Utilisateur Admin

1. Créez un utilisateur via Supabase Auth (Authentication > Users > Add user)
2. Notez l'UUID de l'utilisateur
3. Créez le profil admin :

```sql
INSERT INTO user_profile (auth_user_id, email_or_phone, role, is_verified)
VALUES ('uuid-de-l-utilisateur', 'admin@example.com', 'ADMIN', true);
```

### Gestionnaire de Station

```sql
-- 1. Créez l'utilisateur dans Supabase Auth
-- 2. Créez le profil avec station assignée
INSERT INTO user_profile (auth_user_id, email_or_phone, role, station_id, is_verified)
VALUES ('uuid-gestionnaire', 'manager@example.com', 'STATION_MANAGER', 'uuid-station', true);
```

### Rapporteur Vérifié

```sql
INSERT INTO user_profile (auth_user_id, email_or_phone, role, is_verified)
VALUES ('uuid-rapporteur', 'reporter@example.com', 'TRUSTED_REPORTER', true);
```

## 🔄 Tâches Automatiques (Optionnel)

Pour générer automatiquement les alertes, vous pouvez configurer un cron job qui appelle :

```
POST /api/generate-alerts
```

Toutes les heures par exemple.

## 📱 PWA

L'application est configurée comme PWA. Pour activer complètement :

1. Créez les icônes `icon-192.png` et `icon-512.png` dans `/public`
2. L'application sera installable sur mobile

## 🎨 Personnalisation

### Couleurs

Modifiez `tailwind.config.ts` pour changer les couleurs principales :
- `primary.teal`: Couleur principale (headers, navigation)
- `primary.orange`: Actions primaires (boutons)
- `primary.red`: Actions urgentes

### Carte

Par défaut, l'application utilise Carto Positron (gratuit). Pour utiliser Mapbox :

1. Obtenez un token Mapbox
2. Modifiez `NEXT_PUBLIC_MAP_STYLE_URL` dans `.env.local`

## 🐛 Dépannage

### Erreur "relation does not exist"
- Vérifiez que vous avez bien exécuté le script SQL de migration

### Realtime ne fonctionne pas
- Vérifiez que Realtime est activé dans Supabase
- Vérifiez que les tables sont dans la publication `supabase_realtime`

### Erreur d'authentification
- Vérifiez vos clés API dans `.env.local`
- Vérifiez que l'URL Supabase est correcte

## 📚 Documentation

- [Next.js Documentation](https://nextjs.org/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [MapLibre GL](https://maplibre.org/)

