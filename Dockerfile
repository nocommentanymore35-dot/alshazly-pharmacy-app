FROM node:22-slim

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install pnpm and dependencies
RUN npm install -g pnpm && pnpm install --frozen-lockfile --prod=false

# Copy source code
COPY . .

# Build the server
RUN pnpm build

# Create uploads directory
RUN mkdir -p uploads

# Expose port
EXPOSE 3000

# Start the server
CMD ["node", "dist/index.js"]
