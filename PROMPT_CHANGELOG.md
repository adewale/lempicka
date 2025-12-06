# Prompt Changelog

This file tracks the evolution of the production prompt used in `src/index.js`.

---

## v4 - Glasses Preservation (2025-12-05)

**Change:** Added glasses preservation to identity section.

**Diff:**
```diff
- CRITICAL - PRESERVE IDENTITY: Keep the subject's exact face, bone structure, gender, ethnicity, and features.
+ CRITICAL - PRESERVE IDENTITY: Keep the subject's exact face, bone structure, gender, ethnicity, features, and glasses (if worn).
```

**Reason:** Model was removing glasses from subjects. Research revealed this was historically accurate to Lempicka's practice (she removed André Gide's glasses in his portrait), but we want to preserve glasses as a modern identity marker.

**Testing:** `test/test-glasses-prompt-v2.js` - Variant A (minimal change) preserved formal portrait behavior while keeping glasses.

---

## v3 - Gender-Specific Color Treatment (2025-12-03)

**Full prompt:**
```
Tamara de Lempicka oil portrait commission, 1929.

CRITICAL - PRESERVE IDENTITY: Keep the subject's exact face, bone structure, gender, ethnicity, and features. They must be recognizable.

LEMPICKA STYLE ELEMENTS:
- Polished, luminous skin with smooth gradients
- Strong directional lighting from upper left creating sculptural shadows
- Art Deco architectural background in cool grays
- Soft Cubist geometry in forms

GENDER-SPECIFIC COLOR (as Lempicka did):
- FEMALE subjects: Apply signature vermillion red lips, red nails - these are compositional focal points
- MALE subjects: Render lips in NATURAL flesh tones only (muted browns/pinks matching skin). Lempicka did NOT use red lips on men (see Portrait of Dr. Boucard, Marquis d'Afflito). Male elegance comes from pose and attire, not cosmetics.

This is a portrait of THIS specific person in Lempicka's style.
```

**Reason:** Model was applying red lipstick to male subjects. Research into Lempicka's actual male portraits (Dr. Boucard, Marquis d'Afflito) showed she never used red lips on men.

**Testing:** `test/test-gender-prompt.js`

---

## v2 - Identity Preservation (2025-12-02)

**Key changes:**
- Added "CRITICAL - PRESERVE IDENTITY" section
- Framed as "commissioned portrait of THIS specific person"
- Explicit list of features to preserve (face, bone structure, gender, ethnicity)

**Reason:** Early prompts transformed subjects too aggressively, making them unrecognizable.

**Testing:** `test/compare-prompts-v2.js`

---

## v1 - Initial Style Prompt (2025-12-02)

**Prompt:**
```
Transform this image into the artistic style of Tamara de Lempicka.
Art Deco portrait with polished skin, dramatic lighting, geometric forms.
```

**Issues:** Lost subject identity, generic Art Deco rather than specifically Lempicka.

**Testing:** `test/test-prompts.js`, `test/compare-prompts.js`
