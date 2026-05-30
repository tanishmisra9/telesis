import { useEffect, useState } from "react";

interface JumpNavItem {
  id: string;
  label: string;
}

interface JumpNavProps {
  items: JumpNavItem[];
}

export function JumpNav({ items }: JumpNavProps) {
  const [activeId, setActiveId] = useState(items[0]?.id ?? "");

  useEffect(() => {
    const sections = items
      .map((item) => document.getElementById(item.id))
      .filter((el): el is HTMLElement => Boolean(el));
    if (!sections.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]?.target?.id) {
          setActiveId(visible[0].target.id);
        }
      },
      { rootMargin: "-25% 0px -55% 0px", threshold: [0.2, 0.5, 0.8] },
    );

    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, [items]);

  return (
    <nav className="fixed right-3 top-1/2 z-30 hidden -translate-y-1/2 rounded-pill border border-line bg-surface-glass p-2 backdrop-blur-glass lg:block">
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.id}>
            <a
              href={`#${item.id}`}
              className={`block h-2 w-2 rounded-full transition ${
                activeId === item.id ? "bg-accent" : "bg-white/40 hover:bg-accent"
              }`}
              title={item.label}
            />
          </li>
        ))}
      </ul>
    </nav>
  );
}
