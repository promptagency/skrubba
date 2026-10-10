import { FAQ } from "./copy.ts";
import { Modal } from "./Modal.tsx";

/** Vanliga frågor in a window over the page. */
export function FaqDialog({ open, onClose }: { open: boolean; onClose(): void }) {
  return (
    <Modal open={open} onClose={onClose} title={FAQ.title}>
      <div className="faq">
        {FAQ.items.map((item) => (
          <section key={item.q}>
            <h3>{item.q}</h3>
            <p>{item.a}</p>
          </section>
        ))}
      </div>
    </Modal>
  );
}
