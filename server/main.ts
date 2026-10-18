import { createRoomsServer } from './app.ts'
import { loadConfig } from './config.ts'

const config = loadConfig()
const rooms = createRoomsServer(config)

rooms.server.listen(config.port, config.host, () => {
  // Deliberately no request logging: addresses, pseudonyms and messages stay out of logs.
  console.log(`Komolu rooms listening on ${config.host}:${config.port}${config.path}`)
})

let stopping = false
for (const signal of ['SIGINT', 'SIGTERM'] as const)
  process.on(signal, () => {
    if (stopping) return
    stopping = true
    console.log('Komolu rooms stopping; every room is closed and forgotten.')
    void rooms.close().then(() => process.exit(0))
    setTimeout(() => process.exit(0), 5_000).unref()
  })
