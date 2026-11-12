// Lets work that can wait (analytics) start once the map has drawn its first
// tiles. On mobile a map tile is the LCP element, so anything downloaded
// before it delays it.
const EVENT = "meethn:map-ready";
let ready = false;

export function markMapReady() {
  if (ready) return;
  ready = true;
  window.dispatchEvent(new Event(EVENT));
}

// Calls `fn` once, when the map is ready or after `timeoutMs` (the map may
// fail to load). Returns a cleanup function.
export function onMapReady(fn: () => void, timeoutMs: number) {
  if (ready) {
    fn();
    return () => {};
  }
  let done = false;
  const run = () => {
    if (done) return;
    done = true;
    cleanup();
    fn();
  };
  const timer = setTimeout(run, timeoutMs);
  window.addEventListener(EVENT, run);
  const cleanup = () => {
    clearTimeout(timer);
    window.removeEventListener(EVENT, run);
  };
  return () => {
    done = true;
    cleanup();
  };
}
