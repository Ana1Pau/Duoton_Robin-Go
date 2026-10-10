// GET /api/alerts — recomputes (expiry <= 3d, depletion <= 3d, weekly spend > budget) and returns open alerts.
import { ctx, refreshAlerts } from "@/lib/service";
import { handle, json } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { repo, user } = await ctx();
    const refresh = new URL(req.url).searchParams.get("refresh") !== "0";
    const alerts = refresh ? await refreshAlerts(repo, user.id) : await repo.listAlerts(user.id);
    return json({ alerts });
  } catch (e) {
    return handle(e);
  }
}
