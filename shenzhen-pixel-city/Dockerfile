# Stage 1: Build
FROM node:22-alpine AS builder
WORKDIR /app

# Copy package files and patches (patches needed before pnpm install)
COPY package.json pnpm-lock.yaml* ./
COPY patches/ ./patches/
RUN npm install -g pnpm && pnpm install --frozen-lockfile

# Copy source
COPY . .

# Build the Vite app (outputs to dist/public/)
RUN pnpm run build

# Stage 2: Serve with Nginx
FROM nginx:alpine

# Copy built assets
COPY --from=builder /app/dist/public /usr/share/nginx/html

# Write nginx config template (uses $PORT env var via envsubst at runtime)
COPY nginx.conf.template /etc/nginx/nginx.conf.template

# Install envsubst (part of gettext)
RUN apk add --no-cache gettext

# Railway sets PORT env var
ENV PORT=8080
EXPOSE 8080

# Substitute PORT in nginx config at container start, then launch nginx
CMD ["/bin/sh", "-c", "envsubst '$PORT' < /etc/nginx/nginx.conf.template > /etc/nginx/conf.d/default.conf && nginx -g 'daemon off;'"]
