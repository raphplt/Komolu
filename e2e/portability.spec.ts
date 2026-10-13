import { readFile } from 'node:fs/promises'
import { expect, test, type Page } from '@playwright/test'

// Original fixtures: a one-pixel PNG and a short mono PCM tone, with no remote media.
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGNwzwgHAAIAAQfRnkkdAAAAAElFTkSuQmCC',
  'base64',
)
function wav(): Buffer {
  const sampleRate = 8_000,
    samples = 800
  const data = Buffer.alloc(44 + samples * 2)
  data.write('RIFF', 0)
  data.writeUInt32LE(data.length - 8, 4)
  data.write('WAVEfmt ', 8)
  data.writeUInt32LE(16, 16)
  data.writeUInt16LE(1, 20)
  data.writeUInt16LE(1, 22)
  data.writeUInt32LE(sampleRate, 24)
  data.writeUInt32LE(sampleRate * 2, 28)
  data.writeUInt16LE(2, 32)
  data.writeUInt16LE(16, 34)
  data.write('data', 36)
  data.writeUInt32LE(samples * 2, 40)
  for (let index = 0; index < samples; index++)
    data.writeInt16LE(
      Math.round(1_000 * Math.sin((2 * Math.PI * 440 * index) / sampleRate)),
      44 + index * 2,
    )
  return data
}
const audio = wav()
const privateNote = 'PRIVATE_NOTE_7f82 — ce texte ne doit jamais être partagé'
const privateTask = 'PRIVATE_TASK_91ac'
const privateThought = 'PRIVATE_THOUGHT_27be'
const imageName = 'private-family-background.png'
const audioName = 'private-recording.wav'
type Backup = {
  format: string
  version: number
  state: {
    privateData: {
      notes: string
      tasks: { id: string; title: string }[]
      thoughts: { id: string; text: string }[]
    }
    workspaces: {
      id: string
      name: string
      background: { type: string; mediaId?: string }
      audio: { tracks: { id: string; mediaId?: string }[] }
    }[]
  }
  media: { id: string; name: string; data: string }[]
}

