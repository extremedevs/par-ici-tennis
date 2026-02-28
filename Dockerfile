# Image de base Lambda Node.js 20 (Amazon Linux 2023)
# ARCH=arm64 pour Lambda, ARCH=x86_64 pour test local amd64
ARG ARCH=arm64
FROM public.ecr.aws/lambda/nodejs:20-${ARCH}

# ====== ENV généraux ======
ENV NODE_ENV=production \
    TZ=Europe/Paris \
    # Playwright: répertoire browsers + éviter re-download si pas nécessaire
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright \
    PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=0 \
    # Zscaler: faire respecter le bundle CA système
    NODE_EXTRA_CA_CERTS=/etc/ssl/certs/ca-bundle.crt \
    # (optionnel) tolère la validation hôte sous proxy MITM si nécessaire
    PLAYWRIGHT_SKIP_VALIDATE_HOST_CERTS=true

# Répertoire Lambda
WORKDIR ${LAMBDA_TASK_ROOT}

# ====== Ajouter le CA Zscaler & mettre à jour les CAs système ======
COPY ZscalerRootCA.crt /etc/pki/ca-trust/source/anchors/ZscalerRootCA.crt
# Amazon Linux 2023 met automatiquement à jour le bundle CA
# (aucune commande supplémentaire n'est nécessaire)
RUN microdnf clean all


# ====== Dépendances système pour Chromium headless ======
# (AL2023 → dnf/microdnf ; paquetage minimal)
RUN dnf -y install \
      ca-certificates \
      at-spi2-atk \
      atk \
      cairo \
      pango \
      cups-libs \
      libdrm \
      libXcomposite \
      libXdamage \
      libXfixes \
      libXrandr \
      libxcb \
      libX11 \
      libxkbcommon \
      alsa-lib \
      mesa-libgbm \
      mesa-libEGL \
      nss \
      liberation-fonts \
    && update-ca-trust && dnf clean all

# ====== Manifeste NPM + install (prod) ======
COPY package*.json ./
# Désactive les scripts pour éviter le postinstall playwright côté npm : on contrôle l’install nous-mêmes
RUN npm ci --omit=dev --ignore-scripts

# ====== Installer Playwright + Chromium uniquement ======
# Playwright téléchargera Chromium ARM64 compatible AL2023
RUN npx playwright install chromium

# ====== Code applicatif ======
# (n'ajoute PAS node_modules une 2e fois)
COPY index.js ./index.js
COPY lambda.js ./lambda.js
COPY lib ./lib
COPY scripts ./scripts
COPY staticFiles.js ./staticFiles.js

# Crée des dossiers pour artefacts (écrira en /tmp à l’exécution, mais on garde ces rep pour compat)
RUN mkdir -p /var/task/out /var/task/img && npm cache clean --force

# ====== Commande: handler Lambda Node.js ======
# On expose un handler "lambda.handler" (voir étape 3)
CMD [ "lambda.handler" ]