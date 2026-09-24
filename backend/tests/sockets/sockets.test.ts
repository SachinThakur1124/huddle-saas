import { createServer } from "http";
import { AddressInfo } from "net";
import { io as ioClient, Socket as ClientSocket } from "socket.io-client";
import { attachSockets, emitToWorkspace } from "../../src/sockets/index";
import { AuthService } from "../../src/services/authService";
import { connectTestDb, clearTestDb, disconnectTestDb } from "../helpers/db";

let httpServer: ReturnType<typeof createServer>;
let port: number;
let client: ClientSocket;

beforeAll(async () => {
  await connectTestDb();
  httpServer = createServer();
  attachSockets(httpServer);
  await new Promise<void>((resolve) => httpServer.listen(0, resolve));
  port = (httpServer.address() as AddressInfo).port;
});

afterEach(async () => {
  client?.close();
  await clearTestDb();
});

afterAll(async () => {
  httpServer.close();
  await disconnectTestDb();
});

describe("sockets", () => {
  it("joins a workspace room after authenticating and receives a broadcast", async () => {
    const { accessToken } = await AuthService.register("s@x.com", "password123", "S");

    client = ioClient(`http://localhost:${port}`, {
      auth: { token: accessToken },
      transports: ["websocket"],
    });

    await new Promise<void>((resolve, reject) => {
      client.on("connect_error", reject);
      client.on("connect", resolve);
    });

    client.emit("workspace:join", "ws-1");

    const received = new Promise((resolve) => {
      client.on("message:new", resolve);
    });

    await new Promise((r) => setTimeout(r, 50));
    emitToWorkspace("ws-1", "message:new", { body: "hi" });

    await expect(received).resolves.toEqual({ body: "hi" });
  });

  it("rejects a connection with no auth token", async () => {
    const badClient = ioClient(`http://localhost:${port}`, {
      auth: {},
      transports: ["websocket"],
    });
    const err = await new Promise((resolve) => {
      badClient.on("connect_error", resolve);
    });
    expect(err).toBeTruthy();
    badClient.close();
  });
});
