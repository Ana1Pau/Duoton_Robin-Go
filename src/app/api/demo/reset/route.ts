// POST /api/demo/reset — reload demo data (leche, pan, huevos, pollo, arroz, fruta).
import { getRepo } from "@/lib/db";
import { refreshAlerts } from "@/lib/service";
import { handle, json } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const repo = await getRepo();
    await repo.resetDemo();
    const user = await repo.getDemoUser();
    await refreshAlerts(repo, user.id);
    return json({ reset: true });
  } catch (e) {
    return handle(e);
  }
}
