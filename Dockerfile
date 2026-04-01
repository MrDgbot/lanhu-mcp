FROM node:20-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --production=false

COPY tsconfig.json ./
COPY src/ src/

RUN npm run build && npm prune --production

RUN mkdir -p /app/data

EXPOSE 8000

CMD ["node", "dist/server.js"]
