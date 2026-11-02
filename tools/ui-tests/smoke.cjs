const { chromium } = require('playwright')
const assert = require('node:assert/strict')
const path = require('node:path')
const fs = require('node:fs')

;(async () => {
  const root = path.resolve(__dirname, '../../..')
  const browser = await chromium.launch({ headless: true, channel: 'chrome' })
  try {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.addInitScript(() => {
      const state = { version: '0.2.0', ready: true, worldLoaded: true, error: '', femaleUsed: 0, maleUsed: 0, slots: [] }
      const equipment = { inventory: [], presets: [{ id: 'guard-whiterun', name: 'Стража: Вайтран', items: [{ plugin: 'Skyrim.esm', form: 0x2150D }], available: true }, { id: 'missing', name: 'Недоступный', items: [], available: false, error: 'Нет Missing.esp' }], catalog: [{ plugin: 'Skyrim.esm', form: 0x2150D, name: 'Броня стражника', count: 1, worn: false, kind: 'armor' }], matches: 1 }
      window.testCommands = []
      const handlers = new Map()
      window.magelight = {
        on: (name, callback) => handlers.set(name, callback),
        send: (name, payload) => {
          window.testCommands.push(payload)
          if (payload.action === 'close') return
          if (payload.action === 'create') {
            const id = payload.female ? state.femaleUsed++ : 80 + state.maleUsed++
            state.slots.push({ id, female: payload.female, name: payload.name, parked: false, dead: false, reference: 'FE001B00', race: 'Норд' })
          }
          const slot = state.slots.find(item => item.id === payload.id)
          if (payload.action === 'rename') slot.name = payload.name
          if (payload.action === 'park') slot.parked = true
          if (payload.action === 'summon') slot.parked = false
          if (payload.action === 'equipment' || payload.action.endsWith('EquipmentPreset') || ['giveItem', 'unequipItem'].includes(payload.action)) {
            if (payload.action === 'giveItem' || payload.action === 'applyEquipmentPreset') equipment.inventory = [{ ...equipment.catalog[0], worn: true }]
            if (payload.action === 'unequipItem') equipment.inventory[0].worn = false
            if (payload.action === 'saveEquipmentPreset') equipment.presets.push({ id: 'user-1', name: payload.name, items: equipment.inventory, available: true })
            state.equipment = structuredClone(equipment)
            state.equipmentOwnerId = payload.id
          }
          setTimeout(() => window.studioResponse({ requestId: payload.requestId, ok: true, state: structuredClone(state) }), 5)
        }
      }
    })
    await page.goto('file:///' + path.join(root, 'NPCStudio-GamePlugin/Data/Magelight/NPCStudio/views/studio/index.html').replaceAll('\\', '/'))
    await page.waitForFunction(() => document.querySelector('#connection').textContent === 'Игра подключена')
    await page.locator('#newName').fill('Элара')
    await page.locator('#createButton').click()
    await page.waitForFunction(() => document.querySelector('#selectedName').textContent === 'Элара')
    assert.equal(await page.locator('#femaleCount').textContent(), '1 / 80')
    await page.locator('#editName').fill('<img src=x onerror=alert(1)>')
    await page.locator('#rename').click()
    await page.waitForFunction(() => document.querySelector('#selectedName').textContent.startsWith('<img'))
    assert.equal(await page.locator('#selectedName img').count(), 0)
    await page.locator('#editName').fill('Элара')
    await page.locator('#rename').click()
    await page.waitForFunction(() => document.querySelector('#selectedName').textContent === 'Элара')
    await page.locator('#park').click()
    await page.waitForFunction(() => document.querySelector('#status').textContent === 'Убран из мира')
    assert.equal(await page.locator('#teleport').isDisabled(), true)
    await page.locator('#summon').click()
    await page.waitForFunction(() => document.querySelector('#status').textContent === 'В мире')
    await page.locator('#search').fill('эЛа')
    assert.equal(await page.locator('.npc').count(), 1)
    await page.locator('#search').fill('несуществующий')
    assert.equal(await page.locator('.npc').count(), 0)
    await page.locator('#search').fill('')
    await page.locator('#equipmentTab').click()
    await page.locator('#equipmentContent').waitFor({ state: 'visible' })
    await page.waitForFunction(() => !document.querySelector('#applyPreset').disabled)
    await page.locator('#equipmentPreset').selectOption('missing')
    assert.equal(await page.locator('#applyPreset').isDisabled(), true)
    assert.equal(await page.locator('#presetDescription').textContent(), 'Нет Missing.esp')
    await page.locator('#equipmentPreset').selectOption('guard-whiterun')
    await page.locator('#applyPreset').click()
    await page.waitForFunction(() => document.querySelector('#equipmentInventory').textContent.includes('надето'))
    await page.locator('#equipmentInventory button').click()
    await page.waitForFunction(() => document.querySelector('#equipmentInventory button').textContent === 'Надеть')
    await page.locator('#equipmentCatalog button').click()
    await page.waitForFunction(() => document.querySelector('#equipmentInventory button').textContent === 'Снять')
    await page.locator('#presetName').fill('Мой наряд')
    await page.locator('#savePreset').click()
    await page.waitForFunction(() => document.querySelector('#equipmentPreset').textContent.includes('Мой наряд'))
    await page.locator('#equipmentQuery').fill('стражник')
    await page.locator('#equipmentSearchForm button').click()
    await page.waitForFunction(() => window.testCommands.some(Command => Command.action === 'equipment' && Command.query === 'стражник'))
    await page.locator('#charactersTab').click()
    assert.equal(await page.locator('#properties').isVisible(), true)
    await page.locator('#equipmentTab').click()
    for (const viewport of [{ width: 1920, height: 1080 }, { width: 1280, height: 720 }]) {
      await page.setViewportSize(viewport)
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)
      assert.equal(overflow, false, 'Горизонтальное переполнение окна')
    }
    await page.setViewportSize({ width: 1920, height: 1080 })
    const screenshot = path.join(root, 'NPCStudio-NativePlugin/docs/ui-equipment.png')
    await page.screenshot({ path: screenshot })
    assert.deepEqual(errors, [])
    console.log('UI smoke: create, Cyrillic, rename, text escaping, park, summon, search, equipment, missing dependency, preset saving, 720p/1080p passed')
  } finally { await browser.close() }
})().catch(error => { console.error(error); process.exitCode = 1 })
