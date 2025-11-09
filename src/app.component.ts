

import { Component, ChangeDetectionStrategy, signal, inject, effect, computed, viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Presentation, HistoryItem, Theme, Slide, SlideLayout, Source } from './types';
import { GeminiService, PresentationStreamEvent } from './services/gemini.service';
import { UserPreferenceService } from './services/user-preference.service';
import { THEME_PRESETS } from './themes/presets';
import { PresentationEditorComponent } from './components/presentation-editor/presentation-editor.component';
import { LiveGenerationComponent } from './components/live-generation/live-generation.component';
import { DocumentProcessorService } from './services/document-processor.service';
import { ErrorToastComponent } from './components/error-toast/error-toast.component';
import { BackendService } from './services/backend.service';

type AppView = 'landing' | 'theme' | 'generating' | 'editor';
type GenerationMode = 'standard' | 'external_ai' | 'document';

@Component({
  selector: 'app-root',
  imports: [CommonModule, FormsModule, PresentationEditorComponent, LiveGenerationComponent, ErrorToastComponent],
  templateUrl: './app.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent {
  // Services
  geminiService = inject(GeminiService);
  backendService = inject(BackendService);
  userPreferenceService = inject(UserPreferenceService);
  documentProcessorService = inject(DocumentProcessorService);

  // App State
  view = signal<AppView>('landing');
  presentation = signal<Presentation | null>(null);
  history = signal<HistoryItem[]>([]);
  themes = signal<Theme[]>(THEME_PRESETS);
  generationMode = signal<GenerationMode>('standard');
  showAiChoiceModal = signal(false);
  documentContentForPrompt = signal<string | null>(null);

  // Input State
  topic = signal('');
  slideCount = signal(10);
  audience = signal('');
  language = signal<'English' | 'Tagalog'>('English');
  useGoogleSearch = signal(false);
  highQuality = signal(false);
  uploadedFile = signal<File | null>(null);
  jsonInput = signal('');
  
  // External AI Mode State
  externalAiStep = signal<1 | 2>(1);
  isPromptCopied = signal(false);

  // Processing State
  isProcessingFile = signal(false);
  private imageGenerationQueue: number[] = [];
  private isProcessingImageQueue = signal(false);

  // Theme Filtering State
  selectedThemeCategory = signal<string>('All');
  aiSuggestedThemes = signal<Theme[] | null>(null);
  isSuggestingThemes = signal(false);
  themeCategories = computed(() => {
    const allThemes = this.themes();
    return ['All', ...Array.from(new Set(allThemes.map(t => t.category))).sort()];
  });
  filteredThemes = computed(() => {
    const category = this.selectedThemeCategory();
    const allThemes = this.themes();
    if (category === 'All') {
      return allThemes;
    }
    return allThemes.filter(theme => theme.category === category);
  });
  
  isGenerationDisabled = computed(() => {
    if (this.geminiService.isGenerating() || this.isProcessingFile()) return true;
    switch(this.generationMode()) {
      case 'standard': return !this.topic();
      case 'document': return !this.uploadedFile();
      case 'external_ai':
        if (this.externalAiStep() === 1) {
          // In step 1, the action is "Next", which should be enabled if there's a topic or document.
          return !this.topic() && !this.documentContentForPrompt();
        }
        // In step 2, the action is "Generate", which needs the JSON input.
        return !this.jsonInput();
      default: return true;
    }
  });

  readonly availableFonts: string[] = [
    'Inter', 'Lato', 'Lora', 'Merriweather', 'Montserrat', 'Open Sans', 'Orbitron',
    'Oswald', 'Playfair Display', 'Poppins', 'Raleway', 'Roboto', 'Roboto Slab',
    'Source Code Pro', 'Turret Road'
  ];

  private readonly EXTERNAL_AI_BASE_PROMPT = `Your SOLE task is to generate a single, raw JSON object representing a presentation. Your entire response MUST be only this JSON object. Do not include ANY conversational text, markdown formatting like \`\`\`json. All string values within the JSON (like 'title', 'content', 'speakerNotes') MUST also be plain text, with absolutely no markdown formatting (like **, ##, or *).

**Persona:** You are a world-class presentation designer and content strategist.

**Core Mission:** Create a presentation that is not just informative, but also engaging, visually stunning, and tells a coherent story.

**Presentation Details:**
- **Topic:** "{topic}"
- **Target Audience:** "{audience}"
- **Number of Slides:** Exactly {slideCount} slides.
- **Language:** The entire presentation content MUST be in **{language}**.

**Source of Truth:**
- If the "DOCUMENT CONTEXT" section below is present, your entire presentation MUST be based exclusively on the information provided within it. The 'Topic' above should then be considered the title of the document.
- If "DOCUMENT CONTEXT" is not present, generate the presentation based on your general knowledge of the 'Topic'.

{documentContext}

**CRUCIAL INSTRUCTIONS (for generating the JSON object):**

1.  **Theme Generation:**
    -   You MUST create a "theme" object within the main JSON structure.
    -   This theme should be visually appealing and appropriate for the presentation's topic.
    -   The theme object MUST have the following keys:
        -   **name**: A creative name for the theme (e.g., "Cybernetic Blue").
        -   **category**: A general category (e.g., "Tech", "Corporate", "Creative").
        -   **primaryColor**: A hex color code for headers (e.g., "#00FFFF").
        -   **backgroundColor**: A hex color code for the slide background (e.g., "#001F3F").
        -   **textColor**: A hex color code for body text (e.g., "#EAEAEA").
        -   **titleFont**: A font for titles, chosen ONLY from this list: {fontList}.
        -   **bodyFont**: A font for body text, chosen ONLY from this list: {fontList}.

2.  **Narrative Flow:** Ensure the slides follow a logical arc: introduction, body, and conclusion.

3.  **Content Excellence (for each slide object):**
    -   **title:** Make it concise, powerful, and attention-grabbing.
    -   **content:** An array of clear, succinct bullet points. Incorporate plausible statistics or concrete examples.

4.  **Creative Direction for \`imagePrompt\` (VERY IMPORTANT):**
    -   You are an art director. The prompt must be for a high-end, photorealistic AI image generator.
    -   Be specific with style: "Cinematic, dramatic low-angle shot", "hyper-realistic 3D render". Avoid "cartoon" or "clipart".
    -   The prompt MUST end with: "No text, no words, no letters."
    -   For layouts without a main image ('two_column', 'section_header', 'table', 'chart_bar', etc.), generate a subtle, abstract background image prompt.

5.  **CRITICAL: Content-Layout Fit Analysis Algorithm**
    Your most important task as a designer is choosing a layout that PERFECTLY fits the content you've written. Do not just pick layouts randomly. You MUST analyze the length and nature of your content for a slide BEFORE selecting a layout from the 'layout' property's enum.
    -   **Short, Punchy Content (1-3 items):** Use 'title', 'section_header', 'conclusion', 'quote', 'image_full_bleed', 'stats_highlight'. These are for high-impact, low-text slides.
    -   **Medium Content (3-5 bullet points):** 'content_left' and 'content_right' are ideal for this.
    -   **Longer Content (6-10 bullet points):** Use 'two_column' to break up a long list and improve readability. Avoid putting a giant list in a single column layout.
    -   **Structured, Paired Content:**
        -   'three_column': **STRICTLY** for three distinct points. The 'content' array MUST contain exactly 6 strings in [title1, text1, title2, text2, title3, text3] format.
        -   'timeline'/'process': Ideal for 3-5 steps/dates. The 'content' array MUST be in [item1_title, item1_text, item2_title, item2_text, ...] format.
    -   **Data-Driven Content:** Use 'table', 'chart_bar', 'chart_line', 'chart_pie', 'chart_doughnut'. The 'content' property for these layouts MUST be a single-element array containing a brief summary of the data's key insight.
    -   **Valid Layouts:** The 'layout' property must be one of: 'title', 'content_left', 'content_right', 'section_header', 'conclusion', 'two_column', 'three_column', 'quote', 'image_full_bleed', 'table', 'chart_bar', 'chart_line', 'chart_pie', 'chart_doughnut', 'timeline', 'process', 'stats_highlight'.

6.  **Data Visualization (TABLES & CHARTS):**
    -   When you use a 'table' or 'chart_*' layout, you MUST provide the corresponding 'tableData' or 'chartData' property in the slide object.
    -   **tableData**: A 2D JSON array of strings. The first inner array is the header. Example: "tableData": [ ["Feature", "Plan A"], ["Storage", "10 GB"] ]
    -   **chartData**: A JSON object with 'labels' (string array) and 'datasets' (array of objects with 'label' string and 'data' number array). Example: "chartData": { "labels": ["Q1", "Q2"], "datasets": [{"label": "Revenue", "data": [150, 220]}] }
    -   **CRITICAL DATA GENERATION RULES:**
        1.  **NO EMPTY DATA:** The 'data' array inside a 'chartData' object's dataset MUST NOT be empty. It MUST contain numbers. An empty array like '"data":[]' is a critical error and is forbidden.
        2.  **MATCHING LENGTHS:** The number of items in the 'data' array MUST exactly match the number of items in the 'labels' array.
        3.  **PLAUSIBLE DATA:** All data in tables and charts MUST be plausible and realistic.

7.  **Paired Content Layouts ('timeline', 'process', 'stats_highlight', 'three_column'):**
    -   For these layouts, the 'content' array MUST be in pairs: a title/date/stat/question followed by its descriptive text.
    -   'three_column': Exactly 3 pairs (6 'content' strings).
    -   'timeline': 3-5 pairs (date/year, description).
    -   'process': 2-5 pairs (step title, description).
    -   'stats_highlight': 1-4 pairs (statistic, label).

8.  **'speakerNotes' (VERY IMPORTANT):**
    -   This is the speaker's script. You MUST write it from the first-person perspective of the speaker addressing the audience directly.
    -   Do NOT write instructions for the speaker (e.g., "Tell a story about..."). Instead, write the story itself.
    -   Your goal is to provide a conversational, engaging script that goes beyond the bullet points. You should:
        1.  **Provide Deeper Insights:** Explain the "so what?" of the slide's content.
        2.  **Use Engaging Hooks:** Weave in compelling statistics, rhetorical questions, or brief anecdotes.
        3.  **Directly Address the Audience:** Use words like "you", "we", and "our" to create a connection.

9.  **Strict JSON Output Structure:**
    - The root object must have "title" (string), "theme" (object), and "slides" (array of slide objects).
    - The "slides" array **must** contain exactly {slideCount} slide objects. This is a non-negotiable requirement.
    - Each slide object in the "slides" array must have all required properties: "title", "content", "imagePrompt", "layout", "speakerNotes".
    - If using a data layout, you must also include 'tableData' or 'chartData' as specified above.

10. **FINAL CHECK (MANDATORY):** Before completing the JSON, perform these two final checks on every slide object:
    1.  **Content-Layout Fit:** Re-read the "Content-Layout Fit Analysis Algorithm" instructions. Does the content I wrote perfectly match the chosen layout's constraints? If not, I MUST fix it.
    2.  **Chart Data Integrity:** For slides with 'chartData', I must verify that the 'data' array has the exact same number of elements as the 'labels' array. I will correct any mismatch.
    This two-step check is mandatory.

Generate the complete JSON object now.`;

  externalAiPromptText = computed(() => {
    const documentContent = this.documentContentForPrompt();
    const file = this.uploadedFile();

    const topic = (this.generationMode() === 'external_ai' && file)
      ? `a presentation based on the document '${file.name}'`
      : this.topic() || '[Your Topic Here]';
    
    const audience = this.audience() || 'a general audience';
    const slideCount = this.slideCount();
    const language = this.language();
    
    const documentContext = documentContent
      ? `**DOCUMENT CONTEXT (Source of Truth):**\n---\n${documentContent}\n---`
      : '';

    return this.EXTERNAL_AI_BASE_PROMPT
      .replace(/{topic}/g, topic)
      .replace(/{audience}/g, audience)
      .replace(/{slideCount}/g, slideCount.toString())
      .replace(/{language}/g, language)
      .replace(/{documentContext}/g, documentContext)
      .replace(/{fontList}/g, this.availableFonts.join(', '));
  });
  
  basePromptForDisplay = computed(() => {
    // This provides a clean version of the core instructions for the UI,
    // abstracting away the dynamic parts for clarity.
    const cleanedPrompt = this.EXTERNAL_AI_BASE_PROMPT
      .replace(
`**Presentation Details:**
- **Topic:** "{topic}"
- **Target Audience:** "{audience}"
- **Number of Slides:** Exactly {slideCount} slides.
- **Language:** The entire presentation content MUST be in **{language}**.

**Source of Truth:**
- If the "DOCUMENT CONTEXT" section below is present, your entire presentation MUST be based exclusively on the information provided within it. The 'Topic' above should then be considered the title of the document.
- If "DOCUMENT CONTEXT" is not present, generate the presentation based on your general knowledge of the 'Topic'.

{documentContext}`, 
        '[... Presentation details like topic, slide count, and document content will be inserted here ...]'
      )
      .replace(/{fontList}/g, this.availableFonts.join(', '));
    return cleanedPrompt;
  });

  liveGenerationComponent = viewChild(LiveGenerationComponent);

  constructor() {
    this.backendService.getHistory().then(history => this.history.set(history));

    effect((onCleanup) => {
      const currentPres = this.presentation();
      if (currentPres) {
        const timer = setTimeout(() => {
          this.backendService.savePresentation(currentPres).then(() => {
            // After saving, refresh the history list
            this.backendService.getHistory().then(h => this.history.set(h));
          });
        }, 1000);
        onCleanup(() => clearTimeout(timer));
      }
    });
  }

  private cleanJsonString(jsonString: string): string {
    // Removes trailing commas from objects {key: "value",} -> {key: "value"}
    let cleaned = jsonString.replace(/,\s*}/g, '}');
    // Removes trailing commas from arrays [1, 2, 3,] -> [1, 2, 3]
    cleaned = cleaned.replace(/,\s*]/g, ']');
    return cleaned;
  }

  setGenerationMode(mode: GenerationMode): void {
    this.generationMode.set(mode);
    this.jsonInput.set('');
    this.externalAiStep.set(1);

    // When switching to standard mode, clear any document context
    if (mode === 'standard') {
        this.uploadedFile.set(null);
        this.documentContentForPrompt.set(null);
    }
    // When switching to document mode, clear topic context
    if (mode === 'document') {
        this.topic.set('');
        this.documentContentForPrompt.set(null);
    }
  }

  copyExternalAiPrompt(): void {
    const prompt = this.externalAiPromptText();
    navigator.clipboard.writeText(prompt).then(() => {
        this.isPromptCopied.set(true);
        setTimeout(() => this.isPromptCopied.set(false), 2000);
    }).catch(err => {
        console.error('Failed to copy text: ', err);
        alert('Could not copy prompt to clipboard.');
    });
  }

  onFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      const allowedTypes = [
        'application/pdf', 
        'application/vnd.openxmlformats-officedocument.presentationml.presentation'
      ];
      if (allowedTypes.includes(file.type)) {
        this.uploadedFile.set(file);
        this.showAiChoiceModal.set(true);
      } else {
        alert('Unsupported file type. Please upload a PDF or PPTX file.');
        this.uploadedFile.set(null);
        input.value = '';
      }
    }
  }

  clearFile(): void {
    this.uploadedFile.set(null);
    this.documentContentForPrompt.set(null); // Also clear the processed content
    const fileInput = document.getElementById('file-upload') as HTMLInputElement;
    if (fileInput) fileInput.value = '';
    this.showAiChoiceModal.set(false);
  }

  async handleAiChoice(choice: 'normal' | 'external'): Promise<void> {
    const file = this.uploadedFile();
    if (!file) return;

    if (choice === 'normal') {
      this.generationMode.set('document');
      this.startFlow();
      this.showAiChoiceModal.set(false);
    } else { // external
      this.isProcessingFile.set(true);
      this.documentContentForPrompt.set(null); // Reset
      try {
        const documentText = await this.documentProcessorService.processFile(file);
        this.documentContentForPrompt.set(documentText);
        this.topic.set(''); // Clear topic to avoid ambiguity
        this.generationMode.set('external_ai');
        this.externalAiStep.set(1);
        this.showAiChoiceModal.set(false);
      } catch (error) {
        console.error('Error processing file for external AI:', error);
        this.geminiService.error.set((error as Error).message);
        this.showAiChoiceModal.set(false);
        this.clearFile();
      } finally {
        this.isProcessingFile.set(false);
      }
    }
  }

  async startFlow(): Promise<void> {
    if (this.isGenerationDisabled()) {
      return;
    }
    
    if (this.generationMode() === 'external_ai') {
      if (this.externalAiStep() === 1) {
          this.externalAiStep.set(2);
      } else {
          this.startGenerationFromJson();
      }
    } else {
      const preferredCategory = this.userPreferenceService.getPreferredThemeCategory();
      if (preferredCategory && this.themeCategories().includes(preferredCategory)) {
        this.selectedThemeCategory.set(preferredCategory);
      } else {
        this.selectedThemeCategory.set('All');
      }
      this.view.set('theme');

      // Get AI Theme Suggestions
      this.aiSuggestedThemes.set(null);
      this.isSuggestingThemes.set(true);
      const topicForSuggestion = this.generationMode() === 'document' 
        ? this.uploadedFile()?.name ?? 'document-based presentation'
        : this.topic();

      if (topicForSuggestion) {
        try {
          const suggestedNames = await this.geminiService.suggestThemes(topicForSuggestion);
          if (suggestedNames) {
            const suggested = this.themes().filter(t => suggestedNames.includes(t.name));
            this.aiSuggestedThemes.set(suggested);
          }
        } catch (e) {
            console.error("Failed to get AI theme suggestions:", e);
            this.aiSuggestedThemes.set([]); // Set to empty array to hide the section on failure.
        } finally {
            this.isSuggestingThemes.set(false);
        }
      } else {
        this.isSuggestingThemes.set(false);
      }
    }
  }

  async startGeneration(theme: Theme): Promise<void> {
    this.userPreferenceService.trackThemeCategorySelection(theme.category);
    
    let originalTopic = '';
    
    try {
        switch(this.generationMode()) {
            case 'document':
                this.view.set('generating');
                const file = this.uploadedFile();
                if (!file) throw new Error("No file selected for document generation.");
                this.isProcessingFile.set(true);
                const documentText = await this.documentProcessorService.processFile(file);
                this.isProcessingFile.set(false);
                originalTopic = file.name;
                const docStream = this.geminiService.generatePresentationFromDocument(documentText, this.slideCount(), this.language(), originalTopic);
                await this.beginStreamingGeneration(docStream, originalTopic, theme);
                break;
            case 'standard':
            default:
                this.view.set('generating');
                originalTopic = this.topic();
                const standardStream = this.geminiService.generatePresentationLive(
                    this.topic(), this.slideCount(), this.audience(), this.language(), this.useGoogleSearch(), this.highQuality()
                );
                await this.beginStreamingGeneration(standardStream, originalTopic, theme);
                break;
        }

    } catch (error) {
        console.error("Failed during presentation generation:", error);
        this.geminiService.error.set((error as Error).message);
        this.view.set('landing');
    } finally {
        this.isProcessingFile.set(false);
    }
  }

  async startGenerationFromJson(): Promise<void> {
    this.view.set('generating');
    const jsonString = this.jsonInput();

    try {
        if (!jsonString) {
            throw new Error("JSON input is empty.");
        }

        const jsonMatch = jsonString.match(/```json\s*([\s\S]*?)\s*```|({[\s\S]*})/);
        if (!jsonMatch) {
            throw new Error("Invalid format. Could not find a JSON object in the provided text.");
        }
        let parsableJson = jsonMatch[1] || jsonMatch[2];
        parsableJson = this.cleanJsonString(parsableJson);
        const parsed = JSON.parse(parsableJson) as Partial<Presentation>;

        if (!parsed.title || !Array.isArray(parsed.slides)) {
            throw new Error("The provided JSON is missing required fields: title or slides.");
        }

        let presentationTheme: Theme;

        if (parsed.theme) {
            const requiredThemeProps: (keyof Theme)[] = ['name', 'category', 'primaryColor', 'backgroundColor', 'textColor', 'titleFont', 'bodyFont'];
            const isValidTheme = requiredThemeProps.every(prop => typeof (parsed.theme as any)[prop] === 'string');
            
            if (isValidTheme) {
                presentationTheme = parsed.theme;
                this.addNewTheme(presentationTheme);
                this.userPreferenceService.trackThemeCategorySelection(presentationTheme.category);
            } else {
                console.warn("Provided theme object is invalid. Falling back to default.");
                presentationTheme = THEME_PRESETS[0];
            }
        } else {
            // Fallback for older JSON formats without a theme
            presentationTheme = THEME_PRESETS[0];
        }
        
        const finalPresentation: Presentation = {
            id: crypto.randomUUID(),
            originalTopic: parsed.title,
            language: this.language(),
            title: parsed.title,
            slides: parsed.slides,
            theme: presentationTheme, 
            sources: parsed.sources,
        };
        
        await new Promise(res => setTimeout(res, 500));
        
        this.presentation.set(finalPresentation);
        await this.backendService.savePresentation(finalPresentation);
        this.history.set(await this.backendService.getHistory());
        this.view.set('editor');

    } catch (error) {
        console.error("Failed during JSON parsing/generation:", error);
        this.geminiService.error.set(`Failed to create presentation from JSON: ${(error as Error).message}`);
        this.view.set('landing');
    }
  }
  
  private async beginStreamingGeneration(stream: AsyncGenerator<PresentationStreamEvent, void, unknown>, originalTopic: string, theme: Theme): Promise<void> {
    // Clear the image generation queue for this new presentation
    this.imageGenerationQueue = [];
    this.isProcessingImageQueue.set(false);

    const pres: Presentation = {
      id: crypto.randomUUID(),
      title: 'Generating...',
      originalTopic,
      slides: Array(this.slideCount()).fill({ title: '', content: '', layout: 'content_left', imagePrompt: '' }),
      theme: theme,
      language: this.language(),
      generationProgress: { lastCompletedSlide: 0, totalSlides: this.slideCount() }
    };
    this.presentation.set(pres);
    await this.processGenerationStream(stream, pres);
  }

  private async processImageQueue(): Promise<void> {
    if (this.isProcessingImageQueue() || this.imageGenerationQueue.length === 0) {
      return; // Already processing or the queue is empty
    }
  
    this.isProcessingImageQueue.set(true);
  
    const slideIndex = this.imageGenerationQueue.shift(); // Get the next item
  
    if (slideIndex !== undefined) {
      this.generateImageForSlide(slideIndex);
    }
  
    this.isProcessingImageQueue.set(false);
    // After starting one, immediately check if there's more in the queue.
    // The service will handle the actual throttling.
    this.processImageQueue();
  }

  private async generateImageForSlide(slideIndex: number): Promise<void> {
    const currentPresentation = this.presentation();
    if (!currentPresentation) return;
  
    const slide = currentPresentation.slides[slideIndex];
    if (!slide || !slide.imagePrompt || slide.layout === 'section_header' || slide.layout === 'title' || slide.layout === 'conclusion' || slide.layout === 'quote') {
      return; // Don't generate images for certain layout types
    }
  
    // Set generating state for the specific slide
    this.presentation.update(p => {
      if (!p) return null;
      const newSlides = [...p.slides];
      newSlides[slideIndex] = { ...newSlides[slideIndex], isGeneratingImage: true };
      return { ...p, slides: newSlides };
    });
  
    // Call Gemini API to generate image; the service now handles queueing and throttling.
    const imageUrl = await this.geminiService.generateImageFromPrompt(slide.imagePrompt, 'Cinematic Photo', '16:9');
  
    // Update the slide with the new image URL
    this.presentation.update(p => {
      if (!p) return null;
      const newSlides = [...p.slides];
      // Ensure the slide hasn't been changed by another process
      if (newSlides[slideIndex]) {
        newSlides[slideIndex] = { ...newSlides[slideIndex], imageUrl: imageUrl || undefined, isGeneratingImage: false };
      }
      return { ...p, slides: newSlides };
    });
  }

  private async processGenerationStream(stream: AsyncGenerator<PresentationStreamEvent, void, unknown>, initialPresentation: Presentation) {
      let finalTitle: string = initialPresentation.title;
      let finalSources: Source[] | undefined = undefined;

      for await (const event of stream) {
        if (event.type === 'title') {
          finalTitle = event.title;
          this.presentation.update(p => p ? { ...p, title: event.title } : p);
        } else if (event.type === 'slide') {
          this.presentation.update(p => {
            if (!p) return null;
            const newSlides = [...p.slides];
            if (event.index < newSlides.length) {
                newSlides[event.index] = event.data;
            } else {
                newSlides.push(event.data);
            }
            return { ...p, slides: newSlides, generationProgress: { lastCompletedSlide: event.index + 1, totalSlides: p.generationProgress?.totalSlides || 0 }};
          });
          const liveGen = this.liveGenerationComponent();
          if (liveGen) {
            await liveGen.writeSlide(event.index, event.data);
          }
          // Add slide to the image generation queue and kick off the processor.
          this.imageGenerationQueue.push(event.index);
          this.processImageQueue();
        } else if (event.type === 'sources') {
          finalSources = event.sources;
        }
      }

      const generatedPresentation = this.presentation();
      if (!generatedPresentation) return;

      let finalSlides = generatedPresentation.slides.filter(s => s && s.title);

      if (finalSources && finalSources.length > 0) {
        const LINKS_PER_SLIDE = 12; // 6 links per column
        const sourceChunks: Source[][] = [];
        for (let i = 0; i < finalSources.length; i += LINKS_PER_SLIDE) {
          sourceChunks.push(finalSources.slice(i, i + LINKS_PER_SLIDE));
        }

        sourceChunks.forEach((chunk, index) => {
          const sourceSlide: Slide = {
            title: index === 0 ? "Sources" : "Sources (continued)",
            layout: 'two_column',
            content: chunk.map(source => `${source.title} - ${source.uri}`),
            imagePrompt: "A subtle, professional, abstract background with clean lines and a soft, neutral color palette. Minimalist and elegant. No text, no words, no letters.",
            isSourceSlide: true,
            rating: null
          };
          finalSlides.push(sourceSlide);
        });
      }

      const finalPresentation: Presentation = {
        ...generatedPresentation,
        title: finalTitle,
        slides: finalSlides,
        sources: finalSources,
      };

      this.presentation.set(finalPresentation);
      await this.backendService.savePresentation(finalPresentation);
      this.history.set(await this.backendService.getHistory());
      this.view.set('editor');
  }

  handlePresentationChange(updatedPresentation: Presentation): void {
    this.presentation.set(updatedPresentation);
  }

  exitToLanding(): void {
    this.presentation.set(null);
    this.setGenerationMode('standard');
    this.view.set('landing');
  }

  async loadFromHistory(item: HistoryItem): Promise<void> {
    const pres = await this.backendService.loadPresentation(item.id);
    if (pres) {
      this.presentation.set(pres);
      this.view.set('editor');
    }
  }

  addNewTheme(theme: Theme): void {
    this.themes.update(currentThemes => {
      if (!currentThemes.some(t => t.name === theme.name)) {
        return [theme, ...currentThemes];
      }
      return currentThemes;
    });
  }
}