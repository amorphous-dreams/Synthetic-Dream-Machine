# Glyph Research: Numeric Character Reference (NCR)

*Source: Wikipedia — https://en.wikipedia.org/wiki/Numeric_character_reference (CC BY-SA 4.0)*

---

## What is a Numeric Character Reference (NCR)?

A **numeric character reference (NCR)** is a markup construct used in SGML and SGML-derived languages such as HTML and XML. It is a short sequence of characters that represents a single Unicode character, typically used to encode characters that are not directly available in the document's encoding or have special syntactic meaning.

- **Purpose:** To represent any Unicode character using only ASCII characters, ensuring compatibility across encodings and systems.
- **Usage:** Common in HTML, XML, and related markup languages.

---

## Syntax

- **Decimal NCR:** `&#<decimal code point>;`
  - Example: `&#931;` → Σ (Greek capital letter Sigma, U+03A3)
- **Hexadecimal NCR:** `&#x<hex code point>;`
  - Example: `&#x3A3;` → Σ (Greek capital letter Sigma, U+03A3)

**General form:**
- Begins with `&` (ampersand)
- Followed by `#` (number sign)
- Decimal: one or more digits (0–9)
- Hexadecimal: `x` (lowercase) followed by one or more hex digits (0–9, a–f, A–F)
- Ends with `;` (semicolon)

---

## Examples

| Unicode character | Decimal NCR   | Hex NCR      | Glyph |
|------------------|--------------|--------------|-------|
| U+03A3           | `&#931;`      | `&#x3A3;`     | Σ     |
| U+00C6           | `&#198;`      | `&#xC6;`      | Æ     |
| U+00DF           | `&#223;`      | `&#xDF;`      | ß     |
| U+0020           | `&#32;`      | `&#x20;`      | (space)|
| U+0041           | `&#65;`       | `&#x41;`      | A     |
| U+20AC           | `&#8364;`     | `&#x20AC;`    | €     |

---

## Why Use NCRs?

- **Encoding limitations:** Some encodings (e.g., ISO 8859) cannot represent all Unicode characters directly.
- **Special characters:** Some characters have special meaning in markup (e.g., `<`, `&`), so NCRs are used to avoid ambiguity.
- **Portability:** NCRs are ASCII-only, so they are safe for transmission and storage in any environment.

---

## Restrictions and Compatibility

- **Allowed code points:** In HTML and XML, NCRs should refer to valid Unicode code points. Some control characters are not allowed in XML, even by reference.
- **Legacy issues:** Early HTML and SGML sometimes interpreted NCRs according to the document's encoding, not Unicode. Modern standards use Unicode.
- **Browser quirks:** Some browsers may interpret certain NCRs (e.g., `&#128;`) according to legacy encodings (like Windows-1252) for compatibility.

---

## Related Concepts

- **Character entity reference:** Refers to a character by name (e.g., `&amp;` for `&`).
- **Unicode:** The universal character set for all modern computing.
- **ASCII:** The basic 128-character set, all NCRs are ASCII-compatible.

---

## References

- Wikipedia: [Numeric character reference](https://en.wikipedia.org/wiki/Numeric_character_reference) (CC BY-SA 4.0)
- W3C: [HTML Syntax](https://www.w3.org/TR/2017/WD-html52-20170228/syntax.html)

---

*This document is a factual summary and direct extraction from Wikipedia and related standards. For further details, see the linked Wikipedia article and W3C documentation.*
