import puppeteer from 'puppeteer';
import handlebars from 'handlebars';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Utility for generating PDFs from HTML templates using Puppeteer and Handlebars.
 */
class PDFUtil {
  constructor() {
    // Register common helpers
    handlebars.registerHelper('eq', (a, b) => a === b);
    handlebars.registerHelper('ifCond', function (v1, operator, v2, options) {
      switch (operator) {
        case '==': return (v1 == v2) ? options.fn(this) : options.inverse(this);
        case '===': return (v1 === v2) ? options.fn(this) : options.inverse(this);
        case '!=': return (v1 != v2) ? options.fn(this) : options.inverse(this);
        case '!==': return (v1 !== v2) ? options.fn(this) : options.inverse(this);
        case '<': return (v1 < v2) ? options.fn(this) : options.inverse(this);
        case '<=': return (v1 <= v2) ? options.fn(this) : options.inverse(this);
        case '>': return (v1 > v2) ? options.fn(this) : options.inverse(this);
        case '>=': return (v1 >= v2) ? options.fn(this) : options.inverse(this);
        case '&&': return (v1 && v2) ? options.fn(this) : options.inverse(this);
        case '||': return (v1 || v2) ? options.fn(this) : options.inverse(this);
        default: return options.inverse(this);
      }
    });
  }

  async generatePDF(templateName, data, margins = {}) {
    try {
      const templatePath = path.join(__dirname, '..', 'templates', `${templateName}.html`);
      const templateContent = await fs.readFile(templatePath, 'utf-8');

      const template = handlebars.compile(templateContent);
      const html = template(data);

      const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });

      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });

      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
          top:    margins.top    || '10mm',
          right:  margins.right  || '10mm',
          bottom: margins.bottom || '10mm',
          left:   margins.left   || '10mm',
        }
      });

      await browser.close();
      return pdfBuffer;
    } catch (err) {
      console.error("PDF generation utility error:", err);
      throw err;
    }
  }
}

export default new PDFUtil();
