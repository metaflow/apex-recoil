# Deploy a code

1. `npm run static`

2.  scp -r -i <id_rsa> .\static\* root@46.101.102.179:/var/www/html

# Update domains

1. edit /etc/nginx/sites-enabled/default
add section

```
server {
    root /var/www/html;
    index index.html index.htm index.nginx-debian.html;
    server_name apexlegendsrecoils.net;
    gzip on;
    gzip_types text/plain application/xml application/javascript text/css audio/mpeg image/png;

    location / {
        # First attempt to serve request as file, then
        # as directory, then fall back to displaying a 404.
        try_files $uri $uri/ =404;
    }
    location ~ ^/ru/?$ {
       rewrite ^/ru/?(.*)$ /$1 break;
       index index-ru.html;
       try_files $uri $uri/ =404;
    }
    location ~ ^/zh-CN/?$ {
       rewrite ^/zh-CN/?(.*)$ /$1 break;
       index index-zh-CN.html;
       try_files $uri $uri/ =404;
    }
    listen 80;
}
```

2. run `nginx -t` to test and `systemctl restart nginx`

3. check that http://apexlegendsrecoils.net/ is available

4. run `certbot --nginx` and select new domain