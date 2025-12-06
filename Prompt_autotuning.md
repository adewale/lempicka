# Prompt Autotuning for Lempicka

This document captures the evolution of prompts and the methodology for iterating on them.

## Prompt Evolution History

### Phase 1: Style Exploration

Initial experimentation to capture Lempicka's visual style. Tested 5 variations focusing on different aspects:

| Prompt | Focus | Key Elements |
|--------|-------|--------------|
| Marble & Hollywood Lighting | Surface quality | "Skin like polished Carrara marble", "1930s Hollywood lighting" |
| Geometric Construction | Form | "Arms as cylinders, angular planes meeting sensual curves" |
| Concise Direct | Brevity | Minimal keywords approach |
| Technical Painting | Specificity | Detailed color palette (emerald, cobalt, vermillion) |
| Minimal Keywords | Efficiency | Shortest viable prompt |

**Finding:** Technical specificity (marble skin, violet shadows, geometric forms) improved results.

### Phase 2: Identity Preservation

**Problem:** Early prompts transformed subjects too aggressively, losing their recognizable features.

**Evolution:**

1. **Original** - Pure style transformation
   ```
   Transform this image into the artistic style of Tamara de Lempicka...
   ```

2. **Improved** - Added technical detail but still lost identity
   ```
   Portrait in the style of Tamara de Lempicka, 1929.
   Render the subject with polished Carrara marble skin...
   ```

3. **Balanced** - Explicit identity preservation
   ```
   PRESERVE the subject's face exactly - their bone structure, features,
   gender, ethnicity, and likeness must remain recognizable.
   ```

4. **Preservation Focus** - Even stronger language
   ```
   CRITICAL: Preserve the person's facial features, ethnicity, gender,
   and identity completely intact.
   ```

**Finding:** The word "CRITICAL" and framing as a "commissioned portrait of THIS specific person" improved identity preservation.

### Phase 3: Gender-Specific Treatment

**Problem:** Model applied red lipstick to male subjects, which was historically inaccurate for Lempicka's work.

**Evolution:**

1. **V1** - Basic gender awareness
   ```
   COLOR TREATMENT based on subject:
   - For women: vermillion red lips as focal point
   - For men: natural flesh-toned lips, NO red lipstick
   ```

2. **V2** - Historical justification (CURRENT PRODUCTION)
   ```
   GENDER-SPECIFIC COLOR (as Lempicka did):
   - FEMALE subjects: Apply signature vermillion red lips, red nails
   - MALE subjects: Render lips in NATURAL flesh tones only (muted browns/pinks).
     Lempicka did NOT use red lips on men (see Portrait of Dr. Boucard, Marquis d'Afflito).
   ```

3. **V3** - Simplified
   ```
   - For women: red vermillion lips as focal point
   - For men: natural lip color (NO red lipstick - Lempicka never painted men with red lips)
   ```

