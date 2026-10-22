// 가운데 목록 열: 검색창, 기기 추가 버튼, "보유 기기 → 전체 기기" 목록
// ("선택됨" 구역은 다음 단계에서 클릭 선택과 함께 추가)
import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { normalize } from '../catalog'
import { listDevices } from '../repo'
import type { Device, DeviceCategory } from '../types'
import { AddDeviceDialog } from './AddDeviceDialog'
import { DeviceDetailDialog } from './DeviceDetailDialog'

interface Props {
  category: DeviceCategory
}

export function DeviceList({ category }: Props) {
  // useLiveQuery: DB를 읽고, DB 내용이 바뀌면 자동으로 다시 읽는 Dexie 훅.
  // 처음 읽는 동안에는 undefined가 들어온다
  const devices = useLiveQuery(listDevices)
  const [query, setQuery] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  // 상세 팝업에 보여줄 기기 id (null이면 닫힘)
  const [detailId, setDetailId] = useState<string | null>(null)

  // 현재 카테고리 + 검색어로 거른다. 검색은 기기 추가 팝업과 같은 방식(공백·기호 무시)
  const words = query.split(/\s+/).map(normalize).filter(Boolean)
  const visible = (devices ?? []).filter((d) => {
    if (d.category !== category) return false
    const name = normalize(`${d.brand} ${d.model}`)
    return words.every((w) => name.includes(w))
  })

  // owned는 인덱스가 없어서 JS의 filter로 나눈다
  const sections = [
    { title: '보유 기기', items: visible.filter((d) => d.owned) },
    { title: '전체 기기', items: visible.filter((d) => !d.owned) },
  ]

  return (
    <aside className="list-col">
      <div className="list-search">
        <input type="search" placeholder="기기 검색" value={query} onChange={(e) => setQuery(e.target.value)} />
        <button className="icon-btn" onClick={() => setAddOpen(true)} title="기기 추가" aria-label="기기 추가">
          +
        </button>
      </div>

      <div className="list-scroll">
        {devices === undefined && <p className="list-empty muted">불러오는 중…</p>}
        {devices !== undefined && visible.length === 0 && (
          <p className="list-empty muted">
            {query ? '검색 결과가 없습니다.' : '기기가 없습니다. + 버튼으로 추가하세요.'}
          </p>
        )}
        {visible.length > 0 &&
          sections.map(
            (section) =>
              section.items.length > 0 && (
                <section key={section.title} className="list-section">
                  <h2>{section.title}</h2>
                  <ul>
                    {section.items.map((device) => (
                      <DeviceRow key={device.id} device={device} onMore={() => setDetailId(device.id)} />
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

function DeviceRow({ device, onMore }: { device: Device; onMore: () => void }) {
  return (
    <li className="device-row">
      <span className="device-name">
        {device.brand} {device.model}
      </span>
      <button className="more-btn" onClick={onMore} title="기기 정보·측정치 관리" aria-label="기기 정보">
        ⋯
      </button>
    </li>
  )
}
