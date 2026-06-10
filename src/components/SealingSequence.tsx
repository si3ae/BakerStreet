import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ReportPaper, type ReportData } from './ReportPaper'
import envelopeOpenUrl from '../assets/envelope_open.png?url'
import envelopeClosedUrl from '../assets/envelope_closed.png?url'
import verdictStampUrl from '../assets/verdict_stamp.png?url'

// ─────────────────────────────────────────────────────────────────────────
// SealingSequence — verdict 봉인 클라이맥스.
//
// Stages:
//   1. 'reading'     리포트 + 'Seal & Send' 버튼 (종이 바로 밑)
//   2. 'folding_v'   종이 우측 절반이 좌측으로 접힘 (rotateY 0 → -180°, 1.0s)
//   3. 'sliding_in'  접힌 종이가 작아지며 봉투 안으로 (1.0s)
//   4. 'flap_close'  열린 봉투 → 닫힌 봉투 (0.6s)
//   5. 'stamping'    도장이 위에서 회전하며 내려와 박힘 (0.6s)
//   6. 'sealed'      정지 (1.0s) → onComplete
//
// ──── 종이 접기 (3D card-flip 정통 패턴) ────
//
//   paper-wrapper (flex col, height=ReportPaper.height + 버튼)
//   ├── 종이 컨테이너 (relative, height 결정)
//   │    ├── 좌측 절반 (relative, clip-path로 좌측 240만 보임) ← height 결정자
//   │    └── 우측 절반 컨테이너 (absolute, left=240, width=240)
//   │         └── 회전 div (rotateY 0 → -180, origin '0% 50%')
//   │              ├── FRONT (원래 텍스트, backface-hidden)
//   │              └── BACK  (빈 종이, transform rotateY(180), backface-hidden)
//   └── SEAL & SEND 버튼 (reading일 때만, marginTop: 22)
//
// 회전:
//   rotateY 0   → FRONT 카메라 향함, BACK는 -Z 향함 (안 보임)
//   rotateY -90 → 둘 다 edge-on (둘 다 안 보임 = 종이가 옆에서 본 직선)
//   rotateY -180→ FRONT는 -Z (안 보임), BACK는 +Z (보임). 좌측 240 영역에 위치.
//
// ─────────────────────────────────────────────────────────────────────────

type Stage =
  | 'reading'
  | 'folding_v'
  | 'sliding_in'
  | 'flap_close'
  | 'stamping'
  | 'sealed'

interface Props {
  open: boolean
  report: ReportData
  onComplete: () => void
}

const ENVELOPE_W = 460
const ENVELOPE_H = 280
const ENVELOPE_OPEN_H = 350
const STAMP_SIZE = 100

// ReportPaper.tsx의 width 값과 동기화
const REPORT_W = 480
const REPORT_MAX_BODY = 360

