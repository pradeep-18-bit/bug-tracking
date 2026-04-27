FROM node:20.19.0-bookworm-slim AS build

WORKDIR /app

COPY . .

RUN npm install

ARG VITE_API_BASE_URL=/api
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ARG VITE_ENABLE_ADMIN_DEFAULT_LOGIN=true
ENV VITE_ENABLE_ADMIN_DEFAULT_LOGIN=$VITE_ENABLE_ADMIN_DEFAULT_LOGIN

RUN npm run build

FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
