FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

RUN npm install http-server -g

EXPOSE 80

CMD ["http-server", "-p", "80", "-c-1"]
