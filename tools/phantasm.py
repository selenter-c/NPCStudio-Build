"""Проверка исследованного Phantasm и личная локальная упаковка из архива пользователя."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import struct
import zipfile

EXPECTED_HASH = '8b9bf8341dee500c033c8777d3b616d968295676c91bbaf2946d7ae611bd7cff'
ROOT = Path(__file__).resolve().parents[2]

def inspect(source):
    dll = source / 'SKSE/Plugins/Phantasm.dll'
    data = dll.read_bytes()
    digest = hashlib.sha256(data).hexdigest()
    if digest != EXPECTED_HASH:
        raise ValueError('Unsupported Phantasm binary: ' + digest)
    pe = struct.unpack_from('<I', data, 0x3c)[0]
    signature, machine, count, stamp = struct.unpack_from('<IHHI', data, pe)
    if signature != 0x4550 or machine != 0x8664 or stamp != 0x6ae6826f:
        raise ValueError('Unexpected PE header')
    optional = pe + 24
    size_optional = struct.unpack_from('<H', data, pe + 20)[0]
    imagebase = struct.unpack_from('<Q', data, optional + 24)[0]
    sections = []
    for i in range(count):
        entry = optional + size_optional + i * 40
        length, rva, raw_length, raw = struct.unpack_from('<IIII', data, entry + 8)
        sections.append((rva, max(length, raw_length), raw))
    def offset(rva):
        for start, length, raw in sections:
            if start <= rva < start + length:
                return raw + rva - start
        raise ValueError('RVA outside sections')
    header = struct.unpack_from('<4I', data, offset(0x1fdb40))
    if header != (0x90, 1, 300, 0):
        raise ValueError('Unexpected provider API header')
    table = [value - imagebase for value in struct.unpack_from('<16Q', data, offset(0x1fdb50))]
    native = (ROOT / 'NPCStudio-NativePlugin/src/preview/PhantasmAPI.h').read_text(encoding='utf-8')
    values = native.split('FunctionRvas[] = {', 1)[1].split('}', 1)[0]
    expected = [int(value, 16) for value in re.findall(r'0x[0-9a-f]+', values)]
    if table != expected:
        raise ValueError('Native adapter table does not match binary')
    if not (source / 'Interface/phantasm.swf').is_file():
        raise ValueError('Missing renderer carrier SWF')
    return {'provider': 'Phantasm 0.3.0 ccf916f72d59', 'sha256': digest, 'apiVersion': 1,
            'apiSize': header[0], 'functionRvas': [hex(value) for value in table], 'runtimeVerified': False}

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--source', type=Path, default=ROOT / 'SeverAction/97 Phantasm/00 Core')
    parser.add_argument('--pack', action='store_true')
    args = parser.parse_args()
    source = args.source.resolve()
    report = inspect(source)
    if args.pack:
        output = ROOT / 'NPCStudio-Build/dist/NPCStudio-Phantasm-0.3.0-local.zip'
        output.parent.mkdir(exist_ok=True)
        with zipfile.ZipFile(output, 'w', zipfile.ZIP_DEFLATED) as archive:
            for path in sorted(source.rglob('*')):
                if path.is_file():
                    archive.write(path, path.relative_to(source).as_posix())
            archive.writestr('NPCStudio-Phantasm-local.json', json.dumps(report, indent=2))
        report['archive'] = str(output)
    print(json.dumps(report, indent=2))

if __name__ == '__main__':
    main()
