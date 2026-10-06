# Local demo image only. Not a hosted auth service and not a Walrus writer.
FROM node:20-alpine
WORKDIR /app
COPY . .
ENV NODE_ENV=development
EXPOSE 8788
CMD ["node", "apps/cli/vow-http.mjs"]
