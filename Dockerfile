# ---------- build stage ----------
FROM node:22-alpine AS build
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl

# Copy root manifests so Yarn can resolve workspaces
COPY package.json yarn.lock ./

COPY tsconfig.root.json ./

# Copy only the workspaces needed for workers (no tagly-customer / tagly-advertiser)
COPY tagly-backend/package.json tagly-backend/
COPY tagly-shared/models/package.json tagly-shared/models/

# Copy full backend + shared sources so Yarn can link and build
COPY tagly-backend ./tagly-backend
COPY tagly-shared ./tagly-shared

# Install all dependencies (Yarn will link local workspaces)
RUN yarn install --frozen-lockfile
RUN yarn workspace @tagly/models build

# Build the backend
WORKDIR /app/tagly-backend
RUN npx prisma generate
RUN yarn build

# ---------- runtime stage ----------
FROM node:22-alpine
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl

# Copy manifests again for prod install
COPY package.json yarn.lock ./
COPY tagly-backend/package.json tagly-backend/
COPY tagly-shared/models/package.json tagly-shared/models/

# Copy only shared code needed for workspace linking (no RN apps)
COPY tagly-shared ./tagly-shared

# Install production-only deps
RUN yarn install --frozen-lockfile --production

# Copy built tagly-shared/models from build stage (includes dist/)
COPY --from=build /app/tagly-shared/models/dist ./tagly-shared/models/dist

# Switch to backend directory
WORKDIR /app/tagly-backend

# Copy built JS + Prisma client + entrypoint from build stage
COPY --from=build /app/tagly-backend/dist ./dist

COPY tagly-backend/global-bundle.pem ./global-bundle.pem
COPY tagly-backend/ops/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENV NODE_ENV=production
ENTRYPOINT ["/entrypoint.sh"]