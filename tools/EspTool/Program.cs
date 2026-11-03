using System.Text.Json;
using Mutagen.Bethesda;
using Mutagen.Bethesda.Plugins;
using Mutagen.Bethesda.Skyrim;
using Noggog;
using System.Drawing;

if (args.Length < 2) throw new ArgumentException("generate <Data проекта> <Skyrim.esm> или validate <Data проекта>");
var mode = args[0];
var dataPath = Path.GetFullPath(args[1]);
var espPath = Path.Combine(dataPath, "NPCStudio.esp");
var manifestPath = Path.Combine(dataPath, "SKSE", "Plugins", "NPCStudio", "slots.json");
var key = ModKey.FromNameAndExtension("NPCStudio.esp");
const SkyrimRelease release = SkyrimRelease.SkyrimSE;
FormKey Own(uint id) => new(key, id);
bool Female(uint id) => id < 200;
uint Number(uint id) => id % 200 + 1;
uint ColorId(uint id) => 0x900 + id;
uint BaseId(uint id) => 0xB00 + id;
uint ActorId(uint id) => 0xD00 + id;
if (mode == "generate") {
    if (args.Length != 3 || !File.Exists(args[2])) throw new ArgumentException("Нужен установленный Skyrim.esm для исходных vanilla-форм");
    using var source = SkyrimMod.CreateFromBinaryOverlay(args[2], release);
    // Копируется только внешность: квесты, фракции, инвентарь и скрипты исходных NPC не переносятся.
    var female = source.Npcs.First(x => x.FormKey.ID == 0xA2C8E);
    var male = source.Npcs.First(x => x.FormKey.ID == 0x13480);
    var mod = new SkyrimMod(key, release);
    mod.ModHeader.Author = "NPCStudio";
    mod.ModHeader.Description = "NPCStudio 0.6.0: fixed pool, 200 female and 200 male persistent actors";
    mod.ModHeader.Flags |= SkyrimModHeader.HeaderFlag.Small;
    var cell = new Cell(Own(0x800), release) {
        EditorID = "NPCStudioHoldingCell", Name = "NPCStudio: резерв",
        Flags = Cell.Flag.IsInteriorCell
    };
    var block = new CellBlock { BlockNumber = 8, GroupType = GroupTypeEnum.InteriorCellBlock };
    var sub = new CellSubBlock { BlockNumber = 4, GroupType = GroupTypeEnum.InteriorCellSubBlock };
    sub.Cells.Add(cell);
    block.SubBlocks.Add(sub);
    mod.Cells.Add(block);
    var anchor = new PlacedObject(Own(0x801), release) {
        EditorID = "NPCStudioHoldingAnchor", MajorRecordFlagsRaw = (int)PlacedNpc.MajorFlag.Persistent,
        Placement = new Placement { Position = new P3Float(0, 0, 128), Rotation = new P3Float() }
    };
    anchor.Base.SetTo(new FormKey(source.ModKey, 0x3B));
    cell.Persistent.Add(anchor);
    var slots = new List<object>();
    for (uint id = 0; id < 400; id++) {
        bool isFemale = Female(id);
        var template = isFemale ? female : male;
        var color = new ColorRecord(Own(ColorId(id)), release) {
            EditorID = $"NPCStudioHairColor{id:D3}", Color = Color.FromArgb(0, 70, 50, 35)
        };
        mod.Colors.Add(color);
        var npc = new Npc(Own(BaseId(id)), release) {
            EditorID = $"NPCStudio{(isFemale ? "Female" : "Male")}{Number(id):D2}",
            Name = $"NPCStudio {(isFemale ? "F" : "M")}{Number(id):D2}",
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
        var actor = new PlacedNpc(Own(ActorId(id)), release) {
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
    File.WriteAllText(manifestPath, JsonSerializer.Serialize(new { schemaVersion = 3, plugin = "NPCStudio.esp", slots }, new JsonSerializerOptions { WriteIndented = true }));
}
if (mode != "validate" && mode != "generate") throw new ArgumentException("Неизвестный режим");
using (var check = SkyrimMod.CreateFromBinaryOverlay(espPath, release)) {
    var cells = check.Cells.SelectMany(b => b.SubBlocks).SelectMany(b => b.Cells).ToArray();
    var actors = cells.SelectMany(c => c.Persistent).OfType<IPlacedNpcGetter>().ToArray();
    if (check.Npcs.Count != 400 || actors.Length != 400 || check.Colors.Count != 400 || cells.Length != 1)
        throw new InvalidDataException("Пул должен содержать ровно 400 NPC, 400 ACHR, 400 CLFM и одну CELL");
    var anchor = cells.Single().Persistent.OfType<IPlacedObjectGetter>().Single(a => a.FormKey == Own(0x801));
    if (anchor.Base.FormKey != new FormKey(ModKey.FromNameAndExtension("Skyrim.esm"), 0x3B) ||
        (anchor.MajorRecordFlagsRaw & (int)PlacedNpc.MajorFlag.Persistent) == 0) throw new InvalidDataException("Неверный резервный маркер");
    using var manifest = JsonDocument.Parse(File.ReadAllText(manifestPath));
    if (manifest.RootElement.GetProperty("schemaVersion").GetInt32() != 3 || manifest.RootElement.GetProperty("plugin").GetString() != "NPCStudio.esp")
        throw new InvalidDataException("Неизвестная схема манифеста");
    var slots = manifest.RootElement.GetProperty("slots").EnumerateArray().ToArray();
    if (slots.Length != 400 || !check.ModHeader.Flags.HasFlag(SkyrimModHeader.HeaderFlag.Small)) throw new InvalidDataException("Повреждён пул");
    for (uint id = 0; id < 400; id++) {
        var slot = slots[id];
        var npc = check.Npcs.First(n => n.FormKey == Own(BaseId(id)));
        var actor = actors.Single(a => a.FormKey == Own(ActorId(id)));
        if (slot.GetProperty("id").GetUInt32() != id || slot.GetProperty("female").GetBoolean() != Female(id) ||
            slot.GetProperty("base").GetUInt32() != npc.FormKey.ID || slot.GetProperty("reference").GetUInt32() != actor.FormKey.ID ||
            slot.GetProperty("color").GetUInt32() != ColorId(id) || npc.HairColor.FormKey != Own(ColorId(id)) || actor.Base.FormKey != npc.FormKey ||
            !actor.MajorFlags.HasFlag(PlacedNpc.MajorFlag.Persistent | PlacedNpc.MajorFlag.InitiallyDisabled) ||
            npc.Configuration.Flags.HasFlag(NpcConfiguration.Flag.Female) != Female(id) ||
            !npc.Configuration.Flags.HasFlag(NpcConfiguration.Flag.Unique) || npc.Configuration.Flags.HasFlag(NpcConfiguration.Flag.Respawn) ||
            npc.HeadParts.Count == 0 || npc.Race.IsNull || npc.Voice.IsNull || npc.Class.IsNull)
            throw new InvalidDataException($"Некорректный слот {id}");
    }
    if (check.ModHeader.MasterReferences.Count != 1 || check.ModHeader.MasterReferences[0].Master.FileName.String != "Skyrim.esm")
        throw new InvalidDataException("Неожиданные зависимости ESP");
    Console.WriteLine("ESP проверен Mutagen: 200 женских + 200 мужских NPC, 400 persistent ACHR, 400 цветов, резервный маркер; связи слотов согласованы");
}
