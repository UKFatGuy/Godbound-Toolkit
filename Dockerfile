FROM node:20-alpine

WORKDIR /app

# Install dependencies first for better layer caching
COPY package*.json ./
RUN npm ci --omit=dev

# Copy application files
COPY index.html ./
COPY server.js ./
COPY css/ ./css/
COPY js/ ./js/

ENV NODE_ENV=production
ENV PORT=3000

# Ensure the data directory exists (server also creates it, but this guarantees it)
RUN mkdir -p /app/data

EXPOSE 3000

CMD ["npm", "start"]
