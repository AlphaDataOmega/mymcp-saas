/**
 * Browser-Use Integration Adapter for MyMCP.me
 * 
 * This module adapts Browser-Use's advanced DOM processing techniques
 * for integration with our Chrome Extension + SaaS architecture.
 * 
 * Key innovations borrowed from Browser-Use:
 * 1. Cryptographic element hashing (SHA-256)
 * 2. Multi-attribute element identification
 * 3. History-based element tracking
 * 4. AI-powered selector repair
 */

import crypto from 'crypto';

export interface DOMElementNode {
  tagName: string;
  attributes: Record<string, string>;
  textContent: string;
  xpath: string;
  coordinates: { x: number; y: number; width: number; height: number };
  parentBranch: string;
  highlightIndex?: number;
}

export interface DOMHistoryElement {
  tagName: string;
  xpath: string;
  attributes: Record<string, string>;
  coordinates: { x: number; y: number; width: number; height: number };
  parentBranch: string;
  hash: string;
  timestamp: number;
}

export interface SelectorMap {
  [index: number]: DOMElementNode;
}

/**
 * Browser-Use inspired DOM History Tree Processor
 * Provides cryptographic hashing and stable element tracking
 */
export class HistoryTreeProcessor {
  
  /**
   * Convert DOM element to history element with Browser-Use techniques
   */
  static convertDomElementToHistoryElement(element: DOMElementNode): DOMHistoryElement {
    const hash = this.generateElementHash(element);
    
    return {
      tagName: element.tagName.toLowerCase(),
      xpath: element.xpath,
      attributes: this.extractStableAttributes(element.attributes),
      coordinates: element.coordinates,
      parentBranch: element.parentBranch,
      hash,
      timestamp: Date.now()
    };
  }
  
  /**
   * Generate cryptographic hash for element (Browser-Use technique)
   * Uses parent branch + attributes + xpath for stable identification
   */
  static generateElementHash(element: DOMElementNode): string {
    const hashData = {
      tag: element.tagName.toLowerCase(),
      parentBranch: element.parentBranch,
      attributes: this.extractStableAttributes(element.attributes),
      xpath: element.xpath
    };
    
    const hashString = JSON.stringify(hashData, Object.keys(hashData).sort());
    return crypto.createHash('sha256').update(hashString).digest('hex');
  }
  
  /**
   * Extract stable attributes for hashing (Browser-Use approach)
   */
  static extractStableAttributes(attributes: Record<string, string>): Record<string, string> {
    const stableAttrs = [
      'title', 'type', 'name', 'role', 'tabindex', 
      'aria-label', 'placeholder', 'value', 'alt', 
      'aria-expanded', 'data-testid', 'data-cy'
    ];
    
    const stable: Record<string, string> = {};
    
    for (const attr of stableAttrs) {
      if (attributes[attr] && this.isStableAttributeValue(attr, attributes[attr])) {
        stable[attr] = attributes[attr];
      }
    }
    
    return stable;
  }
  
  /**
   * Check if attribute value is stable (not dynamically generated)
   */
  static isStableAttributeValue(attr: string, value: string): boolean {
    // Patterns that suggest dynamic/unstable values
    const unstablePatterns = [
      /\d{8,}/, // Long numbers
      /^[0-9a-f]{8,}$/i, // Hex strings
      /random|temp|tmp|gen/i, // Keywords suggesting generation
      /\d{4}-\d{2}-\d{2}/, // Dates
      /-\d+$/ // Ending with numbers
    ];
    
    return !unstablePatterns.some(pattern => pattern.test(value));
  }
  
