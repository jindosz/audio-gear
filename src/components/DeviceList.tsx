// 등록된 기기를 "보유 기기"와 "그 외 기기"로 나눠 보여주는 목록
import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { categoryLabels } from '../labels'
import { listDevices } from '../repo'
import { DeviceItem } from './DeviceItem'

export function DeviceList() {
  // useLiveQuery: DB를 읽고, DB 내용이 바뀌면 자동으로 다시 읽는 Dexie 훅.
  // 처음 읽는 동안에는 undefined가 들어온다
  const devices = useLiveQuery(listDevices)
  // 측정치 업로드 폼이 열려 있는 기기 id (한 번에 하나만 연다)
  const [uploadOpenId, setUploadOpenId] = useState<string | null>(null)

  if (devices === undefined) return <p>불러오는 중…</p>
  if (devices.length === 0) return <p className="muted">등록된 기기가 없습니다.</p>

  // owned는 인덱스가 없어서 JS의 filter로 나눈다
  const sections = [
    { title: '보유 기기', items: devices.filter((d) => d.owned) },
    { title: '그 외 기기', items: devices.filter((d) => !d.owned) },
  ]

  return (
    <>
      {sections.map((section) => (
        <section key={section.title} className="card">
          <h2>
            {section.title} <span className="muted">({section.items.length})</span>
          </h2>
          {section.items.length === 0 ? (
            <p className="muted">없음</p>
          ) : (
            <ul className="device-list">
              {section.items.map((device) => (
                <DeviceItem
                  key={device.id}
                  device={device}
                  categoryLabel={categoryLabels[device.category]}
                  uploadOpen={uploadOpenId === device.id}
                  onToggleUpload={() => setUploadOpenId(uploadOpenId === device.id ? null : device.id)}
                />
              ))}
            </ul>
          )}
        </section>
      ))}
    </>
  )
}
