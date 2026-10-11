import { HOWTO } from "./copy.ts";
import { Modal } from "./Modal.tsx";

/** Så här funkar det: the walkthrough video in a window. Rendered only while open, so it loads then and stops on close. */
export function HowtoDialog({ open, onClose }: { open: boolean; onClose(): void }) {
  return (
    <Modal open={open} onClose={onClose} title={HOWTO.title}>
      {open && (
        <div className="howto">
          <video
            src="/video/skrubba-demo.mp4"
            poster="/video/skrubba-demo.jpg"
            width={1280}
            height={1100}
            controls
            playsInline
            preload="metadata"
            aria-describedby="howto-steps"
          />
          {/* The video has no sound; its captions are these steps. Read out by screen readers. */}
          <ol id="howto-steps" className="sr-only">
            {HOWTO.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </div>
      )}
    </Modal>
  );
}
