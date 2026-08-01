import { destroyCurrentSession, SESSION_COOKIE } from "../../../../lib/auth";

export async function POST() {
  await destroyCurrentSession();
  return Response.json({ ok: true }, {
    headers: { "Set-Cookie": `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0` },
  });
}
