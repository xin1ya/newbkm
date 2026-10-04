import sys
REF_KEYS = [tuple(x) for x in __import__('json').loads(open(D('art-source', 'tools', 'rc_keys.json')).read())]
exec(open(D('art-source', 'tools', 'refcmp.py'), encoding='utf-8').read())
