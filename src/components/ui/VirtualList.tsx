/**
 * VirtualList — lightweight virtualized list for React.
 * Only renders items visible in the viewport (+ overscan buffer).
 * Works with variable-height items via measurement.
 *
 * Usage:
 *   <VirtualList items={items} renderItem={(item, i) => <Card item={item} />} />
 */

import { useRef, useState, useCallback, useEffect, type ReactNode } from "react";

interface VirtualListProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => ReactNode;
  /** Estimated item height in px (used before measurement). Default 120. */
  estimateHeight?: number;
  /** Extra items to render above/below viewport. Default 5. */
  overscan?: number;
  /** Container className */
  className?: string;
}

export function VirtualList<T>({
  items,
  renderItem,
  estimateHeight = 120,
  overscan = 5,
  className = "",
}: VirtualListProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(600);
  const heightsRef = useRef<Map<number, number>>(new Map());

  /* Measure container height on mount + resize */
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setContainerHeight(entry.contentRect.height);
    });
    ro.observe(el);
    setContainerHeight(el.clientHeight);
    return () => ro.disconnect();
  }, []);

  const onScroll = useCallback(() => {
    setScrollTop(containerRef.current?.scrollTop ?? 0);
  }, []);

  /* Compute visible range */
  const getEstimatedTop = (index: number): number => {
    let top = 0;
    for (let i = 0; i < index; i++) {
      top += heightsRef.current.get(i) ?? estimateHeight;
    }
    return top;
  };

  const totalHeight = getEstimatedTop(items.length);

  let startIndex = 0;
  for (let i = 0; i < items.length; i++) {
    const h = heightsRef.current.get(i) ?? estimateHeight;
    if (getEstimatedTop(i) + h >= scrollTop) {
      startIndex = Math.max(0, i - overscan);
      break;
    }
  }

  let endIndex = items.length - 1;
  for (let i = startIndex; i < items.length; i++) {
    if (getEstimatedTop(i) > scrollTop + containerHeight) {
      endIndex = Math.min(items.length - 1, i + overscan);
      break;
    }
  }

  const visibleItems = items.slice(startIndex, endIndex + 1);

  /* After render, measure actual heights */
  const measureRef = useCallback(
    (node: HTMLDivElement | null, index: number) => {
      if (node) {
        const measured = node.getBoundingClientRect().height;
        if (heightsRef.current.get(index) !== measured) {
          heightsRef.current.set(index, measured);
        }
      }
    },
    []
  );

  if (items.length === 0) return null;

  return (
    <div
      ref={containerRef}
      onScroll={onScroll}
      className={`overflow-auto ${className}`}
      style={{ contain: "strict layout" }}
    >
      <div style={{ height: totalHeight, position: "relative" }}>
        {visibleItems.map((item, vi) => {
          const realIndex = startIndex + vi;
          const top = getEstimatedTop(realIndex);
          return (
            <div
              key={realIndex}
              ref={(node) => measureRef(node, realIndex)}
              style={{ position: "absolute", top, left: 0, right: 0 }}
            >
              {renderItem(item, realIndex)}
            </div>
          );
        })}
      </div>
    </div>
  );
}
