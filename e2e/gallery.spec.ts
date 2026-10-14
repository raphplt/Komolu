import { expect, test } from '@playwright/test'

test('gallery filters, real images, saved selection and return to original scene', async ({
  page,
}) => {
  await page.goto('./')
  await page.getByRole('button', { name: 'Studio', exact: true }).click()
  await page.getByRole('button', { name: 'Décor', exact: true }).click()
  await page.getByRole('button', { name: 'Galerie de fonds' }).click()
  const gallery = page.getByRole('dialog', { name: 'Galerie de fonds' })
  await expect(gallery.locator('.wallpaper-card')).toHaveCount(8)
  await gallery.getByRole('button', { name: 'Paysages', exact: true }).click()
  await expect(gallery.locator('.wallpaper-card')).toHaveCount(3)
  await gallery.getByRole('button', { name: 'Anime', exact: true }).click()
  await expect(gallery.locator('.wallpaper-card')).toHaveCount(2)
  await gallery.getByRole('button', { name: 'Intérieurs', exact: true }).click()
  await expect(gallery.locator('.wallpaper-card')).toHaveCount(3)
  await gallery.getByRole('button', { name: 'Choisir Loft sous la pluie' }).click()
  await expect(gallery).not.toBeVisible()
  const image = page.locator('.background-content img')
  await expect(image).toHaveAttribute('src', /wallpapers\/rainy-loft.webp$/)
  await expect
    .poll(() => image.evaluate((img: HTMLImageElement) => img.naturalWidth))
    .toBeGreaterThan(1000)
  await page.reload()
  await expect(image).toHaveAttribute('src', /wallpapers\/rainy-loft.webp$/)
  await page.getByRole('button', { name: 'Studio', exact: true }).click()
  await page.getByRole('button', { name: 'Décor', exact: true }).click()
  await page.getByRole('button', { name: 'Revenir au décor intégré' }).click()
  await expect(image).toHaveCount(0)
})

test('gallery image failure leaves an illustrated fallback and recovery control', async ({
  page,
}) => {
  await page.route('**/wallpapers/rainy-loft.webp', (route) => route.abort())
  await page.goto('./')
  await page.getByRole('button', { name: 'Studio', exact: true }).click()
  await page.getByRole('button', { name: 'Décor', exact: true }).click()
  await page.getByRole('button', { name: 'Galerie de fonds' }).click()
  await page.getByRole('button', { name: 'Choisir Loft sous la pluie' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Fond indisponible' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Revenir au décor intégré' })).toBeVisible()
})
