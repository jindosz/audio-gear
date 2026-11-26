// 앱 모양의 확인 팝업을 그리는 자리(App에 하나). 여는 것은 src/confirm.ts의 askConfirm
import { useEffect, useState } from 'react'
import { setConfirmHandler, type ConfirmRequest } from '../confirm'
import { Modal } from './Modal'

export function ConfirmHost() {
  const [request, setRequest] = useState<ConfirmRequest | null>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    setConfirmHandler((req) => {
      setRequest(req)
      setOpen(true)
    })
    return () => setConfirmHandler(null)
  }, [])

  function answer(value: boolean | null) {
    request?.resolve(value)
    setOpen(false) // 내용(request)은 닫히는 애니메이션 동안 그대로 둔다
  }

  return (
    <Modal open={open} onClose={() => answer(null)} title={request?.title ?? '확인'}>
      {request && (
        <div className="confirm">
          <p>{request.message}</p>
          <div className="confirm-actions">
            <button type="button" onClick={() => answer(false)}>
              {request.cancel ?? '취소'}
            </button>
            <button type="button" className={request.danger ? 'danger' : 'primary'} onClick={() => answer(true)} data-autofocus>
              {request.ok ?? '확인'}
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}
