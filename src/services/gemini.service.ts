import { Injectable, signal, computed, inject } from '@angular/core';
import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { Presentation, Slide, SlideLayout, Theme, Source, ChartData, PptxAnimation } from '../types';
import { THEME_PRESETS } from '../themes/presets';
import { AiEvolutionService } from './ai-evolution.service';

export type PresentationStreamEvent =
  | { type: 'title'; title: string }
  | { type: 'slide'; index: number; data: Slide }
  | { type: 'sources'; sources: Source[] };


@Injectable({ providedIn: 'root' })
export class GeminiService {
  private ai: GoogleGenAI | null = null;
  public error = signal<{ message: string; reportable: boolean } | null>(null);
  
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
  private imageGenerationDisabled = signal(false); // NEW: Circuit breaker for image generation
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
      this.error.set({ 
        message: `Failed to initialize AI Service. Please ensure the API key is configured correctly. Details: ${err.message}`,
        reportable: false 
      });
    }
  }

  public getApiKey(): string {
    return process.env.API_KEY!;
  }

  private slideSchema = {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING },
      content: { type: Type.ARRAY, items: { type: Type.STRING } },
      imagePrompt: { type: Type.STRING },
      layout: { type: Type.STRING, enum: [
        'title', 'content_left', 'content_right', 'section_header', 'conclusion', 'two_column',
        'three_column', 'quote', 'image_full_bleed', 'table', 'chart_bar', 'chart_line',
        'chart_pie', 'chart_doughnut', 'timeline', 'process', 'stats_highlight', 'pyramid',
        'funnel', 'swot', 'comparison', 'team_members_four', 'radial_diagram', 'step_flow',
        'image_overlap_left', 'hub_and_spoke', 'cycle_diagram', 'venn_diagram', 'alternating_feature_list',
        'quadrant_chart', 'bridge_chart', 'gantt_chart_simple', 'org_chart', 'mind_map',
        'fishbone_diagram', 'area_chart', 'scatter_plot', 'bubble_chart', 'image_grid_four',
        'image_with_caption_below', 'text_over_image', 'quote_with_image', 'feature_highlight_image',
        'image_collage', 'image_focus_left', 'image_focus_right', 'checklist', 'numbered_list_large',
        'step_flow_vertical', 'circular_flow', 'staggered_list', 'feature_list_icons', 'pros_and_cons',
        'kpi_dashboard_three', 'kpi_dashboard_four', 'target_vs_actual', 'faq', 'call_to_action',
        'world_map_pins',
        // New Layouts
        'chart_radar', 'chart_heatmap', 'chart_waterfall', 'data_table_highlight', 'gauge_chart_three', 'progress_bar_list',
        'roadmap_horizontal', 'roadmap_vertical', 'matrix_3x3', 'gear_diagram', 'arrow_process_flow', 'diverging_arrows', 'converging_arrows', 'chevron_list', 'project_dashboard',
        'image_grid_three', 'image_grid_five', 'image_carousel_mockup', 'image_with_side_bullets', 'image_before_after', 'device_mockup_phone', 'device_mockup_laptop', 'image_header_text_below', 'cover_page_logo',
        'agenda', 'speaker_introduction', 'testimonial_single', 'testimonial_three', 'definition_list', 'icon_grid_four', 'key_takeaways', 'numbered_highlights_four',
        'contact_information', 'thank_you', 'next_steps', 'word_cloud', 'statement', 'company_timeline', 'chapter_divider', 'matrix_2x2', 'image_with_hotspots', 'bento_grid', 'diagonal_flow', 'split_33_66', 'impact'
      ] },
      speakerNotes: { type: Type.ARRAY, items: { type: Type.STRING } },
      animation: { type: Type.STRING, enum: ['none', 'fadeIn', 'flyIn', 'wipe', 'zoomIn'], description: "Animation style for the slide in PowerPoint." },
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
      this.error.set({ message: "AI Service is not initialized.", reportable: false });
      return;
    }

    this.activeGenerations.update(c => c + 1);
    this.error.set(null);
    
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
          } else if (line.startsWith('ANIMATION:')) {
            currentSlide.animation = this.stripMarkdown(line.substring('ANIMATION:'.length).trim()) as PptxAnimation;
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
                animation: currentSlide.animation,
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
      this.error.set({ message: `An error occurred during generation: ${err.message}`, reportable: true });
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
      this.error.set({ message: "AI Service is not initialized.", reportable: false });
      return;
    }

    this.activeGenerations.update(c => c + 1);
    this.error.set(null);

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
          } else if (line.startsWith('ANIMATION:')) {
            currentSlide.animation = this.stripMarkdown(line.substring('ANIMATION:'.length).trim()) as PptxAnimation;
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
                animation: currentSlide.animation,
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
      this.error.set({ message: `An error occurred during generation: ${err.message}`, reportable: true });
    } finally {
      this.activeGenerations.update(c => c - 1);
    }
  }

  private async _processImageServiceQueue(): Promise<void> {
    if (this.isProcessingImageServiceQueue) {
        return;
    }
    this.isProcessingImageServiceQueue = true;

    while (this.imageRequestQueue.length > 0) {
        const request = this.imageRequestQueue[0];
        try {
            const result = await request.task();
            request.resolve(result);
        } catch (e) {
            request.reject(e);
        } finally {
            this.imageRequestQueue.shift();
        }
        
        if (this.imageRequestQueue.length > 0) {
            // Wait AFTER each task to respect rate limits before starting the next.
            // 5 RPM for Imagen is 1 request every 12 seconds. 15s is safer.
            await new Promise(res => setTimeout(res, 15000));
        }
    }

    this.isProcessingImageServiceQueue = false;
  }

  generateImageFromPrompt(prompt: string, imageStyle: string, aspectRatio: string): Promise<string | null> {
    if (this.imageGenerationDisabled()) {
      console.warn("Image generation is disabled due to quota exhaustion. Request ignored.");
      return Promise.resolve(null);
    }
    return new Promise((resolve, reject) => {
        // The task is the actual API call logic, which will be executed by the queue processor.
        const task = () => this._performImageGeneration(prompt, imageStyle, aspectRatio);
        this.imageRequestQueue.push({ task, resolve, reject });
        this._processImageServiceQueue();
    });
  }

  private async _performImageGeneration(prompt: string, imageStyle: string, aspectRatio: string): Promise<string | null> {
    if (!this.ai) {
      this.error.set({ message: "AI Service is not initialized.", reportable: false });
      return null;
    }
    
    this.activeGenerations.update(c => c + 1);
    this.error.set(null);

    const maxRetries = 3;
    let attempt = 0;
    // Increased initial delay for rate limiting.
    let delay = 15000 + Math.random() * 2000;

    try {
      while (attempt < maxRetries) {
        try {
          const response = await this.ai.models.generateImages({
            model: 'imagen-4.0-generate-001',
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
          
          let errorContent = '';
          try {
            // Prioritize a string message, otherwise stringify the whole thing.
            errorContent = (err.message && typeof err.message === 'string') ? err.message : JSON.stringify(err);
          } catch {
            // Fallback for circular references or other stringify errors.
            errorContent = String(e);
          }
          
          const isRateLimitError = errorContent.includes('RESOURCE_EXHAUSTED') || errorContent.includes('429');
          const isServerError = errorContent.includes('500') && errorContent.includes('INTERNAL');

          if (isRateLimitError) {
              console.error("Image generation quota exhausted. Disabling for this session.");
              this.imageGenerationDisabled.set(true);
              this.imageRequestQueue = []; // Clear the queue to prevent further attempts
              this.error.set({ 
                message: "Image generation daily quota has been reached. No more images will be generated in this session.",
                reportable: false 
              });
              throw e; // Fail the current promise immediately and stop retries.
          }

          if ((isServerError) && attempt < maxRetries - 1) {
              console.warn(`Image generation failed on attempt ${attempt + 1} with a retryable error. Retrying in ${delay / 1000}s...`);
              await new Promise(res => setTimeout(res, delay));
              delay *= 2; // Exponential backoff
              attempt++;
          } else {
              throw e; // Re-throw the error if it's not a retryable error or if retries are exhausted
          }
        }
      }
    } catch (e) {
      // The rate limit error is handled inside the loop now and re-thrown.
      // This outer catch will see it. We should avoid setting a generic error if the specific one is already set.
      if (!this.imageGenerationDisabled()) {
        const err = e as any;
        const message = err?.message || JSON.stringify(err);
        console.error('Error generating image:', err);
        this.error.set({ message: `Failed to generate image: ${message}`, reportable: true });
      }
      return null;
    } finally {
        this.activeGenerations.update(c => c - 1);
    }
    
    return null; // Should not be reached
  }

  async suggestAspectRatio(slideTitle: string, slideContent: string | string[], imagePrompt: string): Promise<string> {
    if (!this.ai) { return '16:9'; } // Default on failure
    this.activeGenerations.update(c => c + 1);
    this.error.set(null);
    const prompt = `You are a professional graphic designer and art director. Your task is to determine the optimal aspect ratio for an image on a presentation slide.

    **Context:**
    - Slide Title: "${slideTitle}"
    - Slide Content: ${Array.isArray(slideContent) ? slideContent.join(', ') : slideContent}
    - Image Prompt: "${imagePrompt}"

    **Available Aspect Ratios:**
    - 16:9 (widescreen, cinematic, landscape)
    - 4:3 (standard, balanced)
    - 1:1 (square, good for portraits or centered objects)
    - 3:4 (portrait, vertical emphasis)
    - 9:16 (tall portrait, mobile-like)

    **Instructions:**
    Analyze the image prompt and the slide content. Choose the single best aspect ratio from the list above that would best fit the described image and its role on the slide.

    - For landscapes, wide scenes, or groups, prefer '16:9'.
    - For portraits of people or tall objects, prefer '3:4' or '9:16'.
    - For centered subjects or abstract concepts, '1:1' can be effective.
    - '4:3' is a safe, standard choice.

    Your response MUST be ONLY the chosen aspect ratio string (e.g., "16:9"). Do not provide any explanation or other text.`;

    try {
      const response = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: { thinkingConfig: { thinkingBudget: 0 } }
      });
      const suggestedRatio = response.text.trim();
      const validRatios = ['16:9', '4:3', '1:1', '3:4', '9:16'];
      if (validRatios.includes(suggestedRatio)) {
        return suggestedRatio;
      }
      console.warn(`AI suggested an invalid aspect ratio: "${suggestedRatio}". Falling back to 16:9.`);
      return '16:9'; // Fallback
    } catch (e) {
      this.error.set({ message: `Failed to suggest aspect ratio: ${(e as Error).message}`, reportable: true });
      return '16:9'; // Default on error
    } finally {
      this.activeGenerations.update(c => c - 1);
    }
  }

  async improveImagePrompt(title: string, content: string | string[], originalPrompt: string): Promise<string | null> {
    if (!this.ai) { return null; }
    this.activeGenerations.update(c => c + 1);
    this.error.set(null);
    const prompt = `You are "Helios," a world-class AI art director and prompt engineer. Your mission is to transform a basic user idea into a masterpiece-level prompt for a state-of-the-art photorealistic AI image generator.

    **Slide Context:**
    - Title: "${title}"
    - Content: ${Array.isArray(content) ? content.map(c => `- ${c}`).join('\n') : content}

    **User's Original Idea:**
    "${originalPrompt}"

    **CRITICAL INSTRUCTIONS - THE HELIOS METHOD:**

    1.  **Conceptual Leap - The Visual Metaphor (MOST IMPORTANT):**
        -   DO NOT just illustrate the user's idea literally. Your primary, most critical goal is to invent a powerful **visual metaphor** that represents the slide's core message.
        -   Analyze the title and content to find the underlying concept (e.g., "growth," "connection," "security," "complexity").
        -   Translate that concept into a unique, sophisticated visual. For "growth," think "a tiny sapling breaking through a concrete floor," not just "an arrow pointing up." For "security," think "a glowing, intricate digital lock mechanism," not "a padlock."

    2.  **Evoke Emotion and Sensory Detail:**
        -   Be descriptive. Use vivid language to describe textures, lighting, atmosphere, and the overall "feel" of the scene.
        -   What is the mood? Is it optimistic and bright, or mysterious and moody?
        -   Think about sensory details: the glint of light on chrome, the texture of rough stone, the haze of a foggy morning.

    3.  **Advanced Artistic Direction:**
        -   Define a specific, professional artistic style. Examples: 'dramatic chiaroscuro lighting', 'shot with an 85mm portrait lens', 'bioluminescent macro photography', 'clean isometric 3D render', 'sleek corporate futurism', 'analogous color scheme', 'golden hour lighting', 'vaporwave aesthetic'.
        -   Use cinematic language to describe the shot: camera angle ('extreme low-angle shot'), lens ('telephoto lens with bokeh'), composition ('asymmetrical balance', 'rule of thirds').

    4.  **The Final Polish - Quality Boosters & Negative Prompts:**
        -   **Quality Boosters:** Your final prompt MUST include a set of keywords that push the image generator towards the highest quality. Examples: \`photorealistic, hyper-detailed, 8K, cinematic lighting, professional color grading, sharp focus\`.
        -   **Negative Prompts (Crucial):** Your final prompt MUST end with a strong negative prompt to avoid common image generation failures. It should ALWAYS include keywords like: \`ugly, blurry, deformed, distorted, poor quality, watermark, text, words, letters, signature, amateur\`.

    5.  **Final Output:**
        -   Return ONLY the improved prompt as a single, raw string.
        -   Do not add any explanations, conversational text, or markdown formatting.

    **Example Transformation:**
    - Title: "The Core Technology"
    - Content: ["Utilizes quantum entanglement for data processing."]
    - Original Idea: "a quantum computer"
    - **Your Masterpiece Prompt Output:** "A cinematic, photorealistic macro shot of a glowing, intricate quantum computer core. Ethereal light trails representing entangled particles pulse with energy inside a dark, sterile clean-room. Dramatic, high-contrast chiaroscuro lighting emphasizes the impossibly complex machinery. Shot on a 100mm macro lens, shallow depth of field. 8K, hyper-detailed, professional color grading, sharp focus. ugly, blurry, deformed, distorted, poor quality, watermark, text, words, letters, signature, amateur."

    Now, transform the user's idea into a masterpiece prompt.`;

    try {
        const response = await this.ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
        return response.text.trim();
    } catch(e) {
        this.error.set({ message: `Failed to improve image prompt: ${(e as Error).message}`, reportable: true });
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
        this.error.set({ message: `Failed to generate speaker notes: ${(e as Error).message}`, reportable: true });
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
        this.error.set({ message: `Failed to improve content: ${(e as Error).message}`, reportable: true });
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
          console.warn('AI returned a different number of bullet points. Discarding result.');
          return null;
        }
        return this.processAndStripMarkdown(improvedPoints);
    } catch (e) {
        this.error.set({ message: `Failed to improve bullet points: ${(e as Error).message}`, reportable: true });
        return null;
    } finally {
        this.activeGenerations.update(c => c - 1);
    }
  }

  async improveSpeakerNotes(slideTitle: string, notes: string[], mode: 'improve' | 'shorten' | 'lengthen', language: 'English' | 'Tagalog'): Promise<string[] | null> {
    if (!this.ai) { return null; }
    this.activeGenerations.update(c => c + 1);
    this.error.set(null);

    let instruction = 'rewrite the following speaker notes to be more engaging and conversational. Add rhetorical questions and more direct address to the audience.';
    if (mode === 'shorten') {
      instruction = 'condense and shorten the following speaker notes. Make them more like brief talking points rather than a full script.';
    } else if (mode === 'lengthen') {
      instruction = 'expand and lengthen the following speaker notes. Add more detail, examples, or a short anecdote to make them more comprehensive.';
    }
    
    const prompt = `You are an expert speechwriter. Your task is to ${instruction}

    Slide Title (for context): "${slideTitle}"

    Speaker notes to process:
    ${JSON.stringify(notes)}

    CRITICAL: Your entire response MUST be a single, raw JSON array of strings, where each string is a paragraph. Do not include any conversational text or markdown formatting (like '''json). The strings must also be plain text.`;
    
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
        const improvedNotes = JSON.parse(response.text);
        return this.processAndStripMarkdown(improvedNotes);
    } catch(e) {
        this.error.set({ message: `Failed to improve speaker notes: ${(e as Error).message}`, reportable: true });
        return null;
    } finally {
        this.activeGenerations.update(c => c - 1);
    }
  }

  async regenerateSlide(slide: Slide, presentationContext: Presentation): Promise<Slide | null> {
    if (!this.ai) { return null; }
    this.activeGenerations.update(c => c + 1);
    this.error.set(null);

    const prompt = `You are Agnes AI, an expert presentation designer inspired by Gamma.app. Your task is to REFINE and REGENERATE a single slide to be modern, visually balanced, and low-density.

**Full Presentation Context:**
- Title: ${presentationContext.title}
- Original Topic: ${presentationContext.originalTopic}
- Language: ${presentationContext.language}

**Slide to Regenerate:**
${JSON.stringify(slide, null, 2)}

**DESIGN RULES (Strict Adherence):**
1.  **Reduce Text Density:** Reduce the current text by at least 40%. Make it scannable. Use fragments, NOT full sentences.
2.  **Max 5 Items:** Never exceed 5 bullet points.
3.  **Dynamic Layout Logic (The "Anti-Bullet Point" Protocol):**
    -   **Software/Tools/Libraries:** Use 'bento_grid'. Create a rounded rectangle for each tool. Icon left, description right. Max 10 words per description.
    -   **Hierarchical Data (Ranks, Steps):** Use 'pyramid'. Order: Top (Peak) -> Bottom (Base).
    -   **Key Metric / Single Stat:** Use 'stats_highlight' (Hero Number layout).
    -   **3 Distinct Items:** Use 'three_column' or 'testimonial_three'.
    -   **4 Distinct Items:** Use 'icon_grid_four' (2x2 Grid).
    -   **Sequence/Process:** Use 'chevron_list' or 'process'.
    -   **5+ Distinct Items:** Use 'timeline', 'step_flow', or 'image_carousel_mockup'.
    -   **Comparison:** Use 'comparison' or 'pros_and_cons'.
    -   Otherwise, choose the best fit from: 'split_33_66', 'content_left', 'content_right', 'image_full_bleed', 'quote', 'section_header', 'diagonal_flow'.
4.  **Visuals:** Write a new 'imagePrompt' that is abstract, professional, and metaphorical. NO literal interpretations.
5.  **Speaker Notes:** Move detailed explanations to 'speakerNotes'. Keep the slide text minimal.

**Output:**
Your response MUST be a single, raw JSON object representing the new slide (keys: title, content, imagePrompt, layout, speakerNotes). Do not include any conversational text or markdown formatting.`;

    try {
        const response = await this.ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: this.slideSchema
            }
        });
        const newSlide = JSON.parse(response.text) as Slide;
        newSlide.rating = null; // Reset rating
        return this.processAndStripMarkdown(newSlide);
    } catch(e) {
        this.error.set({ message: `Failed to regenerate slide: ${(e as Error).message}`, reportable: true });
        return null;
    } finally {
        this.activeGenerations.update(c => c - 1);
    }
  }
  
  async suggestLayout(slide: Slide): Promise<SlideLayout | null> {
    if (!this.ai) { return null; }
    this.activeGenerations.update(c => c + 1);
    this.error.set(null);
    const prompt = `You are a presentation design expert. Analyze the content of the following slide and suggest the single best layout for it from the provided list.

**Slide Content:**
- Title: ${slide.title}
- Content: ${JSON.stringify(slide.content)}

**CRITICAL INSTRUCTIONS:**
- Your response MUST be only the name of the layout (e.g., 'two_column').
- Do not add any explanation or other text.
- Choose from this list: 'title', 'content_left', 'content_right', 'section_header', 'conclusion', 'two_column', 'three_column', 'quote', 'image_full_bleed', 'table', 'chart_bar', 'chart_line', 'chart_pie', 'chart_doughnut', 'timeline', 'process', 'stats_highlight', 'pyramid', 'funnel', 'swot', 'comparison', 'team_members_four', 'radial_diagram', 'step_flow', 'image_overlap_left', 'hub_and_spoke', 'cycle_diagram', 'venn_diagram', 'alternating_feature_list', 'quadrant_chart', 'bridge_chart', 'gantt_chart_simple', 'org_chart', 'mind_map', 'fishbone_diagram', 'area_chart', 'scatter_plot', 'bubble_chart', 'image_grid_four', 'image_with_caption_below', 'text_over_image', 'quote_with_image', 'feature_highlight_image', 'image_collage', 'image_focus_left', 'image_focus_right', 'checklist', 'numbered_list_large', 'step_flow_vertical', 'circular_flow', 'staggered_list', 'feature_list_icons', 'pros_and_cons', 'kpi_dashboard_three', 'kpi_dashboard_four', 'target_vs_actual', 'faq', 'call_to_action', 'world_map_pins', 'chart_radar', 'chart_heatmap', 'chart_waterfall', 'data_table_highlight', 'gauge_chart_three', 'progress_bar_list', 'roadmap_horizontal', 'roadmap_vertical', 'matrix_3x3', 'gear_diagram', 'arrow_process_flow', 'diverging_arrows', 'converging_arrows', 'chevron_list', 'project_dashboard', 'image_grid_three', 'image_grid_five', 'image_carousel_mockup', 'image_with_side_bullets', 'image_before_after', 'device_mockup_phone', 'device_mockup_laptop', 'image_header_text_below', 'cover_page_logo', 'agenda', 'speaker_introduction', 'testimonial_single', 'testimonial_three', 'definition_list', 'icon_grid_four', 'key_takeaways', 'numbered_highlights_four', 'contact_information', 'thank_you', 'next_steps', 'word_cloud', 'statement', 'company_timeline', 'chapter_divider', 'matrix_2x2', 'image_with_hotspots', 'bento_grid', 'diagonal_flow', 'split_33_66', 'impact'.`;

    try {
      const response = await this.ai.models.generateContent({ 
        model: 'gemini-2.5-flash', 
        contents: prompt,
        config: { thinkingConfig: { thinkingBudget: 0 } }
      });
      return response.text.trim() as SlideLayout;
    } catch(e) {
      this.error.set({ message: `Failed to suggest layout: ${(e as Error).message}`, reportable: true });
      return null;
    } finally {
      this.activeGenerations.update(c => c - 1);
    }
  }

  async suggestThemes(topic: string): Promise<string[] | null> {
    if (!this.ai) { return null; }
    this.activeGenerations.update(c => c + 1);
    this.error.set(null);
    const prompt = `Based on the presentation topic "${topic}", suggest up to 5 theme names from the following list that would be a good fit.

**List of Available Themes:**
${THEME_PRESETS.map(t => `- ${t.name}`).join('\n')}

**STRICT INTENT-BASED COLOR SYSTEM:**
1. **Aggressive/Offensive Topics** (e.g., attacking, dominating, winning, competition): You MUST include 'Crimson Offensive'.
2. **Defensive/Safe Topics** (e.g., protecting, security, stability, defending): You MUST include 'Teal Shield'.
3. **Educational/Technical Topics** (e.g., learning, analysis, science, engineering, documentation): You MUST include 'Slate Educational'.

**CRITICAL INSTRUCTIONS:**
- Your response MUST be a single, raw JSON array of strings.
- Each string must be an exact name from the list above.
- Do not include any conversational text or markdown formatting (like '''json).`;

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
        return JSON.parse(response.text);
    } catch (e) {
        this.error.set({ message: `Failed to suggest themes: ${(e as Error).message}`, reportable: true });
        return null;
    } finally {
        this.activeGenerations.update(c => c - 1);
    }
  }
  
  async reorderSlides(presentation: Presentation): Promise<Slide[] | null> {
    if (!this.ai) { return null; }
    this.activeGenerations.update(c => c + 1);
    this.error.set(null);
    const slideTitles = presentation.slides.map((s, i) => `${i}: ${s.title}`);
    const prompt = `You are a presentation flow expert. Given the following list of slide titles with their current indices, reorder them to create the most logical and compelling narrative flow.

**Current Slide Order (index: title):**
${slideTitles.join('\n')}

**CRITICAL INSTRUCTIONS:**
- Your response MUST be a single, raw JSON array of numbers.
- The array must contain the original indices in the new, optimal order.
- Do not include any conversational text or markdown formatting (like '''json).
- Ensure every original index is present exactly once in your output array.`;
    try {
        const response = await this.ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: { type: Type.ARRAY, items: { type: Type.NUMBER } }
            }
        });
        const newOrder = JSON.parse(response.text) as number[];
        if (newOrder.length !== presentation.slides.length) return null;
        return newOrder.map(i => presentation.slides[i]);
    } catch (e) {
        this.error.set({ message: `Failed to reorder slides: ${(e as Error).message}`, reportable: true });
        return null;
    } finally {
        this.activeGenerations.update(c => c - 1);
    }
  }

  async generateTheme(promptText: string): Promise<Theme | null> {
    if (!this.ai) return null;
    this.activeGenerations.update(c => c + 1);
    this.error.set(null);
    const prompt = `Generate a theme for a presentation based on the following description: "${promptText}".

**STRICT COLOR-CODING RULES:**
- **Aggressive/Offensive Intent:** Use Deep Crimson background with Orange accents.
- **Defensive/Safe Intent:** Use Navy background with Cool Teal accents.
- **Educational/Technical Intent:** Use Clean White background with Slate Blue accents/text.

**CRITICAL INSTRUCTIONS:**
- Your response MUST be a single, raw JSON object.
- The object must conform to the specified schema for a theme.
- Do not include any conversational text or markdown formatting (like '''json).`;
    try {
        const response = await this.ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: this.themeSchema
            }
        });
        return this.processAndStripMarkdown(JSON.parse(response.text));
    } catch (e) {
        this.error.set({ message: `Failed to generate theme: ${(e as Error).message}`, reportable: true });
        return null;
    } finally {
        this.activeGenerations.update(c => c - 1);
    }
  }

  async generateSingleSlide(topic: string, presentationContext: Presentation): Promise<Slide | null> {
     if (!this.ai) { return null; }
    this.activeGenerations.update(c => c + 1);
    this.error.set(null);
    const prompt = `Generate a single, new presentation slide about "${topic}". This slide should fit into the context of the larger presentation titled "${presentationContext.title}".

**CRITICAL INSTRUCTIONS (Gamma Style):**
1.  **Reduce Text Density:** Keep content minimal and scannable. Use fragments.
2.  **Dynamic Layout Logic (The "Anti-Bullet Point" Protocol):**
    -   **Software/Tools/Libraries:** Use 'bento_grid'. Create a rounded rectangle for each tool. Icon left, description right. Max 10 words per description.
    -   **Hierarchical (Ranks, Steps):** Use 'pyramid'. Order: Top (Peak) -> Bottom (Base).
    -   **Key Metric / Single Stat:** Use 'stats_highlight' (Hero Number).
    -   **3 Items:** Use 'three_column'.
    -   **4 Items:** Use 'icon_grid_four' (2x2 Grid).
    -   **Sequence:** Use 'chevron_list' or 'process'.
    -   **5+ Items:** Use 'timeline' or 'process'.
    -   Otherwise, select the best fit.
3.  **Visuals:** Provide an abstract, metaphorical 'imagePrompt'.
4.  **Language:** Content MUST be in ${presentationContext.language}.
5.  **Output:** Return a single, raw JSON object representing the slide.`;

    try {
        const response = await this.ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: this.slideSchema
            }
        });
        const slide = JSON.parse(response.text) as Slide;
        slide.rating = null;
        return this.processAndStripMarkdown(slide);
    } catch (e) {
        this.error.set({ message: `Failed to generate slide: ${(e as Error).message}`, reportable: true });
        return null;
    } finally {
        this.activeGenerations.update(c => c - 1);
    }
  }

  async getEditedImagePrompt(originalPrompt: string, instruction: string): Promise<string | null> {
     if (!this.ai) { return null; }
    this.activeGenerations.update(c => c + 1);
    this.error.set(null);
    const prompt = `You are a prompt engineer. Your task is to modify an existing image prompt based on a user's instruction.

**Original Prompt:**
"${originalPrompt}"

**User's Instruction:**
"${instruction}"

**CRITICAL INSTRUCTIONS:**
- Combine the original prompt with the user's instruction to create a new, coherent prompt.
- Retain the core subject of the original prompt but apply the changes requested.
- Ensure the new prompt is highly descriptive and suitable for a photorealistic AI image generator.
- The prompt MUST end with: "No text, no words, no letters."
- Your response MUST be only the new prompt as a single, raw string. Do not add any explanation or markdown formatting.`;
    try {
        const response = await this.ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
        return response.text.trim();
    } catch (e) {
        this.error.set({ message: `Failed to edit image prompt: ${(e as Error).message}`, reportable: true });
        return null;
    } finally {
        this.activeGenerations.update(c => c - 1);
    }
  }
  
  async generateSlideContentFromImage(imageUrl: string): Promise<{ title: string; content: string[] } | null> {
    if (!this.ai) return null;
    this.activeGenerations.update(c => c + 1);
    this.error.set(null);
    const mimeType = imageUrl.split(';')[0].split(':')[1];
    const base64Data = imageUrl.split(',')[1];
    
    try {
      const response = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: {
          parts: [
            { inlineData: { mimeType, data: base64Data } },
            { text: `Analyze this image and generate a suitable title and a few bullet points for a presentation slide based on its content. Your response MUST be a single, raw JSON object with "title" (string) and "content" (array of strings). Do not add any conversational text or markdown formatting.` }
          ]
        },
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
      return JSON.parse(response.text);
    } catch (e) {
      this.error.set({ message: `Failed to generate content from image: ${(e as Error).message}`, reportable: true });
      return null;
    } finally {
      this.activeGenerations.update(c => c - 1);
    }
  }

  async runAgentCommand(command: string, presentation: Presentation, currentSlideIndex: number): Promise<{ responseText: string, newPresentation: Presentation | null }> {
    if (!this.ai) return { responseText: "AI Service not initialized.", newPresentation: null };
    
    const prompt = `You are Agnes AI, an agent with direct control over a presentation's JSON structure. Your task is to understand a user's command and modify the presentation's JSON accordingly.

**User Command:** "${command}"

**Current Slide Index:** ${currentSlideIndex} (The user is looking at this slide)

**Current Presentation JSON:**
${JSON.stringify(presentation, null, 2)}

**CRITICAL INSTRUCTIONS:**
1.  **Analyze the Command:** Understand the user's intent. Are they adding a slide, changing a theme, editing text, etc.?
2.  **Formulate a Plan:** Decide which parts of the JSON need to be changed.
3.  **Generate a Response:** Your response MUST be a single, raw JSON object with two keys:
    *   **"responseText"**: A string containing your conversational reply to the user, explaining what you did or why you couldn't do it.
    *   **"newPresentationJSON"**: The complete, modified presentation JSON structure. If you cannot fulfill the request or no changes are needed, return the original presentation JSON unmodified.

**Example 1:**
- Command: "Change the title of this slide to 'Our Vision'"
- Response:
{
  "responseText": "Done! I've updated the title of the current slide to 'Our Vision'.",
  "newPresentationJSON": { ... the entire presentation JSON with the slide title changed ... }
}

**Example 2:**
- Command: "Make the theme have a black background"
- Response:
{
  "responseText": "I've updated the theme to have a black background.",
  "newPresentationJSON": { ... the entire presentation JSON with theme.backgroundColor set to '#000000' ... }
}

**Example 3:**
- Command: "Tell me a joke"
- Response:
{
  "responseText": "I'm here to help with your presentation, not tell jokes!",
  "newPresentationJSON": { ... the original, unmodified presentation JSON ... }
}

Now, process the user's command and generate your response.`;

    try {
        const response = await this.ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        responseText: { type: Type.STRING },
                        newPresentationJSON: { type: Type.OBJECT } // A generic object, we'll cast it later
                    },
                    required: ['responseText', 'newPresentationJSON']
                }
            }
        });

        const result = JSON.parse(response.text);
        return {
            responseText: result.responseText,
            newPresentation: result.newPresentationJSON as Presentation
        };
    } catch(e) {
        console.error("Agent command failed:", e);
        return {
            responseText: `I'm sorry, I encountered an error trying to process that: ${(e as Error).message}`,
            newPresentation: null
        };
    }
  }
  
  async evolveCorePrompt(currentPrompt: string, feedback: string): Promise<string | null> {
    if (!this.ai) return null;
    const prompt = `You are an AI specialized in self-improvement and prompt engineering. Your task is to evolve a prompt used to generate presentations based on user feedback.

**Current Core Prompt:**
---
${currentPrompt}
---

**User Feedback Analysis:**
---
${feedback}
---

**CRITICAL INSTRUCTIONS:**
1.  **Analyze Feedback:** Deeply understand the user's likes and dislikes from the feedback summary. Identify patterns. For example, if users dislike "Boring Content" and like slides with specific layouts, the prompt should be adjusted to encourage more dynamic content and favor those layouts.
2.  **Evolve the Prompt:** Subtly modify the "Current Core Prompt". Do NOT rewrite it from scratch. Make targeted improvements to address the feedback.
    -   If users find content boring, you might add instructions like: "Incorporate surprising statistics or a compelling anecdote in the speaker notes."
    -   If images are irrelevant, you might strengthen the 'IMAGE_PROMPT' instructions: "The image prompt MUST be a direct, conceptual metaphor for the slide's content."
    -   If layouts are poor, you might add more specific guidance to the "Design Council Decision on Layouts" section.
3.  **Maintain Structure:** The core structure and keys of the original prompt must be preserved.
4.  **Final Output:** Your response MUST be only the new, improved prompt as a single, raw string. Do not add any explanation, conversational text, or markdown formatting.`;
    
    try {
        const response = await this.ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
        return response.text.trim();
    } catch (e) {
        this.error.set({ message: `Failed to evolve core prompt: ${(e as Error).message}`, reportable: true });
        return null;
    }
  }

  async generateThemeFromImage(base64ImageData: string): Promise<Theme | null> {
    if (!this.ai) return null;
    this.activeGenerations.update(c => c + 1);
    this.error.set(null);
    
    const mimeType = base64ImageData.split(';')[0].split(':')[1];
    const data = base64ImageData.split(',')[1];

    try {
        const response = await this.ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: {
                parts: [
                    { inlineData: { mimeType, data } },
                    { text: `You are a professional designer. Analyze this image and generate a harmonious presentation theme based on its colors and mood. Your response MUST be a single, raw JSON object that conforms to the theme schema. Do not include any conversational text or markdown formatting.` }
                ]
            },
            config: {
                responseMimeType: 'application/json',
                responseSchema: this.themeSchema
            }
        });
        return this.processAndStripMarkdown(JSON.parse(response.text));
    } catch (e) {
        this.error.set({ message: `Failed to generate theme from image: ${(e as Error).message}`, reportable: true });
        return null;
    } finally {
        this.activeGenerations.update(c => c - 1);
    }
  }

  async initiateVideoGeneration(prompt: string, imageBase64: string, mimeType: string): Promise<any> {
    if (!this.ai) throw new Error("AI Service not initialized.");
    this.activeGenerations.update(c => c + 1);
    this.error.set(null);

    try {
      const operation = await this.ai.models.generateVideos({
        model: 'veo-2.0-generate-001',
        prompt: prompt,
        image: {
          imageBytes: imageBase64.split(',')[1],
          mimeType: mimeType,
        },
        config: {
          numberOfVideos: 1
        }
      });
      return operation;
    } catch (e) {
      this.error.set({ message: `Failed to start video generation: ${(e as Error).message}`, reportable: true });
      throw e;
    } finally {
      this.activeGenerations.update(c => c - 1);
    }
  }

  async pollVideoOperation(operation: any): Promise<any> {
    if (!this.ai) throw new Error("AI Service not initialized.");
    try {
      return await this.ai.operations.getVideosOperation({ operation: operation });
    } catch (e) {
      this.error.set({ message: `Failed to poll video status: ${(e as Error).message}`, reportable: true });
      throw e;
    }
  }
}