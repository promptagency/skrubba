// The session lives here, in memory only: text, entities, word list and key.
// Nothing is written to storage, cookies or the URL (see CLAUDE.md).
import { createContext, type Dispatch, type ReactNode, useContext, useReducer, useState } from "react";
import { createBrowserMasker, type Masker } from "../engine/index.ts";
import { initialSession, type SessionAction, type SessionState, sessionReducer } from "./session.ts";

interface Session {
  state: SessionState;
  dispatch: Dispatch<SessionAction>;
  masker: Masker;
}

const SessionContext = createContext<Session | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [masker] = useState<Masker>(() => createBrowserMasker());
  const [state, dispatch] = useReducer(sessionReducer, initialSession);
  return <SessionContext value={{ state, dispatch, masker }}>{children}</SessionContext>;
}

export function useSession(): Session {
  const session = useContext(SessionContext);
  if (!session) throw new Error("useSession outside SessionProvider");
  return session;
}
