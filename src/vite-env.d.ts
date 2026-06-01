/// <reference types="vite/client" />

declare module 'gifenc' {
  export function GIFEncoder(): {
    writeFrame: (index: Uint8Array | number[], width: number, height: number, options: { palette: number[][] | Uint8Array; delay?: number; transparent?: boolean; transparentIndex?: number }) => void;
    finish: () => void;
    bytesView: () => Uint8Array;
  };
  export function quantize(data: Uint8ClampedArray | Uint8Array, maxColors: number, options?: { format?: string; oneBitAlpha?: boolean | number }): number[][];
  export function applyPalette(data: Uint8ClampedArray | Uint8Array, palette: number[][], format?: string): Uint8Array;
}
