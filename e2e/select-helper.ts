import type { Locator } from '@playwright/test'

export async function chooseOption(combobox: Locator, value: string) {
  await combobox.click()
  await combobox.locator('..').locator(`[role="option"][data-value="${value}"]`).click()
}
