import { readFileSync, writeFileSync } from 'node:fs'

const packages = ['react', 'react-dom', 'scheduler', 'dexie', 'dexie-react-hooks', 'lucide-react']
let notices = 'Komolu — Third-party notices\n\n'
notices += 'Production JavaScript dependencies bundled with Komolu.\n'
notices += 'Generated from the installed packages by node scripts/notices.mjs.\n\n'
for (const name of packages) {
  const directory = `node_modules/${name}`
  const pkg = JSON.parse(readFileSync(`${directory}/package.json`, 'utf8'))
  notices += `${'='.repeat(72)}\n${name} ${pkg.version} — ${pkg.license}\n${'='.repeat(72)}\n\n`
  notices += readFileSync(`${directory}/LICENSE`, 'utf8') + '\n\n'
  if (name === 'dexie') notices += readFileSync(`${directory}/NOTICE`, 'utf8') + '\n\n'
}
// Lucide's license explicitly identifies Feather portions as MIT.
notices += `${'='.repeat(72)}\nFeather portions of Lucide — MIT\n${'='.repeat(72)}\n\n`
notices += readFileSync('scripts/FEATHER_LICENSE.txt', 'utf8')
writeFileSync('public/THIRD_PARTY_NOTICES.txt', notices)
