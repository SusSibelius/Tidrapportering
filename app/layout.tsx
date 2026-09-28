import type { Metadata } from "next";
import Link from "next/link";
import { auth, microsoftConfigured, signIn, signOut } from "../auth";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tidrapportering",
  description: "Veckans tidrapport, redan ifylld utifrån kalender och mail.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = microsoftConfigured ? await auth() : null;
  return (
    <html lang="sv">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,700&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap"
        />
      </head>
      <body>
        <div className="wrap">
          <div className="topbar">
            <Link href="/" className="brand">
              Tidrapportering
            </Link>
            <div className="user">
              {session?.user ? (
                <>
                  <span>{session.user.name ?? session.user.email}</span>
                  <form
                    action={async () => {
                      "use server";
                      await signOut({ redirectTo: "/" });
                    }}
                  >
                    <button className="btn" type="submit">
                      Logga ut
                    </button>
                  </form>
                </>
              ) : microsoftConfigured ? (
                <form
                  action={async () => {
                    "use server";
                    await signIn("microsoft-entra-id", { redirectTo: "/" });
                  }}
                >
                  <button className="btn primary" type="submit">
                    Logga in med Microsoft
                  </button>
                </form>
              ) : null}
            </div>
          </div>
          {children}
        </div>
      </body>
    </html>
  );
}
