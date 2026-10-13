// Deterministic test environment: demo AI (no external calls) and the local development database.
process.env.MOCK_AI = "true";
process.env.NODE_ENV = "test";
process.env.JWT_SECRET ??= "test-secret-not-used-in-production";
process.env.DATABASE_URL ??= "postgresql://interview:interview@localhost:5436/interview_sim";
