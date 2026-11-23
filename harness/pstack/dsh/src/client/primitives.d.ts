/**
 * Ambient types for the Web primitives module the browser shell provides.
 *
 * The module ships with the DSH Web frontend and is externalised from our bundle,
 * so there is no package to install just for types. Only the members this plugin
 * mounts are declared.
 */
declare module '@deepseek-ai/dsh-client-ui-primitives' {
  import type { ReactNode } from 'react'

  export interface SwitchProps {
    readonly checked: boolean
    readonly disabled?: boolean
    readonly label?: string
    readonly className?: string
    readonly onChange: (next: boolean) => void
  }
  export function Switch(props: SwitchProps): ReactNode

  export interface TooltipProps {
    readonly label: string
    readonly side?: 'top' | 'bottom' | 'left' | 'right'
    readonly delayMs?: number
    readonly maxWidth?: number
    readonly portal?: boolean
    readonly openOnClick?: boolean
    readonly children?: ReactNode
  }
  export function Tooltip(props: TooltipProps): ReactNode

  export interface ButtonProps {
    readonly variant?: 'ghost' | 'solid' | 'outline'
    readonly size?: 'sm' | 'md'
    readonly className?: string
    readonly ariaLabel?: string
    readonly 'aria-label'?: string
    readonly children?: ReactNode
  }
  export function Button(props: ButtonProps): ReactNode

  export function IconInfoOutlineRegular(props: { readonly size?: number; readonly 'aria-hidden'?: boolean | 'true' | 'false' }): ReactNode
}
