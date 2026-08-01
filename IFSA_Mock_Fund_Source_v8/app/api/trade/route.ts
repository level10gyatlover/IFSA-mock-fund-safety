import { requireUser } from "../../../lib/auth";
import { placeOrder } from "../../../lib/engine";

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const payload = (await request.json()) as {
      instrumentId?: number; side?: "BUY" | "SELL"; orderType?: string; quantity?: number;
      limitPrice?: number; triggerPrice?: number; backdatedAt?: number; backdatedPrice?: number; note?: string;
    };
    if (!payload.instrumentId || !payload.side || !payload.orderType || !payload.quantity) {
      return Response.json({ error: "Instrument, side, order type and quantity are required." }, { status: 400 });
    }
    const id = await placeOrder(user, {
      instrumentId: Number(payload.instrumentId), side: payload.side, orderType: payload.orderType,
      quantity: Number(payload.quantity), limitPrice: payload.limitPrice ?? null,
      triggerPrice: payload.triggerPrice ?? null, backdatedAt: payload.backdatedAt ?? null,
      backdatedPrice: payload.backdatedPrice ?? null, note: payload.note,
    });
    return Response.json({ id }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to place order.";
    return Response.json({ error: message }, { status: message === "UNAUTHENTICATED" ? 401 : 400 });
  }
}
