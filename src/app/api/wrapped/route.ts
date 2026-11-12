import { buildWrapped, canPeek, currentPlayer, today } from "@/lib/server/state";

export async function GET() {
  const me = await currentPlayer();
  if (!me) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (today() < 25 && !canPeek()) return Response.json({ error: "Ainda não é dia 25!" }, { status: 403 });
  return Response.json(await buildWrapped(), { headers: { "Cache-Control": "no-store" } });
}
