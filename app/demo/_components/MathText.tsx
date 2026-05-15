/**
 * MathText — `$...$` 인라인 / `$$...$$` 블록 LaTeX 를 KaTeX 로 렌더.
 *
 * 사용:
 *   <MathText>{`함수 $f(x) = x^2 + x$ 의 값은?`}</MathText>
 *
 * 정책:
 *   - server·client 양쪽 호환 (katex 는 isomorphic).
 *   - KaTeX 파싱 실패 시 raw 문자열로 fallback (throwOnError: false).
 *   - 일반 텍스트는 whitespace-pre-wrap — 줄바꿈 유지.
 */

import katex from "katex"

// $$...$$ 또는 $...$ 매칭. 단순화 위해 백슬래시 escape 무시.
const TOKEN_RE = /(\$\$[^$]+\$\$|\$[^$\n]+\$)/g

type Part = { kind: "text"; value: string } | { kind: "math"; value: string; display: boolean }

function tokenize(input: string): Part[] {
  const parts: Part[] = []
  let lastEnd = 0
  for (const m of input.matchAll(TOKEN_RE)) {
    const idx = m.index ?? 0
    if (idx > lastEnd) {
      parts.push({ kind: "text", value: input.slice(lastEnd, idx) })
    }
    const raw = m[0]
    const display = raw.startsWith("$$")
    const inner = display ? raw.slice(2, -2) : raw.slice(1, -1)
    parts.push({ kind: "math", value: inner, display })
    lastEnd = idx + raw.length
  }
  if (lastEnd < input.length) {
    parts.push({ kind: "text", value: input.slice(lastEnd) })
  }
  return parts
}

function renderMath(latex: string, display: boolean): string {
  try {
    return katex.renderToString(latex, {
      throwOnError: false,
      displayMode: display,
      output: "html",
      strict: "ignore",
    })
  } catch {
    return `$${latex}$`
  }
}

type Props = {
  children: string
  /** 추가 클래스 (가장 바깥 span). */
  className?: string
  /** 줄바꿈 보존 (기본 true). */
  preserveWhitespace?: boolean
}

export function MathText({
  children,
  className,
  preserveWhitespace = true,
}: Props) {
  const parts = tokenize(children)
  return (
    <span
      className={className}
      style={preserveWhitespace ? { whiteSpace: "pre-wrap" } : undefined}
    >
      {parts.map((p, i) =>
        p.kind === "math" ? (
          <span
            key={i}
            dangerouslySetInnerHTML={{ __html: renderMath(p.value, p.display) }}
          />
        ) : (
          <span key={i}>{p.value}</span>
        ),
      )}
    </span>
  )
}
