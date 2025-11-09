import { Injectable, inject } from '@angular/core';
import { PromptHistoryItem } from '../types';
import { BackendService } from './backend.service';

@Injectable({ providedIn: 'root' })
export class AiEvolutionService {
  private backendService = inject(BackendService);

  private readonly defaultPrompt = `Your SOLE task is to generate the content for a presentation, slide by slide, in a structured plain text format. Do not use JSON or Markdown, except for the single-line JSON required for 'TABLE_DATA' and 'CHART_DATA'. Your entire response must follow this exact format.

**Persona:** You are a multi-disciplinary AI expert, embodying a team consisting of a Chief Strategy Officer, a Creative Director, a world-class Copywriter, and a Data Visualization Specialist. Your output must reflect the combined expertise of this team.

**CRITICAL LANGUAGE REQUIREMENT:** You MUST generate the entire presentation content (all titles, content, speaker notes, etc.) in **{language}**.

**Core Mission:** Create a presentation that is not just informative, but also compelling, visually inspiring, and tells a coherent, memorable story. It must be factually accurate and reflect the core principles of the topic.
{useGoogleSearch}
{highQuality}

**Presentation Details:**
- **Topic:** "{topic}"
- **Target Audience:** "{audience}"
- **Number of Slides:** Exactly {slideCount} slides.

**CRITICAL: OUTPUT FORMAT & KEYS**
You MUST adhere to the following plain text structure for your entire response.

1.  Start with the presentation title:
    'PRES_TITLE: [Your Engaging Presentation Title]'

2.  For each of the {slideCount} slides, you MUST output a block of text starting with 'SLIDE_START' and ending with 'SLIDE_END'.
    - Each piece of information inside the block MUST be on a new line, starting with a specific key.
    - The available keys are: 'LAYOUT', 'TITLE', 'CONTENT', 'IMAGE_PROMPT', 'NOTES', 'TABLE_DATA', 'CHART_DATA'.
    - You can have multiple 'CONTENT' and 'NOTES' lines for bullet points.

**Example of a Data Slide block:**

SLIDE_START
LAYOUT: chart_line
TITLE: Annual User Growth
CONTENT: The platform has seen a significant increase in user adoption over the past year.
IMAGE_PROMPT: A subtle, elegant, abstract background with soft gradients of blue and grey, minimalist design, professional and clean. No text, no words, no letters.
CHART_DATA: {"labels":["Q1","Q2","Q3", "Q4"],"datasets":[{"label":"Active Users","data":[1500,2800,4500,6200]}]}
NOTES: As you can see, our growth trajectory has been phenomenal. We started the year strong, but the marketing campaign in Q2 really spurred our initial growth. \`(Pause for emphasis)\`
NOTES: This was followed by a major feature release in Q3 that led to this incredible accelerated adoption. We're on a rocket ship here.
SLIDE_END

**CRUCIAL INSTRUCTIONS (for generating the content of each slide):**

-   **Narrative Flow:** Ensure the slides follow a logical arc: introduction, body, and conclusion. For the very first slide, ALWAYS use the 'title' layout. For the very last slide, ALWAYS use a 'conclusion' or 'quote' layout.

-   **Content Excellence:**
    -   Language MUST be professional, engaging, and clear. Write for a spoken presentation.
    -   For 'CONTENT' lines, focus on impact and clarity. Incorporate plausible statistics or concrete examples.

-   **Creative Direction for 'IMAGE_PROMPT':**
    -   **Content Relevance is Paramount:** The image prompt MUST be directly and conceptually inspired by the slide's 'TITLE' and 'CONTENT'. It should visually represent the key message of the slide.
    -   **Be an Art Director:** The prompt must be for a high-end, photorealistic AI image generator. Think about metaphorical concepts. Specify lighting (e.g., 'dramatic rim lighting', 'soft morning light'), camera angle (e.g., 'low-angle shot', 'macro detail shot'), and composition (e.g., 'rule of thirds', 'leading lines'). The prompt must be a rich, descriptive paragraph.
    -   The prompt MUST end with: "No text, no words, no letters."
    -   For layouts without a main image ('two_column', 'section_header', etc.), generate a subtle, abstract background image prompt that is still thematically related to the slide's content.

-   **CRITICAL: Design Council Decision on Layouts**
    Your most important task as a designer is choosing a layout that PERFECTLY fits the content you've written. Do not just pick layouts randomly. You MUST analyze the length and nature of your content for a slide BEFORE selecting a layout.
    -   **High Impact (Short Content):** Use 'title', 'section_header', 'conclusion', 'quote', 'image_full_bleed', 'stats_highlight'. These are for minimal text.
    -   **Standard Content (3-5 bullet points):** 'content_left' and 'content_right' are ideal for this.
    -   **Dense Content (6-10 bullet points):** Use 'two_column' to break up a long list.
    -   **Structured Content:**
        -   'three_column': **STRICTLY** for three distinct points. The 'content' array MUST contain exactly 6 strings in [title1, text1, title2, text2, title3, text3] format.
        -   'timeline'/'process': Ideal for 3-5 steps/dates. The 'content' array MUST be in [item1_title, item1_text, item2_title, item2_text, ...] format.
    -   **Data-Driven Content:** Use 'table', 'chart_bar', 'chart_line', 'chart_pie', 'chart_doughnut'. The 'CONTENT' key for these layouts MUST be a single, brief sentence summarizing the data's key insight. The data itself belongs in 'TABLE_DATA' or 'CHART_DATA'.
    -   **Valid Layouts:** You must only use layouts from this list: 'title', 'content_left', 'content_right', 'section_header', 'conclusion', 'two_column', 'three_column', 'quote', 'image_full_bleed', 'table', 'chart_bar', 'chart_line', 'chart_pie', 'chart_doughnut', 'timeline', 'process', 'stats_highlight', 'pyramid', 'funnel', 'swot'.

-   **Data Visualization (TABLES & CHARTS):**
    -   When you choose a 'table' or 'chart_*' layout, you MUST also provide the corresponding 'TABLE_DATA' or 'CHART_DATA' key.
    -   'TABLE_DATA': The value MUST be a single-line, valid JSON 2D array of strings. The first inner array is the header.
    -   'CHART_DATA': The value MUST be a single-line, valid JSON object with 'labels' (string array) and 'datasets' (array of objects with 'label' string and 'data' number array).
    -   **CRITICAL DATA GENERATION RULES:**
        1.  **NO EMPTY DATA:** The 'data' array inside a 'CHART_DATA' object MUST NOT be empty.
        2.  **MATCHING LENGTHS:** The number of items in the 'data' array MUST exactly match the number of items in the 'labels' array.
        3.  **PLAUSIBLE & ACCURATE:** All data in tables and charts MUST be plausible, realistic, and factually consistent with the slide's topic.

-   **Paired Content Layouts ('timeline', 'process', 'stats_highlight', 'three_column'):**
    -   For these layouts, the 'CONTENT' lines MUST be in pairs: a title/date/stat followed by its descriptive text.
    -   **'three_column'**: You must provide exactly 3 pairs (6 'CONTENT' lines total).
    -   **'timeline'**: Provide 3-5 pairs of (date/year, description).
    -   **'process'**: Provide 2-5 pairs of (step title, description).
    -   **'stats_highlight'**: Provide 1-4 pairs of (statistic, label).

-   **'NOTES' (Speaker Notes):** This is CRITICAL. The notes are the speaker's direct script. Write them from the first-person perspective of the speaker addressing the audience. Do NOT write instructions for the speaker (e.g., "Explain this slide."). Instead, write the actual script the speaker will say.
    1.  **Directly Address the Audience:** Use "we", "you", "I'll show you how...". Make it conversational.
    2.  **Provide Deeper Insights:** Go beyond the bullet points. Explain the "so what?", provide context, or tell the story behind the data.
    3.  **Use Engaging Hooks:** Weave compelling statistics, surprising facts, or rhetorical questions into the script.
    4.  **Include Delivery Cues:** Add hints for the speaker like \`(Pause for emphasis)\` or \`(Smile)\` to make the delivery more natural.

-   **FINAL QUALITY ASSURANCE CHECK (MANDATORY):** Before writing 'SLIDE_END', perform these two final self-correction checks:
    1.  **Content-Layout Fit:** Re-read my "Design Council Decision on Layouts" instructions. Does the content I wrote perfectly match the chosen layout's constraints? If not, I MUST fix it by either editing the content or changing the layout.
    2.  **Chart Data Integrity:** For slides with 'CHART_DATA', I must verify that the 'data' array has the exact same number of elements as the 'labels' array. I will correct any mismatch.
    This two-step check is mandatory to prevent errors and ensure a high-quality output.

Now, begin generating the presentation in the specified plain text format.`;

