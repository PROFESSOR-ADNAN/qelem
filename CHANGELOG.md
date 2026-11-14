# Changelog

## 1.0.0 (2026-11-14)


### Features

* add Render blueprint, Chapa Ethiopian payment integration, and cross-domain hosting support ([a54a915](https://github.com/PROFESSOR-ADNAN/qelem/commit/a54a915ed64fa0fdd449cc93034ce33477225d43))
* **auth:** add Ethiopian Phone SMS OTP verification via AfroMessage and dual verification hub ([25cd1c8](https://github.com/PROFESSOR-ADNAN/qelem/commit/25cd1c81f708855249d575b3ba5dddb4ba9fcf16))
* **auth:** complete end-to-end email verification flow with Gmail SMTP and VerifyEmailPage ([80fb433](https://github.com/PROFESSOR-ADNAN/qelem/commit/80fb433a0d47e67cffbbad42f1bd486436117533))
* enable inline BullMQ worker spawning for single-service free tier hosting ([32586ea](https://github.com/PROFESSOR-ADNAN/qelem/commit/32586ea6d270163df6c0be860f55ea8493f7ebbc))
* initial commit of Qelem production platform ([16fcf26](https://github.com/PROFESSOR-ADNAN/qelem/commit/16fcf2641ac2784a1ca5af8f5cdca6a4ebef92fe))
* normalize REDIS_URI/REDIS_URL aliases and optimize Upstash connection ([967798d](https://github.com/PROFESSOR-ADNAN/qelem/commit/967798d6374586a0411f580a7cbe16c3b873f7af))
* **portfolio:** complete all 20 production enhancements including Chapa tipping, PWA banner, image lightbox, syntax highlighting, Redis feed caching, and digest worker ([9dd8dcd](https://github.com/PROFESSOR-ADNAN/qelem/commit/9dd8dcdecf3934f4381fe3dc5aa962ccf9b9f863))
* **portfolio:** implement 1-click demo guest login, telemetry health check, OpenAPI docs, and architecture visualizer ([c9a4b13](https://github.com/PROFESSOR-ADNAN/qelem/commit/c9a4b134f2fffd01291fcf57ee94c6464465d1ea))
* **ui:** add immediate check-your-inbox screen on registration and persistent verification banner ([19544be](https://github.com/PROFESSOR-ADNAN/qelem/commit/19544bedd4eaca8f036a99d80a3236b8120966d4))


### Bug Fixes

* **branding:** replace legacy museum branding with Qelem across environment config ([7fefaea](https://github.com/PROFESSOR-ADNAN/qelem/commit/7fefaea5ab335fa514a4e716772fac3ef44cfcb5))
* **build:** add @types/node to shared dependencies and enable --include=dev on Render ([b599668](https://github.com/PROFESSOR-ADNAN/qelem/commit/b5996685d7a018a54f2746bfe61f5a6f61de6794))
* **composer:** bypass email verification in mock/mailpit, alias CORS_ORIGIN, and implement outbox auto-sync ([e2d5714](https://github.com/PROFESSOR-ADNAN/qelem/commit/e2d571443ad6df8d96700da7419201608a7e2a5f))
* **email:** update sender and replyTo to iam.professor.adnan@gmail.com ([f7200b6](https://github.com/PROFESSOR-ADNAN/qelem/commit/f7200b63014ad4fc4b013256724399bbcf2e763b))
* **redis:** guard connectRedis against pre-connected state and enhance startup error logging ([b3f4022](https://github.com/PROFESSOR-ADNAN/qelem/commit/b3f4022703a44240bf8dc537408fd857a857bbd5))


### Performance Improvements

* **auth:** dispatch verification emails in background for instant registration and fast redirect ([5902509](https://github.com/PROFESSOR-ADNAN/qelem/commit/59025097824dfe1fae44e2891016af888ac4c616))
