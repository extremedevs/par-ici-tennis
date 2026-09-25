# par-ici-tennis · tableau de bord

Petite app Next.js (Vercel + Supabase) qui affiche, **pour chaque compte**, si la réservation du jour a abouti.
Les notifications restent sur ntfy, l'app ne fait qu'afficher les résultats envoyés par la Lambda.

```
EventBridge Scheduler → Lambda (index.js) ──ntfy──▶ téléphone
                                        └──POST /api/runs──▶ Vercel ──▶ Supabase (table runs)
```

## 1. Supabase

1. Créer un projet sur [supabase.com](https://supabase.com) (offre gratuite).
2. SQL Editor → coller et exécuter [`supabase/migrations/0001_runs.sql`](supabase/migrations/0001_runs.sql).
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

## Développement local

```sh
cd web
cp .env.example .env.local   # puis compléter
npm install
npm run dev
```
