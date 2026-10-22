// 가운데 목록 열: 검색창, 기기 추가 버튼, "선택됨 → 보유 기기 → 전체 기기" 목록
import { useState, type CSSProperties } from 'react'
import { normalize } from '../catalog'
import { toggleSelection } from '../repo'
import { PALETTE_SIZE, seriesColor } from '../selection'
import type { Device, DeviceCategory, Measurement } from '../types'
import { useCompareData } from '../useCompareData'
import { AddDeviceDialog } from './AddDeviceDialog'
import { DeviceDetailDialog } from './DeviceDetailDialog'

interface Props {
  category: DeviceCategory
}

export function DeviceList({ category }: Props) {
  const { loading, devices, measurementsByDevice, selected } = useCompareData()
  const [query, setQuery] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  // 상세 팝업에 보여줄 기기 id (null이면 닫힘)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [notice, setNotice] = useState('')

  // 선택된 기기는 "선택됨"으로 올라가고 원래 구역에서는 빠진다
  const selectedDeviceIds = new Set(selected.map((s) => s.device.id))

  // 현재 카테고리 + 검색어로 거른다. 검색은 기기 추가 팝업과 같은 방식(공백·기호 무시)
  const words = query.split(/\s+/).map(normalize).filter(Boolean)
  const visible = devices.filter((d) => {
    if (d.category !== category || selectedDeviceIds.has(d.id)) return false
    const name = normalize(`${d.brand} ${d.model}`)
    return words.every((w) => name.includes(w))
  })

  // owned는 인덱스가 없어서 JS의 filter로 나눈다
  const sections = [
    { title: '보유 기기', items: visible.filter((d) => d.owned) },
    { title: '전체 기기', items: visible.filter((d) => !d.owned) },
  ]

  async function handleSelect(device: Device) {
    setNotice('')
    const first = measurementsByDevice.get(device.id)?.[0]
    if (!first) {
      // 측정치가 없으면 그래프에 그릴 게 없으니, 측정치를 추가할 수 있는 상세 팝업을 연다
      setDetailId(device.id)
      return
    }
    const result = await toggleSelection(first.id)
    if (result === 'full') setNotice(`최대 ${PALETTE_SIZE}개까지 비교할 수 있습니다. 하나를 해제한 뒤 선택하세요.`)
  }

  async function handleUnselect(measurementId: string) {
    setNotice('')
    await toggleSelection(measurementId)
  }

  return (
    <aside className="list-col">
      <div className="list-search">
        <input type="search" placeholder="기기 검색" value={query} onChange={(e) => setQuery(e.target.value)} />
        <button className="icon-btn" onClick={() => setAddOpen(true)} title="기기 추가" aria-label="기기 추가">
          +
        </button>
      </div>

      <div className="list-scroll">
        {notice && <p className="list-notice small">{notice}</p>}

        {/* 선택됨: 그래프에 무엇이 그려지는지 항상 보이도록 카테고리·검색과 상관없이 모두 표시 */}
        {selected.length > 0 && (
          <section className="list-section">
            <h2>
              선택됨 {selected.length}
            </h2>
            <ul>
              {selected.map(({ selection, measurement, device }) => (
                <DeviceRow
                  key={selection.measurementId}
                  device={device}
                  measurement={measurement}
                  colorIndex={selection.colorIndex}
                  onClick={() => handleUnselect(selection.measurementId)}
                  onMore={() => setDetailId(device.id)}
                />
              ))}
            </ul>
          </section>
        )}

        {loading && <p className="list-empty muted">불러오는 중…</p>}
        {!loading && visible.length === 0 && (query || selected.length === 0) && (
          <p className="list-empty muted">{query ? '검색 결과가 없습니다.' : '기기가 없습니다. + 버튼으로 추가하세요.'}</p>
        )}
        {sections.map(
          (section) =>
            section.items.length > 0 && (
              <section key={section.title} className="list-section">
                <h2>{section.title}</h2>
                <ul>
                  {section.items.map((device) => (
                    <DeviceRow
                      key={device.id}
                      device={device}
                      noMeasurement={!measurementsByDevice.has(device.id)}
                      onClick={() => handleSelect(device)}
                      onMore={() => setDetailId(device.id)}
                    />
                  ))}
                </ul>
              </section>
            ),
        )}
      </div>

      <AddDeviceDialog open={addOpen} onClose={() => setAddOpen(false)} />
      <DeviceDetailDialog deviceId={detailId} onClose={() => setDetailId(null)} />
    </aside>
  )
}

interface RowProps {
  device: Device
  /** 선택된 줄일 때만: 선택된 측정치와 색 순번 */
  measurement?: Measurement
  colorIndex?: number
  noMeasurement?: boolean
  onClick: () => void
  onMore: () => void
}

function DeviceRow({ device, measurement, colorIndex, noMeasurement, onClick, onMore }: RowProps) {
  const isSelected = colorIndex !== undefined
  // --c: 이 줄의 색. CSS에서 배경(연한 색)과 왼쪽 띠(진한 색)에 쓴다
  const style = isSelected ? ({ '--c': seriesColor(colorIndex) } as CSSProperties) : undefined

  return (
    <li className={isSelected ? 'device-row selected' : 'device-row'} style={style}>
      <button className="row-main" onClick={onClick} aria-pressed={isSelected}>
        <span className="device-name">
          {device.brand} {device.model}
          {isSelected && device.owned && <span className="tag">보유</span>}
        </span>
        {measurement && (
          <span className="device-sub muted">
            {measurement.variant || (measurement.source === 'local' ? '직접 업로드' : measurement.source)}
          </span>
        )}
        {noMeasurement && <span className="device-sub muted">측정치 없음</span>}
      </button>
      <button className="more-btn" onClick={onMore} title="기기 정보·측정치 관리" aria-label="기기 정보">
        ⋯
      </button>
    </li>
  )
}
