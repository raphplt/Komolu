import { expect, test, type Page } from '@playwright/test'

async function overlapsOnCanvas(page: Page) {
  return page.locator('.widget-grid > .widget').evaluateAll((elements) => {
    const bounds = elements.map((element) => element.getBoundingClientRect())
    return bounds.some((a, i) =>
      bounds
        .slice(i + 1)
        .some((b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top),
    )
  })
}

test('Studio pointer edits, keyboard edits and restored cards stay distinct after reload', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('/')
  await page.getByRole('button', { name: 'Studio', exact: true }).click()
  const studio = page.getByRole('complementary', { name: 'Studio de personnalisation' })
  const clock = page.getByRole('article', { name: 'Horloge', exact: true })
  const handle = clock.getByRole('button', { name: 'Déplacer Horloge', exact: true })
  const start = await handle.boundingBox()
  expect(start).not.toBeNull()
  await page.mouse.move(start!.x + 15, start!.y + 10)
  await page.mouse.down()
  await page.mouse.move(start!.x + 105, start!.y + 10, { steps: 4 })
  await page.mouse.up()
  await expect(clock).toHaveCSS('grid-column-start', '2')
  await expect.poll(() => overlapsOnCanvas(page)).toBe(false)
  await studio.getByRole('button', { name: 'Augmenter la hauteur' }).click()
  await expect(clock).toHaveCSS('grid-row-end', 'span 4')
  await expect.poll(() => overlapsOnCanvas(page)).toBe(false)
  const resize = await clock.getByRole('button', { name: 'Redimensionner Horloge' }).boundingBox()
  expect(resize).not.toBeNull()
  await page.mouse.move(resize!.x + 8, resize!.y + 8)
  await page.mouse.down()
  await page.mouse.move(resize!.x + 93, resize!.y + 84, { steps: 4 })
  await page.mouse.up()
  await expect(clock).toHaveCSS('grid-column-end', 'span 4')
  await expect(clock).toHaveCSS('grid-row-end', 'span 5')
  await expect.poll(() => overlapsOnCanvas(page)).toBe(false)
  await studio.getByRole('button', { name: 'Dupliquer', exact: true }).click()
  const clocks = page.getByRole('article', { name: 'Horloge', exact: true })
  await expect(clocks).toHaveCount(2)
  await expect.poll(() => overlapsOnCanvas(page)).toBe(false)
  await clocks.nth(1).getByRole('button', { name: 'Masquer Horloge', exact: true }).click()
  await expect(clocks).toHaveCount(1)
  await studio.getByRole('button', { name: 'Horloge 2 · Masquée', exact: true }).click()
  await expect(clocks).toHaveCount(2)
  await expect.poll(() => overlapsOnCanvas(page)).toBe(false)
  const layouts = await page
    .locator('.widget-grid > .widget')
    .evaluateAll((elements) => elements.map((element) => element.getAttribute('style')))
  await page.reload()
  await expect(clocks).toHaveCount(2)
  expect(
    await page
      .locator('.widget-grid > .widget')
      .evaluateAll((elements) => elements.map((element) => element.getAttribute('style'))),
  ).toEqual(layouts)
  expect(await overlapsOnCanvas(page)).toBe(false)
})

test('a silent session can start in Focus with the timer hidden and no audio output', async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.AudioContext = class {
      constructor() {
        throw new Error('No audio device')
      }
    } as unknown as typeof AudioContext
  })
  await page.goto('/')
  await page.getByRole('button', { name: 'Studio', exact: true }).click()
  await page.getByRole('button', { name: 'Masquer Minuterie', exact: true }).click()
  await page.getByRole('button', { name: 'Fermer le Studio' }).click()
  await page.getByRole('button', { name: 'Activer le mode Focus' }).click()
  const commands = page.getByRole('navigation', { name: 'Commandes du mode Focus' })
  await expect(commands).toBeVisible()
  await expect(page.getByRole('button', { name: 'Préférences', exact: true })).toHaveCount(0)
  await commands.getByRole('button', { name: 'Démarrer ou reprendre la session' }).click()
  await expect(commands.getByRole('button', { name: 'Suspendre la session' })).toBeVisible()
  await expect(page.getByRole('alert')).toHaveCount(0)
  await commands.getByRole('button', { name: 'Capturer une pensée' }).click()
  await page.getByRole('textbox', { name: 'Nouvelle pensée' }).fill('Une idée')
  await page.getByRole('button', { name: 'Enregistrer et fermer', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(commands).toBeVisible()
  await commands.getByRole('button', { name: 'Suspendre la session' }).click()
  await commands.getByRole('button', { name: 'Quitter le mode Focus' }).click()
  await expect(page.getByRole('button', { name: 'Studio', exact: true })).toBeVisible()
})

test('workspace description is optional and saved without appended copy', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Minimal', exact: true }).click()
  await page.getByRole('textbox', { name: 'Nom de l’espace' }).fill('Lecture')
  await page.getByRole('textbox', { name: 'Description de l’espace' }).fill('Articles à relire')
  await page.getByRole('button', { name: 'Enregistrer l’espace' }).click()
  await expect(page.locator('.workspace-heading')).toHaveText('LectureArticles à relire')
  await page.reload()
  await expect(page.locator('.workspace-heading')).toHaveText('LectureArticles à relire')
  await page.getByRole('button', { name: 'Lecture', exact: true }).click()
  await page.getByRole('textbox', { name: 'Description de l’espace' }).fill('')
  await page.getByRole('button', { name: 'Enregistrer l’espace' }).click()
  await expect(page.locator('.workspace-heading')).toHaveText('Lecture')
})
