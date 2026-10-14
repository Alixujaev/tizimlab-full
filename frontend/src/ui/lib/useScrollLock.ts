import { useEffect } from 'react';

let locks = 0;

/** Modal/drawer ochiqligida sahifa scroll'ini to'xtatadi (ichma-ich qatlamlar uchun hisoblagich bilan). */
export function useScrollLock(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    locks += 1;
    if (locks === 1) document.body.style.overflow = 'hidden';
    return () => {
      locks -= 1;
      if (locks === 0) document.body.style.overflow = '';
    };
  }, [active]);
}
