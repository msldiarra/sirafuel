# Déploiement du système de notifications

## Étapes à suivre

### 1. Exécuter (ou réexécuter) la migration SQL

⚠️ **Important** : Cette migration **doit** être exécutée dans Supabase pour que le système de notifications fonctionne.

Si vous avez déjà une version ancienne, **vous DEVEZ la réexécuter** pour avoir les bonnes RLS policies.

1. Allez dans votre projet Supabase
2. Ouvrez l'**éditeur SQL**
3. Copiez-collez le contenu complet du fichier : `supabase/migrations/006_add_notifications.sql`
4. Cliquez sur **Exécuter**

L'exécution doit se terminer sans erreur.

⚠️ **Si vous avez l'erreur `42501` ("new row violates row-level security policy")** :
- Cela signifie que la migration précédente est partiellement appliquée
- Réexécutez la migration complète (elle a des `DROP POLICY IF EXISTS` qui nettoient les anciennes policies)

### 2. Vérifier que la migration s'est bien exécutée

Exécutez cette requête dans l'éditeur SQL :

```sql
-- Vérifier que la table existe
SELECT COUNT(*) FROM station_update_notification;

-- Vérifier que le champ notifications_enabled existe
SELECT COUNT(*) FROM user_profile WHERE notifications_enabled = true;

-- Vérifier que le trigger existe
SELECT tgname FROM pg_trigger WHERE tgname = 'station_status_update_notification_trigger';
```

Si tout est bon :
- La table `station_update_notification` existe
- Le champ `notifications_enabled` existe dans `user_profile`
- Le trigger `station_status_update_notification_trigger` existe

### 3. Redémarrer l'application

```bash
npm run dev
```

ou si en production :

```bash
npm run build
npm start
```

### 4. Tester le système

#### Côté utilisateur (Admin ou Rapporteur Vérifié)

1. Aller sur `/profile`
2. Vérifier que le toggle **NOTIFICATIONS** est visible (noir) - c'est normal si désactivé
3. Activer le toggle **NOTIFICATIONS** (il doit devenir vert)
4. Ouvrir la cloche de notifications
5. Cliquer sur "Activer les notifications" (notifications push)
6. Accepter la permission du navigateur

#### Côté mise à jour (avec un autre compte)

1. Connexion avec un compte Rapporteur Vérifié
2. Aller dans une station (`/station/[id]`)
3. Faire une mise à jour (sélectionner Essence/Gasoil, cliquer "Contribuer")

#### Vérification

1. Regarder dans la cloche de notifications de l'Admin - une nouvelle notification doit apparaître
2. Vérifier la console du navigateur (F12) :
   - Doit voir : `Notifications loaded: 1` ou plus
   - Doit voir : `New notification received:`

## Dépannage

### Les notifications ne s'affichent pas

1. **Vérifier que la migration a été exécutée** :
   ```sql
   SELECT * FROM station_update_notification LIMIT 1;
   ```
   Si erreur "table does not exist", la migration n'a pas été exécutée.

2. **Vérifier que notifications_enabled = true** :
   ```sql
   SELECT notifications_enabled FROM user_profile WHERE email_or_phone = 'VOTRE_EMAIL';
   ```
   Doit retourner `true`.

3. **Vérifier que le rôle est correct** :
   ```sql
   SELECT role FROM user_profile WHERE email_or_phone = 'VOTRE_EMAIL';
   ```
   Doit retourner `ADMIN` ou `TRUSTED_REPORTER`.

4. **Vérifier que le trigger crée des notifications** :
   - Faire une mise à jour de station
   - Exécuter :
     ```sql
     SELECT COUNT(*) FROM station_update_notification WHERE created_at > NOW() - INTERVAL '1 minute';
     ```
   - Doit retourner au moins 1.

### Les notifications push ne s'affichent pas

1. Vérifier que vous avez cliqué sur "Activer les notifications"
2. Vérifier que le navigateur a demandé une permission
3. Ouvrir la console et vérifier : `Notification.permission` doit retourner `'granted'`

## Architecture du système

```
Mise à jour station
        ↓
Trigger "station_status_update_notification_trigger"
        ↓
Fonction "create_station_update_notifications()"
        ↓
Insère dans "station_update_notification"
        ↓
Supabase Realtime détecte le changement
        ↓
Hook "subscribeToNotifications()" se déclenche
        ↓
`loadNotifications()` recharge les notifications
        ↓
Component React rafraîchit l'affichage
        ↓
Notification push (si permission = granted)
```

## Support

Pour déboguer le système :
- Consulter `docs/DEBUG_NOTIFICATIONS.md` pour les commandes SQL
- Ouvrir la console du navigateur (F12) pour voir les logs
- Regarder l'onglet **Network** pour vérifier que Supabase Realtime fonctionne

