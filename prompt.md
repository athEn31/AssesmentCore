

---

## Instruction

When the **MathML format is selected in configuration**, you must convert all mathematical expressions to **valid MathML** using the following strict rules.

---

# 1. Root MathML Structure

Every mathematical expression must be wrapped inside:

```xml
<math xmlns="http://www.w3.org/1998/Math/MathML">
  <mrow>
    ...expression...
  </mrow>
</math>
```

Rules:

* Always include `<mrow>` inside `<math>`
* Never place operators or identifiers directly inside `<math>`

---

# 2. Element Mapping Rules

Use these MathML tags strictly.

| Element   | MathML Tag |
| --------- | ---------- |
| variables | `<mi>`   |
| numbers   | `<mn>`   |
| operators | `<mo>`   |
| grouping  | `<mrow>` |

---

# 3. Fractions

LaTeX

```
\frac{a}{b}
```

MathML

```xml
<mfrac>
  <mi>a</mi>
  <mi>b</mi>
</mfrac>
```

Rule:

```
frac -> mfrac
numerator -> first child
denominator -> second child
```

---

# 4. Superscripts

Expression

```
x^2
```

MathML

```xml
<msup>
  <mi>x</mi>
  <mn>2</mn>
</msup>
```

---

# 5. Subscripts

Expression

```
x_1
```

MathML

```xml
<msub>
  <mi>x</mi>
  <mn>1</mn>
</msub>
```

---

# 6. Subscript + Superscript

Expression

```
x_1^2
```

MathML

```xml
<msubsup>
  <mi>x</mi>
  <mn>1</mn>
  <mn>2</mn>
</msubsup>
```

---

# 7. Parentheses

Expression

```
(x + 1)
```

MathML

```xml
<mrow>
  <mo>(</mo>
  <mi>x</mi>
  <mo>+</mo>
  <mn>1</mn>
  <mo>)</mo>
</mrow>
```

---

# 8. Integrals

Expression

```
∫₀¹ x² dx
```

MathML

```xml
<mrow>
  <msubsup>
    <mo>∫</mo>
    <mn>0</mn>
    <mn>1</mn>
  </msubsup>
  <msup>
    <mi>x</mi>
    <mn>2</mn>
  </msup>
  <mi>d</mi>
  <mi>x</mi>
</mrow>
```

---

# 9. Matrices

Example:

```
[2 1
 1 2]
```

MathML:

```xml
<mtable>
  <mtr>
    <mtd><mn>2</mn></mtd>
    <mtd><mn>1</mn></mtd>
  </mtr>
  <mtr>
    <mtd><mn>1</mn></mtd>
    <mtd><mn>2</mn></mtd>
  </mtr>
</mtable>
```

---

# 10. Forbidden MathML Elements

The AI must NOT generate:

```
&#x2062;
&#x2061;
data-semantic attributes
empty <mrow></mrow>
<semantics>
<annotation>
```

---

# 11. Namespace Rule

MathML must use the default namespace. Use of prefixes (like `m:`) is strictly forbidden.

Correct:

```xml
<math xmlns="http://www.w3.org/1998/Math/MathML">
<mi>x</mi>
```

Incorrect:

```xml
<m:math xmlns:m="http://www.w3.org/1998/Math/MathML">
<m:mi>x</m:mi>
```

---

# 12. Validation Before Output

Before inserting MathML into QTI XML ensure:

1. No raw LaTeX commands remain (`\frac`, `\sqrt`, etc.)
2. All math is inside `<math>` with the correct xmlns.
3. No empty `<mrow>`
4. Operators use `<mo>`
5. Numbers use `<mn>`
6. Variables use `<mi>`

---

# Example Final Output (QTI Prompt)

```xml
<prompt>
Evaluate:
<math xmlns="http://www.w3.org/1998/Math/MathML">
<mrow>
<msubsup>
<mo>∫</mo>
<mn>0</mn>
<mn>1</mn>
</msubsup>
<msup>
<mi>x</mi>
<mn>2</mn>
</msup>
<mi>d</mi>
<mi>x</mi>
</mrow>
</math>
</prompt>
```

---

# ⭐ One more important tip for your platform

Because you are building **AssessmentCore (QTI generator)**, the **most reliable approach** is:

```
LaTeX
 ↓
KaTeX → MathML
 ↓
MathML sanitizer
 ↓
Add namespace
 ↓
Insert into QTI
```

This avoids **AI hallucinating MathML structure**.

