# Remaining gaps

## Must do before the graduation demo
- **Rehearse once with a real phone microphone** on production, in Arabic and in mixed Arabic/English. All automated voice tests used real speech recordings injected into the browser, not a live microphone.
- **Free-tier AI quotas** (external, no code fix):
  - Speech-to-text: Gemini allows 20 requests per day, then Groq Whisper takes over. Whisper is faster but less accurate on Egyptian Arabic, and on long answers it sometimes writes dialect as formal Arabic.
  - Interviewer: `gpt-oss-120b` and `gpt-oss-20b` have separate daily token limits, then a last-resort model (`qwen/qwen3.8-27b`) takes over. It works in Arabic and English, but its scores can be slightly generous.
  - Avoid heavy testing on demo day, or use a paid Groq or Gemini key.

## Nice to have later
- Live captions on phones (currently desktop Chrome and Edge only). Mobile browsers either beep on every recognition restart (Android) or compete with the recorder for the microphone (iOS).
- Password reset by email (needs an email service). Changing the password while logged in works.
- CI to run `npm test` and `npm run test:e2e` automatically.

## Intentionally out of scope
Admin panel, payments, social features, video interviews, AI avatars, CV builder, gamification, notification center, extra infrastructure.
