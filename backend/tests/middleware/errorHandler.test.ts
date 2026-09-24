import { Request, Response, NextFunction } from "express";
import { errorHandler } from "../../src/middleware/errorHandler";

function mockRes(headersSent: boolean) {
  const res: Partial<Response> = { headersSent };
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res as Response;
}

describe("errorHandler", () => {
  it("responds with 500 and a generic message when headers have not been sent", () => {
    const req = { path: "/boom" } as Request;
    const res = mockRes(false);
    const next: NextFunction = jest.fn();

    errorHandler(new Error("kaboom"), req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Internal server error" });
  });

  it("does not attempt to respond again when headers were already sent", () => {
    const req = { path: "/boom" } as Request;
    const res = mockRes(true);
    const next: NextFunction = jest.fn();

    errorHandler(new Error("kaboom"), req, res, next);

    expect(res.status).not.toHaveBeenCalled();
  });
});
