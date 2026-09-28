export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { previousWeek } from "../src/week";
import { DEMO_WEEK, isDemo } from "../lib/week-data";

export default async function Home() {
  redirect(`/vecka/${(await isDemo()) ? DEMO_WEEK : previousWeek()}`);
}
