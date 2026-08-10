// utils/markdown-to-pdf.util.js
// Pure-JS Markdown → PDF conversion using marked + pdfmake + html-to-pdfmake
// No Puppeteer, no Chromium, no native binaries — compatible with Vercel serverless

import { marked } from 'marked';
import pdfMake from 'pdfmake/build/pdfmake.js';
import pdfFonts from 'pdfmake/build/vfs_fonts.js';
import htmlToPdfmake from 'html-to-pdfmake';
import { JSDOM } from 'jsdom';

// The browser build of pdfmake does not register its embedded fonts in Node.
// Register them explicitly before generating documents.
pdfMake.addVirtualFileSystem(pdfFonts);

/**
 * Converts a Markdown string to a PDF Buffer.
 * @param {string} markdownContent - The markdown string to convert
 * @returns {Promise<Buffer>} - PDF file as a Node.js Buffer
 */
export async function convertMarkdownToPdf(markdownContent) {
  try {
    // Step 1: Convert Markdown → HTML using marked
    const htmlContent = await marked.parse(markdownContent, {
      async: false,
      gfm: true,        // GitHub Flavored Markdown
      breaks: true,     // Convert \n to <br>
    });

    // Step 2: Wrap in full HTML document with inline styles
    const fullHtml = `
      <html>
        <body style="font-size: 11pt; color: #111; line-height: 1.6;">
          ${htmlContent}
        </body>
      </html>
    `;

    // Step 3: Parse HTML into a DOM for html-to-pdfmake (needs window/document)
    const { window } = new JSDOM(fullHtml);
    const document = window.document;

    // Step 4: Convert HTML DOM → pdfmake document definition
    const pdfContent = htmlToPdfmake(fullHtml, {
      window: window,
    });

    // Step 5: Build pdfmake document definition
    const docDefinition = {
      content: pdfContent,
      defaultStyle: {
        font: 'Roboto',
        fontSize: 11,
        lineHeight: 1.4,
      },
      styles: {
        'html-h1': { fontSize: 22, bold: true, margin: [0, 10, 0, 6] },
        'html-h2': { fontSize: 18, bold: true, margin: [0, 8, 0, 4] },
        'html-h3': { fontSize: 15, bold: true, margin: [0, 6, 0, 3] },
        'html-h4': { fontSize: 13, bold: true, margin: [0, 4, 0, 2] },
        'html-p': { margin: [0, 2, 0, 8] },
        'html-ul': { margin: [0, 0, 0, 8] },
        'html-ol': { margin: [0, 0, 0, 8] },
        'html-li': { margin: [0, 2, 0, 2] },
        'html-strong': { bold: true },
        'html-em': { italics: true },
        'html-code': {
          fontSize: 10,
          background: '#f5f5f5',
          color: '#333',
        },
        'html-pre': {
          fontSize: 10,
          background: '#f5f5f5',
          margin: [0, 4, 0, 8],
          preserveLeadingSpaces: true,
        },
        'html-table': { margin: [0, 4, 0, 8] },
        'html-th': { bold: true, fillColor: '#f0f0f0' },
        'html-blockquote': {
          italics: true,
          color: '#555',
          margin: [10, 4, 0, 8],
        },
        'html-hr': { margin: [0, 8, 0, 8] },
      },
      pageMargins: [40, 50, 40, 50],
      pageSize: 'A4',
    };

    // Step 6: Generate PDF as Buffer using pdfmake
    return new Promise((resolve, reject) => {
      try {
        const pdfDoc = pdfMake.createPdf(docDefinition);
        pdfDoc.getBuffer((buffer) => {
          if (buffer) {
            resolve(Buffer.from(buffer));
          } else {
            reject(new Error('pdfmake returned empty buffer'));
          }
        });
      } catch (err) {
        reject(err);
      }
    });
  } catch (error) {
    console.error('[markdown-to-pdf] Conversion error:', error);
    throw error;
  }
}
