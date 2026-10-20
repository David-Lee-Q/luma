import type { ComponentType, SVGProps } from 'react'
import type { AlbumId } from '../lib/types'

interface IconProps extends SVGProps<SVGSVGElement> {
  size?: number
}

function Svg({ size = 22, children, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  )
}

export const IconGrid = (props: IconProps) => (
  <Svg {...props}>
    <rect x="3.5" y="3.5" width="6.4" height="6.4" rx="2" />
    <rect x="14.1" y="3.5" width="6.4" height="6.4" rx="2" />
    <rect x="3.5" y="14.1" width="6.4" height="6.4" rx="2" />
    <rect x="14.1" y="14.1" width="6.4" height="6.4" rx="2" />
  </Svg>
)

export const IconAlbums = (props: IconProps) => (
  <Svg {...props}>
    <rect x="7" y="7" width="14" height="14" rx="3.2" />
    <path d="M3.6 16.6V6.8a3.2 3.2 0 0 1 3.2-3.2h9.8" />
  </Svg>
)

export const IconSearch = (props: IconProps) => (
  <Svg {...props}>
    <circle cx="11" cy="11" r="6.4" />
    <path d="M15.9 15.9L20.4 20.4" />
  </Svg>
)

export const IconCloud = (props: IconProps) => (
  <Svg {...props}>
    <path d="M7.4 18.5a4.1 4.1 0 0 1-.6-8.2 5.3 5.3 0 0 1 10.2-1.2 3.9 3.9 0 0 1-.7 7.7z" />
  </Svg>
)

export const IconSparkles = (props: IconProps) => (
  <Svg {...props}>
    <path d="M12 3.6l1.6 4.5 4.5 1.6-4.5 1.6L12 15.8l-1.6-4.5-4.5-1.6 4.5-1.6L12 3.6z" />
    <path d="M18.4 15.2l.8 2.1 2.1.8-2.1.8-.8 2.1-.8-2.1-2.1-.8 2.1-.8.8-2.1z" />
    <path d="M5.2 15.8l.6 1.6 1.6.6-1.6.6-.6 1.6-.6-1.6-1.6-.6 1.6-.6.6-1.6z" />
  </Svg>
)

export const IconPlay = ({ size = 22, ...props }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" {...props}>
    <path d="M8.2 5.4c0-.8.9-1.3 1.6-.9l9 6.6c.6.4.6 1.4 0 1.8l-9 6.6c-.7.4-1.6-.1-1.6-.9V5.4z" fill="currentColor" />
  </svg>
)

export const IconPause = ({ size = 22, ...props }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" {...props}>
    <rect x="6.5" y="5" width="4" height="14" rx="1.6" fill="currentColor" />
    <rect x="13.5" y="5" width="4" height="14" rx="1.6" fill="currentColor" />
  </svg>
)

export const IconPlus = (props: IconProps) => (
  <Svg {...props}>
    <path d="M12 5.5v13M5.5 12h13" />
  </Svg>
)

export const IconClose = (props: IconProps) => (
  <Svg {...props}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Svg>
)

export const IconChevronLeft = (props: IconProps) => (
  <Svg {...props}>
    <path d="M15 5.5L8.5 12l6.5 6.5" />
  </Svg>
)

export const IconChevronRight = (props: IconProps) => (
  <Svg {...props}>
    <path d="M9 5.5L15.5 12 9 18.5" />
  </Svg>
)

export const IconTrash = (props: IconProps) => (
  <Svg {...props}>
    <path d="M4.5 7.2h15" />
    <path d="M9.5 7.2V5.4a1.4 1.4 0 0 1 1.4-1.4h2.2a1.4 1.4 0 0 1 1.4 1.4v1.8" />
    <path d="M6.4 7.2l.8 11.6a2 2 0 0 0 2 1.9h5.6a2 2 0 0 0 2-1.9l.8-11.6" />
    <path d="M10.2 11v5.6M13.8 11v5.6" />
  </Svg>
)

export const IconCheck = (props: IconProps) => (
  <Svg {...props}>
    <path d="M5 12.4l4.4 4.4L19 6.8" />
  </Svg>
)

