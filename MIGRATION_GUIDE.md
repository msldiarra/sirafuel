# Guide de Migration - Fix Manager Updates

## Problème Résolu
Les gestionnaires de station ne pouvaient pas mettre à jour les statuts de carburant en raison de politiques RLS (Row Level Security) manquantes dans Supabase.

## Solution

### 1. Appliquer la Migration SQL

Vous avez deux options pour appliquer la migration `005_add_manager_station_status_policies.sql` :

#### Option A : Via Supabase CLI (Recommandé)

```bash
cd /home/msldiarra/projects/sirafuel
npx supabase db push
```

#### Option B : Via le Dashboard Supabase (Manuel)

1. Connectez-vous à votre [Dashboard Supabase](https://supabase.com/dashboard)
2. Sélectionnez votre projet SiraFuel
3. Allez dans **SQL Editor**
4. Créez une nouvelle requête
5. Copiez-collez le contenu du fichier `supabase/migrations/005_add_manager_station_status_policies.sql`
6. Exécutez la requête

Le contenu de la migration :

```sql
-- Add policies for STATION_MANAGER to update and insert station_status

-- Station managers can update status for their own station
CREATE POLICY "Station managers can update their station status" 
ON station_status 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM user_profile 
    WHERE user_profile.auth_user_id = auth.uid() 
      AND user_profile.role = 'STATION_MANAGER' 
      AND user_profile.station_id = station_status.station_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_profile 
    WHERE user_profile.auth_user_id = auth.uid() 
      AND user_profile.role = 'STATION_MANAGER' 
      AND user_profile.station_id = station_status.station_id
  )
);

-- Station managers can insert status for their own station
CREATE POLICY "Station managers can insert their station status" 
ON station_status 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_profile 
    WHERE user_profile.auth_user_id = auth.uid() 
      AND user_profile.role = 'STATION_MANAGER' 
      AND user_profile.station_id = station_status.station_id
  )
);

-- Trusted reporters and admins can update any station status
CREATE POLICY "Trusted reporters can update station status" 
ON station_status 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM user_profile 
    WHERE user_profile.auth_user_id = auth.uid() 
      AND user_profile.role IN ('TRUSTED_REPORTER', 'ADMIN')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_profile 
    WHERE user_profile.auth_user_id = auth.uid() 
      AND user_profile.role IN ('TRUSTED_REPORTER', 'ADMIN')
  )
);

-- Trusted reporters and admins can insert station status
CREATE POLICY "Trusted reporters can insert station status" 
ON station_status 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_profile 
    WHERE user_profile.auth_user_id = auth.uid() 
      AND user_profile.role IN ('TRUSTED_REPORTER', 'ADMIN')
  )
);
```

### 2. Améliorations Apportées

#### A. Nouvelle Interface Manager (src/app/manager/page.tsx)

✅ **Design moderne** similaire à la page de détail de station :
- Affichage du statut actuel avec icônes animées
- Boutons visuels au lieu de dropdowns pour sélectionner les statuts
- Badge "POIDS MAX" pour indiquer la priorité des mises à jour officielles
- Interface responsive et intuitive

✅ **Gestion d'erreurs améliorée** :
- Vérification individuelle de chaque mise à jour (Essence et Gasoil)
- Messages d'erreur détaillés par type de carburant
- Feedback précis : "Seul ESSENCE a été mis à jour. Erreur pour GASOIL: [message]"

#### B. Poids Maximal des Mises à Jour Manager

Les mises à jour du gestionnaire ont maintenant un **poids maximal** car :
- `last_update_source` = `'OFFICIAL'` (priorité la plus élevée)
- Badge visuel "POIDS MAX" dans l'interface
- Message explicite : "En tant que gestionnaire, vos mises à jour ont la priorité maximale"

### 3. Tester la Solution

1. **Connectez-vous en tant que manager** :
   - Email : manager@test.com (ou votre compte manager)
   
2. **Mettez à jour les statuts** :
   - Sélectionnez un statut pour l'Essence (Disponible/Limité/Rupture)
   - Sélectionnez un statut pour le Gasoil
   - Ajustez le nombre de pompes actives
   - Cliquez sur "✓ CONFIRMER LA MISE À JOUR OFFICIELLE"

3. **Vérifiez les résultats** :
   - Un message de succès devrait apparaître
   - Ouvrez l'application en mode public (nouvelle fenêtre)
   - Recherchez votre station
   - Vérifiez que les deux statuts (Essence ET Gasoil) sont bien mis à jour

### 4. Résolution de Problèmes

Si les mises à jour ne fonctionnent toujours pas :

1. **Vérifiez que la migration est appliquée** :
   ```sql
   SELECT * FROM pg_policies WHERE tablename = 'station_status';
   ```
   Vous devriez voir 6 politiques au total.

2. **Vérifiez le profil du manager** :
   ```sql
   SELECT * FROM user_profile WHERE role = 'STATION_MANAGER';
   ```
   Assurez-vous que `station_id` n'est pas NULL.

3. **Consultez les logs** :
   - Ouvrez la console développeur (F12)
   - Vérifiez les erreurs dans l'onglet Console
   - Les messages d'erreur détaillés vous indiqueront le problème exact

## Résumé des Changements

| Fichier | Type | Description |
|---------|------|-------------|
| `supabase/migrations/005_add_manager_station_status_policies.sql` | Nouveau | Politiques RLS pour autoriser les managers |
| `src/app/manager/page.tsx` | Modifié | Nouvelle interface moderne + gestion d'erreurs |

## Impact

✅ Les managers peuvent maintenant mettre à jour les statuts Essence ET Gasoil  
✅ Interface moderne et intuitive  
✅ Messages d'erreur clairs et précis  
✅ Priorité maximale visible pour les mises à jour officielles  

