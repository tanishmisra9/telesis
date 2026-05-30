interface JumpNavItem {
  id: string;
  label: string;
}

interface JumpNavProps {
  items: JumpNavItem[];
}

export function JumpNav({ items }: JumpNavProps) {
  return (
    <nav className="fixed right-3 top-1/2 z-30 hidden -translate-y-1/2 rounded-pill border border-line bg-surface-glass p-2 backdrop-blur-glass lg:block">
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.id}>
            <a
              href={`#${item.id}`}
              className="block h-2 w-2 rounded-full bg-white/40 transition hover:bg-accent"
              title={item.label}
            />
          </li>
        ))}
      </ul>
    </nav>
  );
}
