import { Injectable } from '@angular/core';
import JSZip from 'jszip';

// Declare pdfjsLib from the global scope, loaded via script tag in index.html
declare var pdfjsLib: any;

@Injectable({ providedIn: 'root' })
export class DocumentProcessorService {

  constructor() {
    // Configure the worker for pdf.js. This is required for it to run in the browser.
    if (typeof pdfjsLib !== 'undefined') {
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.5.136/pdf.worker.min.mjs`;
    }
  }

  /**
   * Processes an uploaded file (PDF or PPTX) and returns its text content.
   * @param file The file to process.
   * @returns A promise that resolves with the extracted text content as a string.
   */
  async processFile(file: File): Promise<string> {
    if (file.type === 'application/pdf') {
      return this.processPdf(file);
    } else if (file.type === 'application/vnd.openxmlformats-officedocument.presentationml.presentation') {
      return this.processPptx(file);
    } else {
      throw new Error('Unsupported file type. Please upload a PDF or PPTX file.');
    }
  }

  /**
   * Extracts text content from a PDF file.
   * @param file The PDF file.
   * @returns A promise resolving to the full text content.
   */
  private async processPdf(file: File): Promise<string> {
    if (typeof pdfjsLib === 'undefined') {
      throw new Error('PDF processing library is not loaded.');
    }
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
    let fullText = '';
    
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item: any) => item.str).join(' ');
      fullText += pageText + '\n\n';
    }
    
    return fullText.trim();
  }

  /**
   * Extracts text content from a .pptx file.
   * It works by unzipping the file and parsing the XML of each slide.
   * @param file The PPTX file.
   * @returns A promise resolving to the full text content.
   */
  private async processPptx(file: File): Promise<string> {
    const zip = await JSZip.loadAsync(file);
    const slidePromises: Promise<string>[] = [];
    
    // Find all slide XML files within the PPTX zip structure.
    zip.folder('ppt/slides')?.forEach((relativePath, zipEntry) => {
      if (relativePath.startsWith('slide') && relativePath.endsWith('.xml')) {
        slidePromises.push(zipEntry.async('string'));
      }
    });

    const slideXmls = await Promise.all(slidePromises);
    let fullText = '';
    
    const parser = new DOMParser();
    for (const xmlString of slideXmls) {
      const xmlDoc = parser.parseFromString(xmlString, "application/xml");
      // Text in PPTX slides is contained within <a:t> tags.
      const textNodes = xmlDoc.querySelectorAll('a\\:t'); // The namespace 'a' must be escaped.
      let slideText = '';
      textNodes.forEach(node => {
        slideText += (node.textContent || '') + ' ';
      });
      fullText += slideText.trim() + '\n\n';
    }
    
    return fullText.trim();
  }
}
