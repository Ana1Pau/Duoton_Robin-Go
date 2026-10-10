import { ctx } from "@/lib/service";
import { fail, handle, json } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { repo, user } = await ctx();
    const ok = await repo.deleteLog(user.id, Number((await params).id));
    return ok ? json({ deleted: true }) : fail(404, "NOT_FOUND", "Log not found");
  } catch (e) {
    return handle(e);
  }
}
