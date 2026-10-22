// "기기 추가" 팝업: AutoEQ 카탈로그에서 검색해 추가하고, 없으면 직접 입력한다
import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  addFromCatalog,
  loadCatalog,
  searchCatalog,
  type AddResult,
  type CatalogEntry,
} from '../catalog'
import { categoryLabels } from '../labels'
import { listDevices } from '../repo'
import { DeviceForm } from './DeviceForm'

interface Props {
  open: boolean
  onClose: () => void
}

const resultMessages: Record<AddResult, string> = {
  added: '추가했습니다 (측정치 포함)',
  measurementAdded: '이미 있는 기기에 측정치를 추가했습니다',
  deviceOnly: '기기만 추가했습니다 (이 출처는 측정치가 공개되어 있지 않음)',
  alreadyExists: '이미 추가되어 있습니다',
}

export function AddDeviceDialog({ open, onClose }: Props) {
  // useRef: 화면의 실제 HTML 요소(<dialog>)를 가리키는 손잡이
  const dialogRef = useRef<HTMLDialogElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const [catalog, setCatalog] = useState<CatalogEntry[] | null>(null)
  const [loadError, setLoadError] = useState('')
  const [query, setQuery] = useState('')
  const [owned, setOwned] = useState(false)
  const [busyPath, setBusyPath] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [manual, setManual] = useState(false)

  // 내 기기 이름 목록. 검색 결과에 "추가됨" 표시를 하는 데 쓴다
  const myNames = useLiveQuery(async () => new Set((await listDevices()).map((d) => `${d.brand} ${d.model}`)))

  // useEffect: 화면이 그려진 뒤 실행할 일. [open]이 바뀔 때마다 다시 실행된다
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) {
      dialog.showModal()
      // showModal()은 첫 번째 버튼(✕)에 포커스를 주므로, 바로 입력할 수 있게 검색창으로 옮긴다
      searchRef.current?.focus()
    }
    if (!open && dialog.open) dialog.close()
  }, [open])

  // 팝업이 처음 열릴 때 카탈로그를 받는다
  useEffect(() => {
    if (!open || catalog) return
    loadCatalog()
      .then((entries) => {
        setLoadError('')
        setCatalog(entries)
      })
      .catch((err: unknown) => setLoadError(err instanceof Error ? err.message : String(err)))
  }, [open, catalog])

  async function handleAdd(entry: CatalogEntry) {
    setBusyPath(entry.path)
    setMessage('')
    try {
      const result = await addFromCatalog(entry, owned)
      setMessage(`${entry.name}: ${resultMessages[result]}`)
    } catch (err) {
      setMessage(`${entry.name}: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setBusyPath(null)
    }
  }

  const groups = catalog ? searchCatalog(catalog, query) : []

  return (
    // onClose: Esc 키로 닫을 때도 부모의 open 상태를 false로 맞춘다
    <dialog ref={dialogRef} className="dialog" onClose={onClose}>
      <div className="dialog-head">
        <h2>기기 추가</h2>
        <button className="link" onClick={onClose} aria-label="닫기">
          ✕
        </button>
      </div>

      <div className="row">
        <input
          className="search"
          placeholder="기기 검색 (예: hd600, blessing 2)"
          value={query}
          ref={searchRef}
          onChange={(e) => setQuery(e.target.value)}
        />
        <label className="check">
          <input type="checkbox" checked={owned} onChange={(e) => setOwned(e.target.checked)} />
          보유 기기로 추가
        </label>
      </div>

      {message && <p className="small notice">{message}</p>}

      <div className="results">
        {loadError && <p className="error">{loadError}</p>}
        {!catalog && !loadError && <p className="muted">전체 기기 목록을 불러오는 중…</p>}
        {catalog && query.trim() === '' && (
          <p className="muted">{catalog.length.toLocaleString()}개 측정 결과에서 검색합니다.</p>
        )}
        {catalog && query.trim() !== '' && groups.length === 0 && <p className="muted">검색 결과가 없습니다.</p>}

        <ul className="result-list">
          {groups.map((group) => (
            <li key={group.name}>
              <div>
                <strong>{group.name}</strong> <span className="tag">{categoryLabels[group.category]}</span>
                {myNames?.has(group.name) && <span className="tag added">추가됨</span>}
              </div>
              {/* 같은 기기라도 측정자(출처)마다 곡선이 다르므로 출처를 골라 추가한다 */}
              <div className="sources">
                {group.entries.map((entry) => (
                  <button
                    key={entry.path}
                    className="chip"
                    disabled={busyPath !== null}
                    onClick={() => handleAdd(entry)}
                    title={entry.hasCurve ? '이 출처의 측정치와 함께 추가' : '측정치 비공개: 기기만 추가'}
                  >
                    {busyPath === entry.path ? '추가 중…' : entry.source}
                    {entry.rigName && <span className="muted"> · {entry.rigName}</span>}
                    {!entry.hasCurve && <span className="muted"> (측정치 없음)</span>}
                  </button>
                ))}
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="dialog-foot">
        {manual ? (
          <DeviceForm onAdded={(name) => setMessage(`${name}: 직접 추가했습니다`)} />
        ) : (
          <button className="link" onClick={() => setManual(true)}>
            찾는 기기가 없나요? 직접 추가
          </button>
        )}
        <p className="muted small">
          목록·측정치 출처:{' '}
          <a href="https://github.com/jaakkopasanen/AutoEq" target="_blank" rel="noreferrer">
            AutoEQ
          </a>
          . 측정치의 권리는 각 측정자에게 있습니다.
        </p>
      </div>
    </dialog>
  )
}
