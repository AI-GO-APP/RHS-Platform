# Stage 1: Vite 建置（VITE_ 變數透過 build args 注入）
FROM node:20-alpine AS builder
WORKDIR /app

# 接收 build args（可從 docker-compose 的 .env 注入）
ARG VITE_AIGO_APP_SLUG=6d767888869d
ARG VITE_AIGO_API_BASE=https://ai-go.app/api/v1
ARG VITE_APP_DOMAIN=rhs-platform

# 安裝相依套件
COPY package*.json ./
RUN npm install --ignore-scripts

# 複製所有專案檔案
COPY . .

# Vite 會自動讀取 ARG 中的 VITE_* 變數
RUN npm run build

# Stage 2: Nginx 反向代理 + 靜態檔案
FROM nginx:alpine

# 使用 Nginx 官方 template 機制：
# 啟動時自動將 /etc/nginx/templates/*.template 中的環境變數替換後
# 輸出至 /etc/nginx/conf.d/*.conf
# NGINX_ENVSUBST_FILTER 限制只替換 AIGO 開頭的變數，
# 避免覆蓋 Nginx 原生變數（$uri, $host 等）
ENV NGINX_ENVSUBST_FILTER=AIGO

COPY nginx.conf /etc/nginx/templates/default.conf.template
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80
