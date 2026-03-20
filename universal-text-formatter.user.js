// ==UserScript==
// @name         Universal Text Formatter
// @namespace    https://github.com/code-loyko/
// @version      1.1
// @description  Apply Bold and Italic styles to any text field.
// @author       Loyko
// @match        *://*/*
// @license      GPL-3.0-or-later
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // Unicode offsets for Sans-Serif Mathematical Alphanumeric Symbols
    // Style Index: [0: Normal, 1: Bold, 2: Italic, 3: Bold-Italic]
    const OFFSETS = {
        UPPERCASE: [0, 120211, 120263, 120315], // A-Z
        LOWERCASE: [0, 120205, 120257, 120309], // a-z
        DIGIT:     [0, 120764, 0, 120764]       // 0-9 (No italics available for digits)
    };

    /**
     * Identifies character base, type, and current style bitmask (0-3).
     */
    function getCharData(codePoint) {
        for (let s = 3; s >= 1; s--) {
            for (const [type, values] of Object.entries(OFFSETS)) {
                const base = codePoint - values[s];
                const isMatch = (type === 'UPPERCASE' && base >= 65 && base <= 90) ||
                                (type === 'LOWERCASE' && base >= 97 && base <= 122) ||
                                (type === 'DIGIT'     && base >= 48 && base <= 57);

                if (isMatch) return { base, type, style: s };
            }
        }

        // Standard ASCII Fallback
        if (codePoint >= 65 && codePoint <= 90) return { base: codePoint, type: 'UPPERCASE', style: 0 };
        if (codePoint >= 97 && codePoint <= 122) return { base: codePoint, type: 'LOWERCASE', style: 0 };
        if (codePoint >= 48 && codePoint <= 57) return { base: codePoint, type: 'DIGIT', style: 0 };

        return null; // Accents, punctuation, etc.
    }

    window.addEventListener('keydown', (event) => {
        // Keyboard mapping (Ctrl/Cmd + B/I)
        const isModifier = event.ctrlKey || event.metaKey;
        const styleBit = (event.key === 'b') ? 1 : (event.key === 'i') ? 2 : 0;

        if (!isModifier || !styleBit) return;

        const selection = window.getSelection();
        const text = selection.toString();
        if (!text || !selection.rangeCount) return;

        event.preventDefault();
        event.stopImmediatePropagation();

        // 1. Analyze selection for toggle behavior
        const chars = [...text];
        const charDataList = chars.map(c => getCharData(c.codePointAt(0)));
        const shouldApply = charDataList.some(d => d && (d.style & styleBit) === 0);

        // 2. Build transformed string
        const result = charDataList.map((data, index) => {
            if (!data || (data.type === 'DIGIT' && styleBit === 2)) return chars[index];
            const newStyle = shouldApply ? (data.style | styleBit) : (data.style & ~styleBit);
            return String.fromCodePoint(data.base + OFFSETS[data.type][newStyle]);
        }).join('');

        // 3. Perform atomic replacement (supports Undo/Redo)
        document.execCommand('insertText', false, result);

        // 4. Restore selection across line breaks and complex DOM nodes
        const targetLen = result.length;
        let safety = 0;

        while (selection.toString().length < targetLen && safety < targetLen + 20) {
            const prevLen = selection.toString().length;
            selection.modify('extend', 'backward', 'character');

            // Handle line breaks or editor boundaries
            if (selection.toString().length === prevLen) {
                selection.modify('extend', 'backward', 'character');
                // If still stalled after a second attempt, we've reached the start of the field
                if (selection.toString().length === prevLen) break;
            }
            safety++;
        }
    }, true);
})();
