FROM node:alpine as base

FROM base as dependencies
WORKDIR /app
COPY ./package-lock.json ./package.json ./
RUN npm install

FROM base as build
WORKDIR /app
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM base as app
WORKDIR /app
COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=build /app/build ./build

CMD ["node", "./build/server.js"]