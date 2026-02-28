# par-ici-tennis (*Parisii tennis*)

Based on original project from https://github.com/bertrandda/par-ici-tennis BIG UP!

Script to automatically book a tennis court in Paris (on https://tennis.paris.fr), packaged as an **AWS Lambda container** running on a free-tier eligible schedule via **EventBridge**.

> "Par ici" mean "this way" in french. The "Parisii" were a Gallic tribe that dwelt on the banks of the river Seine. They lived on lands now occupied by the modern city of Paris. The project name can be interpreted as "For a Parisian tennis, follow this way"

**NOTE**: They added a CAPTCHA during reservation process. The latest version **should** pass through. If it fails, open an issue with error logs.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Get started](#get-started)
  - [Configuration](#configuration)
  - [Ntfy notifications (optional)](#ntfy-notifications-optional)
  - [Payment process](#payment-process)
  - [Running](#running)
    - [On your machine](#on-your-machine)
    - [Using AWS Lambda](#using-aws-lambda)

## Prerequisites

- Node.js >= 20.6.x (local runs only)
- Docker >= 20.10
- AWS CLI v2 configured with an IAM user
- A "carnet de réservation" in your Paris Tennis account (see [Payment process](#payment-process))

## Get started

### Configuration

Create `config.json` file from `config.json.sample` and complete with your preferences.

- `location`: a list of courts ordered by preference - [full list](https://tennis.paris.fr/tennis/jsp/site/Portal.jsp?page=tennisParisien&view=les_tennis_parisiens)

You can use two formats for the `locations` field:

1) **Array format:**
  ```json
  "locations": [
    "Valeyre",
    "Suzanne Lenglen",
    "Poliveau"
  ]
  ```
  Use this if you want to search all courts at each location, in order of preference.

2) **Object format (with court numbers):**
  ```json
  "locations": {
    "Suzanne Lenglen": [5, 7, 11],
    "Henry de Montherlant": []
  }
  ```
  Use this if you want to specify court numbers for each location. An empty array means all courts at that location will be considered.

- `date` (optional): a string representing a date formatted `D/M/YYYY`. Omit to automatically book 6 days in the future when slots open.

- `hours`: a list of hours ordered by preference

- `priceType`: an array containing price type you can book — `Tarif plein` and/or `Tarif réduit`

- `courtType`: an array containing court type — `Découvert` and/or `Couvert`

- `players`: list of additional players, 3 max (not including you)

### Ntfy notifications (optional)

You can configure the script to send notifications via [ntfy](https://ntfy.sh), a simple pub-sub notification service.

Three notification types are sent:
- **Reservation confirmed** — with the `.ics` calendar file attached
- **No slot available** — simple alert when no court was found for the day
- **Error** — with a screenshot attached if the script crashes

To receive notifications:
- Choose a unique topic name (e.g., `YOUR-UNIQUE-TOPIC-NAME` — pick something hard to guess, there is no password for subscription)
- Subscribe using the [ntfy mobile app](https://ntfy.sh/docs/subscribe/phone/) or [web interface](https://ntfy.sh/)

Add the following to your `config.json`:

```json
"ntfy": {
  "enable": true,
  "topic": "YOUR-UNIQUE-TOPIC-NAME"
}
```

Options:
- `enable`: set to `true` to enable notifications
- `topic`: your unique ntfy topic name
- `domain` (optional): custom ntfy server domain (`ntfy.sh` used if not set)

![Notification example](doc/ntfy.png)

### Payment process

To pass the payment phase you need a "carnet de réservation". Make sure it matches your `priceType` & `courtType` [combination](https://tennis.paris.fr/tennis/jsp/site/Portal.jsp?page=rate&view=les_tarifs).

### Running

#### On your machine

Install dependencies:

```sh
npm install
```

Run the script:

```sh
npm start
```

Test your configuration without making a real reservation (dry-run):

```sh
npm run start-dry
```

You can automate it locally using cron or equivalent.

---

#### Using AWS Lambda

This fork is optimised to run as an **AWS Lambda container image** on `arm64` (Graviton), scheduled daily via **EventBridge**. Estimated cost: ~$0/month within AWS free tier.

##### Architecture

| Component | Role |
|---|---|
| Amazon ECR | Stores the Docker container image |
| AWS Lambda (arm64) | Runs the Playwright script on schedule |
| SSM Parameter Store | Stores `config.json` securely |
| Amazon EventBridge | Triggers Lambda daily at a configured time |

##### 1. Build the image

For **Lambda deployment** (arm64):
```sh
docker build --platform linux/arm64 --provenance=false -t par-ici-tennis:lambda .
```

For **local testing** (amd64, no QEMU slowdown):
```sh
docker build --platform linux/amd64 --provenance=false --build-arg ARCH=x86_64 -t par-ici-tennis:lambda-local .
```

##### 2. Test locally with the Lambda Runtime Interface Emulator

```sh
docker run --rm -p 7000:8080 \
  -v "$(pwd -W)/config.json:/var/task/config.json:ro" \
  -v "$(pwd -W)/out:/var/task/out" \
  -v "$(pwd -W)/img:/var/task/img" \
  -e HEADLESS=true \
  --shm-size=1g \
  par-ici-tennis:lambda-local
```

Then invoke in a second terminal:
```sh
curl -X POST "http://localhost:7000/2015-03-31/functions/function/invocations" -d '{}'
```

> Logs appear in the `docker run` terminal, not in the `curl` response.

##### 3. Upload config to SSM Parameter Store

```sh
MSYS_NO_PATHCONV=1 aws ssm put-parameter \
  --name "/par-ici-tennis/config" \
  --type "String" \
  --value "$(cat config.json)" \
  --overwrite \
  --region eu-west-3
```

##### 4. Push to ECR

```sh
AWS_REGION=eu-west-3
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
REPO=par-ici-tennis-lambda

aws ecr create-repository --repository-name $REPO --region $AWS_REGION || true

MSYS_NO_PATHCONV=1 aws ecr get-login-password --region $AWS_REGION \
  | docker login --username AWS --password-stdin ${ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com

docker tag par-ici-tennis:lambda ${ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/$REPO:latest
docker push ${ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/$REPO:latest
```

##### 5. Create the Lambda function

First, create an IAM execution role `par-ici-tennis-lambda-role` in the AWS Console with:
- Managed policy: `AWSLambdaBasicExecutionRole`
- Inline policy for SSM access:
```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": ["ssm:GetParameter"],
    "Resource": "arn:aws:ssm:eu-west-3:<ACCOUNT_ID>:parameter/par-ici-tennis/*"
  }]
}
```

Then create the function:
```sh
MSYS_NO_PATHCONV=1 aws lambda create-function \
  --function-name par-ici-tennis \
  --package-type Image \
  --code ImageUri=${ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/$REPO:latest \
  --role arn:aws:iam::<ACCOUNT_ID>:role/par-ici-tennis-lambda-role \
  --architectures arm64 \
  --timeout 120 \
  --memory-size 1536 \
  --region $AWS_REGION

MSYS_NO_PATHCONV=1 aws lambda update-function-configuration \
  --function-name par-ici-tennis \
  --environment "Variables={CONFIG_SSM_PARAM=/par-ici-tennis/config,HEADLESS=true}" \
  --region $AWS_REGION
```

##### 6. Schedule with EventBridge

```sh
# Trigger every day at 06:00 UTC (08:00 Paris time)
MSYS_NO_PATHCONV=1 aws events put-rule \
  --name par-ici-tennis-everyday \
  --schedule-expression "cron(0 6 * * ? *)" \
  --region $AWS_REGION

MSYS_NO_PATHCONV=1 aws lambda add-permission \
  --function-name par-ici-tennis \
  --statement-id eventbridge-invoke \
  --action lambda:InvokeFunction \
  --principal events.amazonaws.com \
  --source-arn arn:aws:events:${AWS_REGION}:${ACCOUNT_ID}:rule/par-ici-tennis-everyday \
  --region $AWS_REGION

MSYS_NO_PATHCONV=1 aws events put-targets \
  --rule par-ici-tennis-everyday \
  --targets "Id"="1","Arn"="arn:aws:lambda:${AWS_REGION}:${ACCOUNT_ID}:function:par-ici-tennis" \
  --region $AWS_REGION
```

##### Redeploy after code changes

```sh
docker build --platform linux/arm64 --provenance=false -t par-ici-tennis:lambda .
docker tag par-ici-tennis:lambda ${ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/$REPO:latest
docker push ${ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/$REPO:latest

MSYS_NO_PATHCONV=1 aws lambda update-function-code \
  --function-name par-ici-tennis \
  --image-uri ${ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/$REPO:latest \
  --region $AWS_REGION
```

##### Estimated cost

| Config | Cost/run | Cost/month (1×/day) |
|---|---|---|
| 1536 MB, ~50s | ~$0.001 | ~$0.03 |

> Runs within the AWS Lambda free tier (400,000 GB-seconds/month).

## License

MIT
