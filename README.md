# بوابة تراث آل واصل / Al-Waili Heritage Portal

بوابة الأسرة: صفحات عامة (الأخبار، التراث، عن الأسرة) ومنطقة الأعضاء (المشجرة، المهام، التواصل، الإدارة).
الدخول بالبريد الإلكتروني وكلمة المرور، والدعوات عبر رابط تفعيل.

Family portal: public pages plus a members area. Sign-in is by email and password with invite activation.

الموقع / Live: https://al-waili-heritage-portal.al-waili.workers.dev

## البناء / Build

المتطلبات / Requirements: Node >= 22.13, npm.

1. أنشئ الملف المحلي `.hosting/config.json` (غير مرفوع في Git) بالمحتوى:
   Create the local file `.hosting/config.json` (git-ignored) containing:
   `{"d1":"DB"}`
2. `npm run install:ci`
3. `npm run build`
4. للنشر على Cloudflare: عدّل `dist/server/wrangler.json` ليحمل اسم العامل `al-waili-heritage-portal` وقاعدة D1 `al-waili-portal-d1` (المعرّف في لوحة Cloudflare)، ثم:
   For Cloudflare, set the worker name and the D1 database in `dist/server/wrangler.json`, then:
   `npx wrangler deploy --config dist/server/wrangler.json`

## الأسرار / Secrets

لا توجد أسرار في المستودع. تُضبط في Cloudflare كأسرار للعامل: `OWNER_EMAIL` وإعدادات البريد (Brevo).
No secrets are stored in this repo. Set `OWNER_EMAIL` and the mail (Brevo) key as Cloudflare worker secrets.

## الاختبارات / Tests

`npm run test:qa`
