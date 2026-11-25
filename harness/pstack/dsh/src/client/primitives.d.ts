/**
 * Ambient types for the Web primitives module the browser shell provides.
 *
 * The module ships with the DSH Web frontend and is externalised from our bundle,
 * so there is no package to install just for types. Each member below mirrors the
 * running build (`@deepseek-ai/dsh-client-ui-primitives`); only what this plugin
 * mounts is declared.
 */
declare module '@deepseek-ai/dsh-client-ui-primitives' {
  import type { ButtonHTMLAttributes, ReactNode } from 'react'

  export interface SwitchProps {
    readonly checked: boolean
    readonly disabled?: boolean
    readonly label?: string
    readonly title?: string
    readonly className?: string
    readonly onChange: (next: boolean) => void
  }
  export function Switch(props: SwitchProps): ReactNode

  export interface TooltipProps {
    readonly label: string
    readonly side?: 'top' | 'bottom' | 'left' | 'right'
    readonly delayMs?: number
    readonly focusDelayMs?: number
    readonly maxWidth?: number
    readonly portal?: boolean
    readonly openOnClick?: boolean
    readonly children?: ReactNode
  }
  export function Tooltip(props: TooltipProps): ReactNode

  /** `primary` is the filled action, `outline` the hairline one, `ghost` the ambient one. */
  export type ButtonVariant = 'ghost' | 'primary' | 'outline' | 'toolbar'

  export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
    readonly variant?: ButtonVariant
    /** `md` is 36px tall with 14px text; `sm` is 28px with 12px. */
    readonly size?: 'sm' | 'md'
    /** Leading 16px icon node. */
    readonly icon?: ReactNode
    readonly className?: string
    readonly children?: ReactNode
  }
  export function Button(props: ButtonProps): ReactNode

  /** Read-only tag; `outline` is the default hairline tone. */
  export type TagTone = 'outline' | 'solid' | 'neutral' | 'quiet' | 'success' | 'info' | 'warning' | 'danger'

  export interface TagProps {
    readonly tone?: TagTone
    readonly className?: string
    readonly children?: ReactNode
  }
  export function Tag(props: TagProps): ReactNode

  /** Status marker; it is aria-hidden, so pair it with text. */
  export interface StateDotProps {
    readonly state: 'done' | 'warning' | 'ongoing' | 'error' | 'idle'
    readonly size?: number
    readonly className?: string
    readonly appearance?: 'dot' | 'step'
  }
  export function StateDot(props: StateDotProps): ReactNode

  export interface IconProps {
    readonly size?: number
    readonly className?: string
    readonly 'aria-hidden'?: boolean | 'true' | 'false'
  }
  export function IconInfoOutlineRegular(props: IconProps): ReactNode
  export function IconCloseOutlineRegular(props: IconProps): ReactNode
  export function IconPlusOutlineRegular(props: IconProps): ReactNode
  export function IconTrashOutlineRegular(props: IconProps): ReactNode
}
