# Intranet Static Hosting Instructions

## Nginx Configuration

To configure Nginx for static hosting, use the following server block:

```nginx
server {
    listen 80;
    server_name your_domain.com;
    root /path/to/your/static/files;

    index index.html;

    location / {
        try_files $uri $uri/ =404;
    }
}
```

## Apache Configuration

For Apache, enable the `mod_rewrite` module and use the following configuration:

```apache
<VirtualHost *:80>
    ServerName your_domain.com
    DocumentRoot /path/to/your/static/files

    <Directory /path/to/your/static/files>
        Options Indexes FollowSymLinks
        AllowOverride All
        Require all granted
    </Directory>

    RewriteEngine On
    RewriteCond %{REQUEST_FILENAME} !-f
    RewriteCond %{REQUEST_FILENAME} !-d
    RewriteRule ^ /index.html [L]
</VirtualHost>
```

## LocalStorage Notes

- **Chrome**: Should support localStorage without issues.
- **Firefox**: LocalStorage is supported, but can have different limits across contexts.
- **Safari**: Does support localStorage, but with privacy restrictions; ensure third-party cookies are allowed if necessary.
- **Edge**: Similar to Chrome regarding support.

## Optional Subpath Hosting Guidance

If you need to host the application under a subpath (e.g., `/app`), update the routing configuration as follows:

### Nginx

```nginx
location /app {
    alias /path/to/your/static/files;
    try_files $uri $uri/ =404;
}
```

### Apache

```apache
<Directory /path/to/your/static/files/app>
    Options Indexes FollowSymLinks
    AllowOverride All
    Require all granted
</Directory>

RewriteRule ^/app/(.*)$ /app/index.html [L]
```
