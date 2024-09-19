FROM nginx:alpine

COPY nginx.conf /etc/nginx/nginx.conf
COPY certs/secure-chat.crt /etc/ssl/certs/secure-chat.crt
COPY certs/secure-chat.key /etc/ssl/private/secure-chat.key
COPY html /usr/share/nginx/html
