# Bağlam DEPO KÖKÜ (bkz. docker-compose.yml): backend `shared` çalışma alanı paketine
# bağımlı ve pnpm workspace linkinin kurulabilmesi için üç package.json da gerekiyor.
FROM node:22-alpine

WORKDIR /uygulama
RUN corepack enable

# Önce yalnız bağımlılık bildirimleri: kaynak değiştiğinde kurulum katmanı yeniden
# çalışmasın. Uzantı paketi kurulmuyor — sunucunun ona hiç ihtiyacı yok.
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json tsconfig.base.json ./
COPY backend/package.json backend/
COPY shared/package.json shared/
RUN pnpm install --frozen-lockfile --filter backend... --prod=false

COPY shared/src shared/src
COPY shared/tsconfig.json shared/
COPY backend/src backend/src
COPY backend/tsconfig.json backend/

ENV NODE_ENV=production
# Yığın tavanı, compose'daki konteyner tavanının (512M) ALTINDA. Verilmezse Node
# tavanı cgroup'tan okumayabiliyor ve süreç sınırı aşıp OOM ile öldürülüyor; oysa
# yığın sınırına çarpıp isteği reddetmek toparlanabilir bir hatadır.
ENV NODE_OPTIONS=--max-old-space-size=384
EXPOSE 3000
# tsx TypeScript'i doğrudan çalıştırıyor: bu sunucu 300 satır ve derleme adımı
# eklemek, okunan kod ile çalışan kod arasına gereksiz bir çeviri sokardı.
CMD ["pnpm", "--filter", "backend", "start"]
