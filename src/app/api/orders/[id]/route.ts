import { ctx } from "@/lib/service";
import { fail, handle, json } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { repo, user } = await ctx();
    const order = await repo.getOrder(user.id, Number((await params).id));
    return order ? json({ order }) : fail(404, "NOT_FOUND", "Order not found");
  } catch (e) {
    return handle(e);
  }
}
