import { authReducer, setCredentials, clearCredentials } from "../src/features/auth/authSlice";

describe("authSlice", () => {
  const user = { id: "1", email: "a@x.com", name: "Ada" };

  it("login stores the token pair and user", () => {
    const state = authReducer(undefined, setCredentials({ user, accessToken: "a", refreshToken: "r" }));
    expect(state.accessToken).toBe("a");
    expect(state.refreshToken).toBe("r");
    expect(state.user).toEqual(user);
  });

  it("logout clears the token pair and user", () => {
    const loggedIn = authReducer(undefined, setCredentials({ user, accessToken: "a", refreshToken: "r" }));
    const loggedOut = authReducer(loggedIn, clearCredentials());
    expect(loggedOut.accessToken).toBeNull();
    expect(loggedOut.refreshToken).toBeNull();
    expect(loggedOut.user).toBeNull();
  });

  it("login/logout both settle status to ready", () => {
    const loggedIn = authReducer(undefined, setCredentials({ user, accessToken: "a", refreshToken: "r" }));
    expect(loggedIn.status).toBe("ready");
    const loggedOut = authReducer(loggedIn, clearCredentials());
    expect(loggedOut.status).toBe("ready");
  });
});