  /**
   * Find history element in current DOM tree (Browser-Use inspired)
   */
  static findHistoryElementInTree(
    historyElement: DOMHistoryElement, 
    currentElements: DOMElementNode[]
  ): DOMElementNode | null {
    
    // First: Try exact hash match
    for (const element of currentElements) {
      const currentHash = this.generateElementHash(element);
      if (currentHash === historyElement.hash) {
        return element;
      }
    }
    
    // Second: Try attribute-based matching
    for (const element of currentElements) {
      if (this.matchByAttributes(historyElement, element)) {
        return element;
      }
    }
    
    // Third: Try XPath matching
    for (const element of currentElements) {
      if (this.matchByXPath(historyElement, element)) {
        return element;
      }
    }
    
    // Fourth: Try fuzzy structural matching
    for (const element of currentElements) {
      if (this.matchByStructure(historyElement, element)) {
        return element;
      }
    }
    
    return null;
  }
  
  /**
   * Match elements by stable attributes
   */
  static matchByAttributes(
    historyElement: DOMHistoryElement, 
    currentElement: DOMElementNode
  ): boolean {
    const historyAttrs = historyElement.attributes;
    const currentAttrs = currentElement.attributes;
    
    // Must have same tag
    if (historyElement.tagName !== currentElement.tagName.toLowerCase()) {
      return false;
    }
    
    // Check stable attribute matches
    const stableMatches = ['name', 'type', 'role', 'data-testid', 'aria-label'];
    let matchCount = 0;
    let totalStableAttrs = 0;
    
    for (const attr of stableMatches) {
      if (historyAttrs[attr]) {
        totalStableAttrs++;
        if (historyAttrs[attr] === currentAttrs[attr]) {
          matchCount++;
        }
      }
    }
    
    // Require at least 80% stable attribute match
    return totalStableAttrs > 0 && (matchCount / totalStableAttrs) >= 0.8;
  }
  
  /**
   * Match elements by XPath similarity
   */
  static matchByXPath(
    historyElement: DOMHistoryElement, 
    currentElement: DOMElementNode
  ): boolean {
    // Direct XPath match
    if (historyElement.xpath === currentElement.xpath) {
      return true;
    }
    
    // Fuzzy XPath match (handles dynamic indices)
    const historyXPathParts = historyElement.xpath.split('/');
    const currentXPathParts = currentElement.xpath.split('/');
    
    if (historyXPathParts.length !== currentXPathParts.length) {
      return false;
    }
    
    let matchingParts = 0;
    for (let i = 0; i < historyXPathParts.length; i++) {
      const historyPart = historyXPathParts[i].replace(/\[\d+\]/, ''); // Remove indices
      const currentPart = currentXPathParts[i].replace(/\[\d+\]/, '');
      
      if (historyPart === currentPart) {
        matchingParts++;
      }
    }
    
    // Require 90% structural path match
    return (matchingParts / historyXPathParts.length) >= 0.9;
  }
  
  /**
   * Match elements by structural similarity
   */
  static matchByStructure(
    historyElement: DOMHistoryElement, 
    currentElement: DOMElementNode
  ): boolean {
    // Same tag name and parent branch similarity
    if (historyElement.tagName !== currentElement.tagName.toLowerCase()) {
      return false;
    }
    
    const historyBranch = historyElement.parentBranch.split('>');
    const currentBranch = currentElement.parentBranch.split('>');
    
    // Allow some flexibility in branch depth
    const minLength = Math.min(historyBranch.length, currentBranch.length);
    let matchingLevels = 0;
    
    for (let i = 0; i < minLength; i++) {
      if (historyBranch[i].trim() === currentBranch[i].trim()) {
        matchingLevels++;
      }
    }
    
    // Require 70% structural similarity
    return minLength > 0 && (matchingLevels / minLength) >= 0.7;
  }
}

/**
 * AI-Powered Selector Repair Service
 * Uses Browser-Use techniques combined with AI analysis
 */
export class AISelectorRepairService {
  
