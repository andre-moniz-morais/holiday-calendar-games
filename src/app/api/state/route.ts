import { buildState, currentPlayer } from "@/lib/server/state";

export async function GET() {
  const me = await currentPlayer();
  if (!me) return Response.json({ error: "unauthorized" }, { status: 401 });
  const state = await buildState(me);
  return Response.json(state, { headers: { "Cache-Control": "no-store" } });
}
