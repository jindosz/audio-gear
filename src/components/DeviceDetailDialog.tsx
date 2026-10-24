// 기기 상세 팝업: 보유·찜, 주요 특징(연결·구조·코덱·ANC), 측정치 목록·추가·삭제, 비교에 쓸 측정치 고르기, 기기 삭제
// 목록에서 기기를 클릭하면 "비교 선택"이 되므로, 관리 기능은 각 줄의 ⋯ 버튼으로 여기서 한다
import { useState, type CSSProperties } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  acousticLabels,
  categoryLabels,
  channelLabels,
  CODECS,
  connectionLabels,
  rigLabels,
  sourceLabel,
  specTags,
} from '../labels'
import {
  deleteDevice,
  deleteMeasurement,
  getDevice,
  getTab,
  listMeasurementsByDevice,
  setDeviceOwned,
  setDeviceWishlist,
  toggleSelection,
  updateDeviceSpecs,
} from '../repo'
import { PALETTE_SIZE, seriesColor } from '../selection'
import { specHint } from '../specHints'
import type { Acoustic, Codec, Connection, Device } from '../types'
import { MeasurementUpload } from './MeasurementUpload'
import { Modal } from './Modal'
import { ToggleButton } from './ToggleButton'

interface Props {
  /** 보여줄 기기 id. null이면 팝업이 닫힌 상태 */
  deviceId: string | null
  /** 지금 보고 있는 비교 탭. 측정치를 이 탭의 비교에 넣고 뺀다 */
  tabId: string | undefined
  onClose: () => void
}

export function DeviceDetailDialog({ deviceId, tabId, onClose }: Props) {
  const device = useLiveQuery(() => (deviceId ? getDevice(deviceId) : undefined), [deviceId])
  const title = device ? `${device.brand} ${device.model}` : ''

  return (
    <Modal open={deviceId !== null} onClose={onClose} title={title}>
      {device && <DeviceDetailBody key={device.id} deviceId={device.id} tabId={tabId} onDeleted={onClose} />}
    </Modal>
  )
}

interface BodyProps {
  deviceId: string
  tabId: string | undefined
  onDeleted: () => void
}

function DeviceDetailBody({ deviceId, tabId, onDeleted }: BodyProps) {
  const device = useLiveQuery(() => getDevice(deviceId), [deviceId])
  const measurements = useLiveQuery(() => listMeasurementsByDevice(deviceId), [deviceId])
  const tab = useLiveQuery(() => (tabId ? getTab(tabId) : undefined), [tabId])
  const [uploadOpen, setUploadOpen] = useState(false)
  const [notice, setNotice] = useState('')

  if (!device || !measurements) return null
  const name = `${device.brand} ${device.model}`

  async function handleDelete() {
    const count = measurements?.length ?? 0
    const message = count > 0 ? `${name}과 측정치 ${count}개를 삭제할까요?` : `${name}을 삭제할까요?`
    if (!confirm(message)) return
    await deleteDevice(deviceId)
    onDeleted()
  }

  async function handleToggle(measurementId: string) {
    setNotice('')
    if (!tabId) return
    const result = await toggleSelection(tabId, measurementId)
    if (result === 'full') setNotice(`최대 ${PALETTE_SIZE}개까지 비교할 수 있습니다. 하나를 해제한 뒤 추가하세요.`)
  }

  return (
    <div className="detail">
      <div className="row">
        <span className="tag">{categoryLabels[device.category]}</span>
        <ToggleButton on={device.owned} onChange={(on) => setDeviceOwned(deviceId, on)}>
          보유
        </ToggleButton>
        <ToggleButton on={device.wishlist ?? false} onChange={(on) => setDeviceWishlist(deviceId, on)}>
          찜
        </ToggleButton>
      </div>
      {device.notes && <p className="muted small">{device.notes}</p>}

      <SpecsEditor device={device} />

      <h3>측정치 {measurements.length}개</h3>
      {measurements.length > 1 && (
        <p className="muted small">
          목록에서 기기를 클릭하면 첫 번째 측정치가 선택됩니다. 다른 측정치나 여러 측정치를 비교하려면 여기서 고르세요.
        </p>
      )}
      {notice && <p className="error small">{notice}</p>}
      {measurements.length === 0 && <p className="muted small">측정치가 없습니다. CSV를 올려 추가하세요.</p>}
      <ul className="measurements">
        {measurements.map((m) => {
          // 이 측정치가 지금 탭에서 선택되어 있으면 그 색 순번
          const colorIndex = tab?.selections.find((s) => s.measurementId === m.id)?.colorIndex
          const selected = colorIndex !== undefined
          return (
            <li
              key={m.id}
              className={selected ? 'selected' : undefined}
              style={selected ? ({ '--c': seriesColor(colorIndex) } as CSSProperties) : undefined}
            >
              <span className="measurement-text">
                {m.variant || '기본 구성'} · {rigLabels[m.rig]} · {channelLabels[m.channel]} ·{' '}
                <span className="muted">
                  {sourceLabel(m.source)} · {m.curve.length}포인트
                </span>
              </span>
              <span className="measurement-actions">
                <button className="small" onClick={() => handleToggle(m.id)} aria-pressed={selected} disabled={!tabId}>
                  {selected ? '비교에서 빼기' : '비교에 추가'}
                </button>
                <button className="link danger" onClick={() => deleteMeasurement(m.id)}>
                  삭제
                </button>
              </span>
            </li>
          )
        })}
      </ul>

      {uploadOpen ? (
        <MeasurementUpload deviceId={deviceId} onDone={() => setUploadOpen(false)} />
      ) : (
        <button className="link" onClick={() => setUploadOpen(true)}>
          + CSV로 측정치 추가
        </button>
      )}

      <div className="detail-foot">
        <button className="danger" onClick={handleDelete}>
          기기 삭제
        </button>
      </div>
    </div>
  )
}

