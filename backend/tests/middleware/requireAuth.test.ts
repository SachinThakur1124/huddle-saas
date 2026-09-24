import { Response } from "express";
import { requireAuth, AuthedRequest } from "../../src/middleware/requireAuth";

function mockRes() {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res as Response;
}

describe("requireAuth", () => {
  it("returns 401 when the Authorization header is missing", () => {
    const req = { headers: {} } as AuthedRequest;
    const res = mockRes();
    const next = jest.fn();

    requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 401 when the token is invalid", () => {
    const req = { headers: { authorization: "Bearer not-a-real-token" } } as AuthedRequest;
    const res = mockRes();
    const next = jest.fn();

    requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});
