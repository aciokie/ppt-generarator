import { Injectable, signal, computed, inject } from '@angular/core';
import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { Presentation, Slide, SlideLayout, Theme, Source, ChartData } from '../types';
import { THEME_PRESETS } from '../themes/presets';
import { AiEvolutionService } from './ai-evolution.service';

export type PresentationStreamEvent =
  | { type: 'title'; title: string }
  | { type: 'slide'; index: number; data: Slide }
  | { type: 'sources'; sources: Source[] };


@Injectable({ providedIn: 'root' })
export class GeminiService {
  private ai: GoogleGenAI | null = null;
  public error = signal<string | null>(null);
  
  private activeGenerations = signal(0);
  public readonly isGenerating = computed(() => this.activeGenerations() > 0);
  
  private aiEvolutionService = inject(AiEvolutionService);

  // --- START: Image Generation Queue for Rate Limiting ---
  private imageRequestQueue: Array<{
    task: () => Promise<string | null>,
    resolve: (value: string | null) => void,
    reject: (reason?: any) => void
  }> = [];
  private isProcessingImageServiceQueue = false;
  // --- END: Image Generation Queue ---

  constructor() {
    try {
      if (!process.env.API_KEY) {
        throw new Error("API_KEY environment variable not found.");
      }
      this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    } catch(e) {
      const err = e as Error;
      console.error("Failed to initialize GoogleGenAI:", err.message);
      this.error.set(`Failed to initialize AI Service. Please ensure the API key is configured correctly. Details: ${err.message}`);
    }
  }

