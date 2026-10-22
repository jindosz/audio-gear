// 기기 한 줄: 이름, 측정치 목록, 측정치 추가·삭제 버튼
import { useLiveQuery } from 'dexie-react-hooks'
import { channelLabels, rigLabels } from '../labels'
import { deleteDevice, deleteMeasurement, listMeasurementsByDevice, setDeviceOwned } from '../repo'
import type { Device } from '../types'
import { MeasurementUpload } from './MeasurementUpload'

interface Props {
  device: Device
  categoryLabel: string
  uploadOpen: boolean
  onToggleUpload: () => void
}

export function DeviceItem({ device, categoryLabel, uploadOpen, onToggleUpload }: Props) {
  // 두 번째 인자 [device.id]: 이 값이 바뀌면 쿼리를 새로 실행한다
  const measurements = useLiveQuery(() => listMeasurementsByDevice(device.id), [device.id])
  const name = `${device.brand} ${device.model}`

  async function handleDelete() {
    const count = measurements?.length ?? 0
    const message = count > 0 ? `${name}과 측정치 ${count}개를 삭제할까요?` : `${name}을 삭제할까요?`
    if (confirm(message)) await deleteDevice(device.id)
  }

  return (
    <li className="device">
      <div className="device-head">
        <div>
          <strong>{name}</strong> <span className="tag">{categoryLabel}</span>
          {device.notes && <div className="muted small">{device.notes}</div>}
        </div>
        <div className="actions">
          <label className="check">
            <input type="checkbox" checked={device.owned} onChange={(e) => setDeviceOwned(device.id, e.target.checked)} />
            보유
          </label>
          <button onClick={onToggleUpload}>{uploadOpen ? '닫기' : '측정치 추가'}</button>
          <button className="danger" onClick={handleDelete}>
            삭제
          </button>
        </div>
      </div>

      {measurements && measurements.length > 0 && (
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
      )}

      {uploadOpen && <MeasurementUpload deviceId={device.id} onDone={onToggleUpload} />}
    </li>
  )
}
