// 기기 상세 팝업: 보유 여부, 측정치 목록·추가·삭제, 기기 삭제
// 목록에서 기기를 클릭하면 "비교 선택"이 되므로, 관리 기능은 각 줄의 ⋯ 버튼으로 여기서 한다
import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { categoryLabels, channelLabels, rigLabels } from '../labels'
import { deleteDevice, deleteMeasurement, getDevice, listMeasurementsByDevice, setDeviceOwned } from '../repo'
import { MeasurementUpload } from './MeasurementUpload'
import { Modal } from './Modal'

interface Props {
  /** 보여줄 기기 id. null이면 팝업이 닫힌 상태 */
  deviceId: string | null
  onClose: () => void
}

export function DeviceDetailDialog({ deviceId, onClose }: Props) {
  const device = useLiveQuery(() => (deviceId ? getDevice(deviceId) : undefined), [deviceId])
  const title = device ? `${device.brand} ${device.model}` : ''

  return (
    <Modal open={deviceId !== null} onClose={onClose} title={title}>
      {device && <DeviceDetailBody key={device.id} deviceId={device.id} onDeleted={onClose} />}
    </Modal>
  )
}

function DeviceDetailBody({ deviceId, onDeleted }: { deviceId: string; onDeleted: () => void }) {
  const device = useLiveQuery(() => getDevice(deviceId), [deviceId])
  const measurements = useLiveQuery(() => listMeasurementsByDevice(deviceId), [deviceId])
  const [uploadOpen, setUploadOpen] = useState(false)

  if (!device || !measurements) return null
  const name = `${device.brand} ${device.model}`

  async function handleDelete() {
    const count = measurements?.length ?? 0
    const message = count > 0 ? `${name}과 측정치 ${count}개를 삭제할까요?` : `${name}을 삭제할까요?`
    if (!confirm(message)) return
    await deleteDevice(deviceId)
    onDeleted()
  }

  return (
    <div className="detail">
      <div className="row">
        <span className="tag">{categoryLabels[device.category]}</span>
        <label className="check">
          <input type="checkbox" checked={device.owned} onChange={(e) => setDeviceOwned(deviceId, e.target.checked)} />
          보유
        </label>
      </div>
      {device.notes && <p className="muted small">{device.notes}</p>}

      <h3>측정치 {measurements.length}개</h3>
      {measurements.length === 0 && <p className="muted small">측정치가 없습니다. CSV를 올려 추가하세요.</p>}
      <ul className="measurements">
        {measurements.map((m) => (
          <li key={m.id}>
            <span>
              {m.variant || '기본 구성'} · {rigLabels[m.rig]} · {channelLabels[m.channel]} ·{' '}
              <span className="muted">
                {m.source === 'local' ? '직접 업로드' : m.source} · {m.curve.length}포인트
              </span>
            </span>
            <button className="link danger" onClick={() => deleteMeasurement(m.id)}>
              삭제
            </button>
          </li>
        ))}
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
