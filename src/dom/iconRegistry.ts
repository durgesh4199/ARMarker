import { CubeIcon, LayersIcon, PlayIcon, TagIcon } from './icons'

export const icons = {
  layers: LayersIcon,
  cube: CubeIcon,
  play: PlayIcon,
  tag: TagIcon,
}

export type IconName = keyof typeof icons
