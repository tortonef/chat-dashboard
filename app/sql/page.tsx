import Workbench from "@/components/Workbench";
import { getTables } from "@/lib/db";

export default async function SqlPage({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) {
  const { q } = await searchParams;
  return <Workbench tables={getTables()} initial={typeof q === "string" ? q : undefined} />;
}
