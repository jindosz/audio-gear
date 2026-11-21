// 측정치 미리 받기(추천용 데이터) 상자: 한 종류(헤드폰/이어폰)의 AutoEQ 추천 측정치를 요약해 저장한다(summaryJob.ts).
// 몇 개 받았는지, 받기 시작/이어 받기/멈추기. 비슷한 기기 찾기 팝업과 설정 화면이 함께 쓴다.
// 받아 두면 비슷한 기기 찾기의 후보가 되고, 기기 목록 줄에 성향 태그가 보인다
import { useLiveQuery } from 'dexie-react-hooks'
import { categoryLabels } from '../labels'
import { listSummaries } from '../repo'
import { startSummaryJob, stopSummaryJob, useSummaryJob } from '../summaryJob'
import type { DeviceCategory } from '../types'
import { useCatalogDevices } from '../useCatalogDevices'

/** 추천용 데이터 받기 상자: 몇 개 받았는지, 받기 시작/이어 받기/멈추기 */
export function CatalogDataBox({ category, saved: savedProp, title }: { category: DeviceCategory; saved?: number; title?: string }) {
  // 저장된 개수를 넘겨받지 않았으면(설정 화면) 직접 센다
  const counted = useLiveQuery(() => (savedProp === undefined ? listSummaries(category).then((l) => l.length) : 0), [category, savedProp])
  const saved = savedProp ?? counted ?? 0
  const job = useSummaryJob()
  const { catalogDevices } = useCatalogDevices()
  // 이 카테고리에서 측정치를 받을 수 있는 기기 수(AutoEQ + squig.link에만 있는 기기) = 받을 수 있는 최대 개수.
  // squig.link 목록을 아직 받는 중이면 AutoEQ 기기만 세고, 다 받으면 늘어난다
  const available = catalogDevices?.filter((d) => d.category === category && d.primary).length
  const running = job.status === 'running' || job.status === 'stopping'
  const thisJob = job.category === category
  const total = available ?? (thisJob ? job.total : 0)
  const percent = total ? Math.min(100, Math.round((saved / total) * 100)) : 0

  let message = ''
  if (running && !thisJob) message = '다른 종류를 받는 중이에요'
  else if (running) message = `받는 중 ${percent}%${job.failed ? ` · 실패 ${job.failed}개` : ''} (닫아도 계속 받아요)`
  else if (thisJob && job.status === 'error') message = `오류: ${job.error}`
  else if (saved === 0) message = `받으면 ${categoryLabels[category]} 전체의 성향 태그가 보이고 비슷한 기기 찾기 후보가 돼요(처음 한 번, 수 분~수십 분)`
  else if (thisJob && job.failed) message = `실패 ${job.failed}개 — "이어 받기"로 다시 시도`

  return (
    <div className="data-box">
      <div className="row">
        <span className="small">
          {title ?? '추천 데이터'} <strong>{saved.toLocaleString()}</strong>
          {total > 0 && ` / ${total.toLocaleString()}개`}
        </span>
        {running && thisJob ? (
          <button type="button" className="small" onClick={stopSummaryJob} disabled={job.status === 'stopping'}>
            {job.status === 'stopping' ? '멈추는 중…' : '멈추기'}
          </button>
        ) : (
          (total === 0 || saved < total) && (
            <button type="button" className="small primary" onClick={() => startSummaryJob(category)} disabled={running}>
              {saved > 0 ? '이어 받기' : '받기 시작'}
            </button>
          )
        )}
      </div>
      {total > 0 && <progress max={100} value={percent} />}
      {message && <p className="muted small">{message}</p>}
    </div>
  )
}
