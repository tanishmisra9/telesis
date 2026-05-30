interface KeyboardHelpProps {
  open: boolean;
  onClose: () => void;
}

export function KeyboardHelp({ open, onClose }: KeyboardHelpProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-card border border-line bg-surface-2 p-4" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-card-heading text-primary">Keyboard shortcuts</h3>
        <ul className="mt-3 space-y-2 text-caption text-secondary">
          <li>? toggle help</li>
          <li>S focus session picker</li>
          <li>J / K next previous driver</li>
          <li>Esc close drawers and popovers</li>
        </ul>
      </div>
    </div>
  );
}
