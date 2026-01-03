import { Component, ChangeDetectionStrategy, input, output, signal, computed, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Presentation, Slide, Theme, SlideLayout, PromptHistoryItem, PptxAnimation } from '../../types';
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
    // Original & Existing
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
    { name: 'image_overlap_left', displayName: 'Image Overlap', description: 'Text block overlapping a large background image.', icon: 'layers' },
    { name: 'alternating_feature_list', displayName: 'Alternating List', description: 'A vertical list with alternating content.', icon: 'view_timeline' },
    { name: 'hub_and_spoke', displayName: 'Hub & Spoke', description: 'A central topic with connected points.', icon: 'hub' },
    { name: 'cycle_diagram', displayName: 'Cycle Diagram', description: 'Illustrates a continuous, circular process.', icon: 'loop' },
    { name: 'venn_diagram', displayName: 'Venn Diagram', description: 'Show the overlap between two concepts.', icon: 'view_cozy' },
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
    // New Advanced Layouts
    { name: 'agenda', displayName: 'Agenda', description: 'A list of topics or schedules for the presentation.', icon: 'event_note' },
    { name: 'key_takeaways', displayName: 'Key Takeaways', description: 'A summary of the most important points.', icon: 'check_circle' },
    { name: 'statement', displayName: 'Statement', description: 'A slide with a single, powerful sentence.', icon: 'campaign' },
    { name: 'thank_you', displayName: 'Thank You', description: 'A closing slide to thank the audience.', icon: 'thumb_up' },
    { name: 'contact_information', displayName: 'Contact Info', description: 'Share contact details and social media.', icon: 'contact_mail' },
    { name: 'next_steps', displayName: 'Next Steps', description: 'Outline the actions to be taken after the presentation.', icon: 'fast_forward' },
    { name: 'speaker_introduction', displayName: 'Speaker Intro', description: 'Introduce a speaker with their photo and bio.', icon: 'person' },
    { name: 'testimonial_single', displayName: 'Testimonial', description: 'Feature a single, impactful customer testimonial.', icon: 'chat_bubble' },
    { name: 'testimonial_three', displayName: 'Testimonials (3)', description: 'Showcase three customer testimonials.', icon: 'forum' },
    { name: 'definition_list', displayName: 'Definition List', description: 'A list of terms and their definitions.', icon: 'menu_book' },
    { name: 'numbered_highlights_four', displayName: 'Highlights (4)', description: 'Present four key highlights with large numbers.', icon: 'looks_4' },
    { name: 'icon_grid_four', displayName: 'Icon Grid', description: 'A 2x2 grid of icons with labels and text.', icon: 'apps' },
    { name: 'chevron_list', displayName: 'Chevron List', description: 'A process list using chevron arrows.', icon: 'navigate_next' },
    { name: 'arrow_process_flow', displayName: 'Arrow Process', description: 'A process flow using large, bold arrows.', icon: 'arrow_forward' },
    { name: 'diverging_arrows', displayName: 'Diverging Arrows', description: 'Show opposing forces from a central point.', icon: 'sync_alt' },
    { name: 'converging_arrows', displayName: 'Converging Arrows', description: 'Show forces coming together to a central point.', icon: 'merge_type' },
    { name: 'roadmap_horizontal', displayName: 'Roadmap', description: 'A horizontal timeline for project milestones.', icon: 'signpost' },
    { name: 'company_timeline', displayName: 'Company Timeline', description: 'A formal timeline for company history.', icon: 'business' },
    { name: 'roadmap_vertical', displayName: 'Vertical Roadmap', description: 'A vertical timeline for project milestones.', icon: 'double_arrow' },
    { name: 'gear_diagram', displayName: 'Gear Diagram', description: 'Use interlocking gears to show a process.', icon: 'settings' },
    { name: 'word_cloud', displayName: 'Word Cloud', description: 'A visual cloud of keywords.', icon: 'cloud' },
    { name: 'matrix_3x3', displayName: '3x3 Matrix', description: 'A 3x3 grid for advanced analysis.', icon: 'border_all' },
    { name: 'progress_bar_list', displayName: 'Progress Bars', description: 'A list of items with completion percentages.', icon: 'checklist_rtl' },
    { name: 'gauge_chart_three', displayName: 'Gauge Charts (3)', description: 'Three gauge charts for KPI monitoring.', icon: 'speed' },
    { name: 'chart_radar', displayName: 'Radar Chart', description: 'Compare multiple quantitative variables.', icon: 'radar' },
    { name: 'chart_heatmap', displayName: 'Heatmap', description: 'A matrix chart using color to show intensity.', icon: 'view_kanban' },
    { name: 'data_table_highlight', displayName: 'Highlighted Table', description: 'A data table with a highlighted row or column.', icon: 'view_week' },
    { name: 'project_dashboard', displayName: 'Dashboard', description: 'A dashboard with multiple stats and charts.', icon: 'dashboard' },
    { name: 'cover_page_logo', displayName: 'Cover Page', description: 'A title slide with a prominent logo area.', icon: 'bookmark' },
    { name: 'image_header_text_below', displayName: 'Image Header', description: 'A full-width image at the top with text below.', icon: 'web_asset' },
    { name: 'image_grid_three', displayName: 'Image Grid (3)', description: 'A grid of three images (1 large, 2 small).', icon: 'view_quilt' },
    { name: 'image_grid_five', displayName: 'Image Grid (5)', description: 'A dynamic grid of five images.', icon: 'auto_awesome_mosaic' },
    { name: 'image_carousel_mockup', displayName: 'Image Carousel', description: 'Simulates a carousel of images.', icon: 'view_carousel' },
    { name: 'image_with_side_bullets', displayName: 'Image & Bullets', description: 'A side-by-side image and bullet points.', icon: 'align_horizontal_center' },
    { name: 'image_before_after', displayName: 'Before & After', description: 'A split-screen comparison of two images.', icon: 'transform' },
    { name: 'device_mockup_phone', displayName: 'Phone Mockup', description: 'Display content inside a smartphone mockup.', icon: 'smartphone' },
    { name: 'device_mockup_laptop', displayName: 'Laptop Mockup', description: 'Display content inside a laptop mockup.', icon: 'laptop' },
    { name: 'conclusion', displayName: 'Conclusion', description: 'A final, concluding slide.', icon: 'flag' },
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

  private diff(oldStr: string, newStr: string): { text: string; type: 'added' | 'removed' | 'same' }[] {
    const oldLines = oldStr.split('\n');
    const newLines = newStr.split('\n');
    const diffResult: { text: string; type: 'added' | 'removed' | 'same' }[] = [];

    const dp = Array(oldLines.length + 1).fill(null).map(() => Array(newLines.length + 1).fill(0));

    for (let i = oldLines.length - 1; i >= 0; i--) {
        for (let j = newLines.length - 1; i >= 0; i--) {
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

  changeAnimation(newAnimation: string): void {
    const pres = this.presentation();
    const slide = this.currentSlide();
    if (!pres || !slide) return;
    
    const newSlide: Slide = { ...slide, animation: newAnimation as PptxAnimation };
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

  async generateImageForCurrentSlide(generationConfig: { style: string; aspectRatio: string }): Promise<void> {
    const pres = this.presentation();
    const slideIndex = this.currentSlideIndex();
    const slide = pres?.slides[slideIndex];
    if (!slide || !slide.imagePrompt || !pres) return;

    // Set generating state
    const slidesWithSpinner = [...pres.slides];
    slidesWithSpinner[slideIndex] = { ...slide, isGeneratingImage: true };
    this.presentationChange.emit({ ...pres, slides: slidesWithSpinner });

    let imageUrl: string | null = null;
    let promptToUse = slide.imagePrompt;

    try {
        const improvedPrompt = await this.geminiService.improveImagePrompt(slide.title, slide.content, slide.imagePrompt);
        promptToUse = improvedPrompt || slide.imagePrompt;

        let aspectRatioToUse = generationConfig.aspectRatio;
        if (aspectRatioToUse === 'Auto') {
            aspectRatioToUse = await this.geminiService.suggestAspectRatio(slide.title, slide.content, promptToUse);
        }

        imageUrl = await this.geminiService.generateImageFromPrompt(promptToUse, generationConfig.style, aspectRatioToUse);
    } catch (e) {
        console.error("Caught error during image generation:", e);
        // The geminiService already set the user-facing error.
    } finally {
        const finalPres = this.presentation()!;
        if (!finalPres) return;

        const finalSlides = [...finalPres.slides];
        const oldSlide = finalSlides[slideIndex];
        
        const updatedSlide: Slide = {
            ...oldSlide,
            imageUrl: imageUrl || oldSlide.imageUrl, // Keep old image on failure
            imagePrompt: promptToUse,
            isGeneratingImage: false
        };

        finalSlides[slideIndex] = updatedSlide;
        this.commitChange({ ...finalPres, slides: finalSlides });
    }
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
  
    let imageUrl: string | null = null;
    let promptToUse = info.currentPrompt;

    try {
        const newPrompt = await this.geminiService.getEditedImagePrompt(info.currentPrompt, instruction);
        promptToUse = newPrompt || `${info.currentPrompt}, ${instruction}`;
    
        imageUrl = await this.geminiService.generateImageFromPrompt(promptToUse, info.style, info.aspectRatio);
    } catch (e) {
        console.error("Caught error during image edit/generation:", e);
    } finally {
        // Update final presentation state
        const finalPres = this.presentation();
        if (!finalPres) return;
        const finalSlides = [...finalPres.slides];
        const oldSlide = finalSlides[info.slideIndex];
        
        const updatedSlide: Slide = {
            ...oldSlide,
            imageUrl: imageUrl || oldSlide.imageUrl,
            imagePrompt: promptToUse,
            isGeneratingImage: false
        };

        finalSlides[info.slideIndex] = updatedSlide;
        this.commitChange({ ...finalPres, slides: finalSlides });
    }
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
      this.geminiService.error.set({ message: `Failed to load AI evolution data: ${(e as Error).message}`, reportable: true });
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
  
  private getContentArray(content: string | string[]): string[] {
    if (Array.isArray(content)) {
        return content.filter(item => typeof item === 'string' && item.trim() !== '');
    }
    if (typeof content === 'string') {
        return content.split('\n').filter(line => line.trim() !== '');
    }
    return [];
  }

  private normalizeLayout(layout: SlideLayout | string): SlideLayout {
    const layoutAliasMap: Record<string, SlideLayout> = {
        'contentleft': 'content_left',
        'contentright': 'content_right',
        'twocolumn': 'two_column',
        'threecolumn': 'three_column',
        'sectionheader': 'section_header',
        'chapterdivider': 'section_header',
        'imagefullbleed': 'image_full_bleed',
        'hubandspoke': 'hub_and_spoke',
        'imageoverlapleft': 'image_overlap_left',
        'chartwaterfall': 'bridge_chart',
        'matrix2x2': 'quadrant_chart',
        'imagewithhotspots': 'feature_highlight_image',
        'companytimeline': 'timeline',
        'imagefocusright': 'image_focus_right',
        'imagefocusleft': 'image_focus_left',
        'imagewithsidebullets': 'image_with_side_bullets',
        'alternatingfeaturelist': 'alternating_feature_list',
        'coverpagelogo': 'cover_page_logo',
        'kpidashboardthree': 'kpi_dashboard_three',
        'featurelisticons': 'feature_list_icons',
        'calltoaction': 'call_to_action',
        'statshighlight': 'stats_highlight',
        'keytakeaways': 'key_takeaways',
        'thankyou': 'thank_you',
        'definitionlist': 'definition_list',
        'teammembersfour': 'team_members_four',
        'radialdiagram': 'radial_diagram',
        'stepflow': 'step_flow',
        'cyclediagram': 'cycle_diagram',
        'venndiagram': 'venn_diagram',
        'quadrantchart': 'quadrant_chart',
        'bridgechart': 'bridge_chart',
        'ganttchartsimple': 'gantt_chart_simple',
        'orgchart': 'org_chart',
        'mindmap': 'mind_map',
        'fishbonediagram': 'fishbone_diagram',
        'areachart': 'area_chart',
        'scatterplot': 'scatter_plot',
        'bubblechart': 'bubble_chart',
        'imagegridfour': 'image_grid_four',
        'imagewithcaptionbelow': 'image_with_caption_below',
        'textoverimage': 'text_over_image',
        'quotewithimage': 'quote_with_image',
        'featurehighlightimage': 'feature_highlight_image',
        'imagecollage': 'image_collage',
        'numberedlistlarge': 'numbered_list_large',
        'stepflowvertical': 'step_flow_vertical',
        'circularflow': 'circular_flow',
        'staggeredlist': 'staggered_list',
        'prosandcons': 'pros_and_cons',
        'kpidashboardfour': 'kpi_dashboard_four',
        'targetvsactual': 'target_vs_actual',
        'worldmappins': 'world_map_pins',
        'chartradar': 'chart_radar',
        'chartheatmap': 'chart_heatmap',
        'datatablehighlight': 'data_table_highlight',
        'gaugechartthree': 'gauge_chart_three',
        'progressbarlist': 'progress_bar_list',
        'roadmaphorizontal': 'roadmap_horizontal',
        'roadmapvertical': 'roadmap_vertical',
        'matrix3x3': 'matrix_3x3',
        'geardiagram': 'gear_diagram',
        'arrowprocessflow': 'arrow_process_flow',
        'divergingarrows': 'diverging_arrows',
        'convergingarrows': 'converging_arrows',
        'chevronlist': 'chevron_list',
        'projectdashboard': 'project_dashboard',
        'imagegridthree': 'image_grid_three',
        'imagegridfive': 'image_grid_five',
        'imagecarouselmockup': 'image_carousel_mockup',
        'imagebeforeafter': 'image_before_after',
        'devicemockupphone': 'device_mockup_phone',
        'devicemockuplaptop': 'device_mockup_laptop',
        'imageheadertextbelow': 'image_header_text_below',
        'speakerintroduction': 'speaker_introduction',
        'testimonialsingle': 'testimonial_single',
        'testimonialthree': 'testimonial_three',
        'icongridfour': 'icon_grid_four',
        'numberedhighlightsfour': 'numbered_highlights_four',
        'contactinformation': 'contact_information',
        'nextsteps': 'next_steps',
        'wordcloud': 'word_cloud',
        'statement': 'statement', // Explicit mapping for clarity
    };
    const normalizedKey = layout?.trim().toLowerCase().replace(/[_ ]/g, '') || '';
    return layoutAliasMap[normalizedKey] || layout as SlideLayout;
  }

  private round(value: number, decimals: number = 4): number {
    return Number(value.toFixed(decimals));
  }

  private selectSlideForExport(index: number): void {
    // A simplified navigation without animations for PDF/PNG export.
    this.currentSlideIndex.set(index);
  }

  private async downloadAsPptx(): Promise<void> {
    const pres = this.presentation();
    if (!pres || typeof PptxGenJS === 'undefined') {
      this.geminiService.error.set({ message: 'Presentation data or PPTX library not available.', reportable: true });
      return;
    }

    this.isDownloadMenuOpen.set(false);
    this.downloadState.set('pptx');

    try {
      const pptx = new PptxGenJS();
      pptx.layout = 'LAYOUT_16x9';

      const theme = pres.theme;
      const cleanColor = (hex: string) => hex.startsWith('#') ? hex.substring(1) : hex;

      for (const slide of pres.slides) {
        const normalizedLayout = this.normalizeLayout(slide.layout);
        const transitionOptions: any = {};
        if (slide.animation && slide.animation !== 'none') {
            transitionOptions.duration = 1;
            transitionOptions.advClick = true;
            switch(slide.animation) {
                case 'fadeIn': transitionOptions.type = 'fade'; break;
                case 'flyIn': transitionOptions.type = 'push'; transitionOptions.dir = 'l'; break;
                case 'wipe': transitionOptions.type = 'wipe'; transitionOptions.dir = 'l'; break;
                case 'zoomIn': transitionOptions.type = 'zoom'; transitionOptions.dir = 'in'; break;
            }
        }
        
        const pptxSlide = pptx.addSlide({ transition: transitionOptions });
        pptxSlide.background = { color: cleanColor(theme.backgroundColor) };

        const titleOpts: any = { fontFace: theme.titleFont, color: cleanColor(theme.primaryColor), fontSize: 32, bold: true, align: 'left' };
        const bodyOpts: any = { fontFace: theme.bodyFont, color: cleanColor(theme.textColor), fontSize: 16 };
        const content = this.getContentArray(slide.content);

        // Common layout logic for text positioning
        // NOTE: We increased some vertical margins to prevent overlaps
        
        switch (normalizedLayout) {
          case 'title':
          case 'conclusion':
          case 'thank_you':
          case 'section_header':
          case 'word_cloud': // Fallback for complex visuals
            pptxSlide.addText(slide.title, { ...titleOpts, fontSize: 44, x: '5%', y: '35%', w: '90%', h: '20%', align: 'center', autoFit: true });
            if (content.length > 0) {
              pptxSlide.addText(content.join('\n'), { ...bodyOpts, fontSize: 22, x: '10%', y: '58%', w: '80%', h: '30%', align: 'center', autoFit: true });
            }
            break;
            
          case 'statement':
            // Huge centered text
            pptxSlide.addText(slide.title, { ...titleOpts, fontSize: 54, x: '5%', y: '30%', w: '90%', h: '40%', align: 'center', autoFit: true });
            break;

          case 'text_over_image':
            if (slide.imageUrl) {
               try {
                pptxSlide.addImage({ data: slide.imageUrl, sizing: { type: 'cover', w: '100%', h: '100%'} });
                pptxSlide.addShape(pptx.shapes.RECTANGLE, { x: 0, y: 0, w: '100%', h: '100%', fill: { color: '000000', transparency: 60 } });
              } catch (e) {
                console.error("PPTX Export: Failed to add background or overlay.", e);
              }
            }
            pptxSlide.addText(slide.title, { ...titleOpts, color: 'FFFFFF', fontSize: 36, x: '10%', y: '40%', w: '80%', h: '20%', align: 'center', autoFit: true });
            if(content.length > 0) {
                pptxSlide.addText(content.join('\n'), { ...bodyOpts, color: 'FFFFFF', fontSize: 18, x: '10%', y: '62%', w: '80%', h: '20%', align: 'center', autoFit: true });
            }
            break;

          case 'call_to_action':
            pptxSlide.addText(slide.title, { ...titleOpts, fontSize: 40, x: '5%', y: '30%', w: '90%', h: '20%', align: 'center', autoFit: true });
             if (content.length > 0) {
              pptxSlide.addText(content[0], { x: '30%', y: '55%', w: '40%', h: '12%', align: 'center', ...bodyOpts, fontSize: 20, bold: true, color: cleanColor(theme.backgroundColor), fill: { color: cleanColor(theme.primaryColor) }, autoFit: true });
            }
            break;

          case 'content_left':
          case 'image_focus_left':
            pptxSlide.addText(slide.title, { ...titleOpts, fontSize: 32, x: '5%', y: '5%', w: '43%', h: '15%', autoFit: true });
            pptxSlide.addText( content.map(p => ({ text: p, options: { ...bodyOpts, bullet: { indent: 20 }, paraSpaceAfter: 10 } })), { x: '5%', y: '22%', w: '43%', h: '70%', autoFit: true });
            if (slide.imageUrl) {
              pptxSlide.addImage({ data: slide.imageUrl, x: '52%', y: '15%', w: '43%', h: '70%', sizing: { type: 'contain', w: '43%', h: '70%' } });
            }
            break;
            
          case 'content_right':
          case 'image_with_side_bullets':
          case 'image_focus_right':
            if (slide.imageUrl) {
              pptxSlide.addImage({ data: slide.imageUrl, x: '5%', y: '15%', w: '43%', h: '70%', sizing: { type: 'contain', w: '43%', h: '70%' } });
            }
            pptxSlide.addText(slide.title, { ...titleOpts, fontSize: 32, x: '52%', y: '5%', w: '43%', h: '15%', autoFit: true });
            pptxSlide.addText( content.map(p => ({ text: p, options: { ...bodyOpts, bullet: { indent: 20 }, paraSpaceAfter: 10 } })), { x: '52%', y: '22%', w: '43%', h: '70%', autoFit: true });
            break;
          
          case 'two_column':
            pptxSlide.addText(slide.title, { ...titleOpts, x: '5%', y: '5%', w: '90%', h: '10%', align: 'center', autoFit: true });
            if (slide.isSourceSlide) {
                const sourceObjects = content.map(line => {
                    const parts = line.split(' - ');
                    const uri = parts.pop() || '';
                    const title = parts.join(' - ');
                    return { title, uri };
                });
                const textObjectsForPptx = sourceObjects.map(source => ({
                    text: source.title,
                    options: { ...bodyOpts, fontSize: 9, hyperlink: { url: source.uri, tooltip: `Visit: ${source.uri}` }, bullet: true, paraSpaceAfter: 4 }
                }));
                const midpoint = Math.ceil(textObjectsForPptx.length / 2);
                pptxSlide.addText(textObjectsForPptx.slice(0, midpoint), { x: '5%', y: '20%', w: '44%', h: '75%', autoFit: true });
                pptxSlide.addText(textObjectsForPptx.slice(midpoint), { x: '51%', y: '20%', w: '44%', h: '75%', autoFit: true });
            } else {
                const midpoint = Math.ceil(content.length / 2);
                const colOpts = { ...bodyOpts, bullet: true, paraSpaceAfter: 10 };
                // Increased spacing between columns slightly (43% width) to prevent visual bleeding
                pptxSlide.addText(content.slice(0, midpoint).map(p => ({ text: p, options: colOpts })), { x: '5%', y: '20%', w: '43%', h: '75%', autoFit: true });
                pptxSlide.addText(content.slice(midpoint).map(p => ({ text: p, options: colOpts })), { x: '52%', y: '20%', w: '43%', h: '75%', autoFit: true });
            }
            break;

          case 'three_column':
            pptxSlide.addText(slide.title, { ...titleOpts, x: '5%', y: '5%', w: '90%', h: '10%', align: 'center', autoFit: true });
            const columns = [];
            for (let i = 0; i < content.length; i += 2) {
                if (content[i] !== undefined) columns.push({ title: content[i], text: content[i + 1] || '' });
            }
            columns.slice(0,3).forEach((col, i) => {
              const xPos = 5 + (i * 31);
              pptxSlide.addText(col.title, { ...titleOpts, fontSize: 18, x: `${xPos}%`, y: '20%', w: '28%', h: '10%', autoFit: true });
              pptxSlide.addText(col.text, { ...bodyOpts, fontSize: 14, x: `${xPos}%`, y: '32%', w: '28%', h: '60%', autoFit: true });
            });
            break;

          case 'quote':
            pptxSlide.addText(`"${slide.title}"`, { ...titleOpts, fontSize: 32, x: '10%', y: '30%', w: '80%', h: '40%', align: 'center', valign: 'middle', italic: true, autoFit: true });
            if (content.length > 0) {
              pptxSlide.addText(`- ${content[0]}`, { ...bodyOpts, fontSize: 18, x: '10%', y: '70%', w: '80%', h: '10%', align: 'right', autoFit: true });
            }
            break;
            
          case 'image_full_bleed':
             if (slide.imageUrl) {
              try {
                pptxSlide.addImage({ data: slide.imageUrl, sizing: { type: 'cover', w: '100%', h: '100%'} });
                pptxSlide.addShape(pptx.shapes.RECTANGLE, { x: 0, y: 0, w: '100%', h: '100%', fill: { color: '000000', transparency: 50 } });
              } catch (e) {
                console.error("PPTX Export: Failed to add background or overlay for 'image_full_bleed'.", e);
              }
            }
            pptxSlide.addText(slide.title, { ...titleOpts, color: 'FFFFFF', fontSize: 44, x: '5%', y: '40%', w: '90%', h: '15%', align: 'center', shadow: { type: 'outer', color: '000000', blur: 5, offset: 2, angle: 45 }, autoFit: true });
             if (content.length > 0) {
              pptxSlide.addText(content[0], { ...bodyOpts, color: 'FFFFFF', fontSize: 22, x: '5%', y: '55%', w: '90%', h: '10%', align: 'center', shadow: { type: 'outer', color: '000000', blur: 3, offset: 1, angle: 45 }, autoFit: true });
            }
            break;
          
          case 'timeline':
          case 'company_timeline': {
            pptxSlide.addText(slide.title, { ...titleOpts, x: 0.5, y: 0.1125, w: 9, h: 0.5625, align: 'center', autoFit: true });
            try {
              pptxSlide.addShape(pptx.shapes.LINE, { x: 5, y: 0.84375, w: 0, h: 4.5, line: { color: cleanColor(theme.primaryColor), width: 2 } });
            } catch (e) {
              console.error("PPTX Export: Failed to add main line for 'timeline'.", e);
            }

            const timelineItems = [];
            for (let i = 0; i < content.length; i += 2) {
              if (content[i] !== undefined) timelineItems.push({ title: content[i], text: content[i + 1] || '' });
            }

            if (timelineItems.length > 0) {
              const yStep_in = 4.5 / timelineItems.length;
              const startY_in = 0.84375;

              timelineItems.forEach((item, i) => {
                const ovalCenterY_in = startY_in + (i * yStep_in) + (yStep_in / 2);
                const ovalSize_in = 0.2;

                try {
                  pptxSlide.addShape(pptx.shapes.OVAL, {
                    x: 5 - (ovalSize_in / 2),
                    y: ovalCenterY_in - (ovalSize_in / 2),
                    w: ovalSize_in,
                    h: ovalSize_in,
                    fill: { color: cleanColor(theme.primaryColor) }
                  });
                } catch (e) {
                  const errorMessage = `PPTX Export: Failed to add oval for timeline item ${i}.`;
                  console.error(errorMessage, e);
                  this.geminiService.error.set({ message: `${errorMessage}\n${(e as Error).message}`, reportable: true });
                }

                const isLeft = i % 2 === 0;
                const textW_in = 4;
                const textX_in = isLeft ? 0.5 : 5.5;
                const textAlign = isLeft ? 'right' : 'left';
                
                const textBlockH_in = yStep_in * 0.8;
                const textBlockY_in = ovalCenterY_in - (textBlockH_in / 2);

                pptxSlide.addText(item.title, { ...titleOpts, fontSize: 16, x: textX_in, y: this.round(textBlockY_in), w: textW_in, h: this.round(textBlockH_in / 2), align: textAlign, valign: 'bottom', autoFit: true });
                pptxSlide.addText(item.text, { ...bodyOpts, fontSize: 12, x: textX_in, y: this.round(textBlockY_in + (textBlockH_in / 2)), w: textW_in, h: this.round(textBlockH_in / 2), align: textAlign, valign: 'top', autoFit: true });
              });
            }
            break;
          }

          case 'roadmap_horizontal': 
          case 'step_flow':
          case 'circular_flow': // Simplified as linear for PPTX
          case 'arrow_process_flow':
          case 'chevron_list':
            // Horizontal layout logic
            pptxSlide.addText(slide.title, { ...titleOpts, x: '5%', y: '5%', w: '90%', h: '10%', align: 'center', autoFit: true });
            
            const roadmapItems = [];
            for(let i=0; i<content.length; i+=2) {
                if(content[i]) roadmapItems.push({ title: content[i], text: content[i+1] || '' });
            }
            const count = Math.min(roadmapItems.length, 5); // Limit to 5 for fit
            if(count > 0) {
                const itemW = 80 / count;
                // Draw connecting line
                pptxSlide.addShape(pptx.shapes.LINE, { x: '10%', y: '35%', w: '80%', h: 0, line: { color: cleanColor(theme.primaryColor), width: 3 } });
                
                roadmapItems.slice(0, 5).forEach((item, i) => {
                    const xPos = 10 + (i * itemW);
                    const shapeType = normalizedLayout === 'chevron_list' ? pptx.shapes.CHEVRON : (normalizedLayout === 'arrow_process_flow' ? pptx.shapes.RIGHT_ARROW : pptx.shapes.OVAL);
                    
                    // Shape on the line
                    pptxSlide.addShape(shapeType, { 
                        x: `${xPos + itemW/2 - 2}%`, y: '33%', w: '4%', h: '4%', 
                        fill: { color: cleanColor(theme.primaryColor) } 
                    });
                    
                    // Title above
                    pptxSlide.addText(item.title, { ...titleOpts, fontSize: 14, x: `${xPos}%`, y: '20%', w: `${itemW}%`, h: '10%', align: 'center', autoFit: true });
                    // Text below
                    pptxSlide.addText(item.text, { ...bodyOpts, fontSize: 12, x: `${xPos}%`, y: '40%', w: `${itemW}%`, h: '40%', align: 'center', autoFit: true });
                });
            }
            break;

          case 'process':
            pptxSlide.addText(slide.title, { ...titleOpts, x: '5%', y: '5%', w: '90%', h: '10%', align: 'center', autoFit: true });
            const processItemsRaw = [];
            for (let i = 0; i < content.length; i += 2) {
                if (content[i] !== undefined) processItemsRaw.push({ title: content[i], text: content[i + 1] || '' });
            }
            const processItems = processItemsRaw.slice(0, 5);
            const totalItems = processItems.length;

            if (totalItems > 0) {
                let itemPositions: { x: number, w: number }[] = [];
                let linePositions: { x: number, w: number }[] = [];

                switch (totalItems) {
                    case 1: itemPositions = [{ x: 40, w: 20 }]; break;
                    case 2:
                        itemPositions = [{ x: 20, w: 25 }, { x: 55, w: 25 }];
                        linePositions = [{ x: 45, w: 10 }]; break;
                    case 3:
                        itemPositions = [{ x: 10, w: 20 }, { x: 40, w: 20 }, { x: 70, w: 20 }];
                        linePositions = [{ x: 30, w: 10 }, { x: 60, w: 10 }]; break;
                    case 4:
                        itemPositions = [{ x: 5, w: 18 }, { x: 28, w: 18 }, { x: 51, w: 18 }, { x: 74, w: 18 }];
                        linePositions = [{ x: 23, w: 5 }, { x: 46, w: 5 }, { x: 69, w: 5 }]; break;
                    case 5:
                        itemPositions = [{ x: 2, w: 15 }, { x: 22, w: 15 }, { x: 42, w: 15 }, { x: 62, w: 15 }, { x: 82, w: 15 }];
                        linePositions = [{ x: 17, w: 5 }, { x: 37, w: 5 }, { x: 57, w: 5 }, { x: 77, w: 5 }]; break;
                }

                processItems.forEach((item, i) => {
                    const pos = itemPositions[i];
                    pptxSlide.addText(`${i + 1}`, { x: `${pos.x}%`, y: '30%', w: `${pos.w}%`, h: '10%', align: 'center', fontFace: theme.titleFont, fontSize: 24, color: cleanColor(theme.primaryColor), bold: true });
                    pptxSlide.addText(item.title, { x: `${pos.x}%`, y: '45%', w: `${pos.w}%`, h: '10%', align: 'center', ...bodyOpts, bold: true, fontSize: 16, autoFit: true });
                    pptxSlide.addText(item.text, { x: `${pos.x}%`, y: '60%', w: `${pos.w}%`, h: '30%', align: 'center', ...bodyOpts, fontSize: 12, autoFit: true });
                });

                linePositions.forEach(line => {
                    try {
                      pptxSlide.addShape(pptx.shapes.LINE, {
                          x: `${line.x}%`, y: '35%', w: `${line.w}%`, h: 0,
                          line: { color: cleanColor(theme.primaryColor), width: 2, dashType: 'dash' }
                      });
                    } catch(e) { 
                      console.error("PPTX Export: Failed to add connecting line for 'process'.", e);
                    }
                });
            }
            break;
            
          case 'kpi_dashboard_three':
          case 'stats_highlight':
          case 'gauge_chart_three': // Map gauges to stats for simplicity in PPTX
            pptxSlide.addText(slide.title, { ...titleOpts, x:'5%', y:'10%', w:'90%', h:'10%', align:'center', autoFit: true });
            const kpiItemsRaw = [];
            for (let i = 0; i < content.length; i += 2) {
              if(content[i] !== undefined) kpiItemsRaw.push({ stat: content[i], label: content[i+1] || '' });
            }
            const maxKpis = normalizedLayout === 'kpi_dashboard_three' ? 3 : 4;
            const kpiItems = kpiItemsRaw.slice(0, maxKpis);

            if (kpiItems.length > 0) {
              const kpiItemWidth = 22; // Adjusted width
              const totalKpiWidth = kpiItems.length * kpiItemWidth;
              const kpiGap = (100 - totalKpiWidth) / (kpiItems.length + 1);

              kpiItems.forEach((item, i) => {
                const xPos = kpiGap + (i * (kpiItemWidth + kpiGap));
                pptxSlide.addText(item.stat, { ...titleOpts, fontSize: 48, x:`${xPos}%`, y:'40%', w:`${kpiItemWidth}%`, h:'20%', align:'center', autoFit: true });
                pptxSlide.addText(item.label, { ...bodyOpts, fontSize: 16, x:`${xPos}%`, y:'60%', w:`${kpiItemWidth}%`, h:'10%', align:'center', autoFit: true });
              });
            }
            break;

          case 'agenda':
          case 'key_takeaways':
          case 'definition_list':
          case 'checklist':
          case 'numbered_list_large':
            pptxSlide.addText(slide.title, { ...titleOpts, x:'10%', y:'10%', w:'80%', h:'10%', align:'center', autoFit: true });
            const listItems = (normalizedLayout === 'definition_list') 
              ? content.map((item, i) => (i % 2 === 0) 
                  ? { text: item, options: { ...bodyOpts, bold: true, fontSize: 18, breakLine: true } }
                  : { text: item, options: { ...bodyOpts, fontSize: 16, bullet: { indent: 30 }, breakLine: true, paraSpaceAfter: 10 } } )
              : content.map(item => ({ text: item, options: { ...bodyOpts, bullet: true, fontSize: 20, paraSpaceAfter: 10 } }));
            pptxSlide.addText(listItems, { x:'15%', y:'25%', w:'70%', h:'70%', autoFit: true });
            break;

          case 'table':
          case 'data_table_highlight':
            pptxSlide.addText(slide.title, { ...titleOpts, x: '5%', y: '2%', w: '90%', h: '10%', align: 'center', autoFit: true });
            if (slide.tableData) {
              const tableRows = slide.tableData.map((row, i) => {
                return row.map(cell => ({ text: cell, options: i === 0 ? { ...bodyOpts, bold: true, fill: cleanColor(theme.primaryColor), color: 'FFFFFF' } : bodyOpts }));
              });
              pptxSlide.addTable(tableRows, { x: '10%', y: '15%', w: '80%', border: { type: 'solid', pt: 1, color: cleanColor(theme.primaryColor) }, autoPage: true, rowH: 0.4, fill: cleanColor(theme.backgroundColor), valign: 'middle' });
            }
            break;
            
          case 'alternating_feature_list':
          case 'staggered_list':
            pptxSlide.addText(slide.title, { ...titleOpts, x:'5%', y:'2%', w:'90%', h:'10%', align:'center', autoFit: true });
            const altItems = [];
            for (let i = 0; i < content.length; i += 2) {
              if(content[i] !== undefined) altItems.push({ title: content[i], text: content[i+1] || '' });
            }
            if (altItems.length > 0) {
                const yStepAlt = 85 / altItems.length;
                altItems.slice(0, 4).forEach((item, i) => {
                    const yPos = 15 + (i * yStepAlt);
                    const isLeft = i % 2 === 0;
                    pptxSlide.addText(item.title, { ...titleOpts, fontSize:20, x: isLeft ? '10%' : '50%', y: `${yPos}%`, w: '40%', h:'10%', align: isLeft ? 'left' : 'right', autoFit: true });
                    pptxSlide.addText(item.text, { ...bodyOpts, x: isLeft ? '10%' : '50%', y: `${yPos + 5}%`, w: '40%', h:'10%', align: isLeft ? 'left' : 'right', autoFit: true });
                });
            }
            break;

          case 'cover_page_logo':
            if (slide.imageUrl) {
               pptxSlide.addImage({ data: slide.imageUrl, x: '42.5%', y: '20%', w: '15%', h: '20%', sizing: { type: 'contain', w: '15%', h: '20%' } });
            }
            pptxSlide.addText(slide.title, { ...titleOpts, fontSize: 48, x: '5%', y: '45%', w: '90%', h: '15%', align: 'center', autoFit: true });
            if (content.length > 0) {
              pptxSlide.addText(content[0], { ...bodyOpts, fontSize: 24, x: '5%', y: '60%', w: '90%', h: '10%', align: 'center', autoFit: true });
            }
            break;

          case 'feature_list_icons':
          case 'icon_grid_four':
          case 'contact_information':
            pptxSlide.addText(slide.title, { ...titleOpts, x: '5%', y: '5%', w: '90%', h: '10%', align: 'center', autoFit: true });
            const iconItems = [];
            for (let i = 0; i < content.length; i+=2) {
              if (content[i] !== undefined) iconItems.push({ icon: content[i], text: content[i+1] || '' });
            }
            // Use bullet points as placeholders for icons in PPTX as dynamic icon injection is hard without external image service
            const featureText = iconItems.map(item => ({ text: item.text, options: { ...bodyOpts, bullet: { code: '25CF' }, fontSize: 18, paraSpaceAfter: 10 } }));
            pptxSlide.addText(featureText, { x: '15%', y: '20%', w: '70%', h: '75%', autoFit: true });
            break;

          case 'numbered_highlights_four':
            pptxSlide.addText(slide.title, { ...titleOpts, x: '5%', y: '5%', w: '90%', h: '10%', align: 'center', autoFit: true });
            const highlights = content.slice(0, 4);
            const hlWidth = 22;
            const hlGap = (100 - (highlights.length * hlWidth)) / (highlights.length + 1);
            highlights.forEach((text, i) => {
                const x = hlGap + (i * (hlWidth + hlGap));
                pptxSlide.addText(`${i+1}`, { x: `${x}%`, y: '30%', w: `${hlWidth}%`, h: '15%', fontSize: 48, color: cleanColor(theme.primaryColor), bold: true, align: 'center' });
                pptxSlide.addText(text, { ...bodyOpts, x: `${x}%`, y: '50%', w: `${hlWidth}%`, h: '30%', fontSize: 14, align: 'center', autoFit: true });
            });
            break;

          case 'comparison':
          case 'pros_and_cons':
            pptxSlide.addText(slide.title, { ...titleOpts, x: '5%', y: '5%', w: '90%', h: '10%', align: 'center', autoFit: true });
            const separatorIndex = content.indexOf('---');
            const itemA = { title: content[0] || '', points: content.slice(1, separatorIndex > 0 ? separatorIndex : Math.ceil(content.length/2)) };
            const itemB = { title: content[separatorIndex + 1] || '', points: content.slice(separatorIndex > 0 ? separatorIndex + 2 : Math.ceil(content.length/2)) };
            pptxSlide.addText(itemA.title, { ...titleOpts, fontSize:22, x:'5%', y:'20%', w:'43%', h:'10%', align:'center', autoFit: true });
            pptxSlide.addText(itemA.points.map(p => ({text:p, options: {...bodyOpts, bullet:true, paraSpaceAfter: 10}})), { x:'5%', y:'30%', w:'43%', h:'65%', autoFit: true });
            pptxSlide.addText(itemB.title, { ...titleOpts, fontSize:22, x:'52%', y:'20%', w:'43%', h:'10%', align:'center', autoFit: true });
            pptxSlide.addText(itemB.points.map(p => ({text:p, options: {...bodyOpts, bullet:true, paraSpaceAfter: 10}})), { x:'52%', y:'30%', w:'43%', h:'65%', autoFit: true });
            break;

          case 'swot':
          case 'matrix_3x3': // Fallback to 2x2 style for simplicity in PPTX loop if exact matrix isn't needed
          case 'quadrant_chart':
            pptxSlide.addText(slide.title, { ...titleOpts, x: '5%', y: '2%', w: '90%', h: '8%', align: 'center', autoFit: true });
            // Draw quadrant lines
            pptxSlide.addShape(pptx.shapes.LINE, { x: '50%', y: '15%', w: 0, h: '80%', line: { color: cleanColor(theme.primaryColor), width: 2 } });
            pptxSlide.addShape(pptx.shapes.LINE, { x: '5%', y: '55%', w: '90%', h: 0, line: { color: cleanColor(theme.primaryColor), width: 2 } });

            const swotContent = (normalizedLayout === 'swot') 
                ? [
                    { title: content[0] || 'Strengths', text: content[1] || '' },
                    { title: content[2] || 'Weaknesses', text: content[3] || '' },
                    { title: content[4] || 'Opportunities', text: content[5] || '' },
                    { title: content[6] || 'Threats', text: content[7] || '' }
                  ]
                : [
                    { title: content[0] || 'Q1', text: content[1] || '' },
                    { title: content[2] || 'Q2', text: content[3] || '' },
                    { title: content[4] || 'Q3', text: content[5] || '' },
                    { title: content[6] || 'Q4', text: content[7] || '' }
                ];

            const swotPositions = [
                { x: '5%', y: '12%' }, { x: '52%', y: '12%' },
                { x: '5%', y: '55%' }, { x: '52%', y: '55%' }
            ];
            swotPositions.forEach((pos, i) => {
                if(swotContent[i]) {
                    pptxSlide.addText(swotContent[i].title, { ...titleOpts, fontSize: 18, x: pos.x, y: pos.y, w: '43%', h: '8%', bold: true, align: 'center', autoFit: true });
                    pptxSlide.addText(this.getContentArray(swotContent[i].text).map(p => ({ text: p, options: { ...bodyOpts, bullet: true, paraSpaceAfter: 5 }})), { x: pos.x, y: `${parseFloat(pos.y) + 8}%`, w: '43%', h: '35%', autoFit: true });
                }
            });
            break;

          case 'pyramid':
          case 'funnel':
            pptxSlide.addText(slide.title, { ...titleOpts, x: '5%', y: '5%', w: '90%', h: '10%', align: 'center', autoFit: true });
            const items = content.slice(0, 5);
            const itemCount = items.length;
            const yStep = 80 / itemCount;
            items.forEach((item, i) => {
                const layerIndex = normalizedLayout === 'pyramid' ? (itemCount - 1 - i) : i;
                const width = 60 - (layerIndex * 10);
                const x = 50 - (width / 2);
                const y = 15 + (i * yStep);
                pptxSlide.addShape(pptx.shapes.TRAPEZOID, { x: `${x}%`, y: `${y}%`, w: `${width}%`, h: `${yStep}%`, fill: { color: cleanColor(theme.primaryColor), transparency: i * 15 } });
                pptxSlide.addText(item, { ...bodyOpts, color: cleanColor(theme.backgroundColor), bold: true, x: `${x}%`, y: `${y}%`, w: `${width}%`, h: `${yStep}%`, align: 'center', valign: 'middle', autoFit: true });
            });
            break;

          case 'radial_diagram':
          case 'hub_and_spoke':
          case 'mind_map':
            pptxSlide.addText(slide.title, { ...titleOpts, x: '5%', y: '2%', w: '90%', h: '8%', align: 'center', autoFit: true });
            const centerText = content[0] || 'Center';
            const satellites = content.slice(1, 7);
            const satelliteCount = satellites.length;

            // Center circle
            pptxSlide.addShape(pptx.shapes.OVAL, { x: '40%', y: '40%', w: '20%', h: '20%', fill: { color: cleanColor(theme.primaryColor) } });
            pptxSlide.addText(centerText, { ...bodyOpts, color: cleanColor(theme.backgroundColor), bold: true, x: '40%', y: '40%', w: '20%', h: '20%', align: 'center', valign: 'middle', autoFit: true });

            satellites.forEach((text, i) => {
                const angle = (i / satelliteCount) * 2 * Math.PI;
                const x = 50 + 35 * Math.cos(angle);
                const y = 50 + 35 * Math.sin(angle);
                pptxSlide.addShape(pptx.shapes.LINE, { x1: '50%', y1: '50%', x2: `${x}%`, y2: `${y}%`, line: { color: cleanColor(theme.primaryColor), width: 1, dashType: 'dash' } });
                pptxSlide.addText(text, { ...bodyOpts, x: `${x-10}%`, y: `${y-5}%`, w: '20%', h: '10%', align: 'center', autoFit: true });
            });
            break;

          case 'cycle_diagram':
            pptxSlide.addText(slide.title, { ...titleOpts, x: '5%', y: '5%', w: '90%', h: '10%', align: 'center', autoFit: true });
            const cycleItems = content.slice(0, 5);
            const cycleCount = cycleItems.length;
            const radius = 28; // Reduced slightly to avoid edge clipping
            const centerY = 55; // Lowered center to avoid title overlap

            cycleItems.forEach((text, i) => {
              const angle = (i / cycleCount) * 2 * Math.PI - (Math.PI / 2); // Start from top
              const x = 50 + radius * Math.cos(angle);
              const y = centerY + (radius * (16/9)) * Math.sin(angle); // Aspect correction for positioning
              
              const bubbleW = 18;
              const bubbleH = 25; // Adjusted height for text fit

              pptxSlide.addShape(pptx.shapes.OVAL, { 
                  x: `${x - bubbleW/2}%`, 
                  y: `${y - bubbleH/2}%`, 
                  w: `${bubbleW}%`, 
                  h: `${bubbleH}%`, 
                  fill: { color: cleanColor(theme.primaryColor) },
                  line: { color: 'FFFFFF', width: 2 } // White border for fidelity
              });
              
              pptxSlide.addText(text, { 
                  ...bodyOpts, 
                  color: cleanColor(theme.backgroundColor), // FIX: Contrast issue
                  bold: true, 
                  x: `${x - bubbleW/2 + 2}%`, 
                  y: `${y - bubbleH/2 + 5}%`, 
                  w: `${bubbleW - 4}%`, 
                  h: `${bubbleH - 10}%`, 
                  align: 'center', 
                  valign: 'middle', 
                  fontSize: 14, 
                  autoFit: true 
              });
            });
            break;

          case 'image_grid_three':
            // 1 Big left, 2 small right
            pptxSlide.addText(slide.title, { ...titleOpts, x: '5%', y: '2%', w: '90%', h: '10%', align: 'center', autoFit: true });
            if (slide.imageUrl) {
                pptxSlide.addImage({ data: slide.imageUrl, x: '5%', y: '15%', w: '44%', h: '75%', sizing: { type: 'cover', w: '44%', h: '75%' } });
                pptxSlide.addImage({ data: slide.imageUrl, x: '51%', y: '15%', w: '44%', h: '36%', sizing: { type: 'cover', w: '44%', h: '36%' } });
                pptxSlide.addImage({ data: slide.imageUrl, x: '51%', y: '54%', w: '44%', h: '36%', sizing: { type: 'cover', w: '44%', h: '36%' } });
            }
            break;

          case 'image_grid_four':
            // 2x2 Grid
            pptxSlide.addText(slide.title, { ...titleOpts, x: '5%', y: '2%', w: '90%', h: '10%', align: 'center', autoFit: true });
            if (slide.imageUrl) {
                pptxSlide.addImage({ data: slide.imageUrl, x: '5%', y: '15%', w: '44%', h: '36%', sizing: { type: 'cover', w: '44%', h: '36%' } });
                pptxSlide.addImage({ data: slide.imageUrl, x: '51%', y: '15%', w: '44%', h: '36%', sizing: { type: 'cover', w: '44%', h: '36%' } });
                pptxSlide.addImage({ data: slide.imageUrl, x: '5%', y: '54%', w: '44%', h: '36%', sizing: { type: 'cover', w: '44%', h: '36%' } });
                pptxSlide.addImage({ data: slide.imageUrl, x: '51%', y: '54%', w: '44%', h: '36%', sizing: { type: 'cover', w: '44%', h: '36%' } });
            }
            break;

          case 'image_grid_five':
            // 1 Big Center, 4 surrounding? Or 3 top 2 bottom. Let's do 3 top 2 bottom.
            pptxSlide.addText(slide.title, { ...titleOpts, x: '5%', y: '2%', w: '90%', h: '10%', align: 'center', autoFit: true });
            if(slide.imageUrl) {
                const w3 = 30; // ~90% / 3
                const h2 = 36;
                pptxSlide.addImage({ data: slide.imageUrl, x: '5%', y: '15%', w: `${w3}%`, h: `${h2}%`, sizing: { type: 'cover', w: `${w3}%`, h: `${h2}%` } });
                pptxSlide.addImage({ data: slide.imageUrl, x: '36%', y: '15%', w: `${w3}%`, h: `${h2}%`, sizing: { type: 'cover', w: `${w3}%`, h: `${h2}%` } });
                pptxSlide.addImage({ data: slide.imageUrl, x: '67%', y: '15%', w: `${w3}%`, h: `${h2}%`, sizing: { type: 'cover', w: `${w3}%`, h: `${h2}%` } });
                
                pptxSlide.addImage({ data: slide.imageUrl, x: '20%', y: '54%', w: `${w3}%`, h: `${h2}%`, sizing: { type: 'cover', w: `${w3}%`, h: `${h2}%` } });
                pptxSlide.addImage({ data: slide.imageUrl, x: '52%', y: '54%', w: `${w3}%`, h: `${h2}%`, sizing: { type: 'cover', w: `${w3}%`, h: `${h2}%` } });
            }
            break;

          case 'image_header_text_below':
            if (slide.imageUrl) {
                pptxSlide.addImage({ data: slide.imageUrl, x: '0', y: '0', w: '100%', h: '40%', sizing: { type: 'cover', w: '100%', h: '40%' } });
            }
            pptxSlide.addText(slide.title, { ...titleOpts, x: '5%', y: '45%', w: '90%', h: '15%', align: 'left', autoFit: true });
            pptxSlide.addText(content.map(p => ({ text: p, options: { ...bodyOpts, bullet: true } })), { x: '5%', y: '60%', w: '90%', h: '35%', autoFit: true });
            break;

          // Chart Types
          case 'chart_bar':
          case 'chart_line':
          case 'chart_pie':
          case 'chart_doughnut':
          case 'area_chart':
          case 'chart_radar': // PptxGenJS supports Radar
          case 'scatter_plot': // PptxGenJS supports Scatter
          case 'bubble_chart': // PptxGenJS supports Bubble
          case 'chart_heatmap': // Map to Bar if not supported, but let's try mapping logic
          case 'chart_waterfall': // Map to Bar
            pptxSlide.addText(slide.title, { ...titleOpts, x: '5%', y: '2%', w: '90%', h: '10%', align: 'center', autoFit: true });
            if (slide.chartData) {
                const chartTypes: {[key:string]: any} = {
                    chart_bar: pptx.charts.BAR,
                    chart_line: pptx.charts.LINE,
                    chart_pie: pptx.charts.PIE,
                    chart_doughnut: pptx.charts.DOUGHNUT,
                    area_chart: pptx.charts.AREA,
                    chart_radar: pptx.charts.RADAR,
                    scatter_plot: pptx.charts.SCATTER,
                    bubble_chart: pptx.charts.BUBBLE,
                    // Fallbacks for types not natively identical in PptxGenJS or complex configuration
                    chart_heatmap: pptx.charts.BAR, 
                    chart_waterfall: pptx.charts.BAR,
                    gauge_chart_three: pptx.charts.DOUGHNUT
                };
                
                // Ensure chart type exists
                const selectedType = chartTypes[normalizedLayout] || pptx.charts.BAR;

                const pptxChartData = slide.chartData.datasets.map(ds => ({
                    name: ds.label,
                    labels: slide.chartData?.labels,
                    values: ds.data
                }));
                
                pptxSlide.addChart(selectedType, pptxChartData, { 
                  x: '10%', y: '15%', w: '80%', h: '80%', 
                  valAxisColor: cleanColor(theme.textColor),
                  catAxisColor: cleanColor(theme.textColor),
                  dataLabelColor: cleanColor(theme.textColor),
                  legendColor: cleanColor(theme.textColor),
                  legendPos: 'b',
                  showLegend: true
                });
            }
            break;

          default:
            pptxSlide.addText(slide.title, { ...titleOpts, x: '5%', y: '5%', w: '90%', h: '10%', autoFit: true });
            pptxSlide.addText(content.map(p => ({ text: p, options: { ...bodyOpts, bullet: true } })), { x: '5%', y: '20%', w: '90%', h: '75%', autoFit: true });
            if (slide.imageUrl) {
              pptxSlide.addImage({ data: slide.imageUrl, x: '65%', y: '25%', w: '30%', h: '50%', sizing: { type: 'contain', w: '30%', h: '50%' } });
            }
        }

        if (slide.speakerNotes) {
          const notes = Array.isArray(slide.speakerNotes) ? slide.speakerNotes.join('\n\n') : slide.speakerNotes;
          pptxSlide.addNotes(notes);
        }
      }

      await pptx.writeFile({ fileName: `${pres.title}.pptx` });
    } catch (e) {
      this.geminiService.error.set({ message: `Failed to generate PPTX: ${(e as Error).message}`, reportable: true });
    } finally {
      this.downloadState.set('idle');
    }
  }

  private async downloadAsPdf(): Promise<void> {
    const pres = this.presentation();
    if (!pres || typeof jspdf === 'undefined' || typeof html2canvas === 'undefined') return;
    this.isDownloadMenuOpen.set(false);
    this.downloadState.set('pdf');
    const originalIndex = this.currentSlideIndex();
    try {
      const { jsPDF } = jspdf;
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'px', format: 'a4' });
      const slideHostEl = document.querySelector('app-presentation-editor .w-full.max-w-7xl.aspect-\\[16\\/9\\]');
      if (!slideHostEl) throw new Error('Could not find slide element to capture.');
      for (let i = 0; i < pres.slides.length; i++) {
        this.selectSlideForExport(i);
        await new Promise(res => setTimeout(res, 100));
        const canvas = await html2canvas(slideHostEl as HTMLElement, { scale: 2, useCORS: true });
        const imgData = canvas.toDataURL('image/jpeg', 0.8);
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        if (i > 0) pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
      }
      pdf.save(`${pres.title}.pdf`);
    } catch (e) { this.geminiService.error.set({ message: `Failed to generate PDF: ${(e as Error).message}`, reportable: true }); } 
    finally { 
      this.selectSlide(originalIndex);
      this.downloadState.set('idle'); 
    }
  }

  private async downloadAsPngZip(): Promise<void> {
    const pres = this.presentation();
    if (!pres || typeof html2canvas === 'undefined' || typeof JSZip === 'undefined') return;
    this.isDownloadMenuOpen.set(false);
    this.downloadState.set('png');
    const originalIndex = this.currentSlideIndex();
    try {
      const zip = new JSZip();
      const slideHostEl = document.querySelector('app-presentation-editor .w-full.max-w-7xl.aspect-\\[16\\/9\\]');
      if (!slideHostEl) throw new Error('Could not find slide element to capture.');
      for (let i = 0; i < pres.slides.length; i++) {
        this.selectSlideForExport(i);
        await new Promise(res => setTimeout(res, 100));
        const canvas = await html2canvas(slideHostEl as HTMLElement, { useCORS: true });
        zip.file(`slide_${String(i+1).padStart(2, '0')}.png`, canvas.toDataURL('image/png').split(',')[1], { base64: true });
      }
      const content = await zip.generateAsync({ type: 'blob' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(content);
      link.download = `${pres.title}_slides.zip`;
      link.click();
      URL.revokeObjectURL(link.href);
    } catch (e) { this.geminiService.error.set({ message: `Failed to generate PNGs: ${(e as Error).message}`, reportable: true }); } 
    finally { 
      this.selectSlide(originalIndex);
      this.downloadState.set('idle'); 
    }
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
    } catch (e) { this.geminiService.error.set({ message: `Failed to generate TXT: ${(e as Error).message}`, reportable: true }); } finally { this.downloadState.set('idle'); }
  }
}
