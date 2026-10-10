// PATCH /api/alerts/:id — mark alert resolved.
import { ctx } from "@/lib/service";
import { fail, handle, json } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function PATCH(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { repo, user } = await ctx();
    const ok = await repo.resolveAlert(user.id, Number((await params).id));
    return ok ? json({ resolved: true }) : fail(404, "NOT_FOUND", "Alert not found");
  } catch (e) {
    return handle(e);
  }
}
