# Strangr Production Deployment

This repository includes a single-EC2 production stack for AWS using Docker Compose.

## Stack
- `reverse-proxy`: Caddy with automatic HTTPS
- `frontend`: Vite build served by Nginx
- `backend`: FastAPI + Uvicorn
- `redis`: Redis 7
- `postgres`: external Supabase PostgreSQL

## Files
- `docker-compose.prod.yml`
- `deploy/Caddyfile`
- `deploy/env/frontend.production.env.example`
- `deploy/env/production.env.example`

## One-time EC2 setup
1. Launch an Ubuntu 24.04 EC2 instance.
2. Attach an Elastic IP.
3. Point your domain A record to the Elastic IP.
4. Open AWS Security Group ports:
   - `80/tcp`
   - `443/tcp`
   - `22/tcp` from your IP only
5. Install Docker and Docker Compose plugin on the EC2 host.

## Configure production env
1. Copy `deploy/env/production.env.example` to `deploy/env/production.env`.
2. Copy `deploy/env/frontend.production.env.example` to `deploy/env/frontend.production.env`.
3. Replace in `deploy/env/production.env`:
   - `DOMAIN_NAME`
   - `SECRET_KEY`
   - `GOOGLE_CLIENT_ID`
   - `DATABASE_URL`
   - `SYNC_DATABASE_URL`
4. Replace in `deploy/env/frontend.production.env`:
   - `VITE_API_BASE_URL`
   - `VITE_WS_URL`
   - `VITE_GOOGLE_CLIENT_ID`
   - `VITE_WEBRTC_ICE_SERVERS`

## Deploy
```bash
docker compose --env-file deploy/env/production.env -f docker-compose.prod.yml build
docker compose --env-file deploy/env/production.env -f docker-compose.prod.yml up -d
```

## Run database migrations
```bash
docker compose --env-file deploy/env/production.env -f docker-compose.prod.yml exec backend alembic upgrade head
```

## Verify
- `https://yourdomain.com`
- `https://yourdomain.com/api/health`
- Google login using the production OAuth client
- WebSocket matchmaking over `wss://yourdomain.com/ws/...`
- Video chat with TURN configured
- Backend database connection works against Supabase

## Backup note
This layout uses Supabase for PostgreSQL and keeps Redis on the EC2 machine. Supabase handles the database layer; you still need a host backup plan if Redis persistence matters to you.