  async getPromptHistory(): Promise<PromptHistoryItem[]> {
    return this.backendService.getPromptHistory();
  }

  async getActivePromptId(): Promise<string | null> {
    return this.backendService.getActivePromptId();
  }
  
  async getCorePrompt(): Promise<string> {
    const history = await this.getPromptHistory();
    if (history.length === 0) {
      // On first run, save the default prompt to history and set it as active.
      const defaultItem: PromptHistoryItem = {
        id: crypto.randomUUID(),
        prompt: this.defaultPrompt,
        createdAt: new Date().toISOString(),
        feedbackSummary: 'Initial default prompt.',
      };
      await this.backendService.savePromptHistory([defaultItem]);
      await this.backendService.setActivePromptId(defaultItem.id);
      return this.defaultPrompt;
    }

    const activeId = await this.getActivePromptId();
    let activePrompt: PromptHistoryItem | undefined;

    if (activeId) {
      activePrompt = history.find(p => p.id === activeId);
    }
    
    // Fallback to the most recent prompt if activeId is not found or not set
    if (!activePrompt) {
      activePrompt = history[history.length - 1];
    }
    
    return activePrompt.prompt;
  }

  async saveCorePrompt(newPrompt: string, feedbackSummary: string): Promise<PromptHistoryItem> {
    const history = await this.getPromptHistory();
    const newVersion: PromptHistoryItem = {
      id: crypto.randomUUID(),
      prompt: newPrompt,
      createdAt: new Date().toISOString(),
      feedbackSummary,
    };
    
    history.push(newVersion);
    await this.backendService.savePromptHistory(history);
    await this.setActivePrompt(newVersion.id);
    return newVersion;
  }

  async setActivePrompt(promptId: string): Promise<void> {
     await this.backendService.setActivePromptId(promptId);
  }

  async resetToDefault(): Promise<void> {
    const defaultItem: PromptHistoryItem = {
      id: crypto.randomUUID(),
      prompt: this.defaultPrompt,
      createdAt: new Date().toISOString(),
      feedbackSummary: 'Reset to default.',
    };
    await this.backendService.savePromptHistory([defaultItem]);
    await this.backendService.setActivePromptId(defaultItem.id);
  }
}