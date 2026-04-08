// Icon.tsx wraps @radix-ui/react-icons with consistent sizing and colour.
// Always import icons through this wrapper — never use Radix icons directly in screens.
// This keeps icon usage consistent and makes swapping the icon library trivial.

import type { JSX } from 'react'
import type { IconProps } from '@radix-ui/react-icons/dist/types'

type IconSize = 'sm' | 'md' | 'lg'

interface Props {
  icon: React.ForwardRefExoticComponent<IconProps & React.RefAttributes<SVGSVGElement>>
  size?: IconSize
  color?: string  // CSS variable string e.g. 'var(--color-accent-amber)'
}

const SIZE_PX: Record<IconSize, number> = {
  sm: 14,
  md: 16,
  lg: 20,
}

export default function Icon({ icon: IconComponent, size = 'md', color }: Props): JSX.Element {
  const px = SIZE_PX[size]
  return (
    <IconComponent
      width={px}
      height={px}
      style={color !== undefined ? { color } : undefined}
    />
  )
}