**Finding:** Historical examples (Dr. Boucard, Marquis d'Afflito) helped the model understand the constraint.

### Phase 4: Glasses Preservation

**Problem:** Model was removing glasses from subjects wearing them.

**Research Finding:** This behavior was actually historically accurate - Lempicka deliberately removed glasses from subjects. Her portrait of André Gide shows him "unfettered by glasses" despite him wearing them in real life. She considered glasses utilitarian rather than glamorous.

**Decision:** Override historical behavior because glasses are a key modern identity marker.

**Iteration Process:**

1. **First attempt (too aggressive):** Added explicit "MODERN ADAPTATION" sections and "DO NOT REMOVE" language. This preserved glasses but also changed other behavior (kept original clothing instead of formal portrait transformation).

2. **Second attempt (minimal):** Tested 5 minimal variants:
   - A: `"features, and glasses (if worn)"` - Just 4 words added
   - B: `"preserve them with their exact frame shape"` - End of sentence
   - C: Separate `EYEWEAR:` line
   - D: `"and eyewear"` inline
   - E: Note at end of prompt

3. **Winner: Variant A** - Most minimal change that preserved formal portrait behavior while keeping glasses with correct frame shape/style.

**Key Learning:** When adding a new preservation feature, start with the smallest possible change. Larger changes can have unintended side effects on other behaviors.

**Change applied:**
```diff
- ethnicity, and features
+ ethnicity, features, and glasses (if worn)
```

**Testing:** `test/test-glasses-prompt-v2.js`

## Current Production Prompt (v4)

```
Tamara de Lempicka oil portrait commission, 1929.

CRITICAL - PRESERVE IDENTITY: Keep the subject's exact face, bone structure, gender, ethnicity, features, and glasses (if worn). They must be recognizable.

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

## Autotuning Methodology

### Test Files

- `test/test-prompts.js` - Style exploration (5 prompts)
- `test/compare-prompts.js` - Original vs Improved
- `test/compare-prompts-v2.js` - Identity preservation variants
- `test/test-gender-prompt.js` - Gender-aware variants
- `test/test-glasses-prompt.js` - Glasses preservation (aggressive variants)
- `test/test-glasses-prompt-v2.js` - Glasses preservation (minimal variants)

### Running Tests

```bash
# Set API token
export REPLICATE_API_TOKEN=your_token

# Run comparison
node test/compare-prompts-v2.js

# Test gender handling
node test/test-gender-prompt.js
```

### Iteration Pattern

1. Identify a specific problem (e.g., "loses identity", "adds lipstick to men")
2. Create 2-4 prompt variants addressing the problem
3. Run all variants against the same test image
4. Compare outputs visually
5. Select winner, iterate further if needed

---

## Sub-Agent Prompts for Autotuning

These are the prompts used to instruct Claude sub-agents to research and iterate on image generation prompts. They can be adapted for other style transfer projects.

### 1. Initial Style Research (Extended Thinking)

Use this to deeply research an artist's style before writing prompts:

```
Use extended thinking to deeply research and analyze Tamara de Lempicka's artistic style. I need you to identify:

1. **Her most iconic works** - List 5-10 of her most famous paintings with specific titles
2. **Defining visual characteristics** - What makes her style instantly recognizable? Be very specific about:
   - Color palette (exact colors, not just "rich colors")
   - Lighting techniques (direction, quality, contrast ratios)
   - Surface treatment (how skin, fabric, metal appears)
   - Geometric forms (specific shapes, how curves meet angles)
   - Composition patterns
3. **What distinguishes her from other Art Deco artists** - What is uniquely "Lempicka" vs generic Art Deco?
4. **Common mistakes** - What do bad imitations of her style get wrong?

Think deeply about this. I need precise, actionable details that could be used in an AI image generation prompt. Return your findings in a structured format.
```

### 2. Prompt Iteration with Testing

Use this to iterate on prompts with a live worker:

```
You are iterating on an AI image generation prompt to better capture Tamara de Lempicka's style using the Replicate Nano Banana model.

**Current prompt:**
```
[INSERT CURRENT PROMPT HERE]
```

**Research on de Lempicka's style (use this to improve the prompt):**

Key characteristics:
- Skin appears as polished Carrara marble - smooth, cool, idealized with violet/blue shadows and cool pink highlights
- Single dominant light source at 45° upper left, hard-edged shadows, studio lighting quality like 1930s Hollywood
- Color palette: emerald/viridian green, cerulean/cobalt blue, cadmium vermillion red, cool silver-gray, burgundy, ivory (never pure white)
- Flesh: pale ochre + white base with rose madder undertones, shadows in raw umber + violet
- Geometric figure construction: arms/legs as cylinders, angular planes meeting sensual curves
- Sculptural hair in organized waves (lacquered, heavy, not wispy)
- Sharp cheekbones, angular jaw, arched eyebrows, bow lips, almond eyes tilted upward
- Fabric drapes heavily with geometric pleats
- Low angle looking up creates monumentality - figures feel 10 feet tall
- Subjects project power and confidence, direct challenging gazes
- Background: simplified geometric/architectural forms, solid colors with subtle gradation
- High local contrast but controlled global contrast

Common mistakes to avoid:
- Flat forms (needs sculptural depth)
- Plastic-looking skin (should be polished stone, not synthetic)
- Wispy hair (should be sculptural waves)
- Posterized gradients (needs smooth tonal transitions)
- Missing the monumentality and confidence
- Too much pattern/decoration
- Garish oversaturated colors (should be harmonious)

**Your task:**
1. Create 3-5 improved prompt variations based on this research
2. Test each prompt by calling the local worker at http://localhost:8787 with the test image
3. The test image is at /Users/aoshineye/Documents/lempicka/test/test-small.jpg
4. Evaluate each result and iterate further if needed
5. Keep the prompts concise but specific - Nano Banana works best with clear, direct instructions

To test a prompt, read the test image, convert to base64, and POST to http://localhost:8787 with JSON body:
```json
{"image": "data:image/jpeg;base64,..."}
```

The response will contain {"output": "https://..."} with the result image URL.

After testing, report back with:
1. The best performing prompt you found
2. URLs of the before/after images
3. What specific improvements you made over the original prompt
4. Any insights about what works vs what doesn't
```

### 3. Identity Preservation Research

Use this when prompts are losing subject identity:

```
Research Tamara de Lempicka's complete body of work comprehensively. I need to understand:

1. **Full range of subjects she painted:**
   - Male vs female subjects - how did she handle both?
   - Different ethnicities if any
   - Different ages
   - What remained consistent across all subjects?

2. **Her portrait commissions specifically:**
   - How did she preserve the likeness of her commissioned subjects?
   - What techniques did she use to make someone recognizable while still being "Lempicka"?
   - Examples of known portrait commissions with subject names

3. **Key works to study (provide specific painting titles):**
   - Her self-portraits
   - Male portraits (Dr. Boucard, etc.)
   - Female portraits showing diversity
   - Any subjects of different backgrounds

4. **What she PRESERVED vs what she STYLIZED:**
   - Did she change facial structure or preserve it?
   - How did she handle different skin tones?
   - Did subjects remain recognizable?

The goal is to understand how to create a prompt that applies her STYLE (lighting, color palette, brushwork, composition) while PRESERVING the subject's identity (gender, ethnicity, facial features, likeness).

Search the web thoroughly for art historical analysis of her portrait technique.
```

### 4. Gender-Specific Treatment Research

Use this when the model is applying gender-inappropriate styling:

```
Research how Tamara de Lempicka painted men versus women, specifically focusing on:

1. **Lip treatment in male portraits:**
   - Did she use red/vermillion lips on male subjects?
   - How did she render male lips compared to female lips?
   - Look at specific examples: Portrait of Dr. Boucard, Portrait of Marquis d'Afflito, Portrait of Tadeusz Lempicki, Adam and Eve (the male figure)

2. **Color differences between male and female portraits:**
   - Did men get the same "accent red on lips" treatment?
   - What colors did she use for male subjects?
   - Were there gender-specific color choices?

3. **Other stylistic differences:**
   - How did she handle male vs female skin tones?
   - Were male portraits less "glamorous"?
   - Any differences in background treatment?

Search the web and art databases for detailed analysis and images of her male portraits specifically. I need to understand exactly how she differentiated male and female subjects so we can update our AI prompt to NOT add lipstick to men.

Return specific findings with evidence from her actual paintings.
```

---

## Creating a Custom Sub-Agent

To create a reusable autotuning sub-agent, save this as `.claude/commands/autotune-prompt.md`:

```markdown
You are a prompt autotuning specialist. Your job is to iteratively improve AI image generation prompts.

**Process:**
1. Research the target style deeply using web search
2. Identify specific, actionable visual characteristics
3. Create 3-5 prompt variants
4. Test each against the worker
5. Analyze results and iterate
6. Document what works and what doesn't

**Key principles:**
- Be specific (exact colors, not "rich colors")
- Include what to AVOID (common mistakes)
- Reference historical examples when needed
- Test empirically, don't just theorize
- Preserve subject identity while applying style

$ARGUMENTS
```

Then invoke with: `/autotune-prompt [your specific instructions]`

---

## Extracting as a Standalone Tool

The prompt autotuning methodology documented here could be extracted into a standalone tool that works with any image generation model and any artistic style. Here are ideas for how to build it:

### Core Components

1. **Prompt Version Control**
   - Store prompts as versioned files (like `PROMPT_CHANGELOG.md`)
   - Track diffs between versions
   - Associate each version with test results and rationale

2. **Test Harness**
   - Generic test runner that takes: prompt variants, test images, model endpoint
   - Outputs: result images, comparison grids, metrics
   - Supports A/B testing and multi-variant testing

3. **Research Agent**
   - Sub-agent that researches artistic styles via web search
   - Extracts specific, actionable characteristics (colors, techniques, common mistakes)
   - Generates initial prompt suggestions based on research

4. **Iteration Agent**
   - Takes: current prompt, identified problem, test images
   - Generates: minimal variants addressing the problem
   - Runs tests and analyzes results
   - Recommends winner with reasoning

### Proposed Architecture

```
prompt-autotuner/
├── prompts/
│   ├── v1.txt
│   ├── v2.txt
│   └── changelog.md
├── tests/
│   ├── test-images/
│   └── results/
├── agents/
│   ├── research.md      # Style research agent prompt
│   ├── iterate.md       # Iteration agent prompt
│   └── analyze.md       # Results analysis agent prompt
├── config.yaml          # Model endpoint, API keys
└── cli.py               # Main CLI tool
```

### CLI Interface

```bash
# Research a new style
prompt-autotune research "Tamara de Lempicka" --output style-guide.md

# Create initial prompt from research
prompt-autotune init --style style-guide.md --output prompts/v1.txt

# Run test with current prompt
prompt-autotune test --prompt prompts/v1.txt --images tests/test-images/

# Iterate on a specific problem
prompt-autotune iterate --prompt prompts/v1.txt \
  --problem "removes glasses from subjects" \
  --constraint "preserve frame shape and style" \
  --images tests/test-images/glasses.jpg

# Compare variants
prompt-autotune compare --variants "A,B,C" --images tests/test-images/
```

### Key Principles for the Tool

1. **Minimal Changes First**
   - Always start with smallest possible prompt modification
   - Larger changes have unintended side effects
   - Test each change in isolation

2. **Historical Research**
   - Ground prompt decisions in actual artist behavior
   - Cite specific works as examples in prompts
   - Document when overriding historical accuracy (like glasses preservation)

3. **Regression Testing**
   - Keep test images for each problem solved
   - Run full test suite after each change
   - Catch regressions before they ship

4. **Prompt Changelog**
   - Every production change gets documented
   - Include: what changed, why, test results
   - Makes it easy to roll back or understand evolution

### Integration with Claude Code

The tool could integrate with Claude Code via:

1. **MCP Server** - Expose autotuning as tools Claude can call
2. **Slash Commands** - `/autotune-research`, `/autotune-iterate`, `/autotune-test`
3. **Custom Agent** - Dedicated agent type for prompt autotuning tasks

### Future Enhancements

- **Automated metrics** - Perceptual similarity scores, style classifier confidence
- **Human feedback loop** - Rate results, feed ratings back into iteration
- **Prompt templates** - Reusable patterns for common problems (identity, accessories, colors)
- **Multi-model support** - Test same prompt across different models
- **CI/CD integration** - Run autotuning tests on PR, block deploys on regression
