# PAR-ICI-TENNIS — Déploiement AWS Lambda (Container) + SSM + EventBridge

Automatisation Playwright (Chromium headless) pour réserver des créneaux tennis, packagée en **image conteneur Lambda**, configuration via **AWS Systems Manager Parameter Store**, et planification par **Amazon EventBridge**.

---

# 0) Prérequis

- Docker >= 20.10  
- AWS CLI v2 configurée  
- Un compte AWS avec permissions ECR + Lambda + SSM + EventBridge  
- Code présent dans :
  - `index.js`
  - `lambda.js`
  - `staticFiles.js`
  - `Dockerfile` (base `public.ecr.aws/lambda/nodejs:20-arm64`)

---

# 1) Build et test local (RIE)

## Build

docker build --platform linux/arm64 -t par-ici-tennis:lambda .

## Test local avec Runtime Interface Emulator (RIE)

docker run --rm -p 7000:8080   -v "$(pwd)/config.json:/var/task/config.json:ro"   -v "$(pwd)/out:/var/task/out"   -v "$(pwd)/img:/var/task/img"   -e HEADLESS=true   --shm-size=1g   par-ici-tennis:lambda

Puis invoquer :

curl -X POST "http://localhost:7000/2015-03-31/functions/function/invocations" -d '{}'

> ⚠️ Logs visibles dans le terminal où tourne `docker run`, pas dans la réponse `curl`.

---

# 2) Créer le paramètre SSM `config.json`

## Exemple de fichier `config.json`

{
  "account": { "email": "email@example.com", "password": "password" },
  "locations": ["Paris Centre"],
  "hours": ["08","09","10"],
  "priceType": ["Plein tarif"],
  "courtType": ["Extérieur"],
  "players": [{ "firstName": "Jean", "lastName": "Dupont" }]
}

## Upload dans SSM Parameter Store

aws ssm put-parameter   --name "/par-ici-tennis/config"   --type "String"   --value file://config.json   --overwrite   --region eu-west-3

## IAM minimal pour Lambda

{
  "Effect": "Allow",
  "Action": ["ssm:GetParameter"],
  "Resource": "arn:aws:ssm:eu-west-3:<ACCOUNT_ID>:parameter/par-ici-tennis/config"
}

---

# 3) ECR – Création & Push

AWS_REGION=eu-west-3
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
REPO=par-ici-tennis-lambda

aws ecr create-repository --repository-name $REPO --region $AWS_REGION || true

aws ecr get-login-password --region $AWS_REGION  | docker login --username AWS --password-stdin ${ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com

docker tag par-ici-tennis:lambda ${ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/$REPO:latest
docker push ${ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/$REPO:latest

---

# 4) Lambda – Création de la fonction

aws lambda create-function   --function-name par-ici-tennis   --package-type Image   --code ImageUri=${ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/$REPO:latest   --role arn:aws:iam::<ACCOUNT_ID>:role/<LambdaExecutionRole>   --architectures arm64   --timeout 60   --memory-size 3008   --region $AWS_REGION

## Configurer les variables d’environnement

aws lambda update-function-configuration   --function-name par-ici-tennis   --environment "Variables={CONFIG_SSM_PARAM=/par-ici-tennis/config,HEADLESS=true}"   --region $AWS_REGION

## Tester la Lambda dans AWS

aws lambda invoke --function-name par-ici-tennis out.json --region $AWS_REGION
cat out.json

---

# 5) EventBridge – Programmation automatique

## Créer la règle (ex : tous les jours à 06:00 UTC)

aws events put-rule   --name par-ici-tennis-everyday   --schedule-expression "cron(0 6 * * ? *)"   --region $AWS_REGION

## Autoriser EventBridge à invoquer la Lambda

aws lambda add-permission   --function-name par-ici-tennis   --statement-id eventbridge-invoke   --action lambda:InvokeFunction   --principal events.amazonaws.com   --source-arn arn:aws:events:${AWS_REGION}:${ACCOUNT_ID}:rule/par-ici-tennis-everyday   --region $AWS_REGION

## Ajouter la Lambda comme target

aws events put-targets   --rule par-ici-tennis-everyday   --targets "Id"="1","Arn"="arn:aws:lambda:${AWS_REGION}:${ACCOUNT_ID}:function:par-ici-tennis"

---

# 6) Coût estimatif

- Exécution ~10 s  
- 3008 MB (~2.94 Go)  
- ≈ 0.0005 $ / run  
- ≈ 0.015 $ / mois (1 run / jour)
