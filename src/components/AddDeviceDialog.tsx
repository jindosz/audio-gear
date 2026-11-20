// "기기 추가" 팝업: 카탈로그(AutoEQ + squig.link)에서 검색해 추가하고, 없으면 직접 입력한다
import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  addFromCatalog,
  loadAllCatalogEntries,
  searchCatalog,
  type AddResult,
  type CatalogEntry,
} from '../catalog'
import { categoryLabels } from '../labels'
import { listDevices } from '../repo'
import { DeviceForm } from './DeviceForm'
import { Modal } from './Modal'
import { ToggleButton } from './ToggleButton'

interface Props {
  open: boolean
  onClose: () => void
}

const resultMessages: Record<AddResult, string> = {
  added: '추가했어요',
  measurementAdded: '측정치를 추가했어요',
  deviceOnly: '기기만 추가했어요(측정치 비공개)',
  alreadyExists: '이미 있어요',
}

export function AddDeviceDialog({ open, onClose }: Props) {
  return (
    <Modal open={open} onClose={onClose} title="기기 추가">
      <AddDeviceBody />
    </Modal>
  )
}

// 팝업 내용. 팝업이 열릴 때마다 새로 만들어져서 검색어 등이 초기화된다
function AddDeviceBody() {
  const [catalog, setCatalog] = useState<CatalogEntry[] | null>(null)
  const [loadError, setLoadError] = useState('')
  const [query, setQuery] = useState('')
  const [owned, setOwned] = useState(false)
  const [busyPath, setBusyPath] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [manual, setManual] = useState(false)

  // 내 기기 이름 목록. 검색 결과에 "추가됨" 표시를 하는 데 쓴다
  const myNames = useLiveQuery(async () => new Set((await listDevices()).map((d) => `${d.brand} ${d.model}`)))

  // 팝업이 열리면 카탈로그를 받는다(한 번 받은 뒤에는 catalog.ts가 기억해 둔 것을 바로 돌려줌)
  useEffect(() => {
    if (catalog) return
    loadAllCatalogEntries()
      .then((entries) => {
        setLoadError('')
        setCatalog(entries)
      })
      .catch((err: unknown) => setLoadError(err instanceof Error ? err.message : String(err)))
  }, [catalog])

  async function handleAdd(entry: CatalogEntry) {
    setBusyPath(entry.path)
    setMessage('')
    try {
      const { result } = await addFromCatalog(entry, owned)
      setMessage(`${entry.name}: ${resultMessages[result]}`)
    } catch (err) {
      setMessage(`${entry.name}: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setBusyPath(null)
    }
  }

  const groups = catalog ? searchCatalog(catalog, query) : []

  return (
    // <>...</>: Fragment. 여러 요소를 감싸는 껍데기로, 실제 HTML 태그는 만들지 않는다
    <>
      <div className="row">
        <input
          className="search"
          placeholder="기기 검색"
          value={query}
          data-autofocus
          onChange={(e) => setQuery(e.target.value)}
        />
        <ToggleButton on={owned} onChange={setOwned}>
          보유 기기로 추가
        </ToggleButton>
      </div>

      {message && <p className="small notice">{message}</p>}

      <div className="results">
        {loadError && <p className="error">{loadError}</p>}
        {!catalog && !loadError && <p className="muted">불러오는 중…</p>}
        {catalog && query.trim() === '' && (
          <p className="muted">{catalog.length.toLocaleString()}개 중에서 검색</p>
        )}
        {catalog && query.trim() !== '' && groups.length === 0 && <p className="muted">결과 없음</p>}

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
                    {entry.provider === 'squig' && <span className="muted"> · squig</span>}
                    {entry.variant && <span className="muted"> · {entry.variant}</span>}
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
            직접 추가
          </button>
        )}
        <p className="muted small">
          출처:{' '}
          <a href="https://github.com/jaakkopasanen/AutoEq" target="_blank" rel="noreferrer">
            AutoEQ
          </a>
          ,{' '}
          <a href="https://squig.link" target="_blank" rel="noreferrer">
            squig.link
          </a>
          {' · '}측정치 권리는 각 측정자에게
        </p>
      </div>
    </>
  )
}
