"""Упаковка только проверенного комплекта. Legacy-файлы не включаются."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import tempfile
import xml.etree.ElementTree as Xml
import zipfile

parser = argparse.ArgumentParser()
parser.add_argument('--root', type=Path, required=True)
parser.add_argument('--dll', type=Path, required=True)
parser.add_argument('--source-hash', required=True)
parser.add_argument('--version', default='')
args = parser.parse_args()
root = args.root.resolve()
game = root / 'NPCStudio-GamePlugin'
data = game / 'Data'
version = args.version or Xml.parse(game / 'fomod/info.xml').findtext('Version')
if not version or not all(part.isdecimal() for part in version.split('.')) or len(version.split('.')) != 3:
    raise ValueError('Invalid package version')
stamp_path = args.dll.with_name('NPCStudio.build.json')
stamp = json.loads(stamp_path.read_text(encoding='utf-8-sig'))
if stamp['version'] != version or stamp['sourceHash'] != args.source_hash:
    raise ValueError('DLL build stamp does not match current source/version')
if hashlib.sha256(args.dll.read_bytes()).hexdigest().upper() != stamp['dllHash']:
    raise ValueError('DLL has changed since build')
files = {}
for folder in ['Magelight', 'SKSE']:
    for path in (data / folder).rglob('*'):
        if path.is_file() and path.name not in ['meta.ini', 'Thumbs.db', 'desktop.ini']:
            files[path.relative_to(data).as_posix()] = path
preset_dir = data / 'SKSE/Plugins/NPCStudio/Equipment'
expected_presets = {'guard-' + name for name in ['whiterun', 'solitude', 'markarth', 'riften', 'winterhold', 'dawnstar', 'morthal', 'falkreath', 'windhelm']}
expected_presets.update(['bandit-melee', 'bandit-archer', 'citizen-farm', 'citizen-fine', 'blacksmith', 'miner', 'mage'])
if not expected_presets.issubset({p.stem for p in preset_dir.glob('*.json')}) or len(list(preset_dir.glob('*.json'))) < 40:
    raise ValueError('Built-in equipment preset files changed or missing')
for path in preset_dir.glob('*.json'):
    preset = json.loads(path.read_text(encoding='utf-8'))
    if not preset.get('category') or preset.get('schemaVersion') != 1 or not preset.get('name') or not 1 <= len(preset.get('items', [])) <= 64:
        raise ValueError('Invalid equipment preset: ' + str(path))
    seen = set()
    for item in preset['items']:
        address = (item['plugin'], item['form'])
        if address in seen or item['plugin'] != 'Skyrim.esm' or not 0 < item['form'] <= 0xFFFFFF or not 1 <= item['count'] <= 1000:
            raise ValueError('Invalid equipment item: ' + str(path))
        seen.add(address)
# Локальная сборка из предоставленного пользователем Phantasm, с проверкой точной версии.
from phantasm import inspect
provider = root / 'SeverAction/97 Phantasm/00 Core'
inspect(provider)
for path in provider.rglob('*'):
    if path.is_file():
        name = path.relative_to(provider).as_posix()
        if name in files: raise ValueError('Provider payload collision: ' + name)
        files[name] = path
files['NPCStudio.esp'] = data / 'NPCStudio.esp'
files['NPCStudio_NND_DISTR.ini'] = data / 'NPCStudio_NND_DISTR.ini'
for path in (game / 'fomod').rglob('*'):
    if path.is_file(): files[path.relative_to(game).as_posix()] = path
files['SKSE/Plugins/NPCStudio.dll'] = args.dll
files['SKSE/Plugins/NPCStudio.build.json'] = stamp_path
required = ['NPCStudio.esp', 'NPCStudio_NND_DISTR.ini', 'SKSE/Plugins/NPCStudio.dll', 'SKSE/Plugins/NPCStudio/slots.json',
    'Magelight/NPCStudio/views/studio/index.html', 'Magelight/NPCStudio/views/studio/script.js',
    'Magelight/NPCStudio/views/studio/style.css', 'Magelight/NPCStudio/views/studio/i18n.js', 'fomod/info.xml', 'fomod/ModuleConfig.xml']
for name in required:
    if name not in files or not files[name].is_file(): raise ValueError('Missing payload: ' + name)
for item in Xml.parse(game / 'fomod/ModuleConfig.xml').find('requiredInstallFiles'):
    source = item.attrib['source']
    if item.tag == 'file' and source not in files: raise ValueError('FOMOD file missing: ' + source)
    if item.tag == 'folder' and not any(n.startswith(source + '/') for n in files): raise ValueError('FOMOD folder missing: ' + source)
for name in files:
    if name.startswith(('PrismaUI/', 'Scripts/')) or '\\' in name or name.lower().endswith('.psc'):
        raise ValueError('Legacy payload: ' + name)
dist = root / 'NPCStudio-Build/dist'
dist.mkdir(exist_ok=True)
output = dist / f'NPCStudio-{version}-fomod.zip'
with tempfile.NamedTemporaryFile(dir=dist, suffix='.zip', delete=False) as temporary:
    temp = Path(temporary.name)
try:
    with zipfile.ZipFile(temp, 'w', compression=zipfile.ZIP_DEFLATED) as archive:
        for name, path in sorted(files.items()): archive.write(path, name)
    with zipfile.ZipFile(temp) as archive:
        if archive.testzip(): raise ValueError('Corrupt ZIP')
        for name in required:
            if name not in archive.namelist(): raise ValueError('Missing archive entry: ' + name)
    os.replace(temp, output)
finally:
    if temp.exists(): temp.unlink()
print(f'Validated package: {output} ({len(files)} files)')
