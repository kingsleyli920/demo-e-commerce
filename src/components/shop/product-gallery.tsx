'use client';

import Image from 'next/image';
import { useState } from 'react';
import { cn } from '@/lib/utils';

export function ProductGallery({ images, title }: { images: string[]; title: string }) {
  const [index, setIndex] = useState(0);
  const main = images[index] ?? images[0];
  return (
    <div className="space-y-3">
      <div className="relative aspect-square w-full overflow-hidden rounded-lg border bg-muted">
        {main ? (
          <Image
            src={main}
            alt={title}
            fill
            priority
            sizes="(max-width: 768px) 100vw, 40vw"
            className="object-contain p-4"
            data-testid="gallery-main"
          />
        ) : null}
      </div>
      {images.length > 1 ? (
        <div className="flex gap-2" data-testid="gallery-thumbs">
          {images.map((img, i) => (
            <button
              key={img + i}
              type="button"
              onClick={() => setIndex(i)}
              className={cn(
                'relative size-16 overflow-hidden rounded-md border bg-muted',
                i === index && 'ring-2 ring-primary',
              )}
              data-testid={`gallery-thumb-${i}`}
              aria-label={`查看第 ${i + 1} 张图`}
            >
              <Image src={img} alt="" fill sizes="64px" className="object-contain p-1" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
