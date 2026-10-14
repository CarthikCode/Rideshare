FROM node:24-alpine

# Built-in PostgreSQL so the demo runs with zero external services.
# If DATABASE_URL is provided at runtime, it is used instead.
RUN apk add --no-cache postgresql postgresql-client su-exec

WORKDIR /app/backend

COPY backend/package*.json ./
RUN npm install --omit=dev --no-audit --no-fund

COPY backend/ ./
RUN npx prisma generate && npm cache clean --force

COPY frontend/ /app/frontend/
COPY docker/start.sh /app/docker/start.sh
RUN chmod +x /app/docker/start.sh

ENV NODE_ENV=production
ENV PORT=5000

EXPOSE 5000

CMD ["/bin/sh", "/app/docker/start.sh"]
