import { Link } from "react-router";

import { DOCS_LINKS, FACTORY_ID } from "../lib/config";

export function Footer() {
  return (
    <footer className="footer">
      <div className="footer__top">
        <div className="footer__brand">
          <p className="footer__wordmark">swarmpad</p>
          <p className="footer__line">
            Fixed-supply tokens, launched from a markdown file and mined against on-chain
            proof.
          </p>
        </div>

        <div className="footer__col">
          <p className="mono-label">Product</p>
          <Link to="/projects">Registry</Link>
          <Link to="/launch">Launch a token</Link>
          <Link to="/docs">Docs</Link>
        </div>

        <div className="footer__col">
          <p className="mono-label">Protocol</p>
          <a href={DOCS_LINKS.explorerFactory} target="_blank" rel="noreferrer">
            Factory {FACTORY_ID}
          </a>
          <Link to="/docs#levels">Level curve</Link>
          <Link to="/docs#fees">Claim fee split</Link>
        </div>

        <div className="footer__col">
          <p className="mono-label">Resources</p>
          <a href="https://near.org/testnet" target="_blank" rel="noreferrer">
            NEAR testnet
          </a>
          <a href={DOCS_LINKS.x} target="_blank" rel="noreferrer">
            X
          </a>
          <Link to="/docs#addresses">Addresses</Link>
        </div>
      </div>

      <div className="footer__legal">
        <span>© 2026 Swarmpad. Testnet build.</span>
        <span>No token sale. Mining is the only way in.</span>
      </div>
    </footer>
  );
}
