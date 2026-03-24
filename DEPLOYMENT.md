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

## Browser localStorage notes

- **Chrome / Edge**: full `localStorage` support.
- **Firefox**: supported; storage limits may vary.
- **Safari**: supported, but privacy settings may restrict storage in some contexts.
