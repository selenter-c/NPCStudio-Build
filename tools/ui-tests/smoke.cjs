const { chromium } = require('playwright')
const assert = require('node:assert/strict')
const path = require('node:path')
const fs = require('node:fs')

;(async () => {
  const root = path.resolve(__dirname, '../../..')
  const presetDir = path.join(root, 'NPCStudio-GamePlugin/Data/SKSE/Plugins/NPCStudio/Equipment')
  const presets = fs.readdirSync(presetDir).filter(name => name.endsWith('.json')).map(name => ({ ...JSON.parse(fs.readFileSync(path.join(presetDir, name))), id: name.slice(0, -5), available: true, error: '' }))
  const browser = await chromium.launch({ headless: true, channel: 'chrome' })
  try {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.addInitScript(({ presets }) => {
      const female = id => id < 80 || (id >= 160 && id < 280)
      const number = id => id < 80 ? id + 1 : id < 160 ? id - 79 : id < 280 ? id - 79 : id - 199
      const state = { version: '0.5.0', capacity: 200, ready: true, worldLoaded: true, error: '', femaleUsed: 0, maleUsed: 0, slots: [], availableSlots: [], settings: { key: 9, modifiers: 1, language: 'ru', theme: 'amethyst' }, races: [{ id: 'NordRace', name: 'Норд' }, { id: 'WoodElfRace', name: 'Босмер' }, { id: 'KhajiitRace', name: 'Каджит' }], library: { presets, categories: [...new Set([...presets.map(preset => preset.category), 'Мои наборы'])].sort() } }
      const used = new Set()
      const inventory = new Map()
      let generation = 0
      window.testCommands = []
      window.testEvents = {}
      function refresh() {
        state.availableSlots = Array.from({ length: 400 }, (_, id) => ({ id, number: number(id), female: female(id), history: used.has(id) ? 'used' : 'fresh' })).filter(slot => !state.slots.some(actor => actor.id === slot.id))
        state.femaleUsed = state.slots.filter(slot => slot.female).length
        state.maleUsed = state.slots.length - state.femaleUsed
      }
      function equip(id, preset) { inventory.set(id, preset.items.map(item => ({ ...item, name: preset.name + ' · предмет', worn: true, kind: 'armor' }))) }
      function reply(payload) { refresh(); setTimeout(() => window.studioResponse({ requestId: payload.requestId, ok: true, state: structuredClone(state) }), 5) }
      refresh()
      window.magelight = {
        on: (name, callback) => { window.testEvents[name] = callback },
        send: (name, payload) => {
          window.testCommands.push(payload)
          if (payload.action === 'close') return
          const actor = state.slots.find(slot => slot.id === payload.id)
          if (actor && payload.identity !== undefined && actor.identity !== payload.identity) { setTimeout(() => window.studioResponse({ requestId: payload.requestId, ok: false, error: 'Персонаж в слоте изменился' }), 5); return }
          delete state.equipment
          delete state.equipmentOwnerId
          delete state.generatedName
          delete state.preview
          delete state.portrait
          if (payload.action === 'randomName') state.generatedName = { name: 'Эйра', source: 'NNDNord.json (Tamrielic Names / NND)' }
          if (payload.action === 'create') {
            const available = state.availableSlots.filter(slot => slot.female === payload.female).sort((a, b) => (a.history === 'used') - (b.history === 'used') || a.id - b.id)
            const slot = payload.slot === null ? available[0] : available.find(slot => slot.id === payload.slot)
            if (!slot) throw new Error('Неверный выбор слота')
            state.slots.push({ ...slot, name: payload.name, identity: 'generation-' + (++generation), parked: false, dead: false, reference: 'FE001' + slot.id.toString(16), raceId: payload.race, race: 'Норд', warning: '', restoring: false })
            used.add(slot.id)
            inventory.set(slot.id, [])
            if (payload.preset) equip(slot.id, state.library.presets.find(preset => preset.id === payload.preset))
          }
          if (payload.action === 'preview' || payload.action === 'portrait') {
            const canvas = document.createElement('canvas'); canvas.width = 300; canvas.height = 380
            const context = canvas.getContext('2d'); context.fillStyle = '#17131d'; context.fillRect(0,0,300,380)
            context.fillStyle = '#c4a0e7'; context.font = '18px sans-serif'; context.fillText('MOCK RENDERER',60,180)
            state[payload.action] = { identity: actor.identity, image: canvas.toDataURL(), portrait: canvas.toDataURL(), meshes: 12, skipped: 0 }
          }
          if (payload.action === 'setRace') actor.raceId = payload.race
          if (payload.action === 'rename') actor.name = payload.name
          if (payload.action === 'park') actor.parked = true
          if (payload.action === 'summon') { actor.parked = false; actor.warning = 'Снаряжение восстановлено; количество предметов проверено' }
          if (payload.action === 'delete') { state.slots = state.slots.filter(slot => slot.id !== actor.id); inventory.delete(actor.id) }
          if (payload.action === 'saveSettings') state.settings = payload.settings
          if (payload.action === 'addCategory') { state.library.categories.push(payload.name); state.library.categories.sort() }
          if (payload.action === 'applyEquipmentPreset') equip(actor.id, state.library.presets.find(preset => preset.id === payload.preset))
          if (payload.action === 'unequipItem') inventory.get(actor.id).find(item => item.form === payload.item.form).worn = false
          if (payload.action === 'giveItem') {
            const existing = inventory.get(actor.id).find(item => item.form === payload.item.form)
            if (existing) existing.worn = true
            else inventory.get(actor.id).push({ ...payload.item, name: 'Тестовый предмет', count: 1, worn: true, kind: 'armor' })
          }
          if (payload.action === 'saveEquipmentPreset') state.library.presets.push({ id: 'user-' + generation, name: payload.name, category: payload.category, available: true, items: structuredClone(inventory.get(actor.id)) })
          if (['equipment', 'applyEquipmentPreset', 'saveEquipmentPreset', 'giveItem', 'unequipItem'].includes(payload.action)) {
            state.equipmentOwnerId = actor.id
            state.equipment = { inventory: inventory.get(actor.id), catalog: [{ plugin: 'Skyrim.esm', form: 0x2150D, name: 'Броня стражника', count: 1, worn: false, kind: 'armor' }], matches: 1 }
          }
          reply(payload)
        }
      }
    }, { presets })
    const Combo = async (id, label) => {
      await page.locator('#' + id).locator('..').getByRole('combobox').click()
      await page.locator('.combo-popup').getByRole('option', { name: label, exact: true }).click()
    }
    const Tab = name => page.locator('[data-tab="' + name + '"]').click()
    await page.goto('file:///' + path.join(root, 'NPCStudio-GamePlugin/Data/Magelight/NPCStudio/views/studio/index.html').replaceAll('\\', '/'))
    await page.waitForFunction(() => document.querySelector('#hotkeyHint').textContent === 'Shift + 8')
    assert.equal(await page.locator('#hotkeyHint').textContent(), 'Shift + 8')
    await page.locator('#randomName').click()
    await page.waitForFunction(() => document.querySelector('#newName').value === 'Эйра')
    await Combo('creationCategory', 'Стража владений')
    await Combo('creationPreset', 'Стража: Вайтран')
    await Combo('creationRace', 'Каджит')
    await page.locator('#createButton').click()
    await page.waitForFunction(() => document.querySelector('#selectedName').textContent === 'Эйра')
    assert.equal(await page.locator('#femaleCount').textContent(), '1 / 200')
    assert.equal(await page.evaluate(() => window.testCommands.find(command => command.action === 'create').race), 'KhajiitRace')
    await page.waitForFunction(() => !document.querySelector('#previewImage').hidden)
    assert.equal(await page.locator('.avatar img').count(), 1)
    await page.locator('#previewYaw').fill('90')
    await page.locator('#previewYaw').dispatchEvent('input')
    await page.waitForFunction(() => window.testCommands.some(command => command.action === 'preview' && command.yaw === 90))
    await Combo('editRace', 'Босмер')
    await page.locator('#setRace').click()
    await page.waitForFunction(() => State.slots[0].raceId === 'WoodElfRace')
    assert.equal(await page.evaluate(() => window.testCommands.find(command => command.action === 'create').preset), 'guard-whiterun')
    await page.locator('#editName').fill('<img src=x onerror=alert(1)>')
    await page.locator('#rename').click()
    await page.waitForFunction(() => document.querySelector('#selectedName').textContent.startsWith('<img'))
    assert.equal(await page.locator('#selectedName img').count(), 0)
    await page.locator('#editName').fill('Элара')
    await page.locator('#rename').click()
    await page.waitForFunction(() => document.querySelector('#selectedName').textContent === 'Элара')
    await Tab('equipment')
    await page.waitForFunction(() => document.querySelectorAll('#equipmentInventory button').length === 6)
    assert.equal(await page.locator('#equipmentInventory button').first().textContent(), 'Снять')
    await Tab('roster')
    await page.locator('#park').click()
    await page.waitForFunction(() => document.querySelector('#status').textContent === 'Убран из мира')
    await page.locator('#summon').click()
    await page.waitForFunction(() => document.querySelector('#actorWarning').textContent.includes('восстановлено'))
    await Tab('presets')
    await page.locator('#categoryName').fill('Мой отряд')
    await page.locator('#addCategory').click()
    await page.waitForFunction(() => document.querySelector('#saveCategory').textContent.includes('Мой отряд'))
    await Combo('saveCategory', 'Мой отряд')
    await page.locator('#presetName').fill('Мой комплект')
    await page.locator('#savePreset').click()
    await page.waitForFunction(() => document.querySelector('#equipmentPreset').textContent.includes('Мой комплект'))
    await Combo('presetCategory', 'Мой отряд')
    assert.equal(await page.locator('.preset-card').count(), 1)
    await Tab('settings')
    await Combo('hotkeyKey', 'F7')
    await page.locator('#modifierCtrl').check()
    await page.locator('#saveSettings').click()
    await page.waitForFunction(() => document.querySelector('#hotkeyHint').textContent === 'Shift + Ctrl + F7')
    await page.locator('#resetSettings').click()
    await page.locator('#saveSettings').click()
    await page.waitForFunction(() => document.querySelector('#hotkeyHint').textContent === 'Shift + 8')
    const originalColor = await page.locator('.studio').evaluate(element => getComputedStyle(element).backgroundColor)
    await Combo('language', 'English')
    await Combo('theme', 'Изумруд')
    await page.locator('#saveSettings').click()
    await page.waitForFunction(() => document.documentElement.lang === 'en')
    assert.equal(await page.locator('[data-tab="roster"]').innerText(), 'My characters\n1')
    assert.notEqual(await page.locator('.studio').evaluate(element => getComputedStyle(element).backgroundColor), originalColor)
    await Tab('roster')
    assert.equal(await page.locator('#actorPicker option[value=""]').textContent(), 'Not selected')
    assert.equal(await page.locator('#selectedName').textContent(), 'Элара')
    assert.equal(await page.locator('#setRace').textContent(), 'Apply race')
    await Tab('settings')
    await page.screenshot({ path: path.join(root, 'NPCStudio-NativePlugin/docs/ui-050-settings-en.png') })
    await Combo('language', 'Русский')
    await page.locator('#saveSettings').click()
    await page.waitForFunction(() => document.documentElement.lang === 'ru')
    await Tab('roster')
    const oldIdentity = await page.evaluate(() => State.slots[0].identity)
    await page.locator('#deleteNpc').click()
    await page.locator('#cancelDelete').click()
    assert.equal(await page.locator('.npc').count(), 1)
    await page.locator('#deleteNpc').click()
    await page.locator('#confirmDelete').click()
    await page.waitForFunction(() => document.querySelector('#femaleCount').textContent === '0 / 200')
    await Tab('create')
    assert.equal(await page.locator('#slotSelect option[value="0"]').textContent(), 'Слот 1 · использовался')
    await page.locator('#newName').fill('Новая Элара')
    await page.locator('#createButton').click()
    await page.waitForFunction(() => document.querySelector('#selectedName').textContent === 'Новая Элара')
    assert.equal(await page.evaluate(() => State.slots[0].id), 1, 'Авто-выбор переиспользовал удалённый слот')
    await Tab('create')
    await Combo('slotSelect', 'Слот 1 · использовался')
    await page.locator('#newName').fill('Повторный слот')
    await page.locator('#createButton').click()
    await page.waitForFunction(() => document.querySelector('#selectedName').textContent === 'Повторный слот')
    const staleRejected = await page.evaluate(async oldIdentity => { try { await Send('rename', { id: 0, identity: oldIdentity, name: 'Старая команда' }); return false } catch { return true } }, oldIdentity)
    assert.equal(staleRejected, true)
    await Tab('create')
    await Combo('sex', 'Мужской')
    await page.locator('#slotSelect').locator('..').getByRole('combobox').click()
    await page.locator('.combo-popup input').fill('Слот 200')
    await page.locator('.combo-popup').getByRole('option', { name: 'Слот 200 · новый', exact: true }).click()
    await page.locator('#newName').fill('Последний слот')
    await page.locator('#createButton').click()
    await page.waitForFunction(() => document.querySelector('#selectedName').textContent === 'Последний слот')
    assert.equal(await page.evaluate(() => State.slots.find(slot => slot.name === 'Последний слот').id), 399)
    await page.locator('#search').fill('последний')
    assert.equal(await page.locator('.npc').count(), 1)
    await page.locator('#search').fill('')
    for (const tab of ['create', 'roster', 'equipment', 'presets', 'settings']) {
      await Tab(tab)
      for (const viewport of [{ width: 1920, height: 1080 }, { width: 1280, height: 720 }]) {
        await page.setViewportSize(viewport)
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, tab + ': переполнение окна')
        assert.equal(await page.evaluate(() => document.querySelector('.workspace').scrollWidth > document.querySelector('.workspace').clientWidth), false, tab + ': переполнение панели')
      }
    }
    await page.setViewportSize({ width: 1920, height: 1080 })
    await Tab('create')
    await page.screenshot({ path: path.join(root, 'NPCStudio-NativePlugin/docs/ui-050-create.png') })
    await Tab('roster')
    await page.screenshot({ path: path.join(root, 'NPCStudio-NativePlugin/docs/ui-050-roster.png') })
    await page.evaluate(() => window.testEvents.__uimode('0'))
    const closedCount = await page.evaluate(() => window.testCommands.length)
    await page.waitForTimeout(650)
    assert.equal(await page.evaluate(() => window.testCommands.length), closedCount, 'Закрытый UI продолжает отправлять команды')
    await page.evaluate(() => window.testEvents.__uimode('1'))
    await page.waitForFunction(() => !document.querySelector('#previewImage').hidden)
    assert.deepEqual(errors, [])
    console.log('UI 0.5: locale/theme/race/portrait/preview camera, custom combos/search, spawn preset, slots/history/reuse/399, categories, random names, settings, gear UI, escaping, stale identity, 5 pages at 720p/1080p passed')
  } finally { await browser.close() }
})().catch(error => { console.error(error); process.exitCode = 1 })