export function SealingSequence({ open, report, onComplete }: Props) {
  const [stage, setStage] = useState<Stage>('reading')

  useEffect(() => {
    if (!open) return
    if (stage === 'reading') return

    const TIMINGS: Record<Exclude<Stage, 'reading'>, number> = {
      folding_v: 1000,
      sliding_in: 1000,
      flap_close: 600,
      stamping: 600,
      sealed: 1000,
    }
    const next: Record<Exclude<Stage, 'reading'>, Stage | null> = {
      folding_v: 'sliding_in',
      sliding_in: 'flap_close',
      flap_close: 'stamping',
      stamping: 'sealed',
      sealed: null,
    }

    const ms = TIMINGS[stage as Exclude<Stage, 'reading'>]
    const t = setTimeout(() => {
      const n = next[stage as Exclude<Stage, 'reading'>]
      if (n) setStage(n)
      else onComplete()
    }, ms)
    return () => clearTimeout(t)
  }, [stage, open, onComplete])

  useEffect(() => {
    if (open) setStage('reading')
  }, [open])

  if (!open) return null

  const envelopeShown =
    stage === 'folding_v' ||
    stage === 'sliding_in' ||
    stage === 'flap_close' ||
    stage === 'stamping' ||
    stage === 'sealed'
  const paperShown =
    stage === 'reading' || stage === 'folding_v' || stage === 'sliding_in'

  // 접힘 각도 — folding_v 이후로 -180° 유지
  const rightHalfRotate = stage === 'reading' ? 0 : -180
  // 슬라이드 인 — sliding_in일 때 봉투 방향으로 작아지며 사라짐
  const slideTransform =
    stage === 'sliding_in'
      ? { scale: 0.32, y: 280, opacity: 0 }
      : { scale: 1, y: 0, opacity: 1 }

  // 접힘 중/후엔 좌측 절반 우측 가장자리에 그림자 (접힌 종이가 얹힌 느낌)
  const leftHalfShadow =
    stage === 'folding_v' || stage === 'sliding_in'
      ? 'inset -8px 0 14px rgba(0,0,0,0.1)'
      : 'none'

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(20, 18, 14, 0.85)',
        zIndex: 150,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        overflowY: 'auto',   // 좁은 viewport 안전망
        fontFamily: "'Traveling _Typewriter', 'Courier Prime', monospace",
      }}
    >
      <div
        style={{
          position: 'relative',
          width: ENVELOPE_W + 100,
          minHeight: 640,
        }}
      >
        {/* ─────────── 종이 ─────────── */}
        <AnimatePresence>
          {paperShown && (
            <motion.div
              key="paper-wrapper"
              initial={false}
              animate={slideTransform}
              transition={{ duration: 1.0, ease: [0.4, 0, 0.2, 1] }}
              style={{
                position: 'absolute',
                top: 30,
                left: '50%',
                marginLeft: -REPORT_W / 2,
                width: REPORT_W,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                perspective: 1600,
              }}
            >
              {/* 종이 컨테이너 — 좌/우 두 절반을 담음 */}
              <div
                style={{
                  position: 'relative',
                  width: REPORT_W,
                  transformStyle: 'preserve-3d',
                }}
              >
                {/* 좌측 절반 — folding_v 이상에서만 clipPath로 우측 50% 잘라냄.
                    reading 단계엔 clipPath 없이 종이 풀로 보여줘서 사용자가
                    종이 전체를 읽을 수 있게.
                    SEAL & SEND 버튼은 ReportPaper의 footerExtra로 종이 안에 박힘. */}
                <div
                  style={{
                    position: 'relative',
                    width: REPORT_W,
                    clipPath: stage === 'reading' ? 'none' : 'inset(0 50% 0 0)',
                    boxShadow: leftHalfShadow,
                    transition: 'box-shadow 0.4s',
                  }}
                >
                  <ReportPaper
                    data={report}
                    maxBodyHeight={REPORT_MAX_BODY}
                    footerExtra={
                      stage === 'reading' ? (
                        <button
                          onClick={() => setStage('folding_v')}
                          style={{
                            fontFamily: 'inherit',
                            background: '#2A2520',
                            color: '#FAF6EC',
                            fontSize: 13,
                            fontWeight: 700,
                            letterSpacing: 2,
                            padding: '10px 28px',
                            border: 'none',
                            cursor: 'pointer',
                            boxShadow: '0 3px 0 rgba(0,0,0,0.3)',
                          }}
                        >
                          ✉ SEAL & SEND
                        </button>
                      ) : null
                    }
                  />
                </div>

                {/* 우측 절반 컨테이너 — 종이 중앙선이 회전축.
                    reading 단계엔 우측 시각 불필요 + 좌측만 스크롤 가능하게.
                    folding_v 부터만 mount되어 회전 시각화 담당. */}
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: REPORT_W / 2,
                    width: REPORT_W / 2,
                    height: '100%',
                    transformStyle: 'preserve-3d',
                    // reading 단계: 시각 + hit 둘 다 차단.
                    visibility: stage === 'reading' ? 'hidden' : 'visible',
                    pointerEvents: 'none',
                  }}
                >
                  <motion.div
                    initial={false}
                    animate={{ rotateY: rightHalfRotate }}
                    transition={{ duration: 1.0, ease: [0.4, 0, 0.2, 1] }}
                    style={{
                      position: 'relative',
                      width: '100%',
                      height: '100%',
                      transformOrigin: '0% 50%',  // 좌측 edge가 회전축 = 종이 중앙선
                      transformStyle: 'preserve-3d',
                    }}
                  >
                    {/* FRONT — 원래 텍스트 (ReportPaper 우측 240).
                        ReportPaper를 통째 -240 밀어서 이 컨테이너(width 240) 안에선
                        우측 절반만 보임. 부모 컨테이너 overflow 의존 없이
                        clip-path로 직접 자름 (좌측 240은 잘림 = 좌측 절반 div와 겹침 방지).
                        backface-hidden으로 회전 -90° 넘어가면 사라짐.

                        pointerEvents: 'none' — 이 인스턴스는 *시각만*. 사용자 스크롤은
                        좌측 ReportPaper 인스턴스에서만 동작. 이걸 안 막으면 좌우 BODY가
                        독립적으로 스크롤되어 어긋남. */}
                    <div
                      style={{
                        position: 'absolute',
                        left: -REPORT_W / 2,
                        top: 0,
                        width: REPORT_W,
                        clipPath: 'inset(0 0 0 50%)',  // 좌측 240 잘라냄
                        backfaceVisibility: 'hidden',
                        WebkitBackfaceVisibility: 'hidden',
                        pointerEvents: 'none',
                      }}
                    >
                      <ReportPaper data={report} maxBodyHeight={REPORT_MAX_BODY} />
                    </div>

                    {/* BACK — 빈 종이 (접힌 종이의 뒷면).
                        rotateY(180)으로 초기엔 -Z 향함 → 안 보임.
                        부모가 rotateY -180 되면 합쳐서 0 → 카메라 향함 → 보임. */}
                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        transform: 'rotateY(180deg)',
                        backfaceVisibility: 'hidden',
                        WebkitBackfaceVisibility: 'hidden',
                        background: '#EDE5D2',
                        backgroundImage:
                          'repeating-linear-gradient(180deg, transparent 0 30px, rgba(0,0,0,0.025) 30px 31px)',
                        borderLeft: '1px solid #C7B89A',
                        boxShadow: 'inset 4px 0 10px rgba(0,0,0,0.1)',
                      }}
                    />
                  </motion.div>
                </div>
              </div>

              {/* SEAL & SEND는 이제 ReportPaper 안 (footerExtra) — 위 참조 */}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ─────────── 봉투 ─────────── */}
        <AnimatePresence>
          {envelopeShown && (
            <motion.img
              key={
                stage === 'folding_v' || stage === 'sliding_in'
                  ? 'envOpen'
                  : 'envClosed'
              }
              src={
                stage === 'folding_v' || stage === 'sliding_in'
                  ? envelopeOpenUrl
                  : envelopeClosedUrl
              }
              alt=""
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.45, ease: 'easeOut' }}
              style={{
                position: 'absolute',
                bottom: 80,
                left: '50%',
                marginLeft: -ENVELOPE_W / 2,
                width: ENVELOPE_W,
                height:
                  stage === 'folding_v' || stage === 'sliding_in'
                    ? ENVELOPE_OPEN_H
                    : ENVELOPE_H,
                objectFit: 'contain',
                filter: 'drop-shadow(0 8px 24px rgba(0,0,0,0.3))',
              }}
            />
          )}
        </AnimatePresence>

        {/* ─────────── 도장 ─────────── */}
        <AnimatePresence>
          {(stage === 'stamping' || stage === 'sealed') && (
            <motion.img
              key="stamp"
              src={verdictStampUrl}
              alt=""
              initial={{ scale: 2.2, opacity: 0, rotate: -25, y: -120 }}
              animate={{ scale: 1, opacity: 1, rotate: -8, y: 0 }}
              transition={{ duration: 0.55, ease: [0.5, 0, 0.5, 1] }}
              style={{
                position: 'absolute',
                bottom: 80 + ENVELOPE_H / 2 - STAMP_SIZE / 2 - 10,
                left: '50%',
                marginLeft: -STAMP_SIZE / 2,
                width: STAMP_SIZE,
                height: STAMP_SIZE,
                filter: 'drop-shadow(0 4px 10px rgba(0,0,0,0.5))',
                pointerEvents: 'none',
              }}
            />
          )}
        </AnimatePresence>

        {/* 단계 라벨 */}
        <div
          style={{
            position: 'absolute',
            bottom: 30,
            left: 0,
            right: 0,
            textAlign: 'center',
            color: '#8A7B5F',
            fontSize: 10,
            letterSpacing: 3,
          }}
        >
          {stage === 'reading' && '· REVIEW BEFORE SEALING ·'}
          {stage === 'folding_v' && '· FOLDING IN HALF ·'}
          {stage === 'sliding_in' && '· INTO THE ENVELOPE ·'}
          {stage === 'flap_close' && '· SEALING ·'}
          {stage === 'stamping' && '· STAMPING ·'}
          {stage === 'sealed' && '· CASE SEALED ·'}
        </div>
      </div>
    </motion.div>
  )
}
