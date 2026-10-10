import type { Metadata } from "next";
import { DemoGuide } from "@/components/DemoGuide";

export const metadata: Metadata = { title: "Katerbot — Demo (Agentic Payments × Reap)" };

export default function DemoPage() {
  return <DemoGuide />;
}
