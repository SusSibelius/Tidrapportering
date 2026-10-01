import type { Metadata } from "next";
import { auth, microsoftConfigured } from "../../auth";
import { readConfig } from "../../src/config";
import FlexView from "./FlexView";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Flexsaldo · Tidrapportering" };

export default async function FlexPage() {
  const session = microsoftConfigured ? await auth() : null;
  if (!session?.user) {
    return (
      <>
        <header>
          <h1>Flexsaldo</h1>
        </header>
        <p className="note">Logga in med ditt Microsoft-konto för att se ditt flexsaldo.</p>
      </>
    );
  }
  const config = await readConfig();
  return (
    <FlexView
      codes={config.tidkoder.map(({ kod, typ }) => ({ kod, typ }))}
      hoursPerDay={config.timmarPerDag}
      flexCodes={config.tidkoder.filter((c) => c.typ === "flexuttag").map((c) => c.kod)}
    />
  );
}
