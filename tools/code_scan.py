"""Read declaration positions in code without counting comments or literal text."""

import re

def mask_non_code(source: str) -> str:
    out = list(source)
    i = 0
    while i < len(source):
        pair = source[i:i + 2]
        if pair in ('//', '/*'):
            end = source.find('\n', i + 2) if pair == '//' else source.find('*/', i + 2)
            end = len(source) if end < 0 else end if pair == '//' else end + 2
            for j in range(i, end):
                if source[j] != '\n': out[j] = ' '
            i = end
            continue
        if source[i] in ('"', "'", '`'):
            quote = source[i]
            j = i + 1
            while j < len(source):
                if source[j] == '\\':
                    j += 2
                    continue
                if source[j] == quote:
                    j += 1
                    break
                j += 1
            for k in range(i, min(j, len(source))):
                if source[k] != '\n': out[k] = ' '
            i = j
            continue
        i += 1
    return ''.join(out)


def declared_names(source: str, language: str = 'ts') -> set[str]:
    code = mask_non_code(source)
    if language == 'py':
        return set(re.findall(r'(?m)^\s*(?:async\s+)?(?:def|class)\s+([A-Za-z_]\w*)\b', code)) | set(
            re.findall(r'(?m)^\s*([A-Za-z_]\w*)\s*(?::[^=\n]+)?=', code))
    names = set(re.findall(
        r'\b(?:const|let|var|function|class|interface|type|enum|namespace)\s+([A-Za-z_]\w*)\b', code))
    names.update(re.findall(r'(?m)^\s*(?:export\s+)?(?:async\s+)?([A-Za-z_]\w*)\s*\(', code))
    names.update(re.findall(r'(?m)^\s*([A-Za-z_]\w*)\s*[:=](?!=)', code))
    return names


if __name__ == '__main__':
    import json, pathlib, sys
    names = set()
    for path in json.load(sys.stdin):
        try:
            names.update(declared_names(pathlib.Path(path).read_text(),
                                        'py' if path.endswith('.py') else 'ts'))
        except FileNotFoundError:
            pass
    json.dump(sorted(names), sys.stdout)
