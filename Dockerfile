# ============================================================
# PRODUCTION MULTI-STAGE DOCKERFILE: ATOM QMS
# ============================================================

# Stage 1: Build React Frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Production Runtime
FROM node:20-alpine AS runner
WORKDIR /app

# Install PM2 globally for process clustering
RUN npm install -g pm2

# Install backend production dependencies
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm install --omit=dev

# Copy backend source & built frontend
COPY backend/ ./
COPY --from=frontend-builder /app/dist ../dist
COPY ecosystem.config.cjs ../ecosystem.config.cjs

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5001

EXPOSE 5001

# Health check
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:5001/api/health || exit 1

# Start via PM2 cluster mode across CPU cores
CMD ["pm2-runtime", "start", "ecosystem.config.cjs"]
