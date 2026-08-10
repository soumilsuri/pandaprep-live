// File: utils/latex-to-mathjax.util.js
import fs from 'fs';
import mathjax from 'mathjax-node';

/**
 * Initializes the MathJax processor
 */
function initMathJax() {
  mathjax.config({
    MathJax: {
      // MathJax configuration options
      SVG: {
        fontCache: 'global',
        scale: 120, // Increase size for better readability
        minScaleAdjust: 100,
      },
      tex2jax: {
        inlineMath: [['$', '$']],
        displayMath: [['$$', '$$']],
      },
      messageStyle: 'none',
      showMathMenu: false,
    },
  });

  mathjax.start();
}

/**
 * Converts LaTeX formulas in markdown to MathJax HTML snippets
 * @param {string} markdown - The markdown content with LaTeX formulas
 * @returns {Promise<string>} - Markdown with LaTeX formulas replaced by MathJax HTML
 */
export async function processLatexWithMathJax(markdown) {
  // Initialize MathJax
  initMathJax();

  // This regex captures both inline ($...$) and display ($$...$$) formulas
  const latexRegex = /(\$\$)([\s\S]*?)(\$\$)|(\$)(?!\$)([\s\S]*?)(?<!\$)(\$)/gm;

  let result = markdown;
  let promises = [];
  let replacements = [];

  // Create a map to store processed formulas (for deduplication)
  const processedFormulas = new Map();

  // Find all LaTeX formulas in the markdown
  let match;
  while ((match = latexRegex.exec(markdown)) !== null) {
    const fullMatch = match[0];
    const isDisplayMode = match[1] === '$$';
    const formula = isDisplayMode ? match[2] : match[5];

    // Skip empty formulas or problematic cases
    if (!formula || formula.trim() === '') continue;

    // Store the formula and its context for replacement
    const formulaData = {
      fullMatch,
      formula: formula.trim(),
      isDisplayMode,
    };

    // Only process unique formulas
    const formulaKey = `${isDisplayMode ? 'display' : 'inline'}:${formula.trim()}`;
    if (!processedFormulas.has(formulaKey)) {
      processedFormulas.set(formulaKey, formulaData);
      promises.push(renderWithMathJax(formulaData));
    }
  }

  // Process all formulas in parallel (with a reasonable batch size)
  const batchSize = 10;
  for (let i = 0; i < promises.length; i += batchSize) {
    const batch = promises.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch);
    replacements = [...replacements, ...batchResults];

    // Small delay between batches to avoid overwhelming the processor
    if (i + batchSize < promises.length) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }

  // Sort replacements by length (descending) to replace longest matches first
  // This prevents issues with nested or overlapping formulas
  replacements.sort((a, b) => b.original.length - a.original.length);

  // Apply all replacements to the markdown
  replacements.forEach(({ original, replacement }) => {
    result = result.replace(original, replacement);
  });

  return result;
}

/**
 * Renders a LaTeX formula using MathJax
 * @param {Object} formulaData - Contains the formula and context
 * @returns {Promise<Object>} - Original text and its HTML replacement
 */
async function renderWithMathJax(formulaData) {
  const { fullMatch, formula, isDisplayMode } = formulaData;

  try {
    // Clean and prepare the formula
    let cleanedFormula = prepareFormula(formula);

    // Additional check for display mode to ensure no $ signs remain
    if (isDisplayMode) {
      // Ensure no $ signs are left in display mode
      cleanedFormula = cleanedFormula.replace(/^\$|\$$/, '');
    }

    const typesetOptions = {
      math: cleanedFormula,
      format: 'TeX',
      svg: true,
      ex: 6,
      width: isDisplayMode ? 100 : 80,
      linebreaks: isDisplayMode,
      display: isDisplayMode,
    };

    // Use MathJax to typeset the formula
    const result = await mathjax.typeset(typesetOptions);

    if (result.errors) {
      throw new Error(`MathJax rendering error: ${result.errors.join(', ')}`);
    }

    // Create a container for the rendered formula
    const svgHtml = result.svg;

    // Wrap the formula in a div with proper styling
    const container = isDisplayMode
      ? `<div class="math-display">${svgHtml}</div>`
      : `<span class="math-inline">${svgHtml}</span>`;

    return {
      original: fullMatch,
      replacement: container,
    };
  } catch (error) {
    console.error(`Error rendering formula "${formula}":`, error.message);

    // Return the original formula if rendering fails
    return {
      original: fullMatch,
      replacement: fullMatch,
    };
  }
}

/**
 * Prepare a formula for rendering by fixing common issues
 * @param {string} formula - Raw LaTeX formula
 * @returns {string} - Cleaned formula
 */
function prepareFormula(formula) {
  let cleaned = formula.trim();

  // Instead of using regex, which might leave some $ signs,
  // check explicitly for $ signs at beginning and end
  if (cleaned.startsWith('$')) {
    cleaned = cleaned.substring(1);
  }
  if (cleaned.endsWith('$')) {
    cleaned = cleaned.substring(0, cleaned.length - 1);
  }

  // Fix common encoding issues
  cleaned = cleaned
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\\text{([^}]*)}/g, '\\text{$1}');

  // Handle some common problematic patterns
  cleaned = cleaned
    .replace(/\\begin{align}/g, '\\begin{aligned}')
    .replace(/\\end{align}/g, '\\end{aligned}')
    .replace(/\\begin{eqnarray}/g, '\\begin{aligned}')
    .replace(/\\end{eqnarray}/g, '\\end{aligned}');

  return cleaned;
}

/**
 * Generates a CSS stylesheet for MathJax output
 * @returns {string} - CSS styles for MathJax output
 */
export function generateMathJaxCSS() {
  return `
  `;
}

/**
 * Modifies the markdown file to include MathJax CSS and scripts
 * @param {string} markdownContent - The processed markdown content
 * @returns {string} - Markdown with MathJax scripts and CSS included
 */
export function addMathJaxHeadersToMarkdown(markdownContent) {
  const mathjaxCss = generateMathJaxCSS();

  // Add the MathJax CSS to the markdown
  const cssSection = `<style>
${mathjaxCss}
</style>`;

  return cssSection + '\n\n' + markdownContent;
}

/**
 * Full process to convert markdown with LaTeX to markdown with MathJax
 * @param {string} inputMarkdown - Input markdown with LaTeX
 * @returns {Promise<string>} - Processed markdown with MathJax
 */
export async function convertLatexToMathJax(inputMarkdown) {
  try {
    // Process LaTeX to MathJax HTML
    const processedMarkdown = await processLatexWithMathJax(inputMarkdown);

    // Add MathJax styles to the document
    const finalMarkdown = addMathJaxHeadersToMarkdown(processedMarkdown);

    return finalMarkdown;
  } catch (error) {
    console.error('Error converting LaTeX to MathJax:', error);
    // Return original if processing fails
    return inputMarkdown;
  }
}
