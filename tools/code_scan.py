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
