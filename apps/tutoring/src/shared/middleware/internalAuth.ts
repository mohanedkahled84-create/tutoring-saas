import { Request, Response, NextFunction } from "express";
import { config } from "../config/index.js";

export function authenticateInternalSecret(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing or invalid Authorization header" });
    return;
  }

  const token = authHeader.split(" ")[1];

  if (!token || token !== config.internalApiSecret) {
    res.status(401).json({ error: "Unauthorized: Invalid internal secret" });
    return;
  }

  next();
}
