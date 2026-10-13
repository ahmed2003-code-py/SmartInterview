# Remaining gaps

## Must fix before the graduation demo
- **Rehearse once with a real phone microphone** on production, in Arabic and in mixed Arabic/English. All automated voice tests used real speech recordings injected into the browser, not a live microphone.
- **AI free-tier quotas.**
  - Gemini speech-to-text: 20 requests per day. After that, Groq Whisper is used automatically: faster, but less accurate on Egyptian Arabic.
  - Groq interviewer model: 200K tokens per day. After that, a smaller fallback model is used automatically.
  - Avoid heavy testing on demo day, or use a paid key.

## Nice to have later
- Live captions on phones: currently desktop Chrome and Edge only. Mobile browsers either beep on every recognition restart (Android) or compete with the recorder for the microphone (iOS).
- Automated tests in the repository with CI. The current Playwright checks live outside the repository.
- Password reset by email. This needs an email service; changing the password while logged in works.

## Intentionally out of scope
Admin panel, payments, social features, video interviews, AI avatars, CV builder, gamification, notifications center, extra infrastructure (Redis, queues, microservices).
