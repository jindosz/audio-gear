// 성향 태그 묶음(예: [저음 강함] [치찰음 피크]). 마우스를 올리면 근거(예: "Harman 대비 60~250Hz +4.2dB")가 보인다
import type { SoundTag } from '../soundTags'

export function SoundTagList({ tags }: { tags: SoundTag[] | null }) {
  if (!tags || tags.length === 0) return null
  return (
    <span className="sound-tags">
      {tags.map((t) => (
        <span key={t.label} className={`sound-tag ${t.kind}`} title={t.detail}>
          {t.label}
        </span>
      ))}
    </span>
  )
}
