#!/usr/bin/env python3
"""Run Blender step scripts through the blender-mcp socket (skill: .yfcode/skills/blender-mcp).
Usage:
  python art-source/tools/bx.py run <step.py> [<step.py> ...] [--shot out.png]
  python art-source/tools/bx.py model <key> [<key> ...]
  python art-source/tools/bx.py oss <key> [<key> ...]     (open-source base model conversion, ADR 0010)
  python art-source/tools/bx.py code "<python>"
  python art-source/tools/bx.py telemetry-off
Every step is prefixed with art-source/tools/common.py (shared helpers), because each execute_code call is a fresh namespace.
"""
import os, sys, json
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(ROOT, '.yfcode', 'skills', 'blender-mcp', 'scripts'))
from blender_sock import BlenderClient, BlenderError, parse_error_message  # noqa: E402
try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass

def common():
    with open(os.path.join(ROOT, 'art-source', 'tools', 'common.py'), encoding='utf-8') as f:
        src = f.read()
    with open(os.path.join(ROOT, 'art-source', 'tools', 'kit.py'), encoding='utf-8') as f:
        src += '\n' + f.read()
    return src.replace('__PROJECT_ROOT__', ROOT.replace('\\', '/'))

def main():
    c = BlenderClient(timeout=180)
    cmd = sys.argv[1]
    if cmd == 'telemetry-off':
        print(json.dumps(c.send('set_telemetry_consent', {'consent': False})))
        try:
            print(json.dumps(c.send('get_telemetry_consent')))
        except BlenderError as e:
            print('get:', parse_error_message(e))
        return 0
    if cmd == 'code':
        print(c.execute(common() + '\n' + sys.argv[2]))
        return 0
    if cmd == 'model':   # bx.py model <key> [...]: one-script models (art-source/pokemon/<key>/model.py)
        for key in sys.argv[2:]:
            path = os.path.join(ROOT, 'art-source', 'pokemon', key, 'model.py')
            with open(path, encoding='utf-8') as f:
                code = common() + '\n' + f.read()
            try:
                out = c.execute(code)
                print(f'[ok] {key}'); print((out or '').strip())
            except BlenderError as e:
                print(f'[FAIL] {key}: {parse_error_message(e)}'); return 1
        return 0
    if cmd == 'char':   # bx.py char <key> [...]: human characters (common + kit + hkit + art-source/characters/<key>/model.py)
        with open(os.path.join(ROOT, 'art-source', 'tools', 'hkit.py'), encoding='utf-8') as f:
            hk = f.read()
        for key in sys.argv[2:]:
            path = os.path.join(ROOT, 'art-source', 'characters', key, 'model.py')
            with open(path, encoding='utf-8') as f:
                code = common() + '\n' + hk + '\n' + f.read()
            try:
                out = c.execute(code)
                print(f'[ok] {key}'); print((out or '').strip())
            except BlenderError as e:
                print(f'[FAIL] {key}: {parse_error_message(e)}'); return 1
        return 0
    if cmd == 'oss':   # bx.py oss <key> [...]: ADR 0010 open-source conversion (common + kit + ossconv, config art-source/pokemon/<key>/oss.json)
        with open(os.path.join(ROOT, 'art-source', 'tools', 'ossconv.py'), encoding='utf-8') as f:
            oc = f.read()
        for key in sys.argv[2:]:
            try:
                out = c.execute(common() + '\n' + oc + f'\noss_build({key!r})')
                print(f'[ok] {key}'); print((out or '').strip()[-1500:])
            except BlenderError as e:
                print(f'[FAIL] {key}: {parse_error_message(e)}'); return 1
        return 0
    if cmd == 'run':
        args = sys.argv[2:]
        shot = None
        if '--shot' in args:
            i = args.index('--shot'); shot = args[i + 1]; del args[i:i + 2]
        for path in args:
            with open(path, encoding='utf-8') as f:
                code = common() + '\n' + f.read()
            try:
                out = c.execute(code)
                print(f'[ok] {os.path.basename(path)}')
                if out and out.strip(): print(out.strip())
            except BlenderError as e:
                print(f'[FAIL] {os.path.basename(path)}: {parse_error_message(e)}')
                return 1
        if shot:
            try:
                out = c.execute(common() + f'\nrender_views({os.path.abspath(shot)!r})')
                print(out.strip())
            except BlenderError as e:
                print('[shot FAIL]', parse_error_message(e)); return 1
        return 0
    print(__doc__); return 1

if __name__ == '__main__':
    raise SystemExit(main())
