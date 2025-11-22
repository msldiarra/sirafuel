# Système de Notifications - SiraFuel

## 📍 Où les utilisateurs reçoivent les alertes ?

Les rapporteurs vérifiés (TRUSTED_REPORTER) et les administrateurs (ADMIN) reçoivent les notifications de mise à jour de stations à **deux endroits** :

### 1. **Dans l'interface web** (toujours actif)

#### Emplacement visuel :
- **Icône de cloche** 🔔 dans le header (en haut à droite)
- Visible sur les pages :
  - `/admin` (page Administration)
  - `/trusted` (page Rapporteur Vérifié)

#### Fonctionnalités :
- **Badge rouge** avec le nombre de notifications non lues
- **Liste déroulante** au clic sur l'icône
- **Mise à jour en temps réel** via Supabase Realtime
- **Indicateur visuel** (point teal) pour les notifications non lues
- **Clic sur une notification** → redirection vers la page de détails `/updates/[updateId]`

### 2. **Notifications push du navigateur** (optionnel, nécessite permission)

#### Comment ça fonctionne :
1. Au premier chargement, le navigateur demande la permission d'afficher des notifications
2. Si l'utilisateur accepte, il recevra des **notifications push** même quand l'application n'est pas ouverte
3. Les notifications apparaissent dans :
   - **Barre de notifications** du système d'exploitation
   - **Centre de notifications** (Windows, macOS, Linux)
   - **Notifications mobiles** si l'app est installée en PWA

#### Contenu des notifications :
- **Titre** : "SiraFuel - Mise à jour"
- **Message** : "Nouvelle mise à jour de station disponible" ou "X nouvelles mises à jour..."
- **Icône** : Logo SiraFuel
- **Action** : Clic sur la notification → ouvre l'application et affiche la liste

#### Indicateur de permission :
- **Point jaune** sur l'icône de cloche = permission non demandée/refusée
- **Pas de point** = notifications push activées

## 🔔 Quand les notifications sont créées ?

Les notifications sont automatiquement créées quand :
- Une mise à jour de `station_status` est effectuée (INSERT ou UPDATE)
- L'utilisateur a activé les notifications dans son profil (`notifications_enabled = true`)
- L'utilisateur a le rôle `TRUSTED_REPORTER` ou `ADMIN`

## ⚙️ Activation/Désactivation

### Pour activer les notifications :
1. Aller dans **Mon Profil** (`/profile`)
2. Activer le toggle **"NOTIFICATIONS"** (visible uniquement pour TRUSTED_REPORTER et ADMIN)
3. Accepter la permission du navigateur si demandée

### Pour désactiver :
- Désactiver le toggle dans le profil (les notifications web s'arrêtent)
- Ou refuser la permission du navigateur (seules les notifications push s'arrêtent)

## 📱 Page de détails d'une notification

Quand un utilisateur clique sur une notification (web ou push), il est redirigé vers :
- **URL** : `/updates/[updateId]`
- **Contenu** :
  - Nom et localisation de la station
  - Statut du carburant (Essence/Gasoil)
  - Disponibilité (Disponible/Limité/En rupture)
  - Temps d'attente estimé
  - Nombre de pompes actives
  - Source de la mise à jour (Officielle/Vérifiée/Publique)
- **Actions** :
  - Bouton **"Partager sur WhatsApp"** avec message formaté
  - Lien vers la page complète de la station

## 🔄 Mise à jour en temps réel

Le système utilise **Supabase Realtime** pour :
- Détecter instantanément les nouvelles notifications
- Mettre à jour le badge sans recharger la page
- Afficher les notifications push immédiatement

## 🛠️ Architecture technique

### Base de données :
- Table `station_update_notification` : stocke les notifications
- Trigger `station_status_update_notification_trigger` : crée automatiquement les notifications
- Champ `notifications_enabled` dans `user_profile` : préférence utilisateur

### Frontend :
- Composant `Notifications.tsx` : affiche l'icône, badge et liste
- API Browser Notifications : notifications push natives
- Supabase Realtime : synchronisation en temps réel

## 📝 Notes importantes

- Les notifications sont **uniquement pour TRUSTED_REPORTER et ADMIN**
- Les notifications web fonctionnent **toujours** (pas besoin de permission)
- Les notifications push nécessitent la **permission du navigateur**
- Les notifications push ne fonctionnent que si l'application est **ouverte** ou **installée en PWA**
- Les notifications sont **automatiquement marquées comme lues** quand on clique dessus

