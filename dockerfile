FROM node:20-alpine AS deps

WORKDIR /app

COPY package*.json ./

RUN npm ci --omit=dev

FROM node:20-alpine AS runner

WORKDIR /app

COPY .env.production ./.env.production

ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules

COPY src ./src

EXPOSE 8000

CMD ["node", "src/index.js"]