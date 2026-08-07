'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

export interface FaqItem {
  q: string;
  a: string;
}

export default function FaqClient({ items }: { items: FaqItem[] }) {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      {items.map((item, i) => (
        <div key={i} className="m-faq-item">
          <button
            className="m-faq-q"
            onClick={() => setOpen(open === i ? null : i)}
            aria-expanded={open === i}
          >
            <span>{item.q}</span>
            <ChevronDown
              size={18}
              style={{
                color: 'var(--m-muted)',
                flexShrink: 0,
                transform: open === i ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 200ms',
              }}
            />
          </button>
          {open === i && (
            <p className="m-faq-a">{item.a}</p>
          )}
        </div>
      ))}
    </div>
  );
}
