import { Component, ChangeDetectionStrategy, input, output, signal, computed, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Presentation, Slide, Theme, SlideLayout, PromptHistoryItem } from '../../types';
import { SlideComponent } from '../slide/slide.component';
import { GeminiService } from '../../services/gemini.service';
import { UndoRedoService } from '../../services/undo-redo.service';
import { PresentationViewComponent } from '../presentation-view/presentation-view.component';
import { ChatbotComponent } from '../chatbot/chatbot.component';
import { AiEvolutionService } from '../../services/ai-evolution.service';

// Declare external libraries loaded via script tags
declare var PptxGenJS: any;
declare var jspdf: any;
declare var html2canvas: any;
declare var JSZip: any;

type AutosaveStatus = 'idle' | 'saving' | 'saved';
type ContentImprovementInfo = { field: 'title' | 'content' | 'speakerNotes', index?: number, text: string };
type ImageEditInfo = { slideIndex: number; currentPrompt: string; style: string; aspectRatio: string };

@Component({
  selector: 'app-presentation-editor',
  imports: [CommonModule, SlideComponent, FormsModule, PresentationViewComponent, ChatbotComponent],
  templateUrl: './presentation-editor.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PresentationEditorComponent {
  presentation = input.required<Presentation | null>();
  availableFonts = input.required<string[]>();
  presentationChange = output<Presentation>();
  exitEditor = output<void>();
  themeGenerated = output<Theme>();

  // Services
  geminiService = inject(GeminiService);
  undoRedoService = inject(UndoRedoService);
  aiEvolutionService = inject(AiEvolutionService);

  // UI State
  currentSlideIndex = signal(0);
  isDownloadMenuOpen = signal(false);
  downloadState = signal<'idle' | 'pptx' | 'pdf' | 'png' | 'txt'>('idle');
  autosaveStatus = signal<AutosaveStatus>('idle');
  isRightSidebarOpen = signal(true);
  rightSidebarTab = signal<'notes' | 'actions' | 'layouts'>('notes');
  animationClass = signal('');
  transitioningSlide = signal<{ slide: Slide; animation: string } | null>(null);
  isPresenting = signal(false);
  sidebarView = signal<'thumbnails' | 'outline'>('thumbnails');
  private draggedSlideIndex = signal<number | null>(null);
  private dropTargetIndex = signal<number | null>(null);

  private lastSeenPresentationId = signal<string | undefined>(undefined);
  private debounceTimeout: any;

  // Modals State
  isThemeEditorOpen = signal(false);
  isAddSlideAiOpen = signal(false);
  isContentImproverOpen = signal(false);
  isBulkImproverOpen = signal(false);
  isImageEditModalOpen = signal(false);
  isChatbotOpen = signal(false);
  isAiEvolutionModalOpen = signal(false);

  // Feature-specific State
  aiThemePrompt = signal('');
  newSlideTopic = signal('');
  contentToImproveInfo = signal<ContentImprovementInfo | null>(null);
  bulkImprovementTarget = signal<'bulletPoints' | 'speakerNotes' | null>(null);
  imageToEditInfo = signal<ImageEditInfo | null>(null);
  imageEditInstruction = signal('');
  aiCorePrompt = signal('');
  evolutionFeedbackSummary = signal('');
  promptHistory = signal<PromptHistoryItem[]>([]);
  activePromptId = signal<string | null>(null);
  selectedPromptFromHistory = signal<PromptHistoryItem | null>(null);
  isEvolving = signal(false);
  newlyEvolvedPrompt = signal<string | null>(null);
  
  readonly ratingReasons = ['Boring Content', 'Irrelevant Image', 'Poor Layout', 'Too much text', 'Factually Incorrect', 'Typos/Grammar'];
  badRatingInfo = signal<{ slideIndex: number, reasons: Record<string, boolean> } | null>(null);
  
  readonly colorSwatches = {
    primaryColor: ['#2563eb', '#db2777', '#16a34a', '#f97316', '#8b5cf6', '#f59e0b', '#ef4444', '#14b8a6'],
    backgroundColor: ['#ffffff', '#f9fafb', '#f3f4f6', '#e5e7eb', '#111827', '#1f2937', '#262626', '#0c243b'],
    textColor: ['#1f2937', '#374151', '#4b5563', '#6b7280', '#d1d5db', '#f9fafb', '#e5e5e5', '#e0f2fe'],
  };

  readonly availableLayouts: { name: SlideLayout; displayName: string; description: string; icon: string }[] = [
    // Original
    { name: 'title', displayName: 'Title', description: 'A standard title and subtitle slide.', icon: 'title' },
    { name: 'section_header', displayName: 'Section Header', description: 'A bold header to introduce a new section.', icon: 'article' },
    { name: 'content_left', displayName: 'Content Left', description: 'Content on the left, media on the right.', icon: 'vertical_split' },
    { name: 'content_right', displayName: 'Content Right', description: 'Media on the left, content on the right.', icon: 'flip_to_back' },
    { name: 'two_column', displayName: 'Two Column', description: 'Splits content into two readable columns.', icon: 'view_column' },
    { name: 'three_column', displayName: 'Three Column', description: 'Three distinct points with titles and text.', icon: 'view_module' },
    { name: 'quote', displayName: 'Quote', description: 'Highlight an impactful quote.', icon: 'format_quote' },
    { name: 'image_full_bleed', displayName: 'Image Full Bleed', description: 'A full-screen image with overlayed text.', icon: 'image' },
    { name: 'stats_highlight', displayName: 'Stats Highlight', description: 'Showcase key numbers or statistics.', icon: 'equalizer' },
    { name: 'comparison', displayName: 'Comparison', description: 'A side-by-side comparison of two items.', icon: 'compare_arrows' },
    { name: 'team_members_four', displayName: 'Team Members', description: 'Showcase up to four team members.', icon: 'groups' },
    { name: 'timeline', displayName: 'Timeline', description: 'Display events in chronological order.', icon: 'timeline' },
    { name: 'process', displayName: 'Process', description: 'Illustrate a step-by-step process.', icon: 'account_tree' },
    { name: 'pyramid', displayName: 'Pyramid', description: 'Show hierarchical relationships.', icon: 'signal_cellular_alt' },
    { name: 'funnel', displayName: 'Funnel', description: 'Visualize stages in a process, like sales.', icon: 'filter_list' },
    { name: 'swot', displayName: 'SWOT', description: 'A 2x2 grid for SWOT analysis.', icon: 'grid_view' },
    { name: 'radial_diagram', displayName: 'Radial Diagram', description: 'A central topic with radiating points.', icon: 'explore' },
    { name: 'step_flow', displayName: 'Step Flow', description: 'A horizontal flow of steps or stages.', icon: 'double_arrow' },
    { name: 'table', displayName: 'Table', description: 'Display structured data in a table format.', icon: 'table_chart' },
    { name: 'chart_bar', displayName: 'Bar Chart', description: 'Visualize categorical data with bar charts.', icon: 'bar_chart' },
    { name: 'chart_line', displayName: 'Line Chart', description: 'Show trends over time with a line chart.', icon: 'show_chart' },
    { name: 'chart_pie', displayName: 'Pie Chart', description: 'Represent proportions with a pie chart.', icon: 'pie_chart' },
    { name: 'chart_doughnut', displayName: 'Doughnut Chart', description: 'A pie chart with a hole, for proportions.', icon: 'donut_small' },
    { name: 'conclusion', displayName: 'Conclusion', description: 'A final, concluding slide.', icon: 'flag' },
    // Advanced
    { name: 'image_overlap_left', displayName: 'Image Overlap', description: 'Text block overlapping a large background image.', icon: 'layers' },
    { name: 'alternating_feature_list', displayName: 'Alternating List', description: 'A vertical list with alternating content.', icon: 'view_timeline' },
    { name: 'hub_and_spoke', displayName: 'Hub & Spoke', description: 'A central topic with connected points.', icon: 'hub' },
    { name: 'cycle_diagram', displayName: 'Cycle Diagram', description: 'Illustrates a continuous, circular process.', icon: 'loop' },
    { name: 'venn_diagram', displayName: 'Venn Diagram', description: 'Show the overlap between two concepts.', icon: 'view_cozy' },
    // New 30
    { name: 'quadrant_chart', displayName: 'Quadrant Chart', description: 'A 2x2 matrix for analysis (e.g., BCG).', icon: 'dashboard_customize' },
    { name: 'bridge_chart', displayName: 'Bridge Chart', description: 'Shows cumulative effect of positive/negative values.', icon: 'waterfall_chart' },
    { name: 'gantt_chart_simple', displayName: 'Gantt Chart', description: 'A simple project timeline chart.', icon: 'bar_chart_4_bars' },
    { name: 'org_chart', displayName: 'Org Chart', description: 'Display a hierarchical organizational structure.', icon: 'account_tree' },
    { name: 'mind_map', displayName: 'Mind Map', description: 'A central idea with organic branches.', icon: 'share' },
    { name: 'fishbone_diagram', displayName: 'Fishbone Diagram', description: 'A cause-and-effect (Ishikawa) diagram.', icon: 'mediation' },
    { name: 'area_chart', displayName: 'Area Chart', description: 'A line chart with the area below it filled in.', icon: 'area_chart' },
    { name: 'scatter_plot', displayName: 'Scatter Plot', description: 'Shows the relationship between two variables.', icon: 'scatter_plot' },
    { name: 'bubble_chart', displayName: 'Bubble Chart', description: 'A scatter plot where bubble size adds a third dimension.', icon: 'bubble_chart' },
    { name: 'image_grid_four', displayName: 'Image Grid', description: 'A 2x2 grid of four images.', icon: 'grid_on' },
    { name: 'image_with_caption_below', displayName: 'Image w/ Caption', description: 'A large image with a dedicated caption area below.', icon: 'image' },
    { name: 'text_over_image', displayName: 'Text Over Image', description: 'A block of text centered over a background image.', icon: 'fullscreen' },
    { name: 'quote_with_image', displayName: 'Quote & Portrait', description: 'A quote next to an image of the author.', icon: 'person_pin' },
    { name: 'feature_highlight_image', displayName: 'Feature Highlight', description: 'An image with numbered callouts pointing to features.', icon: 'pin_drop' },
    { name: 'image_collage', displayName: 'Image Collage', description: 'A creative collage of 3-5 images.', icon: 'photo_library' },
    { name: 'image_focus_left', displayName: 'Image Focus Left', description: 'A large image on the left (2/3) with text on the right.', icon: 'align_horizontal_right' },
    { name: 'image_focus_right', displayName: 'Image Focus Right', description: 'A large image on the right (2/3) with text on the left.', icon: 'align_horizontal_left' },
    { name: 'checklist', displayName: 'Checklist', description: 'A list of items with checkmark boxes.', icon: 'checklist' },
    { name: 'numbered_list_large', displayName: 'Numbered List', description: 'A list where large, stylized numbers are prominent.', icon: 'format_list_numbered' },
    { name: 'step_flow_vertical', displayName: 'Vertical Flow', description: 'A vertical flow of steps or stages.', icon: 'more_vert' },
    { name: 'circular_flow', displayName: 'Circular Flow', description: 'Items arranged in a circle showing a repeating process.', icon: 'donut_large' },
    { name: 'staggered_list', displayName: 'Staggered List', description: 'Items appear staggered left and right down the page.', icon: 'format_line_spacing' },
    { name: 'feature_list_icons', displayName: 'Feature List', description: 'A list of features, each accompanied by an icon.', icon: 'list' },
    { name: 'pros_and_cons', displayName: 'Pros & Cons', description: 'A two-column layout for comparing advantages and disadvantages.', icon: 'thumbs_up_down' },
    { name: 'kpi_dashboard_three', displayName: 'KPI Dashboard (3)', description: 'Showcase three key performance indicators.', icon: 'speed' },
    { name: 'kpi_dashboard_four', displayName: 'KPI Dashboard (4)', description: 'Showcase four key performance indicators.', icon: 'grid_4x4' },
    { name: 'target_vs_actual', displayName: 'Target vs. Actual', description: 'A gauge or bar showing progress towards a goal.', icon: 'moving' },
    { name: 'faq', displayName: 'FAQ', description: 'A question and answer format.', icon: 'quiz' },
    { name: 'call_to_action', displayName: 'Call to Action', description: 'A slide with a large, clear call to action.', icon: 'ads_click' },
    { name: 'world_map_pins', displayName: 'Map Pins', description: 'A world map background with pins for locations.', icon: 'public' },
  ];

  currentSlide = computed(() => {
    const pres = this.presentation();
    if (!pres || pres.slides.length === 0) return null;
    return pres.slides[this.currentSlideIndex()];
  });
  
  normalizedSpeakerNotes = computed(() => {
    const notes = this.currentSlide()?.speakerNotes;
    if (Array.isArray(notes)) {
      return notes;
    }
    if (typeof notes === 'string' && notes.trim() !== '') {
      // Split by newline for multi-line strings
      return notes.split('\n').filter(line => line.trim() !== '');
    }
    return [];
  });

  promptDiff = computed(() => {
    const selected = this.selectedPromptFromHistory();
    const active = this.aiCorePrompt();
    if (!selected || selected.prompt === active) return null;
    return this.diff(selected.prompt, active);
  });

  constructor() {
    effect((onCleanup) => {
      const pres = this.presentation(); // dependency
      this.autosaveStatus.set('saving');
      const timer = setTimeout(() => {
        if(this.presentation()) { // check if it's still there
          this.autosaveStatus.set('saved');
        }
      }, 1500);
      onCleanup(() => clearTimeout(timer));
    }, { allowSignalWrites: true });

    // Initialize undo/redo history when presentation changes from outside
    effect(() => {
        const pres = this.presentation();
        if (pres && pres.id !== this.lastSeenPresentationId()) {
            this.undoRedoService.start(pres);
            this.lastSeenPresentationId.set(pres.id);
        } else if (!pres) {
            this.undoRedoService.clear();
            this.lastSeenPresentationId.set(undefined);
        }
    }, { allowSignalWrites: true });
  }
  // FIX: Added private `diff` method to implement text comparison for prompts.
  private diff(oldStr: string, newStr: string): { text: string; type: 'added' | 'removed' | 'same' }[] {
    const oldLines = oldStr.split('\n');
    const newLines = newStr.split('\n');
    const diffResult: { text: string; type: 'added' | 'removed' | 'same' }[] = [];

    const dp = Array(oldLines.length + 1).fill(null).map(() => Array(newLines.length + 1).fill(0));

    for (let i = oldLines.length - 1; i >= 0; i--) {
        for (let j = newLines.length - 1; j >= 0; j--) {
            if (oldLines[i] === newLines[j]) {
                dp[i][j] = 1 + dp[i + 1][j + 1];
            } else {
                dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
            }
        }
    }

    let i = 0, j = 0;
    while (i < oldLines.length && j < newLines.length) {
        if (oldLines[i] === newLines[j]) {
            diffResult.push({ text: oldLines[i], type: 'same' });
            i++;
            j++;
        } else if (dp[i + 1][j] >= dp[i][j + 1]) {
            diffResult.push({ text: oldLines[i], type: 'removed' });
            i++;
        } else {
            diffResult.push({ text: newLines[j], type: 'added' });
            j++;
        }
    }

    while (i < oldLines.length) {
        diffResult.push({ text: oldLines[i], type: 'removed' });
        i++;
    }

    while (j < newLines.length) {
        diffResult.push({ text: newLines[j], type: 'added' });
        j++;
    }

    return diffResult;
  }

  startPresentation(): void {
    this.isPresenting.set(true);
  }

  stopPresentation(): void {
    this.isPresenting.set(false);
  }

  commitChange(newPresentation: Presentation, debounced = false): void {
    if (debounced) {
      this.presentationChange.emit(newPresentation); // Emit immediately for UI responsiveness
      clearTimeout(this.debounceTimeout);
      this.debounceTimeout = setTimeout(() => {
        // After timeout, record the latest state.
        this.undoRedoService.recordChange(this.presentation()!);
      }, 750);
    } else {
      clearTimeout(this.debounceTimeout); // Clear any pending debounced change
      this.undoRedoService.recordChange(newPresentation);
      this.presentationChange.emit(newPresentation);
    }
  }

  handleUndo(): void {
    const restoredState = this.undoRedoService.undo();
    if (restoredState) {
      this.presentationChange.emit(restoredState);
    }
  }

  handleRedo(): void {
    const restoredState = this.undoRedoService.redo();
    if (restoredState) {
      this.presentationChange.emit(restoredState);
    }
  }


  private navigateToSlide(newIndex: number): void {
    const currentIndex = this.currentSlideIndex();
    if (newIndex === currentIndex || this.transitioningSlide()) return;

    const pres = this.presentation();
    if (!pres) return;

    const direction = newIndex > currentIndex ? 'forward' : 'backward';
    const outgoingSlide = pres.slides[currentIndex];
    
    let incomingAnimation = '';
    let outgoingAnimation = '';

    if (direction === 'forward') {
      incomingAnimation = 'animate-slide-in-from-right';
      outgoingAnimation = 'animate-slide-out-to-left';
    } else { // backward
      incomingAnimation = 'animate-slide-in-from-left';
      outgoingAnimation = 'animate-slide-out-to-right';
    }
    
    this.transitioningSlide.set({ slide: outgoingSlide, animation: outgoingAnimation });
    this.animationClass.set(incomingAnimation);
    
    this.currentSlideIndex.set(newIndex);
    
    setTimeout(() => {
      this.transitioningSlide.set(null);
      this.animationClass.set('');
    }, 400); // Match animation duration
  }
  
  selectSlide(index: number): void {
    this.navigateToSlide(index);
  }

  previousSlide(): void {
    this.navigateToSlide(Math.max(0, this.currentSlideIndex() - 1));
  }

  nextSlide(): void {
    const pres = this.presentation();
    if (!pres) return;
    this.navigateToSlide(Math.min(pres.slides.length - 1, this.currentSlideIndex() + 1));
  }
  
  handleSlideChange(changedSlide: Slide): void {
      const pres = this.presentation();
      if (!pres) return;
      const newSlides = [...pres.slides];
      newSlides[this.currentSlideIndex()] = changedSlide;
      const newPresentation = { ...pres, slides: newSlides };
      this.commitChange(newPresentation, true);
  }

  changeLayout(newLayout: SlideLayout): void {
      const slide = this.currentSlide();
      const pres = this.presentation();
      if (!slide || !pres) return;

      const newSlide = { ...slide, layout: newLayout };
      const newSlides = [...pres.slides];
      newSlides[this.currentSlideIndex()] = newSlide;
      this.commitChange({ ...pres, slides: newSlides });
  }

  handleRemoveImage(): void {
    const pres = this.presentation();
    if (!pres) return;
    const slideIndex = this.currentSlideIndex();
    
    const newSlides = [...pres.slides];
    const slideToUpdate = { ...newSlides[slideIndex] };
    
    delete slideToUpdate.imageUrl; // Removes the property
    
    newSlides[slideIndex] = slideToUpdate;
    
    const newPresentation = { ...pres, slides: newSlides };
    this.commitChange(newPresentation);
  }

  async generateImageForCurrentSlide(generationConfig: { style: string, aspectRatio: string }): Promise<void> {
    const pres = this.presentation();
    const slideIndex = this.currentSlideIndex();
    const slide = pres?.slides[slideIndex];
    if (!slide || !slide.imagePrompt || !pres) return;

    // Set generating state - don't add to undo history
    const slidesWithSpinner = [...pres.slides];
    slidesWithSpinner[slideIndex] = { ...slide, isGeneratingImage: true };
    this.presentationChange.emit({ ...pres, slides: slidesWithSpinner });

    const improvedPrompt = await this.geminiService.improveImagePrompt(slide.title, slide.content, slide.imagePrompt);
    const promptToUse = improvedPrompt || slide.imagePrompt;
    const imageUrl = await this.geminiService.generateImageFromPrompt(promptToUse, generationConfig.style, generationConfig.aspectRatio);

    const finalPres = this.presentation()!;
    const finalSlides = [...finalPres.slides];
    const oldSlide = finalSlides[slideIndex];

    let updatedSlide: Slide;
    if (imageUrl) {
        updatedSlide = { ...oldSlide, imageUrl, imagePrompt: promptToUse, isGeneratingImage: false };
    } else {
        updatedSlide = { ...oldSlide, isGeneratingImage: false };
    }
    finalSlides[slideIndex] = updatedSlide;
    this.commitChange({ ...finalPres, slides: finalSlides });
  }

  addSlide(): void {
    const pres = this.presentation();
    if (!pres) return;
    const newSlide: Slide = {
      title: 'New Slide',
      content: ['Editable content'],
      imagePrompt: '',
      layout: 'content_left',
      speakerNotes: [],
      rating: null,
    };
    const newSlides = [...pres.slides, newSlide];
    const newPresentation = { ...pres, slides: newSlides };
    this.commitChange(newPresentation);
    this.navigateToSlide(newSlides.length - 1);
  }

  toggleDownloadMenu(): void { this.isDownloadMenuOpen.update(v => !v); }

  // --- Drag and Drop for Outline View ---
  handleDragStart(index: number): void {
    this.draggedSlideIndex.set(index);
  }

  handleDragOver(event: DragEvent, index: number): void {
    event.preventDefault();
    if (index !== this.dropTargetIndex()) {
      this.dropTargetIndex.set(index);
    }
  }

  handleDragLeave(): void {
    this.dropTargetIndex.set(null);
  }

  handleDrop(targetIndex: number): void {
    const pres = this.presentation();
    const draggedIndex = this.draggedSlideIndex();
    if (pres && draggedIndex !== null && draggedIndex !== targetIndex) {
      const newSlides = [...pres.slides];
      const [draggedItem] = newSlides.splice(draggedIndex, 1);
      newSlides.splice(targetIndex, 0, draggedItem);
      this.commitChange({ ...pres, slides: newSlides });
    }
    this.handleDragEnd();
  }

  handleDragEnd(): void {
    this.draggedSlideIndex.set(null);
    this.dropTargetIndex.set(null);
  }

  async smartReorder(): Promise<void> {
    const pres = this.presentation();
    if (!pres) return;
    const reorderedSlides = await this.geminiService.reorderSlides(pres);
    if (reorderedSlides) {
      this.commitChange({ ...pres, slides: reorderedSlides });
    }
  }
  
  async regenerateCurrentSlide(): Promise<void> {
    const pres = this.presentation();
    const slide = this.currentSlide();
    if (!pres || !slide) return;

    const newSlide = await this.geminiService.regenerateSlide(slide, pres);
    if (newSlide) {
      const newSlides = [...pres.slides];
      newSlides[this.currentSlideIndex()] = newSlide;
      this.commitChange({ ...pres, slides: newSlides });
    }
  }

  async suggestLayoutForCurrentSlide(): Promise<void> {
    const slide = this.currentSlide();
    if (!slide) return;
    const suggestedLayout = await this.geminiService.suggestLayout(slide);
    if (suggestedLayout) {
      this.changeLayout(suggestedLayout);
    }
  }

  async improveTitle(): Promise<void> {
    const pres = this.presentation();
    const slide = this.currentSlide();
    if (!pres || !slide) return;

    const improvedTitle = await this.geminiService.improveContent(slide.title, 'improve', pres.language);
    if (improvedTitle) {
      const newSlide = { ...slide, title: improvedTitle };
      this.handleSlideChange(newSlide);
    }
  }
  
  improveAllBulletPoints(): void {
    const slide = this.currentSlide();
    if (!slide || !Array.isArray(slide.content) || !slide.content.length) return;
    this.bulkImprovementTarget.set('bulletPoints');
    this.isBulkImproverOpen.set(true);
  }

  async generateThemeWithAi(): Promise<void> {
    if (!this.aiThemePrompt()) return;
    const newTheme = await this.geminiService.generateTheme(this.aiThemePrompt());
    if (newTheme) {
      this.updateTheme(null, newTheme);
      this.themeGenerated.emit(newTheme);
      this.aiThemePrompt.set('');
    }
  }

  updateTheme(property: keyof Theme | null, value: string | Theme): void {
    const pres = this.presentation();
    if (!pres) return;

    let newTheme: Theme;
    if (property === null && typeof value !== 'string') {
      newTheme = value as Theme;
    } else if (property) {
      newTheme = { ...pres.theme, [property]: value as string };
    } else {
      return;
    }

    const newPresentation = { ...pres, theme: newTheme };
    this.commitChange(newPresentation, true);
  }

  async runAddSlideAi(): Promise<void> {
    const pres = this.presentation();
    if (!this.newSlideTopic() || !pres) return;

    const newSlide = await this.geminiService.generateSingleSlide(this.newSlideTopic(), pres);
    if (newSlide) {
      const newSlides = [...pres.slides, newSlide];
      const newPresentation = { ...pres, slides: newSlides };
      this.commitChange(newPresentation);
      this.isAddSlideAiOpen.set(false);
      this.newSlideTopic.set('');
      this.navigateToSlide(newSlides.length - 1);
    }
  }
  
  handleAgentUpdate(updatedPresentation: Presentation): void {
    this.commitChange(updatedPresentation);
  }

  openContentImprover(info: { field: 'title' | 'content' | 'speakerNotes', index?: number }): void {
    const slide = this.currentSlide();
    if (!slide) return;

    let textToImprove: string | undefined = '';

    if (info.field === 'title') {
      textToImprove = slide.title;
    } else if (info.field === 'content' && info.index !== undefined) {
      if (Array.isArray(slide.content)) {
        textToImprove = slide.content[info.index];
      } else if (typeof slide.content === 'string' && info.index === 0) {
        textToImprove = slide.content;
      }
    } else if (info.field === 'speakerNotes' && info.index !== undefined) {
      const notes = this.normalizedSpeakerNotes();
      textToImprove = notes[info.index];
    }
    
    if (textToImprove) {
      this.contentToImproveInfo.set({ field: info.field, index: info.index, text: textToImprove });
      this.isContentImproverOpen.set(true);
    }
  }

  async runImproveContent(mode: 'improve' | 'shorten' | 'lengthen'): Promise<void> {
    const info = this.contentToImproveInfo();
    const pres = this.presentation();
    if (!info || !pres) return;

    this.isContentImproverOpen.set(false); // Close modal

    const slide = this.currentSlide();
    if (!slide) return;

    const improvedText = await this.geminiService.improveContent(info.text, mode, pres.language);
    if (!improvedText) {
      this.contentToImproveInfo.set(null); // Clear info on failure
      return;
    }

    let newSlide: Slide = { ...slide };
    if (info.field === 'title') {
      newSlide.title = improvedText;
    } else if (info.field === 'content' && info.index !== undefined) {
      const newContent = [...(Array.isArray(slide.content) ? slide.content : [slide.content])];
      newContent[info.index] = improvedText;
      newSlide.content = newContent;
    } else if (info.field === 'speakerNotes' && info.index !== undefined) {
      const notes = this.normalizedSpeakerNotes();
      const newNotes = [...notes];
      newNotes[info.index] = improvedText;
      newSlide.speakerNotes = newNotes;
    }
    
    const newSlides = [...pres.slides];
    newSlides[this.currentSlideIndex()] = newSlide;
    this.commitChange({ ...pres, slides: newSlides });
    
    this.contentToImproveInfo.set(null); // Clear info
  }

  async runBulkImprovement(mode: 'improve' | 'shorten' | 'lengthen'): Promise<void> {
    const target = this.bulkImprovementTarget();
    const pres = this.presentation();
    const slide = this.currentSlide();
    if (!target || !pres || !slide) return;

    this.isBulkImproverOpen.set(false);

    let improvedResult: string[] | null = null;

    if (target === 'bulletPoints' && Array.isArray(slide.content)) {
      improvedResult = await this.geminiService.improveBulletPoints(slide.title, slide.content, mode, pres.language);
    } else if (target === 'speakerNotes') {
      const notes = this.normalizedSpeakerNotes();
      if(notes.length > 0) {
        improvedResult = await this.geminiService.improveSpeakerNotes(slide.title, notes, mode, pres.language);
      }
    }
    
    if (improvedResult) {
      const newSlide = { ...slide, [target === 'bulletPoints' ? 'content' : 'speakerNotes']: improvedResult };
      this.handleSlideChange(newSlide);
    }
    
    this.bulkImprovementTarget.set(null);
  }

  openImageEditModal(): void {
    const slide = this.currentSlide();
    const pres = this.presentation();
    if (!slide || !pres) return;

    this.imageToEditInfo.set({
      slideIndex: this.currentSlideIndex(),
      currentPrompt: slide.imagePrompt,
      style: 'Photorealistic', // Default
      aspectRatio: '16:9'      // Default
    });
    this.imageEditInstruction.set('');
    this.isImageEditModalOpen.set(true);
  }

  async handleImageEdit(): Promise<void> {
    const info = this.imageToEditInfo();
    const instruction = this.imageEditInstruction();
    if (!info || !instruction) return;

    const pres = this.presentation();
    if (!pres) return;

    // Set generating state
    const newSlidesWithSpinner = [...pres.slides];
    newSlidesWithSpinner[info.slideIndex] = { ...newSlidesWithSpinner[info.slideIndex], isGeneratingImage: true };
    this.presentationChange.emit({ ...pres, slides: newSlidesWithSpinner });
    
    this.isImageEditModalOpen.set(false);
    this.imageEditInstruction.set('');
  
    const newPrompt = await this.geminiService.getEditedImagePrompt(info.currentPrompt, instruction);
    const promptToUse = newPrompt || `${info.currentPrompt}, ${instruction}`;
  
    const imageUrl = await this.geminiService.generateImageFromPrompt(promptToUse, info.style, info.aspectRatio);
  
    // Update final presentation state
    const finalPres = this.presentation();
    if (!finalPres) return;
    const finalSlides = [...finalPres.slides];
    const oldSlide = finalSlides[info.slideIndex];
    let updatedSlide: Slide;
    if (imageUrl) {
      updatedSlide = { ...oldSlide, imageUrl, imagePrompt: promptToUse, isGeneratingImage: false };
    } else {
      updatedSlide = { ...oldSlide, isGeneratingImage: false }; // Failed
    }
    finalSlides[info.slideIndex] = updatedSlide;
    this.commitChange({ ...finalPres, slides: finalSlides });
  }

  async handleGenerateContentFromImage(): Promise<void> {
    const pres = this.presentation();
    const slide = this.currentSlide();
    if (!pres || !slide || !slide.imageUrl) return;

    const result = await this.geminiService.generateSlideContentFromImage(slide.imageUrl);
    if (result) {
      const newSlide = { ...slide, title: result.title, content: result.content };
      this.handleSlideChange(newSlide);
    }
  }

  async handleImproveImagePrompt(): Promise<void> {
    const pres = this.presentation();
    const slide = this.currentSlide();
    if (!pres || !slide) return;
    
    const improvedPrompt = await this.geminiService.improveImagePrompt(slide.title, slide.content, slide.imagePrompt);
    if (improvedPrompt) {
      const newSlide = { ...slide, imagePrompt: improvedPrompt };
      this.handleSlideChange(newSlide);
    }
  }

  updateSpeakerNote(event: Event, index: number): void {
    const target = event.target as HTMLElement;
    const newText = target.textContent || '';
    
    const pres = this.presentation();
    const slide = this.currentSlide();
    if (!pres || !slide) return;
    
    const notes = this.normalizedSpeakerNotes();
    const newNotes = [...notes];
    newNotes[index] = newText;
    
    const newSlide: Slide = { ...slide, speakerNotes: newNotes };
    const newSlides = [...pres.slides];
    newSlides[this.currentSlideIndex()] = newSlide;
    this.commitChange({ ...pres, slides: newSlides }, true);
  }

  async generateNotesForCurrentSlide(): Promise<void> {
    const pres = this.presentation();
    const slide = this.currentSlide();
    if (!pres || !slide) return;

    const newNotes = await this.geminiService.generateSpeakerNotes(slide.title, slide.content, pres.language);
    if (newNotes) {
      const newSlide = { ...slide, speakerNotes: newNotes };
      this.handleSlideChange(newSlide);
    }
  }

  improveAllSpeakerNotes(): void {
    const slide = this.currentSlide();
    if (!slide || !this.normalizedSpeakerNotes().length) return;
    this.bulkImprovementTarget.set('speakerNotes');
    this.isBulkImproverOpen.set(true);
  }

  rateSlide(slideIndex: number, ratingType: 'good' | 'bad', reasons?: string[]): void {
    const pres = this.presentation();
    if (!pres) return;
    const newSlides = [...pres.slides];
    const slideToUpdate = { ...newSlides[slideIndex] };

    if (ratingType === 'good') {
      slideToUpdate.rating = slideToUpdate.rating?.type === 'good' ? null : { type: 'good' };
    } else if (ratingType === 'bad' && reasons && reasons.length > 0) {
       slideToUpdate.rating = slideToUpdate.rating?.type === 'bad' ? null : { type: 'bad', reasons };
    } else {
        slideToUpdate.rating = null;
    }
    
    newSlides[slideIndex] = slideToUpdate;
    this.commitChange({ ...pres, slides: newSlides });
    this.badRatingInfo.set(null);
  }
  
  openBadRatingPopover(slideIndex: number): void {
    const currentInfo = this.badRatingInfo();
    const slide = this.presentation()?.slides[slideIndex];
    if (!slide) return;

    if (currentInfo && currentInfo.slideIndex === slideIndex) {
      this.badRatingInfo.set(null);
    } else if (slide.rating?.type === 'bad') {
       this.rateSlide(slideIndex, 'bad', []); // This will toggle it off
    } else {
      this.badRatingInfo.set({ slideIndex, reasons: {} });
    }
  }

  handleBadRatingSubmit(): void {
    const info = this.badRatingInfo();
    if (!info) return;
    const selectedReasons = Object.keys(info.reasons).filter(reason => info.reasons[reason]);
    this.rateSlide(info.slideIndex, 'bad', selectedReasons);
  }

  async openAiEvolutionModal(): Promise<void> {
    this.isAiEvolutionModalOpen.set(true);
    this.newlyEvolvedPrompt.set(null);
    this.selectedPromptFromHistory.set(null);
    this.isEvolving.set(true);
    try {
      const [history, activeId, currentPrompt] = await Promise.all([
        this.aiEvolutionService.getPromptHistory(),
        this.aiEvolutionService.getActivePromptId(),
        this.aiEvolutionService.getCorePrompt()
      ]);
      this.promptHistory.set(history.slice().reverse());
      this.activePromptId.set(activeId);
      this.aiCorePrompt.set(currentPrompt);
      this.evolutionFeedbackSummary.set(this.getFeedbackSummary());
    } catch (e) {
      this.geminiService.error.set(`Failed to load AI evolution data: ${(e as Error).message}`);
    } finally {
      this.isEvolving.set(false);
    }
  }

  private getFeedbackSummary(): string {
    const pres = this.presentation();
    if (!pres) return 'No presentation loaded to analyze feedback.';
    const goodSlides = pres.slides.map((s, i) => ({ ...s, index: i })).filter(s => s.rating?.type === 'good');
    const badSlides = pres.slides.map((s, i) => ({ ...s, index: i })).filter(s => s.rating?.type === 'bad');

    if (goodSlides.length === 0 && badSlides.length === 0) {
      return 'No feedback (good or bad) has been provided for this presentation yet.';
    }
    let summary = 'User Feedback Analysis:\n\n';
    if (goodSlides.length > 0) {
      summary += `Liked Slides (${goodSlides.length}):\n`;
      goodSlides.forEach(s => { summary += `- Slide ${s.index + 1}: "${s.title}" (Layout: ${s.layout})\n`; });
      summary += '\n';
    }
    if (badSlides.length > 0) {
      summary += `Disliked Slides (${badSlides.length}):\n`;
      const reasonCounts: Record<string, number> = {};
      badSlides.forEach(s => {
        const reasons = (s.rating as { type: 'bad', reasons: string[] }).reasons;
        summary += `- Slide ${s.index + 1}: "${s.title}" (Layout: ${s.layout}) - Reasons: ${reasons.join(', ')}\n`;
        reasons.forEach(r => { reasonCounts[r] = (reasonCounts[r] || 0) + 1; });
      });
      summary += '\nCommon Issues:\n';
      Object.entries(reasonCounts).sort((a, b) => b[1] - a[1]).forEach(([reason, count]) => {
          summary += `- ${reason}: ${count} time(s)\n`;
      });
    }
    return summary;
  }

  selectPromptFromHistory(item: PromptHistoryItem): void {
    this.selectedPromptFromHistory.set(this.selectedPromptFromHistory()?.id === item.id ? null : item);
  }

  async makePromptActive(promptId: string): Promise<void> {
    await this.aiEvolutionService.setActivePrompt(promptId);
    this.activePromptId.set(promptId);
    this.selectedPromptFromHistory.set(null);
  }

  async resetAiPrompt(): Promise<void> {
    if (confirm('Are you sure you want to reset the AI instructions to the original default? This cannot be undone.')) {
      await this.aiEvolutionService.resetToDefault();
      this.openAiEvolutionModal(); // Refresh
    }
  }

  async triggerAiEvolution(): Promise<void> {
    this.isEvolving.set(true);
    try {
      const evolvedPrompt = await this.geminiService.evolveCorePrompt(this.aiCorePrompt(), this.evolutionFeedbackSummary());
      if (evolvedPrompt) this.newlyEvolvedPrompt.set(evolvedPrompt);
    } finally {
      this.isEvolving.set(false);
    }
  }

  async acceptEvolvedPrompt(): Promise<void> {
    const newPrompt = this.newlyEvolvedPrompt();
    if (!newPrompt) return;
    await this.aiEvolutionService.saveCorePrompt(newPrompt, this.evolutionFeedbackSummary());
    this.isAiEvolutionModalOpen.set(false);
  }

  private async downloadAsPptx(): Promise<void> {
    const pres = this.presentation();
    if (!pres || typeof PptxGenJS === 'undefined') return;

    this.isDownloadMenuOpen.set(false);
    this.downloadState.set('pptx');

    try {
        const pptx = new PptxGenJS();
        pptx.layout = 'LAYOUT_16x9';

        const theme = pres.theme;
        const pColor = theme.primaryColor.substring(1);
        const tColor = theme.textColor.substring(1);
        const bColor = theme.backgroundColor.substring(1);

        const getContentArray = (content: string | string[]): string[] => {
            if (Array.isArray(content)) return content;
            if (typeof content === 'string') return content.split('\n').filter(Boolean);
            return [];
        };

        for (const slide of pres.slides) {
            const pptxSlide = pptx.addSlide({ bkgd: bColor });
            if (slide.speakerNotes) {
                const notes = Array.isArray(slide.speakerNotes) ? slide.speakerNotes.join('\n\n') : slide.speakerNotes;
                pptxSlide.addNotes(notes);
            }

            const content = getContentArray(slide.content);
            const titleOpts = { fontFace: theme.titleFont, color: pColor, bold: true };
            const bodyOpts = { fontFace: theme.bodyFont, color: tColor };

            switch (slide.layout) {
                case 'title':
                    pptxSlide.addText(slide.title, { ...titleOpts, align: 'center', y: 2.0, w: '90%', x: '5%', fontSize: 48 });
                    if (content[0]) pptxSlide.addText(content[0], { ...bodyOpts, align: 'center', y: 3.5, w: '80%', x: '10%', fontSize: 24, color: tColor });
                    break;
                case 'section_header':
                    pptxSlide.addShape(pptx.shapes.RECTANGLE, { x: 0, y: 2.5, w: '100%', h: 1.5, fill: { color: pColor, transparency: 85 } });
                    pptxSlide.addText(slide.title, { ...titleOpts, align: 'center', y: 2.9, w: '90%', x: '5%', fontSize: 44 });
                    break;
                case 'conclusion':
                    pptxSlide.addText(slide.title, { ...titleOpts, align: 'center', y: 2.5, w: '90%', x: '5%', fontSize: 48 });
                    if (content[0]) pptxSlide.addText(content[0], { ...bodyOpts, align: 'center', y: 4.0, w: '80%', x: '10%', fontSize: 22 });
                    break;
                case 'content_left':
                case 'image_focus_right':
                    pptxSlide.addText(slide.title, { ...titleOpts, x: 0.5, y: 0.5, w: '50%', fontSize: 32 });
                    pptxSlide.addText(content, { ...bodyOpts, x: 0.5, y: 1.5, w: '50%', h: 3.5, bullet: true, fontSize: slide.isSourceSlide ? 10 : 16 });
                    if (slide.imageUrl) pptxSlide.addImage({ data: slide.imageUrl, x: 5.5, y: 1.0, w: 4.0, h: 3.5 });
                    break;
                case 'content_right':
                case 'image_focus_left':
                    pptxSlide.addText(slide.title, { ...titleOpts, x: 5.5, y: 0.5, w: '40%', fontSize: 32 });
                    pptxSlide.addText(content, { ...bodyOpts, x: 5.5, y: 1.5, w: '40%', h: 3.5, bullet: true, fontSize: slide.isSourceSlide ? 10 : 16 });
                    if (slide.imageUrl) pptxSlide.addImage({ data: slide.imageUrl, x: 0.5, y: 1.0, w: 4.5, h: 3.5 });
                    break;
                case 'image_full_bleed':
                case 'text_over_image':
                    if (slide.imageUrl) pptxSlide.addImage({ data: slide.imageUrl, x: 0, y: 0, w: '100%', h: '100%' });
                    pptxSlide.addText(slide.title, { ...titleOpts, color: 'FFFFFF', align: 'center', y: 2.5, w: '90%', x: '5%', fontSize: 48, ...{ glow: { size: 10, color: '000000', opacity: 0.5 } } });
                    if (content[0]) pptxSlide.addText(content[0], { ...bodyOpts, color: 'FFFFFF', align: 'center', y: 4.0, w: '80%', x: '10%', fontSize: 24, ...{ glow: { size: 8, color: '000000', opacity: 0.5 } } });
                    break;
                case 'two_column':
                    pptxSlide.addText(slide.title, { ...titleOpts, align: 'center', y: 0.5, w: '90%', x: '5%', fontSize: 36 });
                    const midpoint = Math.ceil(content.length / 2);
                    pptxSlide.addText(content.slice(0, midpoint), { ...bodyOpts, x: 0.5, y: 1.5, w: '45%', h: 3.5, bullet: true, fontSize: slide.isSourceSlide ? 9 : 14 });
                    pptxSlide.addText(content.slice(midpoint), { ...bodyOpts, x: 5.2, y: 1.5, w: '45%', h: 3.5, bullet: true, fontSize: slide.isSourceSlide ? 9 : 14 });
                    break;
                case 'three_column':
                    pptxSlide.addText(slide.title, { ...titleOpts, align: 'center', y: 0.5, w: '90%', x: '5%', fontSize: 36 });
                    const columns: { title: string, text: string }[] = [];
                    for (let i = 0; i < content.length; i += 2) columns.push({ title: content[i], text: content[i+1] || '' });
                    columns.slice(0, 3).forEach((col, i) => {
                        pptxSlide.addText(col.title, { ...titleOpts, x: 0.5 + i * 3.2, y: 2, w: 3, h: 1, align: 'center', fontSize: 20 });
                        pptxSlide.addText(col.text, { ...bodyOpts, x: 0.5 + i * 3.2, y: 3, w: 3, h: 2, align: 'center', fontSize: 14 });
                    });
                    break;
                case 'table':
                    pptxSlide.addText(slide.title, { ...titleOpts, align: 'center', y: 0.5, w: '90%', x: '5%', fontSize: 36 });
                    if (slide.tableData) {
                        const styledData = slide.tableData.map((row, i) => i === 0
                            ? row.map(cell => ({ text: cell, options: { fill: pColor, color: bColor, bold: true } }))
                            : row
                        );
                        pptxSlide.addTable(styledData, { x: 0.5, y: 1.5, w: 9.0, colW: Array(slide.tableData[0].length).fill(9.0 / slide.tableData[0].length), border: { type: 'solid', pt: 1, color: pColor }, ...bodyOpts });
                    }
                    break;
                case 'chart_bar':
                case 'chart_line':
                case 'chart_pie':
                case 'chart_doughnut':
                case 'area_chart':
                    pptxSlide.addText(slide.title, { ...titleOpts, align: 'center', y: 0.5, w: '90%', x: '5%', fontSize: 36 });
                    if (slide.chartData) {
                        const chartTypeMap: any = { 'chart_bar': 'bar', 'chart_line': 'line', 'chart_pie': 'pie', 'chart_doughnut': 'doughnut', 'area_chart': 'area' };
                        const chartDataForPptx = slide.chartData.datasets.map(d => ({ name: d.label, labels: slide.chartData!.labels, values: d.data }));
                        pptxSlide.addChart(chartTypeMap[slide.layout], chartDataForPptx, { x: 1, y: 1.5, w: 8, h: 3.5, showLegend: true, legendPos: 'b', chartColors: [pColor, tColor, '888888', 'F0A030', '40A0F0'] });
                    }
                    break;
                case 'kpi_dashboard_three':
                case 'stats_highlight':
                    pptxSlide.addText(slide.title, { ...titleOpts, align: 'center', y: 0.5, w: '90%', x: '5%', fontSize: 36 });
                    const kpiContent: { stat: string, label: string }[] = [];
                    for (let i = 0; i < content.length; i += 2) kpiContent.push({ stat: content[i], label: content[i+1] || '' });
                    kpiContent.slice(0, 3).forEach((item, i) => {
                        const x = 0.5 + (i * 3.2);
                        pptxSlide.addText(item.stat, { ...titleOpts, x, y: 2, w: 3, h: 2, align: 'center', valign: 'middle', fontSize: 48 });
                        pptxSlide.addText(item.label, { ...bodyOpts, x, y: 3.5, w: 3, h: 1, align: 'center', fontSize: 18 });
                    });
                    break;
                case 'timeline':
                    pptxSlide.addText(slide.title, { ...titleOpts, align: 'center', y: 0.5, w: '90%', x: '5%', fontSize: 36 });
                    pptxSlide.addShape(pptx.shapes.LINE, { x: 5.0, y: 1.5, w: 0, h: 3.5, line: { color: pColor, width: 2 } });
                    const timelineItems: { item1: string, item2: string }[] = [];
                    for (let i = 0; i < content.length; i+=2) timelineItems.push({ item1: content[i], item2: content[i+1] || ''});
                    timelineItems.forEach((item, i) => {
                        const yPos = 1.5 + i * (3.5 / timelineItems.length);
                        pptxSlide.addShape(pptx.shapes.OVAL, { x: 4.85, y: yPos, w: 0.3, h: 0.3, fill: { color: pColor } });
                        if (i % 2 === 0) { // Left side
                            pptxSlide.addText(item.item1, { ...titleOpts, x: 0.5, y: yPos - 0.2, w: 4, h: 0.5, align: 'right', fontSize: 18 });
                            pptxSlide.addText(item.item2, { ...bodyOpts, x: 0.5, y: yPos + 0.2, w: 4, h: 0.5, align: 'right', fontSize: 12 });
                        } else { // Right side
                            pptxSlide.addText(item.item1, { ...titleOpts, x: 5.5, y: yPos - 0.2, w: 4, h: 0.5, align: 'left', fontSize: 18 });
                            pptxSlide.addText(item.item2, { ...bodyOpts, x: 5.5, y: yPos + 0.2, w: 4, h: 0.5, align: 'left', fontSize: 12 });
                        }
                    });
                    break;
                default: // Generic fallback
                    pptxSlide.addText(slide.title, { ...titleOpts, align: 'center', y: 0.5, w: '90%', x: '5%', fontSize: 36 });
                    if (slide.imageUrl) {
                        pptxSlide.addText(content, { ...bodyOpts, x: 0.5, y: 1.5, w: '45%', h: 3.5, bullet: true, fontSize: 14 });
                        pptxSlide.addImage({ data: slide.imageUrl, x: 5.2, y: 1.5, w: 4.3, h: 3.5 });
                    } else {
                        pptxSlide.addText(content, { ...bodyOpts, x: 0.5, y: 1.5, w: '90%', h: 3.5, bullet: true, fontSize: 14 });
                    }
                    break;
            }
        }
        await pptx.writeFile({ fileName: `${pres.title}.pptx` });
    } catch (e) {
        this.geminiService.error.set(`Failed to generate PPTX: ${(e as Error).message}`);
    } finally {
        this.downloadState.set('idle');
    }
  }

  private async downloadAsPdf(): Promise<void> {
    const pres = this.presentation();
    if (!pres || typeof jspdf === 'undefined' || typeof html2canvas === 'undefined') return;
    this.isDownloadMenuOpen.set(false);
    this.downloadState.set('pdf');
    try {
      const { jsPDF } = jspdf;
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'px', format: 'a4' });
      const slideHostEl = document.querySelector('app-presentation-editor .w-full.max-w-7xl.aspect-\\[16\\/9\\]');
      if (!slideHostEl) throw new Error('Could not find slide element to capture.');
      const originalIndex = this.currentSlideIndex();
      for (let i = 0; i < pres.slides.length; i++) {
        this.selectSlide(i);
        await new Promise(res => setTimeout(res, 500));
        const canvas = await html2canvas(slideHostEl as HTMLElement, { scale: 2, useCORS: true });
        const imgData = canvas.toDataURL('image/jpeg', 0.8);
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        if (i > 0) pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
      }
      this.selectSlide(originalIndex);
      pdf.save(`${pres.title}.pdf`);
    } catch (e) { this.geminiService.error.set(`Failed to generate PDF: ${(e as Error).message}`); } finally { this.downloadState.set('idle'); }
  }

  private async downloadAsPngZip(): Promise<void> {
    const pres = this.presentation();
    if (!pres || typeof html2canvas === 'undefined' || typeof JSZip === 'undefined') return;
    this.isDownloadMenuOpen.set(false);
    this.downloadState.set('png');
    try {
      const zip = new JSZip();
      const slideHostEl = document.querySelector('app-presentation-editor .w-full.max-w-7xl.aspect-\\[16\\/9\\]');
      if (!slideHostEl) throw new Error('Could not find slide element to capture.');
      const originalIndex = this.currentSlideIndex();
      for (let i = 0; i < pres.slides.length; i++) {
        this.selectSlide(i);
        await new Promise(res => setTimeout(res, 500));
        const canvas = await html2canvas(slideHostEl as HTMLElement, { useCORS: true });
        zip.file(`slide_${String(i+1).padStart(2, '0')}.png`, canvas.toDataURL('image/png').split(',')[1], { base64: true });
      }
      this.selectSlide(originalIndex);
      const content = await zip.generateAsync({ type: 'blob' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(content);
      link.download = `${pres.title}_slides.zip`;
      link.click();
      URL.revokeObjectURL(link.href);
    } catch (e) { this.geminiService.error.set(`Failed to generate PNGs: ${(e as Error).message}`); } finally { this.downloadState.set('idle'); }
  }

  private downloadAsTxt(): void {
    const pres = this.presentation();
    if (!pres) return;
    this.isDownloadMenuOpen.set(false);
    this.downloadState.set('txt');
    try {
      let content = `${pres.title}\n\n`;
      pres.slides.forEach((slide, i) => {
        content += `--- Slide ${i + 1}: ${slide.title} ---\n\n`;
        if (Array.isArray(slide.content)) content += slide.content.map(p => `- ${p}`).join('\n') + '\n\n';
        content += `Speaker Notes:\n${(Array.isArray(slide.speakerNotes) ? slide.speakerNotes.join('\n') : slide.speakerNotes || 'N/A')}\n\n`;
      });
      const blob = new Blob([content], { type: 'text/plain' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${pres.title}_notes.txt`;
      link.click();
      URL.revokeObjectURL(link.href);
    } catch (e) { this.geminiService.error.set(`Failed to generate TXT: ${(e as Error).message}`); } finally { this.downloadState.set('idle'); }
  }
}