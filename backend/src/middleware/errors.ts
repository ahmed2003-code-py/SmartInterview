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
    res.status(tooLarge ? 413 : 400).json({ error: tooLarge ? "AUDIO_TOO_LARGE" : "UPLOAD_ERROR", message: err.message });
    return;
  }
  console.error(err);
  res.status(500).json({ error: "SERVER_ERROR", message: "Something went wrong" });
};