  /**
   * Repair failed selector using AI analysis
   */
  static async repairSelector(
    originalElement: DOMHistoryElement,
    currentDOM: DOMElementNode[],
    intent: string,
    aiProvider: 'openai' | 'anthropic' = 'anthropic'
  ): Promise<string | null> {
    
    try {
      // Step 1: Try Browser-Use matching techniques first
      const matchedElement = HistoryTreeProcessor.findHistoryElementInTree(
        originalElement, 
        currentDOM
      );
      
      if (matchedElement) {
        return this.generateOptimalSelector(matchedElement);
      }
      
      // Step 2: Use AI for advanced repair
      const repairPrompt = this.buildRepairPrompt(originalElement, currentDOM, intent);
      const aiResponse = await this.queryAI(repairPrompt, aiProvider);
      
      if (aiResponse && aiResponse.selector) {
        // Validate AI-suggested selector
        const testElement = this.findElementBySelector(aiResponse.selector, currentDOM);
        if (testElement && this.validateSelectorMatch(testElement, originalElement)) {
          return aiResponse.selector;
        }
      }
      
      return null;
      
    } catch (error) {
      console.error('❌ AI Selector Repair failed:', error);
      return null;
    }
  }
  
  /**
   * Build prompt for AI selector repair
   */
  static buildRepairPrompt(
    originalElement: DOMHistoryElement,
    currentDOM: DOMElementNode[],
    intent: string
  ): string {
    return `
# Selector Repair Task

## Original Element (No Longer Found):
- Tag: ${originalElement.tagName}
- XPath: ${originalElement.xpath}
- Attributes: ${JSON.stringify(originalElement.attributes)}
- Parent Branch: ${originalElement.parentBranch}
- Intent: ${intent}

## Current Page Elements:
${currentDOM.slice(0, 50).map((el, idx) => `
${idx}: <${el.tagName}${Object.entries(el.attributes).map(([k,v]) => ` ${k}="${v}"`).join('')}>
   Text: ${el.textContent.slice(0, 100)}
   XPath: ${el.xpath}
`).join('')}

## Task:
Find the element in the current DOM that best matches the original element's intent: "${intent}"

Consider:
1. Similar attributes (especially name, type, role, aria-label)
2. Similar text content
3. Similar structural position
4. Same semantic purpose

## Response Format:
{
  "selector": "CSS selector for best match",
  "confidence": 0.85,
  "reasoning": "Why this element matches the original intent"
}
`;
  }
  
  /**
   * Generate optimal selector for element (Browser-Use inspired)
   */
  static generateOptimalSelector(element: DOMElementNode): string {
    // Priority order for selector generation
    
    // 1. Stable ID
    if (element.attributes.id && this.isStableAttributeValue('id', element.attributes.id)) {
      return `#${element.attributes.id}`;
    }
    
    // 2. Test attributes (highest priority for automation)
    const testAttrs = ['data-testid', 'data-cy', 'data-test'];
    for (const attr of testAttrs) {
      if (element.attributes[attr]) {
        return `[${attr}="${element.attributes[attr]}"]`;
      }
    }
    
    // 3. Semantic attributes
    if (element.attributes.name) {
      return `[name="${element.attributes.name}"]`;
    }
    
    if (element.attributes.role && element.attributes['aria-label']) {
      return `[role="${element.attributes.role}"][aria-label="${element.attributes['aria-label']}"]`;
    }
    
    // 4. Stable classes (Browser-Use technique)
    if (element.attributes.class) {
      const stableClasses = this.extractStableClasses(element.attributes.class);
      if (stableClasses.length > 0) {
        return '.' + stableClasses.join('.');
      }
    }
    
    // 5. XPath as fallback
    return element.xpath;
  }
  
  /**
   * Extract stable CSS classes (ignore dynamic ones)
   */  
  static extractStableClasses(className: string): string[] {
    const classes = className.split(' ').filter(c => c.trim());
    const stable = [];
    
    for (const cls of classes) {
      if (this.isStableClassName(cls)) {
        stable.push(cls);
      }
    }
    
    return stable;
  }
  
