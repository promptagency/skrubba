import { useEffect } from "react";
import { REPO_URL } from "../config.ts";
import { HOW, t } from "./copy.ts";
import { followLink } from "./route.ts";

export function HowItWorks() {
  useEffect(() => {
    document.title = `${HOW.title}. ${t("app.name")}`;
    return () => {
      document.title = t("app.title");
    };
  }, []);

  return (
    <div className="page">
      <header className="topbar">
        <a className="brand" href="/" onClick={followLink}>
          {t("app.name")}
        </a>
      </header>
      <main className="page-body">
        <h1>{HOW.title}</h1>
        {HOW.paragraphs.map((p) => (
          <p key={p.lead}>
            <strong>{p.lead}</strong> {p.body}
          </p>
        ))}
        <p className="credits">
          {HOW.credits.replace(/Öppen källkod från Prompt Agency$/, "")}
          {REPO_URL ? <a href={REPO_URL}>Öppen källkod från Prompt Agency</a> : "Öppen källkod från Prompt Agency"}.
        </p>
      </main>
    </div>
  );
}
