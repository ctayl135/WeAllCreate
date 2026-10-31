FROM node:24-bookworm-slim
WORKDIR /app
COPY --chown=node:node package.json server.mjs features.mjs backups.mjs restore.mjs preflight.mjs index.html app.js features-ui.js legacy.js site.css weallcreate-logo.png ./
RUN mkdir /app/data && chown node:node /app/data
USER node
ENV PORT=3000 DATABASE_PATH=/app/data/weallcreate.sqlite NODE_ENV=production
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "server.mjs"]
