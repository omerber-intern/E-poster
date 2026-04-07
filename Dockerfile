FROM node:20-alpine3.19 AS builder
WORKDIR /app
COPY e-poster/package*.json ./
RUN npm ci
COPY e-poster/ .
RUN npm run build

FROM node:20-alpine3.19 AS runner
WORKDIR /app
RUN addgroup --system --gid 1001 appgroup && \
    adduser --system --uid 1001 -G appgroup appuser

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/data ./data

RUN chown -R appuser:appgroup ./data

USER appuser
EXPOSE 5000
ENV PORT=5000
ENV HOST=0.0.0.0
ENV HOSTNAME=0.0.0.0
CMD ["node", "server.js"]
