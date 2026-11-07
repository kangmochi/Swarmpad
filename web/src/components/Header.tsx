import { NavLink, Link } from "react-router";

import idle from "../assets/mascot/mascot-idle-512.webp";
import { WalletButton } from "./WalletButton";

const NAV = [
  { to: "/", label: "Home", end: true },
  { to: "/projects", label: "Projects", end: false },
  { to: "/docs", label: "Docs", end: false },
];

export function Header() {
  return (
    <header className="header">
      <div className="header__inner">
        <Link to="/" className="brand" aria-label="Swarmpad home">
          <img src={idle} alt="" width={28} height={28} />
          <span>swarmpad</span>
        </Link>

        <nav className="navpill" aria-label="Main">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => (isActive ? "is-active" : undefined)}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="header__actions">
          <Link to="/launch" className="pill pill--primary pill--sm header__launch">
            Launch token
          </Link>
          <WalletButton />
        </div>
      </div>
    </header>
  );
}
