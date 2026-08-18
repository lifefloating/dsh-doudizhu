import type { ReactNode, ButtonHTMLAttributes } from 'react'

export function FishLogo(_props: { size?: number; className?: string }): ReactNode {
  return null
}

export function Button(_props: {
  variant?: 'primary' | 'ghost' | 'outline' | 'toolbar'
  size?: 'md' | 'sm'
  icon?: ReactNode
  className?: string
  children?: ReactNode
} & ButtonHTMLAttributes<HTMLButtonElement>): ReactNode {
  return null
}

export function writeClipboard(_text: string): Promise<void> {
  return Promise.resolve()
}
