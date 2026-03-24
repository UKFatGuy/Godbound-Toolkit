# Deployment Guide

This guide covers running and deploying the Godbound Toolkit server, which provides both the static app and the REST persistence API.

## Local Development

```bash
git clone https://github.com/UKFatGuy/Godbound-Toolkit.git
cd Godbound-Toolkit
npm ci
npm start
```

Open `http://localhost:3000`.

The server creates `data/appdata.json` automatically on first run. To use a different port:

```bash
PORT=8080 npm start
```

---

## Docker

### Build and run

```bash
# Build the image
docker build -t godbound-toolkit .

# Run with a named volume for persistent data
docker run --rm -p 3000:3000 -v godbound_data:/app/data godbound-toolkit
```

### docker compose (recommended for persistent deployments)

```bash
docker compose up --build
```

Stop without removing data:

```bash
docker compose down
```

Stop and **remove** the data volume:

```bash
docker compose down -v
```

### Persisting data

All app data is stored in `/app/data/appdata.json` inside the container. To persist it, mount a Docker volume or a host directory to `/app/data`.

| Method | docker run flag |
|---|---|
| Named volume (recommended) | `-v godbound_data:/app/data` |
| Bind mount | `-v /host/path/to/data:/app/data` |

### Changing the port

```bash
# docker run
docker run --rm -p 8080:8080 -e PORT=8080 -v godbound_data:/app/data godbound-toolkit

# docker compose – create a .env file in the project root:
# PORT=8080
docker compose up --build
```

---

## Static hosting (Nginx / Apache)

> **Note:** Serving as a plain static site bypasses the Node server and its REST persistence API. Data will be stored in browser `localStorage` only. For cross-browser / shared persistence, use the Node server or Docker deployment above.

### Nginx

```nginx
server {
    listen 80;
    server_name your_domain.com;
    root /path/to/Godbound-Toolkit;

    index index.html;

    location / {
        try_files $uri $uri/ =404;
    }
}
```

### Apache

```apache
<VirtualHost *:80>
    ServerName your_domain.com
    DocumentRoot /path/to/Godbound-Toolkit

    <Directory /path/to/Godbound-Toolkit>
        Options Indexes FollowSymLinks
        AllowOverride All
        Require all granted
    </Directory>
</VirtualHost>
```

### Subpath hosting

If hosting under a subpath (e.g. `/app`):

**Nginx**

```nginx
location /app {
    alias /path/to/Godbound-Toolkit;
    try_files $uri $uri/ =404;
}
```

**Apache**

```apache
Alias /app /path/to/Godbound-Toolkit
<Directory /path/to/Godbound-Toolkit>
    Options Indexes FollowSymLinks
    AllowOverride All
    Require all granted
</Directory>
```

---

## CI/CD (GitHub Actions)

The repository includes a workflow at `.github/workflows/deploy.yml` that automatically builds and deploys the app on every push to `main` and on version tags (`v*.*.*`).

### How it works

1. **Build** – GitHub Actions builds a multi-arch Docker image using Docker Buildx (with QEMU for cross-compilation) targeting `linux/amd64`, `linux/arm64`, `linux/arm/v7`, and `linux/arm/v6`.
2. **Push** – The image is published to **GitHub Container Registry (GHCR)**:
   - `ghcr.io/ukfatguy/godbound-toolkit:latest` – updated on every `main` push
   - `ghcr.io/ukfatguy/godbound-toolkit:sha-<full-sha>` – every build, for traceability
   - `ghcr.io/ukfatguy/godbound-toolkit:<tag>` – e.g. `v1.2.3`, on git tag pushes
3. **Deploy** – After the image is pushed, Actions SSHes into the target server and runs:
   ```bash
   docker compose pull
   docker compose up -d
   docker image prune -f   # remove unused images to free disk space
   ```

### Required repository secrets

Configure these in **Repo Settings → Secrets and variables → Actions**:

| Secret | Description |
|---|---|
| `DEPLOY_HOST` | Hostname or IP address of the target server |
| `DEPLOY_USER` | SSH username on the target server |
| `DEPLOY_SSH_KEY` | Private SSH key (ed25519 recommended) authorised on the server |
| `DEPLOY_PATH` | Absolute path on the server containing `docker-compose.yml` (e.g. `/opt/godbound-toolkit`) |
| `DEPLOY_PORT` | *(optional)* SSH port – defaults to `22` when omitted |

### Server-side `docker-compose.yml`

The server only needs a `docker-compose.yml` that references the GHCR image. It does **not** need a copy of the repository source code.

```yaml
services:
  godbound:
    image: ghcr.io/ukfatguy/godbound-toolkit:latest
    container_name: godbound-toolkit
    restart: unless-stopped
    ports:
      - "${PORT:-3000}:${PORT:-3000}"
    environment:
      - PORT=${PORT:-3000}
    volumes:
      - godbound_data:/app/data

volumes:
  godbound_data:
```

> **Note:** If the GHCR package is private, log in to GHCR on the server once before the first deployment:
> ```bash
> docker login ghcr.io -u <github-username>
> # enter a GitHub PAT with `read:packages` scope when prompted
> ```

### Persistent data volume

All application data lives in `/app/data/appdata.json` inside the container. The `godbound_data` named volume is mounted at `/app/data`, so data is preserved across every `docker compose pull` + `docker compose up -d` update cycle. **Never use `docker compose down -v`** on the server unless you intentionally want to wipe the data.

---

## Browser localStorage notes

- **Chrome / Edge**: full `localStorage` support.
- **Firefox**: supported; storage limits may vary.
- **Safari**: supported, but privacy settings may restrict storage in some contexts.
