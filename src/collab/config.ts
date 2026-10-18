/**
 * Instance configuration read at startup from `komolu.json`, next to `index.html`.
 * A host can switch the optional rooms service on without rebuilding the frontend.
 * Missing or invalid files fall back to the local-only experience.
 */
export interface InstanceConfig {
  collaboration: { enabled: boolean; url: string }
}

export const DEFAULT_CONFIG: InstanceConfig = {
  collaboration: { enabled: false, url: 'rooms' },
}

function validUrl(value: unknown): value is string {
  if (typeof value !== 'string' || !value || value.length > 300) return false
  if (/^(wss?|https?):\/\//.test(value)) return true
  // Relative to the page, so the app also works under a sub-path such as /Komolu/.
  return /^(\.?\.?\/)?[A-Za-z0-9/_.-]+$/.test(value) && !value.startsWith('//')
}

export function parseInstanceConfig(raw: unknown, fallback = DEFAULT_CONFIG): InstanceConfig {
  const config = structuredClone(fallback)
  if (typeof raw !== 'object' || raw === null) return config
  const collaboration = (raw as Record<string, unknown>).collaboration
  if (typeof collaboration !== 'object' || collaboration === null) return config
  const { enabled, url } = collaboration as Record<string, unknown>
  if (typeof enabled === 'boolean') config.collaboration.enabled = enabled
  if (validUrl(url)) config.collaboration.url = url
  return config
}

/** Build-time fallback for development: `VITE_KOMOLU_ROOMS_URL=rooms npm run dev`. */
export function buildDefaults(envUrl: string | undefined): InstanceConfig {
  return validUrl(envUrl)
    ? { collaboration: { enabled: true, url: envUrl } }
    : structuredClone(DEFAULT_CONFIG)
}

export async function loadInstanceConfig(
  fetchImpl: typeof fetch = fetch,
  envUrl: string | undefined = import.meta.env.VITE_KOMOLU_ROOMS_URL,
): Promise<InstanceConfig> {
  const defaults = buildDefaults(envUrl)
  try {
    const response = await fetchImpl('./komolu.json', { cache: 'no-cache' })
    if (!response.ok) return defaults
    return parseInstanceConfig(await response.json(), defaults)
  } catch {
    return defaults
  }
}

export function socketUrl(url: string, page: string): string {
  const resolved = new URL(url, page)
  if (resolved.protocol === 'http:') resolved.protocol = 'ws:'
  if (resolved.protocol === 'https:') resolved.protocol = 'wss:'
  resolved.hash = ''
  return resolved.toString()
}
