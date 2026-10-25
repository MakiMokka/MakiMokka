# Worker persistente con Chromium (imagen oficial de Playwright, misma versión que package.json).
FROM mcr.microsoft.com/playwright:v1.63.0-noble
WORKDIR /app
ENV NODE_ENV=production TZ=America/Mexico_City
COPY package.json package-lock.json ./
RUN npm ci --include=dev
COPY tsconfig.json ./
COPY config ./config
COPY src ./src
COPY scripts ./scripts
# Estado local de respaldo (si no hay Supabase) y capturas enmascaradas: montar un volumen aquí.
VOLUME ["/app/state"]
EXPOSE 8080
HEALTHCHECK --interval=60s --timeout=5s CMD node -e "fetch('http://localhost:8080/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["npx", "tsx", "src/worker.ts"]
