/** A tiny, deterministic pixel landscape. Renders before JS or artwork requests. */
export default function PixelScene() {
  const ridge = [107, 105, 98, 88, 83, 90, 97, 105, 111, 111, 103, 92, 82, 73, 80, 92, 101, 110, 114, 107, 98, 91, 95, 107, 115, 118, 113, 105, 97, 100, 110, 119];
  return <div className="pixel-scene" aria-hidden="true">
    <svg viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice" shapeRendering="crispEdges">
      <rect width="320" height="180" fill="#121826" />
      <rect y="78" width="320" height="102" fill="#1c2237" />
      {Array.from({ length: 42 }, (_, i) => <rect key={i} x={(i * 61 + 13) % 316} y={(i * 23 + 5) % 75} width={i % 7 === 0 ? 2 : 1} height={i % 7 === 0 ? 2 : 1} fill={i % 3 === 0 ? "#d1ac70" : "#717992"} />)}
      <g fill="#d6cbaa">
        <rect x="257" y="26" width="14" height="18" /><rect x="253" y="30" width="22" height="10" />
      </g>
      <g fill="#9b957e"><rect x="261" y="28" width="4" height="3" /><rect x="255" y="34" width="4" height="4" /><rect x="263" y="39" width="5" height="3" /></g>
      {ridge.map((y, i) => <rect key={i} x={i * 10} y={y} width="10" height={180 - y} fill="#2a2d43" />)}
      {ridge.map((y, i) => <rect key={i} x={i * 10} y={y + 26} width="10" height={180 - y - 26} fill="#191f30" />)}
      <g fill="#111827">
        <rect x="136" y="109" width="53" height="71" /><rect x="132" y="103" width="9" height="77" />
        <rect x="183" y="103" width="10" height="77" /><rect x="151" y="91" width="22" height="89" />
        <rect x="149" y="87" width="6" height="8" /><rect x="158" y="87" width="6" height="8" /><rect x="168" y="87" width="6" height="8" />
        <rect x="130" y="99" width="4" height="9" /><rect x="138" y="99" width="4" height="9" /><rect x="182" y="99" width="4" height="9" /><rect x="190" y="99" width="4" height="9" />
      </g>
      <g fill="#d7a35a"><rect x="158" y="102" width="5" height="7" /><rect x="136" y="118" width="3" height="5" /><rect x="185" y="118" width="3" height="5" /></g>
      <rect x="153" y="153" width="20" height="27" fill="#090f1a" />
      <rect x="149" y="177" width="28" height="3" fill="#5b4d4a" />
      {Array.from({ length: 16 }, (_, i) => <g key={i} fill={i % 2 ? "#101925" : "#151e2a"}>
        <rect x={i * 24 - 17} y={147 + i % 3 * 3} width="15" height="12" />
        <rect x={i * 24 - 20} y={158 + i % 3 * 3} width="21" height="22" />
      </g>)}
    </svg>
  </div>;
}
