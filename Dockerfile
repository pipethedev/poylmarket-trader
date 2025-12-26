FROM node:20

WORKDIR /usr/src/app

RUN corepack enable && corepack prepare pnpm --activate

COPY package.json pnpm-lock.yaml ./

RUN pnpm install --frozen-lockfile

COPY . .

RUN pnpm run build

EXPOSE 3000

CMD ["node", "dist/main"]