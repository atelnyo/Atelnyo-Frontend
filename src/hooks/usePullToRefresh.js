import { useEffect } from 'react';

export default function usePullToRefresh(onRefresh) {
  useEffect(() => {
    if (typeof window === 'undefined' || !onRefresh) return;

    let startY = 0;
    let isPulling = false;
    const el = document.documentElement;

    function onTouchStart(e) {
      if (el.scrollTop === 0) {
        startY = e.touches[0].clientY;
        isPulling = true;
      }
    }

    function onTouchMove(e) {
      if (!isPulling) return;
      const diff = e.touches[0].clientY - startY;
      if (diff > 80) {
        isPulling = false;
        onRefresh();
      }
    }

    function onTouchEnd() {
      isPulling = false;
    }

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: true });
    el.addEventListener('touchend', onTouchEnd);

    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
    };
  }, [onRefresh]);
}