export const IconHeart = ({ size = 22, filled = false, ...props }: IconProps & { filled?: boolean }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill={filled ? 'currentColor' : 'none'}
    stroke="currentColor"
    strokeWidth={1.7}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    {...props}
  >
    <path d="M12 20.3s-7.8-4.6-7.8-10A4.4 4.4 0 0 1 12 7.4a4.4 4.4 0 0 1 7.8 2.9c0 5.4-7.8 10-7.8 10z" />
  </svg>
)

export const IconUpload = (props: IconProps) => (
  <Svg {...props}>
    <path d="M12 16V4.8M7.6 9.2L12 4.8l4.4 4.4" />
    <path d="M5 15.4v2.6a2.4 2.4 0 0 0 2.4 2.4h9.2a2.4 2.4 0 0 0 2.4-2.4v-2.6" />
  </Svg>
)

export const IconLock = (props: IconProps) => (
  <Svg {...props}>
    <rect x="4.8" y="10.2" width="14.4" height="10" rx="3" />
    <path d="M8.4 10.2V7.8a3.6 3.6 0 0 1 7.2 0v2.4" />
    <path d="M12 14.4v2" />
  </Svg>
)

export const IconImage = (props: IconProps) => (
  <Svg {...props}>
    <rect x="3.6" y="4.4" width="16.8" height="15.2" rx="3.4" />
    <circle cx="8.8" cy="9.4" r="1.7" />
    <path d="M4.4 17.2l4.8-4.8 3.4 3.4 2.5-2.4 4.5 4.4" />
  </Svg>
)

export const IconShuffle = (props: IconProps) => (
  <Svg {...props}>
    <path d="M3.8 7.2h3.4c1.2 0 2.3.6 3 1.6l3.6 6.4c.7 1 1.8 1.6 3 1.6h3.3" />
    <path d="M3.8 16.8h3.4c1.2 0 2.3-.6 3-1.6l3.6-6.4c.7-1 1.8-1.6 3-1.6h3.3" />
    <path d="M18 4.8l3 2.4-3 2.4M18 14.4l3 2.4-3 2.4" />
  </Svg>
)

export const IconInfo = (props: IconProps) => (
  <Svg {...props}>
    <circle cx="12" cy="12" r="8.6" />
    <path d="M12 11v5.2M12 8.1v.1" />
  </Svg>
)

export const IconArrowLeft = (props: IconProps) => (
  <Svg {...props}>
    <path d="M19 12H5.4M10.8 6.2L5 12l5.8 5.8" />
  </Svg>
)

export const IconClock = (props: IconProps) => (
  <Svg {...props}>
    <circle cx="12" cy="12" r="8.6" />
    <path d="M12 7.4V12l3 1.8" />
  </Svg>
)

export const IconUser = (props: IconProps) => (
  <Svg {...props}>
    <circle cx="12" cy="8" r="3.8" />
    <path d="M4.8 20c.5-3.6 3.4-5.8 7.2-5.8s6.7 2.2 7.2 5.8" />
  </Svg>
)

export const IconMountain = (props: IconProps) => (
  <Svg {...props}>
    <path d="M3.4 18.6l5.2-8.6 3.1 4.6 2.6-3.8 6.3 7.8H3.4z" />
    <circle cx="16.6" cy="6.6" r="1.9" />
  </Svg>
)

export const IconBowl = (props: IconProps) => (
  <Svg {...props}>
    <path d="M3.8 11.6h16.4a1 1 0 0 1 1 1.1c-.4 3.9-3.9 6.7-9.2 6.7s-8.8-2.8-9.2-6.7a1 1 0 0 1 1-1.1z" />
    <path d="M9 4.4c-.9 1.2-.9 2.2 0 3.4M13.4 4c-.9 1.2-.9 2.2 0 3.4M17 4.8c-.7.9-.7 1.7 0 2.6" />
  </Svg>
)

export const IconMoon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M20 14.6A8.6 8.6 0 0 1 9.4 4a8.6 8.6 0 1 0 10.6 10.6z" />
  </Svg>
)

