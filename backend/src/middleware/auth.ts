import type { RequestHandler, Response } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config.js";
import { HttpError } from "./errors.js";

export const AUTH_COOKIE = "isim_token";
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

export function setAuthCookie(res: Response, userId: string) {
  const token = jwt.sign({ sub: userId }, config.jwtSecret, { expiresIn: "7d" });
  res.cookie(AUTH_COOKIE, token, { httpOnly: true, sameSite: "lax", secure: config.isProd, maxAge: MAX_AGE_MS });
}

export function clearAuthCookie(res: Response) {
  res.clearCookie(AUTH_COOKIE);
}

export const requireAuth: RequestHandler = (req, _res, next) => {
  const token = req.cookies?.[AUTH_COOKIE];
  if (!token) throw new HttpError(401, "UNAUTHENTICATED", "Please log in");
  try {
    const payload = jwt.verify(token, config.jwtSecret) as jwt.JwtPayload;
    req.userId = payload.sub;
    next();
  } catch {
    throw new HttpError(401, "UNAUTHENTICATED", "Session expired");
  }
};
