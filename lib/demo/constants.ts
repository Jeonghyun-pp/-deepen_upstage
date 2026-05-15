/**
 * 데모 상수 — 노드/문제별 UUID 가 아닌, 데이터셋 전체에 걸린 메타만 둔다.
 *
 * 노드/문제/청크 UUID 는 모두 data/demo/*.json 의 truth source 에서 옴.
 * 동적 lookup 은 lib/demo/data-loader.ts 사용.
 */

import { DEMO_DOCUMENT } from "./data-loader"

/**
 * 데모 데이터를 식별·삭제할 때 쓰는 meta 필드 키.
 * (nodes.meta.kind === "hackathon_demo")
 */
export const DEMO_META_FLAG = { kind: "hackathon_demo" as const }

/** 데모 문서 (NCIC 발췌) 의 안정 UUID — data-loader 단일 출처. */
export const DEMO_DOC_ID = DEMO_DOCUMENT.uuid
