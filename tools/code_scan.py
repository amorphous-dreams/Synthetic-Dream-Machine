"""Read declaration positions in code without counting comments or literal text.

A witness that derives a reading from source matches CODE, never prose: a union quoted in a comment or a dispatch
key named inside a string reads like the real thing to a raw regex, and the witness then measures the commentary.
`mask_non_code` blanks every comment and string literal to spaces (newlines kept), so a match against the masked
text lands only at a code position, and its offsets still index the original source.
"""

import re

REGEX_KEYWORDS = {'return', 'typeof', 'case', 'in', 'of', 'delete', 'void', 'throw', 'new', 'else', 'do', 'yield',
                  'await', 'instanceof'}


def mask_non_code(source: str) -> str:
    """Blank comments and string literals (JS/TS lexis), keeping newlines and every offset.

    A template literal's `${...}` interpolation stays code, nested templates and all, so a template that holds
    another template never desyncs the scan. A quoted string stops at its line's end, as JS requires, so an
    unbalanced quote blanks one line rather than the rest of the module."""
    out = list(source)
    n = len(source)
    stack: list[int] = []   # open `${` interpolations, each holding its own brace depth

    def blank(a: int, b: int) -> None:
        for k in range(a, b):
            if source[k] != '\n':
                out[k] = ' '

    def template(j: int) -> int:
        """Blank literal text from j up to the closing backtick (past it) or an opening `${` (past it)."""
        start = j
        j += 1
        while j < n:
            if source[j] == '\\':
                j += 2
                continue
            if source[j] == '`':
                blank(start, j + 1)
                return j + 1
            if source[j:j + 2] == '${':
                blank(start, j)
                stack.append(0)
                return j + 2
            j += 1
        blank(start, n)
        return n

    def regex_may_start(j: int) -> bool:
        """A `/` opens a regex literal where an operand may start: after an operator, an opening bracket, a
        statement end, or a keyword that takes an operand; after an identifier, a number or `)` it divides."""
        k = j - 1
        while k >= 0 and out[k] in ' \t\n\r':
            k -= 1
        if k < 0 or out[k] in '([{,;:=!&|?+-*%<>~^':
            return True
        word = re.search(r'[A-Za-z_$][\w$]*$', ''.join(out[max(0, k - 11):k + 1]))
        return bool(word) and word.group(0) in REGEX_KEYWORDS

    i = 0
    while i < n:
        pair = source[i:i + 2]
        c = source[i]
        if pair == '//':
            end = source.find('\n', i)
            end = n if end < 0 else end
            blank(i, end)
            i = end
        elif pair == '/*':
            end = source.find('*/', i + 2)
            end = n if end < 0 else end + 2
            blank(i, end)
            i = end
        elif c in ('"', "'"):
            j = i + 1
            while j < n and source[j] != c and source[j] != '\n':
                j += 2 if source[j] == '\\' else 1
            j = j + 1 if j < n and source[j] == c else min(j, n)
            blank(i, j)
            i = j
        elif c == '/' and regex_may_start(i):
            j = i + 1
            in_class = False
            while j < n and source[j] != '\n':
                if source[j] == '\\':
                    j += 2
                    continue
                if source[j] == '[':
                    in_class = True
                elif source[j] == ']':
                    in_class = False
                elif source[j] == '/' and not in_class:
                    break
                j += 1
            if j < n and source[j] == '/':
                blank(i, j + 1)
                i = j + 1
            else:
                i += 1   # no closing slash on the line: a division after all
        elif c == '`':
            i = template(i)
        elif stack and c == '{':
            stack[-1] += 1
            i += 1
        elif stack and c == '}':
            if stack[-1] == 0:
                stack.pop()
                i = template(i)
            else:
                stack[-1] -= 1
                i += 1
        else:
            i += 1
    return ''.join(out)


def mask_python(source: str) -> str:
    """Blank `#` comments and string literals (Python lexis: triple-quoted strings span lines), keeping offsets."""
    out = list(source)
    n = len(source)
    i = 0
    while i < n:
        c = source[i]
        if c == '#':
            end = source.find('\n', i)
            end = n if end < 0 else end
        elif source[i:i + 3] in ('"""', "'''"):
            end = source.find(source[i:i + 3], i + 3)
            end = n if end < 0 else end + 3
        elif c in ('"', "'"):
            end = i + 1
            while end < n and source[end] != c and source[end] != '\n':
                end += 2 if source[end] == '\\' else 1
            end = end + 1 if end < n and source[end] == c else min(end, n)
        else:
            i += 1
            continue
        for k in range(i, end):
            if source[k] != '\n':
                out[k] = ' '
        i = end
    return ''.join(out)


_TS_MODIFIERS = r'(?:(?:export|default|declare|abstract|async|static|public|private|protected|readonly|override|get|set)\s+)*'


def declared_names(source: str, language: str = 'ts') -> set[str]:
    """Every name the module DECLARES in code: a binding, a function, a class and its members, a type and its fields,
    an object key. A name that stands only in a comment, a string or a call site declares nothing."""
    if language == 'py':
        code = mask_python(source)
        return (set(re.findall(r'(?m)^\s*(?:async\s+)?(?:def|class)\s+([A-Za-z_]\w*)', code))
                | set(re.findall(r'(?m)^\s*([A-Za-z_]\w*)\s*(?::[^=\n]+)?=(?!=)', code)))
    code = mask_non_code(source)
    names = set(re.findall(
        r'\b(?:const|let|var|function\*?|class|interface|type|enum|namespace|module)\s+([A-Za-z_$][\w$]*)', code))
    names.update(re.findall(rf'(?m)^\s*{_TS_MODIFIERS}#?([A-Za-z_$][\w$]*)\s*[?!]?\s*(?:[(<:]|=(?!=))', code))
    return names


if __name__ == '__main__':
    # A census over many modules at once: a JSON list of paths on stdin, the sorted declared names on stdout.
    import json, pathlib, sys
    found: set[str] = set()
    for path in json.load(sys.stdin):
        try:
            text = pathlib.Path(path).read_text(errors='replace')
        except (FileNotFoundError, IsADirectoryError):
            continue
        found.update(declared_names(text, 'py' if path.endswith('.py') else 'ts'))
    json.dump(sorted(found), sys.stdout)
