import { createServer } from "http";
import { AddressInfo } from "net";
import { io as ioClient, Socket as ClientSocket } from "socket.io-client";
import { attachSockets, emitToWorkspace } from "../../src/sockets/index";
import { AuthService } from "../../src/services/authService";
import { WorkspaceService } from "../../src/services/workspaceService";
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

function connectAs(accessToken: string): Promise<ClientSocket> {
  return new Promise((resolve, reject) => {
    const c = ioClient(`http://localhost:${port}`, {
      auth: { token: accessToken },
      transports: ["websocket"],
    });
    c.on("connect_error", reject);
    c.on("connect", () => resolve(c));
  });
}

function joinAck(c: ClientSocket, workspaceId: string): Promise<{ ok: boolean; error?: string }> {
  return new Promise((resolve) => c.emit("workspace:join", workspaceId, resolve));
}

describe("sockets", () => {
  it("joins a workspace room only when the user is actually a member, and receives a broadcast", async () => {
    const { accessToken, user } = await AuthService.register("s@x.com", "password123", "S");
    const workspace = await WorkspaceService.create(user.id, "Acme");

    client = await connectAs(accessToken);

    const ack = await joinAck(client, workspace._id.toString());
    expect(ack.ok).toBe(true);

    const received = new Promise((resolve) => client.on("message:new", resolve));
    emitToWorkspace(workspace._id.toString(), "message:new", { body: "hi" });
    await expect(received).resolves.toEqual({ body: "hi" });
  });

  it("refuses to join a workspace the user is not a member of (no broadcast leak)", async () => {
    const { accessToken } = await AuthService.register("outsider@x.com", "password123", "O");
    const { user: ownerUser } = await AuthService.register("owner@x.com", "password123", "Own");
    const privateWorkspace = await WorkspaceService.create(ownerUser.id, "Private Co");

    client = await connectAs(accessToken);

    const ack = await joinAck(client, privateWorkspace._id.toString());
    expect(ack.ok).toBe(false);

    const receivedSpy = jest.fn();
    client.on("message:new", receivedSpy);
    emitToWorkspace(privateWorkspace._id.toString(), "message:new", { body: "private" });
    await new Promise((r) => setTimeout(r, 100));
    expect(receivedSpy).not.toHaveBeenCalled();
  });

  it("refuses to join with a malformed workspace id", async () => {
    const { accessToken } = await AuthService.register("m@x.com", "password123", "M");
    client = await connectAs(accessToken);
    const ack = await joinAck(client, "not-an-id");
    expect(ack.ok).toBe(false);
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
