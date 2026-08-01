import { getD1 } from "../../../db";
import { requireUser } from "../../../lib/auth";

export const dynamic = "force-dynamic";

type ChatRow = {
  id: number;
  userId: number;
  username: string;
  accountName: string;
  deviceId: string;
  senderName: string;
  message: string;
  createdAt: number;
  editedAt: number | null;
};

let schemaReady: Promise<void> | null = null;

function ensureChatSchema() {
  if (!schemaReady) {
    const db = getD1();
    schemaReady = (async () => {
      await db.batch([
        db.prepare(
          `CREATE TABLE IF NOT EXISTS chat_messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
            user_id INTEGER NOT NULL REFERENCES users(id),
            device_id TEXT NOT NULL,
            sender_name TEXT NOT NULL,
            message TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            edited_at INTEGER,
            edited_by INTEGER
          )`,
        ),
        db.prepare("CREATE INDEX IF NOT EXISTS chat_messages_created_idx ON chat_messages(created_at)"),
        db.prepare("CREATE INDEX IF NOT EXISTS chat_messages_user_idx ON chat_messages(user_id)"),
        db.prepare("CREATE TABLE IF NOT EXISTS chat_room_meta (id INTEGER PRIMARY KEY NOT NULL, revision INTEGER DEFAULT 0 NOT NULL)"),
        db.prepare("INSERT OR IGNORE INTO chat_room_meta (id, revision) VALUES (1, 0)"),
      ]);
    })().catch((error) => {
      schemaReady = null;
      throw error;
    });
  }
  return schemaReady;
}

function cleanSenderName(value: unknown, fallback: string) {
  if (typeof value !== "string") return fallback;
  const cleaned = value.replace(/\s+/g, " ").trim().slice(0, 36);
  return cleaned || fallback;
}

export async function GET(request: Request) {
  try {
    await requireUser();
    await ensureChatSchema();
    const knownRevision = Number(new URL(request.url).searchParams.get("revision") ?? -1);
    const db = getD1();
    const meta = await db.prepare("SELECT revision FROM chat_room_meta WHERE id = 1").first<{ revision: number }>();
    const revision = Number(meta?.revision ?? 0);
    if (knownRevision === revision) {
      return Response.json({ messages: [], revision, replace: false }, { headers: { "Cache-Control": "no-store" } });
    }
    const select = `SELECT m.id, m.user_id AS userId, u.username,
      u.display_name AS accountName, m.device_id AS deviceId,
      m.sender_name AS senderName, m.message, m.created_at AS createdAt,
      m.edited_at AS editedAt
      FROM chat_messages m JOIN users u ON u.id = m.user_id`;
    const result = await db.prepare(`${select} ORDER BY m.id DESC LIMIT 100`).all<ChatRow>();
    return Response.json({ messages: [...result.results].reverse(), revision, replace: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load the chat room.";
    return Response.json({ error: message }, { status: message === "UNAUTHENTICATED" ? 401 : 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    await ensureChatSchema();
    const payload = (await request.json()) as { message?: unknown; senderName?: unknown; deviceId?: unknown };
    const message = typeof payload.message === "string" ? payload.message.trim() : "";
    const deviceId = typeof payload.deviceId === "string" ? payload.deviceId.trim().slice(0, 80) : "";
    const senderName = cleanSenderName(payload.senderName, user.displayName);
    if (!message) return Response.json({ error: "Write a message before sending." }, { status: 400 });
    if (message.length > 1000) return Response.json({ error: "Messages can be up to 1,000 characters." }, { status: 400 });
    if (!deviceId) return Response.json({ error: "This browser session could not be identified." }, { status: 400 });

    const createdAt = Date.now();
    const db = getD1();
    await db.batch([
      db.prepare(
        `INSERT INTO chat_messages (user_id, device_id, sender_name, message, created_at)
         VALUES (?, ?, ?, ?, ?)`,
      ).bind(user.id, deviceId, senderName, message, createdAt),
      db.prepare("UPDATE chat_room_meta SET revision = revision + 1 WHERE id = 1"),
    ]);
    return Response.json({ ok: true, createdAt }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to send the message.";
    return Response.json({ error: message }, { status: message === "UNAUTHENTICATED" ? 401 : 400 });
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireUser();
    await ensureChatSchema();
    const payload = (await request.json()) as { id?: unknown; message?: unknown; deviceId?: unknown };
    const id = Number(payload.id);
    const message = typeof payload.message === "string" ? payload.message.trim() : "";
    const deviceId = typeof payload.deviceId === "string" ? payload.deviceId.trim().slice(0, 80) : "";
    if (!id || !message || !deviceId) return Response.json({ error: "Message ownership could not be verified." }, { status: 400 });
    if (message.length > 1000) return Response.json({ error: "Messages can be up to 1,000 characters." }, { status: 400 });
    const result = await getD1().prepare(
      "UPDATE chat_messages SET message = ?, edited_at = ?, edited_by = ? WHERE id = ? AND user_id = ? AND device_id = ?",
    ).bind(message, Date.now(), user.id, id, user.id, deviceId).run();
    if (!result.meta.changes) return Response.json({ error: "Only the person and device that sent this message can edit it." }, { status: 403 });
    await getD1().prepare("UPDATE chat_room_meta SET revision = revision + 1 WHERE id = 1").run();
    return Response.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to edit the message.";
    return Response.json({ error: message }, { status: message === "UNAUTHENTICATED" ? 401 : message === "FORBIDDEN" ? 403 : 400 });
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await requireUser();
    await ensureChatSchema();
    const params = new URL(request.url).searchParams;
    const id = Number(params.get("id"));
    const deviceId = String(params.get("deviceId") ?? "").trim().slice(0, 80);
    if (!id || !deviceId) return Response.json({ error: "Message ownership could not be verified." }, { status: 400 });
    const result = await getD1().prepare(
      "DELETE FROM chat_messages WHERE id = ? AND user_id = ? AND device_id = ?",
    ).bind(id, user.id, deviceId).run();
    if (!result.meta.changes) return Response.json({ error: "Only the person and device that sent this message can delete it." }, { status: 403 });
    await getD1().prepare("UPDATE chat_room_meta SET revision = revision + 1 WHERE id = 1").run();
    return Response.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to delete the message.";
    return Response.json({ error: message }, { status: message === "UNAUTHENTICATED" ? 401 : message === "FORBIDDEN" ? 403 : 400 });
  }
}
