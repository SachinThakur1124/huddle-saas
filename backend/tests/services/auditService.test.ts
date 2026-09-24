import mongoose from "mongoose";
import { connectTestDb, clearTestDb, disconnectTestDb } from "../helpers/db";
import { AuditService } from "../../src/services/auditService";
import { AuditLog } from "../../src/models/AuditLog";
import { withTransaction } from "../../src/lib/withTransaction";

beforeAll(connectTestDb);
afterEach(clearTestDb);
afterAll(disconnectTestDb);

describe("AuditService + withTransaction", () => {
  it("records an audit entry", async () => {
    const workspaceId = new mongoose.Types.ObjectId();
    const actorId = new mongoose.Types.ObjectId();
    await AuditService.record({
      actorId,
      workspaceId,
      action: "card.moved",
      targetType: "Card",
      targetId: new mongoose.Types.ObjectId(),
    });
    const entries = await AuditLog.find({ workspaceId });
    expect(entries).toHaveLength(1);
    expect(entries[0].action).toBe("card.moved");
  });

  it("rolls back all writes inside withTransaction on error", async () => {
    const workspaceId = new mongoose.Types.ObjectId();
    await expect(
      withTransaction(async (session) => {
        await AuditLog.create(
          [
            {
              workspaceId,
              actorId: new mongoose.Types.ObjectId(),
              action: "test.write",
              targetType: "Card",
              targetId: new mongoose.Types.ObjectId(),
            },
          ],
          { session },
        );
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");

    const entries = await AuditLog.find({ workspaceId });
    expect(entries).toHaveLength(0);
  });
});
