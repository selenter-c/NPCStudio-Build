"""Build the FOMOD with the pinned renderer."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import tempfile
import xml.etree.ElementTree as Xml
import zipfile

parser = argparse.ArgumentParser()
parser.add_argument('--root', type=Path, required=True)
parser.add_argument('--dll', type=Path, required=True)
parser.add_argument('--source-hash', required=True)
parser.add_argument('--version', default='')
parser.add_argument('--public', action='store_true')
args = parser.parse_args()
root = args.root.resolve()
game = root / 'NPCStudio-GamePlugin'
data = game / 'Data'
metadata = Xml.parse(game / 'fomod/info.xml').find('Version')
package_version = metadata.text or ''
version = args.version or metadata.get('MachineVersion', package_version)
if not re.fullmatch(r'\d+\.\d+\.\d+', version) or not re.fullmatch(re.escape(version) + r'(?:-beta(?:\.\d+)?)?', package_version):
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
            files['Core/' + path.relative_to(data).as_posix()] = path
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
# Сохраняем исходные пути, чтобы MO2 предоставлял игре только одну копию рендера.
provider = root / 'research/Phantasm-runtime'
rendererFiles = []
if not args.public:
    rendererHashes = {
        'SKSE/Plugins/Phantasm.dll': '6eb9448ec735a49b79a75549b591fb9edbe73bedf405458c38ab0df1b6aed387',
        'Interface/phantasm.swf': 'e3b3331c52c71ef09e462190ba87c377fce188076b8e19a7247a37493f1fefe4',
    }
    for name, expected in rendererHashes.items():
        path = provider / name
        if not path.is_file() or hashlib.sha256(path.read_bytes()).hexdigest() != expected:
            raise ValueError('Expected standalone Phantasm 1.0.0 file: ' + str(path))
    rendererFiles = [*rendererHashes, 'SKSE/Plugins/Phantasm.ini', 'SKSE/Plugins/Phantasm/VERSION.txt']
    rendererFiles.extend('SKSE/Plugins/Phantasm/Licenses/' + name + '.txt' for name in (
        'Phantasm-MIT', 'CBPCSSE-MIT', 'CommonLibSSE-NG-MIT', 'DirectXMath-MIT', 'DirectXTex-MIT',
        'DirectXTK-MIT', 'fmt-MIT', 'nlohmann-json-MIT', 'openvr-BSD3', 'rapidcsv-BSD3', 'spdlog-MIT', 'xbyak-BSD3',
    ))
for name in rendererFiles:
    entry = 'Core/' + name
    if entry in files:
        raise ValueError('Provider payload collision: ' + entry)
    files[entry] = provider / name
files['Core/NPCStudio.esp'] = data / 'NPCStudio.esp'
files['Optional/NND/NPCStudio_NND_DISTR.ini'] = data / 'NPCStudio_NND_DISTR.ini'
for path in (game / 'fomod').rglob('*'):
    if path.is_file(): files[path.relative_to(game).as_posix()] = path
files['Core/SKSE/Plugins/NPCStudio.dll'] = args.dll
native = root / 'NPCStudio-NativePlugin'
commonlib = args.dll.parent / '_deps/commonlibsse-src'
notices = {
    'NPCStudio-MIT.txt': native / 'LICENSE',
    'CommonLibSSE-NG-GPL.txt': commonlib / 'COPYING.txt',
    'CommonLibSSE-NG-exceptions.txt': commonlib / 'EXCEPTIONS.md',
    'CommonLibSSE-NG-legacy-MIT.txt': commonlib / 'licenses/LICENSE-MIT.txt',
    'hde64.txt': commonlib / 'licenses/LICENSE-hde64.txt',
    'Magelight-SDK.txt': native / 'include/Magelight-LICENSE.txt',
    'NND-SDK.txt': native / 'include/NND-LICENSE.txt',
    'Phantasm-SDK.txt': native / 'include/Phantasm-LICENSE.txt',
}
for dependency in ('fmt', 'spdlog', 'nlohmann-json', 'rapidcsv', 'directxtk', 'directxmath'):
    notices[dependency + '.txt'] = args.dll.parent / 'vcpkg_installed/x64-windows-static/share' / dependency / 'copyright'
for name, path in notices.items():
    if not path.is_file(): raise ValueError('Missing dependency notice: ' + str(path))
    files['Core/SKSE/Plugins/NPCStudio/Licenses/' + name] = path
required = ['Core/NPCStudio.esp', 'Optional/NND/NPCStudio_NND_DISTR.ini', 'Core/SKSE/Plugins/NPCStudio.dll',
    'Core/SKSE/Plugins/NPCStudio/slots.json', 'fomod/info.xml', 'fomod/ModuleConfig.xml']
required += ['Core/Magelight/NPCStudio/views/studio/' + name for name in ('index.html', 'script.js', 'style.css', 'i18n.js', 'appearance.js', 'presets.js')]
required += ['Core/' + name for name in rendererFiles]
for name in required:
    if name not in files or not files[name].is_file(): raise ValueError('Missing payload: ' + name)
config = Xml.parse(game / 'fomod/ModuleConfig.xml')
for item in config.iter():
    if item.tag in ('file', 'image', 'moduleImage'):
        source = item.get('source') or item.get('path')
        if source not in files: raise ValueError('FOMOD file missing: ' + str(source))
    if item.tag == 'folder':
        source = item.attrib['source']
        if not any(n.startswith(source + '/') for n in files): raise ValueError('FOMOD folder missing: ' + source)
for name in files:
    if name.startswith(('Core/PrismaUI/', 'Core/Scripts/')) or '\\' in name or name.lower().endswith('.psc'):
        raise ValueError('Legacy payload: ' + name)
    if name.lower().startswith('core/skse/plugins/magelight'):
        raise ValueError('Unexpected Magelight runtime in payload: ' + name)
    if args.public and name.lower().startswith(('core/interface/', 'core/skse/plugins/phantasm')):
        raise ValueError('Third-party renderer in public payload: ' + name)
dist = root / 'NPCStudio-Build/dist'
dist.mkdir(exist_ok=True)
suffix = 'without-renderer-fomod' if args.public else 'fomod'
output = dist / f'NPCStudio-{package_version}-{suffix}.zip'
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
