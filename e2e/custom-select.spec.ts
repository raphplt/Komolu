import { expect, test } from '@playwright/test'

test('custom menus follow the theme, accept keyboard input and dismiss without closing the panel', async ({
  page,
}) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Studio', exact: true }).click()
  const studio = page.getByRole('complementary', { name: 'Studio de personnalisation' })
  await studio.getByRole('button', { name: 'Décor', exact: true }).click()
  const palette = studio.getByRole('combobox', { name: 'Palette des widgets' })
  await palette.focus()
  await palette.press('ArrowDown')
  const list = page.getByRole('listbox', { name: 'Palette des widgets' })
  await expect(list).toBeVisible()
  await palette.press('End')
  await palette.press('Enter')
  await expect(palette).toHaveAttribute('data-value', 'deep')
  await palette.click()
  await expect(list).toBeVisible()
  await expect(list).toHaveCSS(
    'background-color',
    await studio.evaluate((el) => getComputedStyle(el).backgroundColor),
  )
  await palette.press('Escape')
  await expect(list).toBeHidden()
  await expect(studio).toBeVisible()
  await palette.click()
  await studio.getByRole('heading', { name: 'Studio', exact: true }).click()
  await expect(list).toBeHidden()
  await page.getByRole('button', { name: 'Fermer le Studio' }).click()
  await page.getByRole('button', { name: 'Régler la minuterie' }).click()
  const mode = page.getByRole('combobox', { name: 'Mode', exact: true })
  await mode.click()
  await page.getByRole('option', { name: 'Session libre', exact: true }).click()
  await expect(mode).toHaveAttribute('data-value', 'free')
  await expect(page.getByRole('dialog')).toBeVisible()
})

test('widgets follow small pointer movements before snapping on release', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('/')
  await page.getByRole('button', { name: 'Studio', exact: true }).click()
  const clock = page.getByRole('article', { name: 'Horloge', exact: true })
  const bounds = (await clock.boundingBox())!
  const handle = (await clock
    .getByRole('button', { name: 'Déplacer Horloge', exact: true })
    .boundingBox())!
  await page.mouse.move(handle.x + 15, handle.y + 10)
  await page.mouse.down()
  await page.mouse.move(handle.x + 30, handle.y + 10)
  await expect.poll(async () => Math.round((await clock.boundingBox())!.x - bounds.x)).toBe(15)
  await page.mouse.up()
  await expect(clock).toHaveCSS('transform', 'none')
  const beforeResize = (await clock.boundingBox())!
  const resize = (await clock
    .getByRole('button', { name: 'Redimensionner Horloge', exact: true })
    .boundingBox())!
  await page.mouse.move(resize.x + 5, resize.y + 5)
  await page.mouse.down()
  await page.mouse.move(resize.x + 20, resize.y + 20)
  await expect
    .poll(async () => Math.round((await clock.boundingBox())!.width - beforeResize.width))
    .toBe(15)
  await expect
    .poll(async () => Math.round((await clock.boundingBox())!.height - beforeResize.height))
    .toBe(15)
  await page.mouse.up()
  await expect
    .poll(async () => Math.round((await clock.boundingBox())!.width))
    .toBe(Math.round(beforeResize.width))
})