  /**
   * Check if CSS class name appears stable
   */
  static isStableClassName(className: string): boolean {
    // Patterns suggesting dynamic/generated classes
    const dynamicPatterns = [
      /^css-[a-z0-9]+$/i, // CSS-in-JS generated classes
      /^[a-z]+-[0-9]+$/i, // Framework generated classes
      /random|temp|gen/i, // Keywords suggesting generation
      /^[0-9a-f]{6,}$/i, // Hash-like classes
    ];
    
    return !dynamicPatterns.some(pattern => pattern.test(className));
  }
  
  /**
   * Query AI service for selector repair
   */
  static async queryAI(prompt: string, provider: 'openai' | 'anthropic'): Promise<any> {
    // This would integrate with your AI service
    // Implementation depends on your AI provider setup
    
    try {
      const response = await fetch('/api/ai/repair-selector', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, provider })
      });
      
      return await response.json();
      
    } catch (error) {
      console.error('AI service query failed:', error);
      return null;
    }
  }
  
  /**
   * Find element by selector in DOM
   */
  static findElementBySelector(selector: string, elements: DOMElementNode[]): DOMElementNode | null {
    // This would test the selector against the DOM elements
    // Implementation depends on your DOM representation
    
    for (const element of elements) {
      if (this.selectorMatches(selector, element)) {
        return element;
      }
    }
    
    return null;
  }
  
  /**
   * Check if selector matches element
   */
  static selectorMatches(selector: string, element: DOMElementNode): boolean {
    // Simplified selector matching - would need full CSS selector parser
    
    if (selector.startsWith('#')) {
      return element.attributes.id === selector.slice(1);
    }
    
    if (selector.startsWith('.')) {
      const className = selector.slice(1);
      return element.attributes.class?.includes(className) || false;
    }
    
    if (selector.startsWith('[')) {
      // Parse attribute selector
      const match = selector.match(/\[([^=]+)="([^"]+)"\]/);
      if (match) {
        const [, attr, value] = match;
        return element.attributes[attr] === value;
      }
    }
    
    return false;
  }
  
  /**
   * Validate that repaired selector matches original intent
   */
  static validateSelectorMatch(
    newElement: DOMElementNode, 
    originalElement: DOMHistoryElement
  ): boolean {
    // Check similarity between new and original elements
    
    // Must have same tag
    if (newElement.tagName.toLowerCase() !== originalElement.tagName) {
      return false;
    }
    
    // Check stable attribute overlap
    const originalAttrs = originalElement.attributes;
    const newAttrs = newElement.attributes;
    
    const stableAttrs = ['name', 'type', 'role', 'aria-label'];
    let matches = 0;
    let total = 0;
    
    for (const attr of stableAttrs) {
      if (originalAttrs[attr]) {
        total++;
        if (originalAttrs[attr] === newAttrs[attr]) {
          matches++;
        }
      }
    }
    
    // Require at least 70% stable attribute match
    return total === 0 || (matches / total) >= 0.7;
  }
}

/**
 * Extension integration utilities
 */
export class ExtensionIntegration {
  
  /**
   * Convert extension element data to Browser-Use format
   */
  static convertExtensionElement(extensionData: any): DOMElementNode {
    return {
      tagName: extensionData.tagName || 'div',
      attributes: extensionData.attributes || {},
      textContent: extensionData.textContent || '',
      xpath: extensionData.xpath || this.generateXPath(extensionData),
      coordinates: extensionData.boundingBox || { x: 0, y: 0, width: 0, height: 0 },
      parentBranch: extensionData.parentChain || '',
      highlightIndex: extensionData.highlightIndex
    };
  }
  
  /**
   * Generate XPath for element (fallback)
   */
  static generateXPath(elementData: any): string {
    // Simplified XPath generation
    const parts = [];
    
    if (elementData.parentChain) {
      const parents = elementData.parentChain.split('>');
      parts.push(...parents);
    }
    
    parts.push(elementData.tagName || 'div');
    
    return '//' + parts.join('/');
  }
}