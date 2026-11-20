"use client";
import BrandName from "@/components/BrandName";
import Link from "next/link";
import { usePathname } from "next/navigation";

const I = {
  chart: <path d="M3 17l5-5 4 4 8-9M14 7h6v6" />,
  cal: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></>,
  book: <><path d="M4 5a2 2 0 012-2h13v16H6a2 2 0 00-2 2z" /><path d="M4 21V5" /></>,
  target: <><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3" /></>,
  calc: <><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M8 7h8M8 12h2M14 12h2M8 16h2M14 16h2" /></>,
};
const Icon = ({ d }: { d: React.ReactNode }) => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {d}
  </svg>
);

const LINKS: { href: string; label: string; icon?: React.ReactNode; sub?: boolean; group?: string }[] = [
  { href: "/", label: "Market Regime & COT", icon: I.chart },
  { href: "/news", label: "Calendrier des news", icon: I.cal },
  { href: "/journal", label: "Dashboard", icon: I.book, group: "Journal" },
  { href: "/journal/calendrier", label: "Calendrier P&L", sub: true },
  { href: "/journal/trades", label: "Liste des trades", sub: true },
  { href: "/strategie", label: "Stratégie ACR", icon: I.target, group: "Outils" },
  { href: "/risque", label: "Calculateur de risque", icon: I.calc },
];

export default function Sidebar() {
  const path = usePathname();
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">
          <svg width="18" height="18" viewBox="0 0 32 32" aria-hidden="true">
            <path d="M5 22l7-7 5 5 10-11" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div>
          <BrandName />
          <div className="brand-sub">Espace de trading personnel</div>
        </div>
      </div>
      <nav className="nav" aria-label="Menu principal">
        {LINKS.map((l) => (
          <div key={l.href} style={{ display: "contents" }}>
            {l.group && <div className="nav-group label">{l.group}</div>}
            <Link
              href={l.href}
              className={`${l.sub ? "sub" : ""} ${path === l.href ? "active" : ""}`}
              aria-current={path === l.href ? "page" : undefined}
            >
              {l.icon && <Icon d={l.icon} />}
              {l.sub || l.href !== "/journal" ? l.label : "Journal · Dashboard"}
            </Link>
          </div>
        ))}
      </nav>
      <div className="sidebar-foot stack" style={{ gap: 10 }}>
        <p className="small muted">
          Un filtre pour ton analyse, pas un signal pour trader à l’aveugle.
        </p>
        <form action="/auth/signout" method="post">
          <button className="btn btn-sm" style={{ width: "100%" }}>Se déconnecter</button>
        </form>
      </div>
    </aside>
  );
}
