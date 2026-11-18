"""Read declaration positions in code without counting comments or literal text.

A witness that derives a reading from source matches CODE, never prose: a union quoted in a comment or a dispatch
key named inside a string reads like the real thing to a raw regex, and the witness then measures the commentary.
`mask_non_code` blanks every comment and string literal to spaces (newlines kept), so a match against the masked
text lands only at a code position, and its offsets still index the original source.
"""

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
                if source[j] != '\n':
                    out[j] = ' '
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
                if source[k] != '\n':
                    out[k] = ' '
            i = j
            continue
        i += 1
    return ''.join(out)
