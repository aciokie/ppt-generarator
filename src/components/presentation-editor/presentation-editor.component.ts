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

  readonly availableLayouts: { name: SlideLayout; description: string; icon: string }[] = [
    { name: 'title', description: 'A standard title and subtitle slide.', icon: 'title' },
    { name: 'section_header', description: 'A bold header to introduce a new section.', icon: 'section_header' },
    { name: 'content_left', description: 'Content on the left, media on the right.', icon: 'content_left' },
    { name: 'content_right', description: 'Media on the left, content on the right.', icon: 'content_right' },
    { name: 'two_column', description: 'Splits content into two readable columns.', icon: 'two_column' },
    { name: 'three_column', description: 'Three distinct points with titles and text.', icon: 'three_column' },
    { name: 'quote', description: 'Highlight an impactful quote.', icon: 'quote' },
    { name: 'image_full_bleed', description: 'A full-screen image with overlayed text.', icon: 'image_full_bleed' },
    { name: 'stats_highlight', description: 'Showcase key numbers or statistics.', icon: 'stats_highlight' },
    { name: 'table', description: 'Display structured data in a table format.', icon: 'table' },
    { name: 'chart_bar', description: 'Visualize categorical data with bar charts.', icon: 'chart_bar' },
    { name: 'chart_line', description: 'Show trends over time with a line chart.', icon: 'chart_line' },
    { name: 'chart_pie', description: 'Represent proportions with a pie chart.', icon: 'chart_pie' },
    { name: 'chart_doughnut', description: 'A pie chart with a hole, for proportions.', icon: 'chart_doughnut' },
    { name: 'timeline', description: 'Display events in chronological order.', icon: 'timeline' },
    { name: 'process', description: 'Illustrate a step-by-step process.', icon: 'process' },
    { name: 'pyramid', description: 'Show hierarchical relationships.', icon: 'pyramid' },
    { name: 'funnel', description: 'Visualize stages in a process, like sales.', icon: 'funnel' },
    { name: 'swot', description: 'A 2x2 grid for SWOT analysis.', icon: 'swot' },
    { name: 'conclusion', description: 'A final, concluding slide.', icon: 'conclusion' },
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
    event.preventDefault(); // Necessary to allow dropping
    if (this.draggedSlideIndex() !== index) {
      this.dropTargetIndex.set(index);
    }
  }
  
  handleDragLeave(): void {
    this.dropTargetIndex.set(null);
  }
  
  handleDrop(dropIndex: number): void {
    const pres = this.presentation();
    const draggedIndex = this.draggedSlideIndex();

    if (pres && draggedIndex !== null && draggedIndex !== dropIndex) {
      const currentIndex = this.currentSlideIndex();
      const currentSlideObject = pres.slides[currentIndex];
      
      const newSlides = [...pres.slides];
      const [draggedItem] = newSlides.splice(draggedIndex, 1);
      newSlides.splice(dropIndex, 0, draggedItem);
      
      const newPresentation = { ...pres, slides: newSlides };
      const newCurrentIndex = newSlides.indexOf(currentSlideObject);

      if (newCurrentIndex !== -1 && newCurrentIndex !== currentIndex) {
        // Animate to new position of the currently selected slide
        this.transitioningSlide.set({ slide: currentSlideObject, animation: 'animate-fade-out' });
        this.animationClass.set('animate-fade-in');

        this.commitChange(newPresentation);
        this.currentSlideIndex.set(newCurrentIndex);
        
        setTimeout(() => {
          this.transitioningSlide.set(null);
          this.animationClass.set('');
        }, 500);
      } else {
        // No animation needed if index doesn't change, or slide not found
        this.commitChange(newPresentation);
        if (newCurrentIndex !== -1) {
            this.currentSlideIndex.set(newCurrentIndex);
        }
      }
    }
    
    this.draggedSlideIndex.set(null);
    this.dropTargetIndex.set(null);
  }

  handleDragEnd(): void {
    this.draggedSlideIndex.set(null);
    this.dropTargetIndex.set(null);
  }

  // --- AI Features ---
  async generateNotesForCurrentSlide() {
    const slide = this.currentSlide();
    const pres = this.presentation();
    if (!slide || !pres) return;
    const notes = await this.geminiService.generateSpeakerNotes(slide.title, slide.content, pres.language);
    if (notes) {
      const newSlide = { ...slide, speakerNotes: notes };
      const newSlides = [...pres.slides];
      newSlides[this.currentSlideIndex()] = newSlide;
      this.commitChange({ ...pres, slides: newSlides });
    }
  }

  improveTitle() {
    const slide = this.currentSlide();
    if (!slide) return;
    this.openContentImprover({ field: 'title' });
  }

  improveAllBulletPoints() {
    const slide = this.currentSlide();
    if (!slide || !slide.content || (Array.isArray(slide.content) && slide.content.length === 0)) return;
    this.bulkImprovementTarget.set('bulletPoints');
    this.isBulkImproverOpen.set(true);
  }

  improveAllSpeakerNotes() {
    const slide = this.currentSlide();
    if (!slide || !slide.speakerNotes || (Array.isArray(slide.speakerNotes) && slide.speakerNotes.length === 0)) return;
    this.bulkImprovementTarget.set('speakerNotes');
    this.isBulkImproverOpen.set(true);
  }

  openContentImprover(info: { field: 'title' | 'content' | 'speakerNotes', index?: number }) {
    const slide = this.currentSlide();
    if (!slide) return;
    let text = '';
    if (info.field === 'title') text = slide.title;
    else if (info.field === 'content' && info.index !== undefined && Array.isArray(slide.content)) text = slide.content[info.index];
    else if (info.field === 'speakerNotes' && info.index !== undefined && Array.isArray(slide.speakerNotes)) text = (slide.speakerNotes || [])[info.index];
    
    if (text) {
      this.contentToImproveInfo.set({ ...info, text });
      this.isContentImproverOpen.set(true);
    }
  }

  async runImproveContent(mode: 'improve' | 'shorten' | 'lengthen') {
    const info = this.contentToImproveInfo();
    const slide = this.currentSlide();
    const pres = this.presentation();
    if (!info || !slide || !pres) return;

    const improvedText = await this.geminiService.improveContent(info.text, mode, pres.language);
    if (improvedText) {
      const newSlide = { ...slide };
      if (info.field === 'title') {
        newSlide.title = improvedText;
      } else if (info.field === 'content' && info.index !== undefined && Array.isArray(newSlide.content)) {
        const newContent = [...newSlide.content];
        newContent[info.index] = improvedText;
        newSlide.content = newContent;
      } else if (info.field === 'speakerNotes' && info.index !== undefined) {
        const newNotes = Array.isArray(newSlide.speakerNotes) ? [...newSlide.speakerNotes] : [newSlide.speakerNotes || ''];
        newNotes[info.index] = improvedText;
        newSlide.speakerNotes = newNotes;
      }
      const newSlides = [...pres.slides];
      newSlides[this.currentSlideIndex()] = newSlide;
      this.commitChange({ ...pres, slides: newSlides });
    }
    this.isContentImproverOpen.set(false);
    this.contentToImproveInfo.set(null);
  }

  async runBulkImprovement(mode: 'improve' | 'shorten' | 'lengthen') {
    const target = this.bulkImprovementTarget();
    const slide = this.currentSlide();
    const pres = this.presentation();
    if (!target || !slide || !pres) return;

    let newSlide = { ...slide };
    if (target === 'bulletPoints' && Array.isArray(slide.content) && slide.content?.length) {
      const improvedContent = await this.geminiService.improveBulletPoints(slide.title, slide.content, mode, pres.language);
      if (improvedContent) newSlide = { ...newSlide, content: improvedContent };
    } else if (target === 'speakerNotes' && Array.isArray(slide.speakerNotes) && slide.speakerNotes?.length) {
      const improvedNotes = await this.geminiService.improveSpeakerNotes(slide.title, slide.speakerNotes, mode, pres.language);
      if (improvedNotes) newSlide = { ...newSlide, speakerNotes: improvedNotes };
    }
    
    const newSlides = [...pres.slides];
    newSlides[this.currentSlideIndex()] = newSlide;
    this.commitChange({ ...pres, slides: newSlides });
    
    this.isBulkImproverOpen.set(false);
    this.bulkImprovementTarget.set(null);
  }

  async smartReorder() {
    const pres = this.presentation();
    if (!pres) return;
    const reorderedSlides = await this.geminiService.reorderSlides(pres);
    if (reorderedSlides) {
      const currentIndex = this.currentSlideIndex();
      const outgoingSlide = pres.slides[currentIndex];
      const newPresentation = { ...pres, slides: reorderedSlides };
      const newIndex = 0;

      // After reorder, we animate from the previously selected slide to the new first slide.
      if (newIndex !== currentIndex) {
        this.transitioningSlide.set({ slide: outgoingSlide, animation: 'animate-fade-out' });
        this.animationClass.set('animate-fade-in');

        this.commitChange(newPresentation);
        this.currentSlideIndex.set(newIndex);
        
        setTimeout(() => {
          this.transitioningSlide.set(null);
          this.animationClass.set('');
        }, 500);
      } else { // current index was already 0
        this.commitChange(newPresentation);
        this.currentSlideIndex.set(newIndex);
      }
    }
  }

  async runAddSlideAi() {
    const pres = this.presentation();
    if (!pres || !this.newSlideTopic()) return;
    const newSlide = await this.geminiService.generateSingleSlide(this.newSlideTopic(), pres);
    if (newSlide) {
      const newSlides = [...pres.slides, newSlide];
      this.commitChange({ ...pres, slides: newSlides });
      this.navigateToSlide(newSlides.length - 1);
    }
    this.isAddSlideAiOpen.set(false);
    this.newSlideTopic.set('');
  }

  handleAgentUpdate(newPresentation: Presentation) {
    const oldPresentation = this.presentation();
    if (!oldPresentation) {
      this.commitChange(newPresentation);
      return;
    }

    // Handle slide deletion logic
    if (newPresentation.slides.length < oldPresentation.slides.length) {
      const oldIndex = this.currentSlideIndex();
      // If the currently selected slide was deleted, adjust the index.
      if (oldIndex >= newPresentation.slides.length) {
        this.currentSlideIndex.set(Math.max(0, newPresentation.slides.length - 1));
      }
    }

    this.commitChange(newPresentation);
  }

  // --- NEW AI FEATURE HANDLERS ---
  async handleImproveImagePrompt(): Promise<void> {
    const pres = this.presentation();
    const slideIndex = this.currentSlideIndex();
    const slide = pres?.slides[slideIndex];
    if (!slide || !slide.imagePrompt || !pres) return;

    const improvedPrompt = await this.geminiService.improveImagePrompt(slide.title, slide.content, slide.imagePrompt);

    if (improvedPrompt) {
        const currentPres = this.presentation();
        if (!currentPres) return;
        const finalSlides = [...currentPres.slides];
        const oldSlide = finalSlides[slideIndex];
        const updatedSlide: Slide = { ...oldSlide, imagePrompt: improvedPrompt };
        finalSlides[slideIndex] = updatedSlide;
        this.commitChange({ ...currentPres, slides: finalSlides });
    }
  }

  openImageEditModal(): void {
    const slide = this.currentSlide();
    if (!slide) return;
    this.imageToEditInfo.set({
      slideIndex: this.currentSlideIndex(),
      currentPrompt: slide.imagePrompt,
      style: 'Photorealistic', // Default or fetch from slide state if available
      aspectRatio: '16:9'
    });
    this.isImageEditModalOpen.set(true);
  }

  async handleImageEdit(): Promise<void> {
    const info = this.imageToEditInfo();
    const instruction = this.imageEditInstruction();
    if (!info || !instruction) return;

    const newPrompt = await this.geminiService.getEditedImagePrompt(info.currentPrompt, instruction);
    if (newPrompt) {
        const imageUrl = await this.geminiService.generateImageFromPrompt(newPrompt, info.style, info.aspectRatio);
        if (imageUrl) {
            const pres = this.presentation();
            if (!pres) return;
            const newSlides = [...pres.slides];
            const oldSlide = newSlides[info.slideIndex];
            newSlides[info.slideIndex] = { ...oldSlide, imageUrl, imagePrompt: newPrompt };
            this.commitChange({ ...pres, slides: newSlides });
        }
    }
    // Close modal and reset state
    this.isImageEditModalOpen.set(false);
    this.imageEditInstruction.set('');
    this.imageToEditInfo.set(null);
  }

  async handleGenerateContentFromImage(): Promise<void> {
    const slide = this.currentSlide();
    const pres = this.presentation();
    if (!slide || !pres || !slide.imageUrl) return;

    const generatedContent = await this.geminiService.generateSlideContentFromImage(slide.imageUrl);
    if (generatedContent) {
      const newSlide = { ...slide, title: generatedContent.title, content: generatedContent.content };
      const newSlides = [...pres.slides];
      newSlides[this.currentSlideIndex()] = newSlide;
      this.commitChange({ ...pres, slides: newSlides });
    }
  }

  async handleRegenerateSlide(): Promise<void> {
    const slide = this.currentSlide();
    const pres = this.presentation();
    if (!slide || !pres) return;
    
    const newSlideData = await this.geminiService.regenerateSlide(slide, pres);
    if (newSlideData) {
        const newSlides = [...pres.slides];
        newSlides[this.currentSlideIndex()] = { ...newSlideData, rating: null }; // Reset rating on regenerated slide
        this.commitChange({ ...pres, slides: newSlides });
    }
  }

  async handleSmartLayout(): Promise<void> {
      const slide = this.currentSlide();
      const pres = this.presentation();
      if (!slide || !pres) return;

      const newLayout = await this.geminiService.suggestLayout(slide);
      if (newLayout && newLayout !== slide.layout) {
          this.changeLayout(newLayout);
      } else if (newLayout) {
          alert('AI confirms the current layout is already the most suitable for this content.');
      }
  }

  // --- UI and Other ---
  updateSpeakerNote(event: Event, index: number): void {
    const slide = this.currentSlide();
    if (!slide) return;

    const target = event.target as HTMLElement;
    const notes = this.normalizedSpeakerNotes();
    const newNotes = [...notes];
    newNotes[index] = target.innerText;

    const newSlide = { ...slide, speakerNotes: newNotes };
    const pres = this.presentation();
    if (!pres) return;
    const newSlides = [...pres.slides];
    newSlides[this.currentSlideIndex()] = newSlide;
    this.commitChange({ ...pres, slides: newSlides }, true);
  }

  updateTheme(prop: keyof Theme, value: string) {
    const pres = this.presentation();
    if (pres) {
      this.commitChange({ ...pres, theme: { ...pres.theme, [prop]: value }});
    }
  }

  async generateThemeWithAi() {
    // Guard against empty prompts
    const prompt = this.aiThemePrompt();
    if (!prompt) return;

    // Guard against no active presentation
    const pres = this.presentation();
    if (!pres) return;

    // Generate the new theme object using the Gemini service
    const newTheme = await this.geminiService.generateTheme(prompt);
    if (!newTheme) {
      // The service handles showing an error toast, so we can just exit.
      return;
    }

    // Update the presentation's current theme with the newly generated one
    this.commitChange({ ...pres, theme: newTheme });

    // Emit the new theme so it can be added to the global list of theme presets
    this.themeGenerated.emit(newTheme);

    // Clear the input field for the next request
    this.aiThemePrompt.set('');
  }
  
  // --- AI Evolution & Slide Rating ---

  rateSlide(index: number, rating: 'good'): void {
    const pres = this.presentation();
    if (!pres) return;

    const newSlides = [...pres.slides];
    const slide = { ...newSlides[index] };

    // Toggle rating: if same rating is clicked again, set to null
    if (slide.rating?.type === rating) {
      slide.rating = null;
    } else {
      slide.rating = { type: 'good' };
    }

    newSlides[index] = slide;
    const newPresentation = { ...pres, slides: newSlides };
    this.commitChange(newPresentation); // Use commit to allow undoing ratings
    // If a 'bad' rating popover was open, clicking 'good' should close it.
    if (this.badRatingInfo() !== null) {
        this.badRatingInfo.set(null);
    }
  }

  openBadRatingPopover(slideIndex: number): void {
    const pres = this.presentation();
    if (!pres) return;

    // If popover for this slide is already open, close it.
    if (this.badRatingInfo()?.slideIndex === slideIndex) {
        this.badRatingInfo.set(null);
        return;
    }
    
    // Close any other popover and open the new one
    const slide = pres.slides[slideIndex];
    const currentReasons = (slide.rating?.type === 'bad' && Array.isArray(slide.rating.reasons)) 
        ? slide.rating.reasons 
        : [];
        
    const reasonsObject: Record<string, boolean> = {};
    this.ratingReasons.forEach(r => {
        reasonsObject[r] = currentReasons.includes(r);
    });
    
    this.badRatingInfo.set({ slideIndex, reasons: reasonsObject });
  }

  handleBadRatingSubmit(): void {
      const info = this.badRatingInfo();
      const pres = this.presentation();
      if (!info || !pres) return;

      const selectedReasons = Object.keys(info.reasons).filter(reason => info.reasons[reason]);

      const newSlides = [...pres.slides];
      const slide = { ...newSlides[info.slideIndex] };

      // If no reasons are selected after submitting, treat it as un-rating.
      if (selectedReasons.length === 0) {
          // Only un-rate if it was previously 'bad'. No change if it was 'good' or null.
          if (slide.rating?.type === 'bad') {
            slide.rating = null;
          }
      } else {
          slide.rating = { type: 'bad', reasons: selectedReasons };
      }

      newSlides[info.slideIndex] = slide;
      this.commitChange({ ...pres, slides: newSlides });
      this.badRatingInfo.set(null);
  }

  async openAiEvolutionModal(): Promise<void> {
    const [prompt, history, activeId] = await Promise.all([
      this.aiEvolutionService.getCorePrompt(),
      this.aiEvolutionService.getPromptHistory(),
      this.aiEvolutionService.getActivePromptId(),
    ]);
    this.aiCorePrompt.set(prompt);
    this.promptHistory.set(history.slice().reverse()); // show newest first
    this.activePromptId.set(activeId);
    this.selectedPromptFromHistory.set(null);
    this.newlyEvolvedPrompt.set(null);
    this.generateFeedbackSummary();
    this.isAiEvolutionModalOpen.set(true);
  }

  private generateFeedbackSummary(): void {
    const pres = this.presentation();
    if (!pres) {
      this.evolutionFeedbackSummary.set('');
      return;
    }
    
    const goodSlides = pres.slides.filter(s => s.rating?.type === 'good');
    const badSlides = pres.slides.filter(s => s.rating?.type === 'bad');

    if (goodSlides.length === 0 && badSlides.length === 0) {
      this.evolutionFeedbackSummary.set('No feedback provided yet. Please rate some slides (👍/👎) to enable evolution.');
      return;
    }

    let summary = `User provided feedback on a presentation about "${pres.originalTopic}".\n`;
    summary += `Total slides rated: ${goodSlides.length + badSlides.length}/${pres.slides.length}.\n`;
    summary += `Liked: ${goodSlides.length}. Disliked: ${badSlides.length}.\n\n`;
    
    if (badSlides.length > 0) {
      summary += "The user DISLIKED the following slides, with these reasons:\n";
      badSlides.forEach(s => {
        const reasons = (s.rating?.type === 'bad' && s.rating.reasons.length > 0) ? s.rating.reasons.join(', ') : 'No specific reason given';
        summary += `- Slide titled "${s.title}" (Layout: ${s.layout}): ${reasons}\n`;
      });
      summary += "\n";
    }

    if (goodSlides.length > 0) {
       summary += "The user LIKED the following slides:\n";
        goodSlides.forEach(s => {
          summary += `- Slide titled "${s.title}" (Layout: ${s.layout}).\n`;
        });
    }

    this.evolutionFeedbackSummary.set(summary.trim());
  }

  async triggerAiEvolution(): Promise<void> {
    const currentPrompt = this.aiCorePrompt();
    const feedback = this.evolutionFeedbackSummary();
    if (!feedback || feedback.startsWith('No feedback')) return;

    this.isEvolving.set(true);
    const newPrompt = await this.geminiService.evolveCorePrompt(currentPrompt, feedback);
    if (newPrompt) {
      this.newlyEvolvedPrompt.set(newPrompt);
    } else {
      alert('The AI failed to evolve its prompt. Please try again.');
    }
    this.isEvolving.set(false);
  }

  async acceptEvolvedPrompt(): Promise<void> {
    const newPrompt = this.newlyEvolvedPrompt();
    const feedback = this.evolutionFeedbackSummary();
    if (!newPrompt) return;
    
    const newItem = await this.aiEvolutionService.saveCorePrompt(newPrompt, feedback);
    this.aiCorePrompt.set(newPrompt);
    this.activePromptId.set(newItem.id);
    this.newlyEvolvedPrompt.set(null);
    this.selectedPromptFromHistory.set(null);
    const history = await this.aiEvolutionService.getPromptHistory();
    this.promptHistory.set(history.slice().reverse());
    alert('AI Core Prompt has been evolved! A new version has been saved and is now active.');
  }

  async makePromptActive(promptId: string | null): Promise<void> {
    if (!promptId) return;
    await this.aiEvolutionService.setActivePrompt(promptId);
    this.activePromptId.set(promptId);
    const newActivePrompt = await this.aiEvolutionService.getCorePrompt();
    this.aiCorePrompt.set(newActivePrompt);
    this.selectedPromptFromHistory.set(null); // Deselect any viewed prompt
    alert('Selected prompt version is now active.');
  }

  async resetAiPrompt(): Promise<void> {
    if (confirm('Are you sure you want to reset the AI instructions to their original default? This will clear all evolution history.')) {
      await this.aiEvolutionService.resetToDefault();
      const [prompt, history, activeId] = await Promise.all([
        this.aiEvolutionService.getCorePrompt(),
        this.aiEvolutionService.getPromptHistory(),
        this.aiEvolutionService.getActivePromptId()
      ]);
      this.aiCorePrompt.set(prompt);
      this.promptHistory.set(history.slice().reverse());
      this.activePromptId.set(activeId);
      this.selectedPromptFromHistory.set(null);
      this.newlyEvolvedPrompt.set(null);
      alert('AI Core Prompt has been reset to default.');
    }
  }

  // --- Exporting ---
  private waitForRender(): Promise<void> {
    return new Promise(resolve => {
        requestAnimationFrame(() => {
            // A second frame is often needed to ensure layout and paint are complete
            requestAnimationFrame(() => resolve());
        });
    });
  }

  async downloadAsPptx(): Promise<void> {
    const pres = this.presentation();
    if (!pres) return;
    this.downloadState.set('pptx');
    this.isDownloadMenuOpen.set(false);

    const pptx = new PptxGenJS();
    pptx.layout = 'LAYOUT_16X9';
    pptx.author = 'AI Presentation Generator';
    pptx.title = pres.title;
    
    // Convert hex to RRGGBB for PptxGenJS
    const cleanHex = (hex: string) => hex.replace('#', '');

    // Add a master slide for the theme background
    pptx.defineSlideMaster({
      title: 'MASTER_SLIDE',
      background: { color: cleanHex(pres.theme.backgroundColor) },
    });

    for (const slide of pres.slides) {
      const pptxSlide = pptx.addSlide({ masterName: 'MASTER_SLIDE' });
      
      // Title
      pptxSlide.addText(slide.title, {
        x: 0.5, y: 0.25, w: '90%', h: 0.75,
        fontFace: pres.theme.titleFont,
        fontSize: 32,
        color: cleanHex(pres.theme.primaryColor),
        bold: true,
        align: 'center'
      });

      // Content
      if (Array.isArray(slide.content)) {
          pptxSlide.addText(slide.content.join('\n'), {
            x: 0.5, y: 1.2, w: '90%', h: 3.8,
            fontFace: pres.theme.bodyFont,
            fontSize: 18,
            color: cleanHex(pres.theme.textColor),
            bullet: true,
          });
      } else if (typeof slide.content === 'string') {
          pptxSlide.addText(slide.content, {
            x: 0.5, y: 1.2, w: '90%', h: 3.8,
            fontFace: pres.theme.bodyFont,
            fontSize: 18,
            color: cleanHex(pres.theme.textColor),
          });
      }

      // Speaker Notes
      if (slide.speakerNotes) {
        const notes = Array.isArray(slide.speakerNotes) ? slide.speakerNotes.join('\n') : slide.speakerNotes;
        pptxSlide.addNotes(notes);
      }
    }

    await pptx.writeFile({ fileName: `${pres.title}.pptx` });
    this.downloadState.set('idle');
  }

  async downloadAsPdf(): Promise<void> {
    const pres = this.presentation();
    if (!pres) return;
    this.downloadState.set('pdf');
    this.isDownloadMenuOpen.set(false);

    // Temporarily set view to a single slide for rendering
    const originalIndex = this.currentSlideIndex();
    const pdf = new jspdf.jsPDF({
      orientation: 'landscape',
      unit: 'px',
      format: [1920, 1080]
    });

    for (let i = 0; i < pres.slides.length; i++) {
        this.currentSlideIndex.set(i);
        await this.waitForRender(); // Wait for slide to render in the DOM
        const slideElement = document.querySelector('.w-full.max-w-7xl.aspect-\\[16\\/9\\]');
        if (slideElement) {
            const canvas = await html2canvas(slideElement as HTMLElement, { scale: 2 });
            if (i > 0) {
                pdf.addPage([1920, 1080], 'landscape');
            }
            pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, 1920, 1080);
        }
    }
    
    pdf.save(`${pres.title}.pdf`);
    this.currentSlideIndex.set(originalIndex); // Restore original slide index
    this.downloadState.set('idle');
  }
  
  async downloadAsPngZip(): Promise<void> {
    const pres = this.presentation();
    if (!pres) return;
    this.downloadState.set('png');
    this.isDownloadMenuOpen.set(false);
    const originalIndex = this.currentSlideIndex();
    const zip = new JSZip();

    for (let i = 0; i < pres.slides.length; i++) {
        this.currentSlideIndex.set(i);
        await this.waitForRender();
        const slideElement = document.querySelector('.w-full.max-w-7xl.aspect-\\[16\\/9\\]');
        if (slideElement) {
            const canvas = await html2canvas(slideElement as HTMLElement, { scale: 2 });
            const imgData = canvas.toDataURL('image/png').split('base64,')[1];
            zip.file(`slide_${String(i + 1).padStart(2, '0')}.png`, imgData, { base64: true });
        }
    }

    const content = await zip.generateAsync({ type: 'blob' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(content);
    link.download = `${pres.title}_slides.zip`;
    link.click();
    URL.revokeObjectURL(link.href);

    this.currentSlideIndex.set(originalIndex);
    this.downloadState.set('idle');
  }

  downloadAsTxt(): void {
    const pres = this.presentation();
    if (!pres) return;
    this.downloadState.set('txt');
    this.isDownloadMenuOpen.set(false);

    let textContent = `Presentation: ${pres.title}\n\n`;
    pres.slides.forEach((slide, index) => {
        textContent += `--- Slide ${index + 1}: ${slide.title} ---\n\n`;
        if (Array.isArray(slide.content)) {
            textContent += slide.content.map(p => `- ${p}`).join('\n');
        } else {
            textContent += slide.content;
        }
        textContent += '\n\n';
        if (slide.speakerNotes && slide.speakerNotes.length > 0) {
            textContent += 'Speaker Notes:\n';
            if (Array.isArray(slide.speakerNotes)) {
                textContent += slide.speakerNotes.map(n => `- ${n}`).join('\n');
            } else {
                textContent += slide.speakerNotes;
            }
            textContent += '\n\n';
        }
    });

    const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${pres.title}_notes.txt`;
    link.click();
    URL.revokeObjectURL(link.href);
    
    this.downloadState.set('idle');
  }

  private diff(oldText: string, newText: string): { line: string, type: 'added' | 'removed' }[] {
    const oldLines = oldText.split('\n');
    const newLines = newText.split('\n');
    const oldSet = new Set(oldLines);
    const newSet = new Set(newLines);

    const diffResult: { line: string, type: 'added' | 'removed' }[] = [];

    oldLines.forEach(line => {
        if (!newSet.has(line)) {
            diffResult.push({ line, type: 'removed' });
        }
    });

    newLines.forEach(line => {
        if (!oldSet.has(line)) {
            diffResult.push({ line, type: 'added' });
        }
    });

    return diffResult;
  }
}