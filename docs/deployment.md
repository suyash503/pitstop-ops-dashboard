# Deployment runbook

Frontend on Vercel, backend on one AWS EC2 instance running the API, Postgres and Caddy under
Docker Compose.

Budget about 90 minutes the first time, including the AWS signup.

---

## The one thing that decides whether this works

Vercel serves the dashboard over **HTTPS**. A browser will refuse to let an HTTPS page call an
`http://<ec2-ip>` API — it is blocked as mixed content, and the WebSocket upgrade fails the same
way. There is no frontend workaround.

So the backend needs a **hostname** and a **certificate**. This runbook uses a free DuckDNS
subdomain pointed at an Elastic IP, with Caddy fetching the certificate from Let's Encrypt on its
own.

Two failure modes to avoid up front:

- **Skipping the Elastic IP.** An EC2 instance's public IP changes every time it stops and starts.
  The DNS record then points at nothing and the site dies quietly, usually days later.
- **Forgetting `CORS_ORIGINS`.** The API rejects the Vercel domain until it is in the allowlist,
  and every request fails with a CORS error that looks like the API is down.

---

## 1. AWS account and EC2 instance

1. Create an AWS account at <https://aws.amazon.com>. A card is required even on the free tier.
2. In the EC2 console, **Launch instance**:
   - **Name**: `pitstop-ops`
   - **AMI**: Ubuntu Server 24.04 LTS
   - **Instance type**: `t3.micro`
   - **Key pair**: create one, download the `.pem`, keep it — it is the only way in
   - **Network settings → Edit** → allow inbound:

     | Type | Port | Source |
     |---|---|---|
     | SSH | 22 | My IP |
     | HTTP | 80 | Anywhere |
     | HTTPS | 443 | Anywhere |

     Port 80 is needed even though everything ends up on 443 — Let's Encrypt validates over it.
   - **Storage**: 16 GiB gp3
3. Launch.

### Allocate an Elastic IP

EC2 → **Elastic IPs** → *Allocate Elastic IP address* → *Associate* it with the instance.
Free while attached to a running instance. Note the address.

---

## 2. Point a hostname at it

1. Sign in at <https://www.duckdns.org> (GitHub login works).
2. Create a subdomain, e.g. `pitstop-ops`.
3. Set its IP to the Elastic IP and click **update**.

Check it resolves before going further:

```bash
nslookup pitstop-ops.duckdns.org
```

---

## 3. Prepare the box

```bash
chmod 400 ~/Downloads/pitstop-ops.pem
ssh -i ~/Downloads/pitstop-ops.pem ubuntu@<ELASTIC_IP>
```

Install Docker:

```bash
sudo apt-get update && sudo apt-get upgrade -y
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker ubuntu
```

Log out and back in so the group membership applies (`exit`, then `ssh` again).

**Add swap.** A `t3.micro` has 1 GB of RAM and is running Node, Postgres and Caddy. Without swap the
Docker build gets OOM-killed partway through:

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
free -h
```

---

## 4. Deploy

```bash
git clone https://github.com/suyash503/pitstop-ops-dashboard.git
cd pitstop-ops-dashboard
cp .env.prod.example .env
nano .env
```

Fill in:

```ini
POSTGRES_PASSWORD=<a long random string>
DOMAIN=pitstop-ops.duckdns.org
LETSENCRYPT_EMAIL=you@example.com
CORS_ORIGINS=http://localhost:3000          # replaced with the Vercel URL in step 6
JWT_SECRET=<paste the output of: openssl rand -base64 48>
```

Build and start:

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

First build takes several minutes. Migrations run automatically on API startup.

**Seed the database — once:**

```bash
docker compose -f docker-compose.prod.yml exec api npm run seed
```

> The seed truncates every table before inserting, which is why it is not part of the startup
> command. Running it again resets the demo to a clean 90-day history.

Verify:

```bash
docker compose -f docker-compose.prod.yml ps
curl https://pitstop-ops.duckdns.org/api/health
```

You want `{"status":"ok","database":"up",...}` over HTTPS with no certificate warning. If the
certificate is not ready yet, check `docker compose -f docker-compose.prod.yml logs caddy` — the
usual causes are DNS not yet propagated or port 80 being blocked.

---

## 5. Frontend on Vercel

1. <https://vercel.com/new> → import `pitstop-ops-dashboard`.
2. **Root Directory**: `apps/web` — this matters. `apps/web` has no workspace dependencies
   precisely so Vercel can build it standalone.
3. Environment variables:

   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_API_URL` | `https://pitstop-ops.duckdns.org/api` |
   | `NEXT_PUBLIC_WS_URL` | `https://pitstop-ops.duckdns.org` |

   Note the `/api` suffix on one and not the other: the REST client prefixes paths with it, while
   Socket.IO connects to the origin and adds its own `/events` namespace.
4. Deploy, and copy the resulting URL.

---

## 6. Close the CORS loop

Back on the EC2 box:

```bash
nano .env      # CORS_ORIGINS=https://<your-app>.vercel.app
docker compose -f docker-compose.prod.yml up -d
```

`CORS_ORIGINS` gates both REST and the WebSocket handshake, so until this is done the dashboard
loads but every request fails.

Add extra origins as a comma-separated list if you want Vercel preview deployments to work too.

---

## 7. Verify end to end

Open the Vercel URL and confirm:

- [ ] Sign in with a demo account
- [ ] KPIs and charts populate
- [ ] The header shows **Live** (not Offline)
- [ ] Browser console is clean — no CORS and no mixed-content errors
- [ ] Network tab shows the socket at **101 Switching Protocols**
- [ ] Statuses tick on their own after a few seconds
- [ ] `https://<domain>/api/docs` loads Swagger
- [ ] Open the same page in two tabs and change a booking status in one — both update
- [ ] Every submitted link opens in a private window

---

## Redeploying

```bash
cd pitstop-ops-dashboard
git pull
docker compose -f docker-compose.prod.yml up -d --build
```

## Operations

```bash
# logs
docker compose -f docker-compose.prod.yml logs -f api
docker compose -f docker-compose.prod.yml logs -f caddy

# restart just the API
docker compose -f docker-compose.prod.yml restart api

# psql
docker compose -f docker-compose.prod.yml exec db psql -U pitstop -d pitstop

# backup / restore
docker compose -f docker-compose.prod.yml exec -T db pg_dump -U pitstop pitstop > backup.sql
cat backup.sql | docker compose -f docker-compose.prod.yml exec -T db psql -U pitstop pitstop

# quieten the simulator without redeploying
# (set SIMULATOR_ENABLED=false in .env, then)
docker compose -f docker-compose.prod.yml up -d api
```

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Certificate never issues | Port 80 closed, or DNS not propagated | Open 80 in the security group; re-check `nslookup` |
| Dashboard loads, all requests fail | Vercel origin missing from `CORS_ORIGINS` | Add it, `up -d` |
| "Mixed content" in console | `NEXT_PUBLIC_API_URL` is `http://` | Must be `https://` |
| Header stuck on Offline | WS URL wrong, or origin not allowed | `NEXT_PUBLIC_WS_URL` has no `/api` suffix; check `CORS_ORIGINS` |
| Build killed partway | Out of memory | Add the swapfile from step 3 |
| Site dies after a reboot | No Elastic IP | Allocate and associate one, update DuckDNS |
| 401 on every request | `JWT_SECRET` changed | Expected — tokens issued under the old secret are invalid; sign in again |
