import type { CSSProperties } from 'react';

// Original 5 × 7 bitmap glyphs for IPv4 and IPv6; no external font request.
const glyphs: Record<string, string[]> = {
  '0': ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
  '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  '2': ['01110', '10001', '00001', '00010', '00100', '01000', '11111'],
  '3': ['11110', '00001', '00001', '01110', '00001', '00001', '11110'],
  '4': ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
  '5': ['11111', '10000', '10000', '11110', '00001', '00001', '11110'],
  '6': ['01110', '10000', '10000', '11110', '10001', '10001', '01110'],
  '7': ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  '8': ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
  '9': ['01110', '10001', '10001', '01111', '00001', '00001', '01110'],
  a: ['00000', '00000', '01110', '00001', '01111', '10001', '01111'],
  b: ['10000', '10000', '10110', '11001', '10001', '10001', '11110'],
  c: ['00000', '00000', '01111', '10000', '10000', '10000', '01111'],
  d: ['00001', '00001', '01101', '10011', '10001', '10001', '01111'],
  e: ['00000', '00000', '01110', '10001', '11111', '10000', '01111'],
  f: ['00110', '01001', '01000', '11100', '01000', '01000', '01000'],
  '.': ['0', '0', '0', '0', '0', '0', '1'],
  ':': ['0', '0', '1', '0', '1', '0', '0'],
};

export function PixelAddress({ value }: { value: string }) {
  return (
    <strong className={'pixel-address' + (value.includes(':') ? ' ipv6' : '')} key={value}>
      <span className="pixel-address-text">{value}</span>
      <span className="pixel-address-glyphs" aria-hidden="true">
        {Array.from(value.toLowerCase()).map((character, index) => {
          const rows = glyphs[character];
          if (!rows) return null;
          return (
            <svg
              key={index}
              className="pixel-glyph"
              viewBox={`0 0 ${rows[0].length} 7`}
              style={{ '--character': index, width: `${rows[0].length / 7}em` } as CSSProperties}
              focusable="false"
            >
              {rows.flatMap((row, y) =>
                Array.from(row).flatMap((pixel, x) =>
                  pixel === '1' ? <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" /> : [],
                ),
              )}
            </svg>
          );
        })}
        <span className="pixel-cursor" />
      </span>
    </strong>
  );
}
