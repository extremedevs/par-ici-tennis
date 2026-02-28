# CLAUDE.md — Règles du projet par-ici-tennis

## Contexte
Fork de https://github.com/bertrandda/par-ici-tennis
Script Playwright de réservation de tennis Paris, packagé en **image Lambda container arm64** sur AWS.

---

## Environnement de développement
- OS : **Windows 11**, shell **Git Bash**
- Docker Desktop Windows
- AWS CLI v2, région **eu-west-3** (Paris)
- AWS Account ID : `635936555914`
- IAM user déploiement : `tennis-deployer`

---

## Règles AWS CLI (Git Bash sur Windows)

Toujours préfixer les commandes AWS qui contiennent des chemins avec `/` :
```bash
MSYS_NO_PATHCONV=1 aws ssm put-parameter --name "/par-ici-tennis/config" ...
```
Sans ça, Git Bash convertit `/par-ici-tennis/config` → `C:/Program Files/Git/par-ici-tennis/config`.

---

## Règles Docker

### Build Lambda (déploiement réel)
```bash
docker build --platform linux/arm64 --provenance=false -t par-ici-tennis:lambda .
```
- `--provenance=false` obligatoire — sinon Lambda rejette le manifest (BuildKit ajoute des attestations OCI non supportées)
- `arm64` = Graviton, moins cher sur Lambda

### Build local (tests)
```bash
docker build --platform linux/amd64 --provenance=false --build-arg ARCH=x86_64 -t par-ici-tennis:lambda-local .
```
- Ne jamais lancer l'image `arm64` sur un host `amd64` sans `--build-arg ARCH=x86_64` → QEMU emulation = très lent + OOM

### Volume mounts sur Windows
```bash
docker run -v "$(pwd -W)/config.json:/var/task/config.json:ro" ...
```
- Utiliser `$(pwd -W)` (chemin Windows avec slashes) et non `$(pwd)` qui casse les mounts

---

## Architecture Lambda

**Objectif : image Docker la plus petite et efficace possible pour minimiser les coûts Lambda (cold start, stockage ECR, mémoire allouée).**

| Ressource | Valeur |
|---|---|
| Fonction | `par-ici-tennis` |
| Architecture | `arm64` |
| Mémoire | `1536 MB` (optimisé depuis 3008 MB, max usage observé ~895 MB) |
| Timeout | `180s` (60s wait + ~50s booking + buffer) |
| Image ECR | `635936555914.dkr.ecr.eu-west-3.amazonaws.com/par-ici-tennis-lambda:latest` |
| Config SSM | `/par-ici-tennis/config` |
| Rôle IAM | `par-ici-tennis-lambda-role` |

### Variables d'environnement Lambda
```
CONFIG_SSM_PARAM=/par-ici-tennis/config
HEADLESS=true
```

### Variable pour les tests locaux
```
SKIP_WAIT=true   # bypass le wait jusqu'à 8h00 (tests Docker locaux)
```

### Chemins d'écriture en Lambda
- `/var/task/` est **read-only** → toujours écrire dans `/tmp`
- `OUTPUT_DIR=/tmp` → fichiers `.ics` et traces
- `IMG_DIR=/tmp` → screenshots d'erreur

---

## Règles de code

- Ne jamais utiliser `process.env.GITHUB_ACTIONS` — supprimé du projet
- Les chemins d'écriture doivent utiliser `process.env.OUTPUT_DIR ?? '.'` et `process.env.IMG_DIR ?? 'img'`
- Notifications ntfy :
  - **Sans fichier joint** → `POST` JSON (supporte l'Unicode/accents)
  - **Avec fichier joint** → `PUT` binaire + headers (`encodeURIComponent` pour le message)

---

## Règles Git

- Branche principale : `main`
- Remote : `https://github.com/extremedevs/par-ici-tennis.git`
- Ne jamais commiter `config.json` (credentials), `out.json`, `logs_b64.txt`, `out/`, `img/`
- Après un rebase : `git push origin main --force-with-lease`
- Messages de commit : **une seule ligne**, format `type: description courte`
  - Exemples : `chore: add CLAUDE.md rules`, `fix: Lambda timing`, `feat: ntfy notifications`
  - Pas de corps de message, pas de bullet points

---

## Redéployer après un changement de code

```bash
# 1. Rebuild arm64
docker build --platform linux/arm64 --provenance=false -t par-ici-tennis:lambda .

# 2. Push ECR
MSYS_NO_PATHCONV=1 aws ecr get-login-password --region eu-west-3 \
  | docker login --username AWS --password-stdin 635936555914.dkr.ecr.eu-west-3.amazonaws.com
docker tag par-ici-tennis:lambda 635936555914.dkr.ecr.eu-west-3.amazonaws.com/par-ici-tennis-lambda:latest
docker push 635936555914.dkr.ecr.eu-west-3.amazonaws.com/par-ici-tennis-lambda:latest

# 3. Mettre à jour Lambda
MSYS_NO_PATHCONV=1 aws lambda update-function-code \
  --function-name par-ici-tennis \
  --image-uri 635936555914.dkr.ecr.eu-west-3.amazonaws.com/par-ici-tennis-lambda:latest \
  --region eu-west-3
```
