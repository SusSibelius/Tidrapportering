"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function NavLinks() {
  const path = usePathname();
  const links = [
    { href: "/", label: "Tidrapport", active: path === "/" || path.startsWith("/vecka") },
    { href: "/flex", label: "Flex", active: path.startsWith("/flex") },
  ];
  return (
    <nav className="tabs" aria-label="Sidor">
      {links.map((l) => (
        <Link key={l.href} href={l.href} aria-current={l.active ? "page" : undefined}>
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