export const IconPhone = (props: IconProps) => (
  <Svg {...props}>
    <rect x="6.6" y="2.8" width="10.8" height="18.4" rx="3" />
    <path d="M10.4 5.4h3.2M11 18.2h2" />
  </Svg>
)

export const IconFile = (props: IconProps) => (
  <Svg {...props}>
    <path d="M6 3.8h7.2L18.6 9v11.2H6z" />
    <path d="M13 3.8V9h5.4M8.8 13h6.4M8.8 16.4h4.6" />
  </Svg>
)

export const IconCamera = (props: IconProps) => (
  <Svg {...props}>
    <path d="M4 8.4h3l1.4-2h7.2L17 8.4h3a1 1 0 0 1 1 1v8.2a1.6 1.6 0 0 1-1.6 1.6H4.6A1.6 1.6 0 0 1 3 17.6V9.4a1 1 0 0 1 1-1z" />
    <circle cx="12" cy="13.2" r="3.4" />
  </Svg>
)

export const IconWand = (props: IconProps) => (
  <Svg {...props}>
    <path d="M4.4 19.6l9.8-9.8M12.6 8l1.8-1.8" />
    <path d="M14.4 3.4l.6 1.8 1.8.6-1.8.6-.6 1.8-.6-1.8-1.8-.6 1.8-.6.6-1.8zM19.2 12.4l.4 1.3 1.3.4-1.3.4-.4 1.3-.4-1.3-1.3-.4 1.3-.4.4-1.3z" />
  </Svg>
)

export const IconRefresh = (props: IconProps) => (
  <Svg {...props}>
    <path d="M19.4 12a7.4 7.4 0 1 1-2.2-5.2" />
    <path d="M19.8 4.6v4.2h-4.2" />
  </Svg>
)

export const IconSelectAll = (props: IconProps) => (
  <Svg {...props}>
    <rect x="3.6" y="3.6" width="10.8" height="10.8" rx="2.6" />
    <path d="M9.6 14.2v3.2a2.4 2.4 0 0 0 2.4 2.4h5.8a2.4 2.4 0 0 0 2.4-2.4v-5.8a2.4 2.4 0 0 0-2.4-2.4h-3.2" />
    <path d="M6.6 8.8l1.8 1.8 3.2-3.4" />
  </Svg>
)

export const IconChevronDown = (props: IconProps) => (
  <Svg {...props}>
    <path d="M5.5 9L12 15.5 18.5 9" />
  </Svg>
)

export const IconMusic = (props: IconProps) => (
  <Svg {...props}>
    <path d="M9.2 18.2V6.6l8-1.8v11" />
    <circle cx="6.9" cy="18.2" r="2.3" />
    <circle cx="15" cy="16.1" r="2.3" />
  </Svg>
)

export const IconVolume = (props: IconProps) => (
  <Svg {...props}>
    <path d="M4.6 9.6h3l3.6-3v10.8l-3.6-3h-3z" />
    <path d="M15.2 9.4a3.6 3.6 0 0 1 0 5.2" />
    <path d="M17.6 7a6.8 6.8 0 0 1 0 10" />
  </Svg>
)

export const IconVolumeOff = (props: IconProps) => (
  <Svg {...props}>
    <path d="M4.6 9.6h3l3.6-3v10.8l-3.6-3h-3z" />
    <path d="M15.4 9.8l4.6 4.4" />
    <path d="M20 9.8l-4.6 4.4" />
  </Svg>
)

export const IconSpinner = ({ size = 20, ...props }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden="true"
    className="spin"
    {...props}
  >
    <circle cx="12" cy="12" r="8.4" stroke="currentColor" strokeOpacity="0.18" strokeWidth="2.4" />
    <path d="M20.4 12a8.4 8.4 0 0 0-8.4-8.4" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
  </svg>
)

const ALBUM_ICONS: Record<AlbumId, ComponentType<IconProps>> = {
  people: IconUser,
  nature: IconMountain,
  food: IconBowl,
  night: IconMoon,
  screenshots: IconPhone,
  documents: IconFile,
  moments: IconCamera,
}

export function AlbumIcon({ album, ...props }: IconProps & { album: AlbumId }) {
  const Component = ALBUM_ICONS[album]
  return <Component {...props} />
}