  private slideSchema = {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING },
      content: { type: Type.ARRAY, items: { type: Type.STRING } },
      imagePrompt: { type: Type.STRING },
      layout: { type: Type.STRING, enum: ['title', 'content_left', 'content_right', 'section_header', 'conclusion', 'two_column', 'three_column', 'quote', 'image_full_bleed', 'table', 'chart_bar', 'chart_line', 'chart_pie', 'chart_doughnut', 'timeline', 'process', 'stats_highlight', 'pyramid', 'funnel', 'swot'] },
      speakerNotes: { type: Type.ARRAY, items: { type: Type.STRING } },
      tableData: {
          type: Type.ARRAY,
          items: { type: Type.ARRAY, items: { type: Type.STRING } },
          description: "For 'table' layout only. A 2D array of strings representing table rows and cells. The first inner array is the header."
      },
      chartData: {
          type: Type.OBJECT,
          properties: {
              labels: { type: Type.ARRAY, items: { type: Type.STRING } },
              datasets: {
                  type: Type.ARRAY,
                  items: {
                      type: Type.OBJECT,
                      properties: {
                          label: { type: Type.STRING },
                          data: { type: Type.ARRAY, items: { type: Type.NUMBER } }
                      },
                      required: ['label', 'data']
                  }
              }
          },
          required: ['labels', 'datasets'],
          description: "For 'chart_*' layouts. Defines the data for a chart."
      }
    },
    required: ['title', 'content', 'imagePrompt', 'layout']
  };
  
  private themeSchema = {
    type: Type.OBJECT,
    properties: {
      name: { type: Type.STRING, description: "A creative name for the theme." },
      category: { type: Type.STRING, description: "A general category like 'Corporate', 'Creative', or 'Minimal'." },
      primaryColor: { type: Type.STRING, description: "A hex color code for primary elements like headers (e.g., '#8b5cf6')." },
      backgroundColor: { type: Type.STRING, description: "A hex color code for the slide background (e.g., '#111827')." },
      textColor: { type: Type.STRING, description: "A hex color code for the main body text (e.g., '#d1d5db')." },
      titleFont: { type: Type.STRING, enum: ['Inter', 'Lato', 'Lora', 'Merriweather', 'Montserrat', 'Open Sans', 'Orbitron', 'Oswald', 'Playfair Display', 'Poppins', 'Raleway', 'Roboto', 'Roboto Slab', 'Source Code Pro', 'Turret Road'], description: "The font for slide titles." },
      bodyFont: { type: Type.STRING, enum: ['Inter', 'Lato', 'Lora', 'Merriweather', 'Montserrat', 'Open Sans', 'Orbitron', 'Oswald', 'Playfair Display', 'Poppins', 'Raleway', 'Roboto', 'Roboto Slab', 'Source Code Pro', 'Turret Road'], description: "The font for body text." },
    },
    required: ['name', 'category', 'primaryColor', 'backgroundColor', 'textColor', 'titleFont', 'bodyFont']
  };

  private stripMarkdown(text: string): string {
    if (typeof text !== 'string') return text;
    // Basic markdown removal: **, *, ##, ###, links, etc.
    return text
        .replace(/(\*\*|__)(.*?)\1/g, '$2') // bold
        .replace(/(\*|_)(.*?)\1/g, '$2')   // italic
        .replace(/!\[(.*?)\]\(.*?\)/g, '$1') // images
        .replace(/\[(.*?)\]\(.*?\)/g, '$1') // links
        .replace(/`{1,3}(.*?)`{1,3}/g, '$1') // code
        .replace(/^(#{1,6}\s*)/g, '') // headers at start of string
        .trim();
  }
  
  private processAndStripMarkdown<T>(obj: T): T {
      if (obj === null || typeof obj !== 'object') {
          return obj;
      }
  
      if (Array.isArray(obj)) {
          return obj.map(item => this.processAndStripMarkdown(item)) as any as T;
      }
  
      const newObj: { [key: string]: any } = {};
      for (const key in obj) {
          if (Object.prototype.hasOwnProperty.call(obj, key)) {
              const value = (obj as any)[key];
              if (typeof value === 'string') {
                  newObj[key] = this.stripMarkdown(value);
              } else {
                  newObj[key] = this.processAndStripMarkdown(value);
              }
          }
      }
      return newObj as T;
  }

  async *generatePresentationLive(
    topic: string,
    slideCount: number,
    audience: string,
    language: 'English' | 'Tagalog',
    useGoogleSearch: boolean,
    highQuality: boolean
  ): AsyncGenerator<PresentationStreamEvent, void, unknown> {
    if (!this.ai) {
      this.error.set("AI Service is not initialized.");
      return;
    }

    this.activeGenerations.update(c => c + 1);
    this.error.set(null);
    
    // FIX: Added `await` because `getCorePrompt` is an async function that returns a Promise.
    let prompt = await this.aiEvolutionService.getCorePrompt();

    prompt = prompt
      .replace('{language}', language)
      .replace('{useGoogleSearch}', useGoogleSearch ? '\n**Grounding:** Use Google Search to find factual, up-to-date information for your content.' : '')
      .replace('{highQuality}', highQuality ? `\n**Quality Level:** You are to produce your absolute best work. The content should be exceptionally insightful, the image prompts must be worthy of a professional art director, and the narrative flow must be flawless. Go above and beyond.` : '')
      .replace(/{topic}/g, topic)
      .replace(/{audience}/g, audience || 'a general audience')
      .replace(/{slideCount}/g, slideCount.toString());
    
    const config: any = {};
    if (useGoogleSearch) {
        config.tools = [{ googleSearch: {} }];
    }

    try {
      const result = await this.ai.models.generateContentStream({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: config
      });

      let buffer = '';
      let slideIndex = 0;
      let currentSlide: Partial<Slide> & { contentList?: string[], notesList?: string[] } = {};
      const groundingChunks: any[] = [];
      
      const processLine = (line: string): PresentationStreamEvent | null => {
          if (line.startsWith('PRES_TITLE:')) {
            const title = this.stripMarkdown(line.substring('PRES_TITLE:'.length).trim());
            return { type: 'title', title };
          } else if (line === 'SLIDE_START') {
            currentSlide = { contentList: [], notesList: [] };
          } else if (line.startsWith('LAYOUT:')) {
            currentSlide.layout = this.stripMarkdown(line.substring('LAYOUT:'.length).trim()) as SlideLayout;
          } else if (line.startsWith('TITLE:')) {
            currentSlide.title = this.stripMarkdown(line.substring('TITLE:'.length).trim());
          } else if (line.startsWith('CONTENT:')) {
            currentSlide.contentList?.push(this.stripMarkdown(line.substring('CONTENT:'.length).trim()));
          } else if (line.startsWith('IMAGE_PROMPT:')) {
            currentSlide.imagePrompt = this.stripMarkdown(line.substring('IMAGE_PROMPT:'.length).trim());
          } else if (line.startsWith('NOTES:')) {
            currentSlide.notesList?.push(this.stripMarkdown(line.substring('NOTES:'.length).trim()));
          } else if (line.startsWith('TABLE_DATA:')) {
            try {
              const jsonString = line.substring('TABLE_DATA:'.length).trim();
              currentSlide.tableData = JSON.parse(jsonString);
            } catch (e) {
              console.error('Failed to parse TABLE_DATA JSON:', e, line);
            }
          } else if (line.startsWith('CHART_DATA:')) {
            try {
              let jsonString = line.substring('CHART_DATA:'.length).trim();
              
              // Attempt to fix common JSON errors from AI generation
              jsonString = jsonString.replace(/("data"\s*:\s*)}/g, '$1[]}');
              jsonString = jsonString.replace(/\[\s*,/g, '[');
              jsonString = jsonString.replace(/,\s*\]/g, ']');
              while(/,\s*,/.test(jsonString)) {
                jsonString = jsonString.replace(/,\s*,/g, ',');
              }

              let chartData: ChartData = JSON.parse(jsonString);

              if (chartData?.labels?.length > 0 && chartData.datasets) {
                const labelCount = chartData.labels.length;
                chartData.datasets.forEach(dataset => {
                  if (!dataset.data || dataset.data.length === 0 || dataset.data.length !== labelCount) {
                    console.warn(
                      'AI generated invalid chart data (empty or mismatched length). Fixing it programmatically.',
                      JSON.stringify(dataset)
                    );
                    dataset.data = Array.from({ length: labelCount }, () => Math.floor(Math.random() * 900) + 100);
                  }
                });
              }
              currentSlide.chartData = chartData;
            } catch (e) {
              console.error("CHART_DATA:", "Failed to parse CHART_DATA JSON:", e, line);
            }
          } else if (line === 'SLIDE_END') {
            if (Object.keys(currentSlide).length > 0) {
              const finalSlide: Slide = {
                title: currentSlide.title || 'Untitled',
                content: currentSlide.contentList || [],
                imagePrompt: currentSlide.imagePrompt || '',
                layout: currentSlide.layout || 'content_left',
                speakerNotes: currentSlide.notesList || [],
                tableData: currentSlide.tableData,
                chartData: currentSlide.chartData,
                rating: null
              };
              const event: PresentationStreamEvent = { type: 'slide', index: slideIndex, data: finalSlide };
              slideIndex++;
              return event;
            }
          }
          return null;
      }
      
      for await (const chunk of result) {
        if (useGoogleSearch && chunk.candidates?.[0]?.groundingMetadata?.groundingChunks) {
            groundingChunks.push(...chunk.candidates[0].groundingMetadata.groundingChunks);
        }

        buffer += chunk.text;
        
        let lineEndIndex;
        while ((lineEndIndex = buffer.indexOf('\n')) >= 0) {
          const line = buffer.substring(0, lineEndIndex).trim();
          buffer = buffer.substring(lineEndIndex + 1);
          const event = processLine(line);
          if (event) {
            yield event;
          }
        }
      }
      
      if (buffer.trim()) {
        const event = processLine(buffer.trim());
        if (event) {
            yield event;
        }
      }

      if (useGoogleSearch && groundingChunks.length > 0) {
        const uniqueSources: Source[] = Array.from(new Map<string, Source>(
          (groundingChunks || [])
            .filter((item: any): item is { web: Source } => item && item.web && item.web.uri && item.web.title)
            .map((item) => [item.web.uri, item.web])
        ).values());

        if (uniqueSources.length > 0) {
          yield { type: 'sources', sources: uniqueSources };
        }
      }

    } catch (e) {
      const err = e as Error;
      console.error('Error generating presentation:', err);
      this.error.set(`An error occurred during generation: ${err.message}`);
    } finally {
      this.activeGenerations.update(c => c - 1);
    }
  }

  async *generatePresentationFromDocument(
    documentText: string,
    slideCount: number,
    language: 'English' | 'Tagalog',
    originalTopic: string
  ): AsyncGenerator<PresentationStreamEvent, void, unknown> {
    if (!this.ai) {
      this.error.set("AI Service is not initialized.");
      return;
    }

    this.activeGenerations.update(c => c + 1);
    this.error.set(null);

    // FIX: Added `await` because `getCorePrompt` is an async function that returns a Promise.
    let prompt = await this.aiEvolutionService.getCorePrompt();

    const documentContext = `
**Source of Truth:**
Your entire presentation MUST be based exclusively on the information provided within the following document context. The 'Topic' below should be interpreted as the title or subject of this document.
---
**DOCUMENT CONTEXT**
${documentText}
---
`;

    // Replace placeholders in the core prompt
    prompt = prompt
      .replace('{language}', language)
      .replace('**Presentation Details:**', `${documentContext}\n\n**Presentation Details:**`)
      .replace(/{topic}/g, originalTopic)
      .replace(/{audience}/g, 'a general audience for this document')
      .replace(/{slideCount}/g, slideCount.toString())
      .replace('{useGoogleSearch}', '')
      .replace('{highQuality}', '');
    
    try {
      const result = await this.ai.models.generateContentStream({
        model: 'gemini-2.5-flash',
        contents: prompt
      });

      let buffer = '';
      let slideIndex = 0;
      let currentSlide: Partial<Slide> & { contentList?: string[], notesList?: string[] } = {};
      
      const processLine = (line: string): PresentationStreamEvent | null => {
          if (line.startsWith('PRES_TITLE:')) {
            const title = this.stripMarkdown(line.substring('PRES_TITLE:'.length).trim());
            return { type: 'title', title };
          } else if (line === 'SLIDE_START') {
            currentSlide = { contentList: [], notesList: [] };
          } else if (line.startsWith('LAYOUT:')) {
            currentSlide.layout = this.stripMarkdown(line.substring('LAYOUT:'.length).trim()) as SlideLayout;
          } else if (line.startsWith('TITLE:')) {
            currentSlide.title = this.stripMarkdown(line.substring('TITLE:'.length).trim());
          } else if (line.startsWith('CONTENT:')) {
            currentSlide.contentList?.push(this.stripMarkdown(line.substring('CONTENT:'.length).trim()));
          } else if (line.startsWith('IMAGE_PROMPT:')) {
            currentSlide.imagePrompt = this.stripMarkdown(line.substring('IMAGE_PROMPT:'.length).trim());
          } else if (line.startsWith('NOTES:')) {
            currentSlide.notesList?.push(this.stripMarkdown(line.substring('NOTES:'.length).trim()));
          } else if (line.startsWith('TABLE_DATA:')) {
            try {
              const jsonString = line.substring('TABLE_DATA:'.length).trim();
              currentSlide.tableData = JSON.parse(jsonString);
            } catch (e) {
              console.error('Failed to parse TABLE_DATA JSON:', e, line);
            }
          } else if (line.startsWith('CHART_DATA:')) {
            try {
              let jsonString = line.substring('CHART_DATA:'.length).trim();
              
              jsonString = jsonString.replace(/("data"\s*:\s*)}/g, '$1[]')
              jsonString = jsonString.replace(/\[\s*,/g, '[');
              jsonString = jsonString.replace(/,\s*\]/g, ']');
              while(/,\s*,/.test(jsonString)) {
                jsonString = jsonString.replace(/,\s*,/g, ',');
              }

              let chartData: ChartData = JSON.parse(jsonString);
              if (chartData?.labels?.length > 0 && chartData.datasets) {
                const labelCount = chartData.labels.length;
                chartData.datasets.forEach(dataset => {
                  if (!dataset.data || dataset.data.length === 0 || dataset.data.length !== labelCount) {
                     console.warn(
                      'AI generated invalid chart data from document (empty or mismatched length). Fixing it programmatically.',
                      JSON.stringify(dataset)
                    );
                    dataset.data = Array.from({ length: labelCount }, () => Math.floor(Math.random() * 900) + 100);
                  }
                });
              }
              currentSlide.chartData = chartData;
            } catch (e) {
              console.error("CHART_DATA:", "Failed to parse CHART_DATA JSON:", e, line);
            }
          } else if (line === 'SLIDE_END') {
            if (Object.keys(currentSlide).length > 0) {
              const finalSlide: Slide = {
                title: currentSlide.title || 'Untitled',
                content: currentSlide.contentList || [],
                imagePrompt: currentSlide.imagePrompt || '',
                layout: currentSlide.layout || 'content_left',
                speakerNotes: currentSlide.notesList || [],
                tableData: currentSlide.tableData,
                chartData: currentSlide.chartData,
                rating: null
              };
              const event: PresentationStreamEvent = { type: 'slide', index: slideIndex, data: finalSlide };
              slideIndex++;
              return event;
            }
          }
          return null;
      }
      
      for await (const chunk of result) {
        buffer += chunk.text;
        let lineEndIndex;

        while ((lineEndIndex = buffer.indexOf('\n')) >= 0) {
          const line = buffer.substring(0, lineEndIndex).trim();
          buffer = buffer.substring(lineEndIndex + 1);
          const event = processLine(line);
          if (event) {
            yield event;
          }
        }
      }
      
      if (buffer.trim()) {
        const event = processLine(buffer.trim());
        if (event) {
            yield event;
        }
      }

    } catch (e) {
      const err = e as Error;
      console.error('Error generating presentation from document:', err);
      this.error.set(`An error occurred during generation: ${err.message}`);
    } finally {
      this.activeGenerations.update(c => c - 1);
    }
  }

  private async _processImageServiceQueue(): Promise<void> {
    if (this.isProcessingImageServiceQueue || this.imageRequestQueue.length === 0) {
        return;
    }
    this.isProcessingImageServiceQueue = true;

    const { task, resolve, reject } = this.imageRequestQueue.shift()!;
    
    try {
        const result = await task();
        resolve(result);
    } catch (e) {
        reject(e);
    } finally {
        // Wait AFTER each task to respect rate limits before starting the next.
        // 5 RPM for Imagen means one request every 12 seconds. 15s is safer.
        if (this.imageRequestQueue.length > 0) {
             await new Promise(res => setTimeout(res, 15000));
        }
        this.isProcessingImageServiceQueue = false;
        // Process next item in the queue
        this._processImageServiceQueue();
    }
  }

  generateImageFromPrompt(prompt: string, imageStyle: string, aspectRatio: string): Promise<string | null> {
    return new Promise((resolve, reject) => {
        // The task is the actual API call logic, which will be executed by the queue processor.
        const task = () => this._performImageGeneration(prompt, imageStyle, aspectRatio);
        this.imageRequestQueue.push({ task, resolve, reject });
        this._processImageServiceQueue();
    });
  }

  private async _performImageGeneration(prompt: string, imageStyle: string, aspectRatio: string): Promise<string | null> {
    if (!this.ai) {
      this.error.set("AI Service is not initialized.");
      return null;
    }
    
    this.activeGenerations.update(c => c + 1);
    this.error.set(null);

    const maxRetries = 3;
    let attempt = 0;
    // Increased initial delay and added jitter to avoid thundering herd on retries.
    let delay = 5000 + Math.random() * 1000;

    try {
      while (attempt < maxRetries) {
        try {
          const response = await this.ai.models.generateImages({
            model: 'imagen-3.0-generate-002',
            prompt: `Create a visually stunning, high-quality image for a presentation slide. Style: ${imageStyle}, professional. Prompt: ${prompt}. IMPORTANT: The image must not contain any words, text, or letters.`,
            config: {
              numberOfImages: 1,
              outputMimeType: 'image/jpeg',
              aspectRatio: aspectRatio,
            },
          });
          
          if (response.generatedImages && response.generatedImages.length > 0) {
            const base64ImageBytes = response.generatedImages[0].image.imageBytes;
            return `data:image/jpeg;base64,${base64ImageBytes}`;
          }
          return null; // Successful call but no image
        } catch (e) {
          const err = e as any;
          const isRateLimitError = err?.error?.status === 'RESOURCE_EXHAUSTED';

          if (isRateLimitError && attempt < maxRetries - 1) {
              console.warn(`Rate limit hit on attempt ${attempt + 1}. Retrying in ${delay / 1000}s...`);
              await new Promise(res => setTimeout(res, delay));
              delay *= 2; // Exponential backoff
              attempt++;
          } else {
              throw e; // Re-throw the error if it's not a rate limit error or if retries are exhausted
          }
        }
      }
    } catch (e) {
      const err = e as any;
      const message = err?.message || JSON.stringify(err);
      console.error('Error generating image:', err);
      this.error.set(`Failed to generate image: ${message}`);
      return null;
    } finally {
        this.activeGenerations.update(c => c - 1);
    }
    
    return null; // Should not be reached
  }

  async improveImagePrompt(title: string, content: string | string[], originalPrompt: string): Promise<string | null> {
    if (!this.ai) { return null; }
    this.activeGenerations.update(c => c + 1);
    this.error.set(null);
    const prompt = `You are a world-class creative director and prompt engineer for a photorealistic AI image generator. Your task is to take a user's basic prompt and radically enhance it to produce a unique, captivating, and professional image for a presentation slide.

    **Context:**
    - Slide Title: "${title}"
    - Slide Content: ${Array.isArray(content) ? content.map(c => `- ${c}`).join('\n') : content}

    **User's Original Prompt:**
    "${originalPrompt}"

    **CRITICAL Instructions:**
    1.  **Deep Analysis:** Don't just rephrase. Analyze the slide's title and content to understand the core message, the underlying theme, and the emotional tone (e.g., innovative, serious, optimistic). Your new prompt MUST reflect this deeper context.
    
    2.  **Artistic Style & Composition:** Elevate the prompt by defining a specific artistic direction.
        -   **Inject a Unique Style:** Suggest evocative styles. Consider: 'minimalist 3D render', 'abstract data visualization', 'vintage photo from the 1980s', 'double exposure photography', 'blueprint schematic', 'ethereal watercolor painting', 'detailed isometric scene', 'shot in the style of Annie Leibovitz'. Choose a style that *enhances* the slide's message.
        -   **Define the Shot:** Describe the scene with cinematic language. Specify camera angles ('low-angle shot', 'dutch angle', 'macro shot'), lighting ('soft morning light', 'dramatic rim lighting', 'neon glow'), and composition ('rule of thirds', 'dynamic and energetic', 'symmetrical balance').
    
    3.  **Add Rich Detail:** Weave in specific, descriptive keywords based on the slide's content to build a full, complex scene. Describe the environment, the mood, and the subject with precision.

    4.  **Strict Prohibitions:**
        -   **No Generic Styles:** Avoid simple terms like 'illustration' or 'vector' unless it's a specific, advanced style like 'minimalist line art illustration'. The primary goal is realism and sophistication.
        -   **Absolutely No Text:** The prompt MUST explicitly state that the final image should contain "no text, no words, no letters".

    5.  **Final Output:** Return ONLY the improved prompt as a single, raw string. Do not add any explanations, conversational text, or markdown formatting.

    **Example Transformation:**
    - Title: "The Core Technology"
    - Content: ["Utilizes quantum entanglement for data processing."]
    - Original Prompt: "a quantum computer"
    - **Your Improved Prompt Output:** "Cinematic, photorealistic shot of a glowing, intricate quantum computer core. Interconnected light trails pulse with energy inside a dark, clean-room environment. Dramatic, high-contrast lighting emphasizes the complex machinery. Focus on the central processing unit, shallow depth of field. No text, no words, no letters."

    Now, transform the user's prompt.`;

    try {
        const response = await this.ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
        return response.text.trim();
    } catch(e) {
        this.error.set(`Failed to improve image prompt: ${(e as Error).message}`);
        return null;
    } finally {
        this.activeGenerations.update(c => c - 1);
    }
  }

  async generateSpeakerNotes(slideTitle: string, slideContent: string | string[], language: 'English' | 'Tagalog'): Promise<string[] | null> {
    if (!this.ai) { return null; }
    this.activeGenerations.update(c => c + 1);
    this.error.set(null);
    const prompt = `You are an expert public speaker and speechwriter. Your task is to write a script for a speaker to deliver for a presentation slide. The tone should be conversational, engaging, and directly address the audience.

**Slide Details:**
- **Title:** "${slideTitle}"
- **Content:** ${Array.isArray(slideContent) ? slideContent.map(c => `- ${c}`).join('\n') : slideContent}

**CRITICAL INSTRUCTIONS for the script:**
Your goal is to create a script that a speaker can read verbatim. Do NOT write instructions for the speaker (e.g., "Explain the slide" or "Tell a story about..."). Instead, write the story itself from the speaker's point of view.

1.  **Direct Address:** Use "we", "you", "our". Make the audience feel included.
2.  **Elaborate on Content:** Go beyond the bullet points on the slide. Give them context, explain the "why," and tell the story behind the data.
3.  **Engage the Audience:** Weave in rhetorical questions, surprising facts, or relatable anecdotes directly into the script.
4.  **Include Delivery Cues:** Add subtle cues like '(Pause for effect)' to guide the speaker's pacing and make the delivery more natural.
5.  **Natural Flow:** Ensure the script flows like natural speech and provides a smooth transition to the next topic.

CRITICAL: Your entire response MUST be a single, raw JSON array of plain text strings, where each string is a paragraph of the speech. Do not include any conversational text or markdown formatting (like '''json). The strings in the array must also be plain text with no markdown.`;
    try {
        const response = await this.ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: { type: Type.ARRAY, items: { type: Type.STRING } },
            }
        });
        const notes = JSON.parse(response.text);
        return this.processAndStripMarkdown(notes);
    } catch(e) {
        this.error.set(`Failed to generate speaker notes: ${(e as Error).message}`);
        return null;
    } finally {
        this.activeGenerations.update(c => c - 1);
    }
  }

  async improveContent(textToImprove: string, mode: 'improve' | 'shorten' | 'lengthen', language: 'English' | 'Tagalog'): Promise<string | null> {
    if (!this.ai) { return null; }
    this.activeGenerations.update(c => c + 1);
    this.error.set(null);
    const prompt = `You are an expert writing assistant. Please ${mode} the following text for a presentation: "${textToImprove}".

CRITICAL: Return only the resulting plain text in ${language}. Do not include any markdown formatting, quotes, or conversational text.`;
    try {
        const response = await this.ai.models.generateContent({ 
            model: 'gemini-2.5-flash', 
            contents: prompt,
            config: { thinkingConfig: { thinkingBudget: 0 } }
        });
        return this.stripMarkdown(response.text);
    } catch(e) {
        this.error.set(`Failed to improve content: ${(e as Error).message}`);
        return null;
    } finally {
        this.activeGenerations.update(c => c - 1);
    }
  }

  async improveBulletPoints(slideTitle: string, points: string[], mode: 'improve' | 'shorten' | 'lengthen', language: 'English' | 'Tagalog'): Promise<string[] | null> {
    if (!this.ai) { return null; }
    this.activeGenerations.update(c => c + 1);
    this.error.set(null);
    
    let instruction = 'rewrite a list of bullet points for a slide to be more concise and impactful. Focus on using strong action verbs and removing filler words. Keep the core meaning of each point, but make them punchier and more professional.';
    if (mode === 'shorten') {
      instruction = 'shorten a list of bullet points for a slide. Make each point as concise as possible while retaining its core meaning.';
    } else if (mode === 'lengthen') {
      instruction = 'expand and lengthen a list of bullet points for a slide. Add more detail, examples, or context to each point to make them more comprehensive, while retaining the core meaning.';
    }

    const prompt = `You are an expert presentation writing assistant. Your task is to ${instruction}
    Ensure the number of bullet points in your output matches the number of points in the input.
    CRITICAL: The output MUST be in ${language}.

    Slide Title (for context): "${slideTitle}"
    
    Bullet points to process:
    ${JSON.stringify(points)}

    CRITICAL: Your entire response MUST be a single, raw JSON array of strings. Do not include any conversational text or markdown formatting (like '''json). The strings inside the array must also be plain text with no markdown.`;

    try {
        const response = await this.ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: { type: Type.ARRAY, items: { type: Type.STRING } },
                thinkingConfig: { thinkingBudget: 0 }
            }
        });
        const improvedPoints = JSON.parse(response.text) as string[];
        if (improvedPoints.length !== points.length) {
            console.warn('AI returned a different number of bullet points. Using original.');
            return points;
        }
        return this.processAndStripMarkdown(improvedPoints);
    } catch(e) {
        this.error.set(`Failed to improve bullet points: ${(e as Error).message}`);
        return null;
    } finally {
        this.activeGenerations.update(c => c - 1);
    }
  }

  async improveSpeakerNotes(slideTitle: string, notes: string[], mode: 'improve' | 'shorten' | 'lengthen', language: 'English' | 'Tagalog'): Promise<string[] | null> {
    if (!this.ai) { return null; }
    this.activeGenerations.update(c => c + 1);
    this.error.set(null);
    
    let instruction = `rewrite a speaker's script for a slide to be more engaging and impactful. Enhance the text by adding compelling details, rhetorical questions for the audience, or powerful statistics/anecdotes, speaking directly to the audience.`;
    if (mode === 'shorten') {
      instruction = `shorten a speaker's script for a slide. Make the points more concise and punchy while speaking directly to the audience.`;
    } else if (mode === 'lengthen') {
      instruction = `expand and lengthen a speaker's script for a slide. Elaborate on each point, provide deeper explanations, and add more supporting details or examples, all while speaking directly to the audience.`;
    }

    const prompt = `You are an expert public speaker and speechwriter. Your task is to ${instruction}
    The tone should be conversational, engaging, and directly address the audience.
    Maintain the same number of notes as the input.
    CRITICAL: The output MUST be in ${language}.

    Slide Title (for context): "${slideTitle}"
    
    Speaker notes to process:
    ${JSON.stringify(notes)}

    CRITICAL: Your entire response MUST be a single, raw JSON array of strings. Do not include any conversational text or markdown formatting (like '''json). The strings inside the array must also be plain text with no markdown.`;

    try {
        const response = await this.ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: { type: Type.ARRAY, items: { type: Type.STRING } },
            }
        });
        const improvedNotes = JSON.parse(response.text) as string[];
        if (improvedNotes.length !== notes.length) {
            console.warn('AI returned a different number of notes. Using original.');
            return notes;
        }
        return this.processAndStripMarkdown(improvedNotes);
    } catch(e) {
        this.error.set(`Failed to improve speaker notes: ${(e as Error).message}`);
        return null;
    } finally {
        this.activeGenerations.update(c => c - 1);
    }
  }

  async reorderSlides(presentation: Presentation): Promise<Slide[] | null> {
     if (!this.ai) { return null; }
    this.activeGenerations.update(c => c + 1);
    this.error.set(null);
    const simplifiedSlides = presentation.slides.map((s, i) => ({ index: i, title: s.title, content: Array.isArray(s.content) ? s.content[0] || '' : s.content }));
    const prompt = `Given the following presentation slides (represented by their original index, title, and first line of content), determine the most logical order for them.
    Original presentation title: "${presentation.title}"
    Slides: ${JSON.stringify(simplifiedSlides)}
    Return a JSON object with a single key "newOrder" which is an array of the original slide indexes in the new, most logical order. For example: {"newOrder": [2, 0, 1, 3]}.
    CRITICAL: Your entire response MUST be a single, raw JSON object. Do not include any conversational text or markdown formatting (like '''json).`;
    try {
        const response = await this.ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: { type: Type.OBJECT, properties: { newOrder: { type: Type.ARRAY, items: { type: Type.INTEGER } } } },
            }
        });
        const { newOrder } = JSON.parse(response.text) as { newOrder: number[] };
        const slideCount = presentation.slides.length;
        const isValid = newOrder &&
                        newOrder.length === slideCount &&
                        new Set(newOrder).size === slideCount &&
                        newOrder.every(i => i >= 0 && i < slideCount);

        if (!isValid) {
            throw new Error("AI returned an invalid or incomplete order for slides.");
        }
        return newOrder.map(i => presentation.slides[i]);
    } catch(e) {
        this.error.set(`Failed to reorder slides: ${(e as Error).message}`);
        return null;
    } finally {
        this.activeGenerations.update(c => c - 1);
    }
  }

  async generateSingleSlide(topic: string, presentation: Presentation): Promise<Slide | null> {
    if (!this.ai) { return null; }
    this.activeGenerations.update(c => c + 1);
    this.error.set(null);
    const context = `This is for a presentation titled "${presentation.title}". The slides generated so far are: ${presentation.slides.map(s => s.title).join(', ')}.`;
    const prompt = `You are a world-class presentation designer. Generate a single new presentation slide about "${topic}".
    CRITICAL: The entire content of the slide (title, content, speaker notes) MUST be in ${presentation.language}.
    ${context}
    The slide must fit logically with the existing content. 

    **Instructions:**
    1.  Provide a concise title, bullet points, a descriptive image prompt, and speaker notes.
    2.  As a world-class presentation designer, your layout choice is critical. Choose the **most appropriate layout** for this single slide based on its content: use 'content_left'/'right' for text with an image, 'two_column' or 'three_column' for dense lists, 'quote' for impactful statements, or 'section_header' if it introduces a new topic.
    3.  CRITICAL: Your entire response MUST be a single, raw JSON object for the slide, matching the schema. Do not include any conversational text or markdown formatting (like '''json). All string fields within the JSON must also be plain text with no markdown.`;

    try {
        const response = await this.ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: this.slideSchema,
            }
        });
        const slide = JSON.parse(response.text) as Slide;
        return this.processAndStripMarkdown(slide);
    } catch(e) {
        this.error.set(`Failed to generate slide: ${(e as Error).message}`);
        return null;
    } finally {
        this.activeGenerations.update(c => c - 1);
    }
  }

  async generateTheme(prompt: string): Promise<Theme | null> {
    if (!this.ai) { return null; }
    this.activeGenerations.update(c => c + 1);
    this.error.set(null);
    const fullPrompt = `Generate a presentation theme based on the following description: "${prompt}".
    The theme should include a name, category, and specific hex codes for primary, background, and text colors.
    It must also specify a title font and a body font from the provided list.
    Return a single valid JSON object matching the schema.
    CRITICAL: Your entire response MUST be a single, raw JSON object matching the schema. Do not include any conversational text or markdown formatting (like '''json).`;

    try {
        const response = await this.ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: fullPrompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: this.themeSchema,
            }
        });
        return JSON.parse(response.text) as Theme;
    } catch(e) {
        this.error.set(`Failed to generate theme: ${(e as Error).message}`);
        return null;
    } finally {
        this.activeGenerations.update(c => c - 1);
    }
  }

  async getEditedImagePrompt(originalPrompt: string, editInstruction: string): Promise<string | null> {
    if (!this.ai) { return null; }
    this.activeGenerations.update(c => c + 1);
    this.error.set(null);
    const prompt = `You are an expert AI image prompt editor. Your task is to take an existing prompt and a user's edit instruction, and generate a new, single, complete prompt that incorporates the change.

    **Original Prompt:**
    "${originalPrompt}"

    **User's Edit Instruction:**
    "${editInstruction}"

    **CRITICAL Instructions:**
    1.  **Synthesize, Don't Just Add:** Intelligently merge the user's instruction into the original prompt. For example, if the original prompt specified "daylight" and the user says "make it night", you must change the lighting descriptions throughout the prompt to reflect this.
    2.  **Maintain Core Subject:** Do not change the fundamental subject of the original prompt unless the user explicitly asks for it.
    3.  **Preserve Quality:** The new prompt must retain the high level of detail, artistic style, and cinematic language of the original.
    4.  **Strict Negative Prompt:** Ensure the new prompt still ends with the negative constraint: "No text, no words, no letters."
    5.  **Final Output:** Return ONLY the new, improved prompt as a single, raw string. Do not add any explanations, conversational text, or markdown formatting.
    
    Now, generate the new prompt.`;

    try {
        const response = await this.ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
        return response.text.trim();
    } catch(e) {
        this.error.set(`Failed to get edited image prompt: ${(e as Error).message}`);
        return null;
    } finally {
        this.activeGenerations.update(c => c - 1);
    }
  }

  async generateSlideContentFromImage(base64ImageData: string): Promise<{title: string, content: string[]} | null> {
    if (!this.ai) { return null; }
    this.activeGenerations.update(c => c + 1);
    this.error.set(null);
    
    try {
      const mimeType = base64ImageData.substring(5, base64ImageData.indexOf(';'));
      const data = base64ImageData.split(',')[1];
      const imagePart = { inlineData: { mimeType, data } };
      
      const prompt = `Analyze the provided image and generate content for a presentation slide.
      Your response must be a single, raw JSON object with two keys: "title" (a short, impactful title based on the image) and "content" (a JSON array of 3-4 short, descriptive bullet points about the image).
      The content should be insightful and professional.`;

      const response = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts: [{text: prompt}, imagePart] },
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              content: { type: Type.ARRAY, items: { type: Type.STRING } }
            },
            required: ['title', 'content']
          }
        }
      });
      const content = JSON.parse(response.text);
      return this.processAndStripMarkdown(content);
    } catch (e) {
        this.error.set(`Failed to generate content from image: ${(e as Error).message}`);
        return null;
    } finally {
        this.activeGenerations.update(c => c - 1);
    }
  }
  
  async runAgentCommand(
    command: string, 
    presentation: Presentation, 
    currentSlideIndex: number
  ): Promise<{ newPresentation?: Presentation, responseText: string }> {
    if (!this.ai) {
        return { responseText: "AI Service is not initialized." };
    }
    this.activeGenerations.update(c => c + 1);
    this.error.set(null);

    try {
        const simplifiedSlides = presentation.slides.map((s, i) => ({ index: i + 1, title: s.title }));
        const commandSchema = {
            type: Type.OBJECT,
            properties: {
                action: { 
                    type: Type.STRING, 
                    enum: ['ADD_SLIDE', 'CHANGE_THEME', 'REPLACE_TEXT', 'DELETE_SLIDE', 'CHANGE_LAYOUT', 'NO_ACTION'],
                    description: "The action to perform."
                },
                parameters: { 
                    type: Type.OBJECT,
                    properties: {
                        topic: { type: Type.STRING, description: "Topic for a new slide." },
                        theme_description: { type: Type.STRING, description: "Description for a new theme." },
                        find_text: { type: Type.STRING },
                        replace_text: { type: Type.STRING },
                        slide_index: { type: Type.INTEGER, description: "The 1-based index of the slide to target." },
                        new_layout: { type: Type.STRING, enum: ['title', 'content_left', 'content_right', 'section_header', 'conclusion', 'two_column', 'three_column', 'quote', 'image_full_bleed', 'table', 'chart_bar', 'chart_line', 'chart_pie', 'chart_doughnut', 'timeline', 'process', 'stats_highlight', 'pyramid', 'funnel', 'swot'], description: "The new layout name." }
                    },
                    description: "Parameters for the action."
                },
                responseText: { 
                    type: Type.STRING,
                    description: "A conversational response for the user."
                }
            },
            required: ['action', 'responseText']
        };

        const prompt = `You are an AI agent in a presentation editor. Analyze the user command and determine the single best action to take.
        
        **Context:**
        - Presentation Title: "${presentation.title}"
        - Current Slide Index: ${currentSlideIndex} (0-based)
        - Current Slide Title: "${presentation.slides[currentSlideIndex].title}"
        - Slides: ${JSON.stringify(simplifiedSlides)}

        **User Command:** "${command}"
        
        **Available Actions:**
        - **ADD_SLIDE**: If the user wants to add a new slide. The 'topic' parameter should be the subject of the new slide.
        - **CHANGE_THEME**: If the user wants to change the presentation's visual theme. The 'theme_description' parameter should describe the new theme.
        - **REPLACE_TEXT**: If the user wants to find and replace text everywhere. The 'find_text' and 'replace_text' parameters are required.
        - **CHANGE_LAYOUT**: If the user wants to change the layout of a specific slide. 'slide_index' and 'new_layout' are required. The index is 1-based.
        - **DELETE_SLIDE**: If the user wants to delete a slide. 'slide_index' is required. The index is 1-based.
        - **NO_ACTION**: For anything else (like modifying a specific slide, which is not supported yet, or just chatting).
        
        CRITICAL: Respond ONLY with a raw JSON object matching the schema.`;

        const response = await this.ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: commandSchema,
            }
        });

        const result = JSON.parse(response.text);
        const { action, parameters, responseText } = result;

        let newPresentation: Presentation | undefined = undefined;

        switch (action) {
            case 'ADD_SLIDE':
                if (parameters.topic) {
                    const newSlide = await this.generateSingleSlide(parameters.topic, presentation);
                    if (newSlide) {
                        newPresentation = { ...presentation, slides: [...presentation.slides, newSlide] };
                    }
                }
                break;
            case 'CHANGE_THEME':
                if (parameters.theme_description) {
                    const newTheme = await this.generateTheme(parameters.theme_description);
                    if (newTheme) {
                        newPresentation = { ...presentation, theme: newTheme };
                    }
                }
                break;
            case 'REPLACE_TEXT':
                if (parameters.find_text && parameters.replace_text) {
                    function escapeRegExp(string: string): string {
                      return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    }
                    const findRegex = new RegExp(escapeRegExp(parameters.find_text), 'gi');
                    const newSlides = JSON.parse(JSON.stringify(presentation.slides));
                    newSlides.forEach((slide: Slide) => {
                        slide.title = slide.title.replace(findRegex, parameters.replace_text);
                        if (Array.isArray(slide.content)) {
                            slide.content = slide.content.map(p => p.replace(findRegex, parameters.replace_text));
                        } else if (typeof slide.content === 'string') {
                            slide.content = slide.content.replace(findRegex, parameters.replace_text);
                        }
                        if (Array.isArray(slide.speakerNotes)) {
                            slide.speakerNotes = slide.speakerNotes.map(n => n.replace(findRegex, parameters.replace_text));
                        } else if (typeof slide.speakerNotes === 'string') {
                            slide.speakerNotes = slide.speakerNotes.replace(findRegex, parameters.replace_text);
                        }
                    });
                    newPresentation = { ...presentation, slides: newSlides };
                }
                break;
            case 'DELETE_SLIDE':
                if (parameters.slide_index && parameters.slide_index > 0 && parameters.slide_index <= presentation.slides.length) {
                    const indexToDelete = parameters.slide_index - 1; // Convert to 0-based
                    const newSlides = [...presentation.slides];
                    newSlides.splice(indexToDelete, 1);
                    newPresentation = { ...presentation, slides: newSlides };
                }
                break;
            case 'CHANGE_LAYOUT':
                if (parameters.slide_index && parameters.new_layout && parameters.slide_index > 0 && parameters.slide_index <= presentation.slides.length) {
                    const indexToChange = parameters.slide_index - 1; // Convert to 0-based
                    const newSlides = [...presentation.slides];
                    newSlides[indexToChange] = { ...newSlides[indexToChange], layout: parameters.new_layout };
                    newPresentation = { ...presentation, slides: newSlides };
                }
                break;
            case 'NO_ACTION':
            default:
                break;
        }
        
        return { newPresentation, responseText };

    } catch (e) {
        const err = e as Error;
        console.error('Agent command failed:', err);
        this.error.set(`Agent command failed: ${err.message}`);
        return { responseText: "Sorry, I encountered an error and couldn't complete that request." };
    } finally {
        this.activeGenerations.update(c => c - 1);
    }
  }

  async evolveCorePrompt(currentPrompt: string, feedbackSummary: string): Promise<string | null> {
    if (!this.ai) {
      this.error.set("AI Service is not initialized.");
      return null;
    }

    this.activeGenerations.update(c => c + 1);
    this.error.set(null);

    const metaPrompt = `You are an expert AI prompt engineer. Your task is to analyze and rewrite a "base prompt" used to generate presentations. The goal is to evolve the prompt based on user feedback to produce better results in the future.

**User Feedback Summary:**
This section contains structured feedback from the user. It will detail which slides they liked and disliked. For disliked slides, it will provide specific reasons like "Boring Content", "Irrelevant Image", "Poor Layout", etc.
---
${feedbackSummary}
---

**Current Base Prompt (DO NOT surround your output with markdown):**
---
${currentPrompt}
---

**Your Task & Thought Process:**

1.  **Root Cause Analysis:** Carefully read the user feedback. Identify the core patterns. For example, if multiple slides are disliked for "Poor Layout", the instructions for the "Content-Layout Fit Analysis Algorithm" are failing and must be improved. If feedback is about "Boring Content", strengthen your instructions on writing engaging text for the 'NOTES' key. If feedback is about "Irrelevant Image", enhance the instructions for the 'IMAGE_PROMPT' to demand better context-awareness and conceptual linkage. The goal is to fix the underlying instruction that led to the error.

2.  **Surgical Improvement:** Determine what specific instructions in the base prompt need to be changed, added, or strengthened to address the feedback. The goal is surgical improvement, not a complete rewrite of the prompt's persona or core structure. Your changes must be targeted improvements based directly on the feedback provided.

3.  **Rewrite:** Rewrite the *entire* base prompt, incorporating your improvements. Do not just list the changes. Output the full, new, ready-to-use prompt.

4.  **Preserve Core Structure:** Maintain the overall structure, placeholders (like {topic}, {slideCount}), and key output format instructions (like 'SLIDE_START', 'LAYOUT:'). The prompt must remain functional.

**CRITICAL OUTPUT REQUIREMENT:**
Your entire response must be ONLY the raw, rewritten prompt text. Do NOT include any conversational text, explanations, or markdown formatting like \`\`\`. Start your response directly with "Your SOLE task is to generate..." and end it with "...in the specified plain text format.".`;

    try {
      const response = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: metaPrompt,
      });
      return response.text.trim();
    } catch (e) {
      const err = e as Error;
      console.error('Error evolving core prompt:', err);
      this.error.set(`An error occurred during AI evolution: ${err.message}`);
      return null;
    } finally {
      this.activeGenerations.update(c => c - 1);
    }
  }

  async regenerateSlide(originalSlide: Slide, presentationContext: Presentation): Promise<Slide | null> {
    if (!this.ai) { return null; }
    this.activeGenerations.update(c => c + 1);
    this.error.set(null);

    const context = `This is for a presentation titled "${presentationContext.title}". The slides generated so far are: ${presentationContext.slides.map(s => `"${s.title}"`).join(', ')}.`;
    const prompt = `You are a world-class presentation designer. Your task is to completely regenerate a single presentation slide. You must provide a fresh take on the content, title, and image prompt while staying on topic.

    **Original Slide Information (for context only):**
    - Title: "${originalSlide.title}"
    - Content Summary: ${Array.isArray(originalSlide.content) ? originalSlide.content.join(', ') : originalSlide.content}
    - Layout: ${originalSlide.layout}
    
    **Context of the Presentation:**
    ${context}

    **CRITICAL INSTRUCTIONS:**
    1.  **Be Creative:** Do NOT simply rephrase the original slide. Generate a new, interesting perspective or angle on the slide's topic. Create a new title, new content points, and a completely new, highly descriptive image prompt.
    2.  **Layout Choice:** As a world-class designer, your layout choice is critical. Choose the **most appropriate layout** for the new content you generate.
    3.  **Language:** The entire content of the new slide (title, content, speaker notes) MUST be in ${presentationContext.language}.
    4.  **JSON Output:** Your entire response MUST be a single, raw JSON object for the slide, matching the required schema. Do not include any conversational text or markdown formatting (like '''json). All string fields within the JSON must also be plain text with no markdown.

    Now, generate the new slide object.`;
    
    try {
        const response = await this.ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: this.slideSchema,
            }
        });
        const slide = JSON.parse(response.text) as Slide;
        return this.processAndStripMarkdown(slide);
    } catch(e) {
        this.error.set(`Failed to regenerate slide: ${(e as Error).message}`);
        return null;
    } finally {
        this.activeGenerations.update(c => c - 1);
    }
  }

  async suggestLayout(slide: Slide): Promise<SlideLayout | null> {
    if (!this.ai) { return null; }
    this.activeGenerations.update(c => c + 1);
    this.error.set(null);
    const prompt = `You are an expert presentation designer. Analyze the following slide content and determine the absolute best layout for it.
    
    **Slide Content:**
    - Title: "${slide.title}"
    - Content: ${JSON.stringify(slide.content)}

    **Available Layouts:**
    'title', 'content_left', 'content_right', 'section_header', 'conclusion', 'two_column', 'three_column', 'quote', 'image_full_bleed', 'table', 'chart_bar', 'chart_line', 'chart_pie', 'chart_doughnut', 'timeline', 'process', 'stats_highlight', 'pyramid', 'funnel', 'swot'

    **Your Task:**
    Based on the structure and amount of content, return the single most appropriate layout name from the list above.
    For example, if the content is a list of 6-10 items, 'two_column' is a great choice. If it's a quote, use 'quote'. If it's 4 distinct categories (like Strengths, Weaknesses...), 'swot' is perfect. If it's a hierarchical process, 'pyramid' or 'funnel' could work.

    CRITICAL: Respond ONLY with the single layout name as a raw string (e.g., "two_column"). Do not add any explanation or other text.`;

    try {
        const response = await this.ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
              thinkingConfig: { thinkingBudget: 0 }
            }
        });
        const layout = response.text.trim() as SlideLayout;
        // Basic validation
        const validLayouts: SlideLayout[] = ['title', 'content_left', 'content_right', 'section_header', 'conclusion', 'two_column', 'three_column', 'quote', 'image_full_bleed', 'table', 'chart_bar', 'chart_line', 'chart_pie', 'chart_doughnut', 'timeline', 'process', 'stats_highlight', 'pyramid', 'funnel', 'swot'];
        if (validLayouts.includes(layout)) {
            return layout;
        }
        console.warn(`AI suggested an invalid layout: ${layout}`);
        return null;
    } catch(e) {
        this.error.set(`Failed to suggest layout: ${(e as Error).message}`);
        return null;
    } finally {
        this.activeGenerations.update(c => c - 1);
    }
  }

  async suggestThemes(topic: string): Promise<string[] | null> {
    if (!this.ai) { return null; }
    this.activeGenerations.update(c => c + 1);
    this.error.set(null);
    
    const themeNames = THEME_PRESETS.map(t => t.name);

    const prompt = `You are an expert design consultant. Based on the following presentation topic, select the 3 to 5 most appropriate and visually appealing theme names from the provided list. Consider the mood, industry, and potential visual style associated with the topic.

    **Presentation Topic:** "${topic}"
    
    **Available Theme Names:**
    ${JSON.stringify(themeNames)}

    CRITICAL: Your entire response MUST be a single, raw JSON array of the theme name strings you have selected. Do not include any conversational text or markdown formatting (like '''json).`;

    try {
        const response = await this.ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: { type: Type.ARRAY, items: { type: Type.STRING } },
                thinkingConfig: { thinkingBudget: 0 }
            }
        });
        return JSON.parse(response.text) as string[];
    } catch(e) {
        this.error.set(`Failed to suggest themes: ${(e as Error).message}`);
        return null;
    } finally {
        this.activeGenerations.update(c => c - 1);
    }
  }
}