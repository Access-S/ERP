# Internal UI Component Standard

Status: Enforced
Owner: Product owner / Engineering
Last updated: 2026-09-13

## Purpose

All visible controls must share the ERP theme, interaction behaviour, focus
styles, dark-mode colours, accessibility defaults, and future design changes.
Feature code must therefore consume the internal components in
`src/components/ui` instead of styling browser controls independently.

## Required workflow

1. Search `src/components/ui` for an existing primitive or pattern.
2. Use that internal component in application, feature, and shared composite
   code.
3. If the required primitive is missing, build and verify it in
   `src/components/ui` first.
4. Only then consume it from the feature.
5. Verify normal, hover, focus, disabled, error, and dark-theme states.

Third-party UI primitives such as Radix may be used to implement the internal
library. Feature code must not introduce a second visual system or import a
third-party visual control as a shortcut around the internal library.

## Enforced controls

Outside `src/components/ui`, ESLint rejects direct JSX use of:

- `button`;
- `input`;
- `select` and `option`;
- `textarea`;
- `label`;
- native table elements; and
- `dialog`.

Use the corresponding internal `Button`, `Input`, `Checkbox`, `Select`,
`Textarea`, `Label`, `Table`, and `Dialog` components.

This applies to hidden inputs as well. Consistency is easier to enforce when
the rule has no per-feature exceptions.

## Deliberate native semantic elements

The standard does not replace structural HTML that has no design-system
primitive. Continue using semantic elements such as `form`, `main`, `section`,
`nav`, headings, paragraphs, lists, and layout containers. Internal components
ultimately render accessible native elements; the boundary exists to centralize
their public styling and behaviour, not to remove HTML from the application.

## Current audit result

The full `src` tree was audited on 2026-09-13. Direct native control usage was
removed from feature and shared code. Password visibility controls, the
activation token field/link label, the sidebar group toggle, calendar day
buttons, and audit filters now use the internal library.
