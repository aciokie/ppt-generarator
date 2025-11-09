



export type SlideLayout = 'title' | 'content_left' | 'content_right' | 'section_header' | 'conclusion' | 'two_column' | 'three_column' | 'quote' | 'image_full_bleed' | 'table' | 'chart_bar' | 'chart_line' | 'chart_pie' | 'chart_doughnut' | 'timeline' | 'process' | 'stats_highlight' | 'pyramid' | 'funnel' | 'swot';

export interface ChartData {
  labels: string[];
  datasets: {
    label: string;
    data: number[];
  }[];
}

export interface Slide {
  title: string;
  // Content can be a single string or an array of bullet points
  content: string[] | string;
  imagePrompt: string;
  imageUrl?: string;
  layout: SlideLayout;
  // Speaker notes can be a single string or an array of notes
  speakerNotes?: string[] | string;
  isGeneratingImage?: boolean;
  isSourceSlide?: boolean;
  tableData?: string[][];
  chartData?: ChartData;
  rating?: { type: 'good' } | { type: 'bad', reasons: string[] } | null;
}

export interface Theme {
  name: string;
  category: string;
  primaryColor: string;
  backgroundColor: string;
  textColor: string;
  titleFont: string;
  bodyFont: string;
  logoUrl?: string;
}

export interface Source {
  uri: string;
  title: string;
}

export interface Presentation {
  id: string;
  title: string;
  slides: Slide[];
  theme: Theme;
  originalTopic: string;
  language: 'English' | 'Tagalog';
  generationProgress?: {
    lastCompletedSlide: number;
    totalSlides: number;
  };
  sources?: Source[];
}

export interface HistoryItem extends Omit<Presentation, 'slides' | 'generationProgress'> {
  slideCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface PromptHistoryItem {
  id: string;
  prompt: string;
  createdAt: string;
  feedbackSummary: string;
}