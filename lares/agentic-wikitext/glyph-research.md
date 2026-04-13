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

---

*Further Research*



Fetched 7 resources

Compacted conversationHere’s a synthesis of prior art and models for glyph-based namespace and authorization systems, with a focus on exclusivity, additivity, and attenuative (UCAN-style) inheritance, and their fit for user authentication/authorization (authn/authz):

---

### 1. Unicode & Devanagari: Exclusivity and Additivity

- **Unicode**: Assigns unique code points to each character, ensuring mutual exclusivity at the encoding level. However, Unicode itself is not an authorization system; it’s a universal character set.
- **Devanagari Block**: Glyphs (including diacritics like Anusvara ं, Visarga ः, Nukta ़, Candrabindu ँ) are mutually exclusive as code points, but can be combined in rendering (e.g., consonant + diacritic = new glyph). This is additive at the glyph composition level, but exclusive at the code point level.
- **Namespace Use**: In XML and related standards, namespaces are exclusive (a name belongs to one namespace at a time), but scoping is hierarchical and can be overridden (attenuative).

---

### 2. XML Namespaces: Attenuative/Hierarchical Model

- **Default Namespace**: Unprefixed elements inherit the nearest enclosing default namespace unless explicitly overridden. This is an attenuative (scoped, inheriting) model.
- **Prefix Override**: A new namespace declaration (prefix or default) within a scope overrides the inherited one for that subtree.
- **No Additivity**: Namespaces are not additive; an element/attribute belongs to one namespace at a time.

---

### 3. UCAN Protocol: Attenuative, Composable Authz

- **UCAN (User Controlled Authorization Network)**: 
  - **Attenuative**: Capabilities can be delegated with reduced scope (attenuation), and chains of delegation are cryptographically verifiable.
  - **Composable**: Multiple UCANs can be combined to form complex, fine-grained authorization trees.
  - **Mutual Exclusivity**: Each capability is scoped and cannot be “double-owned” in the same context, but multiple capabilities can be held by a user.
  - **Additivity**: Capabilities can be combined, but each is still individually scoped and tracked.

---

### 4. OAuth2 (RFC 6749): Additive Scopes, Exclusive Tokens

- **Scopes**: Additive (a token can have multiple scopes), but each scope is exclusive in its meaning.
- **Tokens**: Each access token is exclusive to a client/resource owner context.

---

### 5. Synthesis for Glyph-Based Authn/Authz

- **Mutual Exclusivity**: Glyphs as namespace markers should be mutually exclusive at the assignment level (a resource or agent is in one namespace at a time).
- **Additivity**: If you want additive permissions, model it as a set of glyphs/capabilities attached to a user or agent, not as a single glyph.
- **Attenuative/UCAN-Style**: Inheritance of namespace or capability can be modeled as “attenuative” — a blank or null glyph means “inherit from parent,” and explicit glyphs override. Delegation can be tracked as a chain (like UCAN).
- **Best Practice**: For user authn/authz, use a combination:
  - **Exclusive namespace glyph** for primary scope.
  - **Additive capability glyphs** for permissions.
  - **Attenuative inheritance** for scoping (blank = inherit, explicit = override).

---

### 6. Prior Art Summary Table

| System         | Mutual Excl. | Additive | Attenuative/Hierarchical | Composable | Used for Authn/Authz |
|----------------|--------------|----------|-------------------------|------------|---------------------|
| Unicode        | Yes          | Yes*     | No                      | No         | No                  |
| Devanagari     | Yes          | Yes*     | No                      | No         | No                  |
| XML Namespace  | Yes          | No       | Yes                     | No         | No                  |
| UCAN           | Yes          | Yes      | Yes                     | Yes        | Yes                 |
| OAuth2         | Yes          | Yes      | No                      | No         | Yes                 |

*Additive at the glyph composition/rendering level, not at the code point/namespace level.

---

### 7. Model Recommendation

- **Namespace glyphs**: Mutually exclusive, attenuative (UCAN-style inheritance).
- **Capability glyphs**: Additive, can be attached as a set.
- **Authn/Authz**: Use cryptographic delegation (UCAN) or token-based (OAuth2) for actual enforcement; glyphs are for scoping and signaling.

---

**Conclusion:**  
No major system uses only glyphs for authn/authz, but the best fit is a hybrid:  
- Use mutually exclusive namespace glyphs for scoping (with attenuative inheritance, like XML/UCAN).
- Use additive capability glyphs for permissions.
- For actual authorization, use cryptographic delegation (UCAN) or token-based (OAuth2) models.
