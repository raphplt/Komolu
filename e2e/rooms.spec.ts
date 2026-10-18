import { expect, test } from '@playwright/test'
import { createRoomsServer, type RoomsServer } from '../server/app'
import { loadConfig } from '../server/config'

let roomsServer: RoomsServer | null = null

test.beforeAll(async () => {
  try {
    const s = createRoomsServer(
      loadConfig({
        PORT: '8787',
        HOST: '127.0.0.1',
        KOMOLU_ALLOWED_ORIGINS:
          'http://localhost:5173,http://127.0.0.1:5173,http://localhost:8080,http://127.0.0.1:8080',
      }),
    )
    await new Promise<void>((resolve, reject) => {
      s.server.once('error', reject)
      s.server.listen(8787, '127.0.0.1', () => resolve())
    })
    roomsServer = s
  } catch {
    // Port 8787 already started by another worker
  }
})

test.afterAll(async () => {
  await roomsServer?.close()
})

test.describe('V2 Coworking Rooms', () => {
  test('opens coworking dialog, creates a room, chats and syncs members', async ({
    page,
    browser,
  }) => {
    // 1. Host creates a room
    await page.goto('/')
    const dockButton = page.getByRole('button', { name: 'Ouvrir la salle de coworking' })
    await expect(dockButton).toBeVisible()
    await dockButton.click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole('heading', { name: 'Coworking' })).toBeVisible()

    // Switch to "Créer une salle"
    await dialog.getByRole('button', { name: 'Créer une salle' }).click()
    const nameInput = dialog.getByLabel('Mon pseudonyme')
    await nameInput.fill('Alex')
    await dialog.getByRole('button', { name: 'Créer et inviter' }).click()

    // Room joined view
    await expect(dialog.getByText('Salle de coworking (1)')).toBeVisible()
    await expect(dialog.getByText('Alex')).toBeVisible()
    await expect(dialog.getByText('Hôte')).toBeVisible()

    // 2. Chat in the room
    await dialog.getByRole('button', { name: 'Discussion' }).click()
    const chatInput = dialog.getByPlaceholder('Envoyer un message bienveillant…')
    await chatInput.fill('Bonne session de concentration !')
    await dialog.getByRole('button', { name: 'Envoyer' }).click()
    await expect(dialog.getByText('Bonne session de concentration !')).toBeVisible()

    // Get the invite link from the button attribute
    const inviteButton = dialog.getByRole('button', { name: /Inviter|Lien copié/ })
    await expect(inviteButton).toBeVisible()
    const inviteUrl = (await inviteButton.getAttribute('data-invite-url')) || ''
    expect(inviteUrl).toContain('#join=')

    // 3. Second member joins in another context
    const guestContext = await browser.newContext()
    const guestPage = await guestContext.newPage()
    guestPage.on('dialog', (d) => void d.accept())

    await guestPage.goto(inviteUrl)
    const guestDialog = guestPage.getByRole('dialog')
    await expect(guestDialog).toBeVisible()

    const guestNameInput = guestDialog.getByLabel('Mon pseudonyme')
    await guestNameInput.fill('Sam')
    await guestDialog.getByRole('button', { name: 'Rejoindre la salle' }).click()

    // Verify guest sees both members
    await expect(guestDialog.getByText('Salle de coworking (2)')).toBeVisible({ timeout: 5000 })
    await expect(guestDialog.getByText('Alex')).toBeVisible()
    await expect(guestDialog.getByText('Sam')).toBeVisible()

    // Verify guest sees chat history
    await guestDialog.getByRole('button', { name: 'Discussion' }).click()
    await expect(guestDialog.getByText('Bonne session de concentration !')).toBeVisible()

    // Guest sends a message
    const guestChatInput = guestDialog.getByPlaceholder('Envoyer un message bienveillant…')
    await guestChatInput.fill('Merci Alex !')
    await guestDialog.getByRole('button', { name: 'Envoyer' }).click()
    await expect(guestDialog.getByText('Merci Alex !')).toBeVisible()

    // Host sees Sam's message
    await expect(dialog.getByText('Merci Alex !')).toBeVisible()

    // Guest leaves
    await guestDialog.getByRole('button', { name: 'Quitter', exact: true }).click()
    await expect(dialog.getByText('Salle de coworking (1)')).toBeVisible({ timeout: 5000 })

    await guestContext.close()
  })
})
