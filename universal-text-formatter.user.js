// ==UserScript==
// @name         Universal Text Formatter
// @namespace    https://github.com/code-loyko/
// @version      1.2
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
    const UNICODE_STYLE_OFFSETS = {
        UPPERCASE: [0, 120211, 120263, 120315], // A-Z
        LOWERCASE: [0, 120205, 120257, 120309], // a-z
        DIGIT:     [0, 120764, 0, 120764]       // 0-9 (No italics available for digits)
    };

    /**
     * Identifies character base, category, and current style bitmask (0-3).
     */
    function getCharacterMetadata(charCodePoint) {
        for (let styleBitmask = 3; styleBitmask >= 1; styleBitmask--) {
            for (const [charCategory, categoryOffsets] of Object.entries(UNICODE_STYLE_OFFSETS)) {
                const baseCodePoint = charCodePoint - categoryOffsets[styleBitmask];
                const isMatchingCategory = (charCategory === 'UPPERCASE' && baseCodePoint >= 65 && baseCodePoint <= 90) ||
                                           (charCategory === 'LOWERCASE' && baseCodePoint >= 97 && baseCodePoint <= 122) ||
                                           (charCategory === 'DIGIT'     && baseCodePoint >= 48 && baseCodePoint <= 57);

                if (isMatchingCategory) return { baseCodePoint, charCategory, currentStyle: styleBitmask };
            }
        }

        // Standard ASCII Fallback
        if (charCodePoint >= 65 && charCodePoint <= 90) return { baseCodePoint: charCodePoint, charCategory: 'UPPERCASE', currentStyle: 0 };
        if (charCodePoint >= 97 && charCodePoint <= 122) return { baseCodePoint: charCodePoint, charCategory: 'LOWERCASE', currentStyle: 0 };
        if (charCodePoint >= 48 && charCodePoint <= 57) return { baseCodePoint: charCodePoint, charCategory: 'DIGIT', currentStyle: 0 };

        return null; // Accents, punctuation, etc.
    }

    /**
     * Returns a formatter function based on the global toggle state of the selected text.
     * Behavior matches standard text editors: if any selected char lacks the style, apply to all.
     */
    function prepareTextFormatter(concatenatedSelectedText, requestedStyleBitmask) {
        const characterCodePoints = [...concatenatedSelectedText];
        const metadataListForSelection = characterCodePoints.map(char => getCharacterMetadata(char.codePointAt(0)));
        const isApplyingStyle = metadataListForSelection.some(metadata => metadata && (metadata.currentStyle & requestedStyleBitmask) === 0);

        return (textSegmentToFormat) => {
            return [...textSegmentToFormat].map(char => {
                const metadata = getCharacterMetadata(char.codePointAt(0));
                if (!metadata || (metadata.charCategory === 'DIGIT' && requestedStyleBitmask === 2)) return char;

                const updatedStyleBitmask = isApplyingStyle ? (metadata.currentStyle | requestedStyleBitmask) : (metadata.currentStyle & ~requestedStyleBitmask);
                return String.fromCodePoint(metadata.baseCodePoint + UNICODE_STYLE_OFFSETS[metadata.charCategory][updatedStyleBitmask]);
            }).join('');
        };
    }

    window.addEventListener('keydown', (keyboardEvent) => {
        const isModifierKeyPressed = keyboardEvent.ctrlKey || keyboardEvent.metaKey;
        const requestedStyleBitmask = (keyboardEvent.key.toLowerCase() === 'b') ? 1 : (keyboardEvent.key.toLowerCase() === 'i') ? 2 : 0;

        if (!isModifierKeyPressed || !requestedStyleBitmask) return;

        const eventTargetElement = keyboardEvent.target;
        const isStandardInputOrTextarea = eventTargetElement.tagName === 'TEXTAREA' || eventTargetElement.tagName === 'INPUT';

        // --- STANDARD INPUTS (Textareas) ---
        if (isStandardInputOrTextarea) {
            const selectionStartIndex = eventTargetElement.selectionStart;
            const selectionEndIndex = eventTargetElement.selectionEnd;
            if (selectionStartIndex === selectionEndIndex) return;

            keyboardEvent.preventDefault();
            keyboardEvent.stopImmediatePropagation();

            const selectedText = eventTargetElement.value.substring(selectionStartIndex, selectionEndIndex);
            const formatSegment = prepareTextFormatter(selectedText, requestedStyleBitmask);
            const finalFormattedText = formatSegment(selectedText);

            // Textareas support execCommand for Undo/Redo history
            document.execCommand('insertText', false, finalFormattedText);
            eventTargetElement.setSelectionRange(selectionStartIndex, selectionStartIndex + finalFormattedText.length);
            return;
        }

        // --- RICH TEXT EDITORS (LinkedIn, Facebook, etc.) ---
        const currentWindowSelection = window.getSelection();
        if (!currentWindowSelection.rangeCount || currentWindowSelection.isCollapsed) return;

        const activeSelectionRange = currentWindowSelection.getRangeAt(0);
        const selectionAncestorContainer = activeSelectionRange.commonAncestorContainer.nodeType === Node.TEXT_NODE
            ? activeSelectionRange.commonAncestorContainer.parentNode
            : activeSelectionRange.commonAncestorContainer;

        // TreeWalker isolates strictly the text nodes to prevent destroying HTML structures like <p> or <br>
        const textNodeWalker = document.createTreeWalker(selectionAncestorContainer, NodeFilter.SHOW_TEXT);
        const textNodesInSelection = [];
        let traversedTextNode;

        while ((traversedTextNode = textNodeWalker.nextNode())) {
            if (activeSelectionRange.intersectsNode(traversedTextNode)) {
                const traversedNodeRange = document.createRange();
                traversedNodeRange.selectNodeContents(traversedTextNode);
                const clampedSelectionRange = activeSelectionRange.cloneRange();

                // Clamp the intersection specifically to the boundaries of the current node
                if (clampedSelectionRange.compareBoundaryPoints(Range.START_TO_START, traversedNodeRange) < 0) {
                    clampedSelectionRange.setStart(traversedNodeRange.startContainer, traversedNodeRange.startOffset);
                }
                if (clampedSelectionRange.compareBoundaryPoints(Range.END_TO_END, traversedNodeRange) > 0) {
                    clampedSelectionRange.setEnd(traversedNodeRange.endContainer, traversedNodeRange.endOffset);
                }

                if (!clampedSelectionRange.collapsed) {
                    textNodesInSelection.push({
                        targetTextNode: traversedTextNode,
                        nodeSelectionStart: clampedSelectionRange.startOffset,
                        nodeSelectionEnd: clampedSelectionRange.endOffset
                    });
                }
            }
        }

        if (!textNodesInSelection.length) return;

        keyboardEvent.preventDefault();
        keyboardEvent.stopImmediatePropagation();

        // Evaluate global toggle format based on all text nodes involved
        const concatenatedSelectedText = textNodesInSelection.map(info => info.targetTextNode.nodeValue.substring(info.nodeSelectionStart, info.nodeSelectionEnd)).join('');
        const formatSegment = prepareTextFormatter(concatenatedSelectedText, requestedStyleBitmask);

        let rangeStartNode = textNodesInSelection[0].targetTextNode;
        let rangeStartOffset = textNodesInSelection[0].nodeSelectionStart;
        let rangeEndNode = textNodesInSelection[textNodesInSelection.length - 1].targetTextNode;
        let rangeEndOffset = textNodesInSelection[textNodesInSelection.length - 1].nodeSelectionEnd;

        // DOM mutation
        textNodesInSelection.forEach((nodeSelectionInfo, index) => {
            const { targetTextNode, nodeSelectionStart, nodeSelectionEnd } = nodeSelectionInfo;
            const originalNodeContent = targetTextNode.nodeValue;
            const textToFormat = originalNodeContent.substring(nodeSelectionStart, nodeSelectionEnd);
            const formattedTextResult = formatSegment(textToFormat);

            targetTextNode.nodeValue = originalNodeContent.substring(0, nodeSelectionStart) + formattedTextResult + originalNodeContent.substring(nodeSelectionEnd);

            // Sync the cursor position if multi-unit characters (like emojis)
            if (index === textNodesInSelection.length - 1) {
                rangeEndOffset += (formattedTextResult.length - textToFormat.length);
            }
        });

        // Maintain partial history compatibility
        eventTargetElement.dispatchEvent(new InputEvent('input', {
            inputType: 'insertReplacementText',
            bubbles: true,
            cancelable: true
        }));

        // Restore exact selection
        currentWindowSelection.removeAllRanges();
        const newSelectionRange = document.createRange();
        newSelectionRange.setStart(rangeStartNode, rangeStartOffset);
        newSelectionRange.setEnd(rangeEndNode, rangeEndOffset);
        currentWindowSelection.addRange(newSelectionRange);

    }, true);
})();
