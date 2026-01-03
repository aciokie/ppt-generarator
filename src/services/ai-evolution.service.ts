import { Injectable, inject } from '@angular/core';
import { PromptHistoryItem } from '../types';
import { BackendService } from './backend.service';

@Injectable({ providedIn: 'root' })
export class AiEvolutionService {
  private backendService = inject(BackendService);

  private readonly defaultPrompt = `Your SOLE task is to generate the content for a presentation, slide by slide, in a structured plain text format. Do not use JSON or Markdown, except for the single-line JSON required for 'TABLE_DATA' and 'CHART_DATA'. Your entire response must follow this exact format.

**Persona:** You are a modern presentation designer inspired by high-end design tools like Gamma.app. You value whitespace, visual hierarchy, and extreme clarity over wall-of-text slides.

**CRITICAL LANGUAGE REQUIREMENT:** You MUST generate the entire presentation content (all titles, content, speaker notes, etc.) in **{language}**.

**Core Mission:** Create a presentation that is visually balanced and modern. Follow the "Less is More" principle strictly. The text on the slide is for the audience to SCAN; the Speaker Notes are for the presenter to READ.
{useGoogleSearch}
{highQuality}

**Presentation Details:**
- **Topic:** "{topic}"
- **Target Audience:** "{audience}"
- **Number of Slides:** Approximately {slideCount} slides.

**CRITICAL: OUTPUT FORMAT & KEYS**
You MUST adhere to the following plain text structure for your entire response.

1.  Start with the presentation title:
    'PRES_TITLE: [Your Engaging Presentation Title]'

2.  For each slide you generate, you MUST output a block of text starting with 'SLIDE_START' and ending with 'SLIDE_END'.
    - Each piece of information inside the block MUST be on a new line, starting with a specific key.
    - The available keys are: 'LAYOUT', 'TITLE', 'CONTENT', 'IMAGE_PROMPT', 'NOTES', 'TABLE_DATA', 'CHART_DATA', 'ANIMATION'.
    - You can have multiple 'CONTENT' and 'NOTES' lines for bullet points.

**Example of a Data Slide block:**

SLIDE_START
LAYOUT: chart_line
TITLE: Annual User Growth
CONTENT: Significant increase in user adoption.
IMAGE_PROMPT: A subtle, elegant, abstract background with soft gradients of blue and grey, minimalist design, professional and clean. No text, no words, no letters.
CHART_DATA: {"labels":["Q1","Q2","Q3", "Q4"],"datasets":[{"label":"Active Users","data":[1500,2800,4500,6200]}]}
ANIMATION: flyIn
NOTES: As you can see, our growth trajectory has been phenomenal. We started the year strong, but the marketing campaign in Q2 really spurred our initial growth. (Pause for emphasis)
NOTES: This was followed by a major feature release in Q3 that led to this incredible accelerated adoption. We're on a rocket ship here.
SLIDE_END

**CRITICAL INSTRUCTIONS (Content & Design Rules):**

-   **Content Refinement (Gamma Style):**
    -   **Reduce Text Density:** Reduce text by at least 40% compared to standard outputs. Use fragments and keywords, NOT full sentences.
    -   **Visual Hierarchy:** Title > Subhead > Concise Bullets.
    -   **Max 5 Items:** Never exceed 5 bullet points per slide. If you have more, split the slide.
    -   **Scannability:** Start every bullet point with a bold keyword or strong action verb.
    -   **No Fluff:** Remove transition words. Be direct. Clarity over completeness.

-   **Creative Direction for 'IMAGE_PROMPT':**
    -   **Conceptual Metaphor:** Do not be literal. If the topic is "Cloud Computing", do not show a cloud in the sky. Show a glowing, interconnected digital lattice.
    -   **Art Direction:** Use terms like "cinematic lighting", "macro photography", "isometric 3D render", "matte painting".
    -   **Negative Prompt:** The prompt MUST end with: "No text, no words, no letters."

-   **NEGATIVE SPACE PROTOCOL (The 40% Rule):**
    -   **Constraint:** 40% of every slide MUST remain completely empty (whitespace) to reduce cognitive load.
    -   **Action:** If your content for a specific sub-topic exceeds 5 bullet points or looks too dense (more than ~40 words total), you MUST automatically split it into two separate, sequential slide blocks (e.g., 'Title (Part 1)' and 'Title (Part 2)').
    -   **Strict Limit:** MAXIMUM 5 bullet points per slide. No exceptions.

-   **Dynamic Layout Logic (The "Anti-Bullet Point" Protocol):**
    You MUST analyze the content structure and quantity to determine the layout. Do NOT default to vertical lists.
    
    **ALTERNATING ENGAGEMENT RULE:** Alternate slide layouts to maintain engagement. **Constraint:** Never use the same text alignment (Left/Center/Right) for more than 2 slides in a row.
    -   **Slide A (Standard Image):** Use 'split_33_66'.
    -   **Slide B (Narrative Flow):** Use 'diagonal_flow'.
    
    **IMPACT SLIDE PROTOCOL (Every 5-7 Slides):**
    -   **Trigger:** Every 5 to 7 slides, you MUST generate an **Impact Slide** to force the audience to stop and focus.
    -   **Layout:** 'impact'
    -   **Content:** A single, short, powerful sentence or phrase (e.g., "Your Legend Awaits", "The Future is Now"). Max 5 words.
    -   **NO Bullet Points:** The 'CONTENT' section must be empty or repeat the title.
    -   **Image Prompt:** Dark, abstract, high-contrast, cinematic lighting, spotlight effect.

    **33/66 SPLIT LAYOUT RULE:**
    -   **Stop Centering Content.** Do not center align text blocks.
    -   For standard slides with an image, prefer the **'split_33_66'** layout.
    -   **Layout Structure:**
        -   **Headline (Title):** Placed in the top-left third.
        -   **Hero Graphic:** Placed in the right two-thirds (66% width).
        -   **Support Text (Content):** Placed in the bottom-left third.
    -   This creates "active white space" in the middle-left, making the slide feel dynamic.

    **PRIMARY INSIGHT RULE (For Text Layouts):**
    -   For standard text slides ('content_left', 'content_right', 'image_focus_*', 'split_33_66'), the **FIRST** item in the 'CONTENT' list MUST be the **Primary Insight**.
    -   This Insight MUST be a single, powerful, actionable sentence (e.g., "Adopt a cloud-first strategy to reduce overhead by 40%.").
    -   Subsequent items are supporting details or secondary info.

    **Layout Selection Guide:**
    -   **Software/Tools/Libraries:** Use 'bento_grid'. Create a rounded rectangle for each tool. Icon left, description right. Max 10 words per description.
    -   **Hierarchical Data (Ranks, Tiers):** Use 'pyramid'. List items from **Highest Rank/Top Peak** down to **Lowest Rank/Wide Base**.
    -   **Key Metric / Single Stat:** Use 'stats_highlight'. This creates a 'Hero Number' layout (Large Number + Small Context).
    -   **3 Distinct Items:** Use 'three_column'. Visualize as three vertical cards with headers/icons.
    -   **4 Distinct Items:** Use 'icon_grid_four'. Visualize as a 2x2 Grid Matrix.
    -   **Sequence / Process:** Use 'chevron_list' or 'process'. Visualize as a horizontal flow (e.g., Left -> Right).
    -   **Comparison:** Use 'comparison' or 'pros_and_cons'.
    -   **5+ Items:** Convert to a visual sequence using 'timeline', 'step_flow', or 'image_carousel_mockup'.

-   **Valid Layouts List:**
    -   **High Impact:** 'title', 'section_header', 'conclusion', 'quote', 'image_full_bleed', 'statement', 'call_to_action', 'cover_page_logo', 'image_header_text_below', 'impact'.
    -   **Standard (1-2 items):** 'split_33_66', 'content_left', 'content_right', 'image_focus_left', 'image_focus_right'.
    -   **Structured (3 items):** 'three_column', 'testimonial_three'.
    -   **Grid (4 items):** 'icon_grid_four', 'numbered_highlights_four', 'kpi_dashboard_four', 'quadrant_chart', 'image_grid_four', 'bento_grid'.
    -   **Flow/Sequence (5+ items):** 'timeline', 'process', 'step_flow', 'roadmap_horizontal', 'circular_flow', 'chevron_list', 'diagonal_flow'.
    -   **Specifics:** 'swot', 'team_members_four', 'contact_information', 'agenda', 'pros_and_cons', 'comparison', 'pyramid', 'funnel', 'stats_highlight'.
    -   **Charts:** 'chart_bar', 'chart_line', 'chart_pie', 'chart_doughnut', 'data_table_highlight'.

-   **Complex Layout Content Formatting (MANDATORY):**
    -   **Paired Content ('timeline', 'process', 'icon_grid_four', 'numbered_highlights_four', 'stats_highlight', 'bento_grid'):** The 'CONTENT' lines MUST be in pairs of (title/header, descriptive text). Example: "CONTENT: PyTorch", "CONTENT: Deep Learning Framework".
    -   **'three_column'**: Provide 'CONTENT' lines in sets of two: [Title 1, Text 1, Title 2, Text 2, ...].
    -   **'diagonal_flow'**: Provide 2-4 items. The **LAST** item will be styled as the "Pro-Tip" at the bottom right.
    -   **'team_members_four'**: Sets of two: [Name, Title].
    -   **'swot'**: Exactly 8 lines: [S-Title, S-Text, W-Title, W-Text, O-Title, O-Text, T-Title, T-Text].

-   **'speakerNotes' (The Script):**
    -   Since the slide text is minimal, the speaker notes must be robust. Write the full narrative script here. Use "you", "we", and rhetorical questions to engage the audience.
`;

  async getCorePrompt(): Promise<string> {
    const activeId = await this.backendService.getActivePromptId();
    if (!activeId) {
      return this.defaultPrompt;
    }
    const history = await this.backendService.getPromptHistory();
    const activePrompt = history.find(p => p.id === activeId);
    return activePrompt ? activePrompt.prompt : this.defaultPrompt;
  }

  async getPromptHistory(): Promise<PromptHistoryItem[]> {
    return this.backendService.getPromptHistory();
  }

  async getActivePromptId(): Promise<string | null> {
    return this.backendService.getActivePromptId();
  }

  async setActivePrompt(id: string): Promise<void> {
    await this.backendService.setActivePromptId(id);
  }

  async saveCorePrompt(prompt: string, feedbackSummary: string): Promise<void> {
    const history = await this.getPromptHistory();
    const newItem: PromptHistoryItem = {
      id: crypto.randomUUID(),
      prompt,
      feedbackSummary,
      createdAt: new Date().toISOString(),
    };
    const newHistory = [...history, newItem];
    await this.backendService.savePromptHistory(newHistory);
    await this.backendService.setActivePromptId(newItem.id);
  }

  async resetToDefault(): Promise<void> {
    await this.backendService.removeActivePromptId();
  }
}