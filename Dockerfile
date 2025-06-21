FROM node:18-alpine

WORKDIR /app
COPY . .

RUN corepack enable && corepack prepare pnpm@latest --activate

RUN pnpm install --force --no-frozen-lockfile
RUN pnpm run build

CMD ["pnpm", "start"]
