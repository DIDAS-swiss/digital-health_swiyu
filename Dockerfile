# The business application. The generic swiyu components are pulled as
# published images; only this layer is ours to build.
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json tsconfig.json ./
COPY packages/swiyu/package.json packages/swiyu/
COPY apps/demo/package.json apps/demo/
RUN npm ci
COPY packages packages
COPY apps apps
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
COPY packages/swiyu/package.json packages/swiyu/
COPY apps/demo/package.json apps/demo/
RUN npm ci --omit=dev
COPY --from=build /app/packages/swiyu/dist packages/swiyu/dist
COPY --from=build /app/apps/demo/dist apps/demo/dist
COPY apps/demo/public apps/demo/public
EXPOSE 3000
USER node
CMD ["node", "apps/demo/dist/server.js"]
