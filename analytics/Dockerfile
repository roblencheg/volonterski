FROM node:24-alpine
WORKDIR /app
COPY --chown=node:node server.mjs dashboard.html ./
RUN mkdir -p /data && chown node:node /data
ENV NODE_ENV=production PORT=3090 DATA_FILE=/data/analytics.sqlite
USER node
EXPOSE 3090
CMD ["node", "server.mjs"]
