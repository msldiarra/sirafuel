# Guide de débogage des notifications

## Vérifications à faire

### 1. Vérifier que la migration est appliquée

Exécuter dans Supabase SQL Editor :
```sql
-- Vérifier que la table existe
SELECT * FROM station_update_notification LIMIT 1;

-- Vérifier que le champ notifications_enabled existe
SELECT notifications_enabled FROM user_profile LIMIT 1;

-- Vérifier que le trigger existe
SELECT * FROM pg_trigger WHERE tgname = 'station_status_update_notification_trigger';
```

### 2. Vérifier que l'utilisateur a activé les notifications

1. Aller sur `/profile`
2. Vérifier que le toggle "NOTIFICATIONS" est activé (ON)
3. Vérifier que l'utilisateur a le rôle `TRUSTED_REPORTER` ou `ADMIN`

Ou en SQL :
```sql
SELECT id, role, notifications_enabled 
FROM user_profile 
WHERE auth_user_id = 'VOTRE_AUTH_USER_ID';
```

### 3. Tester manuellement la création de notification

```sql
-- Créer une notification de test
INSERT INTO station_update_notification (user_id, station_id, station_status_id)
SELECT 
  up.id,
  s.id,
  ss.id
FROM user_profile up
CROSS JOIN station s
CROSS JOIN station_status ss
WHERE up.role IN ('TRUSTED_REPORTER', 'ADMIN')
  AND up.notifications_enabled = true
  AND s.is_active = true
LIMIT 1;
```

### 4. Vérifier que le trigger fonctionne

```sql
-- Vérifier les logs du trigger (si activés)
-- Ou tester en mettant à jour un station_status
UPDATE station_status 
SET updated_at = NOW() 
WHERE id = 'UN_STATION_STATUS_ID';
```

### 5. Vérifier dans la console du navigateur

Ouvrir la console (F12) et vérifier :
- `Notifications loaded: X` - doit afficher le nombre de notifications
- `New notification received:` - doit apparaître quand une nouvelle notification arrive
- Erreurs éventuelles

### 6. Vérifier les permissions du navigateur

Dans la console :
```javascript
Notification.permission
// Doit retourner 'default', 'granted' ou 'denied'
```

## Problèmes courants

### Les notifications ne s'affichent pas

1. **Vérifier que `notifications_enabled = true`** dans le profil
2. **Vérifier que le rôle est correct** (TRUSTED_REPORTER ou ADMIN)
3. **Vérifier que le trigger est créé** dans la base de données
4. **Vérifier les RLS policies** - l'utilisateur doit pouvoir lire ses notifications

### Les notifications push ne fonctionnent pas

1. **Vérifier la permission** : `Notification.permission` doit être 'granted'
2. **Cliquer sur "Activer les notifications"** dans la liste des notifications
3. **Vérifier que le navigateur autorise les notifications** (paramètres du navigateur)

### Le trigger ne crée pas de notifications

1. **Vérifier que le trigger existe** :
```sql
SELECT * FROM pg_trigger WHERE tgname = 'station_status_update_notification_trigger';
```

2. **Vérifier que la fonction existe** :
```sql
SELECT * FROM pg_proc WHERE proname = 'create_station_update_notifications';
```

3. **Tester le trigger manuellement** :
```sql
-- Simuler une mise à jour
UPDATE station_status 
SET updated_at = NOW() 
WHERE id = (SELECT id FROM station_status LIMIT 1);

-- Vérifier que des notifications ont été créées
SELECT COUNT(*) FROM station_update_notification 
WHERE created_at > NOW() - INTERVAL '1 minute';
```

## Commandes SQL utiles

```sql
-- Voir toutes les notifications d'un utilisateur
SELECT n.*, s.name as station_name
FROM station_update_notification n
JOIN station s ON s.id = n.station_id
WHERE n.user_id = 'USER_PROFILE_ID'
ORDER BY n.created_at DESC;

-- Voir les utilisateurs avec notifications activées
SELECT id, email_or_phone, role, notifications_enabled
FROM user_profile
WHERE role IN ('TRUSTED_REPORTER', 'ADMIN')
  AND notifications_enabled = true;

-- Compter les notifications non lues
SELECT COUNT(*) 
FROM station_update_notification 
WHERE is_read = false 
  AND user_id = 'USER_PROFILE_ID';
```

