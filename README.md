# TajiCheck

Plateforme participative de suivi de la disponibilité de carburant et des files d'attente au Mali.

**Taji** = essence en bambara (littéralement "eau qui prend feu" 🔥)

## 🚀 Technologies

- **Framework**: Next.js 14 (App Router) + TypeScript + Tailwind CSS
- **Backend**: Next.js API routes / server actions
- **Database & Realtime**: Supabase (PostgreSQL + Realtime)
- **Auth**: Supabase Auth (email OTP)
- **Maps**: MapLibre GL (alternative gratuite à Mapbox)

## 📋 Prérequis

- Node.js 18+
- Compte Supabase
- Accès à une base de données PostgreSQL

## 🛠️ Installation

1. **Cloner le projet**
```bash
git clone <repository-url>
cd tajicheck
```

2. **Installer les dépendances**
```bash
npm install
```

3. **Configurer les variables d'environnement**

Créez un fichier `.env.local` à la racine du projet :

```env
NEXT_PUBLIC_SUPABASE_URL=votre_url_supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=votre_anon_key
SUPABASE_SERVICE_ROLE_KEY=votre_service_role_key

# Optionnel: Style de carte (par défaut: Carto Positron)
NEXT_PUBLIC_MAP_STYLE_URL=https://basemaps.cartocdn.com/gl/positron-gl-style/style.json
```

4. **Configurer la base de données Supabase**

Exécutez le script SQL dans `supabase/migrations/001_initial_schema.sql` dans votre projet Supabase :

- Allez dans votre projet Supabase
- Ouvrez l'éditeur SQL
- Copiez-collez le contenu de `supabase/migrations/001_initial_schema.sql`
- Exécutez le script

5. **Activer Realtime sur Supabase**

Dans votre projet Supabase :
- Allez dans Database > Replication
- Activez la réplication pour les tables : `station_status`, `contribution`, `alert`

6. **Lancer le serveur de développement**

```bash
npm run dev
```

Ouvrez [http://localhost:3000](http://localhost:3000) dans votre navigateur.

## 📱 Fonctionnalités

### Public (sans connexion)
- ✅ Visualisation des stations sur une carte ou en liste
- ✅ Filtrage par ville et type de carburant (Essence/Gasoil)
- ✅ Détails de chaque station (statut, temps d'attente, fiabilité)
- ✅ Contribution anonyme (statut carburant, file d'attente)
- ✅ Mises à jour en temps réel via Supabase Realtime

### Gestionnaire de Station (`/manager`)
- ✅ Mise à jour officielle du statut de la station
- ✅ Gestion des pompes actives
- ✅ Mises à jour en temps réel

### Rapporteur Vérifié (`/trusted`)
- ✅ Vue des stations à proximité
- ✅ Envoi de rapports vérifiés (poids plus élevé)
- ✅ Carte et liste des stations

### Administrateur (`/admin`)
- ✅ Tableau de bord avec KPIs
- ✅ Liste des stations et alertes
- ✅ Gestion des utilisateurs
- ✅ Résolution des alertes

## 🗄️ Structure de la base de données

### Tables principales

- **station**: Informations des stations-service
- **station_status**: Statut actuel par type de carburant
- **user_profile**: Profils utilisateurs avec rôles
- **contribution**: Contributions des utilisateurs
- **alert**: Alertes système (pas de mise à jour, temps d'attente élevé, contradictions)

## 🔐 Rôles et permissions

- **PUBLIC**: Lecture seule, contributions anonymes
- **STATION_MANAGER**: Mises à jour officielles pour station(s) assignée(s)
- **TRUSTED_REPORTER**: Rapports vérifiés (poids plus élevé)
- **ADMIN**: Accès complet au dashboard et gestion

## 🎨 Design

L'application s'inspire du redesign de GasBuddy avec :
- Palette de couleurs : Teal (#14B8A6) pour les headers, Orange (#F97316) pour les actions primaires
- Design mobile-first et responsive
- Composants réutilisables (boutons, cards, empty states)
- Navigation en bas d'écran (bottom nav)

## 📦 Build pour production

```bash
npm run build
npm start
```

## 🚧 Améliorations futures

- [ ] Support téléphone (OTP SMS)
- [ ] Upload de photos pour contributions
- [ ] Intégration USSD
- [ ] Bot WhatsApp
- [ ] Notifications push
- [ ] Mode hors-ligne (PWA)

## 📄 Licence

MIT

