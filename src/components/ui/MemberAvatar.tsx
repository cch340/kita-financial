export function MemberAvatar({ member, size = 42 }: { member: 'CH' | 'JC'; size?: number }) {
  const bg = member === 'CH' ? 'var(--member-ch)' : 'var(--member-jc)'
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full font-bold text-white"
      style={{ width: size, height: size, background: bg, fontSize: Math.round(size * 0.38) }}
    >
      {member}
    </div>
  )
}
