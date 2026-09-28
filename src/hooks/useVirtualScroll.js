/**
 * useVirtualScroll — Hook for virtual scrolling with large media lists.
 *
 * Renders only the items visible in the viewport + buffer zone,
 * dramatically improving performance for 1000+ item lists.
 *
 * Usage:
 *   const { visibleItems, containerRef, totalHeight, offsetY } = useVirtualScroll({
 *     items: allMediaItems,
 *     itemHeight: 80,
 *     overscan: 5,
 *   });
 *
 *   return (
 *     <div ref={containerRef} style={{ height: '500px', overflow: 'auto' }}>
 *       <div style={{ height: totalHeight, position: 'relative' }}>
 *         {visibleItems.map((item) => (
 *           <div style={{ position: 'absolute', top: item.y, height: itemHeight }}>
 *             <MediaCard media={item} />
 *           </div>
 *         ))}
 *       </div>
 *     </div>
 *   );
 */
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';

export default function useVirtualScroll({
  items = [],
  itemHeight = 80,
  overscan = 3,
  containerHeight = 600,
}) {
  const containerRef = useRef(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [measuredHeight, setMeasuredHeight] = useState(containerHeight);

  // Listen to scroll events
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleScroll = () => {
      setScrollTop(el.scrollTop);
    };

    el.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    // ResizeObserver for container height changes
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setMeasuredHeight(entry.contentRect.height);
      }
    });
    resizeObserver.observe(el);

    return () => {
      el.removeEventListener('scroll', handleScroll);
      resizeObserver.disconnect();
    };
  }, []);

  // Calculate visible range
  const { startIndex, endIndex, totalHeight, offsetY } = useMemo(() => {
    const total = items.length * itemHeight;
    const start = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const end = Math.min(
      items.length,
      Math.ceil((scrollTop + measuredHeight) / itemHeight) + overscan,
    );
    return {
      startIndex: start,
      endIndex: end,
      totalHeight: total,
      offsetY: start * itemHeight,
    };
  }, [items.length, itemHeight, scrollTop, measuredHeight, overscan]);

  // Get visible items with their Y positions
  const visibleItems = useMemo(() => {
    return items.slice(startIndex, endIndex).map((item, i) => ({
      ...item,
      virtualIndex: startIndex + i,
      y: (startIndex + i) * itemHeight,
    }));
  }, [items, startIndex, endIndex, itemHeight]);

  const scrollToIndex = useCallback((index) => {
    const el = containerRef.current;
    if (!el) return;
    el.scrollTop = index * itemHeight;
  }, [itemHeight]);

  return {
    visibleItems,
    containerRef,
    totalHeight,
    offsetY,
    startIndex,
    endIndex,
    scrollToIndex,
  };
}
