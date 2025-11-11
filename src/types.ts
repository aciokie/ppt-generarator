





export type SlideLayout = 
  // Original Layouts
  'title' | 'content_left' | 'content_right' | 'section_header' | 'conclusion' | 'two_column' | 
  'three_column' | 'quote' | 'image_full_bleed' | 'table' | 'chart_bar' | 'chart_line' | 
  'chart_pie' | 'chart_doughnut' | 'timeline' | 'process' | 'stats_highlight' | 'pyramid' | 
  'funnel' | 'swot' | 'comparison' | 'team_members_four' | 'radial_diagram' | 'step_flow' | 
  'image_overlap_left' | 'hub_and_spoke' | 'cycle_diagram' | 'venn_diagram' | 'alternating_feature_list' |

  // New Layouts (30)
  'quadrant_chart' | 'bridge_chart' | 'gantt_chart_simple' | 'org_chart' | 'mind_map' | 
  'fishbone_diagram' | 'area_chart' | 'scatter_plot' | 'bubble_chart' | 'image_grid_four' |
  'image_with_caption_below' | 'text_over_image' | 'quote_with_image' | 'feature_highlight_image' |
  'image_collage' | 'image_focus_left' | 'image_focus_right' | 'checklist' | 'numbered_list_large' |
  'step_flow_vertical' | 'circular_flow' | 'staggered_list' | 'feature_list_icons' | 'pros_and_cons' |
  'kpi_dashboard_three' | 'kpi_dashboard_four' | 'target_vs_actual' | 'faq' | 'call_to_action' |
  'world_map_pins';


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