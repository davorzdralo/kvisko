FROM node:24-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV WRANGLER_SEND_METRICS=false
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run content:check && npm run typecheck
RUN mkdir -p .wrangler && chown -R node:node /app
USER node
EXPOSE 8080
CMD ["sh", "-c", "npm run db:local && exec npm run dev -- --ip 0.0.0.0"]
