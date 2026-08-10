// utils/markdown-cleanup.util.js

/**
 * Lightweight markdown cleanup utility for fixing common formatting issues
 * Specifically designed to handle malformed headers and random # symbols
 */

/**
 * Cleans up malformed markdown content
 * @param {string} markdown - Raw markdown content
 * @returns {string} - Cleaned markdown content
 */
export function cleanupMarkdown(markdown) {
  if (!markdown || typeof markdown !== 'string') {
    return markdown;
  }

  let cleaned = markdown;
  
  // 1. Fix empty headers (## followed by whitespace or newline)
  cleaned = cleaned.replace(/^#{1,6}\s*$/gm, '');
  
  // 2. Fix standalone # symbols in the middle of content (not at line start)
  cleaned = cleaned.replace(/(?<=[a-zA-Z0-9])\s+#{1,6}\s+(?=[a-zA-Z0-9])/g, ' ');
  
  // 3. Remove lines that are just random # symbols (less than 3 chars and only #)
  cleaned = cleaned.replace(/^#{1,6}$/gm, '');
  
  // 4. Fix broken headers - merge header symbols with content on next line
  cleaned = cleaned.replace(/^(#{1,6})\s*\n(?!#|\n)([^\n]+)/gm, '$1 $2');
  
  // 5. Remove multiple consecutive empty lines (more than 2)
  cleaned = cleaned.replace(/\n{4,}/g, '\n\n\n');
  
  // 6. Fix list items that are just dashes
  cleaned = cleaned.replace(/^-\s*$/gm, '');
  
  // 7. Clean up any remaining problematic # patterns
  // Remove # that appear after periods in sentences (common AI generation issue)
  cleaned = cleaned.replace(/\.\s*#{1,6}\s*(?=[A-Z])/g, '. ');
  
  // 8. Fix mathematical expressions that got broken
  // Protect LaTeX formulas from being treated as headers
  cleaned = cleaned.replace(/^#{1,6}(?=\s*\$)/gm, '');
  
  return cleaned.trim();
}

/**
 * Validates markdown and returns basic metrics
 * @param {string} markdown - Markdown content to validate
 * @returns {Object} - Validation results with basic metrics
 */
export function validateMarkdown(markdown) {
  if (!markdown) {
    return { isValid: false, issues: ['Empty content'], metrics: null };
  }

  const lines = markdown.split('\n');
  const issues = [];
  let headerCount = 0;
  let emptyHeaderCount = 0;

  lines.forEach((line, index) => {
    // Count headers
    if (/^#{1,6}\s/.test(line)) {
      headerCount++;
    }
    
    // Check for empty headers
    if (/^#{1,6}\s*$/.test(line)) {
      emptyHeaderCount++;
      issues.push(`Line ${index + 1}: Empty header`);
    }
    
    // Check for suspicious # patterns
    if (/(?<=[a-zA-Z])\s*#{1,6}\s*(?=[a-zA-Z])/.test(line)) {
      issues.push(`Line ${index + 1}: Suspicious # symbols in content`);
    }
  });

  return {
    isValid: issues.length === 0,
    issues: issues,
    metrics: {
      totalLines: lines.length,
      headerCount: headerCount,
      emptyHeaderCount: emptyHeaderCount,
      issueCount: issues.length
    }
  };
}