async function openData(page: Page) {
  await page.getByRole('button', { name: 'Préférences', exact: true }).click()
  await page.getByRole('button', { name: 'Sauvegarde et données', exact: true }).click()
  await expect(
    page.getByRole('dialog', { name: 'Sauvegarde et données', exact: true }),
  ).toBeVisible()
}
async function download(page: Page, label: string): Promise<Buffer> {
  const received = page.waitForEvent('download')
  await page.getByRole('button', { name: label, exact: true }).click()
  const file = await received
  const path = await file.path()
  expect(await file.failure()).toBeNull()
  expect(path).not.toBeNull()
  return readFile(path!)
}
async function exportBackup(page: Page) {
  const buffer = await download(page, 'Exporter une sauvegarde')
  const data = JSON.parse(buffer.toString('utf8')) as Backup
  expect(data.format).toBe('komolu-backup')
  return { buffer, data }
}
async function uploadBackup(page: Page, buffer: Buffer) {
  await page
    .getByLabel('Importer un fichier', { exact: true })
    .setInputFiles({ name: 'komolu-backup-test.json', mimeType: 'application/json', buffer })
  await expect(page.getByRole('heading', { name: 'Vérifier l’import', exact: true })).toBeVisible()
}
async function reset(page: Page) {
  await page.getByRole('button', { name: 'Effacer les données locales', exact: true }).click()
  await page
    .getByRole('textbox', { name: 'Confirmation de suppression', exact: true })
    .fill('EFFACER')
  await page.getByRole('button', { name: 'Tout effacer', exact: true }).click()
  await expect(page.getByRole('textbox', { name: 'Bloc-notes', exact: true })).toHaveValue('')
}
async function playAudio(page: Page) {
  await page.getByRole('button', { name: 'Ouvrir les ambiances', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Écouter', exact: true }).click()
  await expect(
    page.getByRole('dialog').getByRole('button', { name: 'Pause audio', exact: true }),
  ).toBeVisible()
  await page.keyboard.press('Escape')
}
async function expectAudioStopped(page: Page) {
  await page.getByRole('button', { name: 'Ouvrir les ambiances', exact: true }).click()
  await expect(
    page.getByRole('dialog').getByRole('button', { name: 'Écouter', exact: true }),
  ).toBeVisible()
  await page.keyboard.press('Escape')
}
async function seedPrivateContent(page: Page) {
  await page.getByRole('textbox', { name: 'Nouvelle tâche', exact: true }).fill(privateTask)
  await page.getByRole('button', { name: 'Ajouter la tâche', exact: true }).click()
  await expect(page.getByRole('button', { name: privateTask, exact: true })).toBeVisible()
  await page.getByRole('textbox', { name: 'Bloc-notes', exact: true }).fill(privateNote)
  await page.getByRole('textbox', { name: 'Bloc-notes', exact: true }).press('Tab')
  await expect(page.getByRole('status').filter({ hasText: 'Enregistré ici' })).toBeVisible()
  await page.getByRole('button', { name: 'Capturer une pensée', exact: true }).click()
  await page.getByRole('textbox', { name: 'Nouvelle pensée', exact: true }).fill(privateThought)
  await page.getByRole('button', { name: 'Enregistrer et fermer', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
}
async function seedMedia(page: Page) {
  await page.getByRole('button', { name: 'Studio', exact: true }).click()
  await page.getByRole('button', { name: 'Décor', exact: true }).click()
  await page
    .getByLabel('Importer une image ou vidéo', { exact: true })
    .setInputFiles({ name: imageName, mimeType: 'image/png', buffer: png })
  const image = page.locator('img.local-background-media')
  await expect(image).toBeVisible()
  await expect
    .poll(() => image.evaluate((element) => (element as HTMLImageElement).naturalWidth))
    .toBe(1)
  await page.getByRole('button', { name: 'Fermer le Studio', exact: true }).click()
  await page.getByRole('button', { name: 'Ouvrir les ambiances', exact: true }).click()
  await page
    .getByLabel('Ajouter un son personnel', { exact: true })
    .setInputFiles({ name: audioName, mimeType: 'audio/wav', buffer: audio })
  await expect(page.getByRole('button', { name: audioName, exact: true })).toBeVisible()
  await page.keyboard.press('Escape')
}

test('complete backup restores private content and image/audio bytes after reset', async ({
  page,
}) => {
  await page.goto('/')
  await seedPrivateContent(page)
  await seedMedia(page)
  await playAudio(page)
  await openData(page)
  const original = await exportBackup(page)
  expect(original.data.media).toHaveLength(2)
  expect(original.data.state.privateData.notes).toBe(privateNote)
  await reset(page)
  await page.keyboard.press('Escape')
  await expectAudioStopped(page)
  await page.reload()
  await expect(page.getByRole('button', { name: privateTask, exact: true })).toHaveCount(0)
  await playAudio(page)
  await openData(page)
  await uploadBackup(page, original.buffer)
  await page.getByRole('button', { name: 'Remplacer mes données', exact: true }).click()
  await page.getByRole('button', { name: 'Confirmer le remplacement', exact: true }).click()
  await page.keyboard.press('Escape')
  await expectAudioStopped(page)
  await expect(page.getByRole('textbox', { name: 'Bloc-notes', exact: true })).toHaveValue(
    privateNote,
  )
  await expect(page.getByRole('button', { name: privateTask, exact: true })).toBeVisible()
  await expect(page.locator('img.local-background-media')).toBeVisible()
  await openData(page)
  const restored = await exportBackup(page)
  expect(restored.data.state.privateData).toEqual(original.data.state.privateData)
  expect(restored.data.media.map((media) => [media.name, media.data]).sort()).toEqual(
    original.data.media.map((media) => [media.name, media.data]).sort(),
  )
})

test('shared space excludes all private content and local media identifiers', async ({ page }) => {
  await page.goto('/')
  await seedPrivateContent(page)
  await seedMedia(page)
  await openData(page)
  const backup = await exportBackup(page)
  const shared = (await download(page, 'Partager cet espace')).toString('utf8')
  expect(JSON.parse(shared).format).toBe('komolu-space')
  for (const secret of [
    privateTask,
    privateNote,
    privateThought,
    imageName,
    audioName,
    ...backup.data.media.map((media) => media.id),
  ])
    expect(shared).not.toContain(secret)
  expect(JSON.parse(shared)).not.toHaveProperty('state')
  expect(JSON.parse(shared)).not.toHaveProperty('media')
})

test('preview cancellation and malformed files leave existing data untouched', async ({ page }) => {
  await page.goto('/')
  await seedPrivateContent(page)
  await openData(page)
  const before = await exportBackup(page)
  await uploadBackup(page, before.buffer)
  await page.getByRole('button', { name: 'Annuler l’import', exact: true }).click()
  const afterCancel = await exportBackup(page)
  expect(afterCancel.data.state).toEqual(before.data.state)
  await page.getByLabel('Importer un fichier', { exact: true }).setInputFiles({
    name: 'broken.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{broken'),
  })
  await expect(page.getByRole('alert')).toBeVisible()
  const afterError = await exportBackup(page)
  expect(afterError.data.state).toEqual(before.data.state)
})

test('merging overlapping IDs preserves local edits and remaps imported media references', async ({
  page,
}) => {
  await page.goto('/')
  await seedPrivateContent(page)
  await seedMedia(page)
  await openData(page)
  const original = await exportBackup(page)
  await page.keyboard.press('Escape')
  await page
    .getByRole('textbox', { name: 'Nouvelle tâche', exact: true })
    .fill('LOCAL_AFTER_BACKUP')
  await page.getByRole('button', { name: 'Ajouter la tâche', exact: true }).click()
  await expect(page.getByRole('button', { name: 'LOCAL_AFTER_BACKUP', exact: true })).toBeVisible()
  await openData(page)
  await uploadBackup(page, original.buffer)
  await page.getByRole('button', { name: 'Ajouter à mes données', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Vérifier l’import', exact: true })).toHaveCount(0)
  const merged = await exportBackup(page)
  expect(
    merged.data.state.privateData.tasks.some((task) => task.title === 'LOCAL_AFTER_BACKUP'),
  ).toBe(true)
  expect(merged.data.state.workspaces.length).toBeGreaterThan(original.data.state.workspaces.length)
  expect(new Set(merged.data.state.workspaces.map((space) => space.id)).size).toBe(
    merged.data.state.workspaces.length,
  )
  expect(new Set(merged.data.state.privateData.tasks.map((task) => task.id)).size).toBe(
    merged.data.state.privateData.tasks.length,
  )
  const mediaIds = new Set(merged.data.media.map((media) => media.id))
  for (const space of merged.data.state.workspaces) {
    if (space.background.mediaId) expect(mediaIds.has(space.background.mediaId)).toBe(true)
    for (const track of space.audio.tracks)
      if (track.mediaId) expect(mediaIds.has(track.mediaId)).toBe(true)
  }
})

test('reset cannot resurrect the latest notes draft after pending timers settle', async ({
  page,
}) => {
  await page.clock.install()
  await page.goto('/')
  await page
    .getByRole('textbox', { name: 'Bloc-notes', exact: true })
    .fill('DRAFT_TO_ERASE_FOREVER')
  await openData(page)
  await reset(page)
  await page.keyboard.press('Escape')
  await page.clock.fastForward(2_000)
  await expect(page.getByRole('textbox', { name: 'Bloc-notes', exact: true })).toHaveValue('')
  await page.reload()
  await expect(page.getByRole('textbox', { name: 'Bloc-notes', exact: true })).toHaveValue('')
  await openData(page)
  const result = await exportBackup(page)
  expect(result.data.state.privateData.notes).toBe('')
})

test('a delayed note from another tab cannot resurrect content after reset', async ({
  page,
  context,
}) => {
  await page.goto('/')
  const second = await context.newPage()
  await second.goto('/')
  await expect(second.getByRole('textbox', { name: 'Bloc-notes', exact: true })).toBeVisible()
  await page.clock.install()
  await page.clock.pauseAt(new Date(Date.now() + 1_000))
  await page.getByRole('textbox', { name: 'Bloc-notes', exact: true }).fill('OLD_TAB_PENDING_DRAFT')
  await openData(second)
  await reset(second)
  await second.keyboard.press('Escape')
  await expect(page.getByRole('textbox', { name: 'Bloc-notes', exact: true })).toHaveValue('')
  await page.clock.fastForward(2_000)
  await page.clock.resume()
  await second.reload()
  await expect(second.getByRole('textbox', { name: 'Bloc-notes', exact: true })).toHaveValue('')
  await openData(second)
  expect((await exportBackup(second)).data.state.privateData.notes).toBe('')
})
