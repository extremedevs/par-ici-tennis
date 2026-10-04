# par-ici-tennis · tableau de bord

Petite app Next.js (Vercel + Supabase) qui affiche, **pour chaque compte**, si la réservation du jour a abouti.
Les notifications restent sur ntfy, l'app ne fait qu'afficher les résultats envoyés par la Lambda.

```
EventBridge Scheduler → Lambda (index.js) ──ntfy──▶ téléphone
                                        └──POST /api/runs──▶ Vercel ──▶ Supabase (table runs)
```

## 1. Supabase

1. Créer un projet sur [supabase.com](https://supabase.com) (offre gratuite).
2. Créer la table, au choix :
   - Integrations → GitHub : **Working directory = `web`**, cocher « Deploy to production » (branche `main`). Les migrations de `supabase/migrations` sont appliquées au **prochain push sur `main`** (sauvegarder le réglage ne déclenche rien).
   - Ou SQL Editor → coller et exécuter [`supabase/migrations/20260925000000_runs.sql`](supabase/migrations/20260925000000_runs.sql).
3. Project Settings → API : noter l'URL du projet et la clé `service_role`.

## 2. Vercel

1. Importer le repo GitHub dans Vercel, **Root Directory = `web`**.
2. Variables d'environnement (voir [`.env.example`](.env.example)) :

| Variable | Valeur |
|---|---|
| `APP_PASSWORD` | mot de passe pour ouvrir le tableau de bord |
| `SUPABASE_URL` | URL du projet Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | clé `service_role` (reste côté serveur) |
| `TRACKER_TOKEN` | jeton aléatoire partagé avec la Lambda, ex. `openssl rand -hex 32` |

## 3. Lambda

Ajouter deux variables d'environnement à la fonction (ou un bloc `"tracker": { "url", "token" }` dans la config SSM) :

```sh
MSYS_NO_PATHCONV=1 aws lambda update-function-configuration \
  --function-name par-ici-tennis \
  --environment "Variables={CONFIG_SSM_PARAM=/par-ici-tennis/config,HEADLESS=true,TRACKER_URL=https://<app>.vercel.app,TRACKER_TOKEN=<jeton>}" \
  --region eu-west-3
```

Le compte affiché est `name` s'il est présent dans la config, sinon `ntfy.title`. L'email et le mot de passe ne sont jamais envoyés.

Payload envoyé par [`lib/tracker.js`](../lib/tracker.js) :

```json
{ "account": "Jack", "status": "booked", "date": "2026-10-01", "hour": 18, "location": "Suzanne Lenglen", "court": "Court N°5", "address": "…" }
```

`status` vaut `booked`, `not_found`, `error` ou `dry_run`.

## 4. Admin multi-comptes (`/admin`)

1 compte tennis.paris.fr = 1 réservation possible par jour. Chaque compte est :
- un paramètre SSM **SecureString** `/par-ici-tennis/accounts/<id>` qui contient son `config.json` (identifiants, lieux, heures, joueurs, ntfy) ;
- un planning EventBridge `account-<id>` (groupe `par-ici-tennis`) qui appelle **la même Lambda** à 7h59 avec `{ "account": "<id>" }`.

Une seule Lambda pour tous les comptes : le coût Lambda dépend du temps d'exécution, pas du nombre de fonctions, et les plannings lancent les comptes en parallèle à 8h00.

L'admin crée, modifie, met en pause et supprime les comptes. Le mot de passe tennis.paris.fr n'est jamais réaffiché (champ vide = inchangé). On choisit les **jours de jeu** : la Lambda tourne le lendemain du jour choisi, une semaine avant (réservation à J+6).

### Mise en place (Git Bash)

```sh
# 1. Groupe de plannings
MSYS_NO_PATHCONV=1 aws scheduler create-schedule-group --name par-ici-tennis --region eu-west-3

# 2. Utilisateur IAM pour Vercel, limité aux comptes et plannings par-ici-tennis
aws iam create-user --user-name par-ici-tennis-vercel
MSYS_NO_PATHCONV=1 aws iam put-user-policy --user-name par-ici-tennis-vercel \
  --policy-name par-ici-tennis-admin --policy-document file://web/aws/vercel-admin-policy.json
aws iam create-access-key --user-name par-ici-tennis-vercel   # → PIT_AWS_ACCESS_KEY_ID / PIT_AWS_SECRET_ACCESS_KEY
```

3. Variables Vercel : `ADMIN_PASSWORD`, `PIT_AWS_ACCESS_KEY_ID`, `PIT_AWS_SECRET_ACCESS_KEY`, `LAMBDA_ARN`, `SCHEDULER_ROLE_ARN` (voir [`.env.example`](.env.example)), puis redéployer.
4. Redéployer la Lambda (rebuild + push ECR + `update-function-code`) pour qu'elle comprenne `{ "account": "<id>" }`. Le rôle Lambda lit déjà `/par-ici-tennis/*`.

### Migrer le compte existant

```sh
MSYS_NO_PATHCONV=1 aws ssm get-parameter --name /par-ici-tennis/config --with-decryption \
  --query Parameter.Value --output text --region eu-west-3 > config-jack.json
MSYS_NO_PATHCONV=1 aws ssm put-parameter --name /par-ici-tennis/accounts/jack --type SecureString \
  --value file://config-jack.json --region eu-west-3
rm config-jack.json
```

Puis dans `/admin` → Modifier `jack` : cocher les jours de jeu et enregistrer (crée le planning). Enfin supprimer l'ancien planning pour éviter une double réservation :

```sh
aws scheduler delete-schedule --name par-ici-tennis-everyday --region eu-west-3
```

## Développement local

```sh
cd web
cp .env.example .env.local   # puis compléter
npm install
npm run dev
```
