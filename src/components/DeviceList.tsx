// 가운데 목록 열: 검색창, 기기 추가 버튼, "선택됨 → 보유 기기 → 찜한 기기 → 전체 기기" 목록
// 전체 기기 = 내가 가진 기기(보유 제외) + AutoEQ 목록의 모든 기기. 수천 개라 가상 스크롤로 그린다.
import { useMemo, useRef, useState, type CSSProperties } from 'react'
import { addFromCatalog, normalize, splitBrand, type CatalogDevice } from '../catalog'
import { measurementLabel, specTags } from '../labels'
import { addDevice, setDeviceWishlist, toggleSelection } from '../repo'
import { PALETTE_SIZE, seriesColor } from '../selection'
import type { Device, DeviceCategory } from '../types'
import { useCatalogDevices } from '../useCatalogDevices'
import { useCompareData } from '../useCompareData'
import { AddDeviceDialog } from './AddDeviceDialog'
import { DeviceDetailDialog } from './DeviceDetailDialog'
import { VirtualList } from './VirtualList'

interface Props {
  category: DeviceCategory
  /** 선택을 저장할 비교 탭 */
  tabId: string | undefined
}

/** 전체 기기 목록의 한 줄: 내 DB에 있는 기기이거나, 아직 받지 않은 AutoEQ 기기 */
type ListItem = { kind: 'mine'; name: string; device: Device } | { kind: 'catalog'; name: string; entry: CatalogDevice }

/** 가상 스크롤 줄 높이(px). index.css의 .device-row.compact 높이와 같아야 한다 */
const ROW_HEIGHT = 40

const deviceName = (d: Device) => `${d.brand} ${d.model}`

/**
 * 이름 옆(아래)에 보일 설명: 측정치가 없으면 그 사실, 있으면 입력해 둔 특징 태그.
 * 전체 기기 줄(compact)은 한 줄이라 태그를 앞의 2개만 보여준다
 */
function deviceSub(d: Device, hasMeasurement: boolean, compact = false): string | undefined {
  if (!hasMeasurement) return '측정치 없음'
  const tags = specTags(d)
  return (compact ? tags.slice(0, 2) : tags).join(' · ') || undefined
}

