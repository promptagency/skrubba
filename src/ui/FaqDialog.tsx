import { useState } from "react";
import { FAQ } from "./copy.ts";
import { Modal } from "./Modal.tsx";

/**
 * Vanliga frågor in a window over the page, as an accordion: all questions
 * closed to start with, and opening one closes the one that was open.
 */
export function FaqDialog({ open, onClose }: { open: boolean; onClose(): void }) {
  const [expanded, setExpanded] = useState<number | null>(null);
  return (
    <Modal
      open={open}
      onClose={() => {
        setExpanded(null);
        onClose();
      }}
      title={FAQ.title}
    >
      <div className="faq">
        {FAQ.items.map((item, i) => (
          <details key={item.q} open={expanded === i}>
            <summary
              onClick={(e) => {
                e.preventDefault();
                setExpanded(expanded === i ? null : i);
              }}
            >
              <h3>{item.q}</h3>
            </summary>
            <p>{item.a}</p>
          </details>
        ))}
      </div>
    </Modal>
  );
}
