import { ctx, refreshAlerts } from "@/lib/service";
import { body, fail, handle, json } from "@/lib/http";
import { withStatus } from "@/lib/calc";
import { parseItem } from "../validate";

export const dynamic = "force-dynamic";
type P = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: P) {
  try {
    const { repo, user } = await ctx();
    const item = await repo.getItem(user.id, Number((await params).id));
    if (!item) return fail(404, "NOT_FOUND", "Item not found");
    const logs = await repo.listLogs(user.id, item.id);
    return json({ item: withStatus(item), logs });
  } catch (e) {
    return handle(e);
  }
}

export async function PUT(req: Request, { params }: P) {
  try {
    const { repo, user } = await ctx();
    const item = await repo.updateItem(user.id, Number((await params).id), parseItem(await body(req), true));
    if (!item) return fail(404, "NOT_FOUND", "Item not found");
    const alerts = await refreshAlerts(repo, user.id);
    return json({ item: withStatus(item), alerts });
  } catch (e) {
    return handle(e);
  }
}

export async function DELETE(_req: Request, { params }: P) {
  try {
    const { repo, user } = await ctx();
    const ok = await repo.deleteItem(user.id, Number((await params).id));
    if (!ok) return fail(404, "NOT_FOUND", "Item not found");
    await refreshAlerts(repo, user.id);
    return json({ deleted: true });
  } catch (e) {
    return handle(e);
  }
}
