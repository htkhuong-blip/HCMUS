FROM node:24-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=secret,id=proxy_ca,required=false \
    if [ -f /run/secrets/proxy_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/proxy_ca; fi; \
    npm ci --omit=dev --cache /tmp/heritage-npm-cache \
    && rm -rf /tmp/heritage-npm-cache \
    && command -v su \
    && mkdir -p /var/lib/heritage/uploads /var/lib/heritage/backups \
    && chown -R node:node /var/lib/heritage
COPY server.js features.js ./
COPY public ./public
COPY docs ./docs
COPY scripts/snapshot.mjs ./scripts/snapshot.mjs
COPY deploy/container-entrypoint.sh /usr/local/bin/heritage-entrypoint
RUN chmod -R a+rX /app && chmod 755 /usr/local/bin/heritage-entrypoint
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000 \
    DB_PATH=/var/lib/heritage/heritage.db \
    UPLOAD_DIR=/var/lib/heritage/uploads \
    BACKUP_DIR=/var/lib/heritage/backups
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
ENTRYPOINT ["/usr/local/bin/heritage-entrypoint"]