export function DeviceList({ category, tabId }: Props) {
  const { loading, devices, measurementsByDevice, selected } = useCompareData(tabId)
  const { catalogDevices, catalogError } = useCatalogDevices()
  const [query, setQuery] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  // 상세 팝업에 보여줄 기기 id (null이면 닫힘)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [notice, setNotice] = useState('')
  // 측정치를 받는 중인 AutoEQ 기기 이름
  const [pendingName, setPendingName] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  // 이름 → AutoEQ 기기. 측정치 없는 내 기기를 클릭했을 때 AutoEQ에서 받아올 수 있는지 찾는 데 쓴다.
  // 목록(6천 개)이 바뀔 때만 다시 만든다
  const catalogByName = useMemo(() => new Map((catalogDevices ?? []).map((e) => [e.name, e])), [catalogDevices])

  // 선택된 기기는 "선택됨"으로 올라가고 원래 구역에서는 빠진다
  const selectedDeviceIds = new Set(selected.map((s) => s.device.id))

  // 현재 카테고리 + 검색어로 거른다. 검색은 기기 추가 팝업과 같은 방식(공백·기호 무시)
  const words = query.split(/\s+/).map(normalize).filter(Boolean)
  const matches = (searchKey: string) => words.every((w) => searchKey.includes(w))

  const mine = devices.filter(
    (d) => d.category === category && !selectedDeviceIds.has(d.id) && matches(normalize(deviceName(d))),
  )
  // owned·wishlist는 인덱스가 없어서 JS의 filter로 나눈다. 보유 > 찜 > 전체 순으로 한 곳에만 보인다
  const owned = mine.filter((d) => d.owned)
  const wished = mine.filter((d) => !d.owned && d.wishlist)

  // 내 DB에 이미 있는 이름은 AutoEQ 쪽에서 빼서 한 번만 보이게 한다
  const myNames = new Set(devices.map(deviceName))
  const allItems: ListItem[] = [
    ...mine.filter((d) => !d.owned && !d.wishlist).map((d): ListItem => ({ kind: 'mine', name: deviceName(d), device: d })),
    ...(catalogDevices ?? [])
      .filter((e) => e.category === category && !myNames.has(e.name) && matches(e.searchKey))
      .map((e): ListItem => ({ kind: 'catalog', name: e.name, entry: e })),
  ].sort((a, b) => a.name.localeCompare(b.name))

  function full() {
    setNotice(`최대 ${PALETTE_SIZE}개까지 비교할 수 있습니다. 하나를 해제한 뒤 선택하세요.`)
  }

  async function handleSelectMine(device: Device) {
    setNotice('')
    const first = measurementsByDevice.get(device.id)?.[0]
    if (!first) {
      // 측정치가 없을 때: AutoEQ에 있으면 받아오고(찜만 해 둔 기기 등), 없으면 측정치를 추가할 상세 팝업을 연다
      const catalogEntry = catalogByName.get(deviceName(device))
      if (catalogEntry?.primary) return handleSelectCatalog(catalogEntry)
      setDetailId(device.id)
      return
    }
    if (!tabId) return
    if ((await toggleSelection(tabId, first.id)) === 'full') full()
  }

  /** AutoEQ 기기 클릭: 추천 측정치를 받아 내 DB에 저장하고 바로 선택한다 */
  async function handleSelectCatalog(entry: CatalogDevice) {
    setNotice('')
    if (!tabId || pendingName) return
    if (!entry.primary) {
      setNotice(`${entry.name}: 공개된 측정치가 없어 그래프에 그릴 수 없습니다.`)
      return
    }
    if (selected.length >= PALETTE_SIZE) return full() // 받기 전에 먼저 확인(헛걸음 방지)
    setPendingName(entry.name)
    try {
      const { measurementId } = await addFromCatalog(entry.primary, false)
      if (measurementId && (await toggleSelection(tabId, measurementId)) === 'full') full()
    } catch (err) {
      setNotice(`${entry.name}: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setPendingName(null)
    }
  }

  /** 아직 받지 않은 AutoEQ 기기 찜: 측정치까지 받아 내 기기로 저장하고 찜 표시 */
  async function handleWishCatalog(entry: CatalogDevice) {
    setNotice('')
    if (pendingName) return
    setPendingName(entry.name)
    try {
      const deviceId = entry.primary
        ? (await addFromCatalog(entry.primary, false)).deviceId
        : await addDevice({ ...splitBrand(entry.name), category: entry.category, owned: false, notes: '' })
      await setDeviceWishlist(deviceId, true)
    } catch (err) {
      setNotice(`${entry.name}: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setPendingName(null)
    }
  }

  async function handleUnselect(measurementId: string) {
    setNotice('')
    if (tabId) await toggleSelection(tabId, measurementId)
  }

  const nothing =
    !loading && catalogDevices !== null && owned.length === 0 && wished.length === 0 && allItems.length === 0

  return (
    <aside className="list-col">
      <div className="list-search">
        <input type="search" placeholder="기기 검색" value={query} onChange={(e) => setQuery(e.target.value)} />
        <button className="icon-btn" onClick={() => setAddOpen(true)} title="기기 추가" aria-label="기기 추가">
          +
        </button>
      </div>

      <div className="list-scroll" ref={scrollRef}>
        {notice && <p className="list-notice small">{notice}</p>}

        {/* 선택됨: 그래프에 무엇이 그려지는지 항상 보이도록 카테고리·검색과 상관없이 모두 표시 */}
        {selected.length > 0 && (
          <section className="list-section">
            <h2>선택됨 {selected.length}</h2>
            <ul>
              {selected.map(({ selection, measurement, device }) => (
                <Row
                  key={selection.measurementId}
                  name={deviceName(device)}
                  owned={device.owned}
                  sub={measurementLabel(measurement)}
                  colorIndex={selection.colorIndex}
                  starred={device.wishlist}
                  onClick={() => handleUnselect(selection.measurementId)}
                  onMore={() => setDetailId(device.id)}
                />
              ))}
            </ul>
          </section>
        )}

        {owned.length > 0 && (
          <section className="list-section">
            <h2>보유 기기</h2>
            <ul>
              {owned.map((d) => (
                <Row
                  key={d.id}
                  name={deviceName(d)}
                  sub={deviceSub(d, measurementsByDevice.has(d.id))}
                  onClick={() => handleSelectMine(d)}
                  onMore={() => setDetailId(d.id)}
                />
              ))}
            </ul>
          </section>
        )}

        {wished.length > 0 && (
          <section className="list-section">
            <h2>찜한 기기</h2>
            <ul>
              {wished.map((d) => (
                <Row
                  key={d.id}
                  name={deviceName(d)}
                  sub={deviceSub(d, measurementsByDevice.has(d.id))}
                  starred
                  onStar={() => setDeviceWishlist(d.id, false)}
                  onClick={() => handleSelectMine(d)}
                  onMore={() => setDetailId(d.id)}
                />
              ))}
            </ul>
          </section>
        )}

        <section className="list-section">
          <h2>
            전체 기기 <span className="count">{allItems.length.toLocaleString()}</span>
          </h2>
          {catalogDevices === null && !catalogError && <p className="list-empty muted small">AutoEQ 목록을 불러오는 중…</p>}
          {catalogError && <p className="list-empty error small">AutoEQ 목록을 불러오지 못했습니다: {catalogError}</p>}
          {nothing && <p className="list-empty muted">{query ? '검색 결과가 없습니다.' : '기기가 없습니다.'}</p>}
          <VirtualList
            items={allItems}
            rowHeight={ROW_HEIGHT}
            scrollRef={scrollRef}
            getKey={(item) => (item.kind === 'mine' ? item.device.id : `catalog:${item.name}`)}
            renderRow={(item, style) =>
              item.kind === 'mine' ? (
                <Row
                  compact
                  style={style}
                  name={item.name}
                  sub={deviceSub(item.device, measurementsByDevice.has(item.device.id), true)}
                  onStar={() => setDeviceWishlist(item.device.id, true)}
                  onClick={() => handleSelectMine(item.device)}
                  onMore={() => setDetailId(item.device.id)}
                />
              ) : (
                <Row
                  compact
                  style={style}
                  name={item.name}
                  sub={pendingName === item.name ? '받는 중…' : item.entry.primary ? undefined : '측정치 없음'}
                  onStar={() => handleWishCatalog(item.entry)}
                  onClick={() => handleSelectCatalog(item.entry)}
                />
              )
            }
          />
        </section>
      </div>

      <AddDeviceDialog open={addOpen} onClose={() => setAddOpen(false)} />
      <DeviceDetailDialog deviceId={detailId} tabId={tabId} onClose={() => setDetailId(null)} />
    </aside>
  )
}

interface RowProps {
  name: string
  /** 이름 아래(compact면 오른쪽)에 작게 보일 설명 */
  sub?: string
  owned?: boolean
  /** 선택된 줄일 때만: 색 순번 */
  colorIndex?: number
  /** 찜한 기기면 별을 채워서 항상 보여준다 */
  starred?: boolean
  /** 별(찜) 버튼을 눌렀을 때. 없으면 별 버튼을 그리지 않는다 */
  onStar?: () => void
  /** 가상 스크롤용 한 줄 모양(높이 고정) */
  compact?: boolean
  style?: CSSProperties
  onClick: () => void
  /** 없으면 ⋯ 버튼을 그리지 않는다(아직 받지 않은 AutoEQ 기기) */
  onMore?: () => void
}

function Row({ name, sub, owned, starred, onStar, colorIndex, compact, style, onClick, onMore }: RowProps) {
  const isSelected = colorIndex !== undefined
  const className = ['device-row', isSelected && 'selected', compact && 'compact'].filter(Boolean).join(' ')
  // --c: 이 줄의 색. CSS에서 배경(연한 색)과 왼쪽 띠(진한 색)에 쓴다
  const rowStyle = isSelected ? ({ ...style, '--c': seriesColor(colorIndex) } as CSSProperties) : style

  return (
    <li className={className} style={rowStyle}>
      <button className="row-main" onClick={onClick} aria-pressed={isSelected}>
        <span className="device-name">
          {name}
          {isSelected && owned && <span className="tag">보유</span>}
          {isSelected && starred && <span className="tag">찜</span>}
        </span>
        {sub && <span className="device-sub muted">{sub}</span>}
      </button>
      {onStar && (
        <button
          className={starred ? 'star-btn on' : 'star-btn'}
          onClick={onStar}
          aria-pressed={starred ?? false}
          title={starred ? '찜 해제' : '찜하기'}
          aria-label={starred ? '찜 해제' : '찜하기'}
        >
          {starred ? '★' : '☆'}
        </button>
      )}
      {onMore && (
        <button className="more-btn" onClick={onMore} title="기기 정보·측정치 관리" aria-label="기기 정보">
          ⋯
        </button>
      )}
    </li>
  )
}
