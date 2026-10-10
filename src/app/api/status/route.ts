import { ctx, snapshot } from "@/lib/service";
import { dbMode } from "@/lib/db";
import { reapMode } from "@/lib/reap/client";
import { handle, json } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { repo, user } = await ctx();
    const { budget, spend } = await snapshot(repo, user.id);
    return json({
      app: "Katerbot",
      db: dbMode(),
      reap: reapMode(),
      reap_base_url: reapMode() === "live" ? process.env.REAP_BASE_URL : null,
      user: { id: user.id, display_name: user.display_name, enrollment_id: user.reap_enrollment_id, enrollment_status: user.reap_enrollment_status },
      budget,
      weekly_spend: spend,
    });
  } catch (e) {
    return handle(e);
  }
}
