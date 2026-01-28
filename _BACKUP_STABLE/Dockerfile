FROM ghcr.io/puppeteer/puppeteer:latest

USER root

# Variable para saltar la descarga de chromium interna de puppeteer (usamos la de la imagen)
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./

# Instalar dependencias
RUN npm install

# Copiar el resto del código
COPY . .

# Exponer el puerto
EXPOSE 3001

# Comando para iniciar el robot
CMD [ "node", "server/robot.js" ]
