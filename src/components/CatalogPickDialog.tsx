// EQ 화면의 "다른 기기 찾기" 팝업: 전체 기기 목록(AutoEQ + squig.link)에서 검색해 고르면
// 그 기기의 측정치를 받아 DB에 저장하고 측정치 id를 돌려준다(기기 목록에서 기기를 누를 때와 같은 방식).
// 맞출 측정자가 있으면 그 측정자의 측정치를 먼저 고른다(측정자가 다르면 EQ가 부정확해짐)
import { useState } from 'react'
import { addFromCatalog, catalogSourceLabel } from '../catalog'
import { isSameSource, pickCatalogEntry, searchCatalogDevices } from '../catalogPick'
import { categoryLabels, sourceLabel } from '../labels'
import type { DeviceCategory } from '../types'
import { useCatalogDevices } from '../useCatalogDevices'
import { Modal } from './Modal'

interface Props {
  open: boolean
  onClose: () => void
  title: string
  /** 이 종류(헤드폰/이어폰)를 먼저 보여준다 */
  preferCategory: DeviceCategory | null
  /** 맞출 측정자(측정치 source 형식). 없으면 null */
  preferredSource: string | null
  /** 받아서 저장한 측정치 id */
  onPicked: (measurementId: string) => void
}

export function CatalogPickDialog({ open, onClose, title, ...rest }: Props) {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <PickBody {...rest} />
    </Modal>
  )
}

function PickBody({ preferCategory, preferredSource, onPicked }: Omit<Props, 'open' | 'onClose' | 'title'>) {
  const { catalogDevices, catalogError, squigReady } = useCatalogDevices()
  const [query, setQuery] = useState('')
  // 받는 중인 기기 이름(그동안 다른 줄을 못 누르게)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')

  const results = catalogDevices ? searchCatalogDevices(catalogDevices, query, preferCategory) : []

  async function handlePick(name: string, entry: NonNullable<ReturnType<typeof pickCatalogEntry>>) {
    setBusy(name)
    setError('')
    try {
      const { measurementId } = await addFromCatalog(entry, false)
      if (!measurementId) throw new Error('측정치를 받지 못했어요')
      onPicked(measurementId)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy('')
    }
  }

  return (
    <div className="catalog-pick">
      <input
        type="search"
        data-autofocus
        placeholder="기기 이름 검색"
        aria-label="기기 이름 검색"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {preferredSource && <p className="muted small">{sourceLabel(preferredSource)} 측정을 먼저 골라요</p>}
      {catalogError && <p className="error small">{catalogError}</p>}
      {error && <p className="error small">{error}</p>}
      {!catalogDevices && !catalogError && <p className="muted small">목록 불러오는 중…</p>}
      {catalogDevices && !squigReady && <p className="muted small">squig.link 목록은 아직 받는 중이에요</p>}
      {catalogDevices && query.trim() && results.length === 0 && <p className="muted small">결과 없음</p>}

      <ul className="catalog-pick-list">
        {results.map((d) => {
          const entry = pickCatalogEntry(d, preferredSource)
          if (!entry) return null
          const same = isSameSource(entry, preferredSource)
          return (
            <li key={d.searchKey}>
              <button
                type="button"
                className="eq-item"
                disabled={busy !== ''}
                onClick={() => handlePick(d.name, entry)}
              >
                <span className="eq-item-name">{d.name}</span>
                <span className="muted small">
                  {busy === d.name
                    ? '받는 중…'
                    : `${categoryLabels[d.category]} · ${sourceLabel(catalogSourceLabel(entry))}${same ? ' (같은 측정자)' : ''}`}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
