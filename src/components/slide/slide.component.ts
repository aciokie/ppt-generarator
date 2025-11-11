import { Component, ChangeDetectionStrategy, input, output, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Slide, Theme, SlideLayout } from '../../types';

@Component({
  selector: 'app-slide',
  imports: [CommonModule, FormsModule],
  templateUrl: './slide.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SlideComponent {
  slide = input.required<Slide>();
  theme = input.required<Theme>();
  isPreview = input(false);

  slideChange = output<Slide>();
  generateImage = output<{ style: string, aspectRatio: string }>();
  editImage = output<void>();
  removeImage = output<void>();
  generateContentFromImage = output<void>();
  improveImagePrompt = output<void>();
  improveContent = output<{field: 'title' | 'content' | 'speakerNotes' | 'column_title' | 'column_text' | 'item1' | 'item2', index?: number}>();

  protected readonly normalizedLayout = computed(() => {
    const layout = this.slide().layout;
    // Handle common AI model inconsistencies in layout naming
    switch (layout) {
      case 'imagefocusright' as any: return 'image_focus_right';
      case 'imagefocusleft' as any: return 'image_focus_left';
      case 'imageoverlapleft' as any: return 'image_overlap_left';
      default: return layout;
    }
  });

  imageStyle = signal('Photorealistic');
  readonly imageStyles = [
    'Photorealistic', 
    'Cinematic Photo',
    'Vector Illustration', 
    'Minimalist Line Art',
    'Abstract 3D Render',
    'Watercolor Painting',
    'Vintage Polaroid'
  ];
  aspectRatio = signal('16:9');
  readonly aspectRatios = ['16:9', '4:3', '1:1', '3:4', '9:16'];

  isPromptCopied = signal(false);

  protected readonly normalizedContent = computed(() => {
    const content = this.slide().content;
    if (Array.isArray(content)) {
      return content;
    }
    // Handle case where content might be a single string from older data or faulty generation
    if (typeof content === 'string') {
      return content.split('\n').filter(line => line.trim() !== '');
    }
    return [];
  });

  protected readonly contentMidpoint = computed(() => {
    const c = this.normalizedContent();
    if (!c) {
      return 0;
    }
    return Math.ceil(c.length / 2);
  });

  protected readonly threeColumnContent = computed(() => {
    if (this.slide().layout !== 'three_column') return [];
    const content = this.normalizedContent();
    const columns: { title: string, text: string }[] = [];
    for (let i = 0; i < content.length; i += 2) {
      if (content[i] !== undefined && content[i + 1] !== undefined) {
        columns.push({ title: content[i], text: content[i + 1] });
      }
    }
    return columns;
  });

  protected readonly pairedListContent = computed(() => {
    const layout = this.slide().layout;
    const pairedLayouts: SlideLayout[] = ['timeline', 'process', 'stats_highlight', 'alternating_feature_list', 'faq', 'kpi_dashboard_three', 'kpi_dashboard_four'];
    if (!pairedLayouts.includes(layout)) {
      return [];
    }
    const content = this.normalizedContent();
    const pairs: { item1: string, item2: string }[] = [];
    for (let i = 0; i < content.length; i += 2) {
      if (content[i] !== undefined) { // Allow for the second item to be missing initially
        pairs.push({ item1: content[i], item2: content[i + 1] || '' });
      }
    }
    return pairs;
  });

  protected readonly featureListIconsContent = computed(() => {
    if (this.slide().layout !== 'feature_list_icons') return [];
    const content = this.normalizedContent();
    const items: { icon: string, text: string }[] = [];
    // The prompt says pairs of (icon, text).
    for (let i = 0; i < content.length; i += 2) {
      if (content[i] !== undefined) {
        items.push({ icon: content[i], text: content[i + 1] || '' });
      }
    }
    return items;
  });

  protected readonly prosAndConsContent = computed(() => {
    if (this.slide().layout !== 'pros_and_cons') return null;
    const content = this.normalizedContent();
    const separatorIndex = content.indexOf('---');

    if (separatorIndex === -1) {
      // Fallback if separator is missing, splitting the content in half
      const midpoint = Math.ceil(content.length / 2);
      return {
        pros: content.slice(0, midpoint),
        cons: content.slice(midpoint)
      };
    }
    return {
      pros: content.slice(0, separatorIndex),
      cons: content.slice(separatorIndex + 1)
    };
  });
  
  private readonly chartTopValue = computed(() => {
    const chartData = this.slide().chartData;
    if (!chartData || !chartData.datasets || chartData.datasets.length === 0) return 100;
    
    const allData = chartData.datasets.flatMap(ds => ds.data);
    if (allData.length === 0) return 100;

    const maxVal = Math.max(...allData, 0);
    if (maxVal === 0) return 100;

    const numLines = 5;
    const step = Math.ceil(maxVal / numLines / 10) * 10; // Round up to nearest 10 for cleaner steps
    return step * numLines;
  });

  protected readonly yAxisLabels = computed(() => {
    const topValue = this.chartTopValue();
    const numLines = 5;
    const labels = [];

    for (let i = 0; i <= numLines; i++) {
      const value = (topValue / numLines) * i;
      labels.push({ value, position: (value / topValue) * 100 });
    }
    return labels.reverse(); // Start from top for positioning
  });


  protected readonly barColors = computed(() => {
    // Generate a consistent set of colors for chart bars
    const baseColors = ['#8b5cf6', '#3b82f6', '#10b981', '#f97316', '#ef4444', '#14b8a6', '#f59e0b', '#16a34a'];
    const themeColor = this.theme().primaryColor;
    return [themeColor, ...baseColors.filter(c => c !== themeColor)];
  });

  protected readonly pieChartGradient = computed(() => {
    const chartData = this.slide().chartData;
    if (!chartData || !chartData.datasets || chartData.datasets.length === 0 || chartData.datasets[0].data.length === 0) {
      return 'background: #4a5568';
    }
    const data = chartData.datasets[0].data;
    const total = data.reduce((sum, val) => sum + val, 0);
    if (total === 0) return 'background: #4a5568';

    const colors = this.barColors();
    let cumulativePercent = 0;
    const gradientParts = data.map((value, index) => {
      const percent = (value / total) * 100;
      const startPercent = cumulativePercent;
      const endPercent = cumulativePercent + percent;
      cumulativePercent = endPercent;
      return `${colors[index % colors.length]} ${startPercent}% ${endPercent}%`;
    });

    return `background: conic-gradient(${gradientParts.join(', ')})`;
  });

  protected readonly lineChartPoints = computed(() => {
    const chartData = this.slide().chartData;
    const width = 800;
    const height = 400;
    const padding = 50;

    if (!chartData || !chartData.datasets || chartData.datasets.length === 0 || !chartData.labels || chartData.labels.length === 0) {
      return { lines: [], labels: { x: [], y: [] }, grid: [] };
    }

    const allData = chartData.datasets.flatMap(ds => ds.data);
    const maxVal = Math.max(...allData, 0);
    const minVal = 0; // Assuming line charts start from 0
    const valRange = maxVal - minVal;

    const xStep = chartData.labels.length > 1 ? (width - padding * 2) / (chartData.labels.length - 1) : 0;

    const lines = chartData.datasets.map((dataset, i) => {
        const points = dataset.data.map((val, index) => {
            const x = padding + index * xStep;
            const y = (valRange === 0)
              ? (height - padding * 2) / 2 + padding // Center vertically if no range
              : height - padding - ((val - minVal) / valRange) * (height - padding * 2);
            return `${x},${y}`;
        }).join(' ');
        return { points, color: this.barColors()[i] };
    });

    const labels = {
        x: chartData.labels.map((label, index) => ({
            text: label,
            x: padding + index * xStep,
            y: height - padding + 20
        })),
        y: Array.from({ length: 5 }).map((_, i) => {
            const val = minVal + (valRange / 4) * i;
            const yPos = valRange === 0 
                ? (height - padding * 2) / 2 + padding
                : height - padding - ((val - minVal) / valRange) * (height - padding * 2);

            return {
                text: val.toFixed(0),
                x: padding - 10,
                y: yPos
            }
        })
    };
    
    const grid = labels.y.map(label => `M${padding},${label.y} H${width - padding}`);

    return { lines, labels, grid };
  });

  protected readonly statsGridColsClass = computed(() => {
    const count = this.pairedListContent().length;
    switch(count) {
      case 1: return 'grid-cols-1';
      case 2: return 'grid-cols-2';
      case 3: return 'grid-cols-3';
      case 4: return 'grid-cols-4';
      default: return 'grid-cols-1'; // Fallback for 0 or >4 items
    }
  });

  protected readonly pyramidContent = computed(() => {
    if (this.slide().layout !== 'pyramid') return [];
    return this.normalizedContent();
  });

  protected readonly funnelContent = computed(() => {
    if (this.slide().layout !== 'funnel') return [];
    return this.normalizedContent();
  });

  protected readonly swotContent = computed(() => {
    if (this.slide().layout !== 'swot') return null;
    const content = this.normalizedContent();
    // Expects [S_Title, S_Text, W_Title, W_Text, O_Title, O_Text, T_Title, T_Text]
    // Or just the text if the titles are standard
    const swotData = {
      strengths: { title: content[0] || 'Strengths', text: content[1] || '' },
      weaknesses: { title: content[2] || 'Weaknesses', text: content[3] || '' },
      opportunities: { title: content[4] || 'Opportunities', text: content[5] || '' },
      threats: { title: content[6] || 'Threats', text: content[7] || '' },
    };
    return swotData;
  });

  protected readonly comparisonContent = computed(() => {
    if (this.slide().layout !== 'comparison') return null;
    const content = this.normalizedContent();
    const separatorIndex = content.indexOf('---');

    if (separatorIndex === -1) {
      // Fallback if separator is missing, splitting the content in half
      const midpoint = Math.ceil(content.length / 2);
      const titleA = content.length > 0 ? 'Item A' : '';
      const titleB = content.length > 1 ? 'Item B' : '';
      return {
        itemA: { title: titleA, points: content.slice(0, midpoint) },
        itemB: { title: titleB, points: content.slice(midpoint) }
      };
    }

    return {
      itemA: { title: content[0] || '', points: content.slice(1, separatorIndex) },
      itemB: { title: content[separatorIndex + 1] || '', points: content.slice(separatorIndex + 2) }
    };
  });

  protected readonly teamMembersContent = computed(() => {
    if (this.slide().layout !== 'team_members_four') return [];
    const content = this.normalizedContent();
    const members: { name: string, title: string }[] = [];
    for (let i = 0; i < content.length; i += 2) {
      if (content[i] !== undefined) {
        members.push({ name: content[i], title: content[i + 1] || '' });
      }
    }
    return members.slice(0, 4); // Max 4 members for this layout
  });

  protected readonly radialDiagramContent = computed(() => {
    if (this.slide().layout !== 'radial_diagram') return null;
    const content = this.normalizedContent();
    if (content.length === 0) return { center: 'Center', satellites: [] };
    return {
      center: content[0],
      satellites: content.slice(1, 7) // max 6 satellites
    };
  });

  protected readonly stepFlowContent = computed(() => {
    if (this.slide().layout !== 'step_flow') return [];
    return this.normalizedContent().slice(0, 5); // Max 5 steps
  });

  protected readonly hubAndSpokeContent = computed(() => {
    if (this.slide().layout !== 'hub_and_spoke') return null;
    const content = this.normalizedContent();
    if (content.length === 0) return { center: '', spokes: [] };
    return {
      center: content[0],
      spokes: content.slice(1, 7), // Max 6 spokes
    };
  });

  protected readonly cycleDiagramContent = computed(() => {
    if (this.slide().layout !== 'cycle_diagram') return [];
    return this.normalizedContent().slice(0, 5); // Max 5 steps
  });

  protected readonly vennDiagramContent = computed(() => {
    if (this.slide().layout !== 'venn_diagram') return null;
    const content = this.normalizedContent();
    // Expects [TitleA, TextA, TitleB, TextB, TitleIntersect, TextIntersect]
    return {
      itemA: { title: content[0] || '', text: content[1] || '' },
      itemB: { title: content[2] || '', text: content[3] || '' },
      intersection: { title: content[4] || '', text: content[5] || '' },
    };
  });

  protected readonly alternatingFeatureListContent = computed(() => {
    if (this.slide().layout !== 'alternating_feature_list') return [];
    return this.pairedListContent();
  });


  onContentChange(field: 'title' | 'content' | 'speakerNotes' | 'column_title' | 'column_text' | 'item1' | 'item2', event: Event, index?: number): void {
    const target = event.target as HTMLElement;
    const newText = (target.textContent || '').trim();
    const newSlide = { ...this.slide() };
    const contentArray = this.normalizedContent();
    const newContent = [...contentArray];

    if (field === 'title') {
      newSlide.title = newText;
    } else if (field === 'content' && index !== undefined) {
      newContent[index] = newText;
      newSlide.content = newContent;
    } else if (field === 'speakerNotes' && index !== undefined) {
      const notes = newSlide.speakerNotes || [];
      const newSpeakerNotes = Array.isArray(notes) ? [...notes] : [notes];
      newSpeakerNotes[index] = newText;
      newSlide.speakerNotes = newSpeakerNotes;
    } else if (field === 'column_title' && index !== undefined) {
      const flatIndex = index * 2;
      newContent[flatIndex] = newText;
      newSlide.content = newContent;
    } else if (field === 'column_text' && index !== undefined) {
      const flatIndex = index * 2 + 1;
      newContent[flatIndex] = newText;
      newSlide.content = newContent;
    } else if (field === 'item1' && index !== undefined) {
      const flatIndex = index * 2;
      newContent[flatIndex] = newText;
      newSlide.content = newContent;
    } else if (field === 'item2' && index !== undefined) {
      const flatIndex = index * 2 + 1;
      newContent[flatIndex] = newText;
      newSlide.content = newContent;
    }
    this.slideChange.emit(newSlide);
  }

  onTableDataChange(event: Event, rowIndex: number, cellIndex: number): void {
    const newSlide = { ...this.slide() };
    if (!newSlide.tableData) return;
    
    const newTableData = JSON.parse(JSON.stringify(newSlide.tableData));
    const target = event.target as HTMLElement;
    newTableData[rowIndex][cellIndex] = (target.textContent || '').trim();
    newSlide.tableData = newTableData;
    this.slideChange.emit(newSlide);
  }

  onChartDataChange(field: 'label' | 'value' | 'datasetLabel', event: Event, datasetIndex: number, dataIndex?: number): void {
    const newSlide = { ...this.slide() };
    if (!newSlide.chartData) return;
    
    const newChartData = JSON.parse(JSON.stringify(newSlide.chartData));
    const target = event.target as HTMLElement;
    const newText = (target.textContent || '').trim();

    if (field === 'datasetLabel') {
      newChartData.datasets[datasetIndex].label = newText;
    } else if (field === 'label' && dataIndex !== undefined) {
      newChartData.labels[dataIndex] = newText;
    } else if (field === 'value' && dataIndex !== undefined) {
      let numericValue = parseFloat(newText.replace(/[^0-9.-]+/g, ''));
      if (isNaN(numericValue)) {
        numericValue = 0;
      }
      newChartData.datasets[datasetIndex].data[dataIndex] = numericValue;
    }

    newSlide.chartData = newChartData;
    this.slideChange.emit(newSlide);
  }

  onImagePromptChange(event: Event) {
      const target = event.target as HTMLTextAreaElement;
      const newSlide = { ...this.slide(), imagePrompt: target.value };
      this.slideChange.emit(newSlide);
  }

  triggerImageGeneration(style: string, aspectRatio: string) {
      this.generateImage.emit({ style, aspectRatio });
  }

  triggerImproveContent(field: 'title' | 'content' | 'speakerNotes' | 'column_title' | 'column_text' | 'item1' | 'item2', index?: number) {
    if (field === 'column_title' || field === 'column_text') {
        this.improveContent.emit({ field: 'content', index: (field === 'column_title' ? index! * 2 : index! * 2 + 1) });
    } else if (field === 'item1' || field === 'item2') {
        this.improveContent.emit({ field: 'content', index: (field === 'item1' ? index! * 2 : index! * 2 + 1) });
    } else {
        this.improveContent.emit({ field, index });
    }
  }

  copyImagePrompt(): void {
    const prompt = this.slide()?.imagePrompt;
    if (prompt) {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(prompt).then(() => {
          this.isPromptCopied.set(true);
          setTimeout(() => this.isPromptCopied.set(false), 2000);
        }).catch(err => {
          console.error('Failed to copy text: ', err);
          alert('Could not copy prompt to clipboard.');
        });
      } else {
        console.warn('Clipboard API not available.');
        alert('Clipboard access is not available in your browser or context (e.g., non-HTTPS).');
      }
    }
  }

  handleImagePaste(event: ClipboardEvent): void {
    event.preventDefault();
    const clipboardData = event.clipboardData;
    if (!clipboardData) {
        return;
    }

    const items = Array.from(clipboardData.items);
    const imageItem = items.find(item => item.type.startsWith('image/'));

    if (imageItem) {
        const file = imageItem.getAsFile();
        if (file) {
            const reader = new FileReader();
            reader.onload = (e: ProgressEvent<FileReader>) => {
                if (e.target?.result) {
                    const newSlide = { ...this.slide(), imageUrl: e.target.result as string };
                    this.slideChange.emit(newSlide);
                }
            };
            reader.readAsDataURL(file);
        }
    } else {
        console.warn('Paste event did not contain an image.');
    }
  }

  protected addRow(): void {
    const newSlide = { ...this.slide() };
    if (!newSlide.tableData || newSlide.tableData.length === 0) return;
    const newTableData = JSON.parse(JSON.stringify(newSlide.tableData));
    const columnCount = newTableData[0].length;
    newTableData.push(Array(columnCount).fill('Data'));
    newSlide.tableData = newTableData;
    this.slideChange.emit(newSlide);
  }

  protected removeRow(rowIndex: number): void {
    const newSlide = { ...this.slide() };
    if (!newSlide.tableData || newSlide.tableData.length <= 1) return; // Keep header
    const newTableData = JSON.parse(JSON.stringify(newSlide.tableData));
    if (rowIndex > 0 && rowIndex < newTableData.length) {
      newTableData.splice(rowIndex, 1);
      newSlide.tableData = newTableData;
      this.slideChange.emit(newSlide);
    }
  }

  protected addColumn(): void {
    const newSlide = { ...this.slide() };
    if (!newSlide.tableData) return;
    const newTableData = JSON.parse(JSON.stringify(newSlide.tableData));
    newTableData.forEach((row: string[], index: number) => {
      row.push(index === 0 ? 'Header' : 'Data');
    });
    newSlide.tableData = newTableData;
    this.slideChange.emit(newSlide);
  }

  protected removeColumn(colIndex: number): void {
    const newSlide = { ...this.slide() };
    if (!newSlide.tableData || newSlide.tableData[0].length <= 1) return;
    const newTableData = JSON.parse(JSON.stringify(newSlide.tableData));
    newTableData.forEach((row: string[]) => {
      if (colIndex >= 0 && colIndex < row.length) {
        row.splice(colIndex, 1);
      }
    });
    newSlide.tableData = newTableData;
    this.slideChange.emit(newSlide);
  }

  protected addChartDataPoint(): void {
    const newSlide = { ...this.slide() };
    if (!newSlide.chartData) return;
    const newChartData = JSON.parse(JSON.stringify(newSlide.chartData));
    newChartData.labels.push('New');
    newChartData.datasets.forEach((dataset: { data: number[] }) => {
      dataset.data.push(Math.floor(Math.random() * 500) + 50);
    });
    newSlide.chartData = newChartData;
    this.slideChange.emit(newSlide);
  }

  protected removeChartDataPoint(index: number): void {
    const newSlide = { ...this.slide() };
    if (!newSlide.chartData || newSlide.chartData.labels.length <= 1) return;
    const newChartData = JSON.parse(JSON.stringify(newSlide.chartData));
    if (index >= 0 && index < newChartData.labels.length) {
      newChartData.labels.splice(index, 1);
      newChartData.datasets.forEach((dataset: { data: number[] }) => {
        dataset.data.splice(index, 1);
      });
      newSlide.chartData = newChartData;
      this.slideChange.emit(newSlide);
    }
  }

  protected addChartDataset(): void {
    const newSlide = { ...this.slide() };
    if (!newSlide.chartData) return;
    const newChartData = JSON.parse(JSON.stringify(newSlide.chartData));
    const dataLength = newChartData.labels.length;
    newChartData.datasets.push({
      label: 'Dataset',
      data: Array.from({ length: dataLength }, () => Math.floor(Math.random() * 500) + 50)
    });
    newSlide.chartData = newChartData;
    this.slideChange.emit(newSlide);
  }

  protected removeChartDataset(index: number): void {
    const newSlide = { ...this.slide() };
    if (!newSlide.chartData || newSlide.chartData.datasets.length <= 1) return;
    const newChartData = JSON.parse(JSON.stringify(newSlide.chartData));
    if (index >= 0 && index < newChartData.datasets.length) {
      newChartData.datasets.splice(index, 1);
      newSlide.chartData = newChartData;
      this.slideChange.emit(newSlide);
    }
  }
}
