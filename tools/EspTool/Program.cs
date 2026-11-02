using System.Text.Json;
using Mutagen.Bethesda;
using Mutagen.Bethesda.Plugins;
using Mutagen.Bethesda.Skyrim;
using Noggog;
using System.Drawing;

if (args.Length < 2) throw new ArgumentException("generate <Data РїСЂРѕРµРєС‚Р°> <Skyrim.esm> РёР»Рё validate <Data РїСЂРѕРµРєС‚Р°>");
var mode = args[0];
var dataPath = Path.GetFullPath(args[1]);
var espPath = Path.Combine(dataPath, "NPCStudio.esp");
var manifestPath = Path.Combine(dataPath, "SKSE", "Plugins", "NPCStudio", "slots.json");
var key = ModKey.FromNameAndExtension("NPCStudio.esp");
const SkyrimRelease release = SkyrimRelease.SkyrimSE;
FormKey Own(uint id) => new(key, id);
if (mode == "generate") {
    if (args.Length != 3 || !File.Exists(args[2])) throw new ArgumentException("РќСѓР¶РµРЅ СѓСЃС‚Р°РЅРѕРІР»РµРЅРЅС‹Р№ Skyrim.esm РґР»СЏ РёСЃС…РѕРґРЅС‹С… vanilla-С„РѕСЂРј");
    using var source = SkyrimMod.CreateFromBinaryOverlay(args[2], release);
    // РљРѕРїРёСЂСѓРµС‚СЃСЏ С‚РѕР»СЊРєРѕ РІРЅРµС€РЅРѕСЃС‚СЊ vanilla. РљРІРµСЃС‚С‹, РёРЅРІРµРЅС‚Р°СЂСЊ, С„СЂР°РєС†РёРё Рё СЃРєСЂРёРїС‚С‹ РёСЃС…РѕРґРЅС‹С… NPC РЅРµ РїРµСЂРµРЅРѕСЃСЏС‚СЃСЏ.
    var female = source.Npcs.First(x => x.FormKey.ID == 0xA2C8E);
    var male = source.Npcs.First(x => x.FormKey.ID == 0x13480);
    var mod = new SkyrimMod(key, release);
    mod.ModHeader.Author = "NPCStudio";
    mod.ModHeader.Description = "NPCStudio 0.2: fixed pool, 80 female and 80 male persistent actors";
    mod.ModHeader.Flags |= SkyrimModHeader.HeaderFlag.Small;
    var cell = new Cell(Own(0x800), release) {
        EditorID = "NPCStudioHoldingCell", Name = "NPCStudio: СЂРµР·РµСЂРІ",
        Flags = Cell.Flag.IsInteriorCell
    };
    var block = new CellBlock { BlockNumber = 8, GroupType = GroupTypeEnum.InteriorCellBlock };
    var sub = new CellSubBlock { BlockNumber = 4, GroupType = GroupTypeEnum.InteriorCellSubBlock };
    sub.Cells.Add(cell);
    block.SubBlocks.Add(sub);
    mod.Cells.Add(block);
    var slots = new List<object>();
    for (uint id = 0; id < 160; id++) {
        bool isFemale = id < 80;
        var template = isFemale ? female : male;
        var color = new ColorRecord(Own(0x900 + id), release) {
            EditorID = $"NPCStudioHairColor{id:D3}", Color = Color.FromArgb(0, 70, 50, 35)
        };
        mod.Colors.Add(color);
        var npc = new Npc(Own(0xA00 + id), release) {
            EditorID = $"NPCStudio{(isFemale ? "Female" : "Male")}{id % 80 + 1:D2}",
            Name = $"NPCStudio {(isFemale ? "F" : "M")}{id % 80 + 1:D2}",
            Height = 1, Weight = 50,
            Configuration = new NpcConfiguration {
                Flags = NpcConfiguration.Flag.Unique | NpcConfiguration.Flag.AutoCalcStats |
                    (isFemale ? NpcConfiguration.Flag.Female : 0),
                Level = new NpcLevel { Level = 10 }, SpeedMultiplier = 100,
                CalcMinLevel = 1, CalcMaxLevel = 100, HealthOffset = 50, StaminaOffset = 50, MagickaOffset = 50
            },
            PlayerSkills = new PlayerSkills { Health = 100, Stamina = 100, Magicka = 100 },
            AIData = new AIData { Aggression = Aggression.Unaggressive, Confidence = Confidence.Average,
                EnergyLevel = 50, Responsibility = Responsibility.NoCrime, Assistance = Assistance.HelpsNobody },
            FaceParts = template.FaceParts?.DeepCopy(), FaceMorph = template.FaceMorph?.DeepCopy(),
            TextureLighting = template.TextureLighting
        };
        npc.Race.SetTo(template.Race.FormKey);
        npc.Voice.SetTo(template.Voice.FormKey);
        npc.Class.SetTo(template.Class.FormKey);
        npc.HeadTexture.SetTo(template.HeadTexture.FormKey);
        npc.HairColor.SetTo(color.FormKey);
        foreach (var part in template.HeadParts) npc.HeadParts.Add(part.FormKey);
        foreach (var tint in template.TintLayers) npc.TintLayers.Add(tint.DeepCopy());
        mod.Npcs.Add(npc);
        var actor = new PlacedNpc(Own(0xB00 + id), release) {
            EditorID = $"NPCStudioActor{id:D3}",
            MajorFlags = PlacedNpc.MajorFlag.Persistent | PlacedNpc.MajorFlag.InitiallyDisabled,
            Placement = new Placement { Position = new P3Float(0, 0, 128), Rotation = new P3Float() }
        };
        actor.Base.SetTo(npc.FormKey);
        cell.Persistent.Add(actor);
        slots.Add(new { id, female = isFemale, @base = npc.FormKey.ID, reference = actor.FormKey.ID, color = color.FormKey.ID });
    }
    Directory.CreateDirectory(Path.GetDirectoryName(manifestPath)!);
    var tempDir = Path.Combine(Path.GetTempPath(), "NPCStudio-" + Guid.NewGuid().ToString("N"));
    Directory.CreateDirectory(tempDir);
    var temp = Path.Combine(tempDir, "NPCStudio.esp");
    mod.WriteToBinary(temp);
    File.Move(temp, espPath, true);
    Directory.Delete(tempDir);
    File.WriteAllText(manifestPath, JsonSerializer.Serialize(new { schemaVersion = 1, plugin = "NPCStudio.esp", slots }, new JsonSerializerOptions { WriteIndented = true }));
}
if (mode != "validate" && mode != "generate") throw new ArgumentException("РќРµРёР·РІРµСЃС‚РЅС‹Р№ СЂРµР¶РёРј");
using (var check = SkyrimMod.CreateFromBinaryOverlay(espPath, release)) {
    var cells = check.Cells.SelectMany(b => b.SubBlocks).SelectMany(b => b.Cells).ToArray();
    var actors = cells.SelectMany(c => c.Persistent).OfType<IPlacedNpcGetter>().ToArray();
    if (check.Npcs.Count != 160 || actors.Length != 160 || check.Colors.Count != 160 || cells.Length != 1)
        throw new InvalidDataException("РџСѓР» РґРѕР»Р¶РµРЅ СЃРѕРґРµСЂР¶Р°С‚СЊ СЂРѕРІРЅРѕ 160 NPC, 160 ACHR, 160 CLFM Рё РѕРґРЅСѓ CELL");
    using var manifest = JsonDocument.Parse(File.ReadAllText(manifestPath));
    if (manifest.RootElement.GetProperty("schemaVersion").GetInt32() != 1 || manifest.RootElement.GetProperty("plugin").GetString() != "NPCStudio.esp")
        throw new InvalidDataException("РќРµРёР·РІРµСЃС‚РЅР°СЏ СЃС…РµРјР° РјР°РЅРёС„РµСЃС‚Р°");
    var slots = manifest.RootElement.GetProperty("slots").EnumerateArray().ToArray();
    if (slots.Length != 160 || !check.ModHeader.Flags.HasFlag(SkyrimModHeader.HeaderFlag.Small)) throw new InvalidDataException("РџРѕРІСЂРµР¶РґС‘РЅ РїСѓР»");
    for (uint id = 0; id < 160; id++) {
        var slot = slots[id];
        var npc = check.Npcs.First(n => n.FormKey == Own(0xA00 + id));
        var actor = actors.Single(a => a.FormKey == Own(0xB00 + id));
        if (slot.GetProperty("id").GetUInt32() != id || slot.GetProperty("female").GetBoolean() != (id < 80) ||
            slot.GetProperty("base").GetUInt32() != npc.FormKey.ID || slot.GetProperty("reference").GetUInt32() != actor.FormKey.ID ||
            slot.GetProperty("color").GetUInt32() != 0x900 + id || npc.HairColor.FormKey != Own(0x900 + id) || actor.Base.FormKey != npc.FormKey ||
            !actor.MajorFlags.HasFlag(PlacedNpc.MajorFlag.Persistent | PlacedNpc.MajorFlag.InitiallyDisabled) ||
            npc.Configuration.Flags.HasFlag(NpcConfiguration.Flag.Female) != (id < 80) ||
            !npc.Configuration.Flags.HasFlag(NpcConfiguration.Flag.Unique) || npc.Configuration.Flags.HasFlag(NpcConfiguration.Flag.Respawn) ||
            npc.HeadParts.Count == 0 || npc.Race.IsNull || npc.Voice.IsNull || npc.Class.IsNull)
            throw new InvalidDataException($"РќРµРєРѕСЂСЂРµРєС‚РЅС‹Р№ СЃР»РѕС‚ {id}");
    }
    if (check.ModHeader.MasterReferences.Count != 1 || check.ModHeader.MasterReferences[0].Master.FileName.String != "Skyrim.esm")
        throw new InvalidDataException("РќРµРѕР¶РёРґР°РЅРЅС‹Рµ Р·Р°РІРёСЃРёРјРѕСЃС‚Рё ESP");
    Console.WriteLine("ESP РїСЂРѕРІРµСЂРµРЅ Mutagen: 80 Р¶РµРЅСЃРєРёС… + 80 РјСѓР¶СЃРєРёС… СѓРЅРёРєР°Р»СЊРЅС‹С… NPC, 160 persistent ACHR, 160 РѕС‚РґРµР»СЊРЅС‹С… С†РІРµС‚РѕРІ, РІСЃРµ СЃРІСЏР·Рё РїСѓР»Р° СЃРѕРіР»Р°СЃРѕРІР°РЅС‹");
}
