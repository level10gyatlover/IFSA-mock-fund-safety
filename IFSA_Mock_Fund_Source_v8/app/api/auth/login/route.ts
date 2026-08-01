import { authenticate, createSession, SESSION_COOKIE } from "../../../../lib/auth";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as { username?: string; password?: string };
    const username = payload.username?.trim().toLowerCase() ?? "";
    const password = payload.password ?? "";
    if (!username || !password) return Response.json({ error: "Enter your username and password." }, { status: 400 });
    const user = await authenticate(username, password);
    if (!user) return Response.json({ error: "Incorrect username or password." }, { status: 401 });
    const session = await createSession(user.id);
    return Response.json(
      { user: { id: user.id, username: user.username, displayName: user.displayName, role: user.role } },
      {
        headers: {
          "Set-Cookie": `${SESSION_COOKIE}=${session.token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${30 * 24 * 60 * 60}`,
        },
      },
    );
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to sign in." }, { status: 500 });
  }
}
