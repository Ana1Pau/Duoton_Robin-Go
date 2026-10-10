// Reap enrollment (one-time card setup). The card is entered ONLY on Reap's hosted page;
// Katerbot stores just enrollment_id + status.
// GET  /api/reap/enrollments — refresh status from Reap
// POST /api/reap/enrollments — create (or reuse ACTIVE) enrollment
import { ctx } from "@/lib/service";
import { reap } from "@/lib/reap/client";
import { appBaseUrl, handle, json } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { repo, user } = await ctx();
    if (!user.reap_enrollment_id) return json({ enrollment: null, mode: reap.mode() });
    const e = await reap.getEnrollment(user.reap_enrollment_id);
    await repo.setEnrollment(user.id, e.id, e.status);
    return json({ enrollment: { id: e.id, status: e.status, next_action_url: e.nextAction?.url ?? null }, mode: reap.mode() });
  } catch (e) {
    return handle(e);
  }
}

export async function POST(req: Request) {
  try {
    const { repo, user } = await ctx();
    const mode = reap.mode();
    // Reuse a stored enrollment if it is still ACTIVE (and belongs to the current mode).
    if (user.reap_enrollment_id && user.reap_enrollment_id.startsWith("mock_") === (mode === "mock")) {
      const current = await reap.getEnrollment(user.reap_enrollment_id).catch(() => null);
      if (current?.status === "ACTIVE") {
        await repo.setEnrollment(user.id, current.id, current.status);
        return json({ enrollment: { id: current.id, status: current.status, next_action_url: null }, reused: true, mode });
      }
    }
    const e = await reap.createEnrollment(
      {
        source: "EXTERNAL",
        owner: { type: "CLIENT_REFERENCE", reference: user.reap_customer_reference ?? `katerbot-user-${user.id}` },
        email: user.email,
        presentation: { type: "REDIRECT", returnUrl: `${appBaseUrl(req)}/reap/return?type=enrollment` },
      },
      `katerbot-enroll-${user.id}-${Date.now()}`
    );
    await repo.setEnrollment(user.id, e.id, e.status);
    return json({ enrollment: { id: e.id, status: e.status, next_action_url: e.nextAction?.url ?? null }, reused: false, mode }, 201);
  } catch (e) {
    return handle(e);
  }
}
