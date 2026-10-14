export const WALLPAPERS = [
  { id: 'anime-bedroom', name: 'Chambre de nuit', category: 'anime' },
  { id: 'anime-balcony', name: 'Balcon au couchant', category: 'anime' },
  { id: 'rainy-loft', name: 'Loft sous la pluie', category: 'interiors' },
  { id: 'sunlit-studio', name: 'Studio au soleil', category: 'interiors' },
  { id: 'midnight-attic', name: 'Sous les toits', category: 'interiors' },
  { id: 'alpine-lake', name: 'Lac alpin', category: 'landscapes' },
  { id: 'forest-river', name: 'Rivière en forêt', category: 'landscapes' },
  { id: 'ocean-dusk', name: 'Côte au crépuscule', category: 'landscapes' },
] as const
export type WallpaperId = (typeof WALLPAPERS)[number]['id']
export function wallpaperById(id?: string) {
  return WALLPAPERS.find((wallpaper) => wallpaper.id === id)
}
export function wallpaperUrl(id: WallpaperId, thumbnail = false) {
  return `${import.meta.env.BASE_URL}wallpapers/${id}${thumbnail ? '-thumb' : ''}.webp`
}
