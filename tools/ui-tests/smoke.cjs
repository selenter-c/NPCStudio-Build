const { chromium } = require('playwright')
const assert = require('node:assert/strict')
const path = require('node:path')
const fs = require('node:fs')

;(async () => {
  const root = path.resolve(__dirname, '../../..')
  const presetDir = path.join(root, 'NPCStudio-GamePlugin/Data/SKSE/Plugins/NPCStudio/Equipment')
  const presets = fs.readdirSync(presetDir).filter(name => name.endsWith('.json')).map(name => ({ ...JSON.parse(fs.readFileSync(path.join(presetDir, name))), id: name.slice(0, -5), available: true, custom: false, error: '' }))
  const browser = await chromium.launch({ headless: true, channel: 'chrome' })
  try {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.addInitScript(({ presets }) => {
      const female = id => id < 200
      const number = id => id % 200 + 1
      const state = { version: '0.6.1', capacity: 200, ready: true, worldLoaded: true, error: '', femaleUsed: 0, maleUsed: 0, slots: [], availableSlots: [], settings: { key: 9, modifiers: 1, language: 'ru', theme: 'amethyst' }, races: [{ id: 'NordRace', name: 'Норд' }, { id: 'WoodElfRace', name: 'Босмер' }, { id: 'KhajiitRace', name: 'Каджит' }, { id: 'OrcRace', name: 'Орк' }], library: { presets, categories: [...new Set([...presets.map(preset => preset.category), 'Мои наборы'])].sort() } }
      const used = new Set()
      const inventory = new Map()
      const savedPortraits = new Map()
      const looks = new Map()
      let generation = 0
      window.testCommands = []
      window.testEvents = {}
      function refresh() {
        state.availableSlots = Array.from({ length: 400 }, (_, id) => ({ id, number: number(id), female: female(id), history: used.has(id) ? 'used' : 'fresh' })).filter(slot => !state.slots.some(actor => actor.id === slot.id))
        state.femaleUsed = state.slots.filter(slot => slot.female).length
        state.maleUsed = state.slots.length - state.femaleUsed
      }
      function equip(id, preset) {
        const items = inventory.get(id)
        for (const item of items) item.worn = false
        for (const item of preset.items) {
          const existing = items.find(entry => entry.plugin === item.plugin && entry.form === item.form)
          if (existing) {
            existing.count = Math.max(existing.count, item.count)
            existing.worn = true
          } else items.push({ ...item, name: preset.name + ' · предмет', worn: true, kind: 'armor' })
        }
      }
      function reply(payload) { refresh(); setTimeout(() => window.studioResponse({ requestId: payload.requestId, ok: true, state: structuredClone(state) }), 5) }
      refresh()
      window.magelight = {
        on: (name, callback) => { window.testEvents[name] = callback },
        send: (name, payload) => {
          window.testCommands.push(payload)
          if (payload.action === 'portraitCache') {
            const portraits = Object.fromEntries(payload.identities.filter(identity => savedPortraits.has(identity)).map(identity => [identity, savedPortraits.get(identity)]))
            setTimeout(() => window.studioResponse({ requestId: payload.requestId, ok: true, state: { partial: true, portraits } }), 5)
            return
          }
          if (payload.action === 'close') return
          const actor = state.slots.find(slot => slot.id === payload.id)
          if (actor && payload.identity !== undefined && actor.identity !== payload.identity) { setTimeout(() => window.studioResponse({ requestId: payload.requestId, ok: false, error: 'Персонаж в слоте изменился' }), 5); return }
          delete state.equipment
          delete state.equipmentOwnerId
          delete state.generatedName
          delete state.preview
          delete state.portrait
          delete state.appearanceTarget
          if (payload.action === 'openState' && window.testAppearanceTarget) state.appearanceTarget = window.testAppearanceTarget
          const lookIdentity = 'look-' + (actor?.identity || payload.reference)
          if (payload.action === 'hairThumbnailCancel') {
            setTimeout(() => window.studioResponse({ requestId: payload.requestId, ok: true, state: { partial: true } }), 5)
            return
          }
          if (['tryAppearance', 'appearanceFrame', 'hairThumbnail'].includes(payload.action)) {
            const canvas = document.createElement('canvas'); canvas.width = canvas.height = 64
            const context = canvas.getContext('2d'); context.fillStyle = '#9c583d'; context.fillRect(0, 0, 64, 64)
            const preview = payload.action === 'hairThumbnail'
              ? { kind: 'hairThumbnail', token: payload.token, pending: true }
              : { kind: 'actor', identity: lookIdentity, pending: true }
            if (payload.action === 'hairThumbnail' && window.testCachedHairShot) {
              window.testCachedHairShot = false
              const hairThumbnail = { ...preview, pending: false, image: canvas.toDataURL() }
              setTimeout(() => window.studioResponse({ requestId: payload.requestId, ok: true, state: { partial: true, hairThumbnail } }), 5)
              return
            }
            setTimeout(() => window.studioResponse({ requestId: payload.requestId, ok: true, state: { partial: true, preview } }), 5)
            if (payload.action === 'hairThumbnail' && window.testDropHairShot) {
              window.testDropHairShot = false
              return
            }
            setTimeout(() => window.studioPreview({ ...preview, pending: false, image: canvas.toDataURL() }), 20)
            return
          }
          if (['appearance', 'applyAppearance'].includes(payload.action)) {
            const Key = actor?.identity || payload.reference
            const Look = looks.get(Key) || { hair: 101, color: 201, hairName: 'Короткие' }
            if (payload.action === 'applyAppearance') {
              Look.hair = payload.hair
              Look.hairName = payload.hair === 101 ? 'Короткие' : 'Коса'
              Look.color = payload.color
              looks.set(Key, Look)
            }
            const appearance = { ...Look, name: actor?.name || 'Лидия', available: true, hairAvailable: true, previewIdentity: lookIdentity,
              hairs: [{ id: 101, name: 'Короткие', plugin: 'Skyrim.esm' }, { id: 102, name: 'Коса', plugin: 'ExampleHair.esp' },
                ...Array.from({ length: 1000 }, (_, Index) => ({ id: 1000 + Index, name: 'Стиль ' + Index, plugin: 'OtherHair.esp' }))],
              colors: [{ id: 201, name: 'Русый', rgb: '#82543E' }, { id: 202, name: 'Чёрный', rgb: '#121212' }] }
            setTimeout(() => window.studioResponse({ requestId: payload.requestId, ok: true, state: { partial: true, appearance } }), 5)
            return
          }
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
          if (['preview', 'portrait', 'itemPreview', 'previewStop'].includes(payload.action)) {
            if (payload.action === 'previewStop') {
              setTimeout(() => window.studioResponse({ requestId: payload.requestId, ok: true, state: { partial: true } }), 5)
              return
            }
            const canvas = document.createElement('canvas'); canvas.width = 300; canvas.height = 380
            const context = canvas.getContext('2d'); context.fillStyle = '#17131d'; context.fillRect(0,0,300,380)
            context.fillStyle = '#c4a0e7'; context.font = '18px sans-serif'; context.fillText('MOCK PHANTASM',60,180)
            const kind = payload.action === 'itemPreview' ? 'item' : payload.action === 'portrait' ? 'portrait' : 'actor'
            const identity = kind === 'item' ? 'item-' + payload.item.form : actor.identity
            const update = { identity, kind, pending: true, backend: 'Phantasm 0.3.0' }
            setTimeout(() => window.studioResponse({ requestId: payload.requestId, ok: true, state: { partial: true, [payload.action]: update } }), 5)
            if (payload.editorCapture && window.testPortraitFailure) {
              setTimeout(() => window.studioPreview({ ...update, pending: false, error: 'Cannot replace portrait' }), 20)
              return
            }
            if (kind === 'portrait') savedPortraits.set(payload.identity, canvas.toDataURL())
            setTimeout(() => window.studioPreview({ ...update, pending: false, image: canvas.toDataURL(), ...(kind === 'portrait' ? { portrait: canvas.toDataURL() } : {}) }), 20)
            return
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
          if (payload.action === 'equipItem') inventory.get(actor.id).find(item => item.form === payload.item.form).worn = true
          if (payload.action === 'removeItem') inventory.set(actor.id, inventory.get(actor.id).filter(item => item.plugin !== payload.item.plugin || item.form !== payload.item.form))
          if (payload.action === 'giveItem') {
            const existing = inventory.get(actor.id).find(item => item.form === payload.item.form)
            if (existing) existing.worn = true
            else inventory.get(actor.id).push({ ...payload.item, name: 'Тестовый предмет', count: 1, worn: true, kind: 'armor' })
          }
          if (payload.action === 'editPreset') {
            const id = payload.preset || 'user-' + generation
            state.library.presets = state.library.presets.filter(P => P.id !== id)
            state.library.presets.push({ id, name: payload.name, category: payload.category, available: true, custom: true, items: structuredClone(payload.items) })
          }
          if (payload.action === 'presetCatalog') {
            setTimeout(() => window.studioResponse({ requestId: payload.requestId, ok: true, state: { partial: true, catalog: [{ plugin: 'Skyrim.esm', form: 0x2150D, name: 'Броня стражника', count: 1, kind: 'armor', category: 'body' }] } }), 5)
            return
          }
          if (['equipment', 'applyEquipmentPreset', 'giveItem', 'equipItem', 'unequipItem', 'removeItem'].includes(payload.action)) {
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
    assert.equal(await page.locator('#slotSelect option').count(), 201)
    assert.equal((await page.locator('#slotSelect').textContent()).includes('неизвестна'), false)
    assert.equal(await page.locator('#slotSelect option[value="0"]').textContent(), '● Слот 1 · новый')
    assert.equal(await page.locator('#slotSelect option[value="199"]').textContent(), '● Слот 200 · новый')
    await page.locator('#randomName').click()
    await page.waitForFunction(() => document.querySelector('#newName').value === 'Эйра')
    await Combo('creationCategory', 'Стража владений')
    await Combo('creationPreset', 'Стража: Вайтран')
    await Combo('creationRace', 'Орк')
    await page.locator('#createButton').click()
    await page.waitForFunction(() => document.querySelector('#selectedName').textContent === 'Эйра')
    assert.equal(await page.locator('#femaleCount').textContent(), '1 / 200')
    assert.equal(await page.evaluate(() => window.testCommands.find(command => command.action === 'create').race), 'OrcRace')
    await page.waitForFunction(() => !document.querySelector('#previewImage').hidden)
    await page.waitForFunction(() => document.querySelectorAll('.avatar img').length === 1)
    await page.getByRole('button', { name: 'Переснять портрет', exact: true }).click()
    assert.equal(await page.locator('.portrait-editor #previewViewport').count(), 1)
    assert.equal(await page.locator('.portrait-circle').isVisible(), true)
    assert.equal(await page.locator('.portrait-live .preview-viewport').evaluate(Node => Node.clientHeight), 640)
    assert.equal(await page.locator('.portrait-live .preview-viewport').evaluate(Node => Node.clientWidth), 480)
    await page.locator('.portrait-save').click()
    await page.waitForFunction(() => !document.querySelector('.portrait-editor').open)
    assert.equal(await page.locator('.portrait-editor #previewViewport').count(), 0)
    assert.ok(await page.evaluate(() => window.testCommands.some(command => command.action === 'portrait' && command.editorCapture && command.capture)))
    // Ошибка записи оставляет живой редактор открытым и позволяет повторить сохранение.
    await page.getByRole('button', { name: 'Переснять портрет', exact: true }).click()
    await page.waitForFunction(() => !PreviewBusy && !!PreviewFrame?.image)
    await page.evaluate(() => { window.testPortraitFailure = true })
    await page.locator('.portrait-save').click()
    await page.waitForFunction(() => !PortraitBusy && !PortraitSaving && document.querySelector('.portrait-editor').open)
    assert.equal(await page.locator('.portrait-editor #previewViewport').count(), 1)
    await page.evaluate(() => { window.testPortraitFailure = false })
    await page.waitForFunction(() => !PreviewBusy && !!PreviewFrame?.image)
    await page.locator('.portrait-save').click()
    await page.waitForFunction(() => !document.querySelector('.portrait-editor').open)
    await page.evaluate(() => {
      PortraitBusy = true
      ReceivePreview({ kind: 'portrait', identity: State.slots[0].identity, pending: true })
      if (!PortraitBusy) throw new Error('Portrait acknowledgement released live view too early')
      PortraitBusy = false
    })
    // Переключение вкладки и обновление 3D не должны сбрасывать сохранённый аватар.
    const PortraitBefore = await page.locator('.avatar img').getAttribute('src')
    await Tab('settings')
    await Tab('roster')
    await page.waitForFunction(() => !PreviewBusy && !!PreviewFrame?.image)
    assert.equal(await page.locator('.avatar img').getAttribute('src'), PortraitBefore)
    await page.locator('#previewRefresh').click()
    await page.waitForFunction(() => !PreviewBusy)
    assert.equal(await page.locator('.avatar img').getAttribute('src'), PortraitBefore)
    // Имитируем новый HTML-сеанс: диск возвращает портрет без нового GPU-снимка.
    const CapturesBefore = await page.evaluate(() => window.testCommands.filter(Command => Command.action === 'portrait').length)
    await page.evaluate(() => { Portraits.clear(); PortraitCacheChecked.clear(); PortraitAttempts.clear(); Render() })
    await page.waitForFunction(() => !PortraitCacheBusy && document.querySelectorAll('.avatar img').length === 1)
    assert.equal(await page.evaluate(() => window.testCommands.filter(Command => Command.action === 'portrait').length), CapturesBefore)
    assert.equal(await page.locator('.avatar img').getAttribute('src'), PortraitBefore)
    await page.locator('#previewYaw').evaluate(el => { el.value = '90' })
    await page.locator('#previewYaw').dispatchEvent('input')
    await page.waitForFunction(() => window.testCommands.some(command => command.action === 'preview' && command.yaw === 90))
    const RosterNode = await page.locator('#list .npc').first().elementHandle()
    const CameraBefore = await page.evaluate(() => window.testCommands.filter(command => command.action === 'preview').length)
    await page.evaluate(() => {
      const Slider = document.querySelector('#previewYaw')
      for (let Index = 0; Index < 100; Index++) { Slider.value = String(Index); Slider.dispatchEvent(new Event('input')) }
    })
    await page.waitForFunction(() => window.testCommands.some(command => command.action === 'preview' && command.yaw === 99))
    assert.ok(await RosterNode.evaluate(Node => Node === document.querySelector('#list .npc')), 'camera must not rebuild the roster')
    assert.ok(await page.evaluate(Before => window.testCommands.filter(command => command.action === 'preview').length - Before <= 3, CameraBefore), 'rapid input must coalesce')
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
    await page.waitForFunction(() => document.querySelectorAll('#equipmentInventory .equipment-item').length === 6)
    assert.equal(await page.locator('#equipmentInventory .equipment-item').first().locator('button').first().textContent(), 'Снять')
    await page.locator('#equipmentInventory .equipment-item').first().click()
    await page.waitForFunction(() => !document.querySelector('#itemPreviewImage').hidden)
    assert.equal(await page.locator('#itemPreviewYaw').inputValue(), '180')
    await page.locator('#itemPreviewViewport').dispatchEvent('pointerdown', { button: 2, clientX: 100, clientY: 100, pointerId: 1 })
    await page.locator('#itemPreviewViewport').dispatchEvent('pointermove', { clientX: 130, clientY: 120, pointerId: 1 })
    assert.equal(await page.locator('#itemPreviewImage').evaluate(el => el.style.transform), '')
    assert.ok(await page.locator('#itemPreviewViewport').evaluate(el => Number(el.dataset.panX) > 0))
    await page.locator('#itemPreviewViewport').dispatchEvent('pointerup', { pointerId: 1 })
    await page.locator('#itemPreviewViewport .camera-home').click()
    assert.equal(await page.locator('#itemPreviewImage').evaluate(el => el.style.transform), '')
    await page.screenshot({ path: path.join(root, 'NPCStudio-NativePlugin/docs/ui-072-item-mock.png') })
    const BeforeWheel = await page.locator('#itemPreviewZoom').inputValue()
    await page.locator('#itemPreviewViewport').dispatchEvent('wheel', { deltaY: -1 })
    assert.notEqual(await page.locator('#itemPreviewZoom').inputValue(), BeforeWheel)
    const PanelBox = await page.locator('#itemPreviewPanel').boundingBox()
    const ListBox = await page.locator('#equipmentInventory').boundingBox()
    assert(PanelBox.x >= ListBox.x + ListBox.width)
    await page.locator('#itemPreviewYaw').evaluate(el => { el.value = '45' })
    await page.locator('#itemPreviewYaw').dispatchEvent('input')
    await page.waitForFunction(() => window.testCommands.some(command => command.action === 'itemPreview' && command.yaw === 45))
    await page.locator('#itemPreviewViewport').dispatchEvent('pointerdown', { button: 0, clientX: 100, clientY: 100, pointerId: 1 })
    await page.locator('#itemPreviewViewport').dispatchEvent('pointermove', { clientX: 140, clientY: 130, pointerId: 1 })
    await page.waitForFunction(() => window.testCommands.some(command => command.action === 'itemPreview' && command.pitch > 0 && command.yaw !== 45))
    await page.locator('#itemPreviewViewport').dispatchEvent('pointerup', { pointerId: 1 })
    await page.locator('#itemPreviewClose').click()
    assert.equal(await page.locator('#itemPreviewPanel').isVisible(), false)
    assert.equal(await page.locator('#replaceLoadout').isEnabled(), false)
    await Combo('inventoryPreset', 'Имперский легионер')
    await page.locator('#replaceLoadout').click()
    await page.waitForFunction(() => !EquipmentBusy && Equipment.inventory.some(Item => !Item.worn))
    assert.equal(await page.evaluate(() => window.testCommands.find(Command => Command.action === 'applyEquipmentPreset').preset), 'imperial-heavy')
    const OldItem = page.locator('#equipmentInventory .equipment-item').filter({ has: page.getByRole('button', { name: 'Надеть', exact: true }) }).first()
    await OldItem.getByRole('button', { name: 'Удалить', exact: true }).click()
    await OldItem.getByRole('button', { name: 'Отмена' }).click()
    assert.equal(await page.evaluate(() => window.testCommands.some(Command => Command.action === 'removeItem')), false)
    const BeforeRemoval = await page.locator('#equipmentInventory .equipment-item').count()
    await OldItem.getByRole('button', { name: 'Удалить', exact: true }).click()
    await OldItem.getByRole('button', { name: /^Удалить ×/ }).click()
    await page.waitForFunction(Count => !EquipmentBusy && Equipment.inventory.length === Count, BeforeRemoval - 1)
    assert.ok(await page.evaluate(() => window.testCommands.find(Command => Command.action === 'removeItem').identity))
    await page.evaluate(() => {
      window.testAppearanceTarget = { id: State.slots[0].id }
      window.testEvents.__uimode('0')
      window.testEvents.__uimode('1')
    })
    await page.waitForFunction(() => CurrentTab === 'appearance' && Appearance?.name === 'Элара' && !AppearanceBusy)
    assert.equal(await page.locator('#applyAppearance').isEnabled(), false)
    await page.waitForFunction(() => !document.querySelector('#appearanceImage').hidden)
    assert.equal(await page.locator('#appearanceViewport .camera-toolbar button').count(),
      await page.locator('#previewViewport .camera-toolbar button').count())
    const LookCount = await page.evaluate(() => window.testCommands.filter(Command => Command.action === 'appearanceFrame').length)
    await page.evaluate(() => {
      for (let Index = 0; Index < 100; Index++) {
        Elements.appearanceYaw.value = String(Index)
        Elements.appearanceYaw.dispatchEvent(new Event('input'))
      }
    })
    await page.waitForFunction(() => window.testCommands.some(Command => Command.action === 'appearanceFrame' && Command.yaw === 99))
    assert.ok(await page.evaluate(Count => window.testCommands.filter(Command => Command.action === 'appearanceFrame').length - Count <= 2, LookCount))
    await page.locator('#appearanceViewport').dispatchEvent('pointerdown', { button: 2, clientX: 100, clientY: 100, pointerId: 1 })
    await page.locator('#appearanceViewport').dispatchEvent('pointermove', { clientX: 130, clientY: 125, pointerId: 1 })
    await page.locator('#appearanceViewport').dispatchEvent('pointerup', { pointerId: 1 })
    await page.waitForFunction(() => window.testCommands.some(Command => Command.action === 'appearanceFrame' && Command.panX > 0))
    await page.evaluate(() => { window.testDropHairShot = true })
    await page.locator('#openHairPicker').click()
    await page.waitForFunction(() => HairShot && window.testDropHairShot === false)
    await page.evaluate(() => { window.testCachedHairShot = true; return RecoverHairShot(HairShot.Token) })
    await page.waitForFunction(() => document.querySelector('#hairGrid .hair-thumb img'))
    assert.ok(await page.evaluate(() => window.testCommands.some(Command => Command.action === 'hairThumbnailCancel')))
    assert.ok(await page.evaluate(() => window.testCommands.filter(Command => Command.action === 'hairThumbnail').length < 12))
    await page.locator('#hairSearch').fill('ExampleHair.esp')
    assert.equal(await page.locator('#hairGrid .hair-card').count(), 1)
    await page.locator('#hairGrid .hair-card').click()
    await page.locator('.hair-swatch[aria-label="Чёрный"]').click()
    await page.waitForFunction(() => window.testCommands.some(Command => Command.action === 'tryAppearance' && Command.hair === 102 && Command.color === 202))
    assert.equal(await page.evaluate(() => Appearance.hair), 101)
    await page.locator('#cancelAppearance').click()
    await page.waitForFunction(() => !AppearanceBusy && document.querySelector('#hairStyle').value === '101')
    await page.locator('#openHairPicker').click()
    await page.locator('#hairSearch').fill('ExampleHair.esp')
    await page.locator('#hairGrid .hair-card').click()
    await page.locator('.hair-swatch[aria-label="Чёрный"]').click()
    await page.locator('#applyAppearance').click()
    await page.waitForFunction(() => Appearance?.hair === 102 && Appearance?.color === 202 && !AppearanceBusy)
    assert.ok(await page.evaluate(() => window.testCommands.find(Command => Command.action === 'applyAppearance').identity))
    await page.evaluate(() => {
      window.testAppearanceTarget = { reference: 0xA2C94 }
      window.testEvents.__uimode('0')
      window.testEvents.__uimode('1')
    })
    await page.waitForFunction(() => CurrentTab === 'appearance' && Appearance?.name === 'Лидия' && !AppearanceBusy)
    await page.locator('#openHairPicker').click()
    await page.locator('#hairSearch').fill('ExampleHair.esp')
    await page.locator('#hairGrid .hair-card').click()
    await page.locator('#applyAppearance').click()
    await page.waitForFunction(() => Appearance?.hair === 102 && !AppearanceBusy)
    const ExternalCommand = await page.evaluate(() => window.testCommands.filter(Command => Command.action === 'applyAppearance').at(-1))
    assert.equal(ExternalCommand.reference, 0xA2C94)
    assert.equal(ExternalCommand.id, undefined)
    await page.evaluate(() => {
      window.testAppearanceTarget = null
      window.testEvents.__uimode('0')
      window.testEvents.__uimode('1')
    })
    await page.waitForFunction(() => CurrentTab === 'create' && !AppearanceTarget)
    await Tab('roster')
    await page.locator('#list .npc').first().click()
    await page.locator('#park').click()
    await page.waitForFunction(() => document.querySelector('#status').textContent === 'Убран из мира')
    await page.locator('#summon').click()
    await page.waitForFunction(() => document.querySelector('#actorWarning').textContent.includes('восстановлено'))
    await Tab('presets')
    await page.locator('#categoryName').fill('Мой отряд')
    await page.locator('#addCategory').click()
    await page.waitForFunction(() => document.querySelector('#saveCategory').textContent.includes('Мой отряд'))
    assert.equal(await page.locator('[data-library-delete="deletePreset"]').isDisabled(), true)
    await page.getByRole('button', { name: 'Создать копию', exact: true }).click()
    await Combo('saveCategory', 'Мой отряд')
    await page.locator('#presetName').fill('Мой комплект')
    await page.locator('#savePreset').click()
    await page.waitForFunction(() => document.querySelector('#equipmentPreset').textContent.includes('Мой комплект'))
    await Combo('presetCategory', 'Мой отряд')
    await Combo('equipmentPreset', 'Мой комплект')
    assert.equal(await page.locator('.preset-card').count(), 1)
    assert.equal(await page.locator('[data-library-delete="deletePreset"]').isEnabled(), true)
    assert.equal(await page.locator('[data-library-delete="deleteCategory"]').isDisabled(), true)
    assert.equal(await page.locator('.preset-item-row input[type="number"]').count(), 6)
    await page.locator('#presetItemSearch').fill('стражника')
    await page.locator('#presetItemSearch + button').click()
    await page.getByRole('button', { name: 'Добавить', exact: true }).click()
    await page.locator('.preset-item-row input[type="number"]').last().fill('3')
    await page.locator('.preset-item-row input[type="number"]').last().dispatchEvent('change')
    await page.locator('#savePreset').click()
    await page.waitForFunction(() => window.testCommands.filter(C => C.action === 'editPreset').length === 2)
    assert.equal(await page.evaluate(() => window.testCommands.filter(C => C.action === 'editPreset').at(-1).items.at(-1).count), 3)
    await page.locator('.preset-item-row').filter({ has: page.locator('input[type="number"]') }).last().getByRole('button', { name: 'Удалить', exact: true }).click()
    assert.equal(await page.locator('.preset-item-row input[type="number"]').count(), 6)
    await page.screenshot({ path: path.join(root, 'NPCStudio-NativePlugin/docs/ui-072-library.png') })
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
    await page.getByRole('button', { name: 'Retake portrait', exact: true }).click()
    assert.equal(await page.locator('.portrait-editor h3').textContent(), 'Portrait')
    assert.equal(await page.locator('.portrait-save').textContent(), 'Save')
    assert.equal(await page.locator('.portrait-cancel').textContent(), 'Cancel')
    await page.locator('.portrait-cancel').click()
    await Tab('settings')
    await page.screenshot({ path: path.join(root, 'NPCStudio-NativePlugin/docs/ui-072-settings-en.png') })
    await Combo('language', 'Русский')
    await page.locator('#saveSettings').click()
    await page.waitForFunction(() => document.documentElement.lang === 'ru')
    await Tab('roster')
    await Tab('equipment')
    await page.waitForFunction(() => !EquipmentBusy)
    assert.equal(await page.locator('#equipmentKind option[value="all"]').textContent(), 'Все')
    assert.equal(await page.locator('#equipmentCategory option').count(), 10)
    assert.ok(await page.locator('#equipmentInventory .item-type-icon').count())
    await page.locator('.equipment-tabs button').nth(1).click()
    await Combo('equipmentCategory', 'Щиты')
    await page.locator('#equipmentSearchForm').dispatchEvent('submit')
    await page.waitForFunction(() => !EquipmentBusy)
    assert.equal(await page.evaluate(() => window.testCommands.filter(Command => Command.action === 'equipment').at(-1).category), 'shield')
    await Tab('roster')
    const oldIdentity = await page.evaluate(() => State.slots[0].identity)
    await page.locator('#deleteNpc').click()
    await page.locator('#cancelDelete').click()
    assert.equal(await page.locator('.npc').count(), 1)
    await page.locator('#deleteNpc').click()
    await page.locator('#confirmDelete').click()
    await page.waitForFunction(() => document.querySelector('#femaleCount').textContent === '0 / 200')
    await Tab('create')
    assert.equal(await page.locator('#slotSelect option[value="0"]').textContent(), '◐ Слот 1 · использовался')
    await page.locator('#newName').fill('Новая Элара')
    await page.locator('#createButton').click()
    await page.waitForFunction(() => document.querySelector('#selectedName').textContent === 'Новая Элара')
    assert.equal(await page.evaluate(() => State.slots[0].id), 1, 'Авто-выбор переиспользовал удалённый слот')
    await Tab('create')
    await Combo('slotSelect', '◐ Слот 1 · использовался')
    await page.locator('#newName').fill('Повторный слот')
    await page.locator('#createButton').click()
    await page.waitForFunction(() => document.querySelector('#selectedName').textContent === 'Повторный слот')
    const staleRejected = await page.evaluate(async oldIdentity => { try { await Send('rename', { id: 0, identity: oldIdentity, name: 'Старая команда' }); return false } catch { return true } }, oldIdentity)
    assert.equal(staleRejected, true)
    await Tab('create')
    await Combo('sex', 'Мужской')
    await page.locator('#slotSelect').locator('..').getByRole('combobox').click()
    await page.locator('.combo-popup input').fill('Слот 200')
    await page.locator('.combo-popup').getByRole('option', { name: '● Слот 200 · новый', exact: true }).click()
    await page.locator('#newName').fill('Последний слот')
    await page.locator('#createButton').click()
    await page.waitForFunction(() => document.querySelector('#selectedName').textContent === 'Последний слот')
    assert.equal(await page.evaluate(() => State.slots.find(slot => slot.name === 'Последний слот').id), 399)
    await page.locator('#search').fill('последний')
    assert.equal(await page.locator('.npc').count(), 1)
    await page.locator('#search').fill('')
    for (const tab of ['create', 'roster', 'equipment', 'presets', 'appearance', 'settings']) {
      await Tab(tab)
      for (const viewport of [{ width: 1920, height: 1080 }, { width: 1280, height: 720 }]) {
        await page.setViewportSize(viewport)
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, tab + ': переполнение окна')
        assert.equal(await page.evaluate(() => document.querySelector('.workspace').scrollWidth > document.querySelector('.workspace').clientWidth), false, tab + ': переполнение панели')
      }
    }
    await page.setViewportSize({ width: 1920, height: 1080 })
    await Tab('create')
    await page.screenshot({ path: path.join(root, 'NPCStudio-NativePlugin/docs/ui-072-create.png') })
    await Tab('roster')
    await page.waitForFunction(() => !document.querySelector('#previewImage').hidden)
    await page.screenshot({ path: path.join(root, 'NPCStudio-NativePlugin/docs/ui-072-roster.png') })
    await page.evaluate(() => window.testEvents.__uimode('0'))
    const closedCount = await page.evaluate(() => window.testCommands.length)
    const ClosedImage = await page.locator('#previewImage').getAttribute('src')
    await page.evaluate(() => window.studioPreview({ kind: 'actor', identity: State.slots.find(slot => slot.id === SelectedId).identity, image: 'late-closed-frame' }))
    assert.equal(await page.locator('#previewImage').getAttribute('src'), ClosedImage, 'closed UI accepted a late frame')
    await page.waitForTimeout(650)
    assert.equal(await page.evaluate(() => window.testCommands.length), closedCount, 'Закрытый UI продолжает отправлять команды')
    await page.evaluate(() => window.testEvents.__uimode('1'))
    await page.waitForFunction(() => !document.querySelector('#previewImage').hidden)
    await page.waitForTimeout(300)
    const BeforeClose = await page.evaluate(() => window.testCommands.filter(C => C.action === 'close').length)
    await page.keyboard.press('Shift+Digit8')
    assert.equal(await page.evaluate(() => window.testCommands.filter(C => C.action === 'close').length), BeforeClose + 1)
    assert.deepEqual(errors, [])
    console.log('UI 0.8.2: crosshair appearance, hairstyle and palette, inventory actions, outfit editor, hotkey, locale/theme/race/portrait/camera, slots and 6 pages at 720p/1080p passed')
  } finally { await browser.close() }
})().catch(error => { console.error(error); process.exitCode = 1 })
