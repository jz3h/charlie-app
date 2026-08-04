FROM node:20-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --only=production
COPY server.js public/ ./
EXPOSE 4000
CMD [node, server.js]
