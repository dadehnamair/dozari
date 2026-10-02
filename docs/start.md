# در MySQL

CREATE DATABASE dozari CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'dozari'@'%' IDENTIFIED BY 'dozari';
GRANT ALL ON dozari.\* TO 'dozari'@'%';

cp .env.example .env

# در .env این را هم اضافه کن: CORS_ORIGIN=\*

pnpm install
pnpm --filter @dozari/db db:migrate # همه‌ی مایگریشن‌ها تا ۰۰۲۸
pnpm --filter @dozari/db seed
pnpm --filter @dozari/db images:upload
pnpm --filter @dozari/db demo:puzzle # یک پازل آزمایشی ساختگی، فقط برای تست
