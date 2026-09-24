import { Request, Response, NextFunction } from "express";
import { Types } from "mongoose";
import { HttpError } from "../lib/httpError";

/**
 * Rejects a request with 400 before it reaches a service if any of the
 * named route params is not a valid Mongo ObjectId. Without this, an
 * invalid id reaches Mongoose as a CastError inside an async handler,
 * which (pre-express-async-errors) crashed the process.
 */
export function validateObjectIdParams(...paramNames: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    for (const name of paramNames) {
      const value = req.params[name];
      if (value !== undefined && !Types.ObjectId.isValid(value)) {
        return next(new HttpError(400, `Invalid ${name}`));
      }
    }
    next();
  };
}
