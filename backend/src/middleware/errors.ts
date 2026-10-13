import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import multer from "multer";

/** An error whose message is safe to show the user. */
export class HttpError extends Error {
  constructor(public status: number, public code: string, message?: string) {
    super(message ?? code);
  }
}

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.code, message: err.message });
    return;
  }
  if (err instanceof ZodError) {
    res.status(400).json({ error: "VALIDATION_ERROR", message: err.issues[0]?.message ?? "Invalid input", issues: err.issues.map((i) => ({ path: i.path.join("."), message: i.message })) });
    return;
  }
  if (err instanceof multer.MulterError) {
    const tooLarge = err.code === "LIMIT_FILE_SIZE";
    res.status(tooLarge ? 413 : 400).json({ error: tooLarge ? "FILE_TOO_LARGE" : "UPLOAD_ERROR", message: tooLarge ? "File is too large" : "Upload failed" });
    return;
  }
  // Malformed or oversized JSON bodies (body-parser errors) are the client's fault, not a crash.
  const type = (err as { type?: string })?.type;
  if (type === "entity.parse.failed") {
    res.status(400).json({ error: "INVALID_JSON", message: "Malformed request" });
    return;
  }
  if (type === "entity.too.large") {
    res.status(413).json({ error: "PAYLOAD_TOO_LARGE", message: "Request is too large" });
    return;
  }
  // Log the error type and first line only: database errors can echo query values (answers, CV text).
  console.error("Unhandled error", err instanceof Error ? `${err.name}: ${err.message.split("\n")[0].slice(0, 200)}` : typeof err);
  res.status(500).json({ error: "SERVER_ERROR", message: "Something went wrong" });
};