/** 주요 특징 편집. 바꾸는 즉시 저장된다(따로 저장 버튼 없음) */
function SpecsEditor({ device }: { device: Device }) {
  const wireless = device.connection === 'wireless' || device.connection === 'both'
  const codecs = device.codecs ?? []

  function toggleCodec(codec: Codec, on: boolean) {
    // CODECS 순서를 유지한 채 켜고 끈다
    const next = CODECS.filter((c) => (c === codec ? on : codecs.includes(c)))
    void updateDeviceSpecs(device.id, { codecs: next })
  }

  return (
    <section className="specs">
      <h3>주요 특징</h3>
      <SpecHintLine device={device} />
      <div className="row">
        <label>
          연결{' '}
          <select
            value={device.connection ?? ''}
            onChange={(e) => updateDeviceSpecs(device.id, { connection: (e.target.value || undefined) as Connection | undefined })}
          >
            <option value="">모름</option>
            {Object.entries(connectionLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          구조{' '}
          <select
            value={device.acoustic ?? ''}
            onChange={(e) => updateDeviceSpecs(device.id, { acoustic: (e.target.value || undefined) as Acoustic | undefined })}
          >
            <option value="">모름</option>
            {Object.entries(acousticLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        {wireless && (
          <ToggleButton on={device.anc ?? false} onChange={(on) => updateDeviceSpecs(device.id, { anc: on })}>
            노이즈 캔슬링(ANC)
          </ToggleButton>
        )}
      </div>
      {/* 코덱은 무선(또는 유·무선)일 때만 의미가 있어서 그때만 보여준다 */}
      {wireless && (
        <div className="codecs">
          <span className="muted small">지원 코덱</span>
          {CODECS.map((codec) => (
            <ToggleButton key={codec} small on={codecs.includes(codec)} onChange={(on) => toggleCodec(codec, on)}>
              {codec}
            </ToggleButton>
          ))}
        </div>
      )}
    </section>
  )
}

/**
 * 이름으로 추정한 특징 안내. 아직 아무것도 입력하지 않았고 추정값이 있을 때만 보인다.
 * "추정값 적용"을 누르면 그때 기기에 저장된다(누르기 전에는 저장하지 않음)
 */
function SpecHintLine({ device }: { device: Device }) {
  const hint = specHint(`${device.brand} ${device.model}`, device.category)
  const hasAny = device.connection || device.acoustic || device.anc || device.codecs?.length
  if (!hint || hasAny) return null
  return (
    <p className="small spec-hint">
      <span className="muted">추정: </span>
      <span className="estimated">{specTags(hint).join(' · ')}</span>{' '}
      <button type="button" className="small" onClick={() => updateDeviceSpecs(device.id, hint)}>
        추정값 적용
      </button>
      <span className="muted"> · 이름으로 추정한 값이라 틀릴 수 있습니다. 적용한 뒤 고칠 수 있어요.</span>
    </p>
  )
}
