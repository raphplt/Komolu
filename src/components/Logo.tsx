/** Komolu's little resting spirit, sheltered by a crescent. */
export function Logo() {
  return (
    <>
      <svg className="brand-mark" viewBox="0 0 64 64" fill="none" aria-hidden="true">
        <path
          d="M47 9C32 5 14 16 12 32c-2 15 10 25 24 23 9-1 16-7 19-14-7 5-17 4-23-2-8-8-7-22 1-29"
          fill="var(--logo-moon, #d4b77d)"
        />
        <path
          d="M26 42c0-12 4-21 13-21 9 0 13 9 13 21 0 4-3 6-6 4l-3-2-4 3-5-3-3 2c-3 2-5 0-5-4Z"
          fill="var(--logo-spirit, #f8f0da)"
          stroke="var(--logo-ink, #344b3f)"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <path
          d="m32 33 2 1 2-1m7 0 2 1 2-1"
          stroke="#344b3f"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
        <path d="M39 20c-1-5 2-8 7-8 0 5-3 8-7 8Z" fill="var(--logo-ink, #344b3f)" />
        <path
          d="M54 14v6m-3-3h6"
          stroke="var(--logo-moon, #d4b77d)"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
      <span className="brand-wordmark">
        komolu<span className="brand-dot">.</span>
      </span>
    </>
  )
}
