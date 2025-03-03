FROM node:22-alpine as builder

WORKDIR /app

COPY . /app
COPY tsconfig.json /app/

# Install dependencies and build
RUN --mount=type=cache,target=/root/.npm npm install
RUN npm run build

FROM node:22-alpine AS release

WORKDIR /app

# Create non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

COPY --from=builder /app/dist /app/dist
COPY --from=builder /app/package.json /app/package.json
COPY --from=builder /app/package-lock.json /app/package-lock.json

ENV NODE_ENV=production

# Install only production dependencies
RUN --mount=type=cache,target=/home/appuser/.npm npm ci --omit=dev

# Add healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD node -e "try {require('http').get('http://localhost:3000/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))} catch(e) {process.exit(1)}"

EXPOSE 3000

ENTRYPOINT ["node", "dist/index.js"]