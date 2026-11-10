// Sparkline enxuta — curva acumulada da métrica no período. Dado real, não
// enfeite: mostra como o número foi construído ao longo da janela. SVG inline,
// sem biblioteca. Estática (sem motion) — o painel é register product.

const W = 100;
const H = 32;

export function Sparkline({
  valores,
  cor = "var(--primary)",
  className = "",
}: {
  valores: number[];
  /** Cor da linha e do preenchimento (usa a própria cor em baixa opacidade). */
  cor?: string;
  className?: string;
}) {
  // Menos de 2 pontos não desenha curva — mostra uma linha de base discreta.
  if (valores.length < 2) {
    return (
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className={className}
        aria-hidden="true"
      >
        <line
          x1="0"
          y1={H - 1}
          x2={W}
          y2={H - 1}
          stroke="var(--line)"
          strokeWidth="1.5"
          strokeDasharray="3 4"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    );
  }

  const max = Math.max(...valores);
  const min = Math.min(...valores);
  const span = max - min || 1;
  const stepX = W / (valores.length - 1);
  // Deixa 2px de respiro em cima e embaixo pra linha não encostar na borda.
  const y = (v: number) => H - 2 - ((v - min) / span) * (H - 4);

  const pts = valores.map((v, i) => `${(i * stepX).toFixed(2)},${y(v).toFixed(2)}`);
  const linha = `M ${pts.join(" L ")}`;
  const area = `${linha} L ${W},${H} L 0,${H} Z`;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className={className}
      aria-hidden="true"
    >
      <path d={area} fill={cor} opacity="0.1" />
      <path
        d={linha}
        fill="none"
        stroke={cor}
        strokeWidth="1.75"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
