import { Component, ChangeDetectionStrategy, input, output, signal, viewChild, ElementRef, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { GeminiService } from '../../services/gemini.service';
import { Presentation } from '../../types';

interface ChatMessage {
  sender: 'user' | 'bot';
  text: string;
  isStreaming?: boolean;
}

@Component({
  selector: 'app-chatbot',
  imports: [CommonModule, FormsModule],
  templateUrl: './chatbot.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatbotComponent {
  isOpen = input<boolean>(false);
  presentation = input.required<Presentation | null>();
  currentSlideIndex = input.required<number>();
  
  presentationChange = output<Presentation>();
  closeChat = output<void>();

  messages = signal<ChatMessage[]>([]);
  userInput = signal('');
  
  private chatContainer = viewChild<ElementRef>('chatContainer');
  private geminiService = inject(GeminiService);
  isAgentThinking = signal(false);

  constructor() {
    this.messages.set([{
      sender: 'bot',
      text: `Hello! I am your AI agent. I can modify this presentation for you. Try things like:
- "Add a new slide about our company history"
- "Change the theme to be darker"
- "Replace 'synergy' with 'collaboration' everywhere"`
    }]);

    // Add an effect to scroll to the bottom when messages change
    effect(() => {
        if (this.messages() && this.chatContainer()) {
            this.scrollToBottom();
        }
    });
  }

  async sendMessage(): Promise<void> {
    const messageText = this.userInput().trim();
    const pres = this.presentation();
    if (!messageText || !pres) return;

    // Add user message
    this.messages.update(m => [...m, { sender: 'user', text: messageText }]);
    this.userInput.set('');
    
    // Add bot's "thinking" placeholder message
    this.isAgentThinking.set(true);
    this.messages.update(m => [...m, { sender: 'bot', text: 'Thinking...', isStreaming: true }]);
    this.scrollToBottom();

    const result = await this.geminiService.runAgentCommand(messageText, pres, this.currentSlideIndex());
    
    // Update the presentation if the agent modified it
    if (result.newPresentation) {
      this.presentationChange.emit(result.newPresentation);
    }

    // Update the bot's message with the final response
    this.messages.update(m => {
        const lastMessage = m[m.length - 1];
        if (lastMessage && lastMessage.sender === 'bot') {
          lastMessage.text = result.responseText;
          lastMessage.isStreaming = false;
        }
        return [...m];
    });
    this.isAgentThinking.set(false);
  }
  
  private scrollToBottom(): void {
    // Using setTimeout to ensure the DOM has updated before scrolling
    setTimeout(() => {
      try {
        if (this.chatContainer()) {
            const el = this.chatContainer()!.nativeElement;
            el.scrollTop = el.scrollHeight;
        }
      } catch (err) {
          console.error('Could not scroll to bottom:', err);
      }
    }, 0);
  }
}