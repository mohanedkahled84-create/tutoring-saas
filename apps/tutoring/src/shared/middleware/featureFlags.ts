import { Request, Response, NextFunction } from "express";
import { isFeatureEnabled, FeatureFlagName } from "../config/index.js";

export function requireFeatureFlag(flag: FeatureFlagName) {
  return (_req: Request, res: Response, next: NextFunction): void => {
    if (!isFeatureEnabled(flag)) {
      res.status(404).json({
        error: {
          code: "FEATURE_DISABLED",
          message: `The requested feature '${String(flag)}' is currently disabled.`,
        },
      });
      return;
    }
    next();
  };
}